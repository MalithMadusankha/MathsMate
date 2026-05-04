// Defines all route names and their params in one place.
// Any screen that uses navigation will import from here.

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Progress: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};