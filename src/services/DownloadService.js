import { ref } from 'vue';

export const useDownloadService = () => {
  const sjurl = ref('');
  const downloadButtonDisabled = ref(false);

  const copyToClipboard = () => {
    // 处理复制链接的逻辑
  };

  const downloadFiles = async () => {
    // 处理下载文件的逻辑
  };

  return {
    copyToClipboard,
    downloadFiles,
  };
};