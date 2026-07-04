import fs from 'fs';
import path from 'path';

const DEFAULT_SESSION_DIR = './data/browser-sessions';

function sanitizeHostname(hostname) {
  return hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
}

export function getSessionDir() {
  const configured = process.env.BROWSER_STORAGE_STATE_DIR || DEFAULT_SESSION_DIR;
  return path.resolve(configured);
}

export function getStoragePathForHost(hostname) {
  if (!hostname) return null;
  return path.join(getSessionDir(), `${sanitizeHostname(hostname)}.json`);
}

export function loadStorageStateIfExists(hostname) {
  const storagePath = getStoragePathForHost(hostname);
  if (storagePath && fs.existsSync(storagePath)) {
    return storagePath;
  }
  return null;
}

export async function saveStorageState(context, hostname) {
  const storagePath = getStoragePathForHost(hostname);
  if (!storagePath || !context) return null;

  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  await context.storageState({ path: storagePath });
  return storagePath;
}