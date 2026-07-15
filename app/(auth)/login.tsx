import { useCallback, useEffect, useRef, useState } from 'react';

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
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { supabase } from '../../src/database/supabase';

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

function getLoginErrorMessage(message?: string) {
  const normalizedMessage = String(message ?? '').toLowerCase();

  if (
    normalizedMessage.includes('invalid login credentials') ||
    normalizedMessage.includes('invalid credentials')
  ) {
    return 'E-mail ou senha incorretos. Verifique os dados e tente novamente.';
  }

  if (
    normalizedMessage.includes('email not confirmed') ||
    normalizedMessage.includes('email_not_confirmed')
  ) {
    return 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.';
  }

  if (
    normalizedMessage.includes('too many requests') ||
    normalizedMessage.includes('rate limit')
  ) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }

  if (
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('fetch')
  ) {
    return 'Não foi possível conectar. Verifique sua internet e tente novamente.';
  }

  return 'Não foi possível entrar. Verifique seus dados e tente novamente.';
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Tela de login.
 *
 * Correção aplicada para teclado:
 * - Removido KeyboardAvoidingView, que no Android/Expo pode causar faixa branca.
 * - A tela agora usa View + ScrollView com fundo preto em todos os níveis.
 * - Quando o teclado abre, o conteúdo deixa de ficar centralizado e passa para o topo.
 * - A tela rola automaticamente para o fim, liberando acesso ao botão Entrar.
 * - Ao fechar o teclado, volta para o topo e remove o espaço extra inferior.
 */
export default function LoginScreen() {
  const scrollRef = useRef<any>(null);
  const loginRequestRef = useRef(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [keyboardVisible, setKeyboardVisible] = useState(false);
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
      /**
       * Evita duplo clique, inclusive durante o pequeno intervalo usado
       * para fechar o teclado antes de iniciar o processamento.
       */
      if (loading || loginRequestRef.current) return;

      loginRequestRef.current = true;

      /**
       * Primeiro fecha o teclado.
       * Só depois a validação/loading/requisição começam.
       */
      Keyboard.dismiss();

      /**
       * Pequena pausa para dar tempo do teclado iniciar o fechamento
       * antes de mudar layout, exibir loading ou chamar o Supabase.
       */
      await wait(140);

      const valid = validateFields();

      if (!valid) {
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);

        return;
      }

      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        const translatedMessage = getLoginErrorMessage(error.message);

        setErrors((current) => ({
          ...current,
          password: translatedMessage,
        }));

        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);

        Alert.alert('Não foi possível entrar', translatedMessage);
        return;
      }

      router.replace(ROUTES.dashboard as never);
    } catch (error: any) {
      const translatedMessage = getLoginErrorMessage(error?.message);

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
          <View style={styles.logoShell}>
            <Image
              source={LOGO_SOURCE}
              style={[
                styles.logo,
                keyboardVisible && styles.logoKeyboard,
              ]}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>Entrar</Text>

          <Text style={styles.subtitle}>
            Controle sua rotina financeira
          </Text>

          <Text style={styles.subtitle}>
            Motoristas de aplicativos e entregadores.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>E-mail</Text>

          <View
            style={[
              styles.inputContainer,
              errors.email && styles.inputContainerError,
            ]}
          >
            <Ionicons name="mail-outline" size={20} color="#9B969B" />

            <TextInput
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                clearFieldError('email');
              }}
              placeholder="seuemail@exemplo.com"
              placeholderTextColor="#71717A"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
              textContentType="emailAddress"
              autoComplete="email"
              style={styles.input}
            />
          </View>

          {errors.email ? (
            <Text style={styles.errorText}>{errors.email}</Text>
          ) : null}

          <Text style={styles.label}>Senha</Text>

          <View
            style={[
              styles.inputContainer,
              errors.password && styles.inputContainerError,
            ]}
          >
            <Ionicons name="lock-closed-outline" size={20} color="#9B969B" />

            <TextInput
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                clearFieldError('password');
              }}
              placeholder="Digite sua senha"
              placeholderTextColor="#71717A"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              textContentType="password"
              autoComplete="current-password"
              style={styles.input}
              onFocus={scrollToButtons}
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
                color="#9B969B"
              />
            </TouchableOpacity>
          </View>

          {errors.password ? (
            <Text style={styles.errorText}>{errors.password}</Text>
          ) : (
            <Text style={styles.helperText}>
              Use a senha cadastrada na sua conta.
            </Text>
          )}

          <TouchableOpacity
            style={styles.forgotButton}
            onPress={openForgotPassword}
            activeOpacity={0.85}
          >
            <Text style={styles.forgotButtonText}>Esqueci minha senha</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#080808" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={23} color="#080808" />
                <Text style={styles.buttonText}>Entrar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={openRegister} activeOpacity={0.85}>
          <Text style={styles.link}>Criar conta</Text>
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
    backgroundColor: '#050505',
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 44,
    justifyContent: 'center',
    backgroundColor: '#050505',
  },

  scrollContentKeyboard: {
    justifyContent: 'flex-start',
    paddingTop: 12,
    paddingBottom: 260,
  },

  logoShell: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    paddingVertical: 6,
  },

  logo: {
    width: 190,
    height: 92,
  },

  logoKeyboard: {
    width: 150,
    height: 62,
  },

  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    backgroundColor: '#101014',
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
  },

  title: {
    color: '#F5F0E6',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 4,
    marginBottom: 9,
    textAlign: 'center',
    letterSpacing: -0.6,
  },

  subtitle: {
    color: '#9B969B',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '700',
  },

  formCard: {
    backgroundColor: '#101014',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 18,
  },

  label: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 8,
    marginLeft: 4,
  },

  inputContainer: {
    minHeight: 56,
    backgroundColor: '#18171D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  inputContainerError: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },

  input: {
    flex: 1,
    height: 54,
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 0,
  },

  passwordIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  helperText: {
    color: '#8F8A91',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 7,
    marginLeft: 4,
  },

  errorText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 7,
    marginLeft: 4,
    lineHeight: 17,
  },

  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
    marginBottom: 4,
  },

  forgotButtonText: {
    color: '#D4A64A',
    fontSize: 13,
    fontWeight: '900',
  },

  button: {
    height: 58,
    backgroundColor: '#D4A64A',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    flexDirection: 'row',
    gap: 8,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  buttonText: {
    color: '#080808',
    fontSize: 16,
    fontWeight: '900',
  },

  link: {
    color: '#D4A64A',
    textAlign: 'center',
    marginTop: 22,
    fontWeight: '900',
    fontSize: 14,
  },
});
