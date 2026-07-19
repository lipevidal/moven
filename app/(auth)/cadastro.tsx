import { useCallback, useMemo, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Modal,
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

import { supabase } from '../../src/database/supabase';
import {
  IbgeMunicipality,
  searchIbgeMunicipalities,
} from '../../src/features/municipalities/services/searchIbgeMunicipalities';

type RegisterStep = 1 | 2;

type RegisterErrors = {
  name?: string;
  username?: string;
  municipality?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

type RegisterErrorResult = {
  title: string;
  message: string;
  field?: keyof RegisterErrors;
};

const LOGO_SOURCE = require('../../assets/images/movenapp-logo.png');

const ROUTES = {
  login: '/(auth)/login',
  dashboard: '/(private)/(tabs)/dashboard',
} as const;

const MUNICIPALITY_SEARCH_DEBOUNCE_MS = 320;
const KEYBOARD_DISMISS_DELAY_MS = 120;

function formatUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 24);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function translateRegisterError(error: any): RegisterErrorResult {
  const rawMessage = String(error?.message ?? '');
  const message = rawMessage.toLowerCase();
  const code = String(error?.code ?? '').toLowerCase();

  if (
    code.includes('user_already_exists') ||
    code.includes('email_exists') ||
    message.includes('user already registered') ||
    message.includes('already registered') ||
    message.includes('already been registered') ||
    (message.includes('email') && message.includes('registered'))
  ) {
    return {
      title: 'E-mail já cadastrado',
      message: 'Este e-mail já está cadastrado. Entre com sua conta ou use outro e-mail.',
      field: 'email',
    };
  }

  if (message.includes('invalid email')) {
    return {
      title: 'E-mail inválido',
      message: 'Informe um e-mail válido para criar sua conta.',
      field: 'email',
    };
  }

  if (message.includes('password')) {
    return {
      title: 'Senha inválida',
      message: 'A senha informada não atende aos requisitos. Use pelo menos 6 caracteres.',
      field: 'password',
    };
  }

  if (message.includes('rate limit') || message.includes('too many')) {
    return {
      title: 'Muitas tentativas',
      message: 'Você tentou criar conta muitas vezes. Aguarde alguns minutos e tente novamente.',
    };
  }

  if (message.includes('network') || message.includes('fetch')) {
    return {
      title: 'Falha de conexão',
      message: 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.',
    };
  }

  if (message.includes('username') || rawMessage.includes('nome de usuário')) {
    return {
      title: 'Nome de usuário indisponível',
      message: 'Este nome de usuário já está em uso. Escolha outro.',
      field: 'username',
    };
  }

  if (
    message.includes('profile') ||
    message.includes('perfil') ||
    message.includes('profiles') ||
    message.includes('handle_new_user_profile')
  ) {
    return {
      title: 'Erro ao criar perfil',
      message:
        'Não foi possível criar seu perfil. A conta não será criada até o perfil ser salvo corretamente.',
    };
  }

  return {
    title: 'Erro ao criar conta',
    message: 'Não foi possível criar sua conta agora. Revise os dados e tente novamente.',
  };
}

export default function RegisterScreen() {
  const scrollRef = useRef<any>(null);
  const nameInputRef = useRef<any>(null);
  const usernameInputRef = useRef<any>(null);
  const emailInputRef = useRef<any>(null);
  const passwordInputRef = useRef<any>(null);
  const confirmPasswordInputRef = useRef<any>(null);

  const municipalitySearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registerRequestRef = useRef(false);
  const lastCheckedUsernameRef = useRef<{
    username: string;
    available: boolean;
  } | null>(null);

  const { width } = useWindowDimensions();
  const compactMode = width < 370;

  const logoSize = useMemo(
    () => ({
      width: compactMode ? 184 : 224,
      height: compactMode ? 92 : 116,
    }),
    [compactMode],
  );

  const [step, setStep] = useState<RegisterStep>(1);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [focusedField, setFocusedField] = useState<
    'name' | 'username' | 'email' | 'password' | 'confirmPassword' | null
  >(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [municipalityLoading, setMunicipalityLoading] = useState(false);

  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameMessage, setUsernameMessage] = useState('');

  const [errors, setErrors] = useState<RegisterErrors>({});

  const [municipalityModalVisible, setMunicipalityModalVisible] = useState(false);
  const [municipalitySearch, setMunicipalitySearch] = useState('');
  const [municipalities, setMunicipalities] = useState<IbgeMunicipality[]>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState<IbgeMunicipality | null>(null);

  const stepSubtitle =
    step === 1
      ? 'Informe seus dados para aparecer corretamente na comunidade.'
      : 'Defina os dados que você vai usar para entrar no app.';

  const clearFieldError = useCallback((field: keyof RegisterErrors) => {
    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  }, []);

  const scrollToTop = useCallback((delay = 80) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }, delay);
  }, []);

  const scrollToEnd = useCallback((delay = 120) => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, delay);
  }, []);

  const checkUsername = useCallback(async (value: string, force = false) => {
    const cleanUsername = formatUsername(value);

    setUsername(cleanUsername);

    if (cleanUsername.length < 3) {
      const message = 'O nome de usuário precisa ter pelo menos 3 caracteres.';

      lastCheckedUsernameRef.current = {
        username: cleanUsername,
        available: false,
      };

      setUsernameAvailable(false);
      setUsernameMessage(message);
      setErrors((current) => ({
        ...current,
        username: message,
      }));

      return false;
    }

    if (
      !force &&
      lastCheckedUsernameRef.current?.username === cleanUsername
    ) {
      const cachedAvailable = lastCheckedUsernameRef.current.available;

      setUsernameAvailable(cachedAvailable);
      setUsernameMessage(
        cachedAvailable
          ? 'Nome de usuário disponível.'
          : 'Este nome de usuário já está em uso.',
      );

      setErrors((current) => ({
        ...current,
        username: cachedAvailable ? undefined : 'Este nome de usuário já está em uso.',
      }));

      return cachedAvailable;
    }

    try {
      setUsernameLoading(true);

      const { data, error } = await supabase.rpc('is_username_available', {
        username_to_check: cleanUsername,
      });

      if (error) throw error;

      const available = data === true;

      lastCheckedUsernameRef.current = {
        username: cleanUsername,
        available,
      };

      setUsernameAvailable(available);
      setUsernameMessage(
        available
          ? 'Nome de usuário disponível.'
          : 'Este nome de usuário já está em uso.',
      );

      setErrors((current) => ({
        ...current,
        username: available ? undefined : 'Este nome de usuário já está em uso.',
      }));

      return available;
    } catch (error) {
      console.log('Erro ao verificar username:', error);

      lastCheckedUsernameRef.current = {
        username: cleanUsername,
        available: false,
      };

      setUsernameAvailable(false);
      setUsernameMessage('Não foi possível verificar o nome de usuário.');
      setErrors((current) => ({
        ...current,
        username: 'Não foi possível verificar o nome de usuário.',
      }));

      return false;
    } finally {
      setUsernameLoading(false);
    }
  }, []);

  const handleSearchMunicipalities = useCallback((text: string) => {
    setMunicipalitySearch(text);

    if (municipalitySearchTimeoutRef.current) {
      clearTimeout(municipalitySearchTimeoutRef.current);
    }

    const cleanText = text.trim();

    if (cleanText.length < 2) {
      setMunicipalities([]);
      setMunicipalityLoading(false);
      return;
    }

    setMunicipalityLoading(true);

    municipalitySearchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await searchIbgeMunicipalities(cleanText);

        setMunicipalities(response);
      } catch (error) {
        console.log('Erro ao buscar cidades na tabela ibge_localidades:', error);
        setMunicipalities([]);
      } finally {
        setMunicipalityLoading(false);
      }
    }, MUNICIPALITY_SEARCH_DEBOUNCE_MS);
  }, []);

  const validateUserStep = useCallback(() => {
    const nextErrors: RegisterErrors = {};
    const cleanName = name.trim();
    const cleanUsername = formatUsername(username);

    if (!cleanName) {
      nextErrors.name = 'Informe seu nome completo.';
    } else if (cleanName.length < 2) {
      nextErrors.name = 'O nome precisa ter pelo menos 2 caracteres.';
    }

    if (!cleanUsername) {
      nextErrors.username = 'Informe um nome de usuário.';
    } else if (cleanUsername.length < 3) {
      nextErrors.username = 'O nome de usuário precisa ter pelo menos 3 caracteres.';
    }

    if (!selectedMunicipality) {
      nextErrors.municipality = 'Selecione a cidade onde mora.';
    }

    setErrors((current) => ({
      ...current,
      name: nextErrors.name,
      username: nextErrors.username,
      municipality: nextErrors.municipality,
    }));

    return Object.keys(nextErrors).length === 0;
  }, [name, selectedMunicipality, username]);

  const validateAccessStep = useCallback(() => {
    const nextErrors: RegisterErrors = {};
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      nextErrors.email = 'Informe seu e-mail.';
    } else if (!isValidEmail(cleanEmail)) {
      nextErrors.email = 'Informe um e-mail válido.';
    }

    if (!password) {
      nextErrors.password = 'Informe uma senha.';
    } else if (password.length < 6) {
      nextErrors.password = 'A senha precisa ter pelo menos 6 caracteres.';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Confirme sua senha.';
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'As senhas não conferem.';
    }

    setErrors((current) => ({
      ...current,
      email: nextErrors.email,
      password: nextErrors.password,
      confirmPassword: nextErrors.confirmPassword,
    }));

    return Object.keys(nextErrors).length === 0;
  }, [confirmPassword, email, password]);

  const validateFields = useCallback(() => {
    const userStepValid = validateUserStep();
    const accessStepValid = validateAccessStep();

    if (!userStepValid) {
      setStep(1);
      scrollToTop();
      return false;
    }

    if (!accessStepValid) {
      setStep(2);
      scrollToTop();
      return false;
    }

    return true;
  }, [scrollToTop, validateAccessStep, validateUserStep]);

  const handleNextStep = useCallback(async () => {
    try {
      if (loading || usernameLoading) return;

      Keyboard.dismiss();
      await wait(KEYBOARD_DISMISS_DELAY_MS);

      const userStepValid = validateUserStep();

      if (!userStepValid) {
        scrollToTop(80);
        return;
      }

      const cleanUsername = formatUsername(username);
      const available = await checkUsername(cleanUsername);

      if (!available) {
        scrollToTop(80);
        return;
      }

      setStep(2);
      setFocusedField(null);
      scrollToTop(80);
    } catch (error) {
      console.log('Erro ao avançar etapa:', error);
      Alert.alert('Atenção', 'Não foi possível validar seus dados agora.');
    }
  }, [checkUsername, loading, scrollToTop, username, usernameLoading, validateUserStep]);

  const handleBackStep = useCallback(() => {
    setStep(1);
    setFocusedField(null);
    scrollToTop(80);
  }, [scrollToTop]);

  const handleRegister = useCallback(async () => {
    try {
      if (loading || registerRequestRef.current) return;

      registerRequestRef.current = true;

      Keyboard.dismiss();
      await wait(KEYBOARD_DISMISS_DELAY_MS);

      const valid = validateFields();

      if (!valid) {
        return;
      }

      const cleanUsername = formatUsername(username);
      const available = await checkUsername(cleanUsername);

      if (!available) {
        setStep(1);
        scrollToTop(80);
        return;
      }

      setLoading(true);

      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim();

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: cleanName,
            username: cleanUsername,
            city: selectedMunicipality?.name,
            municipality_id: selectedMunicipality?.id,
            regiao_imediata: selectedMunicipality?.immediate_region,
            regiao_intermediaria: selectedMunicipality?.intermediate_region,
            estado: selectedMunicipality?.state,
            estado_uf: selectedMunicipality?.uf,
          },
        },
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error('Não foi possível confirmar a criação do usuário.');
      }

      if (!data.session) {
        Alert.alert(
          'Confirmação de e-mail ativa',
          'A conta foi criada, mas o Supabase ainda está exigindo confirmação de e-mail. Desative essa opção no painel do Supabase para entrar automaticamente.',
        );

        router.replace(ROUTES.login as never);
        return;
      }

      Alert.alert('Conta criada', 'Sua conta foi criada com sucesso.');

      router.replace(ROUTES.dashboard as never);
    } catch (error: any) {
      const translatedError = translateRegisterError(error);

      if (translatedError.field) {
        setErrors((current) => ({
          ...current,
          [translatedError.field as keyof RegisterErrors]: translatedError.message,
        }));

        if (
          translatedError.field === 'name' ||
          translatedError.field === 'username' ||
          translatedError.field === 'municipality'
        ) {
          setStep(1);
        } else {
          setStep(2);
        }
      }

      scrollToTop(80);
      Alert.alert(translatedError.title, translatedError.message);
    } finally {
      setLoading(false);
      registerRequestRef.current = false;
    }
  }, [
    checkUsername,
    email,
    loading,
    name,
    password,
    scrollToTop,
    selectedMunicipality,
    username,
    validateFields,
  ]);

  const handleSelectMunicipality = useCallback((item: IbgeMunicipality) => {
    setSelectedMunicipality(item);
    clearFieldError('municipality');
    setMunicipalityModalVisible(false);
  }, [clearFieldError]);

  const openLogin = useCallback(() => {
    router.replace(ROUTES.login as never);
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.scrollContent}
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
              style={[styles.logo, logoSize]}
              resizeMode="contain"
            />
          </View>

          <View style={styles.heroTextBox}>
            <Text style={styles.eyebrow}>Faça parte da nossa comunidade</Text>
            <Text style={styles.title}>Crie sua conta</Text>
          </View>

          <View style={styles.stepsRow}>
            <View style={[styles.stepPill, step === 1 && styles.stepPillActive]}>
              <View style={[styles.stepNumber, step === 1 && styles.stepNumberActive]}>
                <Text style={[styles.stepNumberText, step === 1 && styles.stepNumberTextActive]}>
                  1
                </Text>
              </View>
              <Text style={[styles.stepPillText, step === 1 && styles.stepPillTextActive]}>
                Perfil
              </Text>
            </View>

            <View style={styles.stepDivider} />

            <View style={[styles.stepPill, step === 2 && styles.stepPillActive]}>
              <View style={[styles.stepNumber, step === 2 && styles.stepNumberActive]}>
                <Text style={[styles.stepNumberText, step === 2 && styles.stepNumberTextActive]}>
                  2
                </Text>
              </View>
              <Text style={[styles.stepPillText, step === 2 && styles.stepPillTextActive]}>
                Acesso
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          {step === 1 ? (
            <>
              <Text style={styles.label}>Nome e sobrenome</Text>

              <TouchableOpacity
                activeOpacity={1}
                onPress={() => nameInputRef.current?.focus?.()}
                style={[
                  styles.inputContainer,
                  focusedField === 'name' && styles.inputContainerFocused,
                  errors.name && styles.inputContainerError,
                ]}
              >
                <View
                  style={[
                    styles.inputIconBox,
                    focusedField === 'name' && styles.inputIconBoxFocused,
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={focusedField === 'name' ? '#D4A64A' : '#9B969B'}
                  />
                </View>

                <TextInput
                  ref={nameInputRef}
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    clearFieldError('name');
                  }}
                  placeholder="Seu nome e sobrenome"
                  placeholderTextColor="#71717A"
                  autoCapitalize="words"
                  returnKeyType="next"
                  style={styles.input}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={() => usernameInputRef.current?.focus?.()}
                />
              </TouchableOpacity>

              {errors.name ? (
                <Text style={styles.errorText}>{errors.name}</Text>
              ) : null}

              <Text style={styles.label}>Nome de usuário</Text>

              <TouchableOpacity
                activeOpacity={1}
                onPress={() => usernameInputRef.current?.focus?.()}
                style={[
                  styles.inputContainer,
                  focusedField === 'username' && styles.inputContainerFocused,
                  errors.username && styles.inputContainerError,
                ]}
              >
                <View
                  style={[
                    styles.inputIconBox,
                    focusedField === 'username' && styles.inputIconBoxFocused,
                  ]}
                >
                  <Text
                    style={[
                      styles.atSign,
                      focusedField === 'username' && styles.atSignFocused,
                    ]}
                  >
                    @
                  </Text>
                </View>

                <TextInput
                  ref={usernameInputRef}
                  value={username}
                  onChangeText={(value) => {
                    const clean = formatUsername(value);

                    setUsername(clean);
                    setUsernameAvailable(null);
                    setUsernameMessage('');
                    lastCheckedUsernameRef.current = null;
                    clearFieldError('username');
                  }}
                  onBlur={() => {
                    setFocusedField(null);
                    checkUsername(username);
                  }}
                  placeholder="username único"
                  placeholderTextColor="#71717A"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  style={styles.input}
                  onFocus={() => setFocusedField('username')}
                />

                {usernameLoading ? (
                  <ActivityIndicator color="#D4A64A" />
                ) : usernameAvailable !== null ? (
                  <Ionicons
                    name={usernameAvailable ? 'checkmark-circle' : 'close-circle'}
                    size={22}
                    color={usernameAvailable ? '#22C55E' : '#EF4444'}
                  />
                ) : null}
              </TouchableOpacity>

              {usernameMessage ? (
                <Text
                  style={[
                    styles.helperText,
                    usernameAvailable ? styles.successText : styles.errorText,
                  ]}
                >
                  {usernameMessage}
                </Text>
              ) : errors.username ? (
                <Text style={styles.errorText}>{errors.username}</Text>
              ) : (
                <Text style={styles.helperText}>Use letras, números, ponto ou underline.</Text>
              )}

              <Text style={styles.label}>Cidade onde mora</Text>

              <TouchableOpacity
                activeOpacity={0.88}
                style={[
                  styles.selectCard,
                  errors.municipality && styles.inputContainerError,
                ]}
                onPress={() => setMunicipalityModalVisible(true)}
              >
                <View style={styles.selectIcon}>
                  <Ionicons name="location-outline" size={21} color="#D4A64A" />
                </View>

                <View style={styles.selectTextBox}>
                  <Text style={styles.selectText} numberOfLines={1}>
                    {selectedMunicipality
                      ? `${selectedMunicipality.name} - ${selectedMunicipality.uf}`
                      : 'Selecionar cidade'}
                  </Text>

                  <Text style={styles.selectSubText} numberOfLines={1}>
                    {selectedMunicipality?.immediate_region ||
                      'A comunidade será conectada à sua região'}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={21} color="#F5F0E6" />
              </TouchableOpacity>

              {errors.municipality ? (
                <Text style={styles.errorText}>{errors.municipality}</Text>
              ) : null}

              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  styles.button,
                  (usernameLoading || loading) && styles.buttonDisabled,
                ]}
                onPress={handleNextStep}
                disabled={usernameLoading || loading}
              >
                {usernameLoading ? (
                  <ActivityIndicator color="#080808" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Continuar</Text>
                    <View style={styles.buttonIconCircle}>
                      <Ionicons name="arrow-forward" size={18} color="#080808" />
                    </View>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              

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
                  placeholderTextColor="#71717A"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  returnKeyType="next"
                  style={styles.input}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={() => passwordInputRef.current?.focus?.()}
                />
              </TouchableOpacity>

              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

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
                    clearFieldError('confirmPassword');
                  }}
                  placeholder="Mínimo de 6 caracteres"
                  placeholderTextColor="#71717A"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  importantForAutofill="no"
                  textContentType="oneTimeCode"
                  returnKeyType="next"
                  style={styles.input}
                  onFocus={() => {
                    setFocusedField('password');
                    scrollToEnd(160);
                  }}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={() => confirmPasswordInputRef.current?.focus?.()}
                />

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.passwordIconButton}
                  onPress={() => setShowPassword((current) => !current)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={showPassword ? '#D4A64A' : '#9B969B'}
                  />
                </TouchableOpacity>
              </TouchableOpacity>

              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

              <Text style={styles.label}>Confirmar senha</Text>

              <TouchableOpacity
                activeOpacity={1}
                onPress={() => confirmPasswordInputRef.current?.focus?.()}
                style={[
                  styles.inputContainer,
                  focusedField === 'confirmPassword' && styles.inputContainerFocused,
                  errors.confirmPassword && styles.inputContainerError,
                ]}
              >
                <View
                  style={[
                    styles.inputIconBox,
                    focusedField === 'confirmPassword' && styles.inputIconBoxFocused,
                  ]}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color={
                      focusedField === 'confirmPassword' ? '#D4A64A' : '#9B969B'
                    }
                  />
                </View>

                <TextInput
                  ref={confirmPasswordInputRef}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    clearFieldError('confirmPassword');
                  }}
                  placeholder="Digite a senha novamente"
                  placeholderTextColor="#71717A"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  importantForAutofill="no"
                  textContentType="oneTimeCode"
                  returnKeyType="done"
                  style={styles.input}
                  onFocus={() => {
                    setFocusedField('confirmPassword');
                    scrollToEnd(160);
                  }}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={handleRegister}
                />

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.passwordIconButton}
                  onPress={() => setShowConfirmPassword((current) => !current)}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={showConfirmPassword ? '#D4A64A' : '#9B969B'}
                  />
                </TouchableOpacity>
              </TouchableOpacity>

              {errors.confirmPassword ? (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              ) : null}

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.secondaryButton}
                  onPress={handleBackStep}
                  disabled={loading}
                >
                  <Ionicons name="arrow-back" size={18} color="#F5F0E6" />
                  <Text style={styles.secondaryButtonText}>Voltar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.button, styles.createButton, loading && styles.buttonDisabled]}
                  onPress={handleRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#080808" />
                  ) : (
                    <>
                      <Text style={styles.buttonText}>Criar conta</Text>
                      <View style={styles.buttonIconCircle}>
                        <Ionicons name="checkmark" size={18} color="#080808" />
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity activeOpacity={0.85} onPress={openLogin}>
          <Text style={styles.link}>Já tenho conta</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={municipalityModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMunicipalityModalVisible(false)}
      >
        <View style={styles.municipalityModalOverlay}>
          <View style={styles.municipalityModalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="location-outline" size={22} color="#D4A64A" />
                </View>

                <View style={styles.modalTitleBox}>
                  <Text style={styles.modalEyebrow}>Cidade onde mora</Text>
                  <Text style={styles.modalTitle}>Escolher cidade</Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.modalCloseButton}
                onPress={() => setMunicipalityModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={20} color="#9B969B" />

              <TextInput
                value={municipalitySearch}
                onChangeText={handleSearchMunicipalities}
                placeholder="Buscar pelo nome da cidade"
                placeholderTextColor="#71717A"
                autoCorrect={false}
                style={styles.municipalitySearchInput}
              />
            </View>

            {municipalityLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#D4A64A" />
                <Text style={styles.loadingText}>Buscando cidades...</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.modalList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.municipalityListContent}
              >
                {municipalitySearch.trim().length < 2 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="search-outline" size={34} color="#8F8A91" />
                    <Text style={styles.emptyTitle}>Busque sua cidade</Text>
                    <Text style={styles.emptyText}>
                      Digite pelo menos 2 letras para encontrar a cidade onde mora.
                    </Text>
                  </View>
                ) : municipalities.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="alert-circle-outline" size={34} color="#8F8A91" />
                    <Text style={styles.emptyTitle}>Nenhuma cidade encontrada</Text>
                    <Text style={styles.emptyText}>
                      Tente buscar somente pelo nome da cidade.
                    </Text>
                  </View>
                ) : (
                  municipalities.map((item) => {
                    const selected = selectedMunicipality?.id === item.id;

                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.86}
                        style={[
                          styles.municipalityItem,
                          selected && styles.municipalityItemSelected,
                        ]}
                        onPress={() => handleSelectMunicipality(item)}
                      >
                        <View style={styles.municipalityIconSmall}>
                          <Ionicons name="business-outline" size={19} color="#D4A64A" />
                        </View>

                        <View style={styles.municipalityTextBox}>
                          <Text style={styles.municipalityName} numberOfLines={1}>
                            {item.name} - {item.uf}
                          </Text>

                          <Text style={styles.municipalityRegion} numberOfLines={1}>
                            {item.immediate_region || 'Região imediata não informada'}
                          </Text>
                        </View>

                        {selected ? (
                          <Ionicons name="checkmark-circle" size={24} color="#D4A64A" />
                        ) : (
                          <Ionicons name="chevron-forward" size={19} color="#8F8A91" />
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 26 : 22,
    paddingBottom: 40,
    backgroundColor: '#050505',
    justifyContent: 'center',
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

  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 20,
  },

  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    backgroundColor: '#141318',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingVertical: 7,
    paddingHorizontal: 10,
  },

  stepPillActive: {
    borderColor: '#D4A64A',
    backgroundColor: 'rgba(212,166,74,0.10)',
  },

  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#242229',
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepNumberActive: {
    backgroundColor: '#D4A64A',
  },

  stepNumberText: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '900',
  },

  stepNumberTextActive: {
    color: '#080808',
  },

  stepPillText: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '900',
  },

  stepPillTextActive: {
    color: '#F5F0E6',
  },

  stepDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#2A2830',
    marginHorizontal: 8,
  },

  formCard: {
    backgroundColor: '#0E0E12',
    borderRadius: 28,
    padding: 16,
    borderWidth: 1,
    borderColor: '#25222A',
    marginTop: -20,
  },

  sectionTitle: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 4,
  },

  label: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 14,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  inputContainer: {
    minHeight: 58,
    backgroundColor: '#18171D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingLeft: 9,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  inputContainerFocused: {
    borderColor: '#D4A64A',
    backgroundColor: '#1D1A20',
  },

  inputContainerError: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },

  inputIconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#222027',
    alignItems: 'center',
    justifyContent: 'center',
  },

  inputIconBoxFocused: {
    backgroundColor: 'rgba(212,166,74,0.12)',
  },

  input: {
    flex: 1,
    height: 56,
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '800',
    paddingVertical: 0,
  },

  atSign: {
    color: '#9B969B',
    fontSize: 17,
    fontWeight: '900',
  },

  atSignFocused: {
    color: '#D4A64A',
  },

  helperText: {
    color: '#8F8A91',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 7,
    marginLeft: 4,
    lineHeight: 17,
  },

  errorText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 7,
    marginLeft: 4,
    lineHeight: 17,
  },

  successText: {
    color: '#22C55E',
  },

  selectCard: {
    minHeight: 68,
    backgroundColor: '#18171D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },

  selectIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectTextBox: {
    flex: 1,
    minWidth: 0,
  },

  selectText: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  selectSubText: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },

  passwordIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reviewCard: {
    minHeight: 64,
    borderRadius: 18,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 11,
  },

  reviewIconBox: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: 'rgba(212,166,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  reviewTextBox: {
    flex: 1,
    minWidth: 0,
  },

  reviewName: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  reviewMeta: {
    color: '#8F8A91',
    fontSize: 11.5,
    fontWeight: '800',
    marginTop: 3,
  },

  button: {
    overflow: 'hidden',
    height: 60,
    backgroundColor: '#D4A64A',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    flexDirection: 'row',
    gap: 10,
  },

  createButton: {
    flex: 1,
    marginTop: 0,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  buttonText: {
    color: '#080808',
    fontSize: 16,
    fontWeight: '900',
  },

  buttonIconCircle: {
    width: 31,
    height: 31,
    borderRadius: 999,
    backgroundColor: 'rgba(8,8,8,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },

  secondaryButton: {
    minWidth: 106,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },

  secondaryButtonText: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  link: {
    color: '#D4A64A',
    textAlign: 'center',
    marginTop: 22,
    fontWeight: '900',
    fontSize: 14,
  },

  municipalityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'flex-end',
  },

  municipalityModalContent: {
    height: '82%',
    backgroundColor: '#101014',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2830',
  },

  modalHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#2A2830',
    alignSelf: 'center',
    marginBottom: 18,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },

  modalIconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalTitleBox: {
    flex: 1,
    minWidth: 0,
  },

  modalEyebrow: {
    color: '#D4A64A',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  modalTitle: {
    color: '#F5F0E6',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 2,
  },

  modalCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchBox: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },

  municipalitySearchInput: {
    flex: 1,
    height: '100%',
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 0,
  },

  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 10,
  },

  modalList: {
    flex: 1,
  },

  municipalityListContent: {
    paddingBottom: 20,
  },

  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 46,
    paddingHorizontal: 20,
  },

  emptyTitle: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 12,
  },

  emptyText: {
    color: '#8F8A91',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },

  municipalityItem: {
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  municipalityItemSelected: {
    borderColor: '#D4A64A',
    backgroundColor: 'rgba(212,166,74,0.10)',
  },

  municipalityIconSmall: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  municipalityTextBox: {
    flex: 1,
    minWidth: 0,
  },

  municipalityName: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  municipalityRegion: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
});
