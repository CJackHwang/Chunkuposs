// WebDAV Provider-backed Gateway (no file contents stored on relay)
import http from 'node:http';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { PORT, BASE_PATH, RATE_RPS } from './config.js';
import { loadStore, saveStore, listChildren, makeDir, setFile, getEntry, removeEntry, moveEntry, utils } from './db.js';
import { uploadSingle, uploadChunk, buildChunkManifest, getDownloadBase, computeChunkSizeBytes, MAX_CHUNK_MB } from './provider.js';
import { contentTypeByName } from './mime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// No auth (PoC as requested)
function checkAuth() { return true; }

// Very small token-bucket per IP
const buckets = new Map();
setInterval(() => {
  for (const b of buckets.values()) b.tokens = Math.min(b.tokens + RATE_RPS, RATE_RPS);
}, 1000);
function rateLimit(req, res) {
  const ip = (req.socket.remoteAddress || 'unknown');
  let b = buckets.get(ip);
  if (!b) { b = { tokens: RATE_RPS }; buckets.set(ip, b); }
  if (b.tokens <= 0) { res.writeHead(429); res.end('Too Many Requests'); return false; }
  b.tokens -= 1; return true;
}

function send(res, code, headers, body) {
  // 防止在已发送响应头后再次写入导致 ERR_HTTP_HEADERS_SENT
  if (res.headersSent) {
    try { res.end(); } catch { /* noop */ }
    return;
  }
  res.writeHead(code, headers);
  if (body) res.end(body); else res.end();
}

function pathFromUrl(urlPath) {
  let p = decodeURIComponent(urlPath || '/');
  if (!p.startsWith(BASE_PATH)) return null;
  p = p.slice(BASE_PATH.length);
  if (!p || p === '/') return '/';
  return utils.normalizePath(p);
}

function davHref(path, isDir) {
  const base = BASE_PATH + utils.normalizePath(path);
  return isDir ? (base.endsWith('/') ? base : base + '/') : base;
}

function handleOptions(req, res) {
  send(res, 200, {
    'DAV': '1,2',
    'Allow': 'OPTIONS, PROPFIND, MKCOL, PUT, GET, DELETE, MOVE',
    'Accept-Ranges': 'bytes',
  });
}

function xmlEscape(s) { return s.replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }

function makeETag(entry) {
  const base = `${entry.name || ''}|${entry.size || 0}|${entry.singleUrl || ''}|${entry.manifest || ''}|${entry.mtime || ''}`;
  const h = crypto.createHash('sha256').update(base).digest('hex').slice(0, 16);
  return `W/"${h}"`;
}

