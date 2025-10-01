import { addDebugOutput } from '@/utils/storageHelper';
import { showToast } from '@/services/toast';
import { fetchWithRetry } from '@/services/http';
import { UPLOAD_URL, FORM_UPLOAD_PATH, REQUEST_RATE_LIMIT, CONCURRENT_LIMIT } from '@/config/constants';

// 单文件上传（保留原行为）
export async function uploadSingleFile(file, sjurlRef, statusRef, uploadHistoryRef, debugOutputRef) {
  const startTime = Date.now();
  statusRef.value = '正在上传 (单链接模式)...';
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('path', FORM_UPLOAD_PATH);

  try {
    const response = await fetchWithRetry(UPLOAD_URL, { method: 'POST', body: formData }, 3);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status} ${response.statusText}. Server response: ${errorText}`);
    }
    const data = await response.json();
    if (data && data.url) {
      sjurlRef.value = data.url;
      statusRef.value = '上传完成 (单链接模式)!';
      addDebugOutput(`单链接模式上传成功: ${data.url}`, debugOutputRef);
      // 历史更新在组件中完成，保持职责简单
      showToast('上传完成, 链接已生成');
    } else {
      const errorMessage = data?.msg || '服务器返回未知错误';
      showToast(`上传失败 (单链接模式): ${errorMessage}`);
      statusRef.value = '上传失败 (单链接模式)';
      addDebugOutput(`处理单链接上传响应失败: ${errorMessage}`, debugOutputRef);
    }
  } catch (error) {
    showToast('单链接模式上传失败，请检查网络或文件大小（≤ 30 MB）');
    statusRef.value = '单链接模式上传失败';
    addDebugOutput(`单链接模式上传错误: ${error.message}`, debugOutputRef);
    throw error;
  }
}

// 获取并发上传的活动数（从组件传入以保持状态）
export function getActiveUploadCount(activeUploadsRef) {
  return activeUploadsRef.value;
}

// 速率限制槽等待
export async function waitForRateLimitSlot(lastRequestTimestampsRef) {
  while (true) {
    const now = Date.now();
    lastRequestTimestampsRef.value = lastRequestTimestampsRef.value.filter(ts => now - ts < 1000);
    if (lastRequestTimestampsRef.value.length < REQUEST_RATE_LIMIT) {
      lastRequestTimestampsRef.value.push(now);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// 并发限制等待
export async function waitForConcurrencySlot(activeUploadsRef) {
  while (getActiveUploadCount(activeUploadsRef) >= CONCURRENT_LIMIT) {
    await new Promise(resolve => setTimeout(resolve, 150));
  }
}

