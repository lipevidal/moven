import { useCallback, useRef, useState } from 'react';

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
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { supabase } from '../../src/database/supabase';
import {
  IbgeMunicipality,
  searchIbgeMunicipalities,
} from '../../src/features/municipalities/services/searchIbgeMunicipalities';
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


/**
 * Logo fora do componente.
 *
 * Isso evita recriar o require a cada renderização.
 */
const LOGO_SOURCE = require('../../assets/images/movenapp-logo.png');

/**
 * Rotas usadas pela tela.
 *
 * Evita strings espalhadas pelo código.
 */
const ROUTES = {
  login: '/(auth)/login',
  dashboard: '/(private)/(tabs)/dashboard',
} as const;

/**
 * Tempo de debounce da busca de cidades.
 *
 * Em vez de chamar a busca em toda letra digitada imediatamente,
 * aguardamos um pequeno intervalo. Isso deixa a tela mais leve.
 */
const MUNICIPALITY_SEARCH_DEBOUNCE_MS = 320;

/**
 * Tempo usado para aguardar o teclado iniciar o fechamento antes de processar.
 */
const KEYBOARD_DISMISS_DELAY_MS = 120;

/**
 * Padroniza o username para URL/perfil público.
 *
 * Regras:
 * - minúsculo
 * - sem espaços
 * - apenas letras, números, ponto e underline
 * - máximo de 24 caracteres
 */
function formatUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 24);
}

/**
 * Validação simples de e-mail.
 */
function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

/**
 * Pequeno helper para aguardar alguns milissegundos.
 *
 * Usado para fechar o teclado antes de começar o processamento do cadastro.
 */
function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}


/**
 * Traduz erros retornados pelo Supabase para mensagens amigáveis em português.
 *
 * Isso evita mostrar mensagens técnicas como:
 * - User already registered
 * - invalid email
 * - rate limit
 */
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

/**
 * Tela de cadastro.
 *
 * Otimizações aplicadas:
 * - Removido useEffect do teclado.
 * - Removido KeyboardAvoidingView.
 * - Removido estado keyboardVisible.
 * - Removida troca dinâmica de tamanho da logo.
 * - Adicionado debounce na busca de cidades.
 * - Evita verificar username duas vezes se ele já foi validado.
 * - Evita clique duplo no botão Criar conta com registerRequestRef.
 * - Fecha o teclado antes de começar o processamento.
 * - Funções estáticas foram movidas para fora do componente.
 */