function propfind(store, vpath, depth = 0) {
  const now = new Date().toUTCString();
  function entry(href, name, isDir, size, mtime, etag, ctype, extraProps = '') {
    return `
  <D:response>
    <D:href>${href}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${xmlEscape(name)}</D:displayname>
        <D:resourcetype>${isDir ? '<D:collection/>' : ''}</D:resourcetype>
        <D:getcontentlength>${isDir ? 0 : size}</D:getcontentlength>
        <D:getlastmodified>${mtime || now}</D:getlastmodified>
        ${isDir ? '' : `<D:getcontenttype>${xmlEscape(ctype || 'application/octet-stream')}</D:getcontenttype>`}
        ${isDir ? '' : `<D:getetag>${xmlEscape(etag || '')}</D:getetag>`}
        ${extraProps}
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
  }
  let xml = `<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:">`;
  const me = getEntry(store, vpath) || { type: 'dir', name: vpath === '/' ? '/' : vpath.split('/').filter(Boolean).pop(), mtime: new Date().toISOString() };
  const hrefSelf = davHref(vpath, me.type === 'dir');
  const etagSelf = me.type === 'dir' ? '' : makeETag(me);
  const ctypeSelf = me.type === 'dir' ? '' : contentTypeByName(me.name || '');
  const extraSelf = me.type === 'dir' ? '' : `
        <C:manifest xmlns:C="urn:flowchunkflex">${xmlEscape(me.manifest || '')}</C:manifest>
        <C:singleurl xmlns:C="urn:flowchunkflex">${xmlEscape(me.singleUrl || '')}</C:singleurl>`;
  xml += entry(hrefSelf, me.name || '/', me.type === 'dir', me.type === 'dir' ? 0 : (me.size || 0), new Date(me.mtime).toUTCString(), etagSelf, ctypeSelf, extraSelf);
  if (me.type === 'dir' && depth !== 0) {
    const children = listChildren(store, vpath);
    for (const c of children) {
      const isDir = c.entry.type === 'dir';
      const childHref = davHref(c.path, isDir);
      const etag = isDir ? '' : makeETag(c.entry);
      const ctype = isDir ? '' : contentTypeByName(c.entry.name || '');
      const extra = isDir ? '' : `
        <C:manifest xmlns:C="urn:flowchunkflex">${xmlEscape(c.entry.manifest || '')}</C:manifest>
        <C:singleurl xmlns:C="urn:flowchunkflex">${xmlEscape(c.entry.singleUrl || '')}</C:singleurl>`;
      xml += entry(childHref, c.entry.name, isDir, isDir ? 0 : (c.entry.size || 0), new Date(c.entry.mtime).toUTCString(), etag, ctype, extra);
    }
  }
  xml += '\n</D:multistatus>';
  return xml;
}

async function fetchContentLength(u) {
  try {
    const r = await fetch(u, { method: 'HEAD' });
    const cl = r.headers.get('content-length');
    return cl ? Number(cl) : 0;
  } catch { return 0; }
}

function extOf(name){ const i = (name || '').lastIndexOf('.'); return i >= 0 ? (name || '').slice(i+1).toLowerCase() : ''; }

async function computeSizeFromManifest(manifest, filename) {
  try {
    const ids = manifest.replace(/^\[[^\]]+\]/, '').split(',').filter(Boolean);
    const base = getDownloadBase();
    const ext = extOf(filename || '');
    let sum = 0;
    for (let id of ids) {
      // 单链规则：.chunk--1 替换为真实扩展名
      if (/\.chunk--1$/i.test(id)) { id = id.replace(/\.chunk--1$/i, ext ? `.${ext}` : ''); }
      sum += await fetchContentLength(base + id);
    }
    return sum;
  } catch { return 0; }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buf = Buffer.concat(chunks);
  return new Uint8Array(buf);
}

// 高性能、低内存的流式传输：遵循下游写入背压（drain）
async function streamWebToRes(webBody, res) {
  for await (const chunk of webBody) {
    const ok = res.write(chunk);
    if (!ok) {
      await new Promise(resolve => res.once('drain', resolve));
    }
  }
}

