import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';
import { JSX } from 'react';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Root navigator — both Auth and Main flows are always registered so
// direct navigation works without a conditional.
// TODO: When backend auth is ready, add an AuthContext here and
//       conditionally render only the appropriate stack so unauthenticated
//       users cannot reach the Main tab navigator.
const AppNavigator = (): JSX.Element => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Auth">
      <Stack.Screen name="Auth" component={AuthNavigator} />
      <Stack.Screen name="Main" component={TabNavigator} />
    </Stack.Navigator>
  );
};

export default AppNavigator;