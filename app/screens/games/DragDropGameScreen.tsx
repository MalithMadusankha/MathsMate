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
import { DragDropQuestion, GameResult } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type DragDropNavProp   = NativeStackNavigationProp<GameStackParamList, 'DragDropGame'>;
type DragDropRouteProp = RouteProp<GameStackParamList, 'DragDropGame'>;

type TargetState   = 'empty' | 'filled' | 'correct' | 'wrong';
type FeedbackState = 'hidden' | 'correct' | 'wrong' | 'complete';

interface TargetSlot {
  targetId: string;
  placedValue: number | null;
  state: TargetState;
}

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

// Violet theme for Drag & Drop
const DD_PRIMARY = '#8B5CF6';
const DD_DARK    = '#7C3AED';
const DD_LIGHT   = '#EDE9FE';
const DD_BG      = '#F5F3FF';

const QUESTIONS: DragDropQuestion[] = [
  {
    id: 'd1',
    instruction: 'Place numbers in order from smallest to biggest',
    numbers: [3, 1, 4, 2],
    targets: [
      { id: 't1', label: '1st',  expectedValue: 1 },
      { id: 't2', label: '2nd',  expectedValue: 2 },
      { id: 't3', label: '3rd',  expectedValue: 3 },
      { id: 't4', label: '4th',  expectedValue: 4 },
    ],
    hint: 'Start with the smallest number — which is least?',
    visual: 'Smallest → → → Biggest',
  },
  {
    id: 'd2',
    instruction: 'Place numbers in order from biggest to smallest',
    numbers: [5, 2, 8, 4],
    targets: [
      { id: 't1', label: '1st',  expectedValue: 8 },
      { id: 't2', label: '2nd',  expectedValue: 5 },
      { id: 't3', label: '3rd',  expectedValue: 4 },
      { id: 't4', label: '4th',  expectedValue: 2 },
    ],
    hint: 'Start with the biggest number first!',
    visual: 'Biggest → → → Smallest',
  },
  {
    id: 'd3',
    instruction: 'Sort the numbers from smallest to biggest',
    numbers: [7, 3, 9, 5],
    targets: [
      { id: 't1', label: '1st',  expectedValue: 3 },
      { id: 't2', label: '2nd',  expectedValue: 5 },
      { id: 't3', label: '3rd',  expectedValue: 7 },
      { id: 't4', label: '4th',  expectedValue: 9 },
    ],
    hint: 'Find the smallest number first, then the next!',
    visual: 'Smallest → → → Biggest',
  },
  {
    id: 'd4',
    instruction: 'Place the even numbers in the boxes',
    numbers: [1, 2, 3, 4, 5, 6],
    targets: [
      { id: 't1', label: 'Even 1', expectedValue: 2 },
      { id: 't2', label: 'Even 2', expectedValue: 4 },
      { id: 't3', label: 'Even 3', expectedValue: 6 },
    ],
    hint: 'Even numbers end in 0, 2, 4, 6, 8!',
    visual: '2, 4, 6, 8 — these are even numbers!',
  },
  {
    id: 'd5',
    instruction: 'Place the odd numbers in the boxes',
    numbers: [1, 2, 3, 4, 5, 6],
    targets: [
      { id: 't1', label: 'Odd 1', expectedValue: 1 },
      { id: 't2', label: 'Odd 2', expectedValue: 3 },
      { id: 't3', label: 'Odd 3', expectedValue: 5 },
    ],
    hint: 'Odd numbers end in 1, 3, 5, 7, 9!',
    visual: '1, 3, 5, 7, 9 — these are odd numbers!',
  },
  {
    id: 'd6',
    instruction: 'Sort numbers smallest to biggest',
    numbers: [12, 5, 18, 9],
    targets: [
      { id: 't1', label: '1st',  expectedValue: 5  },
      { id: 't2', label: '2nd',  expectedValue: 9  },
      { id: 't3', label: '3rd',  expectedValue: 12 },
      { id: 't4', label: '4th',  expectedValue: 18 },
    ],
    hint: 'Compare the tens digit first, then the ones!',
    visual: 'Smallest → → → Biggest',
  },
  {
    id: 'd7',
    instruction: 'Place multiples of 2 in the boxes',
    numbers: [1, 2, 3, 4, 5, 6, 7, 8],
    targets: [
      { id: 't1', label: '×2 #1', expectedValue: 2 },
      { id: 't2', label: '×2 #2', expectedValue: 4 },
      { id: 't3', label: '×2 #3', expectedValue: 6 },
      { id: 't4', label: '×2 #4', expectedValue: 8 },
    ],
    hint: 'Multiples of 2: 2, 4, 6, 8 — count by 2s!',
    visual: '2 × 1=2,  2 × 2=4,  2 × 3=6,  2 × 4=8',
  },
  {
    id: 'd8',
    instruction: 'Sort numbers biggest to smallest',
    numbers: [15, 6, 11, 3],
    targets: [
      { id: 't1', label: '1st',  expectedValue: 15 },
      { id: 't2', label: '2nd',  expectedValue: 11 },
      { id: 't3', label: '3rd',  expectedValue: 6  },
      { id: 't4', label: '4th',  expectedValue: 3  },
    ],
    hint: 'Start with the biggest — which is largest?',
    visual: 'Biggest → → → Smallest',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const calcPoints   = (streak: number): number => BASE_POINTS + streak * STREAK_BONUS;
const shuffleArray = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

const initSlots = (targets: DragDropQuestion['targets']): TargetSlot[] =>
  targets.map((t) => ({ targetId: t.id, placedValue: null, state: 'empty' }));

// ─── Sub-components ───────────────────────────────────────────────────────────

interface HeaderProps {
  lives: number;
  onBack: () => void;
}

const Header = ({ lives, onBack }: HeaderProps): JSX.Element => (
  <View style={[styles.header, { backgroundColor: DD_PRIMARY }]}>
    <TouchableOpacity
      style={styles.backBtn}
      onPress={onBack}
      accessibilityLabel="Go back"
    >
      <Text style={styles.backBtnText}>←</Text>
    </TouchableOpacity>
    <View style={styles.headerInfo}>
      <Text style={styles.headerTitle}>🎯 Drag & Drop</Text>
      <Text style={styles.headerSub}>Level 1 — Number Sorting</Text>
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
    <View style={[styles.progressWrap, { backgroundColor: DD_DARK }]}>
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
    { backgroundColor: colors.surface, borderColor: DD_LIGHT, ...Shadow.small, shadowColor: DD_PRIMARY },
  ]}>
    <Text style={[styles.statValue, { color: DD_PRIMARY }]}>{value}</Text>
    <Text style={[styles.statLabel,  { color: colors.textSecondary }]}>{label}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────

interface NumberTokenProps {
  value: number;
  isUsed: boolean;
  isSelected: boolean;
  onPress: (value: number) => void;
}

const NumberToken = ({
  value,
  isUsed,
  isSelected,
  onPress,
}: NumberTokenProps): JSX.Element => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isSelected ? 1.15 : 1,
      tension: 80,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [isSelected]);

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: isSelected ? 1.15 : 1, useNativeDriver: true, speed: 50 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.token,
          isSelected && { backgroundColor: DD_PRIMARY, borderColor: DD_DARK },
          isUsed     && styles.tokenUsed,
        ]}
        onPress={() => !isUsed && onPress(value)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isUsed}
        activeOpacity={1}
        accessibilityLabel={`Number ${value}`}
      >
        <Text style={[
          styles.tokenText,
          isSelected && { color: '#FFFFFF' },
          isUsed     && { color: '#C4B5FD' },
        ]}>
          {value}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

