import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Progress: undefined;
};

export type GameStackParamList = {
  CountingGame:   { difficulty?: 'easy' | 'medium' | 'hard' };
  ComparisonGame: { difficulty?: 'easy' | 'medium' | 'hard' };
  ArithmeticGame: { difficulty?: 'easy' | 'medium' | 'hard' };
  StoryGame:      { difficulty?: 'easy' | 'medium' | 'hard' };
};

export type RootStackParamList = {
  Auth:  undefined;
  Main:  undefined;
  Games: NavigatorScreenParams<GameStackParamList>;
};