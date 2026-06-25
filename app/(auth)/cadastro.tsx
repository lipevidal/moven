import { useEffect, useState } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Keyboard,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../src/database/supabase';
import {
  searchMunicipalities,
  Municipality,
} from '../../src/features/municipalities/services/searchMunicipalities';

type RegisterErrors = {
  name?: string;
  username?: string;
  municipality?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export default function RegisterScreen() {
  // Estados principais do formulário de cadastro.
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameMessage, setUsernameMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});

  // Estados da busca de cidade base.
  const [municipalityModalVisible, setMunicipalityModalVisible] = useState(false);
  const [municipalitySearch, setMunicipalitySearch] = useState('');
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState<Municipality | null>(null);
  const [municipalityLoading, setMunicipalityLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Controla o teclado para reduzir a logo no iOS/Android e evitar que os campos fiquem cobertos.
  useEffect(() => {
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

  // Padroniza o username para ser usado em URL/perfil público.
  function formatUsername(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._]/g, '')
      .slice(0, 24);
  }

  function clearFieldError(field: keyof RegisterErrors) {
    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  }

  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
  }

  // Verifica se o username já está em uso no Supabase.
  async function checkUsername(value: string) {
    const cleanUsername = formatUsername(value);

    setUsername(cleanUsername);

    if (cleanUsername.length < 3) {
      setUsernameAvailable(false);
      setUsernameMessage('O nome de usuário precisa ter pelo menos 3 caracteres.');
      setErrors((current) => ({
        ...current,
        username: 'O nome de usuário precisa ter pelo menos 3 caracteres.',
      }));
      return false;
    }

    try {
      setUsernameLoading(true);

      const { data, error } = await supabase.rpc('is_username_available', {
        username_to_check: cleanUsername,
      });

      if (error) {
        throw error;
      }

      const available = data === true;

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
  }

  // Busca municípios conforme o usuário digita no modal.
  async function handleSearchMunicipalities(text: string) {
    setMunicipalitySearch(text);

    if (text.trim().length < 2) {
      setMunicipalities([]);
      return;
    }

    try {
      setMunicipalityLoading(true);

      const response = await searchMunicipalities(text);

      setMunicipalities(response);
    } catch (error) {
      console.log(error);
      setMunicipalities([]);
    } finally {
      setMunicipalityLoading(false);
    }
  }

  // Valida todos os campos e mostra mensagens em português abaixo de cada input.
  function validateFields() {
    const nextErrors: RegisterErrors = {};
    const cleanUsername = formatUsername(username);

    if (!name.trim()) {
      nextErrors.name = 'Informe seu nome completo.';
    } else if (name.trim().length < 2) {
      nextErrors.name = 'O nome precisa ter pelo menos 2 caracteres.';
    }

    if (!cleanUsername) {
      nextErrors.username = 'Informe um nome de usuário.';
    } else if (cleanUsername.length < 3) {
      nextErrors.username = 'O nome de usuário precisa ter pelo menos 3 caracteres.';
    }

    if (!selectedMunicipality) {
      nextErrors.municipality = 'Selecione sua cidade base.';
    }

    if (!email.trim()) {
      nextErrors.email = 'Informe seu e-mail.';
    } else if (!isValidEmail(email)) {
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
  }

  // Traduz erros retornados pelo Supabase para mensagens amigáveis em português.
  // Isso evita que mensagens como "User already registered" apareçam para o usuário.
  function translateRegisterError(error: any): {
    title: string;
    message: string;
    field?: keyof RegisterErrors;
  } {
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

    return {
      title: 'Erro ao criar conta',
      message: 'Não foi possível criar sua conta agora. Revise os dados e tente novamente.',
    };
  }

  async function handleRegister() {
    try {
      const valid = validateFields();

      if (!valid) {
        return;
      }

      const cleanUsername = formatUsername(username);
      const available = await checkUsername(cleanUsername);

      if (!available) {
        return;
      }

      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            name: name.trim(),
            username: cleanUsername,
            city: selectedMunicipality?.name,
            municipality_id: selectedMunicipality?.id,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.user && selectedMunicipality) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          name: name.trim(),
          full_name: name.trim(),
          username: cleanUsername,
          email: email.trim().toLowerCase(),
          city: selectedMunicipality.name,
          region: selectedMunicipality.immediate_region ?? selectedMunicipality.name,
          default_municipality_id: selectedMunicipality.id,
        });

        if (profileError) {
          if (profileError.code === '23505') {
            throw new Error('Este nome de usuário já está em uso.');
          }

          throw profileError;
        }
      }

      if (!data.session) {
        Alert.alert(
          'Confirmação de e-mail ativa',
          'A conta foi criada, mas o Supabase ainda está exigindo confirmação de e-mail. Desative essa opção no painel do Supabase para entrar automaticamente.',
        );

        router.replace('/(auth)/login');
        return;
      }

      Alert.alert('Conta criada', 'Sua conta foi criada com sucesso.');

      router.replace('/(private)/(tabs)/dashboard' as never);
    } catch (error: any) {
      const translatedError = translateRegisterError(error);

      if (translatedError.field) {
        setErrors((current) => ({
          ...current,
          [translatedError.field as keyof RegisterErrors]: translatedError.message,
        }));
      }

      Alert.alert(translatedError.title, translatedError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.scrollContent,
          keyboardVisible && styles.scrollContentKeyboard,
        ]}
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="always"
      >
        <View style={styles.heroCard}>
          <View style={styles.titleRow}>
            <View style={styles.logoShell}>
              <Image
                source={require('../../assets/images/movenapp-logo.png')}
                style={[styles.logo, keyboardVisible && styles.logoKeyboard]}
                resizeMode="contain"
              />
            </View>

            <View style={{ flex: 1,}}>
              <Text style={styles.eyebrow}>Comece agora</Text>
              <Text style={styles.title}>Criar conta</Text>
            </View>
          </View>

          <Text style={styles.subtitle}>
            Cadastre seus dados para acompanhar sua rotina, ganhos, corridas e desempenho no MovenApp.
          </Text>
        </View>

        <View style={styles.formCard}>
          {/* Campo de nome do usuário. */}
          <Text style={styles.label}>Nome completo</Text>
          <View style={[styles.inputContainer, errors.name && styles.inputContainerError]}>
            <Ionicons name="person-outline" size={20} color="#A1A1AA" />
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

          {/* Campo de username único para perfil público. */}
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
              <ActivityIndicator color="#22C55E" />
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

          {/* Seleção da cidade base. A região foi removida da exibição conforme solicitado. */}
          <Text style={styles.label}>Cidade base</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.selectCard, errors.municipality && styles.inputContainerError]}
            onPress={() => setMunicipalityModalVisible(true)}
          >
            <View style={styles.selectIcon}>
              <Ionicons name="location-outline" size={23} color="#22C55E" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.selectLabel}>Cidade de atuação</Text>
              <Text style={styles.selectText} numberOfLines={1}>
                {selectedMunicipality
                  ? `${selectedMunicipality.name} - ${selectedMunicipality.uf}`
                  : 'Selecionar cidade'}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={21} color="#FFFFFF" />
          </TouchableOpacity>
          {errors.municipality ? (
            <Text style={styles.errorText}>{errors.municipality}</Text>
          ) : null}

          {/* Campo de e-mail usado no login. */}
          <Text style={styles.label}>E-mail</Text>
          <View style={[styles.inputContainer, errors.email && styles.inputContainerError]}>
            <Ionicons name="mail-outline" size={20} color="#A1A1AA" />
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

          {/*
            No iOS, textContentType="oneTimeCode" evita que o sistema force a sugestão
            de senha forte e atrapalhe o usuário ao digitar a própria senha.
          */}
          <Text style={styles.label}>Senha</Text>
          <View style={[styles.inputContainer, errors.password && styles.inputContainerError]}>
            <Ionicons name="lock-closed-outline" size={20} color="#A1A1AA" />
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
            />

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.passwordIconButton}
              onPress={() => setShowPassword((current) => !current)}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#A1A1AA"
              />
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

          {/* Confirmação para impedir cadastro com senha digitada incorretamente. */}
          <Text style={styles.label}>Confirmar senha</Text>
          <View style={[styles.inputContainer, errors.confirmPassword && styles.inputContainerError]}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#A1A1AA" />
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
            />

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.passwordIconButton}
              onPress={() => setShowConfirmPassword((current) => !current)}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#A1A1AA"
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
              <ActivityIndicator color="#06130B" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={22} color="#06130B" />
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
                  <Ionicons name="location-outline" size={23} color="#22C55E" />
                </View>

                <View>
                  <Text style={styles.modalEyebrow}>Cidade base</Text>
                  <Text style={styles.modalTitle}>Escolher cidade</Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.modalCloseButton}
                onPress={() => setMunicipalityModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* A busca continua pesquisando cidade e região no service, mas a tela só exibe cidade/UF. */}
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={20} color="#A1A1AA" />
              <TextInput
                value={municipalitySearch}
                onChangeText={handleSearchMunicipalities}
                placeholder="Buscar cidade"
                placeholderTextColor="#71717A"
                autoCorrect={false}
                style={styles.municipalitySearchInput}
              />
            </View>

            {municipalityLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#22C55E" />
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
                    <Ionicons name="search-outline" size={34} color="#52525B" />
                    <Text style={styles.emptyTitle}>Busque sua cidade</Text>
                    <Text style={styles.emptyText}>
                      Digite pelo menos 2 letras para encontrar sua cidade base.
                    </Text>
                  </View>
                ) : municipalities.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="alert-circle-outline" size={34} color="#52525B" />
                    <Text style={styles.emptyTitle}>Nenhuma cidade encontrada</Text>
                    <Text style={styles.emptyText}>
                      Tente buscar pelo nome da cidade ou pela sigla do estado.
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
                        onPress={() => {
                          setSelectedMunicipality(item);
                          clearFieldError('municipality');
                          setMunicipalityModalVisible(false);
                        }}
                      >
                        <View style={styles.municipalityIconSmall}>
                          <Ionicons name="business-outline" size={19} color="#22C55E" />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.municipalityName} numberOfLines={1}>
                            {item.name} - {item.uf}
                          </Text>
                        </View>

                        {selected ? (
                          <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                        ) : (
                          <Ionicons name="chevron-forward" size={19} color="#71717A" />
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 60,
  },

  scrollContentKeyboard: {
    paddingTop: 16,
    paddingBottom: 240,
  },

  heroCard: {
    backgroundColor: '#0D1117',
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
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

  logoKeyboard: {
    width: 105,
    height: 56,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  titleIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  eyebrow: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 2,
  },

  subtitle: {
    alignItems: 'center',
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 14,
    textAlign: 'center',
  },

  formCard: {
    backgroundColor: '#111827',
    borderRadius: 30,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
  },

  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 8,
    marginLeft: 4,
  },

  inputContainer: {
    minHeight: 58,
    backgroundColor: '#18181B',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#27272A',
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
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 0,
  },

  atSign: {
    color: '#22C55E',
    fontSize: 17,
    fontWeight: '900',
  },

  helperText: {
    color: '#71717A',
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
    backgroundColor: '#18181B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  selectIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectLabel: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
  },

  selectText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  passwordIconButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  button: {
    height: 60,
    backgroundColor: '#22C55E',
    borderRadius: 20,
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
    color: '#06130B',
    fontSize: 16,
    fontWeight: '900',
  },

  link: {
    color: '#22C55E',
    textAlign: 'center',
    marginTop: 22,
    fontWeight: '900',
    fontSize: 14,
  },

  municipalityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },

  municipalityModalContent: {
    height: '82%',
    backgroundColor: '#09090B',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: '#27272A',
  },

  modalHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3F3F46',
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
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalEyebrow: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 2,
  },

  modalCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchBox: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },

  municipalitySearchInput: {
    flex: 1,
    height: '100%',
    color: '#FFFFFF',
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
    color: '#A1A1AA',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 12,
  },

  emptyText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },

  municipalityItem: {
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  municipalityItemSelected: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34,197,94,0.10)',
  },

  municipalityIconSmall: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  municipalityName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
