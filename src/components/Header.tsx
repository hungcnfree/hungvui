/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Volume2, VolumeX, Music, Settings, ArrowLeft, Tv } from 'lucide-react';
import { soundEngine } from '../services/soundEngine';

interface HeaderProps {
  currentScreen: 'INPUT' | 'PREP' | 'MODE_SELECT' | 'GAME';
  onNavigate: (screen: 'INPUT' | 'PREP' | 'MODE_SELECT' | 'GAME') => void;
  onOpenSettings: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isBgmOn: boolean;
  onToggleBgm: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigate,
  onOpenSettings,
  isMuted,
  onToggleMute,
  isBgmOn,
  onToggleBgm,
}) => {
  return (
    <header className="w-full bg-slate-950/80 backdrop-blur-md border-b border-amber-500/20 px-4 py-3 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: App Brand & Navigation */}
        <div className="flex items-center gap-3">
          {currentScreen !== 'INPUT' && (
            <button
              id="btn-back-menu"
              onClick={() => {
                soundEngine.playTick(1.2);
                if (currentScreen === 'GAME') {
                  if (confirm('Bạn có chắc chắn muốn thoát khỏi màn chơi và trở về menu chọn trò chơi?')) {
                    onNavigate('MODE_SELECT');
                  }
                } else if (currentScreen === 'MODE_SELECT') {
                  onNavigate('PREP');
                } else if (currentScreen === 'PREP') {
                  onNavigate('INPUT');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold transition"
            >
              <ArrowLeft className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Quay lại</span>
            </button>
          )}

          <div 
            onClick={() => onNavigate('INPUT')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition">
              <Tv className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-widest text-amber-400 uppercase bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/30">
                  GAMESHOW TRUYỀN HÌNH
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white group-hover:text-amber-300 transition">
                LỚP HỌC VUI <span className="text-amber-400 font-extrabold text-sm sm:text-base">— CÔNG NGHỆ 8/9</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Right: Sound Controls & Settings */}
        <div className="flex items-center gap-2">
          {/* Nút Bật/Tắt Nhạc Nền BGM */}
          <button
            id="btn-toggle-bgm"
            onClick={onToggleBgm}
            title={isBgmOn ? 'Tắt nhạc nền' : 'Bật nhạc nền trò chơi'}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition ${
              isBgmOn
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-md shadow-amber-500/10'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Music className={`w-4 h-4 ${isBgmOn ? 'animate-pulse text-amber-400' : ''}`} />
            <span className="hidden md:inline">Nhạc nền</span>
          </button>

          {/* Nút Tắt/Mở toàn bộ âm thanh */}
          <button
            id="btn-toggle-mute"
            onClick={onToggleMute}
            title={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
            className={`p-2 rounded-xl text-sm font-semibold border transition ${
              isMuted
                ? 'bg-rose-950/50 border-rose-600/50 text-rose-400'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
          </button>

          {/* Cài đặt giọng đọc & API Key */}
          <button
            id="btn-open-settings"
            onClick={onOpenSettings}
            title="Cài đặt giọng đọc và API Key"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Cài đặt</span>
          </button>
        </div>
      </div>
    </header>
  );
};
