<template>
    <main>
        <div class="file-upload">
            <input type="file" @change="updateFileInfo" class="hidden-input">
            <div class="upload-area">
                <p>拖放文件到这里或<span class="highlight">点击选择</span> 上传</p>
            </div>
            <div id="fileInfo" class="file-info">
                {{ fileInfo }}
            </div>
            <div id="chunkSize" v-if="chunkSizeVisible" class="chunk-info">
                <div>
                    <p>每块大小（自动设置）: {{ chunkValue }} MB</p>
                    <p>总上传块数: {{ totalChunks }}</p>
                </div>
            </div>
        </div>
        <div class="button-group">
            <button @click="uploadFile">上传文件</button>
            <button @click="helpers.resetAll('确定要刷新页面吗？')">重置页面</button>

        </div>
        <div class="settings-group">
            <label class="chunk-toggle">
                <input type="checkbox" v-model="isChunkedMode" :disabled="isChunkDisabled" class="toggle-input">
                <span class="custom-checkbox"></span>
                <span class="label-text">「分块上传模式」</span>
            </label>
            <ThemeToggle />
        </div>
        <div class="url-container">
            <input type="text" id="sjurl" v-model="sjurl" placeholder="输入分块链接/标准URL下载文件">
        </div>
        <div class="action-buttons">
            <button v-if="sjurl" @click="handleCopy">复制链接</button>
            <button v-if="sjurl" @click="downloadFiles">下载文件</button>
        </div>
        <div id="status" class="status-message">
            {{ status }}
            <p>
                {{ estimatedCompletionTime }}
            </p>
        </div>
        <DebugLogger :debug-output="debugOutput" @clear-log="handleClearLog" @export-log="exportLog" />
        <UploadHistory :history="uploadHistory" @clear-history="handleClear" @export-history="exportHistory" />
    </main>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

import { showToast } from '@/services/toast'
import ThemeToggle from './ThemeToggle.vue'
import DebugLogger from '@/components/DebugLogger.vue';
import UploadHistory from '@/components/UploadHistory.vue';
import { STORAGE_KEYS } from '@/utils/storageHelper';
import {
    addDebugOutput,
    saveUploadHistory,
    loadUploadHistory,
    clearLog,
    clearHistory
} from '@/utils/storageHelper';
import * as helpers from '@/utils/helpers';
import { useTimeEstimation } from '@/services/timeEstimationService';
const {
    estimatedCompletionTime,
    updateEstimatedCompletionTimeAfterUpload,
    resetEstimatedCompletionTime
} = useTimeEstimation();
const MAX_CHUNK_SIZE = 15 * 1024 * 1024; // 20 MB
const MIN_CHUNK_SIZE = 1 * 1024 * 1024;
const UPLOAD_URL = 'https://api.pgaot.com/user/up_cat_file'
const REQUEST_RATE_LIMIT = 5;// 每秒最多5次请求
const file = ref(null);
const chunkSize = ref(0);
const chunkSizeVisible = ref(false);
const fileInfo = ref('');
const chunkValue = ref(0);
const totalChunks = ref(0);
const sjurl = ref('');
const status = ref('');
const debugOutput = ref('');
const uploadHistory = ref([]);
const isChunkedMode = ref(false);
const activeUploads = ref(0);
const isChunkDisabled = computed(() => {
    return file.value?.size <= MIN_CHUNK_SIZE; // 使用可选链操作符
});

onMounted(() => {
    loadLog(); // [!code ++] 统一初始化日志和历史记录
});
onUnmounted(() => {
    resetEstimatedCompletionTime();
});

function updateFileInfo(event) {
    file.value = event.target.files[0];
    chunkSizeVisible.value = !!file.value;
    if (file.value) {
        const fileSizeMB = (file.value.size / (1024 * 1024)).toFixed(2);
        fileInfo.value = `【 ${file.value.name} 】${fileSizeMB} MB`;

        chunkSize.value = Math.min(
            Math.max(file.value.size / 2, MIN_CHUNK_SIZE), // 确保不小于1MB
            MAX_CHUNK_SIZE
        );
        chunkSize.value = Math.max(
            Math.min(
                Math.ceil(file.value.size / 2),
                MAX_CHUNK_SIZE
            ),
            MIN_CHUNK_SIZE
        );

        chunkValue.value = (chunkSize.value / (1024 * 1024)).toFixed(2);
        totalChunks.value = Math.ceil(file.value.size / chunkSize.value);

        // 小文件强制单块模式
        if (file.value.size <= MIN_CHUNK_SIZE) {
            isChunkedMode.value = false;
            chunkSizeVisible.value = false;
            totalChunks.value = 1;
            addDebugOutput("文件小于1MB，分块模式已禁用", debugOutput);
        }
    }
}

async function uploadFile() {
    let startTime; // 声明上传开始时间
    startTime = Date.now();
    if (!file.value) {
        showToast('请先选择文件');
        return;
    }
    status.value = "上传处理中...";
    showToast('正在提交...');
    addDebugOutput("已开始上传任务，请耐心等待...", debugOutput);

    if (!isChunkedMode.value) {
        await uploadSingleFile();
    } else {
        await uploadChunks();
    }
}