interface TargetSlotViewProps {
  slot: TargetSlot;
  label: string;
  isActive: boolean;
  onPress: (targetId: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

const TargetSlotView = ({
  slot,
  label,
  isActive,
  onPress,
  colors,
}: TargetSlotViewProps): JSX.Element => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (slot.state === 'correct') {
      Animated.spring(scaleAnim, { toValue: 1.08, tension: 80, friction: 4, useNativeDriver: true }).start();
    }
    if (slot.state === 'wrong') {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -5, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
    if (slot.state === 'empty') {
      scaleAnim.setValue(1);
    }
  }, [slot.state]);

  const bgColor =
    slot.state === 'correct' ? '#DCFCE7' :
    slot.state === 'wrong'   ? '#FEE2E2' :
    slot.state === 'filled'  ? DD_LIGHT  :
    isActive                 ? DD_LIGHT  :
    colors.surface;

  const borderColor =
    slot.state === 'correct' ? '#22C55E'  :
    slot.state === 'wrong'   ? '#EF4444'  :
    slot.state === 'filled'  ? DD_PRIMARY :
    isActive                 ? DD_PRIMARY :
    colors.border;

  const valueColor =
    slot.state === 'correct' ? '#22C55E'  :
    slot.state === 'wrong'   ? '#EF4444'  :
    DD_PRIMARY;

