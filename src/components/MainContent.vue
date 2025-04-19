<template>
    <main>
        <!-- Section 1: File Upload -->
        <div class="file-upload">
            <input type="file" @change="updateFileInfo" class="hidden-input">
            <div class="upload-area">
                <p>拖放文件到这里或<span class="highlight">点击选择</span> 上传</p>
            </div>
            <div id="fileInfo" class="file-info">
                {{ fileInfo }}
            </div>
            <!-- Conditional Chunk Info Display -->
            <div id="chunkSize" v-if="chunkSizeVisible && uploadMode === 'codemao' && isLargeFileSupport"
                class="chunk-info">
                <div>
                    <p>每块大小（自动设置）: {{ chunkValue }} MB</p>
                    <p>总上传块数: {{ totalChunks }}</p>
                </div>
            </div>
        </div>

        <!-- Settings relevant to Upload (and general settings) -->
        <div class="settings-group">
            <!-- Upload Mode Selection -->
            <div class="upload-mode-selector">
                <span class="mode-label"></span>
                <label class="radio-label">
                    <input type="radio" v-model="uploadMode" value="dangbei" name="uploadMode">
                    <!-- Apply the class to the span -->
                    <span class="radio-text">当贝OSS</span>
                </label>
                <label class="radio-label">
                    <input type="radio" v-model="uploadMode" value="codemao" name="uploadMode">
                    <!-- Apply the class to the span -->
                    <span class="radio-text">编程猫OSS</span>
                </label>
            </div>

            <!-- Conditional Large File Support Checkbox -->
            <label class="chunk-toggle" v-if="uploadMode === 'codemao'">
                <input type="checkbox" v-model="isLargeFileSupport" :disabled="isChunkCheckboxDisabled"
                    class="toggle-input">
                <span class="custom-checkbox"></span>
                <span class="label-text">分块提交-解除大小限制</span>
            </label>

            <ThemeToggle /> <!-- Theme toggle kept with other settings -->
        </div>

        <!-- Primary Actions for File Upload -->
        <div class="button-group">
            <button @click="uploadFile" :disabled="isUploading">上传文件</button>
            <button @click="helpers.resetAll('确定要刷新页面吗？')" :disabled="isUploading">重置页面</button>
        </div>

        <!-- Section 2: Download via URL -->
        <div class="url-container">
            <input type="text" id="sjurl" v-model="sjurl" placeholder="输入分块链接/标准URL下载文件">
        </div>

        <!-- Actions related to URL Input -->
        <div class="action-buttons">
            <button v-if="sjurl" @click="handleCopy" :disabled="isUploading">复制链接</button>
            <button v-if="sjurl" @click="handleShare" :disabled="isUploading">分享文件</button>
            <button v-if="sjurl" @click="downloadFiles" :disabled="isUploading">下载文件</button>
        </div>

        <!-- Upload History Table -->
        <UploadHistory :history="uploadHistory" @clear-history="handleClear" @export-history="exportHistory"
            @select-item="handleHistoryItemSelect" /> <!-- Listen for the 'select-item' event -->

        <!-- Section 3: Status & Information -->
        <div id="status" class="status-message">
            {{ status }}
            <p v-if="estimatedCompletionTime"> <!-- Only show paragraph if time exists -->
                {{ estimatedCompletionTime }}
            </p>
        </div>

        <!-- Debugging Output -->
        <DebugLogger :debug-output="debugOutput" @clear-log="handleClearLog" @export-log="exportLog" />


    </main>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

import { showToast } from '@/services/toast'
import ThemeToggle from './ThemeToggle.vue'
import DebugLogger from '@/components/DebugLogger.vue';
import UploadHistory from '@/components/UploadHistory.vue'; // Make sure path is correct
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
import { uploadToOSS } from '@/services/DangBeiOSS'; // 导入DangBeiOSS服务
const {
    estimatedCompletionTime,
    updateEstimatedCompletionTimeAfterUpload,
    resetEstimatedCompletionTime
} = useTimeEstimation();
const MAX_CHUNK_SIZE = 15 * 1024 * 1024; // 15 MB (Adjusted from comment)
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
const uploadMode = ref('dangbei'); // 'codemao' or 'dangbei'
const isLargeFileSupport = ref(true); // Default to true for large file support in codemao mode
const isChunkCheckboxDisabled = ref(false); // To disable checkbox when file > 30MB
const isUploading = ref(false); // Track if an upload/download is in progress
const activeUploads = ref(0); // Keep for chunk concurrency logic

// Removed isChunkedMode, isDangBeiOSSMode, isChunkDisabled, isDangBeiDisabled and watchers

onMounted(() => {
    loadLog();
    loadUploadHistory(uploadHistory); // Ensure history is loaded on mount

    // 检查URL参数是否包含分享链接
    checkUrlParams();
});
onUnmounted(() => {
    resetEstimatedCompletionTime();
});

