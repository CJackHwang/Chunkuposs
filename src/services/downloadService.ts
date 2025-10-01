import { showToast } from '@/services/toast';
import { addDebugOutput } from '@/utils/storageHelper';
import { DOWNLOAD_CONCURRENT_LIMIT } from '@/config/constants';
type VueRef<T> = { value: T };

function parseSjurl(sjurl: string): { type: 'normal', url: string } | { type: 'invalid' } | { type: 'chunked', filename: string, chunkIdentifiers: string[] } {
  const isNormalUrl = /^(https?:\/\/)/i.test(sjurl);
  if (isNormalUrl) return { type: 'normal', url: sjurl };
  const matches = sjurl.match(/^\[(.*?)\]((.+)?)$/);
  if (!matches || matches.length < 3) return { type: 'invalid' };
  let filename = '';
  try { filename = decodeURIComponent(matches[1]); } catch { return { type: 'invalid' }; }
  const chunkIdentifiers = matches[2].split(',');
  if (!chunkIdentifiers || chunkIdentifiers.length === 0 || chunkIdentifiers[0] === '') return { type: 'invalid' };
  return { type: 'chunked', filename, chunkIdentifiers };
}

async function fetchBlob(url: string, index: number, total: number, statusRef: VueRef<string>, debugOutputRef: VueRef<string>, progressRef?: VueRef<number>): Promise<Blob> {
  try {
    addDebugOutput(`开始获取块 ${index + 1}/${total} (编程猫 OSS): ${url}`, debugOutputRef);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`无法获取块 ${index + 1} (编程猫 OSS - ${url}): ${res.status} ${res.statusText}`);
    const blob = await res.blob();
    statusRef.value = `下载中 (编程猫 OSS)... (${index + 1}/${total} 块)`;
    if (progressRef) progressRef.value = Math.floor(((index + 1) / total) * 100);
    addDebugOutput(`成功获取块 ${index + 1}/${total} (编程猫 OSS)`, debugOutputRef);
    return blob;
  } catch (error: any) {
    addDebugOutput(`获取块 ${index + 1} (编程猫 OSS) 失败: ${error.message}`, debugOutputRef);
    throw error;
  }
}

async function mergeAndDownload(blobs: Blob[], filename: string, statusRef: VueRef<string>, debugOutputRef: VueRef<string>) {
  if (!blobs || blobs.length === 0) {
    addDebugOutput('没有要合并的 Blob (编程猫 OSS)。', debugOutputRef);
    statusRef.value = '合并失败 (编程猫 OSS - 无数据)';
    showToast('没有数据可供合并下载 (编程猫 OSS)');
    return;
  }
  addDebugOutput(`开始合并 ${blobs.length} 个 Blob (编程猫 OSS)...`, debugOutputRef);
  statusRef.value = '正在合并文件 (编程猫 OSS)...';

  let downloadUrl: string | undefined;
  try {
    const mergedBlob = new Blob(blobs, { type: blobs[0]?.type || 'application/octet-stream' });
    addDebugOutput(`合并完成 (编程猫 OSS). 总大小: ${(mergedBlob.size / (1024 * 1024)).toFixed(2)} MB.`, debugOutputRef);
    downloadUrl = URL.createObjectURL(mergedBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename || 'downloaded-file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      addDebugOutput(`已释放合并 Blob 的 Object URL (编程猫 OSS): ${downloadUrl}`, debugOutputRef);
    }, 100);
    statusRef.value = '下载完成 (编程猫 OSS)!';
    addDebugOutput(`文件 "${filename}" (编程猫 OSS) 下载已触发。`, debugOutputRef);
    showToast(`文件 "${filename}" (编程猫 OSS) 下载已开始`);
  } catch (error: any) {
    showToast('合并或下载文件时出错');
    statusRef.value = '合并/下载失败 (编程猫 OSS)';
    addDebugOutput(`合并或下载错误 (编程猫 OSS): ${error.message}`, debugOutputRef);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  }
}

import { getDefaultProvider } from '@/providers';

export async function downloadFiles(args: {
  sjurlRef: VueRef<string>,
  statusRef: VueRef<string>,
  isUploadingRef: VueRef<boolean>,
  debugOutputRef: VueRef<string>,
  downloadProgressRef: VueRef<number>
}) {
  const { sjurlRef, statusRef, isUploadingRef, debugOutputRef, downloadProgressRef } = args;
  const baseDownloadUrl = getDefaultProvider().getDownloadBase();
  const urlToDownload = sjurlRef.value;
  if (!urlToDownload) {
    showToast('输入框中没有链接可供下载');
    return;
  }
  isUploadingRef.value = true;
  if (downloadProgressRef) downloadProgressRef.value = 0;
  statusRef.value = '正在处理链接...';

  const parsed = parseSjurl(urlToDownload);
  if (parsed.type === 'normal') {
    try {
      addDebugOutput(`尝试直接打开标准链接: ${urlToDownload}`, debugOutputRef);
      window.open(urlToDownload, '_blank');
      statusRef.value = '已尝试打开链接...';
      showToast('正在尝试打开或下载标准链接...');
    } catch (e: any) {
      showToast('无法打开链接，请检查链接或浏览器设置');
      statusRef.value = '打开链接失败';
      addDebugOutput(`直接打开链接失败: ${e.message}`, debugOutputRef);
    } finally {
      isUploadingRef.value = false;
    }
    return;
  }

  if (parsed.type === 'invalid') {
    showToast('链接格式无效，应为 "[文件名]块1,块2,..." 或标准 https:// URL');
    statusRef.value = '链接格式错误';
    addDebugOutput(`下载链接格式解析失败: ${urlToDownload}`, debugOutputRef);
    isUploadingRef.value = false;
    return;
  }

  const { filename, chunkIdentifiers } = parsed;
  const urls = chunkIdentifiers.map(identifier => `${baseDownloadUrl}${identifier.split('?')[0]}`);
  statusRef.value = `准备下载 ${urls.length} 个分块 (编程猫 OSS)...`;
  addDebugOutput(`开始下载 "${filename}" (编程猫 OSS - 共 ${urls.length} 块)...`, debugOutputRef);
  showToast('下载已开始，请稍候');

  let downloadedBlobs: Blob[] | undefined;
  try {
    const results: (Blob | null)[] = new Array(urls.length).fill(null);
    let inFlight = 0; let nextIndex = 0;
    await new Promise<void>((resolve, reject) => {
      function schedule() {
        while (inFlight < DOWNLOAD_CONCURRENT_LIMIT && nextIndex < urls.length) {
          const i = nextIndex++;
          inFlight++;
          fetchBlob(urls[i], i, urls.length, statusRef, debugOutputRef, downloadProgressRef)
            .then(blob => { results[i] = blob; })
            .catch(err => { reject(err); })
            .finally(() => {
              inFlight--;
              if (nextIndex >= urls.length && inFlight === 0) resolve();
              else schedule();
            });
        }
      }
      schedule();
    });
    downloadedBlobs = results.filter(Boolean) as Blob[];
    addDebugOutput(`所有 ${urls.length} 个分块已获取完毕。`, debugOutputRef);
    statusRef.value = '分块获取完成，正在合并...';
    if (downloadProgressRef) downloadProgressRef.value = 100;
    await mergeAndDownload(downloadedBlobs, filename, statusRef, debugOutputRef);
  } catch (error: any) {
    showToast('下载过程中发生错误: ' + error.message);
    statusRef.value = '下载失败!';
    addDebugOutput(`下载任务失败: ${error.message}`, debugOutputRef);
  } finally {
    isUploadingRef.value = false;
  }
}