  return (
    <Animated.View
      style={[
        styles.targetWrap,
        { transform: [{ scale: scaleAnim }, { translateX: shakeAnim }] },
      ]}
    >
      <TouchableOpacity
        style={[styles.targetSlot, { backgroundColor: bgColor, borderColor }]}
        onPress={() => onPress(slot.targetId)}
        activeOpacity={0.85}
        accessibilityLabel={`Target slot ${label}`}
      >
        {slot.placedValue !== null ? (
          <Text style={[styles.targetValue, { color: valueColor }]}>
            {slot.placedValue}
          </Text>
        ) : (
          <Text style={[styles.targetPlaceholder, { color: colors.textDisabled }]}>?</Text>
        )}
      </TouchableOpacity>
      <Text style={[styles.targetLabel, { color: colors.textSecondary }]}>{label}</Text>
    </Animated.View>
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
      ? { emoji: '🏆', title: 'All Sorted!',  sub: `Score: ${score} | Accuracy: ${accuracy}%` }
      : state === 'correct'
      ? streak >= STREAK_THRESHOLD
        ? { emoji: '🔥', title: 'On Fire!',   sub: `${streak} in a row! +${calcPoints(streak)} pts` }
        : { emoji: '⭐', title: 'Correct!',    sub: `Well sorted! +${calcPoints(streak)} pts` }
      : { emoji: '💪', title: 'Keep Going!', sub: 'Think about which is smallest or biggest!' };

  return (
    <Animated.View
      style={[
        styles.feedbackOverlay,
        { backgroundColor: `${DD_PRIMARY}E6`, opacity: fadeAnim },
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
        accessibilityLabel={state === 'complete' ? 'Play again' : 'Next question'}
      >
        <Text style={styles.nextBtnText}>
          {state === 'complete' ? '🔄 Play Again' : 'Next Round →'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const DragDropGameScreen = (): JSX.Element => {
  const navigation  = useNavigation<DragDropNavProp>();
  const route       = useRoute<DragDropRouteProp>();
  const { colors }  = useTheme();
  const { student } = useAuth();

  const difficulty = route.params?.difficulty ?? 'easy';
  const questions  = useMemo(() => shuffleArray(QUESTIONS), []);

  const [currentIndex,    setCurrentIndex]    = useState(0);
  const [slots,           setSlots]           = useState<TargetSlot[]>([]);
  const [selectedValue,   setSelectedValue]   = useState<number | null>(null);
  const [usedValues,      setUsedValues]      = useState<Set<number>>(new Set());
  const [feedbackState,   setFeedbackState]   = useState<FeedbackState>('hidden');
  const [showHint,        setShowHint]        = useState(false);
  const [isChecking,      setIsChecking]      = useState(false);
  const [stats, setStats] = useState<SessionStats>({
    score: 0, streak: 0, lives: MAX_LIVES,
    correct: 0, total: 0, startTime: Date.now(),
  });

  const currentQuestion = questions[currentIndex];
  const accuracy = stats.total > 0
    ? Math.round((stats.correct / stats.total) * 100)
    : 0;

  // Shuffled number tokens for display
  const shuffledNumbers = useMemo(
    () => shuffleArray(currentQuestion.numbers),
    [currentQuestion]
  );

  // ── Reset per question ────────────────────────────────────────────────────

  useEffect(() => {
    setSlots(initSlots(currentQuestion.targets));
    setSelectedValue(null);
    setUsedValues(new Set());
    setShowHint(false);
    setIsChecking(false);
  }, [currentIndex, currentQuestion]);

  // ── Token press — select or deselect ─────────────────────────────────────

  const handleTokenPress = useCallback((value: number): void => {
    setSelectedValue((prev) => (prev === value ? null : value));
  }, []);

  // ── Target slot press — place selected token or remove placed token ───────

  const handleSlotPress = useCallback(
    (targetId: string): void => {
      if (feedbackState !== 'hidden' || isChecking) return;

      setSlots((prev) => {
        const slotIndex = prev.findIndex((s) => s.targetId === targetId);
        if (slotIndex === -1) return prev;

        const slot = prev[slotIndex];

        // If a number is selected → place it
        if (selectedValue !== null) {
          // If slot already has a value, return old value to pool
          if (slot.placedValue !== null) {
            setUsedValues((u) => {
              const next = new Set(u);
              next.delete(slot.placedValue!);
              return next;
            });
          }

          const updated = [...prev];
          updated[slotIndex] = {
            ...slot,
            placedValue: selectedValue,
            state: 'filled',
          };

          setUsedValues((u) => new Set([...u, selectedValue]));
          setSelectedValue(null);
          return updated;
        }

        // If no number selected + slot has a value → remove it
        if (slot.placedValue !== null) {
          setUsedValues((u) => {
            const next = new Set(u);
            next.delete(slot.placedValue!);
            return next;
          });

          const updated = [...prev];
          updated[slotIndex] = { ...slot, placedValue: null, state: 'empty' };
          return updated;
        }

        return prev;
      });
    },
    [selectedValue, feedbackState, isChecking]
  );

  // ── Check answer ──────────────────────────────────────────────────────────

  const handleCheckAnswer = useCallback((): void => {
    // All slots must be filled before checking
    const allFilled = slots.every((s) => s.placedValue !== null);
    if (!allFilled || feedbackState !== 'hidden' || isChecking) return;

    setIsChecking(true);

    const allCorrect = slots.every((slot, i) => {
      const target = currentQuestion.targets[i];
      return slot.placedValue === target.expectedValue;
    });

    // Animate each slot result
    setSlots((prev) =>
      prev.map((slot, i) => ({
        ...slot,
        state: slot.placedValue === currentQuestion.targets[i].expectedValue
          ? 'correct'
          : 'wrong',
      }))
    );

    setStats((prev) => {
      const newStreak = allCorrect ? prev.streak + 1 : 0;
      return {
        ...prev,
        streak:  newStreak,
        lives:   allCorrect ? prev.lives : Math.max(0, prev.lives - 1),
        score:   allCorrect ? prev.score + calcPoints(newStreak) : prev.score,
        correct: allCorrect ? prev.correct + 1 : prev.correct,
        total:   prev.total + 1,
      };
    });

    setTimeout(
      () => setFeedbackState(allCorrect ? 'correct' : 'wrong'),
      800
    );
  }, [slots, feedbackState, isChecking, currentQuestion]);

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
      gameType:        'dragdrop',
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
      // Non-blocking
    }
  }, [stats, accuracy, difficulty, student]);

  const handleRestart = useCallback((): void => {
    setCurrentIndex(0);
    setFeedbackState('hidden');
    setSelectedValue(null);
    setUsedValues(new Set());
    setShowHint(false);
    setIsChecking(false);
    setStats({
      score: 0, streak: 0, lives: MAX_LIVES,
      correct: 0, total: 0, startTime: Date.now(),
    });
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const allFilled   = slots.length > 0 && slots.every((s) => s.placedValue !== null);
  const canCheck    = allFilled && feedbackState === 'hidden' && !isChecking;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={DD_PRIMARY} />

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

        {/* Instruction card */}
        <View style={[
          styles.instructionCard,
          { backgroundColor: colors.surface, borderColor: DD_LIGHT, ...Shadow.medium, shadowColor: DD_PRIMARY },
        ]}>
          <View style={[styles.typeBadge, { backgroundColor: DD_LIGHT }]}>
            <Text style={[styles.typeBadgeText, { color: DD_PRIMARY }]}>🎯 Drag & Drop</Text>
          </View>
          <Text style={[styles.instructionText, { color: colors.textPrimary }]}>
            {currentQuestion.instruction}
          </Text>
          <View style={[styles.visualChip, { backgroundColor: DD_BG }]}>
            <Text style={[styles.visualText, { color: DD_PRIMARY }]}>
              {currentQuestion.visual}
            </Text>
          </View>
        </View>

        {/* Number tokens */}
        <View style={[
          styles.tokensCard,
          { backgroundColor: colors.surface, borderColor: DD_LIGHT },
        ]}>
          <Text style={[styles.tokensLabel, { color: colors.textSecondary }]}>
            TAP A NUMBER TO SELECT IT
          </Text>
          <View style={styles.tokensRow}>
            {shuffledNumbers.map((num) => (
              <NumberToken
                key={`token-${num}`}
                value={num}
                isUsed={usedValues.has(num)}
                isSelected={selectedValue === num}
                onPress={handleTokenPress}
              />
            ))}
          </View>
          {selectedValue !== null && (
            <Text style={[styles.selectedHint, { color: DD_PRIMARY }]}>
              ✋ {selectedValue} selected — tap a box below to place it
            </Text>
          )}
        </View>

        {/* Target slots */}
        <View style={[
          styles.slotsCard,
          { backgroundColor: colors.surface, borderColor: DD_LIGHT },
        ]}>
          <Text style={[styles.slotsLabel, { color: colors.textSecondary }]}>
            TAP A BOX TO PLACE YOUR NUMBER
          </Text>
          <View style={styles.slotsRow}>
            {slots.map((slot, i) => (
              <TargetSlotView
                key={slot.targetId}
                slot={slot}
                label={currentQuestion.targets[i].label}
                isActive={selectedValue !== null && slot.state !== 'correct'}
                onPress={handleSlotPress}
                colors={colors}
              />
            ))}
          </View>
        </View>

        {/* Check button */}
        <TouchableOpacity
          style={[
            styles.checkBtn,
            { backgroundColor: canCheck ? DD_PRIMARY : colors.border },
          ]}
          onPress={handleCheckAnswer}
          disabled={!canCheck}
          accessibilityLabel="Check my answer"
        >
          <Text style={[
            styles.checkBtnText,
            { color: canCheck ? '#FFFFFF' : colors.textDisabled },
          ]}>
            {allFilled ? '✓ Check My Answer!' : `Fill all ${slots.length} boxes first`}
          </Text>
        </TouchableOpacity>

        {/* Hint */}
        {!showHint ? (
          <TouchableOpacity
            style={[styles.hintBtn, { backgroundColor: DD_LIGHT }]}
            onPress={() => setShowHint(true)}
            accessibilityLabel="Show hint"
          >
            <Text style={[styles.hintBtnText, { color: DD_PRIMARY }]}>
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

  // Instruction card
  instructionCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
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
  instructionText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold as any,
    textAlign: 'center',
    lineHeight: 22,
  },
  visualChip: {
    width: '100%',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  visualText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.extraBold as any,
    letterSpacing: 0.3,
  },

  // Tokens
  tokensCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  tokensLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.extraBold as any,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  tokensRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  token: {
    width: 60, height: 60,
    borderRadius: BorderRadius.md,
    borderWidth: 2.5,
    borderColor: DD_PRIMARY,
    backgroundColor: DD_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenUsed: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    opacity: 0.5,
  },
  tokenText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extraBold as any,
    color: DD_PRIMARY,
    includeFontPadding: false,
  },
  selectedHint: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold as any,
    textAlign: 'center',
  },

  // Slots
  slotsCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  slotsLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.extraBold as any,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  slotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  targetWrap: {
    alignItems: 'center',
    gap: 5,
  },
  targetSlot: {
    width: 64, height: 64,
    borderRadius: BorderRadius.md,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extraBold as any,
    includeFontPadding: false,
  },
  targetPlaceholder: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extraBold as any,
  },
  targetLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold as any,
  },

  // Check button
  checkBtn: {
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  checkBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.extraBold as any,
    letterSpacing: 0.3,
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

export default DragDropGameScreen;