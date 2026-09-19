/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GeminiTtsService: Xử lý hàng đợi tạo giọng đọc Gemini TTS, lưu đệm IndexedDB,
 * phát dự phòng bằng Web Speech API (speechSynthesis) và điều khiển âm thanh.
 */

import { Question, VoiceSettings, VoiceName } from '../types';
import { saveAudioToCache, getAudioFromCache, getAllCachedHashes } from './storage';
import { soundEngine } from './soundEngine';

// Tạo chuỗi băm (hash) đơn giản, nhanh và ổn định từ chuỗi văn bản + tên giọng
export function generateAudioHash(text: string, voiceName: string): string {
  const str = `${voiceName}::${text.trim()}`;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return `hash_${(hash >>> 0).toString(16)}_${str.length}`;
}

// Định dạng văn bản cho File A: Câu hỏi + 4 phương án đọc liền mạch có ngắt nhịp
export function formatQuestionSpeechText(q: Question): string {
  const optA = q.options.find(o => o.key === 'A')?.text || '';
  const optB = q.options.find(o => o.key === 'B')?.text || '';
  const optC = q.options.find(o => o.key === 'C')?.text || '';
  const optD = q.options.find(o => o.key === 'D')?.text || '';

  return `Câu số ${q.index}: ${q.question}. Phương án A: ${optA}. Phương án B: ${optB}. Phương án C: ${optC}. Phương án D: ${optD}.`;
}

// Định dạng văn bản cho File B: Lời nhận xét + giải thích đáp án đúng
export function formatExplanationSpeechText(q: Question): string {
  const correctOpt = q.options.find(o => o.key === q.answer)?.text || '';
  let explain = q.explanation?.trim();
  if (!explain) {
    explain = `${correctOpt} là đáp án chính xác.`;
  }
  return `Chính xác! Đáp án đúng là phương án ${q.answer}: ${correctOpt}. ${explain}`;
}

export interface PrepProgress {
  totalTasks: number;
  completedTasks: number;
  currentTaskDescription: string;
  isCompleted: boolean;
  isGenerating: boolean;
  error?: string;
}

// Quản lý hàng đợi tạo giọng đọc với tối đa 3 request đồng thời và exponential backoff
class GeminiTtsService {
  private activePlayer: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private playbackSessionId: number = 0;

