import { useCallback, useEffect, useMemo, useRef, useState,JSX } from 'react';
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
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GameStackParamList } from '../../navigation/types';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { adaptApi, sessionsApi } from '../../services/api';
import { BorderRadius, Shadow, Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { GameResult } from '../../types';
import GameTopBar from '../../components/games/GameTopBar';
import GameStatChip from '../../components/games/GameStatChip';

// ─── Types ─────────────────────────────────────────────────────────────────

type ComparisonNavProp  = NativeStackNavigationProp<GameStackParamList, 'ComparisonGame'>;
type ComparisonRouteProp = RouteProp<GameStackParamList, 'ComparisonGame'>;

type ComparisonMode = 'bigger' | 'smaller' | 'equal';
type AnswerState    = 'idle' | 'correct' | 'wrong';
type FeedbackState  = 'hidden' | 'correct' | 'wrong' | 'complete';
type BubbleState    = 'idle' | 'winner' | 'loser';

interface ComparisonQuestion {
  id: string;
  a: number;
  b: number;
  mode: ComparisonMode;
  hint: string;
}

interface AnswerOption {
  label: string;
  value: number | 'equal';
}

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
const MAX_LIVES       = 3;
const BASE_POINTS     = 10;
const STREAK_BONUS    = 2;
const STREAK_THRESHOLD = 3;
const MAX_VISUAL_DOTS  = 15;

const QUESTIONS: ComparisonQuestion[] = [
  { id: 'q1', a: 5,  b: 8,  mode: 'bigger',  hint: 'Look at the dots — which side has more?' },
  { id: 'q2', a: 12, b: 7,  mode: 'smaller', hint: 'Smaller means less — which has fewer dots?' },
  { id: 'q3', a: 3,  b: 9,  mode: 'bigger',  hint: 'Count each side and pick the larger one!' },
  { id: 'q4', a: 15, b: 11, mode: 'bigger',  hint: 'Both are big — look at the tens digit!' },
  { id: 'q5', a: 6,  b: 6,  mode: 'bigger',  hint: 'Look carefully — are they the same?' },
  { id: 'q6', a: 20, b: 14, mode: 'smaller', hint: 'Which number is closer to zero?' },
  { id: 'q7', a: 4,  b: 9,  mode: 'bigger',  hint: 'Count the dots on each side!' },
  { id: 'q8', a: 18, b: 13, mode: 'smaller', hint: 'Smaller = less — which is fewer?' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

const getCorrectAnswer = (q: ComparisonQuestion): number | 'equal' => {
  if (q.a === q.b) return 'equal';
  if (q.mode === 'bigger')  return q.a > q.b ? q.a : q.b;
  return q.a < q.b ? q.a : q.b;
};

const buildOptions = (q: ComparisonQuestion): AnswerOption[] => {
  const opts: AnswerOption[] = [
    { label: `${q.a}  ←  Left`,  value: q.a },
    { label: `${q.b}  →  Right`, value: q.b },
  ];
  if (q.a === q.b) {
    opts.push({ label: 'They are Equal  ⚖️', value: 'equal' });
  }
  return opts;
};

const calcPoints = (streak: number): number => BASE_POINTS + streak * STREAK_BONUS;

const shuffleArray = <T,>(arr: T[]): T[] =>
  [...arr].sort(() => Math.random() - 0.5);

// ─── Sub-components ────────────────────────────────────────────────────────

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
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: '#FFD700' }]} />
      </View>
    </View>
  );
};

interface NumberBubbleProps {
  value: number;
  bubbleState: BubbleState;
  colors: ReturnType<typeof useTheme>['colors'];
}

