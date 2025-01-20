<template>
    <div class="button-group">
      <button @click="uploadFile">提交并转链接</button>
      <button @click="resetAll">重置全部</button>
    </div>
  </template>
  
  <script setup>
  import { useUploadService } from '@/services/UploadService';
  
  const { uploadFile, resetAll } = useUploadService();
  </script>