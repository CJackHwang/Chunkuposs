import { ref } from 'vue';

// 依据已完成分块估算剩余时间；对0除做了防御
export function useTimeEstimation() {
    const estimatedCompletionTime = ref('');
    let intervalId = null;

    function updateEstimatedCompletionTimeAfterUpload(startTime, urlsArray, totalChunks) {
        const elapsed = Date.now() - startTime;
        const completed = Array.isArray(urlsArray) ? urlsArray.filter(url => !!url).length : 0;
        const remaining = Math.max(0, totalChunks - completed);

        if (remaining === 0) {
            resetEstimatedCompletionTime();
            return;
        }

        // 若还没有完成任何分块，不显示 0 秒，改为“正在估算...”
        if (completed === 0) {
            if (intervalId) clearInterval(intervalId);
            estimatedCompletionTime.value = '正在估算...';
            return;
        }

        const averageTime = elapsed / completed; // ms/块
        let estimatedSeconds = Math.ceil((averageTime * remaining) / 1000);

        // 估算过小（<1s）时，不显示“0秒”闪烁，改为“正在等待服务器响应...”
        if (!Number.isFinite(estimatedSeconds) || estimatedSeconds <= 0) {
            if (intervalId) clearInterval(intervalId);
            estimatedCompletionTime.value = '正在等待服务器响应...';
            return;
        }

        if (intervalId) clearInterval(intervalId);
        updateTimeDisplay(estimatedSeconds);

        intervalId = setInterval(() => {
            if (estimatedSeconds > 1) {
                estimatedSeconds--;
                updateTimeDisplay(estimatedSeconds);
            } else {
                clearInterval(intervalId);
                estimatedCompletionTime.value = '正在等待服务器响应...';
            }
        }, 1000);
    }

    function updateTimeDisplay(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        estimatedCompletionTime.value = `预计完成还需: ${minutes} 分 ${remainingSeconds} 秒`;
    }

    function resetEstimatedCompletionTime() {
        clearInterval(intervalId);
        estimatedCompletionTime.value = '';
    }

    return {
        estimatedCompletionTime,
        updateEstimatedCompletionTimeAfterUpload,
        resetEstimatedCompletionTime
    };
}
