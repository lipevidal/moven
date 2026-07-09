import { useEffect, useState } from 'react';

import {
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Keyboard,
  View,
  ActivityIndicator,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../src/database/supabase';

type LoginErrors = {
  email?: string;
  password?: string;
};

export default function LoginScreen() {
  // Estados principais do formulário.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Controla se a senha ficará visível ou escondida.
  const [showPassword, setShowPassword] = useState(false);

  // Evita múltiplos cliques no botão enquanto o login está sendo processado.
  const [loading, setLoading] = useState(false);

  // Controla o layout quando o teclado aparece, principalmente no iOS.
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Guarda mensagens de erro por campo para exibir em português abaixo dos inputs.
  const [errors, setErrors] = useState<LoginErrors>({});

  useEffect(() => {
    // No iOS usamos eventos "will" para animar antes do teclado terminar de abrir.
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';

    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Remove a mensagem de erro de um campo assim que o usuário começa a corrigir.
  function clearFieldError(field: keyof LoginErrors) {
    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  }

  // Validação simples de e-mail antes de chamar o Supabase.
  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
  }

  // Traduz mensagens comuns do Supabase para português.
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

  // Valida todos os campos e exibe mensagens em português sem depender de Alert.
  function validateFields() {
    const nextErrors: LoginErrors = {};

    if (!email.trim()) {
      nextErrors.email = 'Informe seu e-mail.';
    } else if (!isValidEmail(email)) {
      nextErrors.email = 'Informe um e-mail válido.';
    }

    if (!password) {
      nextErrors.password = 'Informe sua senha.';
    } else if (password.length < 6) {
      nextErrors.password = 'A senha precisa ter pelo menos 6 caracteres.';
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  // Faz login usando e-mail e senha no Supabase.
  async function handleLogin() {
    try {
      const valid = validateFields();

      if (!valid) {
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

        Alert.alert('Não foi possível entrar', translatedMessage);
        return;
      }

      router.replace('/(private)/(tabs)/dashboard' as never);
    } catch (error: any) {
      const translatedMessage = getLoginErrorMessage(error?.message);

      setErrors((current) => ({
        ...current,
        password: translatedMessage,
      }));

      Alert.alert('Não foi possível entrar', translatedMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          keyboardVisible && styles.scrollContentKeyboard,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="always"
      >
        {/* Área superior com logo e chamada principal do app. */}
        <View style={styles.heroCard}>
          <View style={styles.logoShell}>
            <Image
              source={require('../../assets/images/movenapp-logo.png')}
              style={[styles.logo, keyboardVisible && styles.logoKeyboard]}
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

        {/* Card do formulário de login. */}
        <View style={styles.formCard}>
          {/* Campo de e-mail usado para autenticação. */}
          <Text style={styles.label}>E-mail</Text>

          <View style={[styles.inputContainer, errors.email && styles.inputContainerError]}>
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

          {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

          {/* Campo de senha com botão para mostrar ou ocultar. */}
          <Text style={styles.label}>Senha</Text>

          <View style={[styles.inputContainer, errors.password && styles.inputContainerError]}>
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
              onSubmitEditing={handleLogin}
            />

            <TouchableOpacity
              style={styles.passwordIconButton}
              onPress={() => setShowPassword((current) => !current)}
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

          {/* Atalho para recuperação de senha. */}
          <TouchableOpacity
            style={styles.forgotButton}
            onPress={() => router.push('/(auth)/forgot-password' as never)}
            activeOpacity={0.85}
          >
            <Text style={styles.forgotButtonText}>Esqueci minha senha</Text>
          </TouchableOpacity>

          {/* Botão principal de login. */}
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

        {/* Link para a tela de cadastro. */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/cadastro' as never)}
          activeOpacity={0.85}
        >
          <Text style={styles.link}>Criar conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
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
    paddingTop: 36,
    paddingBottom: 70,
    justifyContent: 'center',
    backgroundColor: '#050505',
  },
  scrollContentKeyboard: {
    justifyContent: 'flex-start',
    paddingTop: 18,
    paddingBottom: 220,
  },
  logoShell: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    paddingVertical: 8,
  },
  logo: {
    width: 220,
    height: 116,
  },
  logoKeyboard: {
    width: 160,
    height: 70,
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    backgroundColor: '#101014',
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#D4A64A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 10,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  eyebrow: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  title: {
    color: '#F5F0E6',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 5,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: '#9B969B',
    fontSize: 14,
    lineHeight: 21,
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
    minHeight: 58,
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
    height: 56,
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
    height: 60,
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