function updateFileInfo(event) {
    const selectedFile = event.target.files[0];
    if (!selectedFile) {
        // Reset if no file is selected or selection is cancelled
        file.value = null;
        fileInfo.value = '';
        chunkSizeVisible.value = false;
        chunkValue.value = 0;
        totalChunks.value = 0;
        // uploadMode.value = 'codemao'; // Keep the selected mode
        // isLargeFileSupport.value = true; // Reset large file support? Or keep user preference? Let's keep it.
        sjurl.value = ''; // Optionally clear the URL input
        status.value = ''; // Clear status
        resetEstimatedCompletionTime(); // Reset time estimation
        isChunkCheckboxDisabled.value = false; // Re-enable checkbox if file is cleared
        return;
    }

    file.value = selectedFile;
    chunkSizeVisible.value = true; // Show chunk info when a file is selected

    const fileSize = file.value.size;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    fileInfo.value = `【 ${file.value.name} 】${fileSizeMB} MB`;

    // Calculate chunk size (at least half the file size, capped between MIN and MAX)
    let calculatedChunkSize = Math.ceil(file.value.size / 2); // Start with half size
    calculatedChunkSize = Math.max(calculatedChunkSize, MIN_CHUNK_SIZE); // Ensure at least MIN
    calculatedChunkSize = Math.min(calculatedChunkSize, MAX_CHUNK_SIZE); // Ensure at most MAX
    chunkSize.value = calculatedChunkSize;

    chunkValue.value = (chunkSize.value / (1024 * 1024)).toFixed(2);
    totalChunks.value = Math.ceil(fileSize / chunkSize.value);

    // Logic for chunk size calculation remains, but mode selection is separate
    if (fileSize <= MIN_CHUNK_SIZE) {
        chunkSizeVisible.value = false; // Hide chunk info for single chunk uploads
        totalChunks.value = 1; // Explicitly set to 1 chunk
        isChunkCheckboxDisabled.value = false; // Ensure checkbox is enabled for small files
        addDebugOutput("文件小于或等于 1MB，建议在编程猫模式下关闭“分块提交”。", debugOutput);
    } else {
        chunkSizeVisible.value = true; // Ensure chunk info is visible for larger files
        addDebugOutput(`文件大于 1MB，自动计算分块大小: ${chunkValue.value} MB, 总块数: ${totalChunks.value}。`, debugOutput);
        // Feature 1: Force chunked for > 30MB in Codemao mode
        const thirtyMB = 30 * 1024 * 1024;
        if (uploadMode.value === 'codemao' && fileSize > thirtyMB) {
            isLargeFileSupport.value = true; // Force enable
            isChunkCheckboxDisabled.value = true; // Disable checkbox
            addDebugOutput(`文件大于 30MB，在编程猫模式下强制启用并锁定“分块提交”。`, debugOutput);
            showToast('文件大于30MB，已强制启用分块提交');
        } else {
            isChunkCheckboxDisabled.value = false; // Ensure checkbox is enabled otherwise
        }
    }
}

// Watch for uploadMode changes to potentially re-evaluate checkbox state
watch(uploadMode, (newMode) => {
    if (file.value) {
        const fileSize = file.value.size;
        const thirtyMB = 30 * 1024 * 1024;
        if (newMode === 'codemao' && fileSize > thirtyMB) {
            isLargeFileSupport.value = true;
            isChunkCheckboxDisabled.value = true;
        } else {
            isChunkCheckboxDisabled.value = false;
            // Optional: Reset isLargeFileSupport if switching away from codemao?
            // if (newMode !== 'codemao') isLargeFileSupport.value = false; // Or keep user preference? Let's keep it for now.
        }
    } else {
        isChunkCheckboxDisabled.value = false; // No file, checkbox should be enabled
    }
});

async function uploadFile() {
    if (!file.value) {
        showToast('请先选择文件');
        status.value = "请选择文件"; // Update status
        return;
    }
    // Reset previous status/URL before starting a new upload
    status.value = "准备上传...";
    sjurl.value = '';
    resetEstimatedCompletionTime(); // Reset estimator

    showToast('开始上传...');
    addDebugOutput(`开始上传文件: ${file.value.name} (模式: ${uploadMode.value})`, debugOutput);
    isUploading.value = true; // Disable buttons

    try {
        if (uploadMode.value === 'dangbei') {
            addDebugOutput("使用【当贝 OSS】模式上传...", debugOutput);
            await uploadWithDangBeiOSS();
        } else if (uploadMode.value === 'codemao') {
            if (isLargeFileSupport.value && file.value.size > MIN_CHUNK_SIZE) {
                addDebugOutput(`使用【编程猫 OSS】模式 (大文件支持) 上传 (总块数: ${totalChunks.value})...`, debugOutput);
                await uploadChunks(); // Existing chunked logic
            } else {
                if (!isLargeFileSupport.value) {
                    addDebugOutput("使用【编程猫 OSS】模式 (无大文件支持) - 执行单链接上传...", debugOutput);
                } else {
                    addDebugOutput("使用【编程猫 OSS】模式 (文件较小) - 执行单链接上传...", debugOutput);
                }
                await uploadSingleFile(); // Existing single file logic
            }
        } else {
            throw new Error(`未知的上传模式: ${uploadMode.value}`);
        }
    } catch (error) {
        // Error handling is mostly within specific upload functions
        status.value = "上传失败 (请查看调试日志)";
        showToast("上传过程中发生意外错误");
        addDebugOutput(`上传任务最终失败: ${error?.message || error}`, debugOutput);
        resetEstimatedCompletionTime(); // Reset timer on failure
    } finally {
        isUploading.value = false; // Re-enable buttons
        console.log("Upload function finished.");
    }
}

