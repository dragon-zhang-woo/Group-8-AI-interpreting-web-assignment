export class IndexedDBManager {
  constructor(dbName = "InterpreterV4DB", version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  async init() {
    if (!("indexedDB" in globalThis)) {
      throw new Error("当前浏览器不支持 IndexedDB，学习记录无法保存。");
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains("practiceRecords")) {
          const records = db.createObjectStore("practiceRecords", { keyPath: "id" });
          records.createIndex("timestamp", "timestamp", { unique: false });
          records.createIndex("direction", "direction", { unique: false });
          records.createIndex("focusModule", "focusModule", { unique: false });
        }

        if (!db.objectStoreNames.contains("audioBlobs")) {
          const audio = db.createObjectStore("audioBlobs", { keyPath: "id" });
          audio.createIndex("createdAt", "createdAt", { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveRecord(record) {
    const fullRecord = {
      ...record,
      id: record.id || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: record.timestamp || Date.now()
    };
    await this._put("practiceRecords", fullRecord);
    return fullRecord.id;
  }

  async getAllRecords() {
    const records = await this._getAll("practiceRecords");
    return records.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getRecord(id) {
    return this._get("practiceRecords", id);
  }

  async deleteRecord(id) {
    const record = await this.getRecord(id);
    if (record?.audioBlobId) {
      await this._delete("audioBlobs", record.audioBlobId);
    }
    await this._delete("practiceRecords", id);
  }

  async clearRecords() {
    await Promise.all([this._clear("practiceRecords"), this._clear("audioBlobs")]);
  }

  async saveAudioBlob(blob, durationSeconds = 0) {
    const audio = {
      id: `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      blob,
      mimeType: blob.type || "audio/webm",
      size: blob.size,
      durationSeconds,
      createdAt: Date.now()
    };
    await this._put("audioBlobs", audio);
    return audio.id;
  }

  async getAudioBlob(id) {
    const record = await this._get("audioBlobs", id);
    return record?.blob || null;
  }

  async getStatistics() {
    const records = await this.getAllRecords();
    if (records.length === 0) {
      return {
        totalSessions: 0,
        averageScore: 0,
        averageAccuracy: 0,
        averageFluency: 0,
        averagePronunciation: 0,
        ruleCounts: {},
        trend: []
      };
    }

    const sums = records.reduce(
      (acc, record) => {
        acc.total += record.scores?.total || 0;
        acc.accuracy += record.scores?.accuracy || 0;
        acc.fluency += record.scores?.fluency || 0;
        acc.pronunciation += record.scores?.pronunciation || 0;
        (record.triggeredRules || []).forEach((rule) => {
          acc.ruleCounts[rule] = (acc.ruleCounts[rule] || 0) + 1;
        });
        const day = new Date(record.timestamp).toISOString().slice(0, 10);
        acc.trendMap[day] ||= { total: 0, count: 0 };
        acc.trendMap[day].total += record.scores?.total || 0;
        acc.trendMap[day].count += 1;
        return acc;
      },
      { total: 0, accuracy: 0, fluency: 0, pronunciation: 0, ruleCounts: {}, trendMap: {} }
    );

    const round = (value) => Number(value.toFixed(1));
    return {
      totalSessions: records.length,
      averageScore: round(sums.total / records.length),
      averageAccuracy: round(sums.accuracy / records.length),
      averageFluency: round(sums.fluency / records.length),
      averagePronunciation: round(sums.pronunciation / records.length),
      ruleCounts: sums.ruleCounts,
      trend: Object.entries(sums.trendMap)
        .map(([date, data]) => ({ date, score: round(data.total / data.count) }))
        .sort((a, b) => a.date.localeCompare(b.date))
    };
  }

  _put(storeName, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).put(value);
      request.onsuccess = () => resolve(value);
      request.onerror = () => reject(request.error);
    });
  }

  _get(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  _getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  _delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  _clear(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
