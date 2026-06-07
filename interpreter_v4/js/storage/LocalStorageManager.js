export class LocalStorageManager {
  static PREFIX = "int4_";

  save(key, value) {
    try {
      localStorage.setItem(LocalStorageManager.PREFIX + key, JSON.stringify(value));
    } catch (error) {
      console.warn("localStorage save failed:", error);
    }
  }

  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(LocalStorageManager.PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  saveSettings(settings) {
    this.save("settings", settings);
  }

  getSettings() {
    return this.get("settings", {
      aiEnabled: false,
      aiEndpoint: "",
      aiModel: "",
      aiApiKey: "",
      translationProvider: "free",
      deeplApiKey: "",
      activeSurface: "desk",
      theme: "light"
    });
  }

  saveRecentMaterialIds(ids) {
    this.save("recentMaterialIds", ids.slice(0, 12));
  }

  getRecentMaterialIds() {
    return this.get("recentMaterialIds", []);
  }

  saveSessionDraft(draft) {
    this.save("sessionDraft", draft);
  }

  getSessionDraft() {
    return this.get("sessionDraft", {});
  }
}
