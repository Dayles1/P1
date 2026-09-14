export function showToast(message, type = 'success') {
    const stack = document.getElementById('toast-stack');

    if (!stack) {
        return;
    }

    const el = document.createElement('div');

    el.className = `toast toast--${type}`;
    el.textContent = message;

    stack.appendChild(el);

    window.setTimeout(() => {
        el.remove();
    }, 4000);
}
