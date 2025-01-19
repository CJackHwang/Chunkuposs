<template>
    <div class="file-upload">
      <input type="file" @change="updateFileInfo" />
      <div id="fileInfo">{{ fileInfo }}</div>
      <div id="chunkSize" v-if="chunkSizeVisible" class="chunk-info">
        <div>
          <p>每块大小（自动设置）: {{ chunkValue }} MB</p>
          <p>总上传块数: {{ totalChunks }}</p>
        </div>
      </div>
      <label>
        <input type="checkbox" v-model="isChunkedMode" @change="toggleChunkMode" />
        启用分块上传
      </label>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  import { useUploadService } from '@/services/UploadService';
  
  const { updateFileInfo, toggleChunkMode } = useUploadService();
  
  const fileInfo = ref('');
  const chunkSizeVisible = ref(false);
  const chunkValue = ref(0);
  const totalChunks = ref(0);
  const isChunkedMode = ref(false);
  </script>