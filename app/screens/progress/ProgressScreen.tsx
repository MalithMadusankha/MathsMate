// app/screens/progress/ProgressScreen.tsx
import { View, Text, StyleSheet } from 'react-native';
import { JSX } from 'react';
import { LightColors } from '../../constants/colors';

const ProgressScreen = (): JSX.Element => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Progress Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: LightColors.background,
  },
  text: {
    color: LightColors.textPrimary,
    fontSize: 18,
  },
});

export default ProgressScreen;