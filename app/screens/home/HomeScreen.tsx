import { useRef, useEffect, useState, useCallback, JSX } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  StatusBar,
  Platform,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { dailyChallengeApi, progressApi } from '../../services/api';
import { Spacing, BorderRadius, Shadow } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { DailyChallengeResponse, GameType, ProgressData } from '../../types';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
// ─── Types ────────────────────────────────────────────────────────────────────

interface GameCardConfig {
  type: GameType;
  emoji: string;
  title: string;
  description: string;
  accentColor: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  stars: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTY_COLOR: Record<'Easy' | 'Medium' | 'Hard', string> = {
  Easy:   '#22C55E',
  Medium: '#F59E0B',
  Hard:   '#EF4444',
};

// All 8 adaptive game types — maps to the ML engine's game selection
const GAME_CARDS: GameCardConfig[] = [
  { type: 'counting',      emoji: '🔢', title: 'Counting',        description: 'Count objects & numbers',   accentColor: '#6C3DD3', difficulty: 'Easy',   stars: 3 },
  { type: 'comparison',    emoji: '⚖️',  title: 'Comparison',     description: 'Which is bigger?',          accentColor: '#F5A623', difficulty: 'Easy',   stars: 2 },
  { type: 'arithmetic',    emoji: '➕', title: 'Arithmetic',      description: 'Add, subtract & more',      accentColor: '#00C9A7', difficulty: 'Medium', stars: 4 },
  { type: 'puzzle',        emoji: '🧩', title: 'Puzzle',          description: 'Solve math puzzles',        accentColor: '#EF4444', difficulty: 'Medium', stars: 3 },
  { type: 'sequence',      emoji: '🔄', title: 'Sequence',        description: 'Find the missing number',   accentColor: '#3B82F6', difficulty: 'Medium', stars: 2 },
  { type: 'dragdrop',      emoji: '🎯', title: 'Drag & Drop',     description: 'Place numbers correctly',   accentColor: '#8B5CF6', difficulty: 'Easy',   stars: 5 },
  { type: 'timechallenge', emoji: '⏱️', title: 'Time Challenge',  description: 'Race against the clock!',   accentColor: '#F59E0B', difficulty: 'Hard',   stars: 1 },
  { type: 'story',         emoji: '📖', title: 'Story Adventure', description: 'Math through adventures',   accentColor: '#10B981', difficulty: 'Easy',   stars: 4 },
];

// Daily challenge is the featured game card shown prominently at the top
const DAILY_CHALLENGE = GAME_CARDS[2];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatBadgeProps {
  emoji: string;
  value: string;
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
}

const StatBadge = ({ emoji, value, label, colors }: StatBadgeProps): JSX.Element => (
  <View
    style={[
      styles.statBadge,
      {
        backgroundColor: colors.surface,
        borderColor: colors.cardBorder,
        ...Shadow.small,
        shadowColor: colors.shadow,
      },
    ]}
  >
    <Text style={styles.statEmoji}>{emoji}</Text>
    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────

interface GameCardProps {
  config: GameCardConfig;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress: (type: GameType) => void;
}

const GameCard = ({ config, colors, onPress }: GameCardProps): JSX.Element => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: true, speed: 50 }).start();

  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  const stars = Array.from({ length: 5 }, (_, i) =>
    i < config.stars ? '⭐' : '☆'
  ).join('');

  return (
    <Animated.View style={[styles.gameCardWrap, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[
          styles.gameCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.cardBorder,
            ...Shadow.medium,
            shadowColor: config.accentColor,
          },
        ]}
        onPress={() => onPress(config.type)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        accessibilityLabel={`Play ${config.title}`}
      >
        {/* Colored accent bar at top of card */}
        <View style={[styles.cardAccentBar, { backgroundColor: config.accentColor }]} />

        <Text style={styles.cardEmoji}>{config.emoji}</Text>

        <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {config.title}
        </Text>

        <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
          {config.description}
        </Text>

        <View style={styles.cardFooter}>
          <View
            style={[
              styles.diffBadge,
              { backgroundColor: `${DIFFICULTY_COLOR[config.difficulty]}22` },
            ]}
          >
            <Text style={[styles.diffText, { color: DIFFICULTY_COLOR[config.difficulty] }]}>
              {config.difficulty}
            </Text>
          </View>
          <Text style={styles.cardStars}>{stars}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

type HomeNavProp = NativeStackNavigationProp<RootStackParamList>;

// ─── Main Screen ──────────────────────────────────────────────────────────────

const HomeScreen = (): JSX.Element => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { student } = useAuth();
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallengeResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const statsAnim  = useRef(new Animated.Value(0)).current;
  const dailyAnim  = useRef(new Animated.Value(0)).current;
  const gridAnim   = useRef(new Animated.Value(0)).current;
  const floatAnim  = useRef(new Animated.Value(0)).current;

  const loadHomeData = useCallback(async (): Promise<void> => {
    try {
      const [progressResponse, dailyChallengeResponse] = await Promise.all([
        progressApi.getMe(),
        dailyChallengeApi.get(),
      ]);

      setProgress(progressResponse.data);
      setDailyChallenge(dailyChallengeResponse.data);
    } catch {
      // Keep screen usable with fallback display values if the API fails.
    }
  }, []);

  useEffect(() => {
    // Staggered entrance: header → stats → daily → grid
    Animated.stagger(120, [
      Animated.spring(headerAnim, { toValue: 1, tension: 60, friction: 6, useNativeDriver: true }),
      Animated.timing(statsAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(dailyAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(gridAnim,   { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Continuous float for daily challenge emoji
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -7, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,  duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    loadHomeData();
  }, [dailyAnim, floatAnim, gridAnim, headerAnim, loadHomeData, statsAnim]);

  // Shared slide-up + fade-in style for each section
  const slideIn = (anim: Animated.Value, fromY = 20) => ({
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [fromY, 0] }) },
    ],
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

const navigation = useNavigation<HomeNavProp>();

const handleGamePress = (type: GameType): void => {
  switch (type) {
    case 'counting':
      navigation.navigate('Games', {
        screen: 'CountingGame',
        params: { difficulty: 'easy' },
      });
      break;

    case 'comparison':
      navigation.navigate('Games', {
        screen: 'ComparisonGame',
        params: { difficulty: 'easy' },
      });
      break;

    case 'arithmetic':
      navigation.navigate('Games', {
        screen: 'ArithmeticGame',
        params: { difficulty: 'medium' },
      });
      break;

    // case 'story':
    //   navigation.navigate('Games', { screen: 'StoryGame', params: { difficulty: 'easy' } });
    //   break;

    default:
      break;
  }
};

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    await loadHomeData();
    setIsRefreshing(false);
  };

  const dailyChallengeCard =
    (dailyChallenge && GAME_CARDS.find((gameCard) => gameCard.type === dailyChallenge.gameType))
    ?? DAILY_CHALLENGE;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <Animated.View style={[styles.header, slideIn(headerAnim, -20)]}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primaryLight }]}>
              <Text style={styles.avatarEmoji}>🧙‍♂️</Text>
            </View>
            <View>
              <Text style={[styles.greeting, { color: colors.textSecondary }]}>
                Good Morning! 👋
              </Text>
              <Text style={[styles.playerName, { color: colors.textPrimary }]}>
                {student?.full_name ?? 'MathsHero'}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <View style={[styles.streakPill, { backgroundColor: colors.primaryLight }]}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={[styles.streakCount, { color: colors.primary }]}>
                {progress?.streak_days ?? 0}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]}
              onPress={toggleTheme}
              accessibilityLabel="Toggle dark and light mode"
            >
              <Text style={styles.iconBtnText}>{isDark ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Stats Row ─────────────────────────────────────────────── */}
        <Animated.View style={[styles.statsRow, slideIn(statsAnim)]}>
          <StatBadge
            emoji="⭐"
            value={String(progress?.total_stars ?? 0)}
            label="Stars"
            colors={colors}
          />
          <StatBadge
            emoji="🎮"
            value={String(progress?.games_played ?? 0)}
            label="Games"
            colors={colors}
          />
          <StatBadge
            emoji="🏆"
            value={`Level ${progress?.current_level ?? 1}`}
            label="Rank"
            colors={colors}
          />
        </Animated.View>

        {/* ── Daily Challenge ───────────────────────────────────────── */}
        <Animated.View style={slideIn(dailyAnim)}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            🌟 Daily Challenge
          </Text>

          <TouchableOpacity
            style={[
              styles.dailyCard,
              {
                backgroundColor: colors.primary,
                ...Shadow.large,
                shadowColor: colors.primary,
              },
            ]}
            onPress={() => handleGamePress(dailyChallengeCard.type)}
            activeOpacity={0.9}
            accessibilityLabel={`Start daily challenge: ${dailyChallengeCard.title}`}
          >
            <Animated.Text
              style={[styles.dailyEmoji, { transform: [{ translateY: floatAnim }] }]}
            >
              {dailyChallengeCard.emoji}
            </Animated.Text>

            <View style={styles.dailyBody}>
              <View style={styles.dailyNewBadge}>
                <Text style={styles.dailyNewText}>NEW TODAY</Text>
              </View>
              <Text style={styles.dailyTitle}>{dailyChallengeCard.title}</Text>
              <Text style={styles.dailyDesc}>
                {dailyChallenge?.description ?? dailyChallengeCard.description}
              </Text>
            </View>

            <View style={styles.dailyPlayBtn}>
              <Text style={styles.dailyPlayIcon}>▶</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Game Grid ─────────────────────────────────────────────── */}
        <Animated.View style={slideIn(gridAnim, 30)}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            🎮 Choose Your Adventure
          </Text>

          {/* TODO: Highlight recommended game from ML adaptive engine response */}
          <View style={styles.grid}>
            {GAME_CARDS.map((config) => (
              <GameCard
                key={config.type}
                config={config}
                colors={colors}
                onPress={handleGamePress}
              />
            ))}
          </View>
        </Animated.View>

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'android' ? Spacing.xl + 8 : Spacing.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatarCircle: {
    width: 48, height: 48,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji:  { fontSize: 26 },
  greeting:     { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold as any },
  playerName:   { fontSize: FontSize.lg, fontWeight: FontWeight.extraBold as any },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 2,
  },
  streakEmoji: { fontSize: FontSize.sm },
  streakCount: { fontSize: FontSize.sm, fontWeight: FontWeight.extraBold as any },
  iconBtn: {
    width: 36, height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: FontSize.md },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statBadge: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 2,
  },
  statEmoji: { fontSize: FontSize.xl },
  statValue: { fontSize: FontSize.sm, fontWeight: FontWeight.extraBold as any },
  statLabel: { fontSize: FontSize.xs },

  // Section title
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extraBold as any,
    marginBottom: Spacing.md,
  },

  // Daily challenge card
  dailyCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  dailyEmoji: { fontSize: 52 },
  dailyBody:  { flex: 1, gap: Spacing.xs },
  dailyNewBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  dailyNewText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: FontWeight.bold as any,
    letterSpacing: 0.6,
  },
  dailyTitle: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.extraBold as any },
  dailyDesc:  { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.sm },
  dailyPlayBtn: {
    width: 38, height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyPlayIcon: { color: '#fff', fontSize: FontSize.md },

  // Game grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.md,
  },
  gameCardWrap: { width: '48%' },
  gameCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    paddingBottom: Spacing.sm,
  },
  cardAccentBar: { height: 5 },
  cardEmoji: {
    fontSize: 36,
    textAlign: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.extraBold as any,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
  cardDesc: {
    fontSize: 10,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
    marginTop: 2,
    lineHeight: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
  },
  diffBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  diffText:  { fontSize: 9, fontWeight: FontWeight.bold as any },
  cardStars: { fontSize: 9 },
});

export default HomeScreen;