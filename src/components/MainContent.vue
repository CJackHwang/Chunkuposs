<template>
    <main>
        <!-- Section 1: File Upload -->
        <div class="file-upload">
            <input type="file" @change="updateFileInfo" class="hidden-input">
            <div class="upload-area">
                <p>拖放文件到这里或<span class="highlight">点击选择</span> 上传</p>
            </div>
            <div id="fileInfo" class="file-info" :title="fileInfo">
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
                <!-- DangBei 模式已移除 -->
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
                <span class="label-text">分块提交</span>
            </label>

            <!-- Moved ThemeToggle next to Reset button -->

        </div>

        <!-- Primary Actions for File Upload -->
        <div class="button-group">
            <button @click="uploadFile" :disabled="isUploading">上传</button>
            <button @click="helpers.resetAll('确定要刷新页面吗？')" :disabled="isUploading">重置</button>
            <ThemeToggle />
        </div>

        <!-- 备注输入框（选择文件后显示） -->
        <div v-if="noteInputVisible">
            <h3>文件备注</h3>
            <div class="note-container">
            <input type="text" class="text-field" v-model="noteInput" placeholder="上传完成后的备注（默认：文件大小 MB）" />
            </div>
        </div>

        <!-- Section 2: Download via URL -->
        <h3>链接下载</h3>
        <div class="url-container">
            <input type="text" id="sjurl" class="text-field" v-model="sjurl" placeholder="输入分块链接/标准URL下载文件">
        </div>

        <!-- Actions related to URL Input -->
        <div class="action-buttons">
            <button v-if="sjurl" @click="handleCopy" :disabled="isUploading">复制</button>
            <button v-if="sjurl" @click="handleShare" :disabled="isUploading">分享</button>
            <button v-if="sjurl" @click="downloadFiles" :disabled="isUploading">下载</button>
        </div>

        <!-- Upload History Table -->
        <UploadHistory :history="uploadHistory" @clear-history="handleClear" @export-history="exportHistory"
            @select-item="handleHistoryItemSelect" @open-manager="openManager" />

        <!-- Section 3: Status & Information -->
        <div id="status" class="status-message">
            {{ status }}
            <p v-if="estimatedCompletionTime"> <!-- Only show paragraph if time exists -->
                {{ estimatedCompletionTime }}
            </p>
            <!-- 下载进度条：按分块完成比例更新，不改变原有逻辑 -->
            <div v-if="downloadProgress > 0 && downloadProgress < 100" class="download-progress">
                <progress :value="downloadProgress" max="100"></progress>
                <span>{{ downloadProgress }}%</span>
            </div>
        </div>

        <!-- Debugging Output -->
        <DebugLogger :debug-output="debugOutput" @clear-log="handleClearLog" @export-log="exportLog" />


    </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

import { showToast } from '@/services/toast'
import ThemeToggle from './ThemeToggle.vue'
import DebugLogger from '@/components/DebugLogger.vue';
import UploadHistory from '@/components/UploadHistory.vue'; // Make sure path is correct
import { STORAGE_KEYS, addDebugOutput, saveUploadHistory, loadUploadHistory, clearLog, clearHistory, updateLatestHistoryNote } from '@/utils/storageHelper';
import { confirmDanger } from '@/utils/helpers';
import * as helpers from '@/utils/helpers';
import { useTimeEstimation } from '@/services/timeEstimationService';
import { uploadSingleFile as serviceUploadSingleFile } from '@/services/uploadService';
import { downloadFiles as serviceDownloadFiles } from '@/services/downloadService';
import { uploadChunks as serviceUploadChunks } from '@/services/chunkUploadService';
// DangBei 路径已移除
const {
    estimatedCompletionTime,
    updateEstimatedCompletionTimeAfterUpload,
    resetEstimatedCompletionTime
} = useTimeEstimation();
import {
    MAX_CHUNK_SIZE,
    MIN_CHUNK_SIZE,
    THIRTY_MB_THRESHOLD
} from '@/config/constants';
const file = ref<File | null>(null);
const noteInputVisible = ref(false);
const noteInput = ref('');
const chunkSize = ref(0);
const chunkSizeVisible = ref(false);
const fileInfo = ref('');
const chunkValue = ref<string>('');
const totalChunks = ref(0);
const sjurl = ref('');
const status = ref('');
const debugOutput = ref('');
const uploadHistory = ref<Array<{ time: string; link: string; note?: string }>>([]);
const downloadProgress = ref(0); // 下载进度（0-100）
const uploadMode = ref('codemao'); // Default to 'codemao' since 'dangbei' is hidden
const isLargeFileSupport = ref(true); // Default to true for large file support in codemao mode
const isChunkCheckboxDisabled = ref(false); // To disable checkbox when file > 30MB
const isUploading = ref(false); // Track if an upload/download is in progress
// 分块上传并发控制逻辑已移至服务层