async function uploadSingleFile() {
    const startTime = Date.now(); // Record start time for single upload
    status.value = "正在上传 (单链接模式)...";
    const formData = new FormData();
    formData.append('file', file.value, file.value.name);
    formData.append('path', 'flowchunkflex'); // Ensure path is correct

    try {
        const response = await fetchWithRetry(UPLOAD_URL, {
            method: 'POST',
            body: formData
        }, 3); // Add retry logic

        // Check HTTP status first
        if (!response.ok) {
            const errorText = await response.text(); // Try to get error body
            throw new Error(`HTTP ${response.status} ${response.statusText}. Server response: ${errorText}`);
        }

        const data = await response.json();
        handleUploadResponse(data); // Pass entire data object

        const duration = (Date.now() - startTime) / 1000; // Calculate duration
        addDebugOutput(`单链接模式上传成功. 耗时: ${duration.toFixed(2)} 秒.`, debugOutput);

    } catch (error) {
        showToast('单链接模式上传失败，请检查网络或文件大小（≤ 30 MB）');
        status.value = "单链接模式上传失败";
        addDebugOutput(`单链接模式上传错误: ${error.message}`, debugOutput);
        throw error; // Re-throw error to be caught by uploadFile if needed
    }
}


async function uploadChunks() {
    const startTime = Date.now();
    const urls = ref(new Array(totalChunks.value).fill(null));
    const reader = file.value.stream().getReader();
    const CHUNK_SIZE = chunkSize.value; // Use calculated chunk size
    let buffer = new Uint8Array(CHUNK_SIZE);
    let bufferPos = 0;
    let chunkIndex = 0; // Renamed from 'index' to avoid conflict
    activeUploads.value = 0; // Reset active uploads count

    const CONCURRENT_LIMIT = 2;
    const lastRequestTimestamps = ref([]);

    // Helper to manage rate limiting
    async function waitForRateLimitSlot() {
        while (true) {
            const now = Date.now();
            lastRequestTimestamps.value = lastRequestTimestamps.value.filter(ts => now - ts < 1000); // Keep only last second timestamps
            if (lastRequestTimestamps.value.length < REQUEST_RATE_LIMIT) {
                lastRequestTimestamps.value.push(now);
                return; // Slot available
            }
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait if limit reached
        }
    }

    // Helper to manage concurrency limiting
    async function waitForConcurrencySlot() {
        while (getActiveUploadCount() >= CONCURRENT_LIMIT) {
            await new Promise(resolve => setTimeout(resolve, 150)); // Wait if concurrency limit reached
        }
    }

    // The main loop function using ReadableStream
    async function processStream() {
        while (true) {
            try {
                const { done, value } = await reader.read();

                if (done) {
                    // Process any remaining data in the buffer
                    if (bufferPos > 0) {
                        const finalChunkBlob = new Blob([buffer.subarray(0, bufferPos)]);
                        await waitForConcurrencySlot(); // Wait for slot before last chunk
                        await waitForRateLimitSlot();   // Wait for rate limit
                        addDebugOutput(`准备上传最后一块 (块 ${chunkIndex})...`, debugOutput);
                        // Don't await here directly to allow processing loop to potentially finish
                        uploadChunkWithRetry(chunkIndex, finalChunkBlob, urls)
                            .catch(e => { /* error already logged in retry func */ });
                        chunkIndex++;
                    }
                    break; // Exit loop when stream is done
                }

                let currentOffset = 0;
                while (currentOffset < value.length) {
                    const spaceInBuffer = CHUNK_SIZE - bufferPos;
                    const bytesToCopy = Math.min(spaceInBuffer, value.length - currentOffset);

                    buffer.set(value.subarray(currentOffset, currentOffset + bytesToCopy), bufferPos);
                    bufferPos += bytesToCopy;
                    currentOffset += bytesToCopy;

                    // If buffer is full, upload the chunk
                    if (bufferPos === CHUNK_SIZE) {
                        const chunkBlob = new Blob([buffer]); // Create blob from the *full* buffer
                        const currentIndex = chunkIndex++; // Capture current index and increment

                        await waitForConcurrencySlot();
                        await waitForRateLimitSlot();
                        addDebugOutput(`准备上传块 ${currentIndex}...`, debugOutput);
                        // Don't await here; let uploads happen concurrently
                        uploadChunkWithRetry(currentIndex, chunkBlob, urls)
                            .then(() => {
                                // Update estimated time *after* a chunk successfully uploads
                                updateEstimatedCompletionTimeAfterUpload(startTime, urls.value, totalChunks.value);
                                // Update status based on completed uploads
                                const completedCount = urls.value.filter(u => u !== null).length;
                                status.value = `上传中... (${completedCount}/${totalChunks.value} 块完成)`;
                            })
                            .catch(e => { /* error already logged in retry func */ });

                        // Reset buffer for the next chunk
                        buffer = new Uint8Array(CHUNK_SIZE);
                        bufferPos = 0;
                    }
                }

            } catch (streamError) {
                showToast('读取文件流时出错');
                addDebugOutput(`文件流读取错误: ${streamError.message}`, debugOutput);
                status.value = "文件读取失败";
                throw streamError; // Propagate error
            }
        } // end while(true)

        // After the loop, wait for all pending uploads to finish
        addDebugOutput("所有块已提交，等待上传完成...", debugOutput);
        await waitForPendingChunks();
        addDebugOutput("所有块上传尝试已结束.", debugOutput);

        // Final check and completion handling
        handleChunkUploadCompletion(urls.value); // Pass the final array of URLs
    }

    // Start processing the stream
    status.value = `开始分块上传 (编程猫 OSS - 大文件支持) (0/${totalChunks.value} 块完成)`;
    await processStream(); // Await the entire stream processing
}