async function handlePut(store, vpath, req, res) {
  // Ensure parent dir exists in metadata
  const parent = utils.getParent(vpath);
  if (!getEntry(store, parent)) makeDir(store, parent);

  const filename = vpath.split('/').filter(Boolean).pop() || 'file';
  let fileInfo = { name: filename, size: 0 };
  try {
    const ctype = (req.headers['content-type'] || '').toLowerCase();
    // Handle plain-text manifest
    if (ctype.includes('text/plain')) {
      const collected = await readBody(req);
      const asText = new TextDecoder().decode(collected);
      const isManifest = /^\[[^\]]+\][A-Za-z0-9_,.-]+$/.test(asText.trim());
      if (isManifest) {
        fileInfo = { ...fileInfo, manifest: asText.trim(), size: 0 };
        // 尝试计算清单的总大小（支持单链 .chunk--1 通过文件扩展名恢复）
        const sz = await computeSizeFromManifest(fileInfo.manifest, fileInfo.name);
        if (sz > 0) fileInfo.size = sz;
        setFile(store, vpath, fileInfo);
        saveStore(store);
        const payload = { name: filename, size: fileInfo.size || 0, manifest: fileInfo.manifest, kind: 'manifest' };
        send(res, 201, { 'Content-Type': 'application/json' }, JSON.stringify(payload));
        return;
      }
      // fallthrough to upload as binary
      // Reinject the collected buffer into a simple stream process
      let totalSize = 0;
      const contentLen = Number(req.headers['content-length'] || 0);
      const CHUNK_SIZE = contentLen > 0 ? computeChunkSizeBytes(contentLen) : (MAX_CHUNK_MB * 1024 * 1024);
      let buffer = new Uint8Array(CHUNK_SIZE);
      let bufferPos = 0;
      let flushed = 0;
      const chunkUrls = [];
      const chunkLengths = [];
      const handleFlush = async () => {
        if (bufferPos === 0) return;
        const part = buffer.subarray(0, bufferPos);
        const url = await uploadChunk(part, flushed, filename, 120_000);
        chunkUrls.push(url);
        chunkLengths.push(part.length);
        flushed++;
        buffer = new Uint8Array(CHUNK_SIZE);
        bufferPos = 0;
      };
      // write collected
      totalSize += collected.length;
      let offset = 0;
      while (offset < collected.length) {
        const can = Math.min(CHUNK_SIZE - bufferPos, collected.length - offset);
        buffer.set(collected.subarray(offset, offset + can), bufferPos);
        bufferPos += can; offset += can;
        if (bufferPos === CHUNK_SIZE) await handleFlush();
      }
      for await (const chunk of req) {
        const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
        totalSize += u8.length;
        let off = 0;
        while (off < u8.length) {
          const can = Math.min(CHUNK_SIZE - bufferPos, u8.length - off);
          buffer.set(u8.subarray(off, off + can), bufferPos);
          bufferPos += can; off += can;
          if (bufferPos === CHUNK_SIZE) await handleFlush();
        }
      }
      // finalize
      if (flushed === 0 && bufferPos <= (1 * 1024 * 1024)) {
        const singleBuf = bufferPos > 0 ? buffer.subarray(0, bufferPos) : new Uint8Array();
        const url = await uploadSingle(singleBuf, filename, 60_000);
        const id = url.split('?')[0].split('/').pop() || '';
        const idBase = id.replace(/\.[^./]+$/, '');
        const manifestSingle = `[${encodeURIComponent(filename)}]${idBase}.chunk--1`;
        // 统一格式：记录 manifest，同时保留 singleUrl 以便直接转发
        fileInfo = { ...fileInfo, singleUrl: url, manifest: manifestSingle, size: totalSize };
      } else {
        if (bufferPos > 0) await handleFlush();
        if (chunkUrls.length === 1) {
          // 单片结果按单链接处理，避免历史出现“chunk-0”这类占位名
          fileInfo = { ...fileInfo, singleUrl: chunkUrls[0], size: totalSize };
        } else {
          const manifest = buildChunkManifest(filename, chunkUrls);
          fileInfo = { ...fileInfo, manifest, chunkUrls, chunkLengths, size: totalSize };
        }
      }
    } else {
      // Binary streaming
      let totalSize = 0;
      const contentLen2 = Number(req.headers['content-length'] || 0);
      const CHUNK_SIZE = contentLen2 > 0 ? computeChunkSizeBytes(contentLen2) : (MAX_CHUNK_MB * 1024 * 1024);
      let buffer = new Uint8Array(CHUNK_SIZE);
      let bufferPos = 0;
      let flushed = 0;
      const chunkUrls = [];
      const chunkLengths = [];
      const handleFlush = async () => {
        if (bufferPos === 0) return;
        const part = buffer.subarray(0, bufferPos);
        const url = await uploadChunk(part, flushed, filename, 120_000);
        chunkUrls.push(url);
        chunkLengths.push(part.length);
        flushed++;
        buffer = new Uint8Array(CHUNK_SIZE);
        bufferPos = 0;
      };
      for await (const chunk of req) {
        const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
        totalSize += u8.length;
        let off = 0;
        while (off < u8.length) {
          const can = Math.min(CHUNK_SIZE - bufferPos, u8.length - off);
          buffer.set(u8.subarray(off, off + can), bufferPos);
          bufferPos += can; off += can;
          if (bufferPos === CHUNK_SIZE) await handleFlush();
        }
      }
      if (flushed === 0 && bufferPos <= (1 * 1024 * 1024)) {
        const singleBuf = bufferPos > 0 ? buffer.subarray(0, bufferPos) : new Uint8Array();
        const url = await uploadSingle(singleBuf, filename, 60_000);
        const id = url.split('?')[0].split('/').pop() || '';
        const idBase = id.replace(/\.[^./]+$/, '');
        const manifestSingle = `[${encodeURIComponent(filename)}]${idBase}.chunk--1`;
        fileInfo = { ...fileInfo, singleUrl: url, manifest: manifestSingle, size: totalSize };
      } else {
        if (bufferPos > 0) await handleFlush();
        if (chunkUrls.length === 1) {
          fileInfo = { ...fileInfo, singleUrl: chunkUrls[0], size: totalSize };
        } else {
          const manifest = buildChunkManifest(filename, chunkUrls);
          fileInfo = { ...fileInfo, manifest, chunkUrls, chunkLengths, size: totalSize };
        }
      }
    }
    setFile(store, vpath, fileInfo);
    saveStore(store);
    const payload = { name: filename, size: fileInfo.size || 0, manifest: fileInfo.manifest, singleUrl: fileInfo.singleUrl, kind: (fileInfo.singleUrl ? 'single' : 'manifest') };
    send(res, 201, { 'Content-Type': 'application/json' }, JSON.stringify(payload));
  } catch {
    send(res, 500, {}, 'Provider Upload Error');
  }
}

