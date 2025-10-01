import { addDebugOutput, saveUploadHistory } from '@/utils/storageHelper';
import { showToast } from '@/services/toast';
import { UPLOAD_URL, FORM_UPLOAD_PATH, REQUEST_RATE_LIMIT, CONCURRENT_LIMIT } from '../config/constants.js';

export async function uploadChunks({ file, CHUNK_SIZE, totalChunks, debugOutputRef, statusRef, sjurlRef, uploadHistoryRef, updateEstimatedCompletionTimeAfterUpload, resetEstimatedCompletionTime }) {
  const urls = new Array(totalChunks).fill(null);
  const startTime = Date.now();
  const reader = file.stream().getReader();
  let buffer = new Uint8Array(CHUNK_SIZE);
  let bufferPos = 0;
  let chunkIndex = 0;
  let activeUploads = 0;
  const lastRequestTimestamps = [];

  function getActiveUploadCount() { return activeUploads; }

  async function waitForRateLimitSlot() {
    while (true) {
      const now = Date.now();
      for (let i = lastRequestTimestamps.length - 1; i >= 0; i--) {
        if (now - lastRequestTimestamps[i] >= 1000) lastRequestTimestamps.splice(i, 1);
      }
      if (lastRequestTimestamps.length < REQUEST_RATE_LIMIT) {
        lastRequestTimestamps.push(now);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async function waitForConcurrencySlot() {
    while (getActiveUploadCount() >= CONCURRENT_LIMIT) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  async function uploadChunkWithRetry(i, chunk) {
    activeUploads++;
    let lastError = null;
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 1000;

    addDebugOutput(`开始上传块 ${i} (大小: ${(chunk.size / 1024).toFixed(1)} KB)`, debugOutputRef);
    try {
      const formData = new FormData();
      formData.append('file', chunk, `chunk-${i}`);
      formData.append('path', FORM_UPLOAD_PATH);
      const sizeMB = chunk.size / (1024 * 1024);
      const calculatedTimeout = 10000 + sizeMB * 6000;
      const dynamicTimeout = Math.min(Math.max(calculatedTimeout, 10000), 300000);
      addDebugOutput(`块 ${i} - 设置超时: ${dynamicTimeout / 1000}s`, debugOutputRef);

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const start = Date.now();
          const response = await fetch(UPLOAD_URL, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(dynamicTimeout)
          });
          const duration = Date.now() - start;
          if (!response.ok) {
            let errorBody = '';
            try { errorBody = await response.text(); } catch {}
            throw new Error(`HTTP ${response.status} ${response.statusText}. Body: ${errorBody.substring(0, 100)}`);
          }
          const data = await response.json();
          if (!data || !data.url) {
            throw new Error(data?.msg || '服务器响应无效或缺少URL');
          }
          urls[i] = data.url;
          addDebugOutput(`块 ${i} 上传成功 | 耗时: ${duration}ms | URL: ${data.url}`, debugOutputRef);
          const completedCount = urls.filter(u => u !== null).length;
          statusRef.value = `上传中 (编程猫 OSS)... (${completedCount}/${totalChunks} 块完成)`;
          updateEstimatedCompletionTimeAfterUpload(startTime, urls, totalChunks);
          return;
        } catch (error) {
          lastError = error;
          addDebugOutput(`块 ${i} 第 ${attempt}/${MAX_RETRIES} 次尝试失败: ${error.message}`, debugOutputRef);
          if (attempt < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * (2 ** (attempt - 1));
            addDebugOutput(`块 ${i} - 等待 ${delay / 1000}s 后重试...`, debugOutputRef);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      throw new Error(`块 ${i} 上传失败，已达最大重试次数. 最后错误: ${lastError?.message}`);
    } catch (finalError) {
      addDebugOutput(`块 ${i} 彻底失败: ${finalError.message}`, debugOutputRef);
      statusRef.value = `上传失败 (编程猫 OSS - 块 ${i} 错误)`;
    } finally {
      activeUploads--; if (activeUploads < 0) activeUploads = 0;
    }
  }

  async function waitForPendingChunks() {
    const checkInterval = 200; let waitTime = 0; const maxWaitTime = 120000;
    while (activeUploads > 0 && waitTime < maxWaitTime) { await new Promise(r => setTimeout(r, checkInterval)); waitTime += checkInterval; }
    if (waitTime >= maxWaitTime && activeUploads > 0) {
      addDebugOutput(`警告: 等待块完成超时 (${maxWaitTime / 1000}s). 可能有 ${activeUploads} 个块未正确结束。`, debugOutputRef);
    } else { addDebugOutput('所有活动的块上传均已结束。', debugOutputRef); }
  }

  async function processStream() {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (bufferPos > 0) {
          const finalChunkBlob = new Blob([buffer.subarray(0, bufferPos)]);
          await waitForConcurrencySlot();
          await waitForRateLimitSlot();
          addDebugOutput(`准备上传最后一块 (块 ${chunkIndex})...`, debugOutputRef);
          uploadChunkWithRetry(chunkIndex, finalChunkBlob).catch(() => {});
          chunkIndex++;
        }
        break;
      }
      let currentOffset = 0;
      while (currentOffset < value.length) {
        const spaceInBuffer = CHUNK_SIZE - bufferPos;
        const bytesToCopy = Math.min(spaceInBuffer, value.length - currentOffset);
        buffer.set(value.subarray(currentOffset, currentOffset + bytesToCopy), bufferPos);
        bufferPos += bytesToCopy; currentOffset += bytesToCopy;
        if (bufferPos === CHUNK_SIZE) {
          const chunkBlob = new Blob([buffer]);
          await waitForConcurrencySlot();
          await waitForRateLimitSlot();
          const currentIndex = chunkIndex;
          chunkIndex++;
          buffer = new Uint8Array(CHUNK_SIZE);
          bufferPos = 0;
          addDebugOutput(`准备上传块 ${currentIndex}...`, debugOutputRef);
          uploadChunkWithRetry(currentIndex, chunkBlob).catch(() => {});
        }
      }
    }
  }

  statusRef.value = `开始分块上传 (编程猫 OSS - 大文件支持) (0/${totalChunks} 块完成)`;
  await processStream();
  addDebugOutput('所有块已提交，等待上传完成...', debugOutputRef);
  await waitForPendingChunks();
  addDebugOutput('所有块上传尝试已结束.', debugOutputRef);

  const successfulUploads = urls.filter(url => url !== null);
  const failedCount = totalChunks - successfulUploads.length;
  addDebugOutput(`分块上传 (编程猫 OSS) 完成检查: 成功 ${successfulUploads.length}/${totalChunks} 块.`, debugOutputRef);
  if (failedCount > 0) {
    showToast(`有 ${failedCount} 个分块上传失败 (编程猫 OSS)，请检查日志`);
    statusRef.value = `上传失败 (编程猫 OSS - ${failedCount} 块错误)`;
    addDebugOutput(`最终合并失败 (编程猫 OSS): ${failedCount} 个块未能成功上传。`, debugOutputRef);
    resetEstimatedCompletionTime();
    return;
  }
  try {
    const formattedUrls = urls.map(url => url.split('?')[0].split('/').pop()).join(',');
    const finalUrl = `[${encodeURIComponent(file.name)}]${formattedUrls}`;
    sjurlRef.value = finalUrl;
    statusRef.value = '所有分块上传完成 (编程猫 OSS)!';
    showToast('分块上传成功 (编程猫 OSS), 请复制链接保存');
    addDebugOutput(`最终合并链接 (编程猫 OSS): ${sjurlRef.value}`, debugOutputRef);
    // 写入历史列表（与单文件上传保持一致行为）
    if (uploadHistoryRef) {
      saveUploadHistory(sjurlRef.value, uploadHistoryRef);
    }
  } catch (error) {
    showToast('合并分块链接时出错');
    statusRef.value = '处理结果失败';
    addDebugOutput(`合并分块链接时出错: ${error.message}`, debugOutputRef);
    resetEstimatedCompletionTime();
  }
}