async function uploadChunkWithRetry(i, chunk, urls) {
    activeUploads.value++;
    let lastError = null;
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 1000; // 1 second base delay

    addDebugOutput(`开始上传块 ${i} (大小: ${(chunk.size / 1024).toFixed(1)} KB)`, debugOutput);

    try {
        const formData = new FormData();
        // [!code --] // Use a simple, consistent naming scheme without file extension
        // [!code --] formData.append('file', chunk, `chunk-${i}.part`); // Add '.part' temporarily? Or keep it simple. Let's try simple first.
        formData.append('file', chunk, `chunk-${i}`); // [!code focus] Use simple name, removed duplicate append
        formData.append('path', 'flowchunkflex');

        // Calculate a dynamic timeout: Base + time proportional to size (e.g., 1 minute per 10MB)
        // Minimum 10 seconds, Maximum 5 minutes
        const sizeMB = chunk.size / (1024 * 1024);
        const calculatedTimeout = 10000 + sizeMB * 6000; // 10s + 6s per MB
        const dynamicTimeout = Math.min(Math.max(calculatedTimeout, 10000), 300000); // Clamp between 10s and 5min
        addDebugOutput(`块 ${i} - 设置超时: ${dynamicTimeout / 1000}s`, debugOutput);


        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const start = Date.now();
                const response = await fetch(UPLOAD_URL, {
                    method: 'POST',
                    body: formData,
                    signal: AbortSignal.timeout(dynamicTimeout) // Use AbortSignal for timeout
                });

                const duration = Date.now() - start;

                if (!response.ok) {
                    // Try reading response body for more details if available
                    let errorBody = '';
                    try {
                        errorBody = await response.text();
                    } catch (e) { /* ignore if can't read body */ }
                    throw new Error(`HTTP ${response.status} ${response.statusText}. Body: ${errorBody.substring(0, 100)}`); // Limit body length in error
                }

                const data = await response.json();

                if (!data || !data.url) {
                    throw new Error(data?.msg || '服务器响应无效或缺少URL');
                }

                // Success!
                urls.value[i] = data.url; // Store URL in the reactive array
                addDebugOutput(`块 ${i} 上传成功 | 耗时: ${duration}ms | URL: ${data.url}`, debugOutput);
                // Update progress immediately after success
                const completedCount = urls.value.filter(u => u !== null).length;
                status.value = `上传中 (编程猫 OSS)... (${completedCount}/${totalChunks.value} 块完成)`;
                return; // Exit retry loop on success

            } catch (error) {
                lastError = error; // Store the error
                addDebugOutput(`块 ${i} 第 ${attempt}/${MAX_RETRIES} 次尝试失败: ${error.message}`, debugOutput);

                if (attempt < MAX_RETRIES) {
                    // Exponential backoff: 1s, 2s, 4s...
                    const delay = BASE_DELAY_MS * (2 ** (attempt - 1));
                    addDebugOutput(`块 ${i} - 等待 ${delay / 1000}s 后重试...`, debugOutput);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        } // End retry loop

        // If loop finishes without returning, all retries failed
        throw new Error(`块 ${i} 上传失败，已达最大重试次数. 最后错误: ${lastError?.message}`);

    } catch (finalError) {
        addDebugOutput(`块 ${i} 彻底失败: ${finalError.message}`, debugOutput);
        status.value = `上传失败 (编程猫 OSS - 块 ${i} 错误)`;
        // We don't re-throw here, failure is recorded by the null in urls.value[i]
        // The final check in handleChunkUploadCompletion will detect this.
    }
    finally {
        activeUploads.value--; // Decrement active count regardless of outcome
        if (activeUploads.value < 0) activeUploads.value = 0; // Safety check
        // addDebugOutput(`块 ${i} 处理结束. 当前并发: ${activeUploads.value}`, debugOutput); // Verbose logging
    }
}


function getActiveUploadCount() {
    return activeUploads.value;
}

async function waitForPendingChunks() {
    const checkInterval = 200; // ms
    let waitTime = 0;
    const maxWaitTime = 120000; // 2 minutes max wait safeguard

    while (activeUploads.value > 0 && waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;
    }
    if (waitTime >= maxWaitTime && activeUploads.value > 0) {
        addDebugOutput(`警告: 等待块完成超时 (${maxWaitTime / 1000}s). 可能有 ${activeUploads.value} 个块未正确结束。`, debugOutput);
    } else {
        addDebugOutput("所有活动的块上传均已结束。", debugOutput);
    }
}

