<template>
    <div>
      <input type="text" id="sjurl" v-model="sjurl" placeholder="输入链接下载；上传链接也会显示在此" />
      <div class="action-buttons">
        <button v-if="sjurl" @click="copyToClipboard">复制链接</button>
        <button v-if="sjurl && !downloadButtonDisabled" @click="downloadFiles">下载文件</button>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  import { useDownloadService } from '@/services/DownloadService';
  
  const { copyToClipboard, downloadFiles } = useDownloadService();
  const sjurl = ref('');
  const downloadButtonDisabled = ref(false);
  </script>