export default function RegisterScreen() {
  /**
   * Referência do ScrollView principal.
   *
   * Usada para rolar até o botão/erros quando necessário.
   */
  const scrollRef = useRef<any>(null);

  /**
   * Guarda o timeout da busca de cidades.
   *
   * Isso permite cancelar a busca anterior quando o usuário continua digitando.
   */
  const municipalitySearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Evita múltiplos cadastros ao tocar várias vezes no botão.
   */
  const registerRequestRef = useRef(false);

  /**
   * Guarda o último username verificado com sucesso/erro.
   *
   * Com isso, no botão Criar conta não precisamos chamar a RPC novamente
   * se o mesmo username já foi verificado no onBlur.
   */
  const lastCheckedUsernameRef = useRef<{
    username: string;
    available: boolean;
  } | null>(null);

  /**
   * Campos principais do formulário.
   */
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  /**
   * Estados visuais de senha.
   */
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  /**
   * Estados de carregamento.
   */
  const [loading, setLoading] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [municipalityLoading, setMunicipalityLoading] = useState(false);

  /**
   * Estados de validação do username.
   */
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameMessage, setUsernameMessage] = useState('');

  /**
   * Estado de erros por campo.
   */
  const [errors, setErrors] = useState<RegisterErrors>({});

  /**
   * Estados do modal de município.
   */
  const [municipalityModalVisible, setMunicipalityModalVisible] = useState(false);
  const [municipalitySearch, setMunicipalitySearch] = useState('');
  const [municipalities, setMunicipalities] = useState<IbgeMunicipality[]>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState<IbgeMunicipality | null>(null);

  /**
   * Remove erro de um campo quando o usuário começa a corrigir.
   */
  const clearFieldError = useCallback((field: keyof RegisterErrors) => {
    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  }, []);

  /**
   * Rola para o final da tela.
   *
   * Útil quando o teclado abre ou quando aparece erro próximo ao botão.
   */
  const scrollToEnd = useCallback((delay = 120) => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, delay);
  }, []);

  /**
   * Verifica se o username está disponível.
   *
   * Otimização:
   * - Se o mesmo username já foi verificado, retorna o resultado em cache.
   * - Evita chamada RPC duplicada no Supabase.
   */
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

  /**
   * Busca municípios com debounce.
   *
   * Antes:
   * - cada letra digitada chamava a busca imediatamente.
   *
   * Agora:
   * - espera o usuário parar de digitar por alguns milissegundos.
   * - reduz chamadas desnecessárias.
   * - deixa a tela mais leve.
   */
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

  /**
   * Valida todos os campos antes de chamar o Supabase.
   */
  const validateFields = useCallback(() => {
    const nextErrors: RegisterErrors = {};
    const cleanName = name.trim();
    const cleanUsername = formatUsername(username);
    const cleanEmail = email.trim();

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

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }, [confirmPassword, email, name, password, selectedMunicipality, username]);

  /**
   * Cria a conta no Supabase Auth e depois cria o perfil na tabela profiles.
   */
  const handleRegister = useCallback(async () => {
    try {
      if (loading || registerRequestRef.current) return;

      registerRequestRef.current = true;

      /**
       * Primeiro fecha o teclado, depois começa o processamento.
       *
       * Isso evita travamentos visuais e deixa a experiência mais limpa.
       */
      Keyboard.dismiss();
      await wait(KEYBOARD_DISMISS_DELAY_MS);

      const valid = validateFields();

      if (!valid) {
        scrollToEnd(100);
        return;
      }

      const cleanUsername = formatUsername(username);
      const available = await checkUsername(cleanUsername);

      if (!available) {
        scrollToEnd(100);
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

      /*
        O perfil agora é criado automaticamente no banco por trigger em auth.users.

        Isso evita o problema de criar o usuário no Auth e falhar depois ao inserir
        na tabela profiles. Se a criação do perfil falhar no trigger, o próprio
        signUp retorna erro e o usuário não fica órfão sem profile.
      */
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
      }

      scrollToEnd(100);
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
    scrollToEnd,
    selectedMunicipality,
    username,
    validateFields,
  ]);

  /**
   * Seleciona município e fecha modal.
   */
  const handleSelectMunicipality = useCallback((item: IbgeMunicipality) => {
    setSelectedMunicipality(item);
    clearFieldError('municipality');
    setMunicipalityModalVisible(false);
  }, [clearFieldError]);

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
          <View style={styles.titleRow}>
            <View style={styles.logoShell}>
              <Image
                source={LOGO_SOURCE}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Comece agora</Text>
              <Text style={styles.title}>Criar conta</Text>
            </View>
          </View>

          <Text style={styles.subtitle}>
            Cadastre seus dados para acompanhar sua rotina, ganhos, corridas e desempenho no MovenApp.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Nome completo</Text>

          <View style={[styles.inputContainer, errors.name && styles.inputContainerError]}>
            <Ionicons name="person-outline" size={20} color="#9B969B" />

            <TextInput
              value={name}
              onChangeText={(text) => {
                setName(text);
                clearFieldError('name');
              }}
              placeholder="Seu nome completo"
              placeholderTextColor="#71717A"
              autoCapitalize="words"
              style={styles.input}
            />
          </View>

          {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

          <Text style={styles.label}>Nome de usuário</Text>

          <View style={[styles.inputContainer, errors.username && styles.inputContainerError]}>
            <Text style={styles.atSign}>@</Text>

            <TextInput
              value={username}
              onChangeText={(value) => {
                const clean = formatUsername(value);

                setUsername(clean);
                setUsernameAvailable(null);
                setUsernameMessage('');
                lastCheckedUsernameRef.current = null;
                clearFieldError('username');
              }}
              onBlur={() => checkUsername(username)}
              placeholder="username único"
              placeholderTextColor="#71717A"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
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
          </View>

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
            activeOpacity={0.85}
            style={[styles.selectCard, errors.municipality && styles.inputContainerError]}
            onPress={() => setMunicipalityModalVisible(true)}
          >
            <View style={styles.selectIcon}>
              <Ionicons name="location-outline" size={23} color="#D4A64A" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.selectText} numberOfLines={1}>
                {selectedMunicipality
                  ? `${selectedMunicipality.name} - ${selectedMunicipality.uf}`
                  : 'Selecionar cidade'}
              </Text>

              {selectedMunicipality?.immediate_region ? (
                <Text style={styles.selectSubText} numberOfLines={1}>
                  {selectedMunicipality.immediate_region}
                </Text>
              ) : null}
            </View>

            <Ionicons name="chevron-forward" size={21} color="#F5F0E6" />
          </TouchableOpacity>

          {errors.municipality ? (
            <Text style={styles.errorText}>{errors.municipality}</Text>
          ) : null}

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
              textContentType="emailAddress"
              autoComplete="email"
              style={styles.input}
            />
          </View>

          {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

          <Text style={styles.label}>Senha</Text>

          <View style={[styles.inputContainer, errors.password && styles.inputContainerError]}>
            <Ionicons name="lock-closed-outline" size={20} color="#9B969B" />

            <TextInput
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
              style={styles.input}
              onFocus={() => scrollToEnd(160)}
            />

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.passwordIconButton}
              onPress={() => setShowPassword((current) => !current)}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#9B969B"
              />
            </TouchableOpacity>
          </View>

          {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

          <Text style={styles.label}>Confirmar senha</Text>

          <View style={[styles.inputContainer, errors.confirmPassword && styles.inputContainerError]}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#9B969B" />

            <TextInput
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
              style={styles.input}
              onFocus={() => scrollToEnd(160)}
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
                color="#9B969B"
              />
            </TouchableOpacity>
          </View>

          {errors.confirmPassword ? (
            <Text style={styles.errorText}>{errors.confirmPassword}</Text>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#080808" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={22} color="#080808" />
                <Text style={styles.buttonText}>Criar conta</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.85} onPress={() => router.back()}>
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
                  <Ionicons name="location-outline" size={23} color="#D4A64A" />
                </View>

                <View>
                  <Text style={styles.modalEyebrow}>Cidade onde mora</Text>
                  <Text style={styles.modalTitle}>Escolher cidade onde mora</Text>
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
                style={{ flex: 1 }}
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

                        <View style={{ flex: 1 }}>
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
    paddingTop: 28,
    paddingBottom: 80,
    backgroundColor: '#050505',
  },

  heroCard: {
    backgroundColor: '#101014',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2830',
    marginBottom: 16,
    overflow: 'hidden',
  },

  logoShell: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  logo: {
    width: 100,
    height: 56,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  eyebrow: {
    color: '#D4A64A',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.7,
  },

  title: {
    color: '#F5F0E6',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 0.1,
  },

  subtitle: {
    color: '#9B969B',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },

  formCard: {
    backgroundColor: '#101014',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
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
    paddingRight: 10,
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

  atSign: {
    color: '#D4A64A',
    fontSize: 17,
    fontWeight: '900',
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
  },

  successText: {
    color: '#22C55E',
  },

  selectCard: {
    minHeight: 68,
    backgroundColor: '#18171D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  selectIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectLabel: {
    color: '#8F8A91',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
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
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  button: {
    height: 60,
    backgroundColor: '#D4A64A',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
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

  municipalityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'flex-end',
  },

  municipalityModalContent: {
    height: '82%',
    backgroundColor: '#101014',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
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
    borderRadius: 13,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: 12,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchBox: {
    height: 56,
    borderRadius: 14,
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
    borderRadius: 14,
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
    borderRadius: 11,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
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
