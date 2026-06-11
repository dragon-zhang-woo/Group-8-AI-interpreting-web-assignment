export class MaterialLibrary {
  constructor(storage) {
    this.storage = storage;
    this.materials = [];
  }

  async load() {
    const response = await fetch("data/materials.json");
    if (!response.ok) throw new Error("练习素材加载失败。");
    this.materials = await response.json();
    return this.materials;
  }

  getAll() {
    return [...this.materials];
  }

  getById(id) {
    return this.materials.find((material) => material.id === id) || null;
  }

  getRandom({ direction = "all", difficulty = "all", focusModule = "all", focusRule = "all" } = {}) {
    let pool = direction === "all" || direction === "auto" ? [...this.materials] : this.materials.filter((material) => material.direction === direction);
    if (difficulty !== "all") pool = pool.filter((material) => material.difficultyLevel === difficulty);
    if (focusModule !== "all") pool = pool.filter((material) => material.focusModule === focusModule);
    if (focusRule !== "all") pool = pool.filter((material) => material.focusRules?.includes(focusRule));

    if (pool.length === 0 && direction !== "all" && direction !== "auto") pool = this.materials.filter((material) => material.direction === direction);
    if (pool.length === 0) pool = [...this.materials];

    const recentIds = this.storage.getRecentMaterialIds();
    const freshPool = pool.filter((material) => !recentIds.includes(material.id));
    const finalPool = freshPool.length > 0 ? freshPool : pool;
    const selected = finalPool[Math.floor(Math.random() * finalPool.length)] || null;

    if (selected) {
      this.storage.saveRecentMaterialIds([selected.id, ...recentIds.filter((id) => id !== selected.id)]);
    }
    return selected;
  }

  getStats() {
    const byModule = {};
    const byRule = {};
    this.materials.forEach((material) => {
      byModule[material.focusModule] = (byModule[material.focusModule] || 0) + 1;
      (material.focusRules || []).forEach((rule) => {
        byRule[rule] = (byRule[rule] || 0) + 1;
      });
    });
    return { total: this.materials.length, byModule, byRule };
  }
}
