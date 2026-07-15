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
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

import { supabase } from '../../src/database/supabase';

type FocusedField = 'newPassword' | 'confirmPassword' | null;

/**
 * Logo fora do componente.
 *
 * Isso evita recriar o require a cada renderização.
 */
const LOGO_SOURCE = require('../../assets/images/movenapp-logo.png');

/**
 * Rotas usadas por esta tela.
 */
const ROUTES = {
  login: '/(auth)/login',
} as const;

/**
 * Tempo curto para dar ao teclado tempo de fechar antes do processamento.
 */
const KEYBOARD_DISMISS_DELAY_MS = 120;

/**
 * Extrai parâmetros vindos do deep link.
 *
 * O Linking.parse pode retornar string, array ou undefined.
 * Esta função padroniza o retorno para string ou null.
 */
function getParam(value: unknown) {
  if (Array.isArray(value)) return value[0];
  if (typeof value === 'string') return value;
  return null;
}

/**
 * Aguarda alguns milissegundos.
 */
function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Tela de redefinição de senha por link.
 *
 * Correção mais forte para teclado:
 * - Usa a altura real do teclado.
 * - Quando o teclado abre, oculta a logo para liberar espaço.
 * - Quando o teclado abre, muda o conteúdo de centralizado para topo.
 * - Adiciona paddingBottom baseado na altura do teclado.
 * - Mede a posição dos inputs e rola exatamente para o campo focado.
 * - Fecha o teclado antes de processar o botão Salvar.
 */
