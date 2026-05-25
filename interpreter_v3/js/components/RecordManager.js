/**
 * Learning record manager: CRUD operations, statistics, CSV export.
 */
import { Validator } from '../utils/Validator.js';

export class RecordManager {
  constructor(indexedDBManager) {
    this.db = indexedDBManager;
  }

  async saveRecord(scoreReport, sourceText, userTranslation, audioBlobId, languageDirection) {
    const record = {
      timestamp: scoreReport.timestamp || Date.now(),
      sourceText,
      userTranslation,
      userAudioBlobId: audioBlobId || '',
      pronunciationScore: scoreReport.pronunciationScore,
      fluencyScore: scoreReport.fluencyScore,
      accuracyScore: scoreReport.accuracyScore,
      totalScore: scoreReport.totalScore,
      pronunciationFeedback: scoreReport.pronunciationFeedback,
      fluencyFeedback: scoreReport.fluencyFeedback,
      accuracyFeedback: scoreReport.accuracyFeedback,
      suggestions: scoreReport.suggestions || [],
      languageDirection: languageDirection || 'en-zh'
    };

    return this.db.saveRecord(record);
  }

  async getAllRecords() {
    return this.db.getAllRecords();
  }

  async getRecordById(id) {
    return this.db.getRecordById(id);
  }

  async deleteRecord(id) {
    await this.db.deleteRecord(id);
  }

  async getStatistics() {
    return this.db.getStatistics();
  }

  async clearAll() {
    await this.db.clearAll();
  }

  async exportToCSV() {
    const records = await this.getAllRecords();
    if (records.length === 0) {
      return '';
    }

    const headers = [
      '时间', '原文', '用户翻译', '发音评分', '流畅性评分',
      '准确性评分', '总分', '发音反馈', '流畅性反馈', '准确性反馈', '语言方向'
    ];

    const rows = records.map(r => [
      new Date(r.timestamp).toLocaleString('zh-CN'),
      `"${(r.sourceText || '').replace(/"/g, '""')}"`,
      `"${(r.userTranslation || '').replace(/"/g, '""')}"`,
      r.pronunciationScore,
      r.fluencyScore,
      r.accuracyScore,
      r.totalScore,
      `"${(r.pronunciationFeedback || '').replace(/"/g, '""')}"`,
      `"${(r.fluencyFeedback || '').replace(/"/g, '""')}"`,
      `"${(r.accuracyFeedback || '').replace(/"/g, '""')}"`,
      r.languageDirection
    ]);

    // UTF-8 BOM for Excel compatibility
    const BOM = '﻿';
    const csv = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    return csv;
  }

  downloadCSV() {
    this.exportToCSV().then(csv => {
      if (!csv) {
        alert('暂无学习记录可导出');
        return;
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `口译学习记录_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
}