async function handleGet(store, vpath, req, res) {
  const entry = getEntry(store, vpath);
  if (!entry) { send(res, 404, {}, 'Not Found'); return; }
  if (entry.type === 'dir') { send(res, 403, {}, 'Is a collection'); return; }
  const ctype = contentTypeByName(entry.name || '');
  const etag = makeETag(entry);
  const range = (req.headers['range'] || '').toString();
  const isRange = range.startsWith('bytes=');
  // Range support for singleUrl; for chunked, map global range across chunks
  if (isRange && !entry.singleUrl && !(entry.chunkUrls && entry.chunkLengths)) {
    send(res, 416, {}, 'Range Not Supported');
    return;
  }
  // 小工具：HEAD 预检上游可用性与长度
  async function headOne(url){
    try {
      const r = await fetch(url, { method: 'HEAD' });
      const lenHeader = r.headers.get('content-length');
      return { ok: r.ok, status: r.status, length: lenHeader ? Number(lenHeader) : undefined };
    } catch {
      return { ok: false, status: 0, length: undefined };
    }
  }
  async function preflightUrls(urls){
    let okAll = true; let totalLen = 0; const details = [];
    for (const u of urls){
      const h = await headOne(u);
      details.push({ url: u, ...h });
      if (!h.ok) okAll = false;
      if (h.length) totalLen += h.length;
    }
    return { okAll, totalLen: totalLen || undefined, details };
  }
  try {
    if (entry.singleUrl) {
      // 非 Range：高性能低内存，直接按背压流式转发（不设置 Content-Length 使用分块编码）
      if (!isRange) {
        const r0 = await fetch(entry.singleUrl);
        if (!r0.ok || !r0.body) {
          const code = r0 && r0.status === 404 ? 404 : 502;
          send(res, code, { 'Content-Type': 'text/plain; charset=utf-8' }, code === 404 ? '文件不存在或已失效' : '上游服务不可用');
          return;
        }
        res.writeHead(200, { 'Content-Type': ctype, 'ETag': etag, 'Content-Disposition': `inline; filename="${encodeURIComponent(entry.name || 'file')}"` });
        await streamWebToRes(r0.body, res);
        res.end();
        return;
      }
      // Range：保持流式但检查失败并返回错误（单链直接按 singleUrl 请求）
      const r = await fetch(entry.singleUrl, { headers: { Range: range } });
      if (!r.ok || !r.body) { send(res, r.status === 404 ? 404 : 502, { 'Content-Type': 'text/plain; charset=utf-8' }, '上游服务不可用'); return; }
      const cr = r.headers.get('content-range') || '';
      const cl = r.headers.get('content-length') || undefined;
      res.writeHead(206, { 'Content-Type': ctype, ...(cl ? { 'Content-Length': cl } : {}), ...(cr ? { 'Content-Range': cr } : {}), 'ETag': etag, 'Content-Disposition': `inline; filename="${encodeURIComponent(entry.name || 'file')}"` });
      await streamWebToRes(r.body, res);
      res.end();
    } else if (entry.chunkUrls && entry.chunkUrls.length) {
      // Non-range：高性能低内存，顺序流式拼接所有分片
      if (!isRange) {
        const urls = entry.chunkUrls.slice();
        res.writeHead(200, { 'Content-Type': ctype, 'ETag': etag, 'Content-Disposition': `inline; filename="${encodeURIComponent(entry.name || 'file')}"` });
        for (const url of urls) {
          const r = await fetch(url);
          if (!r.ok || !r.body) { try { res.end(); } catch { /* noop */ } return; }
          await streamWebToRes(r.body, res);
        }
        res.end();
        return;
      }
      if (isRange && entry.chunkLengths && entry.chunkLengths.length === entry.chunkUrls.length) {
        // Parse range: bytes=start-end
        const m = range.match(/^bytes=(\d+)-(\d+)?$/);
        if (!m) { send(res, 416, {}, 'Bad Range'); return; }
        const start = Number(m[1]);
        const end = m[2] ? Number(m[2]) : (entry.size ? entry.size - 1 : undefined);
        const totalLen = entry.size || entry.chunkLengths.reduce((a,b)=>a+b,0);
        const to = (end !== undefined) ? end : (totalLen - 1);
        if (isNaN(start) || isNaN(to) || start > to) { send(res, 416, {}, 'Bad Range'); return; }
        // Find chunk indices
        let acc = 0; const spans = [];
        for (let i=0;i<entry.chunkLengths.length;i++){
          const len = entry.chunkLengths[i];
          const chunkStartGlobal = acc;
          const chunkEndGlobal = acc + len - 1;
          // overlap?
          if (to >= chunkStartGlobal && start <= chunkEndGlobal){
            const localStart = Math.max(0, start - chunkStartGlobal);
            const localEnd = Math.min(len - 1, to - chunkStartGlobal);
            spans.push({ i, localStart, localEnd });
          }
          acc += len;
        }
        // Preflight: check all target spans' chunks are available
        const preSpans = await preflightUrls(spans.map(s => entry.chunkUrls[s.i]));
        if (!preSpans.okAll) {
          const notOk = preSpans.details.find(d => !d.ok);
          const code = notOk && notOk.status === 404 ? 404 : 502;
          send(res, code, { 'Content-Type': 'text/plain' }, 'Upstream chunk missing');
          return;
        }
        const contentLength = (to - start + 1);
        res.writeHead(206, { 'Content-Type': ctype, 'Content-Length': contentLength, 'Content-Range': `bytes ${start}-${to}/${totalLen}`, 'ETag': etag, 'Content-Disposition': `inline; filename="${encodeURIComponent(entry.name || 'file')}"` });
        for (const s of spans){
          const url = entry.chunkUrls[s.i];
          const r = await fetch(url, { headers: { Range: `bytes=${s.localStart}-${s.localEnd}` } });
          if (!r.ok || !r.body) { try { res.end(); } catch { /* noop */ } return; }
          await streamWebToRes(r.body, res);
        }
        res.end();
        return;
      }
      const urls = entry.chunkUrls.slice();
      const concurrency = 4;
      const results = Array.from({ length: urls.length }, () => null);
      let next = 0; let started = 0;
      async function startOne(i){
        const r = await fetch(urls[i]);
        if (!r.ok || !r.body) throw new Error('Upstream Error');
        const bufs = [];
        for await (const chunk of r.body) bufs.push(chunk);
        results[i] = Buffer.concat(bufs);
        while (results[next]) { res.write(results[next]); next++; }
      }
      while (started < urls.length && started < concurrency) { startOne(started++); }
      while (started < urls.length) { await startOne(started++); }
      // drain remaining
      while (results[next]) { res.write(results[next]); next++; }
      res.end();
    } else if (entry.manifest) {
      // Non-range：高性能低内存，按清单顺序流式拼接
      const ids = entry.manifest.replace(/^\[[^\]]+\]/, '').split(',').filter(Boolean);
      const base = getDownloadBase();
      const urls = ids.map(id => base + id);
      if (!isRange) {
        res.writeHead(200, { 'Content-Type': ctype, 'ETag': etag, 'Content-Disposition': `inline; filename="${encodeURIComponent(entry.name || 'file')}"` });
        for (const url of urls) {
          const r = await fetch(url);
          if (!r.ok || !r.body) { try { res.end(); } catch { /* noop */ } return; }
          await streamWebToRes(r.body, res);
        }
        res.end();
        return;
      }
    } else {
      send(res, 404, {}, 'No Data');
    }
  } catch {
    if (res.headersSent) {
      try { res.end(); } catch { /* noop */ }
    } else {
      send(res, 500, { 'Content-Type': 'text/plain' }, 'Proxy Error');
    }
  }
}

