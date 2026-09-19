/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MODULE TRÒ CHƠI: "Ô CỬA BÍ MẬT" (SECRET DOOR GAME)
 * Thiết kế hoàn chỉnh cho máy chiếu lớp học và điện thoại tự luyện
 * ===================================================================
 * GIÁO VIÊN CÓ THỂ TÙY CHỈNH DANH SÁCH PHẦN THƯỞNG VÀ ĐIỂM SỐ DƯỚI ĐÂY:
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { 
  Trophy, 
  Sparkles, 
  RotateCcw, 
  Home, 
  Volume2, 
  VolumeX, 
  Clock, 
  Play, 
  Pause, 
  ArrowRight,
  Gift, 
  Gem, 
  XCircle, 
  CheckCircle2, 
  Zap,
  HelpCircle,
  Medal
} from 'lucide-react';
import { Question, Team, GameMode, DoorItem, DoorRewardType, OptionKey, SoloHistoryItem } from '../../types';
import { geminiTtsService, formatQuestionSpeechText, formatExplanationSpeechText } from '../../services/geminiTtsService';
import { soundEngine } from '../../services/soundEngine';
import { saveSoloHighScore, addSoloHistory } from '../../services/storage';

// ============================================================================
// CẤU HÌNH 12 PHẦN THƯỞNG ẨN TRONG CÁC Ô CỬA (Giáo viên có thể tùy ý thay đổi):
// ============================================================================
const DEFAULT_DOOR_REWARDS: {
  rewardType: DoorRewardType;
  title: string;
  points: number;
  isDouble?: boolean;
  isLucky?: boolean;
  isLoseTurn?: boolean;
}[] = [
  // 6 ô điểm thường:
  { rewardType: 'SCORE_10', title: '+10 Điểm', points: 10 },
  { rewardType: 'SCORE_10', title: '+10 Điểm', points: 10 },
  { rewardType: 'SCORE_20', title: '+20 Điểm', points: 20 },
  { rewardType: 'SCORE_20', title: '+20 Điểm', points: 20 },
  { rewardType: 'SCORE_30', title: '+30 Điểm', points: 30 },
  { rewardType: 'SCORE_30', title: '+30 Điểm', points: 30 },

  // 2 ô NHÂN ĐÔI điểm câu này (trả lời đúng được x2 điểm):
  { rewardType: 'DOUBLE', title: '⚡ NHÂN ĐÔI ĐIỂM', points: 20, isDouble: true },
  { rewardType: 'DOUBLE', title: '⚡ NHÂN ĐÔI ĐIỂM', points: 20, isDouble: true },

  // 2 ô MAY MẮN: Được cộng điểm ngay lập tức mà không cần trả lời câu hỏi:
  { rewardType: 'LUCKY', title: '🎁 MAY MẮN (+25đ)', points: 25, isLucky: true },
  { rewardType: 'LUCKY', title: '🎁 MAY MẮN (+25đ)', points: 25, isLucky: true },

  // 1 ô MẤT LƯỢT: Không được trả lời và chuyển lượt cho đội khác:
  { rewardType: 'LOSE_TURN', title: '❌ MẤT LƯỢT', points: 0, isLoseTurn: true },

  // 1 ô KHO BÁU ĐẶC BIỆT: Trả lời đúng nhận 50 điểm cực lớn:
  { rewardType: 'TREASURE', title: '💎 KHO BÁU (50đ)', points: 50 },
];

interface SecretDoorGameProps {
  questions: Question[];
  teams: Team[];
  mode: GameMode;
  timerSeconds: number; // 0 = vô hạn
  voiceSettings: any;
  onExitGame: () => void;
}