// Removed isChunkedMode, isDangBeiOSSMode, isChunkDisabled, isDangBeiDisabled and watchers

onMounted(() => {
    loadLog();
    loadUploadHistory(uploadHistory); // Ensure history is loaded on mount

    // 从管理器接收填入链接事件
window.addEventListener('fcf:fill-link', (e: Event) => {
        try {
            const detail = (e instanceof CustomEvent ? (e as CustomEvent<{ link?: string }>).detail : null);
            const link = detail && detail.link ? detail.link : undefined;
            if (link) {
                sjurl.value = link;
                showToast('已从管理器填入链接');
            }
        } catch { /* ignore */ }
    });

    // 检查URL参数是否包含分享链接
    checkUrlParams();
});
onUnmounted(() => {
    resetEstimatedCompletionTime();
    noteInputVisible.value = false; noteInput.value = '';
});

function updateFileInfo(event: Event) {
    const input = event.target as HTMLInputElement;
    const selectedFile = (input && input.files && input.files[0]) || null;
    if (!selectedFile) {
        // Reset if no file is selected or selection is cancelled
        file.value = null;
        fileInfo.value = '';
        chunkSizeVisible.value = false;
        chunkValue.value = '';
        totalChunks.value = 0;
        // uploadMode.value = 'codemao'; // Keep the selected mode
        // isLargeFileSupport.value = true; // Reset large file support? Or keep user preference? Let's keep it.
        sjurl.value = ''; // Optionally clear the URL input
        status.value = ''; // Clear status
        resetEstimatedCompletionTime(); // Reset time estimation
        isChunkCheckboxDisabled.value = false; // Re-enable checkbox if file is cleared
        return;
    }

    file.value = selectedFile as unknown as File;
    // 显示备注输入框；默认备注为空（保存时默认使用“文件大小 MB”）
    noteInputVisible.value = true;
    noteInput.value = '';
    chunkSizeVisible.value = true; // Show chunk info when a file is selected

    const fileSize = (file.value as File).size;
    const fileSizeMB = ((fileSize) / (1024 * 1024)).toFixed(2);
    fileInfo.value = `【 ${(file.value as File).name} 】${fileSizeMB} MB`;

    // Calculate chunk size (at least half the file size, capped between MIN and MAX)
    let calculatedChunkSize = Math.ceil(((file.value as File).size) / 2); // Start with half size
    calculatedChunkSize = Math.max(calculatedChunkSize, MIN_CHUNK_SIZE); // Ensure at least MIN
    calculatedChunkSize = Math.min(calculatedChunkSize, MAX_CHUNK_SIZE); // Ensure at most MAX
    chunkSize.value = calculatedChunkSize;

    chunkValue.value = ((chunkSize.value) / (1024 * 1024)).toFixed(2);
    totalChunks.value = Math.ceil(fileSize / (chunkSize.value || 1));

    // Logic for chunk size calculation remains, but mode selection is separate
    if (fileSize <= MIN_CHUNK_SIZE) {
        chunkSizeVisible.value = false; // Hide chunk info for single chunk uploads
        totalChunks.value = 1; // Explicitly set to 1 chunk
        // 对于小于等于1MB的文件，强制单链接上传，并禁用分块选项
        isLargeFileSupport.value = false; // 自动取消勾选
        isChunkCheckboxDisabled.value = true; // 禁用复选框
        addDebugOutput("文件小于或等于 1MB，将使用单链接上传，分块选项已禁用。", debugOutput);
        showToast('文件较小(≤1MB)，将使用单链接上传'); // 明确提示用户
    } else {
        chunkSizeVisible.value = true; // Ensure chunk info is visible for larger files
        addDebugOutput(`文件大于 1MB，自动计算分块大小: ${chunkValue.value} MB, 总块数: ${totalChunks.value}。`, debugOutput);
        // Feature 1: Force chunked for > 30MB in Codemao mode
        if (uploadMode.value === 'codemao' && fileSize > THIRTY_MB_THRESHOLD) {
            isLargeFileSupport.value = true; // Force enable
            isChunkCheckboxDisabled.value = true; // Disable checkbox
            addDebugOutput(`文件大于 30MB，在编程猫模式下强制启用并锁定“分块提交”。`, debugOutput);
            showToast('文件大于30MB，已强制启用分块提交');
        } else {
            // 文件大于1MB但小于等于30MB（或非Codemao模式），允许用户选择，确保复选框可用
            isChunkCheckboxDisabled.value = false; // Ensure checkbox is enabled otherwise
        }
    }
}

