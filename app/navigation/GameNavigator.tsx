import React, { JSX } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GameStackParamList } from './types';
import CountingGameScreen from '../screens/games/CountingGameScreen';
import ComparisonGameScreen from '../screens/games/ComparisonGameScreen';
import ArithmeticGameScreen from '../screens/games/ArithmeticGameScreen';
import PuzzleGameScreen from '../screens/games/PuzzleGameScreen';
import SequenceGameScreen from '../screens/games/SequenceGameScreen';
import DragDropGameScreen from '../screens/games/DragDropGameScreen';
// Add more game screens here as you build them
const Stack = createNativeStackNavigator<GameStackParamList>();

const GameNavigator = (): JSX.Element => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CountingGame" component={CountingGameScreen} />
      <Stack.Screen name="ComparisonGame" component={ComparisonGameScreen} />
      <Stack.Screen name="ArithmeticGame" component={ArithmeticGameScreen} />
      <Stack.Screen name="PuzzleGame" component={PuzzleGameScreen} />
      <Stack.Screen name="SequenceGame" component={SequenceGameScreen} />
      <Stack.Screen name="DragDropGame" component={DragDropGameScreen} />
      {/* <Stack.Screen name="StoryGame" component={StoryGameScreen} /> */}
     
    </Stack.Navigator>
  );
};

export default GameNavigator;