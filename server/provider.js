// Provider registry with env-driven config; default: Codemao
import { getConfigFromEnv as getCodemaoConfig, createProvider as createCodemaoProvider } from './providers/codemao.js';

// const MB = 1024 * 1024; // unused

function env(name, def) { const v = process.env[name]; return (v === undefined || v === '') ? def : v; }

function getActiveProvider() {
  const active = env('DAV_PROVIDER', env('VITE_DEFAULT_PROVIDER', 'codemao'));
  switch (active) {
    case 'codemao':
    default: {
      const cfg = getCodemaoConfig();
      return createCodemaoProvider(cfg);
    }
  }
}

const PROV = getActiveProvider();
export const FORCE_CHUNK_MB = PROV.constants.FORCE_CHUNK_MB;
export const MAX_CHUNK_MB = PROV.constants.MAX_CHUNK_MB;
export const MIN_CHUNK_MB = PROV.constants.MIN_CHUNK_MB;

export async function uploadSingle(buffer, filename, timeoutMs) {
  return await PROV.uploadSingle(buffer, filename, timeoutMs);
}

export async function uploadChunks(buffers, filenamePrefix, timeoutMs) {
  return await PROV.uploadChunks(buffers, filenamePrefix, timeoutMs);
}

export async function uploadChunk(buffer, index, filenamePrefix, timeoutMs) {
  return await PROV.uploadChunk(buffer, index, filenamePrefix, timeoutMs);
}

export function buildChunkManifest(filename, chunkUrls) {
  return PROV.buildChunkManifest(filename, chunkUrls);
}

export function getDownloadBase() { return PROV.getDownloadBase(); }

export function decideChunking(totalSizeBytes) {
  return PROV.decideChunking(totalSizeBytes);
}

export function splitBuffers(buffer) {
  return PROV.splitBuffers(buffer);
}

export function computeChunkSizeBytes(totalSizeBytes) {
  return PROV.computeChunkSizeBytes(totalSizeBytes);
}
