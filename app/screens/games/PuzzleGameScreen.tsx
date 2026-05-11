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
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GameStackParamList } from '../../navigation/types';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { adaptApi, sessionsApi } from '../../services/api';
import { BorderRadius, Shadow, Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { GameResult, PuzzleQuestion } from '../../types';

// ─── Types ──────────────────────────────────────────────────────────────────

type PuzzleNavProp   = NativeStackNavigationProp<GameStackParamList, 'PuzzleGame'>;
type PuzzleRouteProp = RouteProp<GameStackParamList, 'PuzzleGame'>;

type BlankState    = 'idle' | 'filled' | 'correct' | 'wrong';
type FeedbackState = 'hidden' | 'correct' | 'wrong' | 'complete';

interface SessionStats {
  score: number;
  streak: number;
  lives: number;
  correct: number;
  total: number;
  startTime: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_QUESTIONS  = 8;
const MAX_LIVES        = 3;
const BASE_POINTS      = 10;
const STREAK_BONUS     = 2;
const STREAK_THRESHOLD = 3;
const MAX_INPUT_LENGTH = 2;

// Accent color for Puzzle game — red/coral theme
const PUZZLE_PRIMARY = '#EF4444';
const PUZZLE_DARK    = '#DC2626';
const PUZZLE_LIGHT   = '#FEE2E2';

const NUMPAD_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, '⌫', '✓'] as const;
type NumpadKey = (typeof NUMPAD_KEYS)[number];

const PUZZLES: PuzzleQuestion[] = [
  { id: 'p1', type: 'missing_addend',      a: 3,   op: '+', b: '?', result: 7,   answer: 4,  hint: '3 + ? = 7 → Think: 7 − 3 = ?',   visual: '🍎🍎🍎 + ❓ = 🍎🍎🍎🍎🍎🍎🍎' },
  { id: 'p2', type: 'missing_result',      a: 5,   op: '+', b: 4,   result: '?', answer: 9,  hint: 'Count 5 apples then add 4 more!',   visual: '⭐⭐⭐⭐⭐ + ⭐⭐⭐⭐ = ?' },
  { id: 'p3', type: 'missing_minuend',     a: '?', op: '-', b: 3,   result: 5,   answer: 8,  hint: '? − 3 = 5 → Think: 5 + 3 = ?',    visual: '❓ − 🐶🐶🐶 = 🐶🐶🐶🐶🐶' },
  { id: 'p4', type: 'missing_addend',      a: 6,   op: '+', b: '?', result: 10,  answer: 4,  hint: '6 + ? = 10 → Think: 10 − 6 = ?',   visual: '🌸🌸🌸🌸🌸🌸 + ❓ = 🌸 × 10' },
  { id: 'p5', type: 'missing_result',      a: 8,   op: '-', b: 3,   result: '?', answer: 5,  hint: 'Start at 8, count back 3 steps!',   visual: '🦋🦋🦋🦋🦋🦋🦋🦋 − 🦋🦋🦋 = ?' },
  { id: 'p6', type: 'missing_subtrahend',  a: 9,   op: '-', b: '?', result: 4,   answer: 5,  hint: '9 − ? = 4 → Think: 9 − 4 = ?',    visual: '🌟🌟🌟🌟🌟🌟🌟🌟🌟 − ❓ = 🌟🌟🌟🌟' },
  { id: 'p7', type: 'missing_addend',      a: 2,   op: '+', b: '?', result: 8,   answer: 6,  hint: '2 + ? = 8 → Think: 8 − 2 = ?',    visual: '🐸🐸 + ❓ = 🐸🐸🐸🐸🐸🐸🐸🐸' },
  { id: 'p8', type: 'missing_result',      a: 7,   op: '+', b: 5,   result: '?', answer: 12, hint: 'Count on from 7: 8,9,10,11,12!',   visual: '🍌🍌🍌🍌🍌🍌🍌 + 🍌🍌🍌🍌🍌 = ?' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const calcPoints    = (streak: number): number => BASE_POINTS + streak * STREAK_BONUS;
const shuffleArray  = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

const isOperator = (val: unknown): boolean =>
  ['+', '-', '×', '÷'].includes(String(val));

// ─── Sub-components ───────────────────────────────────────────────────────────

interface HeaderProps {
  lives: number;
  onBack: () => void;
}

const Header = ({ lives, onBack }: HeaderProps): JSX.Element => (
  <View style={[styles.header, { backgroundColor: PUZZLE_PRIMARY }]}>
    <TouchableOpacity
      style={styles.backBtn}
      onPress={onBack}
      accessibilityLabel="Go back"
    >
      <Text style={styles.backBtnText}>←</Text>
    </TouchableOpacity>
    <View style={styles.headerInfo}>
      <Text style={styles.headerTitle}>🧩 Puzzle Game</Text>
      <Text style={styles.headerSub}>Level 1 — Math Puzzles</Text>
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

// ─────────────────────────────────────────────────────────────────────────────

interface ProgressBarProps {
  current: number;
  total: number;
}

const ProgressBar = ({ current, total }: ProgressBarProps): JSX.Element => {
  const pct = Math.round((current / total) * 100);
  return (
    <View style={[styles.progressWrap, { backgroundColor: PUZZLE_DARK }]}>
      <View style={styles.progressLabel}>
        <Text style={styles.progressText}>Question {current + 1} of {total}</Text>
        <Text style={styles.progressText}>{pct}%</Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

interface StatChipProps {
  value: string;
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
}

const StatChip = ({ value, label, colors }: StatChipProps): JSX.Element => (
  <View style={[styles.statChip, {
    backgroundColor: colors.surface,
    borderColor: PUZZLE_LIGHT,
    ...Shadow.small,
    shadowColor: PUZZLE_PRIMARY,
  }]}>
    <Text style={[styles.statValue, { color: PUZZLE_PRIMARY }]}>{value}</Text>
    <Text style={[styles.statLabel,  { color: colors.textSecondary }]}>{label}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────

interface PuzzleEquationProps {
  puzzle: PuzzleQuestion;
  input: string;
  blankState: BlankState;
  colors: ReturnType<typeof useTheme>['colors'];
}

const PuzzleEquation = ({
  puzzle,
  input,
  blankState,
  colors,
}: PuzzleEquationProps): JSX.Element => {
  // Blank pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (blankState === 'idle') {
      // Pulsing border when waiting for input
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }

    if (blankState === 'wrong') {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -5, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [blankState]);

  const blankBgColor =
    blankState === 'correct' ? '#DCFCE7' :
    blankState === 'wrong'   ? PUZZLE_LIGHT :
    blankState === 'filled'  ? colors.primaryLight :
    '#FEF3C7';

  const blankBorderColor =
    blankState === 'correct' ? '#22C55E' :
    blankState === 'wrong'   ? PUZZLE_PRIMARY :
    blankState === 'filled'  ? colors.primary :
    '#F59E0B';

  const blankTextColor =
    blankState === 'correct' ? '#22C55E' :
    blankState === 'wrong'   ? PUZZLE_PRIMARY :
    blankState === 'filled'  ? colors.primary :
    '#D97706';

  const renderPart = (part: number | '?' | string, key: string): JSX.Element => {
    if (part === '?') {
      return (
        <Animated.View
          key={key}
          style={[
            styles.puzzleBlank,
            {
              backgroundColor: blankBgColor,
              borderColor: blankBorderColor,
              transform: [
                { scale: blankState === 'idle' ? pulseAnim : new Animated.Value(1) },
                { translateX: shakeAnim },
              ],
            },
          ]}
        >
          <Text style={[styles.puzzleBlankText, { color: blankTextColor }]}>
            {input || '?'}
          </Text>
        </Animated.View>
      );
    }

    if (isOperator(part)) {
      return (
        <Text key={key} style={[styles.puzzleOp, { color: PUZZLE_PRIMARY }]}>
          {part}
        </Text>
      );
    }

    if (part === '=') {
      return (
        <Text key={key} style={[styles.puzzleEq, { color: colors.textSecondary }]}>
          =
        </Text>
      );
    }

    return (
      <View key={key} style={[styles.puzzleNum, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
        <Text style={[styles.puzzleNumText, { color: colors.textPrimary }]}>{part}</Text>
      </View>
    );
  };

  return (
    <View style={styles.equationRow}>
      {renderPart(puzzle.a,      'a')}
      {renderPart(puzzle.op,     'op')}
      {renderPart(puzzle.b,      'b')}
      {renderPart('=',           'eq')}
      {renderPart(puzzle.result, 'res')}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

interface NumpadProps {
  onKey: (key: NumpadKey) => void;
  disabled: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}

const Numpad = ({ onKey, disabled, colors }: NumpadProps): JSX.Element => {
  return (
    <View style={styles.numpad}>
      {NUMPAD_KEYS.map((key) => {
        const isDel   = key === '⌫';
        const isCheck = key === '✓';

        return (
          <TouchableOpacity
            key={String(key)}
            style={[
              styles.numpadBtn,
              isDel   && { backgroundColor: PUZZLE_LIGHT,    borderColor: PUZZLE_PRIMARY },
              isCheck && { backgroundColor: PUZZLE_PRIMARY,  borderColor: PUZZLE_DARK    },
              disabled && styles.numpadBtnDisabled,
              { borderColor: disabled ? colors.border : undefined },
            ]}
            onPress={() => onKey(key)}
            disabled={disabled}
            accessibilityLabel={
              isDel   ? 'Delete' :
              isCheck ? 'Check answer' :
              `Number ${key}`
            }
          >
            <Text style={[
              styles.numpadBtnText,
              isDel   && { color: PUZZLE_PRIMARY, fontSize: FontSize.md },
              isCheck && { color: '#FFFFFF',      fontSize: FontSize.sm },
              !isDel && !isCheck && { color: disabled ? colors.textDisabled : colors.textPrimary },
            ]}>
              {key}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

interface FeedbackOverlayProps {
  state: FeedbackState;
  streak: number;
  score: number;
  accuracy: number;
  onNext: () => void;
  onRestart: () => void;
}

const FeedbackOverlay = ({
  state,
  streak,
  score,
  accuracy,
  onNext,
  onRestart,
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
      ? { emoji: '🏆', title: 'All Puzzles Solved!',  sub: `Score: ${score} | Accuracy: ${accuracy}%` }
      : state === 'correct'
      ? streak >= STREAK_THRESHOLD
        ? { emoji: '🔥', title: 'On Fire!',   sub: `${streak} in a row! +${calcPoints(streak)} pts` }
        : { emoji: '⭐', title: 'Correct!',    sub: `Puzzle solved! +${calcPoints(streak)} pts` }
      : { emoji: '💪', title: 'Keep Going!', sub: 'Check your working next time!' };

  return (
    <Animated.View
      style={[styles.feedbackOverlay, { backgroundColor: `${PUZZLE_PRIMARY}E6`, opacity: fadeAnim }]}
    >
      <Animated.Text style={[styles.feedbackEmoji, { transform: [{ scale: scaleAnim }] }]}>
        {msg.emoji}
      </Animated.Text>
      <Text style={styles.feedbackTitle}>{msg.title}</Text>
      <Text style={styles.feedbackSub}>{msg.sub}</Text>
      <TouchableOpacity
        style={styles.nextBtn}
        onPress={state === 'complete' ? onRestart : onNext}
        accessibilityLabel={state === 'complete' ? 'Play again' : 'Next puzzle'}
      >
        <Text style={styles.nextBtnText}>
          {state === 'complete' ? '🔄 Play Again' : 'Next Puzzle →'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const PuzzleGameScreen = (): JSX.Element => {
  const navigation  = useNavigation<PuzzleNavProp>();
  const route       = useRoute<PuzzleRouteProp>();
  const { colors }  = useTheme();
  const { student } = useAuth();

  const difficulty = route.params?.difficulty ?? 'easy';

  const questions = useMemo(() => shuffleArray(PUZZLES), []);

  const [currentIndex,  setCurrentIndex]  = useState(0);
  const [input,         setInput]         = useState('');
  const [blankState,    setBlankState]    = useState<BlankState>('idle');
  const [feedbackState, setFeedbackState] = useState<FeedbackState>('hidden');
  const [showHint,      setShowHint]      = useState(false);
  const [stats, setStats] = useState<SessionStats>({
    score: 0, streak: 0, lives: MAX_LIVES,
    correct: 0, total: 0, startTime: Date.now(),
  });

  const currentPuzzle = questions[currentIndex];
  const accuracy = stats.total > 0
    ? Math.round((stats.correct / stats.total) * 100)
    : 0;

  // ── Reset per question ───────────────────────────────────────────────────

  useEffect(() => {
    setInput('');
    setBlankState('idle');
    setShowHint(false);
  }, [currentIndex]);

  // ── Numpad handler ───────────────────────────────────────────────────────

  const handleKey = useCallback(
    (key: NumpadKey): void => {
      if (feedbackState !== 'hidden') return;

      if (key === '⌫') {
        setInput((prev) => {
          const next = prev.slice(0, -1);
          setBlankState(next ? 'filled' : 'idle');
          return next;
        });
        return;
      }

      if (key === '✓') {
        handleCheckAnswer();
        return;
      }

      // Digit pressed
      setInput((prev) => {
        if (prev.length >= MAX_INPUT_LENGTH) return prev;
        const next = prev + String(key);
        setBlankState('filled');
        return next;
      });
    },
    [feedbackState, input]
  );

  // ── Check answer ─────────────────────────────────────────────────────────

  const handleCheckAnswer = useCallback((): void => {
    if (!input || feedbackState !== 'hidden') return;

    const isCorrect = parseInt(input) === currentPuzzle.answer;

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

    if (isCorrect) {
      setBlankState('correct');
      setTimeout(() => setFeedbackState('correct'), 500);
    } else {
      setBlankState('wrong');
      // Show correct answer after shake
      setTimeout(() => {
        setInput(String(currentPuzzle.answer));
        setBlankState('correct');
      }, 500);
      setTimeout(() => setFeedbackState('wrong'), 900);
    }
  }, [input, feedbackState, currentPuzzle]);

  // ── Navigation ───────────────────────────────────────────────────────────

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
      gameType:        'puzzle',
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
      // Non-blocking — result still shown if API fails
    }
  }, [stats, accuracy, difficulty, student]);

  const handleRestart = useCallback((): void => {
    setCurrentIndex(0);
    setInput('');
    setBlankState('idle');
    setFeedbackState('hidden');
    setShowHint(false);
    setStats({
      score: 0, streak: 0, lives: MAX_LIVES,
      correct: 0, total: 0, startTime: Date.now(),
    });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={PUZZLE_PRIMARY} />

      <Header
        lives={stats.lives}
        onBack={() => navigation.goBack()}
      />

      <ProgressBar
        current={currentIndex}
        total={questions.length}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <StatChip value={String(stats.score)}                     label="⭐ Score"  colors={colors} />
          <StatChip value={`${stats.streak}🔥`}                     label="Streak"   colors={colors} />
          <StatChip value={stats.total > 0 ? `${accuracy}%` : '—'} label="Accuracy" colors={colors} />
        </View>

        {/* Puzzle Card */}
        <View style={[
          styles.puzzleCard,
          { backgroundColor: colors.surface, borderColor: PUZZLE_LIGHT, ...Shadow.medium, shadowColor: PUZZLE_PRIMARY },
        ]}>
          {/* Puzzle type badge */}
          <View style={[styles.typeBadge, { backgroundColor: PUZZLE_LIGHT }]}>
            <Text style={[styles.typeBadgeText, { color: PUZZLE_PRIMARY }]}>
              🧩 {currentPuzzle.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Text>
          </View>

          {/* Equation with blank */}
          <PuzzleEquation
            puzzle={currentPuzzle}
            input={input}
            blankState={blankState}
            colors={colors}
          />

          {/* Visual hint row */}
          <View style={[styles.visualRow, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.visualText, { color: colors.textSecondary }]}>
              {currentPuzzle.visual}
            </Text>
          </View>
        </View>

        {/* Numpad */}
        <Numpad
          onKey={handleKey}
          disabled={feedbackState !== 'hidden'}
          colors={colors}
        />

        {/* Hint */}
        {!showHint ? (
          <TouchableOpacity
            style={[styles.hintBtn, { backgroundColor: PUZZLE_LIGHT }]}
            onPress={() => setShowHint(true)}
            accessibilityLabel="Show hint"
          >
            <Text style={[styles.hintBtnText, { color: PUZZLE_PRIMARY }]}>
              💡 Need a hint?
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>💡 {currentPuzzle.hint}</Text>
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
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { padding: Spacing.lg, paddingTop: Spacing.md },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: Platform.OS === 'android' ? Spacing.xl + 8 : Spacing.lg,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: BorderRadius.full,
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
  progressFill:  { height: '100%', borderRadius: BorderRadius.full, backgroundColor: '#FFD700' },

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

  // Puzzle card
  puzzleCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
    gap: Spacing.md,
  },
  typeBadge: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  typeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.extraBold as any,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Equation
  equationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  puzzleNum: {
    width: 54, height: 54,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puzzleNumText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extraBold as any,
    includeFontPadding: false,
  },
  puzzleOp: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extraBold as any,
  },
  puzzleEq: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extraBold as any,
  },
  puzzleBlank: {
    width: 62, height: 62,
    borderRadius: BorderRadius.md,
    borderWidth: 3,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  puzzleBlankText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extraBold as any,
    includeFontPadding: false,
  },

  // Visual row
  visualRow: {
    width: '100%',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  visualText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold as any,
    textAlign: 'center',
    lineHeight: 28,
  },

  // Numpad
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    justifyContent: 'space-between',
  },
  numpadBtn: {
    width: '22%',
    height: 54,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: '#DDD6FE',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numpadBtnDisabled: { opacity: 0.4 },
  numpadBtnText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extraBold as any,
    includeFontPadding: false,
  },

  // Hint
  hintBtn: {
    height: 46,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  hintBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold as any },
  hintBox: {
    backgroundColor: '#FFF8E6',
    borderWidth: 1.5, borderColor: '#F5A623',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
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
    alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm,
  },
  feedbackEmoji: { fontSize: 80 },
  feedbackTitle: { color: '#fff', fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold as any },
  feedbackSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold as any,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  nextBtn: {
    marginTop: Spacing.md,
    backgroundColor: '#FFD700',
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

export default PuzzleGameScreen;