// Watch for uploadMode changes to potentially re-evaluate checkbox state
watch(uploadMode, (newMode) => {
    if (file.value) {
    const fileSize = (file.value as File).size;
        if (newMode === 'codemao' && fileSize > THIRTY_MB_THRESHOLD) {
            isLargeFileSupport.value = true;
            isChunkCheckboxDisabled.value = true;
        } else {
            // 切换到非Codemao模式，或者Codemao模式下文件不大于30MB
            isChunkCheckboxDisabled.value = false; // 确保复选框可用
        }
    } else {
        // 没有文件被选中时，复选框也应该是可用的
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
    addDebugOutput(`开始上传文件: ${(file.value as File).name} (模式: ${uploadMode.value})`, debugOutput);
    isUploading.value = true; // Disable buttons

    try {
        if (uploadMode.value === 'codemao') {
            // 文件大于1MB且用户勾选了“大文件支持”（或文件大于30MB被强制分块）
            if (isLargeFileSupport.value && (file.value as File).size > MIN_CHUNK_SIZE) {
                addDebugOutput(`使用【编程猫 OSS】模式 (分块上传) 上传 (总块数: ${totalChunks.value})...`, debugOutput);
                await serviceUploadChunks({
                    file: file.value,
                    CHUNK_SIZE: chunkSize.value,
                    totalChunks: totalChunks.value,
                    debugOutputRef: debugOutput,
                    statusRef: status,
                    sjurlRef: sjurl,
                    uploadHistoryRef: uploadHistory,
                    updateEstimatedCompletionTimeAfterUpload,
                    resetEstimatedCompletionTime
                });
                // 将备注保存到历史首条（刚刚写入的一条）
                {
                    const sizeMB = (((file.value as File).size) / (1024 * 1024)).toFixed(2);
                    const noteToSave = (noteInput.value || '').trim() || `${sizeMB} MB`;
                    updateLatestHistoryNote(noteToSave, uploadHistory);
                }
            } else {
                // 文件小于等于1MB（此时isLargeFileSupport被强制为false），或者文件大于1MB但用户未勾选“大文件支持”
                addDebugOutput("使用【编程猫 OSS】模式 (单链接上传) - 执行上传...", debugOutput);
                // 之前的调试日志已通过updateFileInfo中的修改变得多余
                await uploadSingleFile(); // 单文件上传逻辑
                {
                    const sizeMB = (((file.value as File).size) / (1024 * 1024)).toFixed(2);
                    const noteToSave = (noteInput.value || '').trim() || `${sizeMB} MB`;
                    updateLatestHistoryNote(noteToSave, uploadHistory);
                }
            }
        }
    } catch (error) {
        // Error handling is mostly within specific upload functions
        status.value = "上传失败 (请查看调试日志)";
        showToast("上传过程中发生意外错误");
        const msg = error instanceof Error ? error.message : String(error);
        addDebugOutput(`上传任务最终失败: ${msg}`, debugOutput);
        resetEstimatedCompletionTime(); // Reset timer on failure
    } finally {
        isUploading.value = false; // Re-enable buttons
        // 使用调试输出替代控制台日志，保持用户可见性一致
        addDebugOutput("上传函数执行已结束", debugOutput);
    }
}

async function uploadSingleFile() {
    if (!file.value) { showToast('未选择文件'); return }
    await serviceUploadSingleFile(file.value as File, sjurl, status, uploadHistory, debugOutput);
    // 与历史行为保持一致：成功后写入上传历史
    if (sjurl.value) {
        saveUploadHistory(sjurl.value, uploadHistory);
    }
}


// 分块上传逻辑已移至服务层


// 分块上传重试逻辑已移至服务层


// 并发计数逻辑已移至服务层

// 分块上传等待逻辑已移至服务层

// 重试逻辑改用服务层实现（功能保持不变）

// Simplified handler for single file upload response
// 单文件上传响应逻辑已移至服务层


// Handler specifically for when all chunk uploads have attempted
// 分块上传完成检查与合并逻辑已移至服务层


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
    await serviceDownloadFiles({
        sjurlRef: sjurl,
        statusRef: status,
        isUploadingRef: isUploading,
        debugOutputRef: debugOutput,
        downloadProgressRef: downloadProgress
    });
}

// Modified fetchBlob to include progress update
// 下载分块获取逻辑已移至服务层


// 下载合并触发逻辑已移至服务层


function exportHistory() {
    if (uploadHistory.value.length === 0) {
        showToast("没有历史记录可导出");
        return;
    }
    // Format: Timestamp - Link (more readable)
    const historyText = uploadHistory.value
        .map(entry => `${entry.time} - ${entry.link}`)
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
    if (!confirmDanger('确定要清空操作日志吗？此操作不可撤销')) return;
    clearLog(debugOutput); // Pass the ref to the helper
    showToast("调试日志已清空");
}

function handleClear() {
    if (!confirmDanger('确定要清空上传历史吗？此操作不可撤销')) return;
    clearHistory(uploadHistory); // Pass the ref to the helper
    showToast("上传历史已清空");
}

// Handler for the 'select-item' event from UploadHistory
function handleHistoryItemSelect(selectedLink: string) {
    if (selectedLink) {
        sjurl.value = selectedLink; // Update the input field's bound ref
        showToast('历史记录链接已填入输入框');
        addDebugOutput(`从历史记录选择链接: ${selectedLink}`, debugOutput);
        // Optional: scroll to the input field if needed
        // document.getElementById('sjurl')?.focus();
    }
}

function openManager(){
    window.dispatchEvent(new CustomEvent('fcf:open-manager'))
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
                } catch (decodeError: unknown) {
                    const msg = decodeError instanceof Error ? decodeError.message : String(decodeError);
                    addDebugOutput(`解析分块链接中的文件名失败: ${msg}`, debugOutput);
                    filename = '解码失败的文件';
                }
            }
            // 2. 如果不是分块链接，检查是否为标准 URL https://.../filename.ext?query
            else if (/^(https?:\/\/)/i.test(decodedUrl)) {
                try {
                    const urlObject = new URL(decodedUrl);
                    const pathname = urlObject.pathname; // e.g., /Chunkuposs/rJwiGIV6Jg.jpg
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
                } catch (urlParseError: unknown) {
                    const msg = urlParseError instanceof Error ? urlParseError.message : String(urlParseError);
                    addDebugOutput(`解析标准 URL 失败: ${msg}`, debugOutput);
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
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            addDebugOutput(`解析分享链接参数失败: ${msg}`, debugOutput);
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
    } catch (error: unknown) {
        showToast('生成分享链接时出错');
        const msg = error instanceof Error ? error.message : String(error);
        addDebugOutput(`生成分享链接错误: ${msg}`, debugOutput);
    }
}

// DangBei 路径已移除

</script>