  // Gọi API backend để tạo audio WAV từ Gemini TTS
  public async fetchTtsAudio(
    text: string,
    voiceName: VoiceName,
    customApiKey?: string,
    retryCount = 0
  ): Promise<string> {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customApiKey ? { 'x-gemini-key': customApiKey } : {}),
        },
        body: JSON.stringify({
          text,
          voiceName,
          promptPrefix: 'Đọc với giọng MC gameshow truyền hình, sôi nổi, rõ ràng, tốc độ vừa phải cho học sinh lớp 8:',
        }),
      });

      if (response.status === 429) {
        if (retryCount < 4) {
          const delayMs = Math.pow(2, retryCount) * 1500;
          console.warn(`Gặp giới hạn tần suất 429, chờ ${delayMs}ms rồi thử lại lần ${retryCount + 1}...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return this.fetchTtsAudio(text, voiceName, customApiKey, retryCount + 1);
        }
        throw new Error('Vượt quá hạn mức gọi API (429). Vui lòng thử lại sau giây lát.');
      }

      const data = await response.json();
      if (!response.ok || !data.success || !data.audioBase64) {
        throw new Error(data.error || 'Không thể tạo âm thanh từ Gemini TTS');
      }

      return data.audioBase64;
    } catch (err: any) {
      if (retryCount < 3 && err?.message?.includes('429')) {
        const delayMs = Math.pow(2, retryCount) * 1500;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return this.fetchTtsAudio(text, voiceName, customApiKey, retryCount + 1);
      }
      throw err;
    }
  }

  // Tự sinh câu giải thích còn thiếu bằng Gemini
  public async generateMissingExplanation(q: Question, customApiKey?: string): Promise<string> {
    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customApiKey ? { 'x-gemini-key': customApiKey } : {}),
        },
        body: JSON.stringify({
          question: q.question,
          options: q.options.map(o => `${o.key}. ${o.text}`),
          answer: q.answer,
        }),
      });

      const data = await response.json();
      return data.explanation || `Chính xác! Đáp án đúng là phương án ${q.answer}.`;
    } catch (err) {
      return `Chính xác! Đáp án đúng là phương án ${q.answer}.`;
    }
  }

  // Chuẩn bị toàn bộ giọng đọc cho danh sách câu hỏi
  public async prepareAllAudios(
    questions: Question[],
    voiceSettings: VoiceSettings,
    onProgress: (progress: PrepProgress) => void
  ): Promise<{ updatedQuestions: Question[]; successCount: number }> {
    // 1. Kiểm tra các câu hỏi chưa có giải thích để bổ sung trước
    const updatedQuestions = [...questions];
    for (let i = 0; i < updatedQuestions.length; i++) {
      if (!updatedQuestions[i].explanation?.trim()) {
        onProgress({
          totalTasks: questions.length * 2,
          completedTasks: 0,
          currentTaskDescription: `Đang tạo giải thích cho câu ${updatedQuestions[i].index}...`,
          isCompleted: false,
          isGenerating: true,
        });
        const autoExplain = await this.generateMissingExplanation(updatedQuestions[i], voiceSettings.customApiKey);
        updatedQuestions[i] = {
          ...updatedQuestions[i],
          explanation: autoExplain,
          isAiExplanation: true,
        };
      }
    }

    // 2. Lập danh sách các file cần kiểm tra hoặc tạo mới
    interface TaskItem {
      questionIndex: number;
      type: 'question' | 'explanation';
      text: string;
      voice: VoiceName;
      hash: string;
      desc: string;
    }

    const tasks: TaskItem[] = [];
    for (const q of updatedQuestions) {
      // File A: Câu hỏi (giọng Kore)
      const qText = formatQuestionSpeechText(q);
      const qHash = generateAudioHash(qText, voiceSettings.questionVoice);
      tasks.push({
        questionIndex: q.index,
        type: 'question',
        text: qText,
        voice: voiceSettings.questionVoice,
        hash: qHash,
        desc: `Câu ${q.index} (Phần câu hỏi & phương án)`,
      });

      // File B: Giải thích (giọng Puck)
      const expText = formatExplanationSpeechText(q);
      const expHash = generateAudioHash(expText, voiceSettings.narratorVoice);
      tasks.push({
        questionIndex: q.index,
        type: 'explanation',
        text: expText,
        voice: voiceSettings.narratorVoice,
        hash: expHash,
        desc: `Câu ${q.index} (Phần nhận xét & giải thích)`,
      });
    }

    const existingHashes = await getAllCachedHashes();
    const totalTasks = tasks.length;
    let completedTasks = 0;

    // Các tác vụ cần gọi API
    const tasksToProcess = tasks.filter(t => !existingHashes.has(t.hash));
    completedTasks = totalTasks - tasksToProcess.length;

    onProgress({
      totalTasks,
      completedTasks,
      currentTaskDescription: `Đã có sẵn ${completedTasks}/${totalTasks} file trong bộ nhớ. Bắt đầu tạo mới ${tasksToProcess.length} file...`,
      isCompleted: tasksToProcess.length === 0,
      isGenerating: tasksToProcess.length > 0,
    });

    if (tasksToProcess.length === 0) {
      return { updatedQuestions, successCount: totalTasks };
    }

    // Chạy hàng đợi tối đa 3 tác vụ song song
    const CONCURRENCY = 3;
    let taskIndex = 0;

    const worker = async () => {
      while (taskIndex < tasksToProcess.length) {
        const currentIdx = taskIndex++;
        const task = tasksToProcess[currentIdx];

        onProgress({
          totalTasks,
          completedTasks,
          currentTaskDescription: `Đang tạo: ${task.desc}...`,
          isCompleted: false,
          isGenerating: true,
        });

        try {
          const audioBase64 = await this.fetchTtsAudio(task.text, task.voice, voiceSettings.customApiKey);
          await saveAudioToCache(task.hash, audioBase64);
        } catch (err: any) {
          console.error(`Lỗi khi tạo audio cho ${task.desc}:`, err);
        } finally {
          completedTasks++;
          onProgress({
            totalTasks,
            completedTasks,
            currentTaskDescription: `Hoàn tất ${completedTasks}/${totalTasks} mục`,
            isCompleted: completedTasks >= totalTasks,
            isGenerating: completedTasks < totalTasks,
          });
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, tasksToProcess.length) }, () => worker());
    await Promise.all(workers);

    return { updatedQuestions, successCount: completedTasks };
  }

  // Dừng phát âm thanh hiện tại ngay lập tức, hủy bỏ mọi tác vụ phát đang chờ
  public stopCurrentPlayback() {
    this.playbackSessionId++; // Hủy mọi Promise/IndexedDB đang load dở
    if (this.activePlayer) {
      try {
        this.activePlayer.onended = null;
        this.activePlayer.onerror = null;
        this.activePlayer.pause();
        this.activePlayer.currentTime = 0;
        this.activePlayer.src = '';
      } catch (e) {
        // bỏ qua lỗi nếu browser đang pending play
      }
      this.activePlayer = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
    soundEngine.duckBgm(false);
  }

  // Phát audio cho một câu hỏi hoặc giải thích
  // Tự động kiểm tra IndexedDB -> nếu chưa có thì phát ngay bằng Web Speech API
  public async playQuestionOrExplanation(
    text: string,
    voiceName: VoiceName,
    customApiKey?: string,
    onEnd?: () => void
  ): Promise<void> {
    // 1. Dừng triệt để bất kỳ âm thanh nào đang phát trước đó
    this.stopCurrentPlayback();
    const currentSession = this.playbackSessionId;

    if (soundEngine.getMute()) {
      if (onEnd) onEnd();
      return;
    }

    // Hạ âm lượng nhạc nền (ducking)
    soundEngine.duckBgm(true);

    const hash = generateAudioHash(text, voiceName);
    const cachedAudio = await getAudioFromCache(hash);

    // Nếu trong lúc chờ IndexedDB, người dùng đã bấm đáp án hoặc dừng, hủy ngay!
    if (this.playbackSessionId !== currentSession) {
      return;
    }

    if (cachedAudio) {
      // 1. Phát từ file WAV đã lưu đệm
      try {
        const audio = new Audio(cachedAudio);
        this.activePlayer = audio;

        audio.onended = () => {
          if (this.playbackSessionId !== currentSession) return;
          this.activePlayer = null;
          soundEngine.duckBgm(false);
          if (onEnd) onEnd();
        };

        audio.onerror = (e) => {
          if (this.playbackSessionId !== currentSession) return;
          console.warn('Lỗi khi phát audio cached, chuyển sang Web Speech:', e);
          this.fallbackWebSpeech(text, currentSession, onEnd);
        };

        await audio.play();
        // Kiểm tra lại sau khi await play() xong xem có bị ngắt không
        if (this.playbackSessionId !== currentSession) {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch {}
          return;
        }
        return;
      } catch (err) {
        if (this.playbackSessionId !== currentSession) return;
        console.warn('Lỗi gọi play() audio:', err);
      }
    }

    // 2. Nếu chưa có audio: Phát ngay bằng Web Speech API để không làm gián đoạn trò chơi!
    if (this.playbackSessionId === currentSession) {
      this.fallbackWebSpeech(text, currentSession, onEnd);
    }

    // Đồng thời gọi tạo audio nền để lần sau có sẵn
    this.fetchTtsAudio(text, voiceName, customApiKey)
      .then(newAudio => saveAudioToCache(hash, newAudio))
      .catch(e => console.warn('Tạo nền audio thất bại:', e));
  }

  // Phát bằng Web Speech API có hỗ trợ tiếng Việt
  private fallbackWebSpeech(text: string, sessionId: number, onEnd?: () => void) {
    if (!window.speechSynthesis || this.playbackSessionId !== sessionId) {
      soundEngine.duckBgm(false);
      if (onEnd && this.playbackSessionId === sessionId) onEnd();
      return;
    }

    // Hủy bỏ bất kỳ giọng nào trước đó
    window.speechSynthesis.cancel();

    // Tinh chỉnh text để Web Speech đọc mượt hơn
    const cleanText = text.replace(/[*#]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    // Thử tìm giọng tiếng Việt nếu có
    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find(v => v.lang.includes('vi') || v.lang.includes('VN'));
    if (viVoice) {
      utterance.voice = viVoice;
    }

    utterance.onend = () => {
      if (this.playbackSessionId !== sessionId) return;
      this.currentUtterance = null;
      soundEngine.duckBgm(false);
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      if (this.playbackSessionId !== sessionId) return;
      this.currentUtterance = null;
      soundEngine.duckBgm(false);
      if (onEnd) onEnd();
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }
}

export const geminiTtsService = new GeminiTtsService();
