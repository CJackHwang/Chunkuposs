import { ref } from 'vue';
import Toastify from 'toastify-js';

export const useUploadService = () => {
  const MAX_CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB
  const UPLOAD_URL = 'https://api.pgaot.com/user/up_cat_file';

  const file = ref(null);
  const chunkSize = ref(0);
  const chunkSizeVisible = ref(false);
  const fileInfo = ref('');
  const chunkValue = ref(0);
  const totalChunks = ref(0);
  const isChunkedMode = ref(false);

  const updateFileInfo = (event) => {
    file.value = event.target.files[0];
    chunkSizeVisible.value = !!file.value;
    if (file.value) {
      const fileSizeMB = (file.value.size / (1024 * 1024)).toFixed(2);
      fileInfo.value = `文件大小: ${fileSizeMB} MB`;
      chunkSize.value = Math.min(file.value.size / 2, MAX_CHUNK_SIZE);
      chunkValue.value = (chunkSize.value / (1024 * 1024)).toFixed(2);
      totalChunks.value = Math.ceil(file.value.size / chunkSize.value);
    }
  };

  const toggleChunkMode = () => {
    // 处理分块模式切换的逻辑
  };

  const uploadFile = async () => {
    // 处理上传文件的逻辑
  };

  return {
    updateFileInfo,
    toggleChunkMode,
    uploadFile,
  };
};