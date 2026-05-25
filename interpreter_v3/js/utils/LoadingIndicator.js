/**
 * Global and element-level loading indicators.
 */
export class LoadingIndicator {
  static globalOverlay = null;

  static show(message = '加载中...') {
    if (!LoadingIndicator.globalOverlay) {
      LoadingIndicator.globalOverlay = document.createElement('div');
      LoadingIndicator.globalOverlay.id = 'globalLoading';
      LoadingIndicator.globalOverlay.className = 'fixed inset-0 bg-black/30 z-[90] flex items-center justify-center';
      LoadingIndicator.globalOverlay.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl p-6 flex flex-col items-center gap-3 animate-fadeIn">
          <div class="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-sm text-gray-600 font-medium">${message}</span>
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
