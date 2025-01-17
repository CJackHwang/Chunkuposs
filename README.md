# FCD微型网盘 - 流式分块上传
[![GitHub](https://img.shields.io/badge/GitHub-CJackHwang-100000?style=flat&logo=github&logoColor=white)](https://github.com/CJackHwang)
[![GPL-3.0 License](https://img.shields.io/badge/License-GPL%203.0-blue.svg?style=flat)](https://www.gnu.org/licenses/gpl-3.0.html)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel)](https://vercel.com)

## 项目简介

基于 Vue.js 的文件上传工具，支持分块上传和断点续传，避免因文件过大（超过 30MB）而被编程猫删除。根据该工具可以辅助构建微型网盘私人使用。在每个发行版本中会附带AI的js代码分析帮助你快速了解和上手该版本

## 功能特性

- **文件选择和信息展示**：实时查看文件大小。
- **流式分块上传**：支持自动计算每块大小和总块数。
- **文件上传**：上传文件并生成下载链接。
- **上传历史记录**：保存每次上传的时间和链接。
- **操作日志**：记录上传过程中的操作信息。
- **文件下载**：支持合并下载文件。
- **链接复制和导出**：一键复制链接和记录。

## 技术栈

- **前端框架**：Vue.js 3
- **样式**：CSS
- **HTTP 请求**：Fetch API

## 使用说明

### 运行项目

1. 下载或克隆项目代码。
2. 打开 `index.html` 文件。
3. 使用现代浏览器（如 Chrome、Firefox）访问。

### （可选）Vercel 部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/CJackHwang/Fuck-Codemao-Detection)

### 上传文件

1. 点击 "选择文件" 按钮。
2. 查看文件信息，选择是否启用分块上传。
3. 点击 "提交并转链接" 进行上传。
4. 上传完成后获得下载链接。

### 操作日志和历史记录

- 实时更新操作日志。
- 上传历史保存在本地存储。

### 复制和下载链接

- 点击 "复制链接" 将链接复制到剪贴板。
- 点击 "下载文件" 下载上传的文件。

### 清除日志和历史记录

- **清除日志**：清空操作日志。
- **清除历史**：清空上传历史记录。
- **导出历史**：导出上传历史记录为 `upload_history.txt` 文件。
- **导出日志**：导出操作日志为 `upload_log.txt` 文件。

## 注意事项

- 文件大小限制：单文件上传模式时确保选择的文件不超过 30MB。
- 分块上传可能需要更长时间
- 上传历史和操作日志会保存在本地网页存储中，注意备份。

## 联系方式

如有问题或建议，请联系开发者：

- **姓名**: CJackHwang
- **博客**: [www.cjack.cfd](http://www.cjack.cfd)

## 版权信息

© CJackHwang. 保留所有权利。
