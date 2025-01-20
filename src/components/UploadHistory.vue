<template>
    <div>
      <h3>上传历史</h3>
      <div id="uploadHistory">
        <table id="uploadHistoryTable">
          <thead>
            <tr>
              <th>上传时间</th>
              <th>文件链接</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in uploadHistory" :key="entry.time">
              <td>{{ entry.time }}</td>
              <td>{{ entry.link }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="history-buttons">
        <button @click="clearHistory">清除历史</button>
        <button @click="exportHistory">导出为txt</button>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  import { useUploadHistoryService } from '@/services/UploadHistoryService';
  
  const { clearHistory, exportHistory, loadUploadHistory } = useUploadHistoryService();
  
  const uploadHistory = ref([]);
  loadUploadHistory();
  </script>