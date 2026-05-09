import { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { BorderRadius, Shadow, Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface GameStatChipProps {
  value: string;
  label: string;
}

const GameStatChip = ({ value, label }: GameStatChipProps): JSX.Element => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.surface,
          borderColor: colors.cardBorder,
          ...Shadow.small,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <Text style={[styles.value, { color: colors.primary }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 2,
  },
  value: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.extraBold as any,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold as any,
  },
});

export default GameStatChip;