async function uploadSingleFile() {
    const formData = new FormData();
    formData.append('file', file.value, file.value.name);
    formData.append('path', 'pickduck');

    try {
        const response = await fetchWithRetry(UPLOAD_URL, {
            method: 'POST', body: formData
        });
        const data = await response.json();
        handleUploadResponse(data);
    } catch (error) {
        showToast('上传发生错误，确保文件≤ 30 MB 和检查网络并重试');
        addDebugOutput(`上传失败: ${error.message}`, debugOutput);
    }
}

// 修改uploadChunks函数中的循环部分
async function uploadChunks() {
    const startTime = Date.now();
    const urls = ref(new Array(totalChunks.value).fill(null)); // 使用响应式数组
    const reader = file.value.stream().getReader();
    const CHUNK_SIZE = chunkSize.value; // 确保使用精确的字节数
    let buffer = new Uint8Array(CHUNK_SIZE);
    let bufferPos = 0; // 当前缓冲区写入位置
    let index = 0;

    const CONCURRENT_LIMIT = 2; // 并发数
    const lastRequestTimestamps = ref([]); // 记录请求时间戳

    async function canMakeRequest() {
        const now = Date.now();
        // 移除超过1秒的旧记录
        lastRequestTimestamps.value = lastRequestTimestamps.value.filter(ts => now - ts < 1000);
        return lastRequestTimestamps.value.length < REQUEST_RATE_LIMIT;
    }

    async function uploadWithRateLimit() {
        // 等待速率限制
        while (!(await canMakeRequest())) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        lastRequestTimestamps.value.push(Date.now());
    }

    async function readAndUpload() {
        const { done, value } = await reader.read();
        if (done) {
            if (bufferPos > 0) {
                const finalChunk = buffer.subarray(0, bufferPos);
                await uploadChunkWithRetry(index, new Blob([finalChunk]), urls);
                index++;
            }
            await waitForPendingChunks();
            handleChunkUploadCompletion(urls.value);
            return;
        }
        let offset = 0; // 当前 value 的读取位置

        while (offset < value.length) {
            const spaceRemaining = CHUNK_SIZE - bufferPos;
            const bytesToCopy = Math.min(spaceRemaining, value.length - offset);

            // 将数据复制到缓冲区
            buffer.set(value.subarray(offset, offset + bytesToCopy), bufferPos);
            bufferPos += bytesToCopy;
            offset += bytesToCopy;

            // 缓冲区填满时上传
            if (bufferPos === CHUNK_SIZE) {
                await uploadWithRateLimit();
                // 等待并发槽位
                while (getActiveUploadCount() >= CONCURRENT_LIMIT) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                const currentIndex = index;
                index++;
                const chunkBlob = new Blob([buffer]);

                // 重置缓冲区
                buffer = new Uint8Array(CHUNK_SIZE);
                bufferPos = 0;

                // 上传并更新进度
                uploadChunkWithRetry(currentIndex, chunkBlob, urls)
                    .then(() => {
                        updateEstimatedCompletionTimeAfterUpload(startTime, urls.value, totalChunks.value);
                    })
                    .catch(error => {
                        showToast('分块上传失败');
                        addDebugOutput(`上传终止: ${error.message}`, debugOutput);
                        status.value = "上传失败";
                    });

                status.value = `上传中...（已提交 ${index}/${totalChunks.value} 块）`;
            }
        }

        setTimeout(readAndUpload, 0);
    }

    readAndUpload();
}


