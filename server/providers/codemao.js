// Codemao provider module
const MB = 1024 * 1024;

function env(name, def) { const v = process.env[name]; return (v === undefined || v === '') ? def : v; }

export function getConfigFromEnv() {
  return {
    name: 'codemao',
    uploadUrl: env('VITE_UPLOAD_URL', 'https://api.pgaot.com/user/up_cat_file'),
    formPath: env('VITE_FORM_UPLOAD_PATH', 'Chunkuposs'),
    downloadBase: env('VITE_BASE_DOWNLOAD_URL', 'https://static.codemao.cn/Chunkuposs/'),
    forceChunkMB: Number(env('VITE_FORCE_CHUNK_MB', '30')),
    maxChunkMB: Number(env('VITE_MAX_CHUNK_MB', '15')),
    minChunkMB: Number(env('VITE_MIN_CHUNK_MB', '1')),
  };
}

async function postForm(url, form, timeoutMs) {
  const ctrl = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
  const res = await fetch(url, { method: 'POST', body: form, signal: ctrl });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.url) throw new Error('Invalid provider response');
  return data.url;
}

export function createProvider(cfg) {
  return {
    name: cfg.name,
    getChunkSizeMB() { return cfg.maxChunkMB; },
    decideChunking(totalBytes) { return totalBytes >= (cfg.forceChunkMB * MB) || totalBytes > (1 * MB); },
    getDownloadBase() { return cfg.downloadBase; },
    async uploadSingle(buffer, filename, timeoutMs) {
      const form = new FormData();
      form.append('file', new Blob([buffer]), filename);
      form.append('path', cfg.formPath);
      return await postForm(cfg.uploadUrl, form, timeoutMs);
    },
    async uploadChunk(buffer, index, filenamePrefix, timeoutMs) {
      const form = new FormData();
      // 统一标准：分块对象名使用 `chunk-<index>`，不携带原始文件名或扩展名
      form.append('file', new Blob([buffer]), `chunk-${index}`);
      form.append('path', cfg.formPath);
      return await postForm(cfg.uploadUrl, form, timeoutMs);
    },
    async uploadChunks(buffers, filenamePrefix, timeoutMs) {
      const urls = [];
      for (let i = 0; i < buffers.length; i++) {
        urls.push(await this.uploadChunk(buffers[i], i, filenamePrefix, timeoutMs));
      }
      return urls;
    },
    buildChunkManifest(filename, chunkUrls) {
      const ids = chunkUrls.map(u => u.split('?')[0].split('/').pop() || '').join(',');
      return `[${encodeURIComponent(filename)}]${ids}`;
    },
    splitBuffers(buffer) {
      const size = Math.min(cfg.maxChunkMB * MB, buffer.length);
      const chunks = [];
      for (let i = 0; i < buffer.length; i += size) {
        chunks.push(buffer.subarray(i, Math.min(buffer.length, i + size)));
      }
      return chunks;
    },
    computeChunkSizeBytes(totalSizeBytes) {
      if (!totalSizeBytes || totalSizeBytes <= 0) return cfg.minChunkMB * MB;
      const half = Math.ceil(totalSizeBytes / 2);
      const bounded = Math.max(half, cfg.minChunkMB * MB);
      return Math.min(bounded, cfg.maxChunkMB * MB);
    },
    constants: {
      FORCE_CHUNK_MB: cfg.forceChunkMB,
      MAX_CHUNK_MB: cfg.maxChunkMB,
      MIN_CHUNK_MB: cfg.minChunkMB,
    }
  };
}