async function fetchWithRetry(url, options, retries = 3) {
    let attempt = 0;
    while (attempt < retries) {
        attempt++;
        try {
            const response = await fetch(url, options);
            // Check if response is ok (status in the range 200-299)
            if (!response.ok && attempt >= retries) {
                // If it's the last attempt and still not ok, throw based on status
                throw new Error(`请求失败: ${response.status} ${response.statusText}`);
            }
            // If response is ok, or if it's not ok but we have retries left, return/continue
            return response; // Return the response object directly on success or for non-ok status if retries remain (caller should check response.ok)
        } catch (error) {
            addDebugOutput(`Fetch error (尝试 ${attempt}/${retries}): ${error.message}`, debugOutput);
            if (attempt >= retries) {
                // If this was the last attempt, re-throw the caught error
                throw error; // Or throw a new summarizing error: new Error(`最大重试次数 (${retries}) 已达到. 最后错误: ${error.message}`);
            }
            // Optional: Add delay before retrying
            await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Simple linear backoff
        }
    }
    // This part should ideally not be reached if logic is correct, but acts as a safeguard
    throw new Error('最大重试次数已达到');
}

// Simplified handler for single file upload response
function handleUploadResponse(data) {
    if (data && data.url) {
        sjurl.value = data.url;
        status.value = "上传完成 (单链接模式)!";
        addDebugOutput(`单链接模式上传成功: ${data.url}`, debugOutput);
        saveUploadHistory(sjurl.value, uploadHistory); // Save to history
        showToast('上传完成, 链接已生成');
    } else {
        const errorMessage = data?.msg || '服务器返回未知错误';
        showToast(`上传失败 (单链接模式): ${errorMessage}`);
        status.value = "上传失败 (单链接模式)";
        addDebugOutput(`处理单链接上传响应失败: ${errorMessage}`, debugOutput);
        // Don't throw error here, just log and update status/toast
    }
}


// Handler specifically for when all chunk uploads have attempted
function handleChunkUploadCompletion(urlsArray) {
    const successfulUploads = urlsArray.filter(url => url !== null);
    const failedCount = totalChunks.value - successfulUploads.length;

    addDebugOutput(`分块上传 (编程猫 OSS) 完成检查: 成功 ${successfulUploads.length}/${totalChunks.value} 块.`, debugOutput);

    if (failedCount > 0) {
        showToast(`有 ${failedCount} 个分块上传失败 (编程猫 OSS)，请检查日志`);
        status.value = `上传失败 (编程猫 OSS - ${failedCount} 块错误)`;
        addDebugOutput(`最终合并失败 (编程猫 OSS): ${failedCount} 个块未能成功上传。`, debugOutput);
        resetEstimatedCompletionTime(); // Reset timer on partial failure
        return; // Stop here if not all chunks succeeded
    }

    // All chunks succeeded, proceed to merge URLs
    try {
        const formattedUrls = urlsArray
            .map(url => {
                // Extract filename part robustly
                const urlParts = url.split('?')[0].split('/');
                return urlParts[urlParts.length - 1]; // Get the last part (filename)
            })
            .join(',');

        // Use encodeURIComponent on the filename part ONLY
        const finalUrl = `[${encodeURIComponent(file.value.name)}]${formattedUrls}`;
        sjurl.value = finalUrl;
        status.value = "所有分块上传完成 (编程猫 OSS)!";
        showToast('分块上传成功 (编程猫 OSS), 请复制链接保存');
        addDebugOutput(`最终合并链接 (编程猫 OSS): ${sjurl.value}`, debugOutput);
        saveUploadHistory(sjurl.value, uploadHistory);
        resetEstimatedCompletionTime(); // Reset timer on success

    } catch (error) {
        showToast('合并分块链接时出错');
        status.value = "处理结果失败";
        addDebugOutput(`合并分块链接时出错: ${error.message}`, debugOutput);
        resetEstimatedCompletionTime();
    }
}


function handleCopy() {
    if (!sjurl.value) {
        showToast("没有链接可复制");
        return;
    }
    helpers.copyToClipboard(
        sjurl.value,
        () => showToast('链接已复制到剪贴板'),
        (err) => {
            showToast('复制失败，请手动复制');
            addDebugOutput(`复制到剪贴板失败: ${err}`, debugOutput);
            console.error('复制失败:', err);
        }
    );
}