export default function ResetPasswordScreen() {
  /**
   * ScrollView principal.
   */
  const scrollRef = useRef<any>(null);

  /**
   * Guarda se o componente ainda está montado.
   */
  const mountedRef = useRef(true);

  /**
   * Evita duplo clique no botão de salvar.
   */
  const updateRequestRef = useRef(false);

  /**
   * Guarda qual campo está focado.
   *
   * Quando o teclado abre, usamos essa informação para rolar até o input correto.
   */
  const focusedFieldRef = useRef<FocusedField>(null);

  /**
   * Guarda a posição vertical de cada input dentro do ScrollView.
   */
  const inputPositionsRef = useRef<Record<string, number>>({});

  /**
   * Campos do formulário.
   */
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  /**
   * Estados de loading/sessão.
   */
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  /**
   * Estado do teclado.
   *
   * height é a altura real do teclado no dispositivo.
   */
  const [keyboardInfo, setKeyboardInfo] = useState({
    visible: false,
    height: 0,
  });

  /**
   * Rola até o input focado.
   *
   * Em vez de usar somente scrollToEnd, medimos a posição do input.
   * Isso evita o teclado tampar o campo em telas menores.
   */
  const scrollToFocusedField = useCallback((field: FocusedField, delay = 80) => {
    if (!field) return;

    setTimeout(() => {
      const fieldY = inputPositionsRef.current[field] ?? 0;

      scrollRef.current?.scrollTo({
        y: Math.max(fieldY - 18, 0),
        animated: true,
      });
    }, delay);
  }, []);

  /**
   * Registra o campo focado e tenta rolar até ele.
   */
  const handleInputFocus = useCallback((field: Exclude<FocusedField, null>) => {
    focusedFieldRef.current = field;

    /**
     * Primeiro scroll curto.
     */
    scrollToFocusedField(field, 80);

    /**
     * Segundo scroll depois que o teclado terminou de abrir.
     */
    scrollToFocusedField(field, 280);
  }, [scrollToFocusedField]);

  /**
   * Envia o usuário de volta para a tela de login.
   */
  const goToLogin = useCallback(() => {
    router.replace(ROUTES.login as never);
  }, []);

  /**
   * Processa uma URL de recuperação de senha.
   */
  const handleRecoveryUrl = useCallback(async (url: string) => {
    try {
      if (!mountedRef.current) return;

      setCheckingLink(true);

      const parsedUrl = Linking.parse(url);
      const queryParams = parsedUrl.queryParams ?? {};

      const code = getParam(queryParams.code);
      const accessToken = getParam(queryParams.access_token);
      const refreshToken = getParam(queryParams.refresh_token);

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) throw error;

        if (!mountedRef.current) return;

        setHasRecoverySession(true);
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) throw error;

        if (!mountedRef.current) return;

        setHasRecoverySession(true);
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (!mountedRef.current) return;

      setHasRecoverySession(Boolean(data.session));
    } catch (error: any) {
      if (!mountedRef.current) return;

      setHasRecoverySession(false);

      Alert.alert(
        'Link inválido',
        error?.message ?? 'Não foi possível validar o link de recuperação.',
      );
    } finally {
      if (mountedRef.current) {
        setCheckingLink(false);
      }
    }
  }, []);

  /**
   * Prepara a sessão de recuperação ao abrir a tela.
   */
  const prepareRecoverySession = useCallback(async () => {
    try {
      setCheckingLink(true);

      const initialUrl = await Linking.getInitialURL();

      if (initialUrl) {
        await handleRecoveryUrl(initialUrl);
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (!mountedRef.current) return;

      setHasRecoverySession(Boolean(data.session));
    } catch (error) {
      console.log('Erro ao preparar sessão de recuperação:', error);

      if (mountedRef.current) {
        setHasRecoverySession(false);
      }
    } finally {
      if (mountedRef.current) {
        setCheckingLink(false);
      }
    }
  }, [handleRecoveryUrl]);

  useEffect(() => {
    mountedRef.current = true;

    prepareRecoverySession();

    /**
     * Escuta deep links recebidos com o app aberto.
     */
    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      handleRecoveryUrl(url);
    });

    /**
     * iOS tem eventos "will", Android usa melhor "did".
     */
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';

    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    /**
     * Quando o teclado abre:
     * - guarda a altura real do teclado
     * - rola até o input focado
     */
    const keyboardShowSubscription = Keyboard.addListener(showEvent, (event) => {
      const keyboardHeight = event?.endCoordinates?.height ?? 320;

      setKeyboardInfo({
        visible: true,
        height: keyboardHeight,
      });

      scrollToFocusedField(focusedFieldRef.current, 160);
      scrollToFocusedField(focusedFieldRef.current, 320);
    });

    /**
     * Quando o teclado fecha:
     * - volta ao layout centralizado.
     */
    const keyboardHideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardInfo({
        visible: false,
        height: 0,
      });

      focusedFieldRef.current = null;
    });

    return () => {
      mountedRef.current = false;
      linkSubscription.remove();
      keyboardShowSubscription.remove();
      keyboardHideSubscription.remove();
    };
  }, [handleRecoveryUrl, prepareRecoverySession, scrollToFocusedField]);

  /**
   * Valida e salva a nova senha no Supabase.
   */
  const handleUpdatePassword = useCallback(async () => {
    try {
      if (loading || updateRequestRef.current) return;

      updateRequestRef.current = true;

      /**
       * Primeiro fecha o teclado.
       */
      Keyboard.dismiss();
      await wait(KEYBOARD_DISMISS_DELAY_MS);

      if (!hasRecoverySession) {
        Alert.alert(
          'Link necessário',
          'Abra esta tela pelo link enviado para o seu e-mail.',
        );
        return;
      }

      if (newPassword.length < 6) {
        Alert.alert(
          'Senha inválida',
          'A nova senha precisa ter pelo menos 6 caracteres.',
        );
        return;
      }

      if (newPassword !== confirmPassword) {
        Alert.alert(
          'Senhas diferentes',
          'A confirmação precisa ser igual à nova senha.',
        );
        return;
      }

      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      await supabase.auth.signOut();

      Alert.alert(
        'Senha alterada',
        'Sua senha foi redefinida com sucesso. Faça login novamente.',
        [
          {
            text: 'OK',
            onPress: goToLogin,
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error?.message ?? 'Não foi possível redefinir sua senha.',
      );
    } finally {
      setLoading(false);
      updateRequestRef.current = false;
    }
  }, [
    confirmPassword,
    goToLogin,
    hasRecoverySession,
    loading,
    newPassword,
  ]);

  const buttonDisabled = loading || checkingLink || !hasRecoverySession;

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.content,
          keyboardInfo.visible && styles.contentKeyboard,
          keyboardInfo.visible && {
            paddingBottom: keyboardInfo.height + 190,
          },
        ]}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustKeyboardInsets={false}
        overScrollMode="never"
        bounces={false}
      >
        {!keyboardInfo.visible ? (
          <View style={styles.logoWrapper}>
            <Image
              source={LOGO_SOURCE}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        ) : null}

        <Text style={[
          styles.title,
          keyboardInfo.visible && styles.titleKeyboard,
        ]}>
          Criar nova senha
        </Text>

        <Text style={[
          styles.subtitle,
          keyboardInfo.visible && styles.subtitleKeyboard,
        ]}>
          Digite sua nova senha para recuperar o acesso à sua conta.
        </Text>

        {checkingLink ? (
          <View style={styles.statusBox}>
            <ActivityIndicator color="#D4A64A" />
            <Text style={styles.statusText}>Validando link...</Text>
          </View>
        ) : !hasRecoverySession ? (
          <View style={styles.warningBox}>
            <Ionicons name="alert-circle-outline" size={24} color="#FACC15" />
            <Text style={styles.warningText}>
              Abra esta tela pelo link enviado para o seu e-mail.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>Nova senha</Text>

          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Digite a nova senha"
            placeholderTextColor="#71717A"
            secureTextEntry
            style={styles.input}
            onFocus={() => handleInputFocus('newPassword')}
            onLayout={(event) => {
              inputPositionsRef.current.newPassword = event.nativeEvent.layout.y;
            }}
          />

          <Text style={styles.label}>Confirmar senha</Text>

          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Digite novamente"
            placeholderTextColor="#71717A"
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleUpdatePassword}
            style={styles.input}
            onFocus={() => handleInputFocus('confirmPassword')}
            onLayout={(event) => {
              inputPositionsRef.current.confirmPassword = event.nativeEvent.layout.y;
            }}
          />

          <TouchableOpacity
            style={[styles.button, buttonDisabled && styles.buttonDisabled]}
            onPress={handleUpdatePassword}
            disabled={buttonDisabled}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#080808" />
            ) : (
              <Text style={styles.buttonText}>Salvar nova senha</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={goToLogin} activeOpacity={0.85}>
          <Text style={styles.link}>Voltar para login</Text>
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

  /**
   * Estado normal:
   * conteúdo centralizado verticalmente.
   */
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 70,
    justifyContent: 'center',
    backgroundColor: '#050505',
  },

  /**
   * Estado com teclado:
   * conteúdo no topo para liberar área visível.
   */
  contentKeyboard: {
    justifyContent: 'flex-start',
    paddingTop: 14,
  },

  logoWrapper: {
    alignItems: 'center',
    marginBottom: 10,
  },

  logo: {
    width: 190,
    height: 100,
  },

  title: {
    color: '#F5F0E6',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },

  titleKeyboard: {
    fontSize: 24,
  },

  subtitle: {
    color: '#9B969B',
    marginTop: 8,
    marginBottom: 24,
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 21,
  },

  subtitleKeyboard: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },

  statusBox: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
  },

  statusText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '800',
  },

  warningBox: {
    minHeight: 62,
    borderRadius: 16,
    backgroundColor: 'rgba(250,204,21,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.38)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 18,
  },

  warningText: {
    flex: 1,
    color: '#FACC15',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },

  card: {
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 18,
    padding: 16,
  },

  label: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    marginLeft: 4,
  },

  input: {
    height: 58,
    backgroundColor: '#18171D',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 18,
    color: '#F5F0E6',
    marginBottom: 16,
    fontSize: 15,
  },

  button: {
    height: 58,
    backgroundColor: '#D4A64A',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#080808',
    fontSize: 16,
    fontWeight: '900',
  },

  link: {
    color: '#D4A64A',
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '900',
  },
});
