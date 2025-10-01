import Toastify from 'toastify-js';

export function showToast(message: string) {
  Toastify({
    text: message,
    duration: 3500,
    gravity: 'bottom',
    position: 'right',
    className: 'm3-toast',
    escapeMarkup: false,
  }).showToast();
}

