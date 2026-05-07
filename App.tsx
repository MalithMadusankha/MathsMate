import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './app/context/AuthContext';
import { ThemeProvider } from './app/context/ThemeContext';
import AppNavigator from './app/navigation/AppNavigator';
import { JSX } from 'react';

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  );
}