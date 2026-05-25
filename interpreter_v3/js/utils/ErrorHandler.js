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
      return `<div style="background:linear-gradient(180deg,rgba(30,41,59,0.8) 0%,rgba(30,41,59,0.65) 100%);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(148,163,184,0.35);color:#e2e8f0;padding:0.75rem 1rem;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.05);display:flex;align-items:flex-start;gap:0.5rem;font-size:0.875rem;" data-error-id="${e.id}">
        <span>${icon}</span>
        <span style="flex:1;">${ErrorHandler.escapeHtml(e.message)}</span>
        <button style="background:none;border:none;color:#64748b;font-size:1.25rem;cursor:pointer;line-height:1;padding:0;" onclick="this.parentElement.remove()">&times;</button>
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
