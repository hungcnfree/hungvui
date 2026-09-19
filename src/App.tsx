/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SettingsModal } from './components/SettingsModal';
import { QuestionInputScreen } from './components/screens/QuestionInputScreen';
import { AudioPrepScreen } from './components/screens/AudioPrepScreen';
import { ModeSelectScreen } from './components/screens/ModeSelectScreen';
import { SecretDoorGame } from './components/games/SecretDoorGame';
import { Question, Team, GameMode, GameType, VoiceSettings } from './types';
import { loadQuestions, saveQuestions, loadTeams, saveTeams, loadVoiceSettings } from './services/storage';
import { parseVietnameseQuestions } from './services/parser';
import { SAMPLE_QUESTIONS_RAW_TEXT } from './data/sampleQuestions';
import { soundEngine } from './services/soundEngine';

type ScreenState = 'INPUT' | 'PREP' | 'MODE_SELECT' | 'GAME';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('INPUT');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isBgmOn, setIsBgmOn] = useState<boolean>(false);

  // Dữ liệu câu hỏi
  const [questions, setQuestions] = useState<Question[]>(() => {
    const saved = loadQuestions();
    if (saved.length > 0) return saved;
    // Mặc định nạp sẵn 10 câu mẫu Công nghệ 8 để giáo viên có thể trải nghiệm ngay
    const initialParsed = parseVietnameseQuestions(SAMPLE_QUESTIONS_RAW_TEXT);
    saveQuestions(initialParsed);
    return initialParsed;
  });

  // Dữ liệu cài đặt giọng đọc & API key
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => loadVoiceSettings());

  // Dữ liệu các đội chơi
  const [teams, setTeams] = useState<Team[]>(() => {
    const saved = loadTeams();
    if (saved.length > 0) return saved;
    const defaults: Team[] = [
      { id: 'team-1', name: 'Đội Sao Kim', color: '#f59e0b', score: 0, avatar: '⚡' },
      { id: 'team-2', name: 'Đội Sao Hỏa', color: '#ef4444', score: 0, avatar: '🔥' },
    ];
    saveTeams(defaults);
    return defaults;
  });

  // Cấu hình trò chơi
  const [gameMode, setGameMode] = useState<GameMode>('CLASSROOM');
  const [gameType, setGameType] = useState<GameType>('SECRET_DOOR');
  const [timerSeconds, setTimerSeconds] = useState<number>(20);

  // Xử lý bật/tắt toàn bộ âm thanh
  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    soundEngine.setMute(newMuted);
  };

  // Xử lý bật/tắt nhạc nền BGM
  const handleToggleBgm = () => {
    if (isBgmOn) {
      soundEngine.stopBgm();
      setIsBgmOn(false);
    } else {
      soundEngine.startBgm();
      setIsBgmOn(true);
    }
  };

  // Điều hướng từ Bước 1 sang Bước 2
  const handleQuestionsConfirmed = (newQuestions: Question[]) => {
    setQuestions(newQuestions);
    saveQuestions(newQuestions);
    setCurrentScreen('PREP');
  };

  // Bắt đầu màn chơi trò chơi
  const handleStartGame = (mode: GameMode, type: GameType, timer: number) => {
    setGameMode(mode);
    setGameType(type);
    setTimerSeconds(timer);
    setCurrentScreen('GAME');
    if (!isBgmOn) {
      soundEngine.startBgm();
      setIsBgmOn(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Thanh công cụ Gameshow Header */}
      <Header
        currentScreen={currentScreen}
        onNavigate={(screen) => setCurrentScreen(screen)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        isBgmOn={isBgmOn}
        onToggleBgm={handleToggleBgm}
      />

      {/* Vùng hiển thị màn hình hiện tại */}
      <main className="flex-1 flex flex-col">
        {currentScreen === 'INPUT' && (
          <QuestionInputScreen
            questions={questions}
            onQuestionsConfirmed={handleQuestionsConfirmed}
          />
        )}

        {currentScreen === 'PREP' && (
          <AudioPrepScreen
            questions={questions}
            voiceSettings={voiceSettings}
            onQuestionsUpdated={(updated) => setQuestions(updated)}
            onBack={() => setCurrentScreen('INPUT')}
            onContinue={() => setCurrentScreen('MODE_SELECT')}
          />
        )}

        {currentScreen === 'MODE_SELECT' && (
          <ModeSelectScreen
            teams={teams}
            onTeamsChange={(newTeams) => setTeams(newTeams)}
            onStartGame={handleStartGame}
          />
        )}

        {currentScreen === 'GAME' && gameType === 'SECRET_DOOR' && (
          <SecretDoorGame
            questions={questions}
            teams={teams}
            mode={gameMode}
            timerSeconds={timerSeconds}
            voiceSettings={voiceSettings}
            onExitGame={() => setCurrentScreen('MODE_SELECT')}
          />
        )}
      </main>

      {/* Modal Cài Đặt Giọng Đọc & API Key */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={(newSettings) => setVoiceSettings(newSettings)}
      />
    </div>
  );
}
