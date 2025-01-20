<template>
    <div>
      <div id="status" class="status-message">
        {{ status }}
        <p>{{ estimatedCompletionTime }}</p>
      </div>
      <h3>操作日志</h3>
      <div id="debugOutput" class="debug-output">
        {{ debugOutput }}
      </div>
      <button @click="clearLog">清除日志</button>
      <button @click="exportLog">导出日志</button>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  import { useLogService } from '@/services/LogService';
  
  const { clearLog, exportLog, addDebugOutput } = useLogService();
  
  const status = ref('');
  const estimatedCompletionTime = ref('');
  const debugOutput = ref('');
  </script>