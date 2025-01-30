<template>
  <div id="app">
    <header>
      <h2>FCF 微云盘</h2>
      <a>Ver：5.2.0</a>
      <p>
        基于Vue3+Vite6开发；流式读取文件分块并发提交至CodemaoCDN以绕过大小限制；中断自动重传，默认单块最大15MB，并发上传数2。
      </p>
    </header>
    <MainContent />
    <footer>
      <p>
        © CJackHwang.保留所有权利.
      </p>
      <p>
        <a href="https://github.com/CJackHwang/Fuck-Codemao-Detection" target="_blank">项目仓库：FlowChunkFlex</a>
      </p>
      <p>
        <a href="https://github.com/CJackHwang">
          <img src="https://img.shields.io/badge/GitHub-CJackHwang-100000?style=flat&logo=github&logoColor=white"
            alt="GitHub Badge">
        </a>
        <a href="https://www.gnu.org/licenses/gpl-3.0.html">
          <img src="https://img.shields.io/badge/License-GPL%203.0-blue.svg?style=flat" alt="GPL-3.0 License Badge">
        </a>
      </p>
    </footer>
  </div>
</template>

<script setup>
import MainContent from './components/MainContent.vue'
</script>