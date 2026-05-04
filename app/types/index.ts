// Central place for all shared data types across the app

export type StudentLevel = 'struggling' | 'average' | 'advanced' | 'disengaged';

export type GameType =
  | 'counting'
  | 'comparison'
  | 'arithmetic'
  | 'puzzle'
  | 'sequence'
  | 'dragdrop'
  | 'timechallenge'
  | 'story';

export interface Student {
  id: string;
  name: string;
  age: number;
  level: StudentLevel;
}

export interface GameSession {
  studentId: string;
  gameType: GameType;
  accuracy: number;
  responseTime: number;
  attempts: number;
  engagementScore: number;
  timestamp: string;
}

export interface AdaptResponse {
  nextGameType: GameType;
  difficulty: 'easy' | 'medium' | 'hard';
  showHints: boolean;
}