async function downloadFiles() {
    const urlToDownload = sjurl.value; // Use the current value in the input
    if (!urlToDownload) {
        showToast('输入框中没有链接可供下载');
        return;
    }
    isUploading.value = true; // Disable buttons during download prep/execution
    status.value = "正在处理链接..."; // Initial status

    // Check if it's a standard URL (including potential DangBei URLs)
    const isNormalUrl = /^(https?:\/\/)/i.test(urlToDownload);
    if (isNormalUrl) {
        try {
            addDebugOutput(`尝试直接打开标准链接: ${urlToDownload}`, debugOutput);
            // Try opening in a new tab, good for direct downloads or viewing
            window.open(urlToDownload, '_blank');
            status.value = "已尝试打开链接...";
            showToast("正在尝试打开或下载标准链接...");
            // Note: We can't easily track download progress/completion for direct links.
        } catch (e) {
            showToast("无法打开链接，请检查链接或浏览器设置");
            status.value = "打开链接失败";
            addDebugOutput(`直接打开链接失败: ${e.message}`, debugOutput);
        } finally {
            isUploading.value = false; // Re-enable buttons
        }
        return; // Stop execution for standard URLs
    }

    // Proceed with chunked URL logic (Codemao)
    const matches = urlToDownload.match(/^\[(.*?)\](.+)$/); // Made filename capture non-greedy
    if (!matches || matches.length < 3) {
        showToast('链接格式无效，应为 "[文件名]块1,块2,..." 或标准 https:// URL');
        status.value = "链接格式错误";
        addDebugOutput(`下载链接格式解析失败: ${urlToDownload}`, debugOutput);
        isUploading.value = false; // Re-enable buttons
        return;
    }

    let filename;
    try {
        // IMPORTANT: Decode the filename AFTER extracting it
        filename = decodeURIComponent(matches[1]);
    } catch (e) {
        showToast('文件名解码失败，可能包含无效字符');
        status.value = "文件名错误";
        addDebugOutput(`文件名解码失败: ${matches[1]} - Error: ${e.message}`, debugOutput);
        filename = 'downloaded-file'; // Fallback filename
        isUploading.value = false; // Re-enable buttons
        return; // Stop if filename is bad
    }

    const chunkIdentifiers = matches[2].split(',');

    if (!chunkIdentifiers || chunkIdentifiers.length === 0 || chunkIdentifiers[0] === '') {
        showToast('链接中未找到有效的分块标识');
        status.value = "链接格式错误";
        addDebugOutput(`下载链接分块部分解析失败: ${matches[2]}`, debugOutput);
        isUploading.value = false; // Re-enable buttons
        return;
    }


    const baseDownloadUrl = 'https://static.codemao.cn/flowchunkflex/';
    const urls = chunkIdentifiers.map(identifier => {
        // Remove potential query parameters just in case (though format suggests they shouldn't be there)
        const cleanIdentifier = identifier.split('?')[0];
        return `${baseDownloadUrl}${cleanIdentifier}`;
    });

    // Link seems valid, proceed with download
    status.value = `准备下载 ${urls.length} 个分块 (编程猫 OSS)...`;
    addDebugOutput(`开始下载 "${filename}" (编程猫 OSS - 共 ${urls.length} 块)...`, debugOutput);
    showToast('下载已开始，请稍候');

    let downloadedBlobs;
    try {
        // Fetch all blobs in parallel
        downloadedBlobs = await Promise.all(urls.map((url, index) =>
            fetchBlob(url, index, urls.length) // Pass index/total for progress
        ));
        addDebugOutput(`所有 ${urls.length} 个分块已获取完毕。`, debugOutput);
        status.value = "分块获取完成，正在合并...";

        // Merge and trigger download
        await mergeAndDownload(downloadedBlobs, filename);

    } catch (error) {
        // Error handling within fetchBlob or mergeAndDownload should update status/log
        // This is a final catch
        showToast('下载过程中发生错误: ' + error.message);
        status.value = "下载失败!";
        addDebugOutput(`下载任务失败: ${error.message}`, debugOutput);
        // Clean up any blobs that might have been created before the error
        if (downloadedBlobs) {
            downloadedBlobs.forEach(blob => {
                if (blob) URL.revokeObjectURL(URL.createObjectURL(blob)); // Clean up Blob URLs
            });
        }
    } finally {
        isUploading.value = false; // Re-enable buttons after download attempt
    }
}

// Modified fetchBlob to include progress update
async function fetchBlob(url, index, total) {
    try {
        addDebugOutput(`开始获取块 ${index + 1}/${total} (编程猫 OSS): ${url}`, debugOutput);
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`无法获取块 ${index + 1} (编程猫 OSS - ${url}): ${res.status} ${res.statusText}`);
        }
        const blob = await res.blob();
        status.value = `下载中 (编程猫 OSS)... (${index + 1}/${total} 块)`; // Update status on successful fetch
        addDebugOutput(`成功获取块 ${index + 1}/${total} (编程猫 OSS)`, debugOutput);
        return blob;
    } catch (error) {
        addDebugOutput(`获取块 ${index + 1} (编程猫 OSS) 失败: ${error.message}`, debugOutput);
        throw error; // Re-throw to be caught by Promise.all
    }
}


