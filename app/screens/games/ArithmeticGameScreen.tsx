import { useCallback, useEffect, useMemo, useRef, useState, JSX } from 'react';
import {
  Animated,
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
import { AdaptResponse, GameResult, GameType } from '../../types';
import GameTopBar from '../../components/games/GameTopBar';
import GameStatChip from '../../components/games/GameStatChip';

type ArithmeticNavProp = NativeStackNavigationProp<GameStackParamList, 'ArithmeticGame'>;
type ArithmeticRouteProp = RouteProp<GameStackParamList, 'ArithmeticGame'>;

type FeedbackState = 'hidden' | 'correct' | 'wrong' | 'complete';
type AnswerState = 'idle' | 'correct' | 'wrong';
type Difficulty = 'easy' | 'medium' | 'hard';

interface ArithmeticQuestion {
  id: string;
  left: number;
  right: number;
  operator: '+' | '-' | 'x';
  hint: string;
}

interface SessionStats {
  score: number;
  streak: number;
  lives: number;
  correct: number;
  total: number;
  startTime: number;
}

const TOTAL_QUESTIONS = 8;
const MAX_LIVES = 3;
const BASE_POINTS = 12;
const STREAK_BONUS = 3;

const QUESTION_BANK: Record<Difficulty, ArithmeticQuestion[]> = {
  easy: [
    { id: 'e1', left: 2, right: 3, operator: '+', hint: 'Try counting forward from 2.' },
    { id: 'e2', left: 7, right: 4, operator: '-', hint: 'Think: if you have 7 and remove 4, how many remain?' },
    { id: 'e3', left: 5, right: 2, operator: '+', hint: '5 + 2 is two steps after 5.' },
    { id: 'e4', left: 9, right: 3, operator: '-', hint: 'Use your fingers and fold 3 down.' },
    { id: 'e5', left: 4, right: 4, operator: '+', hint: 'Doubles can be quick: 4 + 4.' },
    { id: 'e6', left: 6, right: 1, operator: '-', hint: 'Subtracting 1 gives the previous number.' },
    { id: 'e7', left: 3, right: 5, operator: '+', hint: 'Count up from 5 three times.' },
    { id: 'e8', left: 10, right: 2, operator: '-', hint: '10 minus 2 is 2 less than 10.' },
  ],
  medium: [
    { id: 'm1', left: 8, right: 6, operator: '+', hint: 'Make ten first: 8 + 2 + 4.' },
    { id: 'm2', left: 14, right: 7, operator: '-', hint: 'Half of 14 is 7.' },
    { id: 'm3', left: 6, right: 4, operator: 'x', hint: '6 groups of 4, or 4 + 4 + 4 + 4 + 4 + 4.' },
    { id: 'm4', left: 13, right: 5, operator: '+', hint: '13 + 5 = 13 + 2 + 3.' },
    { id: 'm5', left: 18, right: 9, operator: '-', hint: '18 minus 9 is the number between 8 and 10.' },
    { id: 'm6', left: 7, right: 3, operator: 'x', hint: '7 x 3 means 7 + 7 + 7.' },
    { id: 'm7', left: 15, right: 6, operator: '+', hint: '15 + 5 + 1.' },
    { id: 'm8', left: 20, right: 8, operator: '-', hint: 'Subtract 10, then add 2 back.' },
  ],
  hard: [
    { id: 'h1', left: 12, right: 9, operator: '+', hint: '12 + 8 + 1.' },
    { id: 'h2', left: 28, right: 13, operator: '-', hint: 'Subtract 10 then subtract 3.' },
    { id: 'h3', left: 9, right: 8, operator: 'x', hint: '10 x 8 minus 8.' },
    { id: 'h4', left: 17, right: 16, operator: '+', hint: '17 + 10 + 6.' },
    { id: 'h5', left: 36, right: 19, operator: '-', hint: '36 - 20 + 1.' },
    { id: 'h6', left: 11, right: 7, operator: 'x', hint: '11 x 7 is 10 x 7 + 7.' },
    { id: 'h7', left: 29, right: 14, operator: '+', hint: '29 + 1 + 13.' },
    { id: 'h8', left: 48, right: 22, operator: '-', hint: '48 - 20 - 2.' },
  ],
};

const mapDifficulty = (difficulty?: Difficulty): Difficulty => difficulty ?? 'easy';

const shuffle = <T,>(items: T[]): T[] => [...items].sort(() => Math.random() - 0.5);

const answerFor = (q: ArithmeticQuestion): number => {
  if (q.operator === '+') return q.left + q.right;
  if (q.operator === '-') return q.left - q.right;
  return q.left * q.right;
};

const generateOptions = (answer: number): number[] => {
  const options = new Set<number>([answer]);
  let guard = 0;
  while (options.size < 4 && guard < 25) {
    const offset = Math.floor(Math.random() * 15) - 7;
    const candidate = answer + offset;
    if (candidate >= 0 && candidate !== answer) options.add(candidate);
    guard++;
  }
  return shuffle(Array.from(options));
};

const calcPoints = (streak: number): number => BASE_POINTS + streak * STREAK_BONUS;

const nextRouteFromGameType = (type: GameType): keyof GameStackParamList => {
  if (type === 'counting') return 'CountingGame';
  if (type === 'comparison') return 'ComparisonGame';
  if (type === 'arithmetic') return 'ArithmeticGame';
  return 'ArithmeticGame';
};

interface ChoiceButtonProps {
  value: number;
  state: AnswerState;
  onPress: (v: number) => void;
  disabled: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}

const ChoiceButton = ({ value, state, onPress, disabled, colors }: ChoiceButtonProps): JSX.Element => {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  const bgColor =
    state === 'correct' ? colors.success :
    state === 'wrong' ? colors.error :
    colors.surface;

  const borderColor =
    state === 'correct' ? colors.success :
    state === 'wrong' ? colors.error :
    colors.cardBorder;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.choiceBtn, { backgroundColor: bgColor, borderColor }]}
        onPress={() => onPress(value)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        disabled={disabled}
        accessibilityLabel={`Answer ${value}`}
      >
        <Text style={[styles.choiceText, { color: state === 'idle' ? colors.textPrimary : '#fff' }]}>
          {value}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

interface FeedbackOverlayProps {
  state: FeedbackState;
  score: number;
  accuracy: number;
  recommendation: AdaptResponse | null;
  onNext: () => void;
  onPlayRecommended: () => void;
  onRestart: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

const FeedbackOverlay = ({
  state,
  score,
  accuracy,
  recommendation,
  onNext,
  onPlayRecommended,
  onRestart,
  colors,
}: FeedbackOverlayProps): JSX.Element | null => {
  if (state === 'hidden') return null;

  const complete = state === 'complete';

  return (
    <View style={[styles.feedbackOverlay, { backgroundColor: `${colors.primary}E6` }]}> 
      <Text style={styles.feedbackEmoji}>{complete ? '🏆' : state === 'correct' ? '✨' : '💡'}</Text>
      <Text style={styles.feedbackTitle}>
        {complete ? 'Round Complete!' : state === 'correct' ? 'Great Job!' : 'Try Again!'}
      </Text>
      <Text style={styles.feedbackSub}>
        {complete ? `Score ${score} | Accuracy ${accuracy}%` : 'Keep building your math power!'}
      </Text>

      {complete && recommendation ? (
        <View style={styles.recommendBox}>
          <Text style={styles.recommendTitle}>Next Recommended</Text>
          <Text style={styles.recommendBody}>
            {recommendation.nextGameType.toUpperCase()} • {recommendation.difficulty.toUpperCase()} • {recommendation.showHints ? 'Hints ON' : 'Hints OFF'}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: colors.reward ?? '#FFD700' }]}
        onPress={complete ? onRestart : onNext}
      >
        <Text style={styles.actionBtnText}>{complete ? '🔄 Play Again' : 'Next Question →'}</Text>
      </TouchableOpacity>

      {complete && recommendation ? (
        <TouchableOpacity
          style={[styles.secondaryActionBtn, { borderColor: '#fff' }]}
          onPress={onPlayRecommended}
        >
          <Text style={styles.secondaryActionBtnText}>🚀 Play Recommended Game</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const ArithmeticGameScreen = (): JSX.Element => {
  const navigation = useNavigation<ArithmeticNavProp>();
  const route = useRoute<ArithmeticRouteProp>();
  const { colors } = useTheme();
  const { student } = useAuth();

  const difficulty = mapDifficulty(route.params?.difficulty);
  const questions = useMemo(
    () => shuffle(QUESTION_BANK[difficulty]).slice(0, TOTAL_QUESTIONS),
    [difficulty]
  );

  const [index, setIndex] = useState(0);
  const [options, setOptions] = useState<number[]>([]);
  const [feedbackState, setFeedbackState] = useState<FeedbackState>('hidden');
  const [answerStates, setAnswerStates] = useState<Record<number, AnswerState>>({});
  const [showHint, setShowHint] = useState(false);
  const [adaptResponse, setAdaptResponse] = useState<AdaptResponse | null>(null);
  const [stats, setStats] = useState<SessionStats>({
    score: 0,
    streak: 0,
    lives: MAX_LIVES,
    correct: 0,
    total: 0,
    startTime: Date.now(),
  });

  const question = questions[index];
  const correctAnswer = answerFor(question);
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const progressPct = Math.round((index / TOTAL_QUESTIONS) * 100);

  useEffect(() => {
    setOptions(generateOptions(correctAnswer));
    setAnswerStates({});
    setShowHint(false);
  }, [correctAnswer, index]);

  const handleAnswer = useCallback(
    (value: number): void => {
      if (feedbackState !== 'hidden') return;

      const isCorrect = value === correctAnswer;

      setStats((prev) => {
        const streak = isCorrect ? prev.streak + 1 : 0;
        return {
          ...prev,
          streak,
          lives: isCorrect ? prev.lives : Math.max(0, prev.lives - 1),
          score: isCorrect ? prev.score + calcPoints(streak) : prev.score,
          correct: isCorrect ? prev.correct + 1 : prev.correct,
          total: prev.total + 1,
        };
      });

      const nextStates: Record<number, AnswerState> = {
        [value]: isCorrect ? 'correct' : 'wrong',
      };
      if (!isCorrect) nextStates[correctAnswer] = 'correct';
      setAnswerStates(nextStates);

      setTimeout(() => setFeedbackState(isCorrect ? 'correct' : 'wrong'), 450);
    },
    [correctAnswer, feedbackState]
  );

  const persistAndAdapt = useCallback(async (): Promise<void> => {
    const result: GameResult = {
      gameType: 'arithmetic',
      score: stats.score,
      accuracy,
      streak: stats.streak,
      totalQuestions: TOTAL_QUESTIONS,
      correctAnswers: stats.correct,
      durationSeconds: Math.round((Date.now() - stats.startTime) / 1000),
      difficulty,
    };

    if (!student?.id) return;

    const payload = {
      studentId: student.id,
      gameType: result.gameType,
      accuracy: result.accuracy / 100,
      responseTime: result.durationSeconds > 0 ? result.durationSeconds / result.totalQuestions : 1,
      attempts: result.totalQuestions,
      engagementScore: Math.min(result.streak / result.totalQuestions, 1),
      timestamp: new Date().toISOString(),
    };

    try {
      await sessionsApi.save(payload);
      const adapt = await adaptApi.next(payload);
      setAdaptResponse(adapt.data);
    } catch {
      // Keep UX uninterrupted even if API call fails.
    }
  }, [accuracy, difficulty, stats, student?.id]);

  const handleNext = useCallback((): void => {
    setFeedbackState('hidden');
    if (index + 1 >= TOTAL_QUESTIONS) {
      setFeedbackState('complete');
      persistAndAdapt();
      return;
    }
    setIndex((prev) => prev + 1);
  }, [index, persistAndAdapt]);

  const handleRestart = useCallback((): void => {
    setIndex(0);
    setFeedbackState('hidden');
    setAnswerStates({});
    setShowHint(false);
    setAdaptResponse(null);
    setStats({
      score: 0,
      streak: 0,
      lives: MAX_LIVES,
      correct: 0,
      total: 0,
      startTime: Date.now(),
    });
  }, []);

  const handlePlayRecommended = useCallback((): void => {
    if (!adaptResponse) return;
    navigation.replace(nextRouteFromGameType(adaptResponse.nextGameType), {
      difficulty: adaptResponse.difficulty,
    });
  }, [adaptResponse, navigation]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}> 
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <GameTopBar
        title="➕ Arithmetic Arena"
        subtitle="Mental Math Adventure"
        lives={stats.lives}
        maxLives={MAX_LIVES}
        onBack={() => navigation.goBack()}
      />

      <View style={[styles.progressWrap, { backgroundColor: colors.primaryDark }]}> 
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressText}>Question {index + 1}/{TOTAL_QUESTIONS}</Text>
          <Text style={styles.progressText}>{progressPct}%</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.2)' }]}> 
          <Animated.View
            style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: '#FFD700' }]}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}> 
        <View style={styles.statsRow}>
          <GameStatChip value={`${stats.score}`} label="⭐ Score" />
          <GameStatChip value={`${stats.streak}🔥`} label="Streak" />
          <GameStatChip value={stats.total > 0 ? `${accuracy}%` : '—'} label="Accuracy" />
        </View>

        <View
          style={[
            styles.questionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.cardBorder,
              ...Shadow.medium,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <Text style={[styles.questionLabel, { color: colors.textSecondary }]}>Solve This</Text>
          <Text style={[styles.equation, { color: colors.textPrimary }]}> 
            {question.left} {question.operator} {question.right} = ?
          </Text>
          <Text style={[styles.helperText, { color: colors.textSecondary }]}> 
            Pick the correct answer below
          </Text>
        </View>

        <View style={styles.answersGrid}>
          {options.map((opt) => (
            <ChoiceButton
              key={opt}
              value={opt}
              state={answerStates[opt] ?? 'idle'}
              onPress={handleAnswer}
              disabled={feedbackState !== 'hidden'}
              colors={colors}
            />
          ))}
        </View>

        {!showHint ? (
          <TouchableOpacity
            style={[styles.hintBtn, { backgroundColor: colors.primaryLight }]}
            onPress={() => setShowHint(true)}
          >
            <Text style={[styles.hintBtnText, { color: colors.primary }]}>💡 Show Hint</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>💡 {question.hint}</Text>
          </View>
        )}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>

      <FeedbackOverlay
        state={feedbackState}
        score={stats.score}
        accuracy={accuracy}
        recommendation={adaptResponse}
        onNext={handleNext}
        onPlayRecommended={handlePlayRecommended}
        onRestart={handleRestart}
        colors={colors}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  progressWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  progressText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold as any,
  },
  progressTrack: {
    height: 8,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  scroll: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  questionCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  questionLabel: {
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: FontWeight.bold as any,
    marginBottom: Spacing.xs,
  },
  equation: {
    fontSize: 44,
    fontWeight: FontWeight.extraBold as any,
    lineHeight: 52,
  },
  helperText: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold as any,
  },
  answersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  choiceBtn: {
    width: 156,
    height: 74,
    borderRadius: BorderRadius.lg,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: {
    fontSize: 30,
    fontWeight: FontWeight.extraBold as any,
    includeFontPadding: false,
  },
  hintBtn: {
    height: 48,
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
    borderColor: '#F5A623',
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  hintText: {
    color: '#B45309',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold as any,
    textAlign: 'center',
  },
  feedbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  feedbackEmoji: {
    fontSize: 64,
  },
  feedbackTitle: {
    color: '#fff',
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extraBold as any,
  },
  feedbackSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold as any,
  },
  recommendBox: {
    marginTop: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  recommendTitle: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold as any,
    letterSpacing: 0.5,
  },
  recommendBody: {
    marginTop: 2,
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold as any,
    textAlign: 'center',
  },
  actionBtn: {
    marginTop: Spacing.sm,
    minWidth: 220,
    height: 50,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  actionBtnText: {
    color: '#3F2A00',
    fontSize: FontSize.md,
    fontWeight: FontWeight.extraBold as any,
  },
  secondaryActionBtn: {
    minWidth: 220,
    height: 46,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  secondaryActionBtnText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold as any,
  },
});

export default ArithmeticGameScreen;