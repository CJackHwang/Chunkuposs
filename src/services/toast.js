// toast.js
import Toastify from 'toastify-js';

export function showToast(message) {
    Toastify({
        text: message,
        duration: 3500,
        gravity: "bottom",
        position: 'right',
        className: 'm3-toast',
        escapeMarkup: false,
        style: {
            // 动态属性需要保留
            margin: '0 16px 16px 0',
            font: '400 14px/20px Roboto'
        }
    }).showToast();
}