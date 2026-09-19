/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StorageService: Quản lý lưu trữ câu hỏi bằng localStorage và lưu audio cache bằng IndexedDB
 */

import { Question, VoiceSettings, Team, SoloHistoryItem } from '../types';

const DB_NAME = 'LopHocVuiAudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'audioCache';

// Mở hoặc khởi tạo kết nối IndexedDB
function openAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'hash' });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

// 1. IndexedDB Audio Cache
export async function saveAudioToCache(hash: string, audioBase64: string): Promise<void> {
  try {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ hash, audioBase64, updatedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Lỗi lưu audio vào IndexedDB:', err);
  }
}

export async function getAudioFromCache(hash: string): Promise<string | null> {
  try {
    const db = await openAudioDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(hash);
      req.onsuccess = () => {
        resolve(req.result ? req.result.audioBase64 : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Lỗi đọc audio từ IndexedDB:', err);
    return null;
  }
}

export async function getAllCachedHashes(): Promise<Set<string>> {
  try {
    const db = await openAudioDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = req.result as string[];
        resolve(new Set(keys));
      };
      req.onerror = () => resolve(new Set());
    });
  } catch {
    return new Set();
  }
}

export async function clearAudioCache(): Promise<void> {
  try {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Lỗi xóa IndexedDB audio:', err);
  }
}

// 2. LocalStorage cho câu hỏi & cài đặt
const STORAGE_KEYS = {
  QUESTIONS: 'lhv_questions_v1',
  VOICE_SETTINGS: 'lhv_voice_settings_v1',
  TEAMS: 'lhv_teams_v1',
  SOLO_HIGH_SCORE: 'lhv_solo_high_score',
  SOLO_HISTORY: 'lhv_solo_history',
};

export function saveQuestions(questions: Question[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
  } catch (e) {
    console.error('Không thể lưu câu hỏi vào localStorage:', e);
  }
}

export function loadQuestions(): Question[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Lỗi đọc câu hỏi từ localStorage:', e);
    return [];
  }
}

export function saveVoiceSettings(settings: VoiceSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.VOICE_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Lỗi lưu cấu hình giọng đọc:', e);
  }
}

export function loadVoiceSettings(): VoiceSettings {
  const defaultSettings: VoiceSettings = {
    questionVoice: 'Kore',   // Giọng đọc câu hỏi: rõ ràng, dứt khoát
    narratorVoice: 'Puck',   // Giọng dẫn MC: hoạt náo, sôi nổi
    customApiKey: '',
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VOICE_SETTINGS);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
}

export function saveTeams(teams: Team[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
  } catch (e) {
    console.error('Lỗi lưu thông tin đội:', e);
  }
}

export function loadTeams(): Team[] {
  const defaultTeams: Team[] = [
    { id: 'team-1', name: 'Đội Sao Kim', color: '#f59e0b', score: 0, avatar: '⚡' },
    { id: 'team-2', name: 'Đội Sao Hỏa', color: '#ef4444', score: 0, avatar: '🔥' },
    { id: 'team-3', name: 'Đội Sao Mộc', color: '#10b981', score: 0, avatar: '🌿' },
    { id: 'team-4', name: 'Đội Sao Băng', color: '#3b82f6', score: 0, avatar: '🚀' },
  ];

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TEAMS);
    if (!raw) return defaultTeams;
    return JSON.parse(raw);
  } catch {
    return defaultTeams;
  }
}

export function saveSoloHighScore(score: number): void {
  const current = getSoloHighScore();
  if (score > current) {
    localStorage.setItem(STORAGE_KEYS.SOLO_HIGH_SCORE, score.toString());
  }
}

export function getSoloHighScore(): number {
  const val = localStorage.getItem(STORAGE_KEYS.SOLO_HIGH_SCORE);
  return val ? parseInt(val, 10) || 0 : 0;
}

export function addSoloHistory(item: SoloHistoryItem): void {
  try {
    const history = getSoloHistory();
    history.unshift(item);
    localStorage.setItem(STORAGE_KEYS.SOLO_HISTORY, JSON.stringify(history.slice(0, 20)));
  } catch (e) {
    console.error('Lỗi lưu lịch sử tự luyện:', e);
  }
}

export function getSoloHistory(): SoloHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SOLO_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Xuất file JSON bộ câu hỏi
export function exportQuestionsToJson(questions: Question[]): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(questions, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `Bo_Cau_Hoi_Cong_Nghe_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