async function handleHead(store, vpath, res) {
  const entry = getEntry(store, vpath);
  if (!entry) { send(res, 404, {}, 'Not Found'); return; }
  if (entry.type === 'dir') { send(res, 403, {}, 'Is a collection'); return; }
  const ctype = contentTypeByName(entry.name || '');
  const etag = makeETag(entry);
  let total = entry.size || undefined;
  // 如果未记录大小，尝试通过上游 HEAD 预估（单链接或清单）
  if (!total) {
    try {
      if (entry.singleUrl) {
        const r = await fetch(entry.singleUrl, { method: 'HEAD' });
        const cl = r.headers.get('content-length');
        if (cl) total = Number(cl);
      } else if (entry.manifest) {
        const ids = entry.manifest.replace(/^\[[^\]]+\]/, '').split(',').filter(Boolean);
        const base = getDownloadBase();
        let sum = 0;
        for (const id of ids) {
          const r = await fetch(base + id, { method: 'HEAD' });
          const cl = r.headers.get('content-length');
          if (cl) sum += Number(cl);
        }
        if (sum > 0) total = sum;
      }
    } catch { /* ignore */ }
  }
  send(res, 200, { 'Content-Type': ctype, ...(total ? { 'Content-Length': total } : {}), 'ETag': etag });
}

