/**
 * Practice material library. Loads from data/materials.json, provides random selection
 * with deduplication via recent-usage tracking.
 */
import { LocalStorageManager } from '../utils/LocalStorageManager.js';

export class MaterialLibrary {
  constructor() {
    this.materials = [];
    this.localStorage = new LocalStorageManager();
    this.loaded = false;
  }

  async load() {
    try {
      const response = await fetch('data/materials.json');
      if (!response.ok) throw new Error('Failed to load materials');
      this.materials = await response.json();
      this.loaded = true;
    } catch (e) {
      console.warn('Could not load materials.json, using empty library:', e);
      this.materials = [];
      this.loaded = true;
    }
  }

  getRandomMaterial(difficulty = null, direction = null, excludeRecent = true) {
    let pool = [...this.materials];

    if (difficulty && difficulty !== 'all') {
      pool = pool.filter(m => m.difficultyLevel === difficulty);
    }

    if (direction) {
      pool = pool.filter(m => m.direction === direction);
    }

    if (pool.length === 0) {
      return this.materials.length > 0 ? this.materials[0] : null;
    }

    if (excludeRecent) {
      const recentIds = this.localStorage.getRecentMaterials();
      const freshPool = pool.filter(m => !recentIds.includes(m.id));
      if (freshPool.length > 0) {
        pool = freshPool;
      }
    }

    const idx = Math.floor(Math.random() * pool.length);
    const material = pool[idx];

    if (excludeRecent) {
      this.markAsUsed(material.id);
    }

    return material;
  }

  getMaterialById(id) {
    return this.materials.find(m => m.id === id) || null;
  }

  getMaterialsByDifficulty(level) {
    return this.materials.filter(m => m.difficultyLevel === level);
  }

  getMaterialsByDirection(direction) {
    return this.materials.filter(m => m.direction === direction);
  }

  getMaterialsByTopic(topic) {
    return this.materials.filter(m => m.topicCategory === topic);
  }

  getDifficultyLevels() {
    return ['easy', 'medium', 'hard'];
  }

  getTopicCategories() {
    const topics = new Set(this.materials.map(m => m.topicCategory));
    return [...topics].sort();
  }

  markAsUsed(materialId) {
    const recent = this.localStorage.getRecentMaterials();
    recent.unshift(materialId);
    this.localStorage.saveRecentMaterials(recent);
  }

  getTotalCount() {
    return this.materials.length;
  }
}
