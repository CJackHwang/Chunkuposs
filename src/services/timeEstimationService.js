import { ref } from 'vue';

// 依据已完成分块估算剩余时间；对0除做了防御
export function useTimeEstimation() {
    const estimatedCompletionTime = ref('');
    let intervalId = null;

    function updateEstimatedCompletionTimeAfterUpload(startTime, urlsArray, totalChunks) {
        const elapsed = Date.now() - startTime;
        const completed = Array.isArray(urlsArray) ? urlsArray.filter(url => !!url).length : 0;
        const remaining = totalChunks - completed;

        if (remaining === 0) {
            resetEstimatedCompletionTime();
            return;
        }

        if (intervalId) clearInterval(intervalId);

        const averageTime = completed > 0 ? (elapsed / completed) : 0;
        let estimatedSeconds = averageTime > 0 ? Math.ceil((averageTime * remaining) / 1000) : 0;

        updateTimeDisplay(estimatedSeconds);

        intervalId = setInterval(() => {
            if (estimatedSeconds > 0) {
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
