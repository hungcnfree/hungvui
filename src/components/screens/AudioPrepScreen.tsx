/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Volume2, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Loader2, 
  Play, 
  Pause,
  Layers, 
  ShieldCheck, 
  Mic
} from 'lucide-react';
import { Question, VoiceSettings } from '../../types';
import { 
  geminiTtsService, 
  PrepProgress, 
  formatQuestionSpeechText, 
  formatExplanationSpeechText,
  generateAudioHash 
} from '../../services/geminiTtsService';
import { getAllCachedHashes, saveQuestions } from '../../services/storage';
import { soundEngine } from '../../services/soundEngine';

interface AudioPrepScreenProps {
  questions: Question[];
  voiceSettings: VoiceSettings;
  onQuestionsUpdated: (questions: Question[]) => void;
  onBack: () => void;
  onContinue: () => void;
}

export const AudioPrepScreen: React.FC<AudioPrepScreenProps> = ({
  questions,
  voiceSettings,
  onQuestionsUpdated,
  onBack,
  onContinue,
}) => {
  const [progress, setProgress] = useState<PrepProgress>({
    totalTasks: questions.length * 2,
    completedTasks: 0,
    currentTaskDescription: '',
    isCompleted: false,
    isGenerating: false,
  });
  const [cachedHashes, setCachedHashes] = useState<Set<string>>(new Set());
  const [playingItem, setPlayingItem] = useState<{ id: string; type: 'question' | 'explanation' } | null>(null);

  // Kiểm tra tình trạng bộ nhớ đệm IndexedDB lúc tải trang
  useEffect(() => {
    getAllCachedHashes().then((hashes) => {
      setCachedHashes(hashes);
      // Đếm số file câu hỏi và giải thích đã có
      let readyCount = 0;
      questions.forEach((q) => {
        const qHash = generateAudioHash(formatQuestionSpeechText(q), voiceSettings.questionVoice);
        const expHash = generateAudioHash(formatExplanationSpeechText(q), voiceSettings.narratorVoice);
        if (hashes.has(qHash)) readyCount++;
        if (hashes.has(expHash)) readyCount++;
      });

      const total = questions.length * 2;
      if (readyCount === total && total > 0) {
        setProgress({
          totalTasks: total,
          completedTasks: readyCount,
          currentTaskDescription: 'Tất cả các file giọng đọc đã có sẵn trong bộ nhớ đệm!',
          isCompleted: true,
          isGenerating: false,
        });
      } else {
        setProgress(prev => ({
          ...prev,
          totalTasks: total,
          completedTasks: readyCount,
          currentTaskDescription: readyCount > 0 ? `Đã có sẵn ${readyCount}/${total} file trong máy` : 'Chưa có file giọng đọc trong máy',
          isCompleted: false,
        }));
      }
    });
  }, [questions, voiceSettings]);

  // Bắt đầu quá trình chuẩn bị giọng đọc
  const handleStartGeneration = async () => {
    soundEngine.playTick(1.2);
    setProgress(prev => ({ ...prev, isGenerating: true, isCompleted: false }));

    try {
      const result = await geminiTtsService.prepareAllAudios(
        questions,
        voiceSettings,
        (p) => setProgress(p)
      );

      // Cập nhật câu hỏi (nếu có câu vừa được Gemini sinh giải thích tự động)
      onQuestionsUpdated(result.updatedQuestions);
      saveQuestions(result.updatedQuestions);

      const hashes = await getAllCachedHashes();
      setCachedHashes(hashes);

      soundEngine.playVictory();
      setProgress({
        totalTasks: questions.length * 2,
        completedTasks: questions.length * 2,
        currentTaskDescription: 'Toàn bộ giọng đọc đã được tạo và lưu vào IndexedDB!',
        isCompleted: true,
        isGenerating: false,
      });
    } catch (err: any) {
      soundEngine.playWrong();
      setProgress(prev => ({
        ...prev,
        isGenerating: false,
        error: err?.message || 'Có lỗi xảy ra trong quá trình tạo giọng đọc',
      }));
    }
  };

  // Nghe thử File A hoặc File B
  const handlePlaySample = async (q: Question, type: 'question' | 'explanation') => {
    if (playingItem?.id === q.id && playingItem?.type === type) {
      geminiTtsService.stopCurrentPlayback();
      setPlayingItem(null);
      return;
    }

    setPlayingItem({ id: q.id, type });
    const text = type === 'question' ? formatQuestionSpeechText(q) : formatExplanationSpeechText(q);
    const voice = type === 'question' ? voiceSettings.questionVoice : voiceSettings.narratorVoice;

    await geminiTtsService.playQuestionOrExplanation(
      text,
      voice,
      voiceSettings.customApiKey,
      () => setPlayingItem(null)
    );
  };

  const totalAudioFiles = questions.length * 2;
  const percent = totalAudioFiles > 0 ? Math.min(100, Math.round((progress.completedTasks / totalAudioFiles) * 100)) : 0;
  const isFullyCached = progress.isCompleted || (progress.completedTasks === totalAudioFiles && totalAudioFiles > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header Info */}
      <div className="bg-slate-900/90 p-6 sm:p-8 rounded-3xl border border-amber-500/20 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wider uppercase">
            <Mic className="w-3.5 h-3.5" />
            Bước 2: Chuẩn Bị Giọng Đọc Gemini AI
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Tạo Giọng Đọc Sẵn Sàng Cho Tiết Học
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
            Hệ thống tạo sẵn toàn bộ âm thanh (File A: Câu hỏi & 4 phương án, File B: Lời nhận xét & giải thích) 
            và lưu vào máy của bạn. Khi vào lớp chiếu cho học sinh, âm thanh sẽ phát tức thì mà không cần chờ tải mạng.
          </p>
        </div>
      </div>

      {/* Main Preparation Control Card */}
      <div className="bg-slate-900/80 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black">
              {questions.length}
            </div>
            <div>
              <div className="text-xs text-slate-400">Số câu trắc nghiệm</div>
              <div className="text-sm font-bold text-white">Công nghệ 8/9</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
              {totalAudioFiles}
            </div>
            <div>
              <div className="text-xs text-slate-400">Tổng file âm thanh</div>
              <div className="text-sm font-bold text-white">2 file / mỗi câu</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Bộ đệm offline</div>
              <div className="text-sm font-bold text-emerald-400">Lưu IndexedDB</div>
            </div>
          </div>
        </div>

        {/* Voice summary tag */}
        <div className="p-3 bg-slate-950/40 rounded-2xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <div>
            <span>Giọng câu hỏi: </span>
            <span className="font-bold text-amber-400">{voiceSettings.questionVoice} (Dứt khoát)</span>
            <span className="mx-2 text-slate-600">|</span>
            <span>Giọng dẫn MC & Giải thích: </span>
            <span className="font-bold text-blue-400">{voiceSettings.narratorVoice} (Hoạt náo)</span>
          </div>
          <span className="text-slate-500 italic">Định dạng WAV 24000Hz 16-bit Mono</span>
        </div>

        {/* Progress Bar & Status */}
        <div className="space-y-3 bg-slate-950/80 p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-sm font-bold">
            <span className="text-slate-200">
              {progress.isGenerating ? (
                <span className="flex items-center gap-2 text-amber-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {progress.currentTaskDescription || `Đang tạo giọng: ${progress.completedTasks}/${totalAudioFiles}`}
                </span>
              ) : isFullyCached ? (
                <span className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Đã hoàn tất chuẩn bị 100%!
                </span>
              ) : (
                <span className="text-slate-400">{progress.currentTaskDescription || 'Sẵn sàng bấm tạo giọng'}</span>
              )}
            </span>
            <span className="text-amber-400 font-mono text-base">{percent}%</span>
          </div>

          {/* Bar */}
          <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isFullyCached
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="text-xs text-slate-400 flex items-center justify-between pt-1">
            <span>Tiến độ: {progress.completedTasks} / {totalAudioFiles} file</span>
            {isFullyCached && <span className="text-emerald-400 font-bold">Offline 100% không lo rớt mạng</span>}
          </div>
        </div>

        {/* Error notice if any */}
        {progress.error && (
          <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-sm">
            {progress.error}
          </div>
        )}

        {/* Big Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại sửa câu hỏi
          </button>

          <div className="flex flex-wrap items-center gap-3">
            {/* Button 1: Start Generating */}
            {!isFullyCached && (
              <button
                id="btn-start-audio-prep"
                onClick={handleStartGeneration}
                disabled={progress.isGenerating}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 transition disabled:opacity-40 cursor-pointer"
              >
                {progress.isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang tạo giọng...
                  </>
                ) : (
                  <>
                    <Volume2 className="w-5 h-5" />
                    Chuẩn bị giọng đọc ({totalAudioFiles - progress.completedTasks} file còn lại)
                  </>
                )}
              </button>
            )}

            {/* Button 2: Continue to Game Mode Select */}
            <button
              id="btn-continue-to-modes"
              onClick={() => {
                soundEngine.playTick(1.2);
                onContinue();
              }}
              className={`flex items-center gap-2 px-7 py-3 rounded-2xl font-black text-sm transition cursor-pointer ${
                isFullyCached
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-xl shadow-emerald-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <span>{isFullyCached ? 'Vào Chọn Trò Chơi Ngay' : 'Bỏ qua & Dùng giọng máy đọc tức thì'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Audio Audition / Preview List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            Nghe Thử Từng Câu Trước Giờ Vào Lớp
          </h3>
          <span className="text-xs text-slate-400">Bấm nút Play để nghe thử kiểm tra phát âm</span>
        </div>

        <div className="space-y-2">
          {questions.map((q) => {
            const qHash = generateAudioHash(formatQuestionSpeechText(q), voiceSettings.questionVoice);
            const expHash = generateAudioHash(formatExplanationSpeechText(q), voiceSettings.narratorVoice);
            const hasQAudio = cachedHashes.has(qHash);
            const hasExpAudio = cachedHashes.has(expHash);

            return (
              <div
                key={`audio-preview-${q.id}`}
                className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-amber-400 font-bold text-xs">
                      Câu {q.index}
                    </span>
                    <span className="text-sm font-semibold text-white truncate max-w-lg">
                      {q.question}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      File A: {hasQAudio ? <span className="text-emerald-400 font-semibold">Đã có</span> : <span className="text-amber-500/80 italic">Chưa có</span>}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      File B: {hasExpAudio ? <span className="text-emerald-400 font-semibold">Đã có</span> : <span className="text-amber-500/80 italic">Chưa có</span>}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Play File A */}
                  <button
                    onClick={() => handlePlaySample(q, 'question')}
                    title="Nghe thử File A: Câu hỏi & 4 phương án"
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                      playingItem?.id === q.id && playingItem?.type === 'question'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                    }`}
                  >
                    {playingItem?.id === q.id && playingItem?.type === 'question' ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>Nghe Câu hỏi</span>
                  </button>

                  {/* Play File B */}
                  <button
                    onClick={() => handlePlaySample(q, 'explanation')}
                    title="Nghe thử File B: Nhận xét & giải thích"
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                      playingItem?.id === q.id && playingItem?.type === 'explanation'
                        ? 'bg-blue-500 text-white border-blue-400 animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-blue-300 border-slate-700'
                    }`}
                  >
                    {playingItem?.id === q.id && playingItem?.type === 'explanation' ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>Nghe Giải thích</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
