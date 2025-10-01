import { addDebugOutput } from '@/utils/storageHelper';
import { showToast } from '@/services/toast';
import { getDefaultProvider } from '@/providers';
import type { Ref } from 'vue';
import { FORM_UPLOAD_PATH } from '@/config/constants';

// 单文件上传（保留原行为）
export async function uploadSingleFile(
  file: File,
  sjurlRef: Ref<string>,
  statusRef: Ref<string>,
  uploadHistoryRef: Ref<any[]>,
  debugOutputRef: Ref<string>
) {
  const startTime = Date.now();
  statusRef.value = '正在上传 (单链接模式)...';
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('path', FORM_UPLOAD_PATH);

  try {
    const provider = getDefaultProvider();
    const { url } = await provider.uploadSingle(file, { path: FORM_UPLOAD_PATH });
    if (url) {
      sjurlRef.value = url;
      statusRef.value = '上传完成 (单链接模式)!';
      addDebugOutput(`单链接模式上传成功: ${url}`, debugOutputRef);
      // 历史更新在组件中完成，保持职责简单
      showToast('上传完成, 链接已生成');
    } else {
      const errorMessage = '服务器返回未知错误';
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
// 组件已不依赖并发/限流工具，这部分逻辑由分块上传服务层内部处理
