import { useEffect, useState } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../src/database/supabase';

export default function ResetPasswordScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    prepareRecoverySession();

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleRecoveryUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  async function prepareRecoverySession() {
    try {
      const initialUrl = await Linking.getInitialURL();

      if (initialUrl) {
        await handleRecoveryUrl(initialUrl);
        return;
      }

      const { data } = await supabase.auth.getSession();

      setHasRecoverySession(Boolean(data.session));
    } catch (error) {
      console.log(error);
    } finally {
      setCheckingLink(false);
    }
  }

  async function handleRecoveryUrl(url: string) {
    try {
      setCheckingLink(true);

      const parsedUrl = Linking.parse(url);
      const queryParams = parsedUrl.queryParams ?? {};

      const code = getParam(queryParams.code);
      const accessToken = getParam(queryParams.access_token);
      const refreshToken = getParam(queryParams.refresh_token);

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          throw error;
        }

        setHasRecoverySession(true);
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          throw error;
        }

        setHasRecoverySession(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      setHasRecoverySession(Boolean(data.session));
    } catch (error: any) {
      Alert.alert(
        'Link inválido',
        error.message ?? 'Não foi possível validar o link de recuperação.',
      );
    } finally {
      setCheckingLink(false);
    }
  }

  function getParam(value: unknown) {
    if (Array.isArray(value)) return value[0];
    if (typeof value === 'string') return value;
    return null;
  }

  async function handleUpdatePassword() {
    try {
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

      if (error) {
        throw error;
      }

      await supabase.auth.signOut();

      Alert.alert(
        'Senha alterada',
        'Sua senha foi redefinida com sucesso. Faça login novamente.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)/login'),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message ?? 'Não foi possível redefinir sua senha.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
      >
        <View style={styles.logoWrapper}>
          <Image
            source={require('../../assets/images/movenapp-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>Criar nova senha</Text>

        <Text style={styles.subtitle}>
          Digite sua nova senha para recuperar o acesso à sua conta.
        </Text>

        {checkingLink ? (
          <View style={styles.statusBox}>
            <ActivityIndicator color="#22C55E" />
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

        <Text style={styles.label}>Nova senha</Text>
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Digite a nova senha"
          placeholderTextColor="#71717A"
          secureTextEntry
          style={styles.input}
        />

        <Text style={styles.label}>Confirmar senha</Text>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Digite novamente"
          placeholderTextColor="#71717A"
          secureTextEntry
          style={styles.input}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleUpdatePassword}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.link}>Voltar para login</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 80,
    justifyContent: 'center',
  },

  logoWrapper: {
    alignItems: 'center',
    marginBottom: 10,
  },

  logo: {
    width: 230,
    height: 145,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },

  subtitle: {
    color: '#71717A',
    marginTop: 8,
    marginBottom: 28,
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 21,
  },

  statusBox: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
  },

  statusText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '800',
  },

  warningBox: {
    minHeight: 62,
    borderRadius: 16,
    backgroundColor: '#2A2408',
    borderWidth: 1,
    borderColor: '#713F12',
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

  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    marginLeft: 4,
  },

  input: {
    height: 58,
    backgroundColor: '#18181B',
    borderRadius: 18,
    paddingHorizontal: 18,
    color: '#FFFFFF',
    marginBottom: 16,
    fontSize: 15,
  },

  button: {
    height: 58,
    backgroundColor: '#22C55E',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  link: {
    color: '#22C55E',
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '700',
  },
});
