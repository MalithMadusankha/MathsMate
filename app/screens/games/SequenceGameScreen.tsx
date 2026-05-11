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
import { GameResult, SequenceQuestion } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type SequenceNavProp   = NativeStackNavigationProp<GameStackParamList, 'SequenceGame'>;
type SequenceRouteProp = RouteProp<GameStackParamList, 'SequenceGame'>;

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

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_QUESTIONS  = 8;
const MAX_LIVES        = 3;
const BASE_POINTS      = 10;
const STREAK_BONUS     = 2;
const STREAK_THRESHOLD = 3;
const MAX_INPUT_LENGTH = 3;

// Blue theme for Sequence game
const SEQ_PRIMARY = '#3B82F6';
const SEQ_DARK    = '#2563EB';
const SEQ_LIGHT   = '#DBEAFE';
const SEQ_BG      = '#EFF6FF';

const NUMPAD_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, '⌫', '✓'] as const;
type NumpadKey = (typeof NUMPAD_KEYS)[number];

const SEQUENCES: SequenceQuestion[] = [
  { id: 's1', type: 'Count Up +1',    sequence: [1,  2,  '?', 4,  5 ], answer: 3,  step: '+1',  hint: 'Each number goes up by 1!',          rule: 'Pattern: +1 each time'  },
  { id: 's2', type: 'Count Up +2',    sequence: [2,  4,  '?', 8,  10], answer: 6,  step: '+2',  hint: 'Skip count by 2s!',                  rule: 'Pattern: +2 each time'  },
  { id: 's3', type: 'Count Up +3',    sequence: [3,  6,  '?', 12, 15], answer: 9,  step: '+3',  hint: 'Each number jumps up by 3!',          rule: 'Pattern: +3 each time'  },
  { id: 's4', type: 'Count Down −1',  sequence: [10, 9,  '?', 7,  6 ], answer: 8,  step: '-1',  hint: 'Each number goes down by 1!',         rule: 'Pattern: −1 each time'  },
  { id: 's5', type: 'Count Down −2',  sequence: [20, 18, '?', 14, 12], answer: 16, step: '-2',  hint: 'Skip count backwards by 2!',          rule: 'Pattern: −2 each time'  },
  { id: 's6', type: 'Count Up +5',    sequence: [5,  10, '?', 20, 25], answer: 15, step: '+5',  hint: 'Count by 5s — 5, 10, 15 …',          rule: 'Pattern: +5 each time'  },
  { id: 's7', type: 'Count Up +10',   sequence: [10, 20, '?', 40, 50], answer: 30, step: '+10', hint: 'Count by 10s — 10, 20, 30 …',        rule: 'Pattern: +10 each time' },
  { id: 's8', type: 'Count Up +4',    sequence: [4,  8,  '?', 16, 20], answer: 12, step: '+4',  hint: 'Each number jumps up by 4!',          rule: 'Pattern: +4 each time'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const calcPoints   = (streak: number): number => BASE_POINTS + streak * STREAK_BONUS;
const shuffleArray = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

// ─── Sub-components ───────────────────────────────────────────────────────────

interface HeaderProps {
  lives: number;
  onBack: () => void;
}

const Header = ({ lives, onBack }: HeaderProps): JSX.Element => (
  <View style={[styles.header, { backgroundColor: SEQ_PRIMARY }]}>
    <TouchableOpacity
      style={styles.backBtn}
      onPress={onBack}
      accessibilityLabel="Go back"
    >
      <Text style={styles.backBtnText}>←</Text>
    </TouchableOpacity>
    <View style={styles.headerInfo}>
      <Text style={styles.headerTitle}>🔄 Sequence Game</Text>
      <Text style={styles.headerSub}>Level 1 — Number Patterns</Text>
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
    <View style={[styles.progressWrap, { backgroundColor: SEQ_DARK }]}>
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
  <View style={[
    styles.statChip,
    { backgroundColor: colors.surface, borderColor: SEQ_LIGHT, ...Shadow.small, shadowColor: SEQ_PRIMARY },
  ]}>
    <Text style={[styles.statValue, { color: SEQ_PRIMARY }]}>{value}</Text>
    <Text style={[styles.statLabel,  { color: colors.textSecondary }]}>{label}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────

interface SequenceItemProps {
  value: number | '?';
  index: number;
  input: string;
  blankState: BlankState;
  colors: ReturnType<typeof useTheme>['colors'];
}

const SequenceItem = ({
  value,
  index,
  input,
  blankState,
  colors,
}: SequenceItemProps): JSX.Element => {
  // Staggered entrance animation
  const entranceAnim = useRef(new Animated.Value(0)).current;
  // Blank pulse
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  // Wrong shake
  const shakeAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered pop-in for number tiles
    Animated.spring(entranceAnim, {
      toValue: 1,
      tension: 70,
      friction: 5,
      delay: index * 80,
      useNativeDriver: true,
    }).start();
  }, [value]);

  useEffect(() => {
    if (value !== '?') return;

    if (blankState === 'idle') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
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
  }, [blankState, value]);

  // ── Number tile ──────────────────────────────────────────────────────────
  if (value !== '?') {
    return (
      <Animated.View
        style={[
          styles.seqNum,
          {
            backgroundColor: SEQ_BG,
            borderColor: SEQ_LIGHT,
            transform: [{ scale: entranceAnim }],
            opacity: entranceAnim,
          },
        ]}
      >
        <Text style={[styles.seqNumText, { color: '#1E40AF' }]}>{value}</Text>
      </Animated.View>
    );
  }

  // ── Blank tile ───────────────────────────────────────────────────────────
  const blankBg =
    blankState === 'correct' ? '#DCFCE7' :
    blankState === 'wrong'   ? '#FEE2E2' :
    blankState === 'filled'  ? SEQ_BG    :
    '#FEF3C7';

  const blankBorder =
    blankState === 'correct' ? '#22C55E' :
    blankState === 'wrong'   ? '#EF4444' :
    blankState === 'filled'  ? SEQ_PRIMARY :
    '#F59E0B';

  const blankTextColor =
    blankState === 'correct' ? '#22C55E' :
    blankState === 'wrong'   ? '#EF4444' :
    blankState === 'filled'  ? SEQ_PRIMARY :
    '#D97706';

  return (
    <Animated.View
      style={[
        styles.seqBlank,
        {
          backgroundColor: blankBg,
          borderColor: blankBorder,
          transform: [
            { scale: blankState === 'idle' ? pulseAnim : new Animated.Value(1) },
            { translateX: shakeAnim },
          ],
        },
      ]}
    >
      <Text style={[styles.seqBlankText, { color: blankTextColor }]}>
        {input || '?'}
      </Text>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

interface SequenceRowProps {
  sequence: (number | '?')[];
  input: string;
  blankState: BlankState;
  colors: ReturnType<typeof useTheme>['colors'];
}

const SequenceRow = ({
  sequence,
  input,
  blankState,
  colors,
}: SequenceRowProps): JSX.Element => (
  <View style={styles.sequenceRow}>
    {sequence.map((val, i) => (
      <View key={i} style={styles.seqItemWrap}>
        {i > 0 && (
          <Text style={[styles.seqArrow, { color: SEQ_LIGHT }]}>→</Text>
        )}
        <SequenceItem
          value={val}
          index={i}
          input={input}
          blankState={blankState}
          colors={colors}
        />
      </View>
    ))}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────

interface NumpadProps {
  onKey: (key: NumpadKey) => void;
  disabled: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}

const Numpad = ({ onKey, disabled, colors }: NumpadProps): JSX.Element => (
  <View style={styles.numpad}>
    {NUMPAD_KEYS.map((key) => {
      const isDel   = key === '⌫';
      const isCheck = key === '✓';
      return (
        <TouchableOpacity
          key={String(key)}
          style={[
            styles.numpadBtn,
            isDel   && { backgroundColor: SEQ_LIGHT,   borderColor: SEQ_PRIMARY },
            isCheck && { backgroundColor: SEQ_PRIMARY, borderColor: SEQ_DARK    },
            disabled && styles.numpadBtnDisabled,
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
            isDel   && { color: SEQ_PRIMARY,  fontSize: FontSize.md },
            isCheck && { color: '#FFFFFF',    fontSize: FontSize.sm },
            !isDel && !isCheck && { color: disabled ? colors.textDisabled : '#1E40AF' },
          ]}>
            {key}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

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
      ? { emoji: '🏆', title: 'All Patterns Found!',  sub: `Score: ${score} | Accuracy: ${accuracy}%` }
      : state === 'correct'
      ? streak >= STREAK_THRESHOLD
        ? { emoji: '🔥', title: 'On Fire!',   sub: `${streak} in a row! +${calcPoints(streak)} pts` }
        : { emoji: '⭐', title: 'Correct!',    sub: `Pattern found! +${calcPoints(streak)} pts` }
      : { emoji: '💪', title: 'Keep Going!', sub: 'Look at how the numbers change each time!' };

  return (
    <Animated.View
      style={[
        styles.feedbackOverlay,
        { backgroundColor: `${SEQ_PRIMARY}E6`, opacity: fadeAnim },
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
        style={styles.nextBtn}
        onPress={state === 'complete' ? onRestart : onNext}
        accessibilityLabel={state === 'complete' ? 'Play again' : 'Next pattern'}
      >
        <Text style={styles.nextBtnText}>
          {state === 'complete' ? '🔄 Play Again' : 'Next Pattern →'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const SequenceGameScreen = (): JSX.Element => {
  const navigation  = useNavigation<SequenceNavProp>();
  const route       = useRoute<SequenceRouteProp>();
  const { colors }  = useTheme();
  const { student } = useAuth();

  const difficulty = route.params?.difficulty ?? 'easy';
  const questions  = useMemo(() => shuffleArray(SEQUENCES), []);

  const [currentIndex,  setCurrentIndex]  = useState(0);
  const [input,         setInput]         = useState('');
  const [blankState,    setBlankState]    = useState<BlankState>('idle');
  const [feedbackState, setFeedbackState] = useState<FeedbackState>('hidden');
  const [showHint,      setShowHint]      = useState(false);
  const [stats, setStats] = useState<SessionStats>({
    score: 0, streak: 0, lives: MAX_LIVES,
    correct: 0, total: 0, startTime: Date.now(),
  });

  const currentQuestion = questions[currentIndex];
  const accuracy = stats.total > 0
    ? Math.round((stats.correct / stats.total) * 100)
    : 0;

  // ── Reset per question ────────────────────────────────────────────────────

  useEffect(() => {
    setInput('');
    setBlankState('idle');
    setShowHint(false);
  }, [currentIndex]);

  // ── Numpad handler ────────────────────────────────────────────────────────

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

      setInput((prev) => {
        if (prev.length >= MAX_INPUT_LENGTH) return prev;
        const next = prev + String(key);
        setBlankState('filled');
        return next;
      });
    },
    [feedbackState, input]
  );

  // ── Check answer ──────────────────────────────────────────────────────────

  const handleCheckAnswer = useCallback((): void => {
    if (!input || feedbackState !== 'hidden') return;

    const isCorrect = parseInt(input) === currentQuestion.answer;

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
      // Reveal correct answer after shake
      setTimeout(() => {
        setInput(String(currentQuestion.answer));
        setBlankState('correct');
      }, 500);
      setTimeout(() => setFeedbackState('wrong'), 900);
    }
  }, [input, feedbackState, currentQuestion]);

  // ── Navigation ────────────────────────────────────────────────────────────

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
      gameType:        'sequence',
      score:           stats.score,
      accuracy,
      streak:          stats.streak,
      totalQuestions:  TOTAL_QUESTIONS,
      correctAnswers:  stats.correct,
      durationSeconds: Math.round((Date.now() - stats.startTime) / 1000),
      difficulty,
    };

    try {
      await sessionsApi.save({
        studentId:       student?.id ?? '',
        gameType:        result.gameType,
        accuracy:        result.accuracy,
        responseTime:    result.durationSeconds,
        attempts:        result.totalQuestions,
        engagementScore: result.streak,
        timestamp:       new Date().toISOString(),
      });

      await adaptApi.next({
        studentId:       student?.id ?? '',
        gameType:        result.gameType,
        accuracy:        result.accuracy,
        responseTime:    result.durationSeconds,
        attempts:        result.totalQuestions,
        engagementScore: result.streak,
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
      <StatusBar barStyle="light-content" backgroundColor={SEQ_PRIMARY} />

      <Header lives={stats.lives} onBack={() => navigation.goBack()} />

      <ProgressBar current={currentIndex} total={questions.length} />

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

        {/* Pattern Card */}
        <View style={[
          styles.patternCard,
          { backgroundColor: colors.surface, borderColor: SEQ_LIGHT, ...Shadow.medium, shadowColor: SEQ_PRIMARY },
        ]}>
          {/* Badge */}
          <View style={[styles.typeBadge, { backgroundColor: SEQ_LIGHT }]}>
            <Text style={[styles.typeBadgeText, { color: SEQ_PRIMARY }]}>
              🔄 {currentQuestion.type}
            </Text>
          </View>

          <Text style={[styles.patternDesc, { color: colors.textSecondary }]}>
            Find the missing number in the sequence!
          </Text>

          {/* Sequence tiles */}
          <SequenceRow
            sequence={currentQuestion.sequence}
            input={input}
            blankState={blankState}
            colors={colors}
          />

          {/* Pattern rule chip */}
          <View style={[styles.ruleChip, { backgroundColor: SEQ_BG }]}>
            <Text style={[styles.ruleText, { color: '#1E40AF' }]}>
              {currentQuestion.rule}
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
            style={[styles.hintBtn, { backgroundColor: SEQ_LIGHT }]}
            onPress={() => setShowHint(true)}
            accessibilityLabel="Show hint"
          >
            <Text style={[styles.hintBtnText, { color: SEQ_PRIMARY }]}>
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

  // Pattern card
  patternCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
    gap: Spacing.md,
  },
  typeBadge: {
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
  patternDesc: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold as any,
    textAlign: 'center',
  },

  // Sequence row
  sequenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  seqItemWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seqArrow: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.extraBold as any,
  },
  seqNum: {
    width: 52, height: 52,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seqNumText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extraBold as any,
    includeFontPadding: false,
  },
  seqBlank: {
    width: 58, height: 58,
    borderRadius: BorderRadius.md,
    borderWidth: 3,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seqBlankText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extraBold as any,
    includeFontPadding: false,
  },

  // Rule chip
  ruleChip: {
    width: '100%',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  ruleText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.extraBold as any,
    textAlign: 'center',
    letterSpacing: 0.3,
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
    width: '22%', height: 54,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: SEQ_LIGHT,
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
    borderWidth: 1.5,
    borderColor: '#F5A623',
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

export default SequenceGameScreen;