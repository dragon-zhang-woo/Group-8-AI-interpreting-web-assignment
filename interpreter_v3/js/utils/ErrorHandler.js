/**
 * Centralized error handling: toast notifications, error queue, console logging.
 */
export class ErrorHandler {
  static queue = [];
  static container = null;

  static init(containerId = 'errorContainer') {
    ErrorHandler.container = document.getElementById(containerId);
    if (!ErrorHandler.container) {
      const div = document.createElement('div');
      div.id = containerId;
      div.className = 'fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm';
      document.body.appendChild(div);
      ErrorHandler.container = div;
    }
  }

  static showError(message, type = 'api', autoDismiss = true) {
    const entry = { message, type, id: Date.now() };
    ErrorHandler.queue.push(entry);
    ErrorHandler.renderQueue();
    if (autoDismiss) {
      setTimeout(() => ErrorHandler.dismiss(entry.id), 5000);
    }
  }

  static renderQueue() {
    if (!ErrorHandler.container) ErrorHandler.init();
    ErrorHandler.container.innerHTML = ErrorHandler.queue.map(e => {
      const colors = {
        network: 'bg-red-500',
        api: 'bg-orange-500',
        permission: 'bg-amber-500',
        validation: 'bg-yellow-500 text-gray-800'
      };
      const icons = {
        network: '📡',
        api: '⚙️',
        permission: '🔒',
        validation: '⚠️'
      };
      const color = colors[e.type] || colors.api;
      const icon = icons[e.type] || icons.api;
      return `<div class="${color} text-white px-4 py-3 rounded-lg shadow-lg flex items-start gap-2 animate-fadeIn" data-error-id="${e.id}">
        <span>${icon}</span>
        <span class="flex-1 text-sm">${ErrorHandler.escapeHtml(e.message)}</span>
        <button class="text-white/80 hover:text-white ml-2 text-lg leading-none" onclick="this.parentElement.remove()">&times;</button>
      </div>`;
    }).join('');
  }

  static dismiss(id) {
    ErrorHandler.queue = ErrorHandler.queue.filter(e => e.id !== id);
    ErrorHandler.renderQueue();
  }

  static logError(error, context = '') {
    console.error(`[${context}]`, error);
  }

  static handleAPIError(error, apiName) {
    const msg = error.message || 'Unknown error';
    ErrorHandler.logError(error, apiName);

    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      ErrorHandler.showError(`${apiName}: 网络连接失败，请检查网络`, 'network');
    } else if (msg.includes('429') || msg.includes('Too Many Requests')) {
      ErrorHandler.showError(`${apiName}: 请求过于频繁，请稍后重试`, 'api');
    } else {
      ErrorHandler.showError(`${apiName}: ${msg}`, 'api');
    }
  }

  static handleNetworkError(error) {
    ErrorHandler.logError(error, 'Network');
    ErrorHandler.showError('网络连接失败，请检查网络设置', 'network');
  }

  static escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
