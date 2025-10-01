// 统一的 fetch 重试逻辑（保持现有功能不变）
export async function fetchWithRetry(url, options, retries = 3, backoffMs = 500) {
  let attempt = 0;
  let lastError;
  while (attempt < retries) {
    attempt++;
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        lastError = new Error(`请求失败: ${response.status} ${response.statusText}`);
        if (attempt >= retries) throw lastError;
      } else {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt >= retries) throw error;
    }
    await new Promise(r => setTimeout(r, backoffMs * attempt));
  }
  throw lastError || new Error('最大重试次数已达到');
}

