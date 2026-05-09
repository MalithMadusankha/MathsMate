import { JSX } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, Platform } from 'react-native';
import { BorderRadius, Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { useTheme } from '../../context/ThemeContext';

interface GameTopBarProps {
  title: string;
  subtitle: string;
  lives: number;
  maxLives: number;
  onBack: () => void;
}

const GameTopBar = ({
  title,
  subtitle,
  lives,
  maxLives,
  onBack,
}: GameTopBarProps): JSX.Element => {
  const { colors } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.primary }]}> 
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBack}
        accessibilityLabel="Go back"
      >
        <Text style={styles.backBtnText}>←</Text>
      </TouchableOpacity>

      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.livesRow}>
        {Array.from({ length: maxLives }).map((_, i) => (
          <Text key={i} style={styles.heart}>
            {i < lives ? '❤️' : '🖤'}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    paddingTop: Platform.OS === 'android' ? Spacing.xl + 8 : Spacing.xl,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold as any,
  },
  titleWrap: { flex: 1 },
  title: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: FontWeight.extraBold as any,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold as any,
  },
  livesRow: {
    flexDirection: 'row',
    gap: 3,
  },
  heart: { fontSize: FontSize.md },
});

export default GameTopBar;