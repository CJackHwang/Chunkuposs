import type { StorageProvider, UploadResult, ChunkUploadOptions, ProviderCapabilities } from '@/providers/StorageProvider';
import { UPLOAD_URL, FORM_UPLOAD_PATH } from '@/config/constants';
import { BASE_DOWNLOAD_URL } from '@/config/constants';

export class CodemaoProvider implements StorageProvider {
  name = 'codemao';
  capabilities: ProviderCapabilities = { chunkUpload: true, singleUpload: true };

  async uploadSingle(file: File, options: ChunkUploadOptions): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('path', options.path || FORM_UPLOAD_PATH);
    const res = await fetch(UPLOAD_URL, { method: 'POST', body: formData, signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();
    if (!data?.url) throw new Error(data?.msg || '服务器响应缺少URL');
    return { url: data.url };
  }

  async uploadChunk(chunk: Blob, index: number, options: ChunkUploadOptions): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', chunk, `chunk-${index}`);
    formData.append('path', options.path || FORM_UPLOAD_PATH);
    const res = await fetch(UPLOAD_URL, { method: 'POST', body: formData, signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();
    if (!data?.url) throw new Error(data?.msg || '服务器响应缺少URL');
    return { url: data.url };
  }

  buildChunkManifest(filename: string, chunkUrls: string[]): string {
    const ids = chunkUrls.map(u => u.split('?')[0].split('/').pop() || '').join(',');
    return `[${encodeURIComponent(filename)}]${ids}`;
  }

  getDownloadBase(): string {
    return BASE_DOWNLOAD_URL;
  }
}
