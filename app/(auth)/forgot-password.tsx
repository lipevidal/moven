import { useState } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../src/database/supabase';

type Step = 'email' | 'code';

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>('email');

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  function normalizeEmail(value: string) {
    return value.trim().toLowerCase();
  }

  function normalizeCode(value: string) {
    return value.replace(/\D/g, '').slice(0, 6);
  }

  async function handleSendCode() {
    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) {
      Alert.alert('E-mail obrigatório', 'Informe o e-mail da sua conta.');
      return;
    }

    try {
      setSending(true);

      const { error } =
        await supabase.auth.resetPasswordForEmail(cleanEmail);

      if (error) {
        throw error;
      }

      setEmail(cleanEmail);
      setStep('code');

      Alert.alert(
        'Código enviado',
        'Enviamos um código de recuperação para o seu e-mail.',
      );
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message ?? 'Não foi possível enviar o código.',
      );
    } finally {
      setSending(false);
    }
  }

  async function handleResetPassword() {
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

    try {
      setUpdating(true);

      const { error: verifyError } =
        await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanCode,
          type: 'recovery',
        });

      if (verifyError) {
        throw verifyError;
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (updateError) {
        throw updateError;
      }

      await supabase.auth.signOut();

      Alert.alert(
        'Senha alterada',
        'Sua senha foi atualizada com sucesso. Faça login novamente.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)/login' as never),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message ??
          'Não foi possível alterar sua senha. Confira o código e tente novamente.',
      );
    } finally {
      setUpdating(false);
    }
  }

  function handleBackToEmail() {
    setStep('email');
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="always"
      >
        <Image
          source={require('../../assets/images/movenapp-logo.png')}
          style={[
            styles.logo,
            step === 'code' && styles.logoSmall,
          ]}
          resizeMode="contain"
        />

        <Text style={styles.title}>
          Redefinir senha
        </Text>

        <Text style={styles.subtitle}>
          {step === 'email'
            ? 'Informe seu e-mail para receber o código de recuperação.'
            : 'Digite o código recebido e crie uma nova senha.'}
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>
            E-mail
          </Text>

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

                  <Text style={styles.buttonText}>
                    Enviar código
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <Text style={styles.label}>
                Código recebido
              </Text>

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
              />

              <Text style={styles.label}>
                Nova senha
              </Text>

              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Digite a nova senha"
                placeholderTextColor="#71717A"
                secureTextEntry
                returnKeyType="next"
                style={styles.input}
              />

              <Text style={styles.label}>
                Confirmar nova senha
              </Text>

              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repita a nova senha"
                placeholderTextColor="#71717A"
                secureTextEntry
                returnKeyType="done"
                style={styles.input}
              />

              <TouchableOpacity
                style={[
                  styles.button,
                  updating && styles.buttonDisabled,
                ]}
                onPress={handleResetPassword}
                disabled={updating}
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

                    <Text style={styles.buttonText}>
                      Alterar senha
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleSendCode}
                disabled={sending}
              >
                <Text style={styles.secondaryButtonText}>
                  Reenviar código
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleBackToEmail}
              >
                <Text style={styles.secondaryButtonText}>
                  Trocar e-mail
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity
          onPress={() => router.replace('/(auth)/login' as never)}
        >
          <Text style={styles.link}>
            Voltar para login
          </Text>
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
    paddingHorizontal: 24,
    paddingTop: 44,
    paddingBottom: 180,
    justifyContent: 'flex-start',
    backgroundColor: '#050505',
  },
  logo: {
    width: 210,
    height: 120,
    alignSelf: 'center',
    marginBottom: 6,
  },
  logoSmall: {
    width: 170,
    height: 90,
    marginBottom: 2,
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
    shadowColor: '#D4A64A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 10,
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
