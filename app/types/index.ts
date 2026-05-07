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

export interface StudentProfile {
  id: string;
  full_name: string;
  username: string;
  age: number;
  avatar: string | null;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  student: StudentProfile;
}

export interface RegisterPayload {
  full_name: string;
  username: string;
  password: string;
  age: number;
  avatar?: string;
}

export interface GameSessionPayload {
  studentId: string;
  gameType: GameType;
  accuracy: number;
  responseTime: number;
  attempts: number;
  engagementScore: number;
  timestamp: string;
}

export interface ProgressData {
  student_id: string;
  total_stars: number;
  games_played: number;
  current_level: number;
  streak_days: number;
  last_played: string | null;
  updated_at: string;
}

export interface DailyChallengeConfig {
  targetQuestions: number;
  timeLimitSeconds: number;
  showHints: boolean;
  rewardStars: number;
}

export interface DailyChallengeResponse {
  gameType: GameType;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  config: DailyChallengeConfig;
}