async function mergeAndDownload(blobs, filename) {
    if (!blobs || blobs.length === 0) {
        addDebugOutput("没有要合并的 Blob (编程猫 OSS)。", debugOutput);
        status.value = "合并失败 (编程猫 OSS - 无数据)";
        showToast("没有数据可供合并下载 (编程猫 OSS)");
        return;
    }
    addDebugOutput(`开始合并 ${blobs.length} 个 Blob (编程猫 OSS)...`, debugOutput);
    status.value = "正在合并文件 (编程猫 OSS)..."; // Update status

    let downloadUrl; // Define downloadUrl outside try block for cleanup
    try {
        // Create the merged Blob
        const mergedBlob = new Blob(blobs, { type: blobs[0]?.type || 'application/octet-stream' }); // Use type of first blob or default
        addDebugOutput(`合并完成 (编程猫 OSS). 总大小: ${(mergedBlob.size / (1024 * 1024)).toFixed(2)} MB.`, debugOutput);


        // Create a download link
        downloadUrl = URL.createObjectURL(mergedBlob); // Assign here
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename || 'downloaded-file'; // Use provided filename or a default
        document.body.appendChild(a); // Append link to body
        a.click(); // Simulate click to trigger download
        document.body.removeChild(a); // Remove link from body

        // Clean up the Object URL *after* the download has likely started
        // Use a small delay to be safer, as `a.click()` is synchronous but the download initiation might not be instantaneous.
        setTimeout(() => {
            URL.revokeObjectURL(downloadUrl);
            addDebugOutput(`已释放合并 Blob 的 Object URL (编程猫 OSS): ${downloadUrl}`, debugOutput);
        }, 100);


        status.value = "下载完成 (编程猫 OSS)!";
        addDebugOutput(`文件 "${filename}" (编程猫 OSS) 下载已触发。`, debugOutput);
        showToast(`文件 "${filename}" (编程猫 OSS) 下载已开始`);

        // Optional: Clean up individual blob URLs if they were created (though they weren't in this flow)
        // blobs.forEach(blob => URL.revokeObjectURL(URL.createObjectURL(blob))); // Not needed here as we didn't create URLs for individual blobs

    } catch (error) {
        showToast('合并或下载文件时出错');
        status.value = "合并/下载失败 (编程猫 OSS)";
        addDebugOutput(`合并或下载错误 (编程猫 OSS): ${error.message}`, debugOutput);
        console.error("Merge and download error (编程猫 OSS):", error);
        // Attempt cleanup even on error
        // Note: downloadUrl might not be defined if error happened before creation
        if (typeof downloadUrl !== 'undefined' && downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
            addDebugOutput(`错误发生后释放合并 Blob 的 Object URL (编程猫 OSS): ${downloadUrl}`, debugOutput);
        }
    }
}


function exportHistory() {
    if (uploadHistory.value.length === 0) {
        showToast("没有历史记录可导出");
        return;
    }
    // Format: Timestamp - Link (more readable)
    const historyText = uploadHistory.value
        .map(entry => `${entry.timestamp} - ${entry.link}`)
        .join('\n');
    helpers.downloadFile('upload_history.txt', historyText);
    addDebugOutput("上传历史已导出。", debugOutput);
}

function exportLog() {
    const logContent = debugOutput.value; // Export current content of the textarea
    if (!logContent.trim()) {
        showToast("没有日志内容可导出");
        return;
    }
    helpers.downloadFile('upload_log.txt', logContent);
    addDebugOutput("调试日志已导出。", debugOutput); // Log the export action itself
}

function loadLog() {
    // Load log from localStorage into the ref
    const storedLog = localStorage.getItem(STORAGE_KEYS.UPLOAD_LOG);
    if (storedLog) {
        try {
            const logEntries = JSON.parse(storedLog);
            // Join entries with newline for display in textarea/component
            debugOutput.value = logEntries.join('\n');
        } catch (e) {
            console.error("Failed to parse stored log:", e);
            debugOutput.value = "无法加载之前的日志（格式错误）。";
            localStorage.removeItem(STORAGE_KEYS.UPLOAD_LOG); // Clear corrupted log
        }
    } else {
        debugOutput.value = "调试日志为空。"; // Initial message
    }
    // History is loaded separately in onMounted
}

function handleClearLog() {
    clearLog(debugOutput); // Pass the ref to the helper
    showToast("调试日志已清空");
}

function handleClear() {
    clearHistory(uploadHistory); // Pass the ref to the helper
    showToast("上传历史已清空");
}

// Handler for the 'select-item' event from UploadHistory
function handleHistoryItemSelect(selectedLink) {
    if (selectedLink) {
        sjurl.value = selectedLink; // Update the input field's bound ref
        showToast('历史记录链接已填入输入框');
        addDebugOutput(`从历史记录选择链接: ${selectedLink}`, debugOutput);
        // Optional: scroll to the input field if needed
        // document.getElementById('sjurl')?.focus();
    }
}


