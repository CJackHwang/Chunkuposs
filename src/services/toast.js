// toast.js
import Toastify from 'toastify-js';

export function showToast(message) {
    Toastify({
        text: message,
        duration: 3500,
        gravity: "bottom",
        position: 'right',
        className: 'm3-toast', // Class controls styling now
        escapeMarkup: false,
        // [!code --] style: {
        // [!code --]     // 动态属性需要保留 - These are now moved to CSS
        // [!code --]     margin: '0 16px 16px 0',
        // [!code --]     font: '400 14px/20px Roboto'
        // [!code --] }
        // [!code ++] // style object removed - margin and font are handled by .m3-toast class in CSS
    }).showToast();
}