/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface QuestionOption {
  key: OptionKey;
  text: string;
}

export interface Question {
  id: string;
  index: number;
  question: string;
  options: QuestionOption[];
  answer: OptionKey;
  explanation: string;
  isValid: boolean;
  errorReason?: string;
  isAiExplanation?: boolean;
  image?: string; // URL hoặc Data URL ảnh đính kèm (sơ đồ mạch điện, bản vẽ kỹ thuật, dụng cụ...)
}

export type VoiceName = 'Kore' | 'Puck' | 'Leda' | 'Sulafat';

export interface VoiceSettings {
  questionVoice: VoiceName;   // Mặc định Kore: dứt khoát, trang trọng
  narratorVoice: VoiceName;   // Mặc định Puck: hoạt náo, sôi nổi
  customApiKey: string;
}

export type GameMode = 'CLASSROOM' | 'SOLO';

export type GameType = 'SECRET_DOOR' | 'WHEEL_OF_FORTUNE' | 'GOLDEN_BELL' | 'MILLIONAIRE';

export interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
  avatar: string;
}

// Các loại phần thưởng trong 12 ô cửa bí mật
// Giáo viên có thể tùy biến giá trị điểm số ở đây
export type DoorRewardType =
  | 'SCORE_10'      // 10 điểm
  | 'SCORE_20'      // 20 điểm
  | 'SCORE_30'      // 30 điểm
  | 'DOUBLE'        // Nhân đôi điểm câu này
  | 'LUCKY'         // May mắn: cộng điểm ngay không cần trả lời
  | 'LOSE_TURN'     // Mất lượt
  | 'TREASURE';     // Kho báu: 50 điểm

export interface DoorItem {
  id: number;              // 1 đến 12
  rewardType: DoorRewardType;
  title: string;           // Tên hiển thị (ví dụ: "+20 Điểm", "Nhân đôi", "May mắn")
  points: number;          // Điểm cơ bản
  isDouble?: boolean;      // Có nhân đôi câu hỏi này không
  isLucky?: boolean;       // May mắn nhận điểm luôn
  isLoseTurn?: boolean;    // Mất lượt
  questionId?: string;     // Gán câu hỏi
  isOpened: boolean;
  openedByTeamId?: string;
  isCorrect?: boolean;
}

export interface SoloHistoryItem {
  date: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
}
