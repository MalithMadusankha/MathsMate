import { useEffect, useRef, useState, JSX } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { extractApiError } from '../../services/api';
import { Spacing, BorderRadius, Shadow } from '../../constants/spacing';
import { TextStyles, FontSize, FontWeight } from '../../constants/typography';

// ─── Types ────────────────────────────────────────────────────────────────────

type RegisterNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

interface FormState {
  fullName: string;
  age: string;
  username: string;
  password: string;
  selectedAvatar: string;
}

interface FormErrors {
  fullName?: string;
  age?: string;
  username?: string;
  password?: string;
}

type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATARS = ['🧙‍♂️', '🦸‍♀️', '🤖', '🦊', '🐉'];

const AGE_OPTIONS = Array.from({ length: 8 }, (_, i) => `${i + 5}`);

const PASSWORD_STRENGTH_CONFIG: Record<
  PasswordStrength,
  { label: string; color: string; width: string }
> = {
  weak:   { label: 'Weak',   color: '#EF4444', width: '25%'  },
  fair:   { label: 'Fair',   color: '#F59E0B', width: '50%'  },
  good:   { label: 'Good',   color: '#3B82F6', width: '75%'  },
  strong: { label: 'Strong', color: '#22C55E', width: '100%' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getPasswordStrength = (password: string): PasswordStrength | null => {
  if (!password) return null;
  let score = 0;
  if (password.length >= 4) score++;
  if (password.length >= 7) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  const map: PasswordStrength[] = ['weak', 'fair', 'good', 'strong'];
  return map[score - 1] ?? 'weak';
};

const validateForm = (form: FormState): FormErrors => {
  const errors: FormErrors = {};
  if (!form.fullName.trim())
    errors.fullName = 'Please enter your full name';
  if (!form.age)
    errors.age = 'Please select your age';
  if (!form.username.trim() || form.username.length < 3)
    errors.username = 'Username must be at least 3 characters';
  if (!form.password || form.password.length < 4)
    errors.password = 'Password must be at least 4 characters';
  return errors;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StepIndicatorProps {
  totalSteps: number;
  currentStep: number;
  colors: ReturnType<typeof useTheme>['colors'];
}

const StepIndicator = ({
  totalSteps,
  currentStep,
  colors,
}: StepIndicatorProps): JSX.Element => (
  <View style={styles.stepRow}>
    {Array.from({ length: totalSteps }).map((_, i) => (
      <View
        key={i}
        style={[
          styles.stepDot,
          {
            backgroundColor:
              i < currentStep
                ? colors.accent           // completed
                : i === currentStep
                ? colors.primary          // current
                : colors.border,          // upcoming
          },
        ]}
      />
    ))}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────

interface AvatarPickerProps {
  selected: string;
  onSelect: (avatar: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

const AvatarPicker = ({
  selected,
  onSelect,
  colors,
}: AvatarPickerProps): JSX.Element => (
  <View style={styles.avatarSection}>
    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
      CHOOSE YOUR HERO
    </Text>
    <View style={styles.avatarRow}>
      {AVATARS.map((avatar) => (
        <TouchableOpacity
          key={avatar}
          style={[
            styles.avatarOpt,
            {
              backgroundColor:
                selected === avatar ? colors.primaryLight : colors.surfaceElevated,
              borderColor:
                selected === avatar ? colors.primary : 'transparent',
            },
          ]}
          onPress={() => onSelect(avatar)}
          accessibilityLabel={`Select avatar ${avatar}`}
        >
          <Text style={styles.avatarEmoji}>{avatar}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────

interface InputFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  error?: string;
  colors: ReturnType<typeof useTheme>['colors'];
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

const InputField = ({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  error,
  colors,
  autoCapitalize = 'none',
}: InputFieldProps): JSX.Element => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isFocused ? colors.surface : colors.primaryLight,
            borderColor: isFocused ? colors.primary : colors.border,
            color: colors.textPrimary,
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.textDisabled}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {error ? (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      ) : null}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

interface AgePickerProps {
  selected: string;
  onSelect: (age: string) => void;
  error?: string;
  colors: ReturnType<typeof useTheme>['colors'];
}

const AgePicker = ({
  selected,
  onSelect,
  error,
  colors,
}: AgePickerProps): JSX.Element => (
  <View style={styles.fieldWrap}>
    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
      AGE
    </Text>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.ageRow}
    >
      {AGE_OPTIONS.map((age) => (
        <TouchableOpacity
          key={age}
          style={[
            styles.ageChip,
            {
              backgroundColor:
                selected === age ? colors.primary : colors.primaryLight,
              borderColor:
                selected === age ? colors.primary : colors.border,
            },
          ]}
          onPress={() => onSelect(age)}
          accessibilityLabel={`Select age ${age}`}
        >
          <Text
            style={[
              styles.ageChipText,
              { color: selected === age ? '#fff' : colors.textSecondary },
            ]}
          >
            {age}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
    {error ? (
      <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
    ) : null}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────

interface PasswordStrengthBarProps {
  password: string;
  colors: ReturnType<typeof useTheme>['colors'];
}

const PasswordStrengthBar = ({
  password,
  colors,
}: PasswordStrengthBarProps): JSX.Element | null => {
  const strength = getPasswordStrength(password);
  if (!strength) return null;

  const config = PASSWORD_STRENGTH_CONFIG[strength];

  return (
    <View style={styles.strengthWrap}>
      <View style={[styles.strengthTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.strengthFill,
            { width: `${parseInt(config.width)}%`, backgroundColor: config.color },
          ]}
        />
      </View>
      <Text style={[styles.strengthLabel, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const RegisterScreen = (): JSX.Element => {
  const navigation = useNavigation<RegisterNavigationProp>();
  const { colors, isDark, toggleTheme } = useTheme();
  const { register } = useAuth();

  const [form, setForm] = useState<FormState>({
    fullName: '',
    age: '',
    username: '',
    password: '',
    selectedAvatar: AVATARS[0],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Animations
  const headerAnim  = useRef(new Animated.Value(0)).current;
  const formAnim    = useRef(new Animated.Value(0)).current;
  const floatAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(headerAnim, {
      toValue: 1,
      tension: 55,
      friction: 6,
      useNativeDriver: true,
    }).start();

    Animated.timing(formAnim, {
      toValue: 1,
      duration: 500,
      delay: 250,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFieldChange =
    (field: keyof FormState) =>
    (value: string): void => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setApiError(null);
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

  const handleRegister = async (): Promise<void> => {
    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setApiError(null);
    setIsLoading(true);
    try {
      await register({
        full_name: form.fullName,
        username: form.username,
        password: form.password,
        age: parseInt(form.age, 10),
        avatar: form.selectedAvatar,
      });
      // AppNavigator switches to Main automatically after auth state updates.
    } catch (error) {
      setApiError(extractApiError(error));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Derived styles ────────────────────────────────────────────────────────

  const headerAnimStyle = {
    opacity: headerAnim,
    transform: [
      {
        scale: headerAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.5, 1],
        }),
      },
      { translateY: floatAnim },
    ],
  };

  const formAnimStyle = {
    opacity: formAnim,
    transform: [
      {
        translateY: formAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [30, 0],
        }),
      },
    ],
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Row — Back + Theme Toggle */}
        <View style={styles.topRow}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back to login"
          >
            <Text style={[styles.iconBtnText, { color: colors.primary }]}>←</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]}
            onPress={toggleTheme}
            accessibilityLabel="Toggle dark and light mode"
          >
            <Text style={styles.iconBtnText}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <Animated.View style={[styles.headerSection, headerAnimStyle]}>
          <View style={[styles.mascotCircle, { backgroundColor: colors.primaryLight }]}>
            <Text style={styles.mascotEmoji}>🌟</Text>
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Join <Text style={{ color: colors.primary }}>MathsMate</Text>
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Create your adventure profile!
          </Text>
        </Animated.View>

        {/* Step Indicator */}
        <Animated.View style={formAnimStyle}>
          <StepIndicator totalSteps={3} currentStep={1} colors={colors} />
        </Animated.View>

        {/* Form Card */}
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.cardBorder,
              ...Shadow.medium,
              shadowColor: colors.shadow,
            },
            formAnimStyle,
          ]}
        >
          {/* Avatar Picker */}
          <AvatarPicker
            selected={form.selectedAvatar}
            onSelect={(avatar) =>
              setForm((prev) => ({ ...prev, selectedAvatar: avatar }))
            }
            colors={colors}
          />

          {/* Full Name */}
          <InputField
            label="FULL NAME"
            placeholder="Your full name"
            value={form.fullName}
            onChangeText={handleFieldChange('fullName')}
            error={errors.fullName}
            colors={colors}
            autoCapitalize="words"
          />

          {/* Age Picker */}
          <AgePicker
            selected={form.age}
            onSelect={handleFieldChange('age')}
            error={errors.age}
            colors={colors}
          />

          {/* Username */}
          <InputField
            label="USERNAME"
            placeholder="Pick a cool username"
            value={form.username}
            onChangeText={handleFieldChange('username')}
            error={errors.username}
            colors={colors}
          />

          {/* Password + Strength */}
          <InputField
            label="PASSWORD"
            placeholder="Create a secret password"
            value={form.password}
            onChangeText={handleFieldChange('password')}
            secureTextEntry
            error={errors.password}
            colors={colors}
          />
          <PasswordStrengthBar password={form.password} colors={colors} />

          {apiError ? (
            <Text style={[styles.apiError, { color: colors.error }]}>{apiError}</Text>
          ) : null}

          {/* Register Button */}
          <TouchableOpacity
            style={[
              styles.btnRegister,
              { backgroundColor: colors.primary },
              { marginTop: Spacing.md },
            ]}
            onPress={handleRegister}
            activeOpacity={0.85}
            accessibilityLabel="Create your MathsMate account"
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnRegisterText}>🚀 Create My Account!</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Footer */}
        <Animated.View style={[styles.footer, formAnimStyle]}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Already have an account?{' '}
            <Text
              style={[styles.footerLink, { color: colors.primary }]}
              onPress={() => navigation.navigate('Login')}
            >
              Sign In →
            </Text>
          </Text>

          <View style={styles.perksRow}>
            {['🎮 Free to Play', '🏆 Earn Badges', '📈 Track Progress'].map(
              (perk) => (
                <View
                  key={perk}
                  style={[styles.perk, { backgroundColor: colors.primaryLight }]}
                >
                  <Text style={[styles.perkText, { color: colors.primary }]}>
                    {perk}
                  </Text>
                </View>
              )
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
  },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: FontSize.lg },
  headerSection: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  mascotCircle: {
    width: 80, height: 80,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  mascotEmoji: { fontSize: 42 },
  title: {
    ...TextStyles.heading1,
    letterSpacing: -0.3,
  },
  subtitle: {
    ...TextStyles.caption,
    fontWeight: FontWeight.semiBold as any,
    marginTop: Spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  stepDot: {
    width: 32, height: 6,
    borderRadius: BorderRadius.full,
  },
  card: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: Spacing.xl,
  },

  // Avatar
  avatarSection: { marginBottom: Spacing.lg },
  avatarRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    flexWrap: 'wrap',
  },
  avatarOpt: {
    width: 52, height: 52,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 26 },

  // Fields
  fieldWrap: { marginBottom: Spacing.md },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold as any,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  input: {
    height: 50,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold as any,
  },
  errorText: {
    fontSize: FontSize.xs,
    marginTop: 4,
    marginLeft: 4,
  },
  apiError: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    fontWeight: FontWeight.semiBold as any,
  },

  // Age chips
  ageRow: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  ageChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  ageChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold as any,
  },

  // Password strength
  strengthWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  strengthTrack: {
    flex: 1, height: 5,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  strengthFill: { height: '100%', borderRadius: BorderRadius.full },
  strengthLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold as any,
    minWidth: 36,
  },

  // Button
  btnRegister: {
    height: 54,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRegisterText: {
    color: '#FFFFFF',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extraBold as any,
    letterSpacing: 0.3,
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  footerText: {
    ...TextStyles.caption,
    fontWeight: FontWeight.semiBold as any,
  },
  footerLink: { fontWeight: FontWeight.extraBold as any },
  perksRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  perk: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  perkText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold as any,
  },
});

export default RegisterScreen;