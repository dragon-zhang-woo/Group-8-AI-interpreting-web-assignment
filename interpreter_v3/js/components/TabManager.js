/**
 * Tab navigation manager with state preservation.
 */
import { LocalStorageManager } from '../utils/LocalStorageManager.js';

export class TabManager {
  constructor(containerElement) {
    this.container = containerElement;
    this.localStorage = new LocalStorageManager();
    this.currentTab = this.localStorage.getActiveTab();
    this.tabStates = {};
    this.changeListeners = [];
  }

  init() {
    this.switchTab(this.currentTab);

    this.container.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });

      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.switchTab(btn.dataset.tab);
        }
      });
    });
  }

  switchTab(tabName) {
    if (this.currentTab) {
      this.saveTabState(this.currentTab);
    }

    // Update tab buttons — glassmorphism classes
    this.container.querySelectorAll('[data-tab]').forEach(btn => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle('border-indigo-400', isActive);
      btn.classList.toggle('text-indigo-300', isActive);
      btn.classList.toggle('border-transparent', !isActive);
      btn.classList.toggle('text-slate-400', !isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Update tab panels
    this.container.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('hidden', panel.id !== `tab-${tabName}`);
      panel.classList.toggle('block', panel.id === `tab-${tabName}`);
    });

    this.currentTab = tabName;
    this.localStorage.saveActiveTab(tabName);

    const state = this.localStorage.getTabState(tabName);
    if (Object.keys(state).length > 0) {
      this.restoreTabState(tabName, state);
    }

    this.changeListeners.forEach(cb => cb(tabName));
  }

  getCurrentTab() {
    return this.currentTab;
  }

  onTabChange(callback) {
    this.changeListeners.push(callback);
  }

  saveTabState(tabName, state = null) {
    if (state) {
      this.tabStates[tabName] = state;
    }
    this.tabStates[tabName] = this._captureState(tabName);
    this.localStorage.saveTabState(tabName, this.tabStates[tabName]);
  }

  getTabState(tabName) {
    return this.localStorage.getTabState(tabName);
  }

  restoreTabState(tabName, state) {
    if (state.languageDirection) {
      this.localStorage.saveLanguageDirection(state.languageDirection);
    }
  }

  _captureState(tabName) {
    const state = {};
    const dirBtn = document.querySelector(`#tab-${tabName} .dir-btn.active, #tab-${tabName} [data-active="true"]`);
    if (dirBtn) {
      state.languageDirection = dirBtn.dataset.direction;
    }
    return state;
  }
}