async function uploadChunkWithRetry(i, chunk, urls) {
    activeUploads.value++; // 进入函数时增加并发计数器
    let lastError = null; // 记录最后一次错误信息

    try {
        const formData = new FormData();
        formData.append('file', chunk, `chunk-${i}`); // 强制使用无后缀块名
        formData.append('path', 'pickduck');

        const dynamicTimeout = Math.max(5000, (chunk.size / (20 * 1024 * 1024)) * 60000); // 最低5秒

        // 重试机制（最多3次）
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const start = Date.now();
                const response = await fetch(UPLOAD_URL, {
                    method: 'POST',
                    body: formData,
                    signal: AbortSignal.timeout(dynamicTimeout) // 使用动态超时
                });

                // 处理HTTP错误状态
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} ${response.statusText}`);
                }

                const data = await response.json();

                // 处理业务逻辑错误
                if (!data.url) {
                    throw new Error(data.msg || '服务器返回无效响应');
                }

                // 成功时记录性能指标
                const duration = Date.now() - start;
                urls.value[i] = data.url;
                addDebugOutput(`块 ${i} 上传成功 | 耗时: ${duration}ms | 大小: ${(chunk.size / 1024 / 1024).toFixed(2)}MB`, debugOutput);
                return; // 成功时直接返回

            } catch (error) {
                lastError = error;
                addDebugOutput(`块 ${i} 第${attempt}次尝试失败: ${error.message}`, debugOutput);

                // 指数退避重试：1s, 2s, 4s
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (2 ** (attempt - 1))));
                }
            }
        }

        // 所有重试失败后抛出最终错误
        throw new Error(`块 ${i} 上传失败: ${lastError?.message}`);

    } finally {
        activeUploads.value--; // 确保无论如何都减少计数器
        if (activeUploads.value < 0) activeUploads.value = 0; // 防止意外负数
    }
}

function getActiveUploadCount() {
    return activeUploads.value; // 返回 .value
}

async function waitForPendingChunks() {
    while (activeUploads.value > 0) { // 检查 .value
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

async function fetchWithRetry(url, options, retries = 3) {
    while (retries > 0) {
        try {
            return await fetch(url, options);
        } catch (error) {
            retries--;
            addDebugOutput(`Fetch error, retries left: ${retries}`, debugOutput);
        }
    }
    throw new Error('最大重试次数已达到');
}

function handleUploadResponse(data, i, urls) {
    if (data.url) {
        if (i !== undefined) {
            urls.value[i] = data.url;
            addDebugOutput(`上传块 ${i + 1} 成功: ${data.url}`, debugOutput);
        } else {
            sjurl.value = data.url;
            status.value = "上传完成!";
            addDebugOutput("上传完成!", debugOutput);
            saveUploadHistory(sjurl.value, uploadHistory);
            showToast('上传完成, 请复制链接保存');
        }
    } else {
        showToast(data.msg);
        throw new Error(data.msg);
    }
}

function handleChunkUploadCompletion(urlsArray) {
    // 确保所有块都存在
    if (urlsArray.some(url => !url)) {
        showToast('部分分块上传失败，请检查日志');
        return;
    }
    // 按索引顺序拼接
    const formattedUrls = urlsArray
        .map(url => {
            // 分割URL，仅保留文件名部分（兼容旧格式）
            const [filenamePart] = url.split('?');
            return filenamePart.split('/').pop();
        })
        .join(',');

    sjurl.value = `[${encodeURIComponent(file.value.name)}]${formattedUrls}`; // 使用 encodeURIComponent
    status.value = "上传完成!";
    showToast('上传完成, 请复制链接并保存');
    addDebugOutput(`最终链接: ${sjurl.value}`, debugOutput);
    saveUploadHistory(sjurl.value, uploadHistory); // 修正参数传递
    resetEstimatedCompletionTime();
}

function handleCopy() {
    helpers.copyToClipboard(
        sjurl.value,
        () => showToast('链接已复制到剪贴板'), // 成功回调
        (err) => console.error('复制失败:', err) // 失败回调（可选）
    );
}

async function downloadFiles() {
    const longUrl = sjurl.value;
    if (!longUrl) {
        showToast('请先上传文件或输入链接');
        return;
    }

    const isNormalUrl = /^https?:\/\/.+/.test(longUrl);
    if (isNormalUrl) {
        window.open(longUrl, '_blank');
        return;
    }

    const matches = longUrl.match(/^\[(.*)\](.+)$/);
    if (!matches) {
        showToast('输入格式不正确，请确保格式为标准链接或分块链接 "[文件名]xxx?xxx,xxx2?xxx,..."');
        return;
    }
    const filename = decodeURIComponent(matches[1]);
    // 修改 downloadFiles 函数中的URL解析逻辑
    const urls = matches[2].split(',').map(item => {
        const [legacyFilename] = item.split('?'); // 兼容新旧格式
        return `https://static.codemao.cn/pickduck/${legacyFilename}`;
    });

    status.value = "下载中...";
    addDebugOutput("开始下载...", debugOutput);
    showToast('下载已开始，请耐心等待');

    try {
        const blobs = await Promise.all(urls.map(fetchBlob));
        await mergeAndDownload(blobs, filename);
    } catch (error) {
        showToast('下载发生错误：' + error.message);
        status.value = "下载失败!";
        addDebugOutput(`下载失败: ${error.message}`, debugOutput);
    }
}

async function fetchBlob(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`无法获取 ${url}: ${res.statusText}`);
    return res.blob();
}

async function mergeAndDownload(blobs, filename) {
    const mergedBlob = new Blob(blobs);
    const downloadUrl = URL.createObjectURL(mergedBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
    status.value = "下载完成!";
    addDebugOutput("下载完成!", debugOutput);
    showToast(`下载完成，请检查是否保存成功`);
    blobs.forEach(blob => URL.revokeObjectURL(URL.createObjectURL(blob)));
}

function exportHistory() {
    const links = uploadHistory.value.map(entry => entry.link).join('\n');
    helpers.downloadFile('upload_history.txt', links);
}

function exportLog() {
    const log = localStorage.getItem(STORAGE_KEYS.UPLOAD_LOG);
    const logEntries = log ? JSON.parse(log).join('\n') : '没有日志记录。';
    helpers.downloadFile('upload_log.txt', logEntries);
}

function loadLog() {
    const log = localStorage.getItem(STORAGE_KEYS.UPLOAD_LOG);
    if (log) {
        const logEntries = JSON.parse(log);
        debugOutput.value = logEntries.join('\n');
    }
    loadUploadHistory(uploadHistory);
}

function handleClearLog() {
    clearLog(debugOutput)
}

function handleClear() {
    clearHistory(uploadHistory);
}
</script>