import { useCallback, useEffect, useMemo, useRef, useState, JSX } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { GameStackParamList } from '../../navigation/types';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { adaptApi, sessionsApi } from '../../services/api';
import { BorderRadius, Shadow, Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { CountingQuestion, GameResult } from '../../types';

// ─── Types ─────────────────────────────────────────────────────────────────

type CountingGameNavProp = NativeStackNavigationProp<GameStackParamList, 'CountingGame'>;
type CountingGameRouteProp = RouteProp<GameStackParamList, 'CountingGame'>;

type AnswerState = 'idle' | 'correct' | 'wrong';
type FeedbackState = 'hidden' | 'correct' | 'wrong' | 'complete';

interface SessionStats {
  score: number;
  streak: number;
  lives: number;
  correct: number;
  total: number;
  startTime: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const TOTAL_QUESTIONS = 8;
const MAX_LIVES = 3;
const BASE_POINTS = 10;
const STREAK_BONUS = 2;

const EASY_QUESTIONS: CountingQuestion[] = [
  { id: 'q1', emoji: '🍎', count: 3, hint: 'Count one apple at a time!' },
  { id: 'q2', emoji: '⭐', count: 5, hint: 'Point to each star as you count!' },
  { id: 'q3', emoji: '🐶', count: 2, hint: 'Count from left to right!' },
  { id: 'q4', emoji: '🌸', count: 4, hint: 'Count slowly, one flower at a time!' },
];

const MEDIUM_QUESTIONS: CountingQuestion[] = [
  { id: 'q5', emoji: '🦋', count: 6, hint: 'Try grouping them into pairs!' },
  { id: 'q6', emoji: '🍌', count: 7, hint: 'Count 5 first, then add the rest!' },
  { id: 'q7', emoji: '🐸', count: 8, hint: 'Count in rows of 2!' },
  { id: 'q8', emoji: '🌟', count: 9, hint: 'Count 5 first, then the remaining!' },
];

const ALL_QUESTIONS: CountingQuestion[] = [
  ...EASY_QUESTIONS,
  ...MEDIUM_QUESTIONS,
];

const CORRECT_MESSAGES = [
  { emoji: '⭐', title: 'Correct!', sub: 'Great counting!' },
  { emoji: '🎉', title: 'Brilliant!', sub: 'You are a star!' },
  { emoji: '🔥', title: 'On Fire!',  sub: 'Keep it up!' },
];

const STREAK_THRESHOLD = 3;

// ─── Helpers ───────────────────────────────────────────────────────────────

const generateOptions = (answer: number): number[] => {
  const opts = new Set<number>([answer]);
  let attempts = 0;
  while (opts.size < 4 && attempts < 20) {
    const offset = Math.floor(Math.random() * 7) - 3;
    const candidate = answer + offset;
    if (candidate > 0 && candidate !== answer) opts.add(candidate);
    attempts++;
  }
  return Array.from(opts).sort(() => Math.random() - 0.5);
};

const shuffleQuestions = (questions: CountingQuestion[]): CountingQuestion[] =>
  [...questions].sort(() => Math.random() - 0.5).slice(0, TOTAL_QUESTIONS);

const calcPoints = (streak: number): number => BASE_POINTS + streak * STREAK_BONUS;

// ─── Sub-components ────────────────────────────────────────────────────────

interface HeaderProps {
  lives: number;
  colors: ReturnType<typeof useTheme>['colors'];
  onBack: () => void;
}

const Header = ({ lives, colors, onBack }: HeaderProps): JSX.Element => (
  <View style={[styles.header, { backgroundColor: colors.primary }]}>
    <TouchableOpacity
      style={styles.backBtn}
      onPress={onBack}
      accessibilityLabel="Go back"
    >
      <Text style={styles.backBtnText}>←</Text>
    </TouchableOpacity>
    <View style={styles.headerInfo}>
      <Text style={styles.headerTitle}>🔢 Counting Game</Text>
      <Text style={styles.headerSub}>Level 1 — Number Sense</Text>
    </View>
    <View style={styles.livesRow}>
      {Array.from({ length: MAX_LIVES }).map((_, i) => (
        <Text key={i} style={styles.heart}>
          {i < lives ? '❤️' : '🖤'}
        </Text>
      ))}
    </View>
  </View>
);

// ───────────────────────────────────────────────────────────────────────────

interface ProgressBarProps {
  current: number;
  total: number;
  colors: ReturnType<typeof useTheme>['colors'];
}

const ProgressBar = ({ current, total, colors }: ProgressBarProps): JSX.Element => {
  const pct = Math.round((current / total) * 100);
  return (
    <View style={[styles.progressWrap, { backgroundColor: colors.primaryDark }]}>
      <View style={styles.progressLabel}>
        <Text style={styles.progressText}>Question {current + 1} of {total}</Text>
        <Text style={styles.progressText}>{pct}%</Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
        <Animated.View
          style={[styles.progressFill, { width: `${pct}%`, backgroundColor: '#FFD700' }]}
        />
      </View>
    </View>
  );
};

// ───────────────────────────────────────────────────────────────────────────

interface StatChipProps {
  value: string;
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
}

const StatChip = ({ value, label, colors }: StatChipProps): JSX.Element => (
  <View
    style={[
      styles.statChip,
      { backgroundColor: colors.surface, borderColor: colors.cardBorder, ...Shadow.small, shadowColor: colors.shadow },
    ]}
  >
    <Text style={[styles.statValue, { color: colors.primary }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
  </View>
);

// ───────────────────────────────────────────────────────────────────────────

interface ObjectsGridProps {
  emoji: string;
  count: number;
  colors: ReturnType<typeof useTheme>['colors'];
}

const ObjectsGrid = ({ emoji, count, colors }: ObjectsGridProps): JSX.Element => {
  // Keep a persistent pool and grow it as needed when question sizes change.
  const animsRef = useRef<Animated.Value[]>([]);
  while (animsRef.current.length < count) {
    animsRef.current.push(new Animated.Value(0));
  }
  const anims = animsRef.current;

  useEffect(() => {
    anims.slice(0, count).forEach((anim, i) => {
      anim.setValue(0);
      Animated.spring(anim, {
        toValue: 1,
        tension: 80,
        friction: 5,
        delay: i * 80,
        useNativeDriver: true,
      }).start();
    });
  }, [emoji, count, anims]);

  return (
    <View style={[styles.objectsGrid, { backgroundColor: colors.primaryLight }]}>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.Text
          key={`${emoji}-${i}`}
          style={[
            styles.objectEmoji,
            { transform: [{ scale: anims[i] }], opacity: anims[i] },
          ]}
        >
          {emoji}
        </Animated.Text>
      ))}
    </View>
  );
};

// ───────────────────────────────────────────────────────────────────────────

interface AnswerButtonProps {
  value: number;
  state: AnswerState;
  onPress: (value: number) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  disabled: boolean;
}

const AnswerButton = ({
  value,
  state,
  onPress,
  colors,
  disabled,
}: AnswerButtonProps): JSX.Element => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === 'correct') {
      Animated.spring(scaleAnim, {
        toValue: 1.08,
        tension: 80,
        friction: 4,
        useNativeDriver: true,
      }).start();
    }
    if (state === 'wrong') {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [state]);

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  const bgColor =
    state === 'correct' ? colors.success :
    state === 'wrong'   ? colors.error   :
    colors.surface;

  const borderColor =
    state === 'correct' ? colors.success :
    state === 'wrong'   ? colors.error   :
    colors.cardBorder;

  const textColor =
    state !== 'idle' ? '#FFFFFF' : colors.textPrimary;

  return (
    <Animated.View
      style={{ transform: [{ scale: scaleAnim }, { translateX: shakeAnim }] }}
    >
      <TouchableOpacity
        style={[styles.answerBtn, { backgroundColor: bgColor, borderColor }]}
        onPress={() => onPress(value)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        activeOpacity={1}
        accessibilityLabel={`Answer ${value}`}
      >
        <Text style={[styles.answerBtnText, { color: textColor }]}>{value}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ───────────────────────────────────────────────────────────────────────────

interface FeedbackOverlayProps {
  state: FeedbackState;
  streak: number;
  score: number;
  accuracy: number;
  onNext: () => void;
  onRestart: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

const FeedbackOverlay = ({
  state,
  streak,
  score,
  accuracy,
  onNext,
  onRestart,
  colors,
}: FeedbackOverlayProps): JSX.Element | null => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state !== 'hidden') {
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 5, useNativeDriver: true }),
      ]).start();
    }
  }, [state]);

  if (state === 'hidden') return null;

  const msg =
    state === 'complete'
      ? { emoji: '🏆', title: 'Game Complete!', sub: `Score: ${score} | Accuracy: ${accuracy}%` }
      : state === 'correct'
      ? streak >= STREAK_THRESHOLD
        ? { emoji: '🔥', title: 'On Fire!',   sub: `${streak} in a row! +${calcPoints(streak)} pts` }
        : { emoji: '⭐', title: 'Correct!',    sub: `Great counting! +${calcPoints(streak)} pts` }
      : { emoji: '💪', title: 'Keep Going!', sub: 'Count carefully next time!' };

  return (
    <Animated.View
      style={[
        styles.feedbackOverlay,
        { backgroundColor: `${colors.primary}E6`, opacity: fadeAnim },
      ]}
    >
      <Animated.Text
        style={[styles.feedbackEmoji, { transform: [{ scale: scaleAnim }] }]}
      >
        {msg.emoji}
      </Animated.Text>
      <Text style={styles.feedbackTitle}>{msg.title}</Text>
      <Text style={styles.feedbackSub}>{msg.sub}</Text>

      <TouchableOpacity
        style={[styles.nextBtn, { backgroundColor: colors.reward ?? '#FFD700' }]}
        onPress={state === 'complete' ? onRestart : onNext}
        accessibilityLabel={state === 'complete' ? 'Play again' : 'Next question'}
      >
        <Text style={styles.nextBtnText}>
          {state === 'complete' ? '🔄 Play Again' : 'Next Question →'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Screen ───────────────────────────────────────────────────────────

const CountingGameScreen = (): JSX.Element => {
  const navigation  = useNavigation<CountingGameNavProp>();
  const route       = useRoute<CountingGameRouteProp>();
  const { colors, isDark } = useTheme();
  const { student } = useAuth();

  const difficulty = route.params?.difficulty ?? 'easy';

  // Shuffle questions once per game session
  const questions = useMemo(() => shuffleQuestions(ALL_QUESTIONS), []);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [options, setOptions]           = useState<number[]>([]);
  const [answerStates, setAnswerStates] = useState<Record<number, AnswerState>>({});
  const [feedbackState, setFeedbackState] = useState<FeedbackState>('hidden');
  const [showHint, setShowHint]         = useState(false);
  const [stats, setStats]               = useState<SessionStats>({
    score: 0, streak: 0, lives: MAX_LIVES,
    correct: 0, total: 0, startTime: Date.now(),
  });

  const currentQuestion = questions[currentIndex];
  const accuracy = stats.total > 0
    ? Math.round((stats.correct / stats.total) * 100)
    : 0;

  // ── Setup question ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentQuestion) return;
    setOptions(generateOptions(currentQuestion.count));
    setAnswerStates({});
    setShowHint(false);
  }, [currentIndex, currentQuestion]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAnswer = useCallback(
    (selected: number): void => {
      if (feedbackState !== 'hidden') return;

      const isCorrect = selected === currentQuestion.count;

      setStats((prev) => {
        const newStreak  = isCorrect ? prev.streak + 1 : 0;
        const newLives   = isCorrect ? prev.lives : Math.max(0, prev.lives - 1);
        const newScore   = isCorrect ? prev.score + calcPoints(newStreak) : prev.score;
        return {
          ...prev,
          streak:  newStreak,
          lives:   newLives,
          score:   newScore,
          correct: isCorrect ? prev.correct + 1 : prev.correct,
          total:   prev.total + 1,
        };
      });

      // Mark selected button + reveal correct answer if wrong
      const newStates: Record<number, AnswerState> = { [selected]: isCorrect ? 'correct' : 'wrong' };
      if (!isCorrect) newStates[currentQuestion.count] = 'correct';
      setAnswerStates(newStates);

      setTimeout(() => {
        setFeedbackState(isCorrect ? 'correct' : 'wrong');
      }, 600);
    },
    [currentQuestion, feedbackState]
  );

  const handleNext = useCallback((): void => {
    setFeedbackState('hidden');
    if (currentIndex + 1 >= questions.length) {
      handleSessionComplete();
      return;
    }
    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, questions.length, stats]);

  const handleSessionComplete = useCallback(async (): Promise<void> => {
    setFeedbackState('complete');

    const result: GameResult = {
      gameType:        'counting',
      score:           stats.score,
      accuracy,
      streak:          stats.streak,
      totalQuestions:  TOTAL_QUESTIONS,
      correctAnswers:  stats.correct,
      durationSeconds: Math.round((Date.now() - stats.startTime) / 1000),
      difficulty,
    };

    try {
      // Save session to backend
      const accuracyFloat       = result.accuracy / 100;
      const responseTimeAvg      = result.durationSeconds > 0 ? result.durationSeconds / result.totalQuestions : 1;
      const engagementScoreFloat = Math.min(result.streak / result.totalQuestions, 1);

      await sessionsApi.save({
        studentId:       student?.id ?? '',
        gameType:        result.gameType,
        accuracy:        accuracyFloat,
        responseTime:    responseTimeAvg,
        attempts:        result.totalQuestions,
        engagementScore: engagementScoreFloat,
        timestamp:       new Date().toISOString(),
      });

      // Ask RL engine what game to show next
      await adaptApi.next({
        studentId:       student?.id ?? '',
        gameType:        result.gameType,
        accuracy:        accuracyFloat,
        responseTime:    responseTimeAvg,
        attempts:        result.totalQuestions,
        engagementScore: engagementScoreFloat,
        timestamp:       new Date().toISOString(),
      });
    } catch {
      // Non-blocking — game result is still shown even if API fails
    }
  }, [stats, accuracy, difficulty, student]);

  const handleRestart = useCallback((): void => {
    setCurrentIndex(0);
    setFeedbackState('hidden');
    setAnswerStates({});
    setShowHint(false);
    setStats({
      score: 0, streak: 0, lives: MAX_LIVES,
      correct: 0, total: 0, startTime: Date.now(),
    });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.primary}
      />

      <Header
        lives={stats.lives}
        colors={colors}
        onBack={() => navigation.goBack()}
      />

      <ProgressBar
        current={currentIndex}
        total={questions.length}
        colors={colors}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatChip
            value={String(stats.score)}
            label="⭐ Score"
            colors={colors}
          />
          <StatChip
            value={`${stats.streak}🔥`}
            label="Streak"
            colors={colors}
          />
          <StatChip
            value={stats.total > 0 ? `${accuracy}%` : '—'}
            label="Accuracy"
            colors={colors}
          />
        </View>

        {/* Question Card */}
        <View
          style={[
            styles.questionCard,
            { backgroundColor: colors.surface, borderColor: colors.cardBorder, ...Shadow.medium, shadowColor: colors.shadow },
          ]}
        >
          <Text style={[styles.qLabel, { color: colors.textSecondary }]}>
            Count the objects!
          </Text>
          <Text style={[styles.qText, { color: colors.textPrimary }]}>
            How many {currentQuestion?.emoji} do you see?
          </Text>
          {currentQuestion && (
            <ObjectsGrid
              emoji={currentQuestion.emoji}
              count={currentQuestion.count}
              colors={colors}
            />
          )}
        </View>

        {/* Answer Buttons */}
        <View style={styles.answersGrid}>
          {options.map((opt) => (
            <AnswerButton
              key={opt}
              value={opt}
              state={answerStates[opt] ?? 'idle'}
              onPress={handleAnswer}
              disabled={feedbackState !== 'hidden'}
              colors={colors}
            />
          ))}
        </View>

        {/* Hint */}
        {!showHint ? (
          <TouchableOpacity
            style={[styles.hintBtn, { backgroundColor: colors.primaryLight }]}
            onPress={() => setShowHint(true)}
            accessibilityLabel="Show hint"
          >
            <Text style={[styles.hintBtnText, { color: colors.primary }]}>
              💡 Need a hint?
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              💡 {currentQuestion?.hint}
            </Text>
          </View>
        )}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>

      {/* Feedback Overlay */}
      <FeedbackOverlay
        state={feedbackState}
        streak={stats.streak}
        score={stats.score}
        accuracy={accuracy}
        onNext={handleNext}
        onRestart={handleRestart}
        colors={colors}
      />
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:  { flex: 1 },
  scroll: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: Platform.OS === 'android' ? Spacing.xl + 8 : Spacing.lg,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold as any },
  headerInfo:  { flex: 1 },
  headerTitle: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.extraBold as any },
  headerSub:   { color: 'rgba(255,255,255,0.75)', fontSize: FontSize.xs, fontWeight: FontWeight.semiBold as any },
  livesRow:    { flexDirection: 'row', gap: 3 },
  heart:       { fontSize: FontSize.md },

  // Progress
  progressWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, paddingTop: Spacing.sm },
  progressLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressText:  { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.xs, fontWeight: FontWeight.bold as any },
  progressTrack: { height: 8, borderRadius: BorderRadius.full, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: BorderRadius.full },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 2,
  },
  statValue: { fontSize: FontSize.md, fontWeight: FontWeight.extraBold as any },
  statLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold as any },

  // Question card
  questionCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  qLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold as any,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  qText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extraBold as any,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  objectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    width: '100%',
    minHeight: 90,
    alignItems: 'center',
  },
  objectEmoji: { fontSize: 32 },

// Answers
answersGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: Spacing.xs,
  marginBottom: Spacing.md,
  justifyContent: 'space-around',
},
answerBtn: {
  width: 75,
  padding: Spacing.md,                           // ← taller — easier to tap
  borderRadius: BorderRadius.lg,
  borderWidth: 2.5,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: Spacing.md,
},
answerBtnText: {
  fontSize: 32,                            // ← much larger number
  fontWeight: FontWeight.extraBold as any,
  textAlign: 'center',
  includeFontPadding: false,               // ← Android fix for clipped text
},

  // Hint
  hintBtn: {
    height: 46,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold as any,
  },
  hintBox: {
    backgroundColor: '#FFF8E6',
    borderWidth: 1.5,
    borderColor: '#F5A623',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  hintText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold as any,
    color: '#B45309',
    textAlign: 'center',
  },

  // Feedback Overlay
  feedbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: 0,
  },
  feedbackEmoji: { fontSize: 80 },
  feedbackTitle: {
    color: '#fff',
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extraBold as any,
  },
  feedbackSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold as any,
  },
  nextBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  nextBtnText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extraBold as any,
    color: '#1A0A3C',
  },
});

export default CountingGameScreen;