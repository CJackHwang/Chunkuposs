import { ref } from 'vue';

export const useUploadHistoryService = () => {
  const uploadHistory = ref([]);

  const saveUploadHistory = (urls) => {
    // 处理保存上传历史的逻辑
  };

  const loadUploadHistory = () => {
    // 处理加载上传历史的逻辑
  };

  const clearHistory = () => {
    // 处理清除历史的逻辑
  };

  const exportHistory = () => {
    // 处理导出历史的逻辑
  };

  return {
    saveUploadHistory,
    loadUploadHistory,
    clearHistory,
    exportHistory,
  };
};