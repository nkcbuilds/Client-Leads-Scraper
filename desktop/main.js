import { app, BrowserWindow, ipcMain, shell } from 'electron';
import electronUpdater from 'electron-updater';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { spawn } from 'node:child_process';

const { autoUpdater } = electronUpdater;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const runtimeRoot = app.isPackaged ? process.resourcesPath : projectRoot;
const frontendDir = path.join(runtimeRoot, 'frontend');
const backendDir = path.join(runtimeRoot, 'backend');
const iconPath = path.join(projectRoot, 'desktop', 'assets', 'icon.png');

let frontendPort = 3000;
let backendPort = 3001;
let frontendUrl = `http://127.0.0.1:${frontendPort}`;
let backendUrl = `http://127.0.0.1:${backendPort}`;

const runtimeDataRoot = path.join(app.getPath('userData'), 'runtime');
const browserStorageDir = path.join(runtimeDataRoot, 'browser-sessions');
const playwrightBrowsersDir = path.join(runtimeDataRoot, 'playwright-browsers');
const dbPath = path.join(runtimeDataRoot, 'legalreach.db');

let mainWindow = null;
let splashWindow = null;
let backendProcess = null;
let frontendProcess = null;
let healthPollTimer = null;

let updateState = {
  status: 'idle',
  message: 'App is up to date.',
  version: app.getVersion(),
  downloaded: false,
};

let runtimeState = {
  phase: 'booting',
  statusLine: 'Preparing desktop runtime...',
  services: {
    filesystem: 'pending',
    playwright: 'pending',
    backend: 'pending',
    frontend: 'pending',
  },
  checks: [],
  lastError: null,
};

function broadcast(channel, payload) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
}

function broadcastUpdateState() {
  broadcast('desktop:update-state', updateState);
}

function broadcastRuntimeState() {
  broadcast('desktop:runtime-state', runtimeState);
}

function setUpdateState(patch) {
  updateState = { ...updateState, ...patch, version: app.getVersion() };
  broadcastUpdateState();
}

function setRuntimeState(patch) {
  runtimeState = {
    ...runtimeState,
    ...patch,
    services: {
      ...runtimeState.services,
      ...(patch.services || {}),
    },
  };
  broadcastRuntimeState();
}

function pushRuntimeCheck(entry) {
  runtimeState = {
    ...runtimeState,
    checks: [
      ...runtimeState.checks,
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        ...entry,
      },
    ].slice(-40),
  };
  broadcastRuntimeState();
}

function markService(name, state, message, extra = {}) {
  setRuntimeState({
    services: {
      [name]: state,
    },
    ...(message ? { statusLine: message } : {}),
    ...extra,
  });

  if (message) {
    pushRuntimeCheck({
      step: name,
      level: state === 'error' ? 'error' : 'info',
      message,
      details: extra,
    });
  }
}

function appMeta() {
  return {
    frontendUrl,
    backendUrl,
    runtimeDataRoot,
    browserStorageDir,
    frontendDir,
    backendDir,
    playwrightBrowsersDir,
    dbPath,
    platform: process.platform,
    packaged: app.isPackaged,
    version: app.getVersion(),
  };
}

function buildDiagnosticsHtml(title, details) {
  const escaped = JSON.stringify(details, null, 2)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!doctype html>
  <html>
    <body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;">
      <div style="max-width:860px;margin:0 auto;padding:40px 28px;">
        <div style="font-size:28px;font-weight:700;margin-bottom:12px;">${title}</div>
        <div style="font-size:16px;color:#cbd5e1;margin-bottom:20px;">LegalReach could not finish starting. The diagnostics below should help us fix it quickly.</div>
        <pre style="white-space:pre-wrap;background:#111827;border:1px solid #334155;border-radius:12px;padding:18px;overflow:auto;">${escaped}</pre>
      </div>
    </body>
  </html>`;
}

async function showStartupDiagnostics(error) {
  const target = mainWindow || splashWindow || new BrowserWindow({
    width: 960,
    height: 720,
    show: true,
    backgroundColor: '#0f172a',
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const details = {
    message: error?.message || String(error),
    stack: error?.stack || null,
    runtimeState,
    ...appMeta(),
  };

  await target.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildDiagnosticsHtml('Startup Diagnostics', details))}`);
  target.show();
}

