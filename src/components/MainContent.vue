<template>
    <main>
      <FileUpload />
      <ButtonGroup />
      <DownloadSection />
      <StatusAndLog />
      <UploadHistory />
    </main>
  </template>
  
  <script setup>
  import FileUpload from './FileUpload.vue';
  import ButtonGroup from './ButtonGroup.vue';
  import DownloadSection from './DownloadSection.vue';
  import StatusAndLog from './StatusAndLog.vue';
  import UploadHistory from './UploadHistory.vue';
  </script>