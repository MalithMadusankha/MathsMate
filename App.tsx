import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from './app/context/ThemeContext';
import AppNavigator from './app/navigation/AppNavigator';
import { JSX } from 'react';

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </ThemeProvider>
  );
}