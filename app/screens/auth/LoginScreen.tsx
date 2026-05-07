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

// ─── Types ───────────────────────────────────────────────────────────────────

type LoginNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

interface FormState {
  username: string;
  password: string;
}

interface FormErrors {
  username?: string;
  password?: string;
}

// ─── Validation ──────────────────────────────────────────────────────────────

const validateForm = (form: FormState): FormErrors => {
  const errors: FormErrors = {};
  if (!form.username.trim()) errors.username = 'Please enter your name';
  if (!form.password || form.password.length < 4)
    errors.password = 'Password must be at least 4 characters';
  return errors;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

interface InputFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  error?: string;
  colors: ReturnType<typeof useTheme>['colors'];
}

const InputField = ({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  error,
  colors,
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
            backgroundColor: colors.primaryLight,
            borderColor: isFocused ? colors.primary : colors.border,
            color: colors.textPrimary,
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.textDisabled}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {error ? (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      ) : null}
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

const LoginScreen = (): JSX.Element => {
  const navigation = useNavigation<LoginNavigationProp>();
  const { colors, isDark, toggleTheme } = useTheme();
  const { login } = useAuth();

  // Form state
  const [form, setForm] = useState<FormState>({ username: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Animation refs
  const logoAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // ── Entrance animations ───────────────────────────────────────────────────

  useEffect(() => {
    // Logo pop-in
    Animated.spring(logoAnim, {
      toValue: 1,
      tension: 60,
      friction: 6,
      useNativeDriver: true,
    }).start();

    // Form slide-up
    Animated.timing(formAnim, {
      toValue: 1,
      duration: 500,
      delay: 300,
      useNativeDriver: true,
    }).start();

    // Continuous mascot float
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleFieldChange = (field: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setApiError(null);
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleLogin = async (): Promise<void> => {
    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setApiError(null);
    setIsLoading(true);
    try {
      await login(form.username, form.password);
      // AppNavigator switches to Main automatically after auth state updates.
    } catch (error) {
      setApiError(extractApiError(error));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Derived animation values ──────────────────────────────────────────────

  const logoStyle = {
    opacity: logoAnim,
    transform: [
      {
        scale: logoAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.4, 1],
        }),
      },
      { translateY: floatAnim },
    ],
  };

  const formStyle = {
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
        {/* Theme toggle */}
        <TouchableOpacity
          style={[styles.themeBtn, { backgroundColor: colors.primaryLight }]}
          onPress={toggleTheme}
          accessibilityLabel="Toggle dark and light mode"
        >
          <Text style={styles.themeBtnIcon}>{isDark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>

        {/* Mascot + App Name */}
        <Animated.View style={[styles.logoSection, logoStyle]}>
          <View style={[styles.mascotCircle, { backgroundColor: colors.primaryLight }]}>
            <Text style={styles.mascotEmoji}>🧙‍♂️</Text>
          </View>
          <Text style={[styles.appName, { color: colors.textPrimary }]}>
            Maths<Text style={{ color: colors.primary }}>Mate</Text>
          </Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            ✨ Learn Math Through Adventure!
          </Text>
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
            formStyle,
          ]}
        >
          <InputField
            label="Username"
            placeholder="Enter your name"
            value={form.username}
            onChangeText={handleFieldChange('username')}
            error={errors.username}
            colors={colors}
          />

          <InputField
            label="Password"
            placeholder="Secret password"
            value={form.password}
            onChangeText={handleFieldChange('password')}
            secureTextEntry
            error={errors.password}
            colors={colors}
          />

          {apiError ? (
            <Text style={[styles.apiError, { color: colors.error }]}>{apiError}</Text>
          ) : null}

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.btnLogin, { backgroundColor: colors.primary }]}
            onPress={handleLogin}
            activeOpacity={0.85}
            accessibilityLabel="Start your math adventure"
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnLoginText}>🚀 Start Adventure!</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textDisabled }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Google Button */}
          <TouchableOpacity
            style={[styles.btnGoogle, { borderColor: colors.border }]}
            activeOpacity={0.85}
            accessibilityLabel="Continue with Google"
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={[styles.btnGoogleText, { color: colors.textPrimary }]}>
              Continue with Google
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Register Link */}
        <Animated.View style={[styles.footer, formStyle]}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            New here?{' '}
            <Text
              style={[styles.footerLink, { color: colors.primary }]}
              onPress={() => navigation.navigate('Register')}
            >
              Create Account →
            </Text>
          </Text>

          {/* Social Proof Badges */}
          <View style={styles.badgeRow}>
            {['⭐ 50K+ Kids', '🏆 Top Rated', '🎮 Fun Math'].map((badge) => (
              <View
                key={badge}
                style={[styles.badge, { backgroundColor: colors.primaryLight }]}
              >
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {badge}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  themeBtn: {
    alignSelf: 'flex-end',
    marginTop: Spacing.xl,
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeBtnIcon: {
    fontSize: 18,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  mascotCircle: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  mascotEmoji: {
    fontSize: 52,
  },
  appName: {
    ...TextStyles.displayTitle,
    letterSpacing: -0.5,
  },
  tagline: {
    ...TextStyles.body,
    marginTop: Spacing.xs,
  },
  card: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: Spacing.xl,
  },
  fieldWrap: {
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold as any,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
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
  btnLogin: {
    height: 54,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  btnLoginText: {
    color: '#FFFFFF',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extraBold as any,
    letterSpacing: 0.3,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold as any,
    letterSpacing: 0.8,
  },
  btnGoogle: {
    height: 50,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  googleIcon: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extraBold as any,
    color: '#4285F4',
  },
  btnGoogleText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold as any,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.lg,
  },
  footerText: {
    ...TextStyles.body,
    fontWeight: FontWeight.semiBold as any,
  },
  footerLink: {
    fontWeight: FontWeight.extraBold as any,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold as any,
  },
});

export default LoginScreen;