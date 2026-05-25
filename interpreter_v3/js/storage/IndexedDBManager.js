/**
 * IndexedDB manager: audioBlobs and learningRecords object stores.
 */
export class IndexedDBManager {
  constructor(dbName = 'InterpreterTrainingDB', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('audioBlobs')) {
          const audioStore = db.createObjectStore('audioBlobs', { keyPath: 'id' });
          audioStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('learningRecords')) {
          const recordStore = db.createObjectStore('learningRecords', { keyPath: 'id' });
          recordStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  async saveAudioBlob(blob, duration = 0) {
    const id = 'audio_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const record = {
      id,
      blob,
      mimeType: blob.type || 'audio/webm',
      size: blob.size,
      duration,
      createdAt: Date.now()
    };
    await this._put('audioBlobs', record);
    return id;
  }

  async getAudioBlob(id) {
    const record = await this._get('audioBlobs', id);
    return record ? record.blob : null;
  }

  async deleteAudioBlob(id) {
    await this._delete('audioBlobs', id);
  }

  async saveRecord(record) {
    const id = 'rec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const fullRecord = { ...record, id, timestamp: record.timestamp || Date.now() };
    await this._put('learningRecords', fullRecord);
    return id;
  }

  async getAllRecords() {
    const records = await this._getAll('learningRecords');
    return records.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getRecordById(id) {
    return this._get('learningRecords', id);
  }

  async deleteRecord(id) {
    const record = await this.getRecordById(id);
    if (record && record.userAudioBlobId) {
      await this.deleteAudioBlob(record.userAudioBlobId);
    }
    await this._delete('learningRecords', id);
  }

  async getStatistics() {
    const records = await this.getAllRecords();
    if (records.length === 0) {
      return {
        totalSessions: 0,
        averageScore: 0,
        averagePronunciation: 0,
        averageFluency: 0,
        averageAccuracy: 0,
        scoresTrend: []
      };
    }

    const total = records.length;
    const sumScore = records.reduce((s, r) => s + (r.totalScore || 0), 0);
    const sumPron = records.reduce((s, r) => s + (r.pronunciationScore || 0), 0);
    const sumFlu = records.reduce((s, r) => s + (r.fluencyScore || 0), 0);
    const sumAcc = records.reduce((s, r) => s + (r.accuracyScore || 0), 0);

    const trendMap = {};
    records.forEach(r => {
      const day = new Date(r.timestamp).toISOString().slice(0, 10);
      if (!trendMap[day]) trendMap[day] = { sum: 0, count: 0 };
      trendMap[day].sum += (r.totalScore || 0);
      trendMap[day].count++;
    });
    const scoresTrend = Object.entries(trendMap)
      .map(([date, v]) => ({ date, score: parseFloat((v.sum / v.count).toFixed(1)) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalSessions: total,
      averageScore: parseFloat((sumScore / total).toFixed(1)),
      averagePronunciation: parseFloat((sumPron / total).toFixed(1)),
      averageFluency: parseFloat((sumFlu / total).toFixed(1)),
      averageAccuracy: parseFloat((sumAcc / total).toFixed(1)),
      scoresTrend
    };
  }

  async clearAll() {
    const tx = this.db.transaction(['audioBlobs', 'learningRecords'], 'readwrite');
    await Promise.all([
      new Promise(r => { tx.objectStore('audioBlobs').clear().onsuccess = r; }),
      new Promise(r => { tx.objectStore('learningRecords').clear().onsuccess = r; })
    ]);
  }

  // --- Internal helpers ---

  _get(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  _getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  _put(storeName, record) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).put(record);
      request.onsuccess = () => resolve(record.id);
      request.onerror = () => reject(request.error);
    });
  }

  _delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