async function waitForUrl(targetUrl, { timeoutMs = 45000, intervalMs = 500 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(targetUrl, (res) => {
          res.resume();
          resolve(res.statusCode);
        });
        req.on('error', reject);
      });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(`Timed out waiting for ${targetUrl}`);
}

async function resolveOpenPort(startPort) {
  let port = startPort;

  while (port < startPort + 50) {
    const available = await new Promise((resolve) => {
      const server = http.createServer();
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(true));
      });
    });

    if (available) return port;
    port += 1;
  }

  throw new Error(`Could not find an open port starting at ${startPort}`);
}

async function ensureRuntimeDirectories() {
  await fs.mkdir(runtimeDataRoot, { recursive: true });
  await fs.mkdir(browserStorageDir, { recursive: true });
  await fs.mkdir(playwrightBrowsersDir, { recursive: true });
}

async function runNodeCommand(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    child.stdout?.on('data', (chunk) => process.stdout.write(chunk));
    child.stderr?.on('data', (chunk) => process.stderr.write(chunk));
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(' ')}`));
    });
    child.on('error', reject);
  });
}

function backendCommand() {
  if (app.isPackaged) {
    return {
      command: process.execPath,
      args: [path.join(backendDir, 'src', 'server.js')],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      },
    };
  }

  return {
    command: 'node',
    args: [path.join(backendDir, 'src', 'server.js')],
    env: { ...process.env },
  };
}

function frontendCommand() {
  const nextBin = path.join(frontendDir, 'node_modules', 'next', 'dist', 'bin', 'next');

  if (app.isPackaged) {
    return {
      command: process.execPath,
      args: [nextBin, 'start', '-p', String(frontendPort), '-H', '127.0.0.1'],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      },
    };
  }

  return {
    command: 'node',
    args: [nextBin, 'dev', '-p', String(frontendPort), '-H', '127.0.0.1'],
    env: { ...process.env },
  };
}

async function ensurePlaywrightBrowser() {
  markService('playwright', 'starting', 'Checking Playwright Chromium runtime...');

  const playwrightCli = path.join(backendDir, 'node_modules', 'playwright', 'cli.js');
  const command = app.isPackaged ? process.execPath : 'node';
  const args = [playwrightCli, 'install', 'chromium'];
  const env = {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsersDir,
  };

  if (app.isPackaged) {
    env.ELECTRON_RUN_AS_NODE = '1';
  }

  await runNodeCommand(command, args, {
    cwd: backendDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  markService('playwright', 'healthy', 'Playwright Chromium is ready.');
}

async function startBackendProcess() {
  if (backendProcess && !backendProcess.killed) return;

  markService('backend', 'starting', 'Starting backend API service...');
  const { command, args, env } = backendCommand();
  backendProcess = spawn(command, args, {
    cwd: backendDir,
    env: {
      ...env,
      PORT: String(backendPort),
      NEXT_PUBLIC_API_URL: backendUrl,
      DB_PATH: dbPath,
      BROWSER_STORAGE_STATE_DIR: browserStorageDir,
      PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsersDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  backendProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(chunk);
  });
  backendProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(chunk);
  });
  backendProcess.on('exit', (code) => {
    if (!app.isQuitting) {
      console.error(`Backend process exited with code ${code}`);
      markService('backend', 'error', `Backend service exited with code ${code}.`);
    }
    backendProcess = null;
  });
}

async function startFrontendProcess() {
  if (frontendProcess && !frontendProcess.killed) return;

  markService('frontend', 'starting', 'Starting desktop interface...');
  const { command, args, env } = frontendCommand();
  frontendProcess = spawn(command, args, {
    cwd: frontendDir,
    env: {
      ...env,
      NEXT_PUBLIC_API_URL: backendUrl,
      PORT: String(frontendPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  frontendProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(chunk);
  });
  frontendProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(chunk);
  });
  frontendProcess.on('exit', (code) => {
    if (!app.isQuitting) {
      console.error(`Frontend process exited with code ${code}`);
      markService('frontend', 'error', `Desktop interface exited with code ${code}.`);
    }
    frontendProcess = null;
  });
}

async function stopBackendProcess() {
  if (!backendProcess) return;

  const proc = backendProcess;
  backendProcess = null;

  await new Promise((resolve) => {
    proc.once('exit', () => resolve());
    proc.kill('SIGTERM');
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGKILL');
      }
      resolve();
    }, 5000);
  });

  markService('backend', 'stopped', 'Backend API stopped.');
}

async function stopFrontendProcess() {
  if (!frontendProcess) return;

  const proc = frontendProcess;
  frontendProcess = null;

  await new Promise((resolve) => {
    proc.once('exit', () => resolve());
    proc.kill('SIGTERM');
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGKILL');
      }
      resolve();
    }, 5000);
  });

  markService('frontend', 'stopped', 'Desktop interface stopped.');
}

async function probeJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (error) {
            reject(error);
          }
          return;
        }
        reject(new Error(`Unexpected status ${res.statusCode} from ${url}`));
      });
    });
    req.on('error', reject);
  });
}

async function pollServiceHealth() {
  const backendHealth = await probeJson(`${backendUrl}/api/health`);
  await waitForUrl(frontendUrl, { timeoutMs: 4000, intervalMs: 250 });

  setRuntimeState({
    phase: 'ready',
    statusLine: backendHealth.gemini_configured
      ? 'Desktop runtime healthy.'
      : 'Desktop runtime healthy. Gemini API key still needs to be configured.',
    services: {
      backend: 'healthy',
      frontend: 'healthy',
    },
    lastError: null,
  });
}

function startHealthPolling() {
  clearInterval(healthPollTimer);
  healthPollTimer = setInterval(async () => {
    try {
      await pollServiceHealth();
    } catch (error) {
      setRuntimeState({
        phase: 'degraded',
        statusLine: `Desktop health warning: ${error.message}`,
        lastError: {
          message: error.message,
          stack: error.stack || null,
          timestamp: new Date().toISOString(),
        },
      });
      pushRuntimeCheck({
        step: 'healthcheck',
        level: 'error',
        message: error.message,
      });
    }
  }, 20000);
}

async function startServices() {
  setRuntimeState({
    phase: 'booting',
    statusLine: 'Preparing desktop runtime...',
    services: {
      filesystem: 'starting',
      playwright: 'pending',
      backend: 'pending',
      frontend: 'pending',
    },
    lastError: null,
  });

  await ensureRuntimeDirectories();
  markService('filesystem', 'healthy', 'Desktop data folders are ready.');

  await ensurePlaywrightBrowser();

  backendPort = await resolveOpenPort(3001);
  backendUrl = `http://127.0.0.1:${backendPort}`;
  frontendPort = await resolveOpenPort(3000);
  frontendUrl = `http://127.0.0.1:${frontendPort}`;
  pushRuntimeCheck({
    step: 'ports',
    message: `Reserved backend ${backendPort} and frontend ${frontendPort}.`,
  });

  await startBackendProcess();
  await waitForUrl(`${backendUrl}/api/health`);
  markService('backend', 'healthy', 'Backend API is responding.');

  await startFrontendProcess();
  await waitForUrl(frontendUrl);
  markService('frontend', 'healthy', 'Desktop interface is responding.');

  await pollServiceHealth();
  startHealthPolling();
}

