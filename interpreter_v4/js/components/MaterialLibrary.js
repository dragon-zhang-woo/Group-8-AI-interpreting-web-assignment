export class MaterialLibrary {
  constructor(storage) {
    this.storage = storage;
    this.materials = [];
  }

  async load() {
    const response = await fetch("data/materials.json?v=20260612-draw-fix", { cache: "no-store" });
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

  getRandom({ direction = "all", difficulty = "all", focusModule = "all", focusRule = "all", focusRules = [], excludeId = "" } = {}) {
    const selectedRules = Array.isArray(focusRules) ? focusRules.filter(Boolean).filter((rule) => rule !== "all") : [];
    if (focusRule && focusRule !== "all" && !selectedRules.includes(focusRule)) selectedRules.push(focusRule);
    const basePool = direction === "all" || direction === "auto" ? [...this.materials] : this.materials.filter((material) => material.direction === direction);
    let pool = this.filterPool(basePool, { difficulty, focusModule, selectedRules });

    if (pool.length === 0 && difficulty !== "all") {
      pool = this.filterPool(basePool, { difficulty: "all", focusModule, selectedRules });
    }
    if (pool.length === 0 && focusModule !== "all") {
      pool = this.filterPool(basePool, { difficulty: "all", focusModule, selectedRules: [] });
    }
    if (pool.length === 0 && selectedRules.length > 0) {
      pool = this.filterPool(basePool, { difficulty: "all", focusModule: "all", selectedRules });
    }

    if (pool.length === 0 && direction !== "all" && direction !== "auto") pool = basePool;
    if (pool.length === 0) pool = [...this.materials];
    if (excludeId && pool.length <= 1 && pool.some((material) => material.id === excludeId)) {
      pool = this.relaxRepeatPool(basePool, { difficulty, focusModule, selectedRules, excludeId }) || pool;
    }

    const recentIds = this.storage.getRecentMaterialIds();
    const nonCurrentPool = excludeId && pool.length > 1 ? pool.filter((material) => material.id !== excludeId) : pool;
    const freshPool = nonCurrentPool.filter((material) => !recentIds.includes(material.id));
    const finalPool = freshPool.length > 0 ? freshPool : nonCurrentPool;
    const selected = finalPool[Math.floor(Math.random() * finalPool.length)] || null;

    if (selected) {
      this.storage.saveRecentMaterialIds([selected.id, ...recentIds.filter((id) => id !== selected.id)]);
    }
    return selected;
  }

  relaxRepeatPool(basePool, { difficulty = "all", focusModule = "all", selectedRules = [], excludeId = "" } = {}) {
    const candidates = [
      { difficulty, focusModule, selectedRules: [] },
      { difficulty: "all", focusModule, selectedRules },
      { difficulty: "all", focusModule, selectedRules: [] },
      { difficulty: "all", focusModule: "all", selectedRules },
      { difficulty: "all", focusModule: "all", selectedRules: [] }
    ];

    for (const candidate of candidates) {
      const pool = this.filterPool(basePool, candidate);
      const alternatives = pool.filter((material) => material.id !== excludeId);
      if (alternatives.length > 0) return alternatives;
    }
    return null;
  }

  filterPool(basePool, { difficulty = "all", focusModule = "all", selectedRules = [] } = {}) {
    let pool = [...basePool];
    if (difficulty !== "all") pool = pool.filter((material) => material.difficultyLevel === difficulty);
    if (focusModule !== "all") pool = pool.filter((material) => material.focusModule === focusModule);
    if (selectedRules.length > 0) {
      pool = pool.filter((material) => selectedRules.some((rule) => material.focusRules?.includes(rule)));
      pool.sort((a, b) => this.countRuleOverlap(b, selectedRules) - this.countRuleOverlap(a, selectedRules));
      const bestOverlap = this.countRuleOverlap(pool[0], selectedRules);
      if (bestOverlap > 0) pool = pool.filter((material) => this.countRuleOverlap(material, selectedRules) === bestOverlap);
    }
    return pool;
  }

  countRuleOverlap(material, selectedRules) {
    if (!material) return 0;
    return selectedRules.filter((rule) => material.focusRules?.includes(rule)).length;
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