const NumberBubble = ({ value, bubbleState, colors }: NumberBubbleProps): JSX.Element => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const toValue =
      bubbleState === 'winner' ? 1.12 :
      bubbleState === 'loser'  ? 0.88 : 1;

    Animated.spring(scaleAnim, {
      toValue,
      tension: 70,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [bubbleState]);

  const bgColor =
    bubbleState === 'winner' ? colors.primary :
    bubbleState === 'loser'  ? colors.primaryLight :
    colors.primaryLight;

  const textColor =
    bubbleState === 'winner' ? '#FFFFFF' :
    bubbleState === 'loser'  ? colors.textDisabled :
    colors.textPrimary;

  const borderColor =
    bubbleState === 'winner' ? colors.primaryDark :
    bubbleState === 'loser'  ? colors.border :
    colors.primary;

  return (
    <Animated.View
      style={[
        styles.numberBubble,
        { backgroundColor: bgColor, borderColor, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Text style={[styles.numberBubbleText, { color: textColor }]}>{value}</Text>
    </Animated.View>
  );
};

// ───────────────────────────────────────────────────────────────────────────

interface VisualDotsProps {
  count: number;
  color: string;
}

const VisualDots = ({ count, color }: VisualDotsProps): JSX.Element => {
  const displayCount = Math.min(count, MAX_VISUAL_DOTS);
  const anims = useRef(
    Array.from({ length: MAX_VISUAL_DOTS }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    anims.forEach((anim, i) => {
      anim.setValue(0);
      if (i < displayCount) {
        Animated.spring(anim, {
          toValue: 1,
          tension: 80,
          friction: 5,
          delay: i * 30,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [count]);

  return (
    <View style={styles.dotsWrap}>
      {Array.from({ length: displayCount }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: color, transform: [{ scale: anims[i] }], opacity: anims[i] },
          ]}
        />
      ))}
      {count > MAX_VISUAL_DOTS && (
        <Text style={styles.dotsMore}>+{count - MAX_VISUAL_DOTS}</Text>
      )}
    </View>
  );
};

// ───────────────────────────────────────────────────────────────────────────

interface AnswerButtonProps {
  option: AnswerOption;
  state: AnswerState;
  disabled: boolean;
  onPress: (value: number | 'equal') => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

const AnswerButton = ({
  option,
  state,
  disabled,
  onPress,
  colors,
}: AnswerButtonProps): JSX.Element => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === 'correct') {
      Animated.spring(scaleAnim, { toValue: 1.05, tension: 80, friction: 4, useNativeDriver: true }).start();
    }
    if (state === 'wrong') {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -5, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [state]);

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start();
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

  const textColor = state !== 'idle' ? '#FFFFFF' : colors.textPrimary;

  return (
    <Animated.View
      style={[
        styles.answerBtnWrap,
        { transform: [{ scale: scaleAnim }, { translateX: shakeAnim }] },
      ]}
    >
      <TouchableOpacity
        style={[styles.answerBtn, { backgroundColor: bgColor, borderColor }]}
        onPress={() => onPress(option.value)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        activeOpacity={1}
        accessibilityLabel={`Select ${option.label}`}
      >
        <Text style={[styles.answerBtnText, { color: textColor }]}>{option.label}</Text>
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
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
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
        : { emoji: '⭐', title: 'Correct!',    sub: `Great comparison! +${calcPoints(streak)} pts` }
      : { emoji: '💪', title: 'Keep Going!', sub: 'Compare carefully next time!' };

  return (
    <Animated.View
      style={[
        styles.feedbackOverlay,
        { backgroundColor: `${colors.primary}E6`, opacity: fadeAnim },
      ]}
    >
      <Animated.Text style={[styles.feedbackEmoji, { transform: [{ scale: scaleAnim }] }]}>
        {msg.emoji}
      </Animated.Text>
      <Text style={styles.feedbackTitle}>{msg.title}</Text>
      <Text style={styles.feedbackSub}>{msg.sub}</Text>
      <TouchableOpacity
        style={[styles.nextBtn, { backgroundColor: '#FFD700' }]}
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

const ComparisonGameScreen = (): JSX.Element => {
  const navigation   = useNavigation<ComparisonNavProp>();
  const route        = useRoute<ComparisonRouteProp>();
  const { colors }   = useTheme();
  const { student }  = useAuth();

  const difficulty = route.params?.difficulty ?? 'easy';

  const questions = useMemo(() => shuffleArray(QUESTIONS), []);

  const [currentIndex, setCurrentIndex]     = useState(0);
  const [answerStates, setAnswerStates]     = useState<Record<string, AnswerState>>({});
  const [bubbleStates, setBubbleStates]     = useState<{ a: BubbleState; b: BubbleState }>({ a: 'idle', b: 'idle' });
  const [feedbackState, setFeedbackState]   = useState<FeedbackState>('hidden');
  const [showHint, setShowHint]             = useState(false);
  const [stats, setStats] = useState<SessionStats>({
    score: 0, streak: 0, lives: MAX_LIVES,
    correct: 0, total: 0, startTime: Date.now(),
  });

  const currentQuestion = questions[currentIndex];
  const options         = useMemo(() => buildOptions(currentQuestion), [currentQuestion]);
  const correctAnswer   = useMemo(() => getCorrectAnswer(currentQuestion), [currentQuestion]);
  const accuracy        = stats.total > 0
    ? Math.round((stats.correct / stats.total) * 100)
    : 0;

  // ── Reset state per question ──────────────────────────────────────────────

  useEffect(() => {
    setAnswerStates({});
    setBubbleStates({ a: 'idle', b: 'idle' });
    setShowHint(false);
  }, [currentIndex]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAnswer = useCallback(
    (selected: number | 'equal'): void => {
      if (feedbackState !== 'hidden') return;

      const isCorrect = selected === correctAnswer;

      setStats((prev) => {
        const newStreak = isCorrect ? prev.streak + 1 : 0;
        return {
          ...prev,
          streak:  newStreak,
          lives:   isCorrect ? prev.lives : Math.max(0, prev.lives - 1),
          score:   isCorrect ? prev.score + calcPoints(newStreak) : prev.score,
          correct: isCorrect ? prev.correct + 1 : prev.correct,
          total:   prev.total + 1,
        };
      });

      // Mark answer buttons
      const newStates: Record<string, AnswerState> = {
        [String(selected)]: isCorrect ? 'correct' : 'wrong',
      };
      if (!isCorrect) newStates[String(correctAnswer)] = 'correct';
      setAnswerStates(newStates);

      // Animate number bubbles
      if (isCorrect && selected !== 'equal') {
        const winnerSide = selected === currentQuestion.a ? 'a' : 'b';
        const loserSide  = winnerSide === 'a' ? 'b' : 'a';
        setBubbleStates({ [winnerSide]: 'winner', [loserSide]: 'loser' } as { a: BubbleState; b: BubbleState });
      }

      setTimeout(() => setFeedbackState(isCorrect ? 'correct' : 'wrong'), 600);
    },
    [feedbackState, correctAnswer, currentQuestion]
  );

  const handleNext = useCallback((): void => {
    setFeedbackState('hidden');
    if (currentIndex + 1 >= questions.length) {
      handleSessionComplete();
      return;
    }
    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, questions.length]);

  const handleSessionComplete = useCallback(async (): Promise<void> => {
    setFeedbackState('complete');

    const result: GameResult = {
      gameType:        'comparison',
      score:           stats.score,
      accuracy,
      streak:          stats.streak,
      totalQuestions:  TOTAL_QUESTIONS,
      correctAnswers:  stats.correct,
      durationSeconds: Math.round((Date.now() - stats.startTime) / 1000),
      difficulty,
    };

    try {
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
      // Non-blocking — show result even if API fails
    }
  }, [stats, accuracy, difficulty, student]);

  const handleRestart = useCallback((): void => {
    setCurrentIndex(0);
    setFeedbackState('hidden');
    setAnswerStates({});
    setBubbleStates({ a: 'idle', b: 'idle' });
    setShowHint(false);
    setStats({
      score: 0, streak: 0, lives: MAX_LIVES,
      correct: 0, total: 0, startTime: Date.now(),
    });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <GameTopBar
        title="⚖️ Comparison Game"
        subtitle="Level 1 — Number Magnitude"
        lives={stats.lives}
        maxLives={MAX_LIVES}
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
        {/* Stats */}
        <View style={styles.statsRow}>
          <GameStatChip value={String(stats.score)} label="⭐ Score" />
          <GameStatChip value={`${stats.streak}🔥`} label="Streak" />
          <GameStatChip value={stats.total > 0 ? `${accuracy}%` : '—'} label="Accuracy" />
        </View>

        {/* Question Card */}
        <View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder, ...Shadow.medium, shadowColor: colors.shadow }]}>

          <Text style={[styles.qLabel, { color: colors.textSecondary }]}>
            Which number is{' '}
            <Text style={{ color: colors.primary }}>
              {currentQuestion.mode.toUpperCase()}
            </Text>
            ?
          </Text>

          {/* Number Bubbles */}
          <View style={styles.bubblesRow}>
            <NumberBubble value={currentQuestion.a} bubbleState={bubbleStates.a} colors={colors} />
            <View style={[styles.vsBadge, { backgroundColor: colors.secondary }]}>
              <Text style={styles.vsText}>VS</Text>
            </View>
            <NumberBubble value={currentQuestion.b} bubbleState={bubbleStates.b} colors={colors} />
          </View>

          {/* Visual Dot Comparison */}
          <View style={[styles.visualRow, { backgroundColor: colors.primaryLight }]}>
            <View style={styles.visualCol}>
              <Text style={[styles.visualLabel, { color: colors.textSecondary }]}>
                {currentQuestion.a}
              </Text>
              <VisualDots count={currentQuestion.a} color={colors.primary} />
            </View>
            <View style={[styles.visualDivider, { backgroundColor: colors.border }]} />
            <View style={styles.visualCol}>
              <Text style={[styles.visualLabel, { color: colors.textSecondary }]}>
                {currentQuestion.b}
              </Text>
              <VisualDots count={currentQuestion.b} color={colors.secondary} />
            </View>
          </View>
        </View>

        {/* Answer Buttons */}
        <View style={styles.answersCol}>
          {options.map((opt) => (
            <AnswerButton
              key={String(opt.value)}
              option={opt}
              state={answerStates[String(opt.value)] ?? 'idle'}
              disabled={feedbackState !== 'hidden'}
              onPress={handleAnswer}
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
            <Text style={styles.hintText}>💡 {currentQuestion.hint}</Text>
          </View>
        )}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>

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
  root:   { flex: 1 },
  scroll: { padding: Spacing.lg, paddingTop: Spacing.md },

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
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold as any },
  headerInfo:  { flex: 1 },
  headerTitle: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.extraBold as any },
  headerSub:   { color: 'rgba(255,255,255,0.75)', fontSize: FontSize.xs, fontWeight: FontWeight.semiBold as any },
  livesRow:    { flexDirection: 'row', gap: 3 },
  heart:       { fontSize: FontSize.md },

  // Progress
  progressWrap:  { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, paddingTop: Spacing.sm },
  progressLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressText:  { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.xs, fontWeight: FontWeight.bold as any },
  progressTrack: { height: 8, borderRadius: BorderRadius.full, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: BorderRadius.full },

  // Stats
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statChip: {
    flex: 1, alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, gap: 2,
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
    gap: Spacing.md,
  },
  qLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.extraBold as any,
    textAlign: 'center',
  },

  // Bubbles
  bubblesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  numberBubble: {
    width: 90, height: 90,
    borderRadius: BorderRadius.full,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBubbleText: {
    fontSize: 36,
    fontWeight: FontWeight.extraBold as any,
    includeFontPadding: false,
  },
  vsBadge: {
    width: 40, height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.extraBold as any,
    letterSpacing: 0.5,
  },

  // Visual dots
  visualRow: {
    flexDirection: 'row',
    width: '100%',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
    minHeight: 70,
  },
  visualCol:     { flex: 1, alignItems: 'center', gap: Spacing.xs },
  visualLabel:   { fontSize: FontSize.sm, fontWeight: FontWeight.bold as any },
  visualDivider: { width: 1 },
  dotsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
    maxWidth: 100,
  },
  dot:      { width: 12, height: 12, borderRadius: BorderRadius.full },
  dotsMore: { fontSize: FontSize.xs, fontWeight: FontWeight.bold as any, color: '#6B5E8C' },

  // Answers
  answersCol:    { gap: Spacing.sm, marginBottom: Spacing.md },
  answerBtnWrap: { width: '100%' },
  answerBtn: {
    width: '100%', height: 62,
    borderRadius: BorderRadius.lg,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  answerBtnText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extraBold as any,
    textAlign: 'center',
    includeFontPadding: false,
  },

  // Hint
  hintBtn: {
    height: 46, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  hintBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold as any },
  hintBox: {
    backgroundColor: '#FFF8E6',
    borderWidth: 1.5, borderColor: '#F5A623',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  hintText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold as any,
    color: '#B45309',
    textAlign: 'center',
  },

  // Feedback overlay
  feedbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  feedbackEmoji: { fontSize: 80 },
  feedbackTitle: { color: '#fff', fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold as any },
  feedbackSub:   { color: 'rgba(255,255,255,0.85)', fontSize: FontSize.md, fontWeight: FontWeight.semiBold as any, textAlign: 'center', paddingHorizontal: Spacing.xl },
  nextBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  nextBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.extraBold as any, color: '#1A0A3C' },
});

export default ComparisonGameScreen;