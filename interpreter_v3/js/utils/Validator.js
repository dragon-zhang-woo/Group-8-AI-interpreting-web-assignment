/**
 * Input validation and sanitization utilities.
 */
export class Validator {
  static validateText(text, minLength = 1, maxLength = 500) {
    if (!text || typeof text !== 'string') {
      return { valid: false, error: '请输入文本内容' };
    }
    const trimmed = text.trim();
    if (trimmed.length < minLength) {
      return { valid: false, error: `文本长度不能少于 ${minLength} 个字符` };
    }
    if (trimmed.length > maxLength) {
      return { valid: false, error: `文本长度不能超过 ${maxLength} 个字符` };
    }
    return { valid: true, value: trimmed };
  }

  static validateAudio(blob, minDuration = 1, maxDuration = 120) {
    if (!blob || !(blob instanceof Blob)) {
      return { valid: false, error: '无效的音频数据' };
    }
    if (blob.size === 0) {
      return { valid: false, error: '音频文件为空' };
    }
    return { valid: true };
  }

  static sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  static isValidDifficulty(level) {
    return ['easy', 'medium', 'hard'].includes(level);
  }

  static isValidDirection(direction) {
    return ['en-zh', 'zh-en'].includes(direction);
  }
}