async function createWindow() {
  splashWindow = new BrowserWindow({
    width: 560,
    height: 320,
    frame: false,
    resizable: false,
    movable: true,
    show: true,
    backgroundColor: '#0f172a',
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body style="margin:0;background:radial-gradient(circle at top,#1e3a8a 0%,#0f172a 58%,#020617 100%);color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;"><div style="width:100%;max-width:420px;padding:32px;text-align:center;"><div style="width:84px;height:84px;margin:0 auto 18px;border-radius:24px;background:linear-gradient(135deg,#1d4ed8,#0f172a);display:flex;align-items:center;justify-content:center;box-shadow:0 18px 50px rgba(15,23,42,.45);font-size:34px;font-weight:800;">LR</div><div style="font-size:32px;font-weight:700;letter-spacing:.02em;margin-bottom:10px;">LegalReach</div><div style="color:#cbd5e1;font-size:15px;margin-bottom:18px;">Preparing the desktop workspace and crawler runtime.</div><div style="height:8px;border-radius:999px;background:rgba(148,163,184,.18);overflow:hidden;"><div style="width:66%;height:100%;border-radius:999px;background:linear-gradient(90deg,#f59e0b,#60a5fa);animation:load 1.6s ease-in-out infinite;"></div></div></div><style>@keyframes load{0%{transform:translateX(-110%)}100%{transform:translateX(160%)}}</style></body></html>`)}`);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    backgroundColor: '#0f172a',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadURL(frontendUrl);
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    setUpdateState({ status: 'checking', message: 'Checking for updates...', downloaded: false });
  });

  autoUpdater.on('update-available', (info) => {
    setUpdateState({
      status: 'downloading',
      message: `Downloading version ${info.version}...`,
      downloaded: false,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    setUpdateState({
      status: 'downloading',
      message: `Downloading update... ${Math.round(progress.percent)}%`,
      downloaded: false,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setUpdateState({
      status: 'downloaded',
      message: `Version ${info.version} is ready. Restart to install.`,
      downloaded: true,
    });
  });

  autoUpdater.on('update-not-available', () => {
    setUpdateState({ status: 'idle', message: 'You are on the latest version.', downloaded: false });
  });

  autoUpdater.on('error', (err) => {
    setUpdateState({ status: 'error', message: `Update check failed: ${err.message}`, downloaded: false });
  });
}

async function shutdownDesktop() {
  clearInterval(healthPollTimer);
  await stopFrontendProcess().catch(() => {});
  await stopBackendProcess().catch(() => {});
}

ipcMain.handle('desktop:get-update-state', async () => updateState);
ipcMain.handle('desktop:quit-and-install-update', async () => {
  autoUpdater.quitAndInstall();
  return true;
});
ipcMain.handle('desktop:get-app-meta', async () => ({
  isDesktop: true,
  version: app.getVersion(),
  ...appMeta(),
}));
ipcMain.handle('desktop:get-runtime-state', async () => runtimeState);

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else if (splashWindow) {
    splashWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  app.isQuitting = true;
  await shutdownDesktop();
});

app.whenReady().then(async () => {
  setupAutoUpdater();
  await startServices();
  await createWindow();

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      setUpdateState({ status: 'error', message: `Update check failed: ${err.message}`, downloaded: false });
    });
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 6 * 60 * 60 * 1000);
  } else {
    setUpdateState({ status: 'idle', message: 'Desktop dev mode running.', downloaded: false });
  }
}).catch(async (err) => {
  console.error('Failed to start desktop app:', err);
  setRuntimeState({
    phase: 'error',
    statusLine: `Desktop startup failed: ${err.message}`,
    lastError: {
      message: err.message,
      stack: err.stack || null,
      timestamp: new Date().toISOString(),
    },
  });
  pushRuntimeCheck({
    step: 'startup',
    level: 'error',
    message: err.message,
  });
  await showStartupDiagnostics(err).catch(() => {});
  await shutdownDesktop().catch(() => {});
});
