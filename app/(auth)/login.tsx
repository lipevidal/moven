import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  getLoginErrorMessage,
  loginWithPassword,
} from '../../src/features/auth/services/loginService';

type LoginErrors = {
  email?: string;
  password?: string;
};

const LOGO_SOURCE = require('../../assets/images/movenapp-logo.png');

const ROUTES = {
  dashboard: '/(private)/(tabs)/dashboard',
  forgotPassword: '/(auth)/forgot-password',
  register: '/(auth)/cadastro',
} as const;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export default function LoginScreen() {
  const scrollRef = useRef<any>(null);
  const emailInputRef = useRef<any>(null);
  const passwordInputRef = useRef<any>(null);
  const loginRequestRef = useRef(false);
  const { width } = useWindowDimensions();

  const compactMode = width < 370;

  const logoSize = useMemo(
    () => ({
      width: compactMode ? 184 : 224,
      height: compactMode ? 92 : 116,
    }),
    [compactMode],
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(
    null,
  );
  const [errors, setErrors] = useState<LoginErrors>({});

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';

    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 180);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setFocusedField(null);

      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }, 80);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const clearFieldError = useCallback((field: keyof LoginErrors) => {
    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  }, []);

  const validateFields = useCallback(() => {
    const nextErrors: LoginErrors = {};
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      nextErrors.email = 'Informe seu e-mail.';
    } else if (!isValidEmail(cleanEmail)) {
      nextErrors.email = 'Informe um e-mail válido.';
    }

    if (!password) {
      nextErrors.password = 'Informe sua senha.';
    } else if (password.length < 6) {
      nextErrors.password = 'A senha precisa ter pelo menos 6 caracteres.';
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }, [email, password]);

  const handleLogin = useCallback(async () => {
    try {
      if (loading || loginRequestRef.current) return;

      loginRequestRef.current = true;
      Keyboard.dismiss();

      await wait(140);

      const valid = validateFields();

      if (!valid) {
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);

        return;
      }

      setLoading(true);

      await loginWithPassword({
        email,
        password,
      });

      router.replace(ROUTES.dashboard as never);
    } catch (error: any) {
      const translatedMessage =
        error?.name === 'LoginServiceError'
          ? error.message
          : getLoginErrorMessage(error?.message);

      setErrors((current) => ({
        ...current,
        password: translatedMessage,
      }));

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);

      Alert.alert('Não foi possível entrar', translatedMessage);
    } finally {
      setLoading(false);
      loginRequestRef.current = false;
    }
  }, [email, loading, password, validateFields]);

  const openForgotPassword = useCallback(() => {
    router.push(ROUTES.forgotPassword as never);
  }, []);

  const openRegister = useCallback(() => {
    router.push(ROUTES.register as never);
  }, []);

  const toggleShowPassword = useCallback(() => {
    setShowPassword((current) => !current);
  }, []);

  const scrollToButtons = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          keyboardVisible && styles.scrollContentKeyboard,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustKeyboardInsets={false}
        overScrollMode="never"
        bounces={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.logoFrame}>
            <Image
              source={LOGO_SOURCE}
              style={[
                styles.logo,
                logoSize,
                keyboardVisible && styles.logoKeyboard,
              ]}
              resizeMode="contain"
            />
          </View>

          <View style={styles.heroTextBox}>
            <Text style={styles.eyebrow}>Controle financeiro e comunidade</Text>
            <Text style={styles.title}>Entre na sua conta</Text>
            
          </View>

          {!keyboardVisible ? (
            <View style={styles.benefitsRow}>
              <View style={styles.benefitChip}>
                <Ionicons name="analytics-outline" size={14} color="#D4A64A" />
                <Text style={styles.benefitText}>Ganhos</Text>
              </View>

              <View style={styles.benefitChip}>
                <Ionicons name="car-sport-outline" size={14} color="#D4A64A" />
                <Text style={styles.benefitText}>Jornadas</Text>
              </View>

              <View style={styles.benefitChip}>
                <Ionicons name="people-outline" size={14} color="#D4A64A" />
                <Text style={styles.benefitText}>Comunidade</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>E-mail</Text>

          <TouchableOpacity
            activeOpacity={1}
            onPress={() => emailInputRef.current?.focus?.()}
            style={[
              styles.inputContainer,
              focusedField === 'email' && styles.inputContainerFocused,
              errors.email && styles.inputContainerError,
            ]}
          >
            <View
              style={[
                styles.inputIconBox,
                focusedField === 'email' && styles.inputIconBoxFocused,
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={18}
                color={focusedField === 'email' ? '#D4A64A' : '#9B969B'}
              />
            </View>

            <TextInput
              ref={emailInputRef}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                clearFieldError('email');
              }}
              placeholder="seuemail@exemplo.com"
              placeholderTextColor="#6F6A72"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
              textContentType="emailAddress"
              autoComplete="email"
              style={styles.input}
              editable={!loading}
              showSoftInputOnFocus
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />
          </TouchableOpacity>

          {errors.email ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color="#F87171" />
              <Text style={styles.errorText}>{errors.email}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Senha</Text>

          <TouchableOpacity
            activeOpacity={1}
            onPress={() => passwordInputRef.current?.focus?.()}
            style={[
              styles.inputContainer,
              focusedField === 'password' && styles.inputContainerFocused,
              errors.password && styles.inputContainerError,
            ]}
          >
            <View
              style={[
                styles.inputIconBox,
                focusedField === 'password' && styles.inputIconBoxFocused,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={focusedField === 'password' ? '#D4A64A' : '#9B969B'}
              />
            </View>

            <TextInput
              ref={passwordInputRef}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                clearFieldError('password');
              }}
              placeholder="Digite sua senha"
              placeholderTextColor="#6F6A72"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              textContentType="password"
              autoComplete="current-password"
              style={styles.input}
              editable={!loading}
              showSoftInputOnFocus
              onFocus={() => {
                setFocusedField('password');
                scrollToButtons();
              }}
              onBlur={() => setFocusedField(null)}
              onSubmitEditing={handleLogin}
            />

            <TouchableOpacity
              style={styles.passwordIconButton}
              onPress={toggleShowPassword}
              activeOpacity={0.8}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={showPassword ? '#D4A64A' : '#9B969B'}
              />
            </TouchableOpacity>
          </TouchableOpacity>

          {errors.password ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color="#F87171" />
              <Text style={styles.errorText}>{errors.password}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.forgotButton}
            onPress={openForgotPassword}
            activeOpacity={0.85}
          >
            <Text style={styles.forgotButtonText}>Esqueci minha senha</Text>
            <Ionicons name="chevron-forward" size={16} color="#D4A64A" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.92}
          >
            {loading ? (
              <ActivityIndicator color="#080808" />
            ) : (
              <>
                <Text style={styles.buttonText}>Entrar agora</Text>
                <View style={styles.buttonIconCircle}>
                  <Ionicons name="arrow-forward" size={19} color="#080808" />
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.registerCard}
          onPress={openRegister}
          activeOpacity={0.88}
        >
          <View style={styles.registerIconBox}>
            <Ionicons name="person-add-outline" size={18} color="#D4A64A" />
          </View>

          <View style={styles.registerTextBox}>
            <Text style={styles.registerTitle}>Ainda não tem conta?</Text>
            <Text style={styles.registerSubtitle}>Crie sua conta em poucos passos.</Text>
          </View>

          <Ionicons name="chevron-forward" size={19} color="#8F8A91" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },

  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 34,
    justifyContent: 'center',
  },

  scrollContentKeyboard: {
    justifyContent: 'flex-start',
    paddingTop: 14,
    paddingBottom: 260,
  },

  heroCard: {
    overflow: 'hidden',
    borderRadius: 30,
    borderWidth: 0,
    
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    alignItems: 'center',
    marginBottom: 14,
  },

  logoFrame: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },

  logo: {
    width: 224,
    height: 116,
  },

  logoKeyboard: {
    width: 150,
    height: 62,
  },

  heroTextBox: {
    alignItems: 'center',
    marginTop: 2,
  },

  eyebrow: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 7,
  },

  title: {
    color: '#F5F0E6',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.8,
  },

  subtitle: {
    color: '#A8A3AB',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '700',
    marginTop: 8,
    maxWidth: 300,
  },

  benefitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },

  benefitChip: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
  },

  benefitText: {
    color: '#F5F0E6',
    fontSize: 11,
    fontWeight: '900',
  },

  formCard: {
    overflow: 'hidden',
    backgroundColor: 'rgba(11,11,15,0.96)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#25222A',
    padding: 16,
  },

  label: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  inputContainer: {
    minHeight: 58,
    backgroundColor: '#121217',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingLeft: 9,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  inputContainerFocused: {
    borderColor: 'rgba(212,166,74,0.72)',
    backgroundColor: '#17151A',
  },

  inputContainerError: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },

  inputIconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#1C1B21',
    alignItems: 'center',
    justifyContent: 'center',
  },

  inputIconBoxFocused: {
    backgroundColor: 'rgba(212,166,74,0.14)',
  },

  input: {
    flex: 1,
    height: 56,
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '800',
    paddingVertical: 0,
  },

  passwordIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorBox: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 7,
    marginTop: 9,
    paddingHorizontal: 4,
  },

  errorText: {
    color: '#F87171',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },

  forgotButton: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    marginTop: 14,
    marginBottom: 2,
    paddingVertical: 5,
  },

  forgotButtonText: {
    color: '#D4A64A',
    fontSize: 13,
    fontWeight: '900',
  },

  button: {
    overflow: 'hidden',
    height: 60,
    backgroundColor: '#D4A64A',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },

  buttonDisabled: {
    opacity: 0.68,
  },

  buttonText: {
    color: '#080808',
    fontSize: 16,
    fontWeight: '900',
  },

  buttonIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(8,8,8,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  registerCard: {
    minHeight: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(16,16,20,0.72)',
    borderWidth: 1,
    borderColor: '#25222A',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginTop: 14,
  },

  registerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(212,166,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  registerTextBox: {
    flex: 1,
    minWidth: 0,
  },

  registerTitle: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
  },

  registerSubtitle: {
    color: '#8F8A91',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
});