export const SecretDoorGame: React.FC<SecretDoorGameProps> = ({
  questions,
  teams: initialTeams,
  mode,
  timerSeconds: initialTimerSeconds,
  voiceSettings,
  onExitGame,
}) => {
  // Trạng thái các đội và điểm
  const [teams, setTeams] = useState<Team[]>(
    mode === 'CLASSROOM' 
      ? initialTeams.map(t => ({ ...t, score: 0 }))
      : [{ id: 'solo-1', name: 'Bạn', color: '#f59e0b', score: 0, avatar: '⭐' }]
  );
  const [currentTeamIndex, setCurrentTeamIndex] = useState<number>(0);

  // Trạng thái 12 ô cửa
  const [doors, setDoors] = useState<DoorItem[]>([]);
  const [selectedDoor, setSelectedDoor] = useState<DoorItem | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);

  // Trạng thái đếm giờ
  const [timeLeft, setTimeLeft] = useState<number>(initialTimerSeconds);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Trạng thái câu trả lời
  const [selectedAnswer, setSelectedAnswer] = useState<OptionKey | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Trạng thái thông báo đặc biệt (May mắn hoặc Mất lượt)
  const [specialAnnouncement, setSpecialAnnouncement] = useState<{
    type: 'LUCKY' | 'LOSE_TURN';
    title: string;
    description: string;
    points?: number;
  } | null>(null);

  // Trạng thái kết thúc game
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [soloHistoryRecord, setSoloHistoryRecord] = useState<{
    correctAnswers: number;
    wrongAnswers: number;
    details: { question: string; chosen: OptionKey; correct: OptionKey; isRight: boolean }[];
  }>({ correctAnswers: 0, wrongAnswers: 0, details: [] });

  const timerRef = useRef<any>(null);

  // Khởi tạo và xáo trộn 12 ô cửa
  const initGame = useCallback(() => {
    soundEngine.stopBgm();
    soundEngine.startBgm();

    // Xáo trộn ngẫu nhiên 12 phần thưởng
    const shuffledRewards = [...DEFAULT_DOOR_REWARDS].sort(() => Math.random() - 0.5);

    // Ghép câu hỏi ngẫu nhiên cho từng ô
    const shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);

    const newDoors: DoorItem[] = shuffledRewards.map((reward, idx) => {
      const q = shuffledQuestions[idx % shuffledQuestions.length];
      return {
        id: idx + 1,
        rewardType: reward.rewardType,
        title: reward.title,
        points: reward.points,
        isDouble: reward.isDouble,
        isLucky: reward.isLucky,
        isLoseTurn: reward.isLoseTurn,
        questionId: q?.id,
        isOpened: false,
      };
    });

    setDoors(newDoors);
    setSelectedDoor(null);
    setActiveQuestion(null);
    setSelectedAnswer(null);
    setIsAnswerRevealed(false);
    setSpecialAnnouncement(null);
    setIsGameOver(false);
    setCurrentTeamIndex(0);
    setTeams(prev => prev.map(t => ({ ...t, score: 0 })));
    setSoloHistoryRecord({ correctAnswers: 0, wrongAnswers: 0, details: [] });
  }, [questions]);

  useEffect(() => {
    initGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      geminiTtsService.stopCurrentPlayback();
    };
  }, [initGame]);

  // Bộ đếm ngược thời gian
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsTimerRunning(false);
            handleTimeUp();
            return 0;
          }
          // Âm thanh tích tắc dồn dập ở 5 giây cuối
          if (prev <= 6) {
            soundEngine.playTick(1.2 + (6 - prev) * 0.15);
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, timeLeft]);

  // Khi hết giờ
  const handleTimeUp = () => {
    soundEngine.playWrong();
    if (!selectedAnswer && activeQuestion) {
      handleAnswerSelect('A', true); // Hết giờ tính là trả lời sai
    }
  };

  // Mở một ô cửa bí mật
  const handleOpenDoor = (door: DoorItem) => {
    if (door.isOpened || selectedDoor) return;

    soundEngine.playDoorOpen();
    const updatedDoors = doors.map(d => (d.id === door.id ? { ...d, isOpened: true } : d));
    setDoors(updatedDoors);
    setSelectedDoor(door);

    // TRƯỜNG HỢP 1: Ô MẤT LƯỢT
    if (door.isLoseTurn) {
      soundEngine.playWrong();
      setSpecialAnnouncement({
        type: 'LOSE_TURN',
        title: '❌ RẤT TIẾC: BẠN ĐÃ MỞ TRÚNG Ô MẤT LƯỢT!',
        description: `Lượt chơi của ${teams[currentTeamIndex]?.name} sẽ được chuyển cho đội tiếp theo.`,
      });
      return;
    }

    // TRƯỜNG HỢP 2: Ô MAY MẮN (Cộng điểm ngay không cần trả lời)
    if (door.isLucky) {
      soundEngine.playSpin();
      setTimeout(() => soundEngine.playCorrect(), 300);

      const addedPoints = door.points;
      setTeams(prev => prev.map((t, idx) => (idx === currentTeamIndex ? { ...t, score: t.score + addedPoints } : t)));

      setSpecialAnnouncement({
        type: 'LUCKY',
        title: `🎁 CHÚC MỪNG: Ô MAY MẮN!`,
        description: `Đội ${teams[currentTeamIndex]?.name} nhận ngay +${addedPoints} điểm mà không cần trả lời câu hỏi!`,
        points: addedPoints,
      });
      return;
    }

    // TRƯỜNG HỢP 3: Ô CÂU HỎI (Điểm thường, Nhân đôi hoặc Kho báu)
    const q = questions.find(item => item.id === door.questionId) || questions[0];
    setActiveQuestion(q);
    setSelectedAnswer(null);
    setIsAnswerRevealed(false);
    setTimeLeft(initialTimerSeconds);

    // Tự động phát âm thanh Câu hỏi & 4 Phương án (File A)
    setIsSpeaking(true);
    const speechText = formatQuestionSpeechText(q);
    geminiTtsService.playQuestionOrExplanation(
      speechText,
      voiceSettings.questionVoice || 'Kore',
      voiceSettings.customApiKey,
      () => {
        setIsSpeaking(false);
        // Tự động kích hoạt đồng hồ đếm ngược sau khi đọc xong
        if (initialTimerSeconds > 0) {
          setIsTimerRunning(true);
        }
      }
    );
  };

  // Chọn đáp án
  const handleAnswerSelect = (optionKey: OptionKey, isTimeout = false) => {
    if (isAnswerRevealed || !activeQuestion || !selectedDoor) return;

    // Dừng đếm giờ và dừng đọc nếu còn đang đọc
    setIsTimerRunning(false);
    geminiTtsService.stopCurrentPlayback();
    setIsSpeaking(false);

    setSelectedAnswer(optionKey);
    setIsAnswerRevealed(true);

    const isCorrect = !isTimeout && optionKey === activeQuestion.answer;

    // Tính điểm thưởng
    let pointsEarned = 0;
    if (isCorrect) {
      pointsEarned = selectedDoor.points;
      if (selectedDoor.isDouble) {
        pointsEarned = pointsEarned * 2; // Nhân đôi điểm!
      }
      soundEngine.playCorrect();
    } else {
      soundEngine.playWrong();
    }

    // Cập nhật điểm cho đội
    setTeams(prev => prev.map((t, idx) => (idx === currentTeamIndex ? { ...t, score: t.score + pointsEarned } : t)));

    // Lưu lại lịch sử trả lời cho chế độ Tự Luyện
    if (mode === 'SOLO') {
      setSoloHistoryRecord(prev => ({
        correctAnswers: prev.correctAnswers + (isCorrect ? 1 : 0),
        wrongAnswers: prev.wrongAnswers + (isCorrect ? 0 : 1),
        details: [
          ...prev.details,
          {
            question: activeQuestion.question,
            chosen: optionKey,
            correct: activeQuestion.answer,
            isRight: isCorrect,
          }
        ]
      }));
    }

    // Tự động phát File B: Nhận xét & giải thích đáp án đúng
    const explanationText = formatExplanationSpeechText(activeQuestion);
    setIsSpeaking(true);
    geminiTtsService.playQuestionOrExplanation(
      explanationText,
      voiceSettings.narratorVoice || 'Puck',
      voiceSettings.customApiKey,
      () => {
        setIsSpeaking(false);
      }
    );
  };

  // Đóng câu hỏi hiện tại và chuyển lượt cho đội tiếp theo
  const handleNextTurn = () => {
    soundEngine.playTick(1.0);
    geminiTtsService.stopCurrentPlayback();
    setIsSpeaking(false);

    setSelectedDoor(null);
    setActiveQuestion(null);
    setSelectedAnswer(null);
    setIsAnswerRevealed(false);
    setSpecialAnnouncement(null);

    // Chuyển lượt chơi
    setCurrentTeamIndex(prev => (prev + 1) % teams.length);

    // Kiểm tra xem đã mở hết 12 ô chưa
    const remainingDoors = doors.filter(d => !d.isOpened);
    if (remainingDoors.length === 0) {
      handleFinishGame();
    }
  };

  // Khi hoàn thành cả 12 ô cửa: Pháo giấy rơi & trao cúp
  const handleFinishGame = () => {
    setIsGameOver(true);
    soundEngine.playVictory();

    // Bắn pháo giấy chúc mừng
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899'],
    });

    if (mode === 'SOLO') {
      const currentScore = teams[0].score;
      saveSoloHighScore(currentScore);
      addSoloHistory({
        date: new Date().toLocaleDateString('vi-VN'),
        score: currentScore,
        totalQuestions: 12,
        correctCount: soloHistoryRecord.correctAnswers,
      });
    }
  };

  // Hỗ trợ phím tắt bàn phím cho máy chiếu:
  // A, B, C, D: chọn đáp án
  // Space: bắt đầu/dừng đếm giờ
  // Enter: tiếp tục lượt sau
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Nếu đang mở thông báo đặc biệt (May mắn / Mất lượt)
      if (specialAnnouncement) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNextTurn();
        }
        return;
      }

      // Nếu đang mở câu hỏi
      if (activeQuestion && !isAnswerRevealed) {
        const key = e.key.toUpperCase();
        if (key === 'A' || key === 'B' || key === 'C' || key === 'D') {
          handleAnswerSelect(key as OptionKey);
        } else if (e.key === ' ') {
          e.preventDefault();
          setIsTimerRunning(prev => !prev);
        }
      } else if (activeQuestion && isAnswerRevealed) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleNextTurn();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeQuestion, isAnswerRevealed, specialAnnouncement]);

  const activeTeam = teams[currentTeamIndex] || teams[0];
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-[calc(100vh-70px)] flex flex-col justify-between p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header: Bảng điểm & Trạng thái lượt chơi */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-amber-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Game Title & Door counter */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-amber-400">
              TRÒ CHƠI SỐ 1
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Ô CỬA BÍ MẬT <span className="text-xs text-slate-400 font-normal">({doors.filter(d => d.isOpened).length}/12 Ô đã mở)</span>
            </h2>
          </div>
        </div>

        {/* Lượt của đội nào (Trong chế độ lớp học) */}
        {mode === 'CLASSROOM' && !isGameOver && (
          <div className="px-5 py-2 rounded-2xl bg-amber-500/15 border-2 border-amber-500 flex items-center gap-3 animate-pulse">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Đang đến lượt:</span>
            <span className="text-base sm:text-lg font-black text-white flex items-center gap-1.5">
              <span>{activeTeam.avatar}</span>
              <span>{activeTeam.name}</span>
            </span>
          </div>
        )}

        {/* Scoreboards (Chiếu lớn trên màn hình) */}
        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1">
          {teams.map((team, idx) => {
            const isTurn = idx === currentTeamIndex && mode === 'CLASSROOM';
            return (
              <div
                key={team.id}
                className={`px-4 py-2 rounded-2xl border transition flex items-center gap-2.5 shrink-0 ${
                  isTurn
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 border-amber-400 font-black shadow-lg shadow-amber-500/20 scale-105'
                    : 'bg-slate-950/70 text-white border-slate-800'
                }`}
              >
                <span className="text-lg">{team.avatar}</span>
                <div>
                  <div className="text-[11px] font-bold truncate max-w-[100px] leading-tight">
                    {team.name}
                  </div>
                  <div className={`text-sm font-black ${isTurn ? 'text-slate-950' : 'text-amber-400'}`}>
                    {team.score} đ
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Board: Lưới 12 Ô Cửa 3D Lật Mở */}
      {!isGameOver && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-5 my-auto">
          {doors.map((door) => {
            return (
              <div
                key={`door-${door.id}`}
                onClick={() => handleOpenDoor(door)}
                className="perspective-1000 h-28 sm:h-36 md:h-44 cursor-pointer select-none"
              >
                <div
                  className={`relative w-full h-full rounded-3xl transition-transform duration-500 transform-style-3d ${
                    door.isOpened ? 'rotate-y-180' : 'hover:scale-[1.03]'
                  }`}
                >
                  {/* MẶT TRƯỚC: Ô CỬA CHƯA MỞ (Sân khấu ánh vàng kim rực rỡ) */}
                  <div className="absolute inset-0 w-full h-full backface-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 border-2 border-amber-500/40 hover:border-amber-400 shadow-xl flex flex-col items-center justify-center p-3 text-center transition group">
                    {/* Họa tiết góc sân khấu */}
                    <div className="absolute top-2 left-2 text-[10px] text-amber-500/50 font-mono font-bold">★</div>
                    <div className="absolute top-2 right-2 text-[10px] text-amber-500/50 font-mono font-bold">★</div>
                    
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-orange-400 text-slate-950 font-black text-2xl sm:text-3xl flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-110 transition">
                      {door.id}
                    </div>
                    <span className="text-[11px] sm:text-xs font-extrabold text-amber-300 mt-2 uppercase tracking-widest">
                      Ô SỐ {door.id}
                    </span>
                  </div>

                  {/* MẶT SAU: Ô CỬA ĐÃ LẬT MỞ (Hiện phần thưởng) */}
                  <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-3xl bg-slate-950 border-2 border-slate-700 shadow-2xl flex flex-col items-center justify-center p-3 text-center">
                    <div className="mb-1">
                      {door.isLoseTurn && <XCircle className="w-8 h-8 text-rose-500" />}
                      {door.isLucky && <Gift className="w-8 h-8 text-emerald-400 animate-bounce" />}
                      {door.rewardType === 'TREASURE' && <Gem className="w-8 h-8 text-cyan-400 animate-pulse" />}
                      {door.isDouble && <Zap className="w-8 h-8 text-yellow-400 animate-pulse" />}
                      {!door.isLoseTurn && !door.isLucky && !door.isDouble && door.rewardType !== 'TREASURE' && (
                        <Trophy className="w-7 h-7 text-amber-400" />
                      )}
                    </div>
                    <div className="text-xs sm:text-sm font-black text-white leading-tight">
                      {door.title}
                    </div>
                    <span className="text-[10px] text-slate-500 font-semibold mt-1">ĐÃ MỞ</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Bar: Quick MC Instructions & Exit Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="font-bold text-amber-400">Phím tắt MC:</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">A/B/C/D</span> chọn đáp án •
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">Space</span> đếm giờ •
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">Enter</span> tiếp tục
        </div>

        <button
          onClick={onExitGame}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
        >
          <Home className="w-4 h-4 text-amber-400" />
          <span>Thoát ra Menu</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: BẢN CHIẾU CÂU HỎI TRÊN MÁY CHIẾU (FOCUSED PROJECTOR VIEW)         */}
      {/* ========================================================================= */}
      {activeQuestion && selectedDoor && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 border-2 border-amber-500 rounded-3xl w-full max-w-4xl p-5 sm:p-8 shadow-2xl space-y-6 relative">
            
            {/* Top Row: Door Info, Reward Badge & Countdown Timer */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg">
                  {selectedDoor.id}
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Ô SỐ {selectedDoor.id} • PHẦN THƯỞNG:
                  </div>
                  <div className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <span>{selectedDoor.title}</span>
                    {selectedDoor.isDouble && (
                      <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-400 text-yellow-300 text-xs font-black">
                        X2 ĐIỂM!
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Đồng hồ đếm ngược */}
              {initialTimerSeconds > 0 && (
                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl border-2 font-mono font-black text-lg sm:text-2xl transition ${
                      timeLeft <= 5 && timeLeft > 0
                        ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-ping'
                        : 'bg-slate-950 border-amber-500/50 text-amber-400'
                    }`}
                  >
                    <Clock className="w-5 h-5 text-amber-400" />
                    <span>{timeLeft}s</span>
                  </div>

                  {/* Nút tạm dừng / bắt đầu đếm giờ */}
                  <button
                    onClick={() => setIsTimerRunning(prev => !prev)}
                    title="Bắt đầu / Tạm dừng đếm giờ (Phím Space)"
                    className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition"
                  >
                    {isTimerRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                </div>
              )}
            </div>

            {/* Speaking Audio Indicator */}
            {isSpeaking && (
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 animate-pulse">
                <Volume2 className="w-4 h-4 animate-bounce" />
                <span>MC Gemini đang đọc... (Nhạc nền tự động hạ âm lượng)</span>
              </div>
            )}

            {/* Nội dung câu hỏi: Chữ tối thiểu 32px trên máy chiếu theo yêu cầu */}
            <div className="space-y-2">
              <div className="text-xs font-black text-amber-400 tracking-wider uppercase">
                CÂU HỎI SỐ {activeQuestion.index}:
              </div>
              <div 
                id="active-question-text"
                className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-relaxed"
                style={{ minHeight: '4rem' }}
              >
                {activeQuestion.question}
              </div>
            </div>

            {/* Ảnh minh họa đính kèm (nếu có) */}
            {activeQuestion.image && (
              <div className="flex justify-center p-2.5 bg-slate-950/80 rounded-2xl border border-slate-800 max-h-60 sm:max-h-80 overflow-hidden">
                <img 
                  src={activeQuestion.image} 
                  alt={`Hình minh họa câu ${activeQuestion.index}`} 
                  className="max-h-56 sm:max-h-72 w-auto object-contain rounded-xl shadow-xl border border-slate-800"
                />
              </div>
            )}

            {/* 4 Phương án A, B, C, D: Nút lớn, dễ đọc từ xa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
              {activeQuestion.options.map((opt) => {
                const isSelected = selectedAnswer === opt.key;
                const isCorrect = activeQuestion.answer === opt.key;

                let btnClass = 'bg-slate-950/80 border-slate-800 text-slate-200 hover:border-amber-400 hover:bg-slate-900';
                if (isAnswerRevealed) {
                  if (isCorrect) {
                    // Đáp án đúng nảy lên màu xanh
                    btnClass = 'bg-emerald-950 border-emerald-400 text-emerald-200 font-black shadow-lg shadow-emerald-500/30 scale-[1.02]';
                  } else if (isSelected && !isCorrect) {
                    // Đáp án sai rung màu đỏ
                    btnClass = 'bg-rose-950 border-rose-500 text-rose-200 font-bold';
                  } else {
                    btnClass = 'bg-slate-950/40 border-slate-900 text-slate-600';
                  }
                } else if (isSelected) {
                  btnClass = 'bg-amber-500/20 border-amber-400 text-white font-bold';
                }

                return (
                  <button
                    key={`opt-${opt.key}`}
                    onClick={() => handleAnswerSelect(opt.key)}
                    disabled={isAnswerRevealed}
                    className={`p-4 sm:p-5 rounded-2xl border-2 text-left flex items-center gap-3 transition duration-200 cursor-pointer ${btnClass}`}
                  >
                    <span
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base sm:text-lg shrink-0 ${
                        isAnswerRevealed && isCorrect
                          ? 'bg-emerald-400 text-slate-950'
                          : isAnswerRevealed && isSelected && !isCorrect
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-800 text-amber-400'
                      }`}
                    >
                      {opt.key}
                    </span>
                    <span className="text-base sm:text-lg font-semibold flex-1 leading-snug">
                      {opt.text}
                    </span>
                    {isAnswerRevealed && isCorrect && (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Lời giải thích và Nút tiếp tục sau khi công bố kết quả */}
            {isAnswerRevealed && (
              <div className="space-y-4 pt-3 border-t border-slate-800 animate-in fade-in duration-300">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-sm sm:text-base text-slate-300 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-amber-400">Lời nhận xét & Giải thích: </span>
                    <span>{activeQuestion.explanation || `Đáp án đúng là phương án ${activeQuestion.answer}.`}</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    id="btn-next-turn"
                    onClick={handleNextTurn}
                    className="px-8 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-base shadow-xl shadow-amber-500/20 transition flex items-center gap-2 cursor-pointer"
                  >
                    <span>Lượt tiếp theo (Enter)</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: THÔNG BÁO Ô ĐẶC BIỆT (MAY MẮN HOẶC MẤT LƯỢT)                    */}
      {/* ========================================================================= */}
      {specialAnnouncement && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl w-full max-w-lg p-8 text-center space-y-6 shadow-2xl">
            <div className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center">
              {specialAnnouncement.type === 'LUCKY' ? (
                <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center animate-bounce">
                  <Gift className="w-10 h-10" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border border-rose-500/40 text-rose-500 flex items-center justify-center animate-pulse">
                  <XCircle className="w-10 h-10" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white">
                {specialAnnouncement.title}
              </h3>
              <p className="text-base text-slate-300">
                {specialAnnouncement.description}
              </p>
            </div>

            <button
              onClick={handleNextTurn}
              className="px-8 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-base shadow-xl shadow-amber-500/20 transition cursor-pointer"
            >
              Chuyển sang lượt tiếp theo (Enter)
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: TỔNG KẾT & XẾP HẠNG (VICTORY & RANKING)                          */}
      {/* ========================================================================= */}
      {isGameOver && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-in zoom-in-95 duration-300">
          <div className="bg-gradient-to-b from-slate-900 to-indigo-950 border-2 border-amber-500 rounded-3xl w-full max-w-2xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
            
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/30">
              <Trophy className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-black uppercase tracking-widest text-amber-400">
                KẾT THÚC 12 Ô CỬA BÍ MẬT
              </div>
              <h3 className="text-3xl sm:text-4xl font-black text-white">
                {mode === 'CLASSROOM' ? 'BẢNG XẾP HẠNG CHUNG CUỘC' : 'TỔNG KẾT BUỔI TỰ LUYỆN'}
              </h3>
            </div>

            {/* Chế độ Lớp học: Xếp hạng các đội */}
            {mode === 'CLASSROOM' ? (
              <div className="space-y-3 py-2">
                {sortedTeams.map((team, rank) => {
                  return (
                    <div
                      key={`rank-${team.id}`}
                      className={`p-4 rounded-2xl border flex items-center justify-between ${
                        rank === 0
                          ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/10 border-amber-400 font-bold'
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                          rank === 0 ? 'bg-amber-400 text-slate-950' : rank === 1 ? 'bg-slate-300 text-slate-950' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {rank + 1}
                        </span>
                        <span className="text-2xl">{team.avatar}</span>
                        <span className="font-bold text-white text-base sm:text-lg">{team.name}</span>
                        {rank === 0 && <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">QUÁN QUÂN 🏆</span>}
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-amber-400">
                        {team.score} Điểm
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Chế độ Tự Luyện: Bảng tổng kết đúng/sai */
              <div className="space-y-4 py-2 text-left">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-around text-center">
                  <div>
                    <div className="text-xs text-slate-400 font-semibold">Tổng điểm đạt được</div>
                    <div className="text-2xl font-black text-amber-400">{teams[0]?.score || 0} Điểm</div>
                  </div>
                  <div className="h-8 w-px bg-slate-800" />
                  <div>
                    <div className="text-xs text-slate-400 font-semibold">Số câu đúng</div>
                    <div className="text-2xl font-black text-emerald-400">{soloHistoryRecord.correctAnswers} / 12</div>
                  </div>
                </div>

                {/* Danh sách câu xem lại */}
                {soloHistoryRecord.details.length > 0 && (
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Xem lại kết quả từng câu:
                    </div>
                    {soloHistoryRecord.details.map((detail, dIdx) => (
                      <div
                        key={`detail-${dIdx}`}
                        className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                          detail.isRight ? 'bg-emerald-950/30 border-emerald-800/60' : 'bg-rose-950/30 border-rose-800/60'
                        }`}
                      >
                        <span className="truncate flex-1 text-slate-200">{detail.question}</span>
                        <div className="shrink-0 flex items-center gap-1.5 font-bold">
                          <span>Bạn chọn: {detail.chosen}</span>
                          {detail.isRight ? (
                            <span className="text-emerald-400 font-black">✓ Đúng</span>
                          ) : (
                            <span className="text-rose-400 font-black">✗ (Đúng là {detail.correct})</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons: Chơi Lại hoặc Đổi Trò Chơi */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-slate-800">
              <button
                id="btn-replay-game"
                onClick={initGame}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Chơi Lại Trò Này</span>
              </button>
              
              <button
                id="btn-change-game"
                onClick={onExitGame}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 transition cursor-pointer"
              >
                <Home className="w-4 h-4 text-amber-400" />
                <span>Đổi Trò Chơi Khác</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
