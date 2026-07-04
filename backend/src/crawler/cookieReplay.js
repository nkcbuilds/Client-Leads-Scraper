import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { getSessionDir, getStoragePathForHost } from './session.js';

const CLEARANCE_COOKIE_NAMES = new Set(['cf_clearance', '__cf_bm', 'cf_chl_2', 'cf_chl_rc_ni']);

function readJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function getRegistryPath() {
  return path.join(getSessionDir(), 'clearance-registry.json');
}

export function loadStorageStateData(hostname) {
  const storagePath = getStoragePathForHost(hostname);
  return readJson(storagePath);
}

export function extractClearanceCookies(storageState) {
  if (!storageState?.cookies?.length) return [];
  return storageState.cookies.filter((cookie) => CLEARANCE_COOKIE_NAMES.has(cookie.name));
}

export function hasClearanceCookies(storageState) {
  return extractClearanceCookies(storageState).length > 0;
}

export function getHostAliases(hostname) {
  const aliases = new Set([hostname]);
  if (hostname.startsWith('www.')) {
    aliases.add(hostname.slice(4));
  } else {
    aliases.add(`www.${hostname}`);
  }
  return [...aliases];
}

export function findReplayableStorageState(hostname) {
  for (const alias of getHostAliases(hostname)) {
    const state = loadStorageStateData(alias);
    if (state && hasClearanceCookies(state)) {
      return { hostname: alias, state, source: getStoragePathForHost(alias) };
    }
    if (state?.cookies?.length) {
      return { hostname: alias, state, source: getStoragePathForHost(alias) };
    }
  }
  return null;
}

export function updateClearanceRegistry(hostname, storageState) {
  const registry = readJson(getRegistryPath()) || { hosts: {} };
  const clearance = extractClearanceCookies(storageState);
  registry.hosts[hostname] = {
    updatedAt: new Date().toISOString(),
    cookieCount: storageState?.cookies?.length || 0,
    clearanceCookies: clearance.map((c) => c.name),
    storagePath: getStoragePathForHost(hostname),
  };
  writeJson(getRegistryPath(), registry);
  return registry.hosts[hostname];
}

export async function replayCookiesIntoContext(context, hostname) {
  const replay = findReplayableStorageState(hostname);
  if (!replay?.state?.cookies?.length) {
    return { replayed: 0, source: null };
  }

  const cookies = replay.state.cookies.map((cookie) => ({
    ...cookie,
    domain: cookie.domain || `.${hostname.replace(/^www\./, '')}`,
  }));

  try {
    await context.addCookies(cookies);
    logger.info('Replayed stored cookies into browser session', {
      hostname,
      sourceHost: replay.hostname,
      cookieCount: cookies.length,
      clearance: extractClearanceCookies(replay.state).map((c) => c.name),
    });
    return { replayed: cookies.length, source: replay.source };
  } catch (err) {
    logger.warn('Failed to replay stored cookies', {
      hostname,
      error: err.message?.slice(0, 120),
    });
    return { replayed: 0, source: replay.source, error: err.message };
  }
}

export function getClearanceRegistrySummary() {
  const registry = readJson(getRegistryPath());
  return registry?.hosts || {};
}