/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Key, Mic, Trash2, CheckCircle2, AlertCircle, Play, Volume2, Sparkles } from 'lucide-react';
import { VoiceSettings, VoiceName } from '../types';
import { saveVoiceSettings, loadVoiceSettings, clearAudioCache, getAllCachedHashes } from '../services/storage';
import { geminiTtsService } from '../services/geminiTtsService';
import { soundEngine } from '../services/soundEngine';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved: (settings: VoiceSettings) => void;
}

const VOICE_OPTIONS: { id: VoiceName; name: string; desc: string; roleTag: string }[] = [
  { id: 'Kore', name: 'Kore', desc: 'Dứt khoát, trang trọng, phát âm rõ ràng chuẩn mực', roleTag: 'Khuyên dùng cho Câu hỏi' },
  { id: 'Puck', name: 'Puck', desc: 'Hoạt náo, sôi nổi, phong cách MC truyền hình năng động', roleTag: 'Khuyên dùng cho Lời dẫn / Giải thích' },
  { id: 'Leda', name: 'Leda', desc: 'Trẻ trung, thân thiện, dễ thương phù hợp học sinh', roleTag: 'Giọng trẻ trung' },
  { id: 'Sulafat', name: 'Sulafat', desc: 'Ấm áp, truyền cảm, từ tốn dễ tiếp thu', roleTag: 'Giọng ấm áp' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSettingsSaved }) => {
  const [settings, setSettings] = useState<VoiceSettings>(loadVoiceSettings());
  const [testingKey, setTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [cachedCount, setCachedCount] = useState<number>(0);
  const [playingVoice, setPlayingVoice] = useState<VoiceName | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(loadVoiceSettings());
      getAllCachedHashes().then(hashes => setCachedCount(hashes.size));
      setKeyStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveVoiceSettings(settings);
    onSettingsSaved(settings);
    soundEngine.playTick(1.5);
    onClose();
  };

  const handleTestKey = async () => {
    setTestingKey(true);
    setKeyStatus(null);
    try {
      const res = await fetch('/api/check-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.customApiKey ? { 'x-gemini-key': settings.customApiKey } : {}),
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setKeyStatus({ success: true, message: 'Kết nối thành công! API key hoạt động tốt.' });
        soundEngine.playCorrect();
      } else {
        setKeyStatus({ success: false, message: data.error || 'API key không hợp lệ hoặc bị lỗi hạn mức.' });
        soundEngine.playWrong();
      }
    } catch (err: any) {
      setKeyStatus({ success: false, message: err?.message || 'Không thể kết nối máy chủ.' });
      soundEngine.playWrong();
    } finally {
      setTestingKey(false);
    }
  };

  const handleAuditionVoice = async (voice: VoiceName) => {
    setPlayingVoice(voice);
    try {
      const sampleText = `Chào mừng quý thầy cô và các em học sinh đến với Lớp Học Vui Công Nghệ 8 và 9!`;
      await geminiTtsService.playQuestionOrExplanation(sampleText, voice, settings.customApiKey, () => {
        setPlayingVoice(null);
      });
    } catch {
      setPlayingVoice(null);
    }
  };

  const handleClearCache = async () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ bộ đệm âm thanh đã lưu trong máy? Lần sau sẽ phải tạo lại.')) {
      await clearAudioCache();
      setCachedCount(0);
      alert('Đã xóa bộ nhớ đệm âm thanh!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Mic className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Cài Đặt Giọng Đọc & API Key</h2>
            <p className="text-sm text-slate-400">Tùy biến cấu hình âm thanh Gemini TTS và kết nối cho ứng dụng</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Section 1: API Key */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                Gemini API Key (Tùy chọn)
              </label>
              <span className="text-xs text-slate-500">Lưu an toàn tại trình duyệt của bạn</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Mặc định hệ thống sử dụng khóa máy chủ nếu có. Nếu bạn muốn dùng hạn mức riêng của mình, hãy dán API key từ Google AI Studio vào đây:
            </p>
            <div className="flex gap-2">
              <input
                id="input-gemini-key"
                type="password"
                placeholder="AIzaSy..."
                value={settings.customApiKey}
                onChange={(e) => setSettings({ ...settings, customApiKey: e.target.value })}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
              />
              <button
                id="btn-check-api-key"
                onClick={handleTestKey}
                disabled={testingKey}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {testingKey ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
              </button>
            </div>

            {keyStatus && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  keyStatus.success
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                    : 'bg-rose-950/60 text-rose-300 border border-rose-800'
                }`}
              >
                {keyStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{keyStatus.message}</span>
              </div>
            )}
          </div>

          {/* Section 2: Chọn giọng đọc */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider text-amber-400">
              Chọn giọng đọc Gemini TTS
            </h3>

            {/* Giọng đọc câu hỏi */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                1. Giọng đọc Câu hỏi & 4 Phương án (Mặc định: Kore - Dứt khoát, rõ ràng):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {VOICE_OPTIONS.map((v) => (
                  <div
                    key={`q-voice-${v.id}`}
                    onClick={() => setSettings({ ...settings, questionVoice: v.id })}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      settings.questionVoice === v.id
                        ? 'bg-amber-500/15 border-amber-500 text-white'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-200">{v.name}</div>
                      <div className="text-xs text-slate-400">{v.desc}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAuditionVoice(v.id);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 ml-2 shrink-0"
                      title={`Nghe thử giọng ${v.name}`}
                    >
                      {playingVoice === v.id ? <Volume2 className="w-4 h-4 animate-bounce" /> : <Play className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Giọng dẫn MC / Giải thích */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                2. Giọng dẫn MC & Giải thích đáp án (Mặc định: Puck - Hoạt náo gameshow):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {VOICE_OPTIONS.map((v) => (
                  <div
                    key={`n-voice-${v.id}`}
                    onClick={() => setSettings({ ...settings, narratorVoice: v.id })}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      settings.narratorVoice === v.id
                        ? 'bg-blue-500/15 border-blue-500 text-white'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-200">{v.name}</div>
                      <div className="text-xs text-slate-400">{v.desc}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAuditionVoice(v.id);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 ml-2 shrink-0"
                      title={`Nghe thử giọng ${v.name}`}
                    >
                      {playingVoice === v.id ? <Volume2 className="w-4 h-4 animate-bounce" /> : <Play className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Bộ đệm âm thanh IndexedDB */}
          <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-300">Bộ nhớ đệm âm thanh (IndexedDB)</div>
              <div className="text-xs text-slate-400">
                Đang lưu trữ <span className="text-amber-400 font-bold">{cachedCount}</span> file giọng đọc trong máy
              </div>
            </div>
            <button
              onClick={handleClearCache}
              disabled={cachedCount === 0}
              className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800 text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa bộ đệm
            </button>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="mt-8 pt-4 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
          >
            Hủy
          </button>
          <button
            id="btn-save-settings"
            onClick={handleSave}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-sm font-bold shadow-lg shadow-amber-500/20 transition"
          >
            Lưu cài đặt
          </button>
        </div>
      </div>
    </div>
  );
};
