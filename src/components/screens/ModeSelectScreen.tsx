/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Users, 
  User, 
  Clock, 
  Play, 
  Sparkles, 
  DoorClosed, 
  Disc, 
  Bell, 
  Award,
  Trophy,
  Sliders,
  Check,
  Zap
} from 'lucide-react';
import { GameMode, GameType, Team } from '../../types';
import { getSoloHighScore, saveTeams } from '../../services/storage';
import { soundEngine } from '../../services/soundEngine';

interface ModeSelectScreenProps {
  teams: Team[];
  onTeamsChange: (teams: Team[]) => void;
  onStartGame: (mode: GameMode, gameType: GameType, timerSeconds: number) => void;
}

export const ModeSelectScreen: React.FC<ModeSelectScreenProps> = ({
  teams,
  onTeamsChange,
  onStartGame,
}) => {
  const [mode, setMode] = useState<GameMode>('CLASSROOM');
  const [teamCount, setTeamCount] = useState<number>(teams.length > 0 ? Math.min(4, Math.max(2, teams.length)) : 2);
  const [timerSeconds, setTimerSeconds] = useState<number>(20); // 10, 20, 30, hoặc 0 (không giới hạn)
  const [selectedGame, setSelectedGame] = useState<GameType>('SECRET_DOOR');
  const soloHighScore = getSoloHighScore();

  // Xử lý thay đổi số đội (2-4 đội)
  const handleTeamCountChange = (count: number) => {
    soundEngine.playTick(1.0);
    setTeamCount(count);
    const defaultAvatars = ['⚡', '🔥', '🌿', '🚀'];
    const defaultColors = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6'];
    const defaultNames = ['Đội Sao Kim', 'Đội Sao Hỏa', 'Đội Sao Mộc', 'Đội Sao Băng'];

    const newTeams: Team[] = [];
    for (let i = 0; i < count; i++) {
      newTeams.push({
        id: `team-${i + 1}`,
        name: teams[i]?.name || defaultNames[i],
        color: teams[i]?.color || defaultColors[i],
        score: 0,
        avatar: teams[i]?.avatar || defaultAvatars[i],
      });
    }
    onTeamsChange(newTeams);
    saveTeams(newTeams);
  };

  const handleUpdateTeamName = (index: number, newName: string) => {
    const updated = [...teams];
    if (updated[index]) {
      updated[index].name = newName;
      onTeamsChange(updated);
      saveTeams(updated);
    }
  };

  const handleLaunch = (gameType: GameType) => {
    soundEngine.playDoorOpen();
    onStartGame(mode, gameType, timerSeconds);
  };

  const timerOptions = [
    { value: 10, label: '10 Giây', sub: 'Chớp nhoáng' },
    { value: 20, label: '20 Giây', sub: 'Chuẩn THCS' },
    { value: 30, label: '30 Giây', sub: 'Thoải mái' },
    { value: 0, label: 'Vô hạn', sub: 'Giáo viên tự bấm' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Top Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wider uppercase">
          <Sparkles className="w-3.5 h-3.5" />
          Bước 3: Thiết Lập Sân Khấu & Chọn Trò Chơi
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Chọn Chế Độ & Trò Chơi Truyền Hình
        </h2>
        <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
          Tối ưu hoàn hảo cho máy chiếu lớp học với bảng điểm các đội hoặc điện thoại tự luyện cá nhân.
        </p>
      </div>

      {/* Part 1: Chọn Chế Độ (Classroom vs Solo) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Chế độ Lớp học */}
        <div
          onClick={() => {
            soundEngine.playTick(1.0);
            setMode('CLASSROOM');
          }}
          className={`p-6 rounded-3xl border-2 cursor-pointer transition relative overflow-hidden ${
            mode === 'CLASSROOM'
              ? 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-blue-950/40 border-amber-500 shadow-2xl shadow-amber-500/10'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 opacity-75'
          }`}
        >
          {mode === 'CLASSROOM' && (
            <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
              <Check className="w-4 h-4" />
            </div>
          )}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Chế Độ Lớp Học (Máy chiếu 16:9)</h3>
              <p className="text-xs text-amber-400/90 font-medium">Chiếu bảng lớn, chia 2-4 đội thi đấu</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            Bảng điểm các đội luôn hiển thị nổi bật bên cạnh sân khấu. Giáo viên làm MC điều khiển bằng chuột 
            hoặc phím tắt bàn phím (A/B/C/D, Space đếm giờ, Enter tiếp tục).
          </p>

          {/* Config Đội chơi khi ở Classroom Mode */}
          {mode === 'CLASSROOM' && (
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Số lượng đội thi đấu:</span>
                <div className="flex gap-1.5">
                  {[2, 3, 4].map((cnt) => (
                    <button
                      key={`cnt-${cnt}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTeamCountChange(cnt);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                        teamCount === cnt
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      {cnt} Đội
                    </button>
                  ))}
                </div>
              </div>

              {/* Tên các đội */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {teams.slice(0, teamCount).map((team, idx) => (
                  <div
                    key={team.id}
                    className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2"
                  >
                    <span className="text-base">{team.avatar}</span>
                    <input
                      type="text"
                      value={team.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleUpdateTeamName(idx, e.target.value)}
                      className="bg-transparent text-xs font-bold text-white focus:outline-none w-full border-b border-transparent focus:border-amber-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chế độ Tự Luyện */}
        <div
          onClick={() => {
            soundEngine.playTick(1.0);
            setMode('SOLO');
          }}
          className={`p-6 rounded-3xl border-2 cursor-pointer transition relative overflow-hidden ${
            mode === 'SOLO'
              ? 'bg-gradient-to-br from-blue-950/40 via-slate-900 to-purple-950/40 border-blue-500 shadow-2xl shadow-blue-500/10'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 opacity-75'
          }`}
        >
          {mode === 'SOLO' && (
            <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-blue-500 text-slate-950 flex items-center justify-center font-bold">
              <Check className="w-4 h-4" />
            </div>
          )}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Chế Độ Tự Luyện (Cá Nhân)</h3>
              <p className="text-xs text-blue-400/90 font-medium">Học sinh tự rèn luyện trên máy tính / điện thoại</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            Chơi một mình tính điểm tích lũy, có lưu kỷ lục điểm cao nhất. Cuối màn chơi sẽ có bảng tổng kết 
            chi tiết câu nào làm đúng, câu nào làm sai kèm lời giải thích để học sinh ghi nhớ.
          </p>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-semibold text-slate-300">Kỷ lục điểm cao của bạn:</span>
            </div>
            <span className="text-sm font-black text-amber-400">{soloHighScore} Điểm</span>
          </div>
        </div>
      </div>

      {/* Part 2: Cài Đặt Thời Gian Trả Lời */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Thời Gian Trả Lời Mỗi Câu</div>
            <div className="text-xs text-slate-400">Có tiếng tích tắc đếm ngược dồn dập ở 5 giây cuối</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {timerOptions.map((opt) => (
            <button
              key={`timer-${opt.value}`}
              onClick={() => {
                soundEngine.playTick(1.1);
                setTimerSeconds(opt.value);
              }}
              className={`px-3 py-2 rounded-xl text-center border transition ${
                timerSeconds === opt.value
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md shadow-amber-500/20'
                  : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-bold">{opt.label}</div>
              <div className={`text-[10px] ${timerSeconds === opt.value ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                {opt.sub}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Part 3: Chọn 1 trong 4 Trò Chơi Truyền Hình */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Danh Sách Trò Chơi Gameshow
            </h3>
            <p className="text-xs text-slate-400">Chọn trò chơi bạn muốn khởi động cùng học sinh</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Game 1: Ô CỬA BÍ MẬT (Hoàn chỉnh 100%) */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/50 to-slate-900 border-2 border-amber-500 shadow-xl relative overflow-hidden group">
            <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 text-[11px] font-black uppercase tracking-wider">
              ĐÃ SẴN SÀNG CHƠI
            </div>

            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition">
                <DoorClosed className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-black text-white group-hover:text-amber-300 transition">
                  1. Ô Cửa Bí Mật
                </h4>
                <p className="text-xs text-amber-400 font-medium">12 Ô Cửa 3D • Phần Thưởng Bất Ngờ</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-5">
              Lưới 12 ô số lật mở 3D ẩn chứa phần thưởng kịch tính: Điểm thường (10, 20, 30đ), Nhân đôi điểm, 
              May mắn nhận điểm ngay, Mất lượt và Kho báu 50 điểm! Trả lời đúng nhận pháo hoa, sai bị trừ lượt.
            </p>

            <button
              id="btn-launch-secret-door"
              onClick={() => handleLaunch('SECRET_DOOR')}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Vào Chơi "Ô Cửa Bí Mật" Ngay</span>
            </button>
          </div>

          {/* Game 2: VÒNG QUAY MAY MẮN (Giai đoạn 2) */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 relative overflow-hidden opacity-80">
            <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-[11px] font-bold">
              Giai đoạn 2
            </div>

            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 text-blue-400 flex items-center justify-center shrink-0">
                <Disc className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white">2. Vòng Quay May Mắn</h4>
                <p className="text-xs text-slate-400">Vòng xoay kim số tích lũy điểm thưởng</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-5">
              Học sinh quay vòng quay điểm số trước khi trả lời câu hỏi. Thử thách vận may với ô Nhân ba, 
              Chia đôi điểm số và vòng xoay giải cứu.
            </p>

            <button
              disabled
              className="w-full py-3 rounded-2xl bg-slate-800/80 text-slate-500 font-bold text-xs cursor-not-allowed"
            >
              Đang mở khóa ở Giai đoạn tiếp theo
            </button>
          </div>

          {/* Game 3: RUNG CHUÔNG VÀNG (Giai đoạn 2) */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 relative overflow-hidden opacity-80">
            <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-[11px] font-bold">
              Giai đoạn 2
            </div>

            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 text-yellow-400 flex items-center justify-center shrink-0">
                <Bell className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white">3. Rung Chuông Vàng</h4>
                <p className="text-xs text-slate-400">Đấu trường sinh tồn dành cho cả lớp</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-5">
              Toàn bộ học sinh cùng giơ bảng trả lời, sai bị loại dần lên khán đài. Có vòng cứu trợ đặc biệt 
              của thầy cô để đưa học sinh trở lại sàn thi đấu.
            </p>

            <button
              disabled
              className="w-full py-3 rounded-2xl bg-slate-800/80 text-slate-500 font-bold text-xs cursor-not-allowed"
            >
              Đang mở khóa ở Giai đoạn tiếp theo
            </button>
          </div>

          {/* Game 4: AI LÀ TRIỆU PHÚ (Giai đoạn 2) */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 relative overflow-hidden opacity-80">
            <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-[11px] font-bold">
              Giai đoạn 2
            </div>

            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 text-emerald-400 flex items-center justify-center shrink-0">
                <Award className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white">4. Ai Là Triệu Phú</h4>
                <p className="text-xs text-slate-400">Thang điểm 15 câu và 3 quyền trợ giúp</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-5">
              Hồi hộp với 3 mốc quan trọng (câu 5, câu 10, câu 15) cùng các quyền trợ giúp: 50/50, 
              Hỏi ý kiến tổ tư vấn tại chỗ và Đổi câu hỏi.
            </p>

            <button
              disabled
              className="w-full py-3 rounded-2xl bg-slate-800/80 text-slate-500 font-bold text-xs cursor-not-allowed"
            >
              Đang mở khóa ở Giai đoạn tiếp theo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