function start() {
  const server = http.createServer(async (req, res) => {
    if (!rateLimit(req, res)) return;
    if (!checkAuth(req, res)) return;
    const method = req.method || 'GET';
    const depth = req.headers['depth'] ?? '0';
    const urlPath = req.url || '/';
    const vpath = pathFromUrl(urlPath);
    if (vpath == null) { send(res, 404, {}, 'Not Found'); return; }

    const store = loadStore();
    try {
      if (method === 'OPTIONS') { handleOptions(req, res); return; }
      if (method === 'PROPFIND') {
        const xml = propfind(store, vpath, depth === 'infinity' ? 1 : Number(depth));
        send(res, 207, { 'Content-Type': 'application/xml; charset=utf-8' }, xml);
        return;
      }
      if (method === 'MKCOL') {
        makeDir(store, vpath); saveStore(store); send(res, 201); return;
      }
      if (method === 'PUT') { await handlePut(store, vpath, req, res); return; }
      if (method === 'GET') { await handleGet(store, vpath, req, res); return; }
      if (method === 'HEAD') { await handleHead(store, vpath, res); return; }
      // Protect root and myupload from deletion
      if (method === 'DELETE' && (vpath === '/' || vpath === '/myupload/')) { send(res, 403, {}, 'Protected'); return; }
      if (method === 'DELETE') {
        const entry = getEntry(store, vpath);
        if (!entry) { send(res, 404, {}, 'Not Found'); return; }
        const link = entry.singleUrl || entry.manifest || '';
        const kind = entry.singleUrl ? 'single' : (entry.manifest ? 'manifest' : 'unknown');
        removeEntry(store, vpath); saveStore(store);
        if (link) {
          const payload = { name: entry.name || '', link, kind };
          send(res, 200, { 'Content-Type': 'application/json' }, JSON.stringify(payload));
        } else {
          send(res, 204);
        }
        return;
      }
      if (method === 'MOVE') {
        const dest = req.headers['destination'];
        if (!dest) { send(res, 400, {}, 'Missing Destination'); return; }
        const urlObj = new URL(dest, 'http://localhost');
        const np = pathFromUrl(urlObj.pathname);
        if (np == null) { send(res, 400, {}, 'Bad Destination'); return; }
        const ok = moveEntry(store, vpath, np);
        if (ok) { saveStore(store); send(res, 201); } else { send(res, 404, {}, 'Not Found'); }
        return;
      }

      send(res, 405, {}, 'Method Not Allowed');
    } catch {
      send(res, 500, {}, 'Server Error');
    }
  });

  server.listen(PORT, () => {
     
    console.log(`WebDAV Gateway listening on http://localhost:${PORT}${BASE_PATH}`);
  });
}

start();