// 检查URL参数中是否存在预填充链接
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedUrl = urlParams.get('url');

    if (sharedUrl) {
        try {
            // 解码URL参数
            const decodedUrl = decodeURIComponent(sharedUrl);
            sjurl.value = decodedUrl;
            addDebugOutput(`从分享链接自动填充: ${decodedUrl}`, debugOutput);
            showToast('已从分享链接加载内容');

            let filename = '文件'; // 默认文件名

            // 1. 检查是否为分块链接格式 [filename]chunk1,chunk2...
            const chunkMatches = decodedUrl.match(/^\[(.*?)\](.+)$/);
            if (chunkMatches && chunkMatches[1]) {
                try {
                    filename = decodeURIComponent(chunkMatches[1]);
                    addDebugOutput(`从分块链接中解析文件名: ${filename}`, debugOutput);
                } catch (decodeError) {
                    addDebugOutput(`解析分块链接中的文件名失败: ${decodeError.message}`, debugOutput);
                    filename = '解码失败的文件';
                }
            }
            // 2. 如果不是分块链接，检查是否为标准 URL https://.../filename.ext?query
            else if (/^(https?:\/\/)/i.test(decodedUrl)) {
                try {
                    const urlObject = new URL(decodedUrl);
                    const pathname = urlObject.pathname; // e.g., /flowchunkflex/rJwiGIV6Jg.jpg
                    const parts = pathname.split('/');
                    const extractedFilename = parts[parts.length - 1]; // Get the last part
                    if (extractedFilename) {
                        // Decode the extracted filename part
                        filename = decodeURIComponent(extractedFilename);
                        addDebugOutput(`从标准 URL 链接中解析文件名: ${filename}`, debugOutput);
                    } else {
                        addDebugOutput(`无法从标准 URL 路径中提取文件名: ${pathname}`, debugOutput);
                        filename = '未知文件名 (URL路径)';
                    }
                } catch (urlParseError) {
                    addDebugOutput(`解析标准 URL 失败: ${urlParseError.message}`, debugOutput);
                    filename = '无效URL格式';
                }
            }
            // 3. 既不是分块也不是标准 URL
            else {
                addDebugOutput(`分享链接格式未知，无法提取文件名: ${decodedUrl}`, debugOutput);
                filename = '未知格式文件';
            }

            // 弹窗询问用户是否立即下载 (使用解析出的 filename)
            if (confirm(`检测到分享链接，是否立即下载文件 "${filename}"？`)) {
                addDebugOutput(`用户确认下载分享链接文件: ${filename}`, debugOutput);
                // 确保 sjurl 已经设置，然后调用下载
                // downloadFiles 会使用 sjurl.value，所以这里不需要传递参数
                downloadFiles();
            } else {
                addDebugOutput(`用户取消了分享链接文件的下载: ${filename}`, debugOutput);
            }

            // 清除URL参数，避免刷新页面时重复加载
            if (window.history && window.history.replaceState) {
                const cleanUrl = window.location.pathname + window.location.hash;
                window.history.replaceState({}, document.title, cleanUrl);
            }
        } catch (error) {
            addDebugOutput(`解析分享链接参数失败: ${error.message}`, debugOutput);
            showToast('分享链接格式无效');
        }
    }
}

// 处理分享链接功能-----------------------------------------------
function handleShare() {
    if (!sjurl.value) {
        showToast("没有链接可分享");
        return;
    }

    try {
        // 构建包含当前链接的分享URL
        const currentUrl = new URL(window.location.href);
        // 清除现有的查询参数
        currentUrl.search = '';
        // 添加新的url参数
        currentUrl.searchParams.set('url', encodeURIComponent(sjurl.value));

        const shareUrl = currentUrl.toString();

        // 复制分享链接到剪贴板
        helpers.copyToClipboard(
            shareUrl,
            () => {
                showToast('分享链接已复制到剪贴板');
                addDebugOutput(`生成并复制分享链接: ${shareUrl}`, debugOutput);
            },
            (err) => {
                showToast('复制分享链接失败，请手动复制');
                addDebugOutput(`复制分享链接失败: ${err}`, debugOutput);
                console.error('复制失败:', err);
            }
        );
    } catch (error) {
        showToast('生成分享链接时出错');
        addDebugOutput(`生成分享链接错误: ${error.message}`, debugOutput);
    }
}

// 添加DangBeiOSS上传实现
async function uploadWithDangBeiOSS() {
    const startTime = Date.now();
    status.value = "正在通过【当贝 OSS】上传...";

    try {
        // 使用进度回调函数更新上传进度
        const updateProgress = (progress) => {
            status.value = `当贝 OSS 上传中... ${progress}%`;
            addDebugOutput(`当贝 OSS 上传进度: ${progress}%`, debugOutput);
        };

        // 调用DangBeiOSS服务上传文件
        const result = await uploadToOSS(file.value, updateProgress);

        if (result.success) {
            sjurl.value = result.url;
            status.value = "当贝 OSS 上传完成!";
            addDebugOutput(`当贝 OSS 上传成功: ${result.url}`, debugOutput);
            saveUploadHistory(sjurl.value, uploadHistory); // 保存到历史记录

            const duration = (Date.now() - startTime) / 1000; // 计算耗时
            addDebugOutput(`当贝 OSS 上传完成. 耗时: ${duration.toFixed(2)} 秒.`, debugOutput);
            showToast('上传完成 (当贝 OSS), 链接已生成');
        } else {
            throw new Error(result.error || '当贝 OSS 上传失败');
        }
    } catch (error) {
        showToast(`当贝 OSS 上传失败: ${error.message}`);
        status.value = "当贝 OSS 上传失败";
        addDebugOutput(`当贝 OSS 上传错误: ${error.message}`, debugOutput);
        throw error; // 重新抛出错误以便被uploadFile捕获
    }
}

</script>
