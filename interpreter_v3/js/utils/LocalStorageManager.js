/**
 * Manages localStorage operations: config, tab state, language direction, recent materials.
 */
export class LocalStorageManager {
  static PREFIX = 'int3_';

  saveConfig(key, value) {
    try {
      localStorage.setItem(LocalStorageManager.PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('localStorage save failed:', e);
    }
  }

  getConfig(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(LocalStorageManager.PREFIX + key);
      return raw !== null ? JSON.parse(raw) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  saveTabState(tabName, state) {
    this.saveConfig(`tab_state_${tabName}`, state);
  }

  getTabState(tabName) {
    return this.getConfig(`tab_state_${tabName}`, {});
  }

  saveLanguageDirection(direction) {
    this.saveConfig('language_direction', direction);
  }

  getLanguageDirection() {
    return this.getConfig('language_direction', 'en-zh');
  }

  saveActiveTab(tabName) {
    this.saveConfig('active_tab', tabName);
  }

  getActiveTab() {
    return this.getConfig('active_tab', 'demo');
  }

  saveRecentMaterials(materialIds) {
    this.saveConfig('recent_materials', materialIds.slice(0, 10));
  }

  getRecentMaterials() {
    return this.getConfig('recent_materials', []);
  }

  saveApiKeys(keys) {
    this.saveConfig('api_keys', keys);
  }

  getApiKeys() {
    return this.getConfig('api_keys', {});
  }

  clearAll() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(LocalStorageManager.PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }
}
