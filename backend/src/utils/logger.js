import fs from 'fs';
import path from 'path';

const LOG_DIR = process.env.LOG_PATH || './logs';

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function timestamp() {
  return new Date().toISOString();
}

function formatMessage(level, message, meta) {
  const base = `[${timestamp()}] [${level}] ${message}`;
  if (meta) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

function writeToFile(level, message, meta) {
  ensureLogDir();
  const date = new Date().toISOString().slice(0, 10);
  const logFile = path.join(LOG_DIR, `app-${date}.log`);
  const line = formatMessage(level, message, meta) + '\n';
  fs.appendFileSync(logFile, line, 'utf8');
}

export const logger = {
  info(message, meta) {
    const line = formatMessage('INFO', message, meta);
    console.log(line);
    writeToFile('INFO', message, meta);
  },
  warn(message, meta) {
    const line = formatMessage('WARN', message, meta);
    console.warn(line);
    writeToFile('WARN', message, meta);
  },
  error(message, meta) {
    const line = formatMessage('ERROR', message, meta);
    console.error(line);
    writeToFile('ERROR', message, meta);
  },
  debug(message, meta) {
    if (process.env.NODE_ENV === 'development') {
      const line = formatMessage('DEBUG', message, meta);
      console.debug(line);
      writeToFile('DEBUG', message, meta);
    }
  },
};