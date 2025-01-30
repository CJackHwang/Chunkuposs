import { ref } from 'vue';

export function useTimeEstimation() {
    const estimatedCompletionTime = ref('');
    let intervalId = null;

    function updateEstimatedCompletionTimeAfterUpload(startTime, urlsArray, totalChunks) {
        const elapsed = Date.now() - startTime;
        const completed = urlsArray.filter(url => !!url).length;
        const remaining = totalChunks - completed;

        if (remaining === 0) {
            resetEstimatedCompletionTime();
            return;
        }

        if (intervalId) clearInterval(intervalId);

        const averageTime = elapsed / (completed || 1);
        let estimatedSeconds = Math.ceil((averageTime * remaining) / 1000);

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