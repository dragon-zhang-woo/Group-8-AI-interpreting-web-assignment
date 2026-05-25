/**
 * Global and element-level loading indicators.
 */
export class LoadingIndicator {
  static globalOverlay = null;

  static show(message = '加载中...') {
    if (!LoadingIndicator.globalOverlay) {
      LoadingIndicator.globalOverlay = document.createElement('div');
      LoadingIndicator.globalOverlay.id = 'globalLoading';
      LoadingIndicator.globalOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:90;display:flex;align-items:center;justify-content:center;';
      LoadingIndicator.globalOverlay.innerHTML = `
        <div style="background:linear-gradient(180deg,rgba(30,41,59,0.8) 0%,rgba(30,41,59,0.65) 100%);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);border:1px solid rgba(148,163,184,0.35);border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,0.45),0 0 0 1px rgba(15,23,42,0.5),inset 0 1px 0 rgba(255,255,255,0.05);padding:1.5rem;display:flex;flex-direction:column;align-items:center;gap:0.75rem;">
          <div style="width:2rem;height:2rem;border:3px solid rgba(129,140,248,0.25);border-top-color:#818cf8;border-radius:50%;animation:spin 0.8s linear infinite;box-shadow:0 0 12px rgba(129,140,248,0.15);"></div>
          <span style="font-size:0.875rem;color:#cbd5e1;font-weight:500;">${message}</span>
        </div>`;
      document.body.appendChild(LoadingIndicator.globalOverlay);
    }
  }

  static hide() {
    if (LoadingIndicator.globalOverlay) {
      LoadingIndicator.globalOverlay.remove();
      LoadingIndicator.globalOverlay = null;
    }
  }

  static showForElement(element, message = '') {
    if (!element) return;
    element.classList.add('opacity-50', 'pointer-events-none');
    const spinner = document.createElement('span');
    spinner.className = 'inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin ml-2';
    spinner.dataset.loadingSpinner = 'true';
    if (message) {
      const label = document.createElement('span');
      label.className = 'text-xs text-gray-500 ml-1';
      label.textContent = message;
      label.dataset.loadingSpinner = 'true';
      element.appendChild(label);
    }
    element.appendChild(spinner);
  }

  static hideForElement(element) {
    if (!element) return;
    element.classList.remove('opacity-50', 'pointer-events-none');
    element.querySelectorAll('[data-loading-spinner]').forEach(el => el.remove());
  }
}
