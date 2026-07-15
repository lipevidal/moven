import { useCallback, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
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

type Step = 'email' | 'code';

/**
 * Logo fora do componente.
 *
 * Isso evita recriar o require a cada renderização.
 */
const LOGO_SOURCE = require('../../assets/images/movenapp-logo.png');

/**
 * Rotas usadas pela tela.
 *
 * Centralizar as rotas facilita manutenção.
 */
const ROUTES = {
  login: '/(auth)/login',
} as const;

/**
 * Tempo usado para aguardar o teclado iniciar o fechamento antes do processamento.
 */
const KEYBOARD_DISMISS_DELAY_MS = 120;

/**
 * Normaliza o e-mail digitado pelo usuário.
 *
 * Exemplo:
 * " Usuario@Email.Com " vira "usuario@email.com".
 */
function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Normaliza o código de recuperação.
 *
 * Regras:
 * - remove tudo que não for número
 * - limita em 6 dígitos
 */
function normalizeCode(value: string) {
  return value.replace(/\D/g, '').slice(0, 6);
}

/**
 * Aguarda alguns milissegundos.
 *
 * Usado para fechar o teclado antes de iniciar o processamento.
 */
function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Tela de recuperação/redefinição de senha.
 *
 * Fluxo:
 * 1. Usuário informa o e-mail.
 * 2. App pede ao Supabase para enviar código de recuperação.
 * 3. Usuário informa código + nova senha.
 * 4. App verifica o código com verifyOtp.
 * 5. App atualiza a senha com updateUser.
 * 6. App faz signOut e volta para login.
 *
 * Otimizações aplicadas:
 * - Removido KeyboardAvoidingView.
 * - Removido Platform.
 * - Removido ajuste automático de teclado/insets.
 * - Conteúdo centralizado verticalmente com ScrollView.
 * - Funções auxiliares movidas para fora do componente.
 * - Bloqueio contra cliques duplicados com refs.
 * - Fecha o teclado antes de iniciar envio/alteração.
 * - Fundo preto aplicado no View externo e no ScrollView para evitar faixa branca.
 */
export default function ForgotPasswordScreen() {
  /**
   * Referência do ScrollView principal.
   *
   * Usada para rolar até o final quando necessário.
   */
  const scrollRef = useRef<any>(null);

  /**
   * Evita duplo clique no envio do código.
   */
  const sendingRequestRef = useRef(false);

  /**
   * Evita duplo clique na alteração de senha.
   */
  const updatingRequestRef = useRef(false);

  /**
   * Etapa atual:
   * - email: usuário informa o e-mail para receber o código.
   * - code: usuário informa código e nova senha.
   */
  const [step, setStep] = useState<Step>('email');

  /**
   * Campos do formulário.
   */
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  /**
   * Loadings separados para cada ação.
   */
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  /**
   * Rola a tela para o final.
   *
   * Ajuda quando o teclado abre na etapa de código/senha.
   */
  const scrollToEnd = useCallback((delay = 120) => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, delay);
  }, []);

  /**
   * Envia o código de recuperação para o e-mail informado.
   */
  const handleSendCode = useCallback(async () => {
    try {
      if (sending || sendingRequestRef.current) return;

      sendingRequestRef.current = true;

      /**
       * Primeiro fecha o teclado.
       * Só depois começa a validação e o processamento.
       */
      Keyboard.dismiss();
      await wait(KEYBOARD_DISMISS_DELAY_MS);

      const cleanEmail = normalizeEmail(email);

      if (!cleanEmail) {
        Alert.alert('E-mail obrigatório', 'Informe o e-mail da sua conta.');
        return;
      }

      setSending(true);

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);

      if (error) throw error;

      setEmail(cleanEmail);
      setStep('code');

      /**
       * Ao mudar para etapa de código, rola para o final para facilitar acesso
       * aos campos e botões em telas menores.
       */
      scrollToEnd(160);

      Alert.alert(
        'Código enviado',
        'Enviamos um código de recuperação para o seu e-mail.',
      );
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error?.message ?? 'Não foi possível enviar o código.',
      );
    } finally {
      setSending(false);
      sendingRequestRef.current = false;
    }
  }, [email, scrollToEnd, sending]);

  /**
   * Valida código e nova senha, depois altera a senha no Supabase.
   */
  const handleResetPassword = useCallback(async () => {
    try {
      if (updating || updatingRequestRef.current) return;

      updatingRequestRef.current = true;

      /**
       * Fecha o teclado antes de validar/processar.
       */
      Keyboard.dismiss();
      await wait(KEYBOARD_DISMISS_DELAY_MS);

      const cleanEmail = normalizeEmail(email);
      const cleanCode = normalizeCode(code);

      if (!cleanEmail) {
        Alert.alert('E-mail obrigatório', 'Informe o e-mail da sua conta.');
        setStep('email');
        return;
      }

      if (cleanCode.length !== 6) {
        Alert.alert(
          'Código inválido',
          'Digite o código de 6 dígitos enviado para seu e-mail.',
        );
        scrollToEnd(100);
        return;
      }

      if (newPassword.length < 6) {
        Alert.alert(
          'Senha inválida',
          'A nova senha precisa ter pelo menos 6 caracteres.',
        );
        scrollToEnd(100);
        return;
      }

      if (newPassword !== confirmPassword) {
        Alert.alert(
          'Senhas diferentes',
          'A confirmação precisa ser igual à nova senha.',
        );
        scrollToEnd(100);
        return;
      }

      setUpdating(true);

      /**
       * Verifica o código enviado por e-mail.
       */
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'recovery',
      });

      if (verifyError) throw verifyError;

      /**
       * Após o código ser validado, atualiza a senha do usuário.
       */
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      /**
       * Sai da sessão de recuperação para exigir login com a nova senha.
       */
      await supabase.auth.signOut();

      Alert.alert(
        'Senha alterada',
        'Sua senha foi atualizada com sucesso. Faça login novamente.',
        [
          {
            text: 'OK',
            onPress: () => router.replace(ROUTES.login as never),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error?.message ??
          'Não foi possível alterar sua senha. Confira o código e tente novamente.',
      );
    } finally {
      setUpdating(false);
      updatingRequestRef.current = false;
    }
  }, [code, confirmPassword, email, newPassword, scrollToEnd, updating]);

  /**
   * Volta para a etapa de e-mail e limpa os campos sensíveis.
   */
  const handleBackToEmail = useCallback(() => {
    setStep('email');
    setCode('');
    setNewPassword('');
    setConfirmPassword('');

    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }, 80);
  }, []);

  /**
   * Volta para a tela de login.
   */
  const goToLogin = useCallback(() => {
    router.replace(ROUTES.login as never);
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustKeyboardInsets={false}
        overScrollMode="never"
        bounces={false}
      >
        <Image
          source={LOGO_SOURCE}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>Redefinir senha</Text>

        <Text style={styles.subtitle}>
          {step === 'email'
            ? 'Informe seu e-mail para receber o código de recuperação.'
            : 'Digite o código recebido e crie uma nova senha.'}
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>E-mail</Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="seuemail@exemplo.com"
            placeholderTextColor="#71717A"
            autoCapitalize="none"
            keyboardType="email-address"
            editable={step === 'email'}
            returnKeyType="next"
            style={[
              styles.input,
              step !== 'email' && styles.inputDisabled,
            ]}
          />

          {step === 'email' ? (
            <TouchableOpacity
              style={[
                styles.button,
                sending && styles.buttonDisabled,
              ]}
              onPress={handleSendCode}
              disabled={sending}
              activeOpacity={0.9}
            >
              {sending ? (
                <ActivityIndicator color="#080808" />
              ) : (
                <>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color="#080808"
                  />

                  <Text style={styles.buttonText}>Enviar código</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <Text style={styles.label}>Código recebido</Text>

              <TextInput
                value={code}
                onChangeText={(value) => setCode(normalizeCode(value))}
                placeholder="000000"
                placeholderTextColor="#71717A"
                keyboardType="number-pad"
                maxLength={6}
                style={[
                  styles.input,
                  styles.codeInput,
                ]}
                onFocus={() => scrollToEnd(160)}
              />

              <Text style={styles.label}>Nova senha</Text>

              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Digite a nova senha"
                placeholderTextColor="#71717A"
                secureTextEntry
                returnKeyType="next"
                style={styles.input}
                onFocus={() => scrollToEnd(160)}
              />

              <Text style={styles.label}>Confirmar nova senha</Text>

              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repita a nova senha"
                placeholderTextColor="#71717A"
                secureTextEntry
                returnKeyType="done"
                style={styles.input}
                onFocus={() => scrollToEnd(160)}
                onSubmitEditing={handleResetPassword}
              />

              <TouchableOpacity
                style={[
                  styles.button,
                  updating && styles.buttonDisabled,
                ]}
                onPress={handleResetPassword}
                disabled={updating}
                activeOpacity={0.9}
              >
                {updating ? (
                  <ActivityIndicator color="#080808" />
                ) : (
                  <>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="#080808"
                    />

                    <Text style={styles.buttonText}>Alterar senha</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleSendCode}
                disabled={sending}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryButtonText}>Reenviar código</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleBackToEmail}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryButtonText}>Trocar e-mail</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity
          onPress={goToLogin}
          activeOpacity={0.85}
        >
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
   * Centraliza verticalmente todo o conteúdo.
   *
   * flexGrow + justifyContent center centralizam quando o conteúdo cabe na tela.
   * Se o conteúdo ficar maior que a tela, o ScrollView continua permitindo rolagem.
   */
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 70,
    justifyContent: 'center',
    backgroundColor: '#050505',
  },

  logo: {
    width: 180,
    height: 92,
    alignSelf: 'center',
    marginBottom: 8,
  },

  title: {
    color: '#F5F0E6',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.6,
  },

  subtitle: {
    color: '#9B969B',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 22,
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
    fontWeight: '900',
    marginBottom: 8,
    marginLeft: 4,
  },

  input: {
    height: 58,
    backgroundColor: '#18171D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 18,
    color: '#F5F0E6',
    marginBottom: 16,
    fontSize: 15,
    fontWeight: '700',
  },

  inputDisabled: {
    opacity: 0.65,
  },

  codeInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 22,
    fontWeight: '900',
  },

  button: {
    height: 58,
    backgroundColor: '#D4A64A',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    flexDirection: 'row',
    gap: 10,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#080808',
    fontSize: 16,
    fontWeight: '900',
  },

  secondaryButton: {
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  secondaryButtonText: {
    color: '#D4A64A',
    fontSize: 13,
    fontWeight: '900',
  },

  link: {
    color: '#D4A64A',
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '900',
  },
});
