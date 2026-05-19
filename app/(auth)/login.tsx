import { useState } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';

import { router } from 'expo-router';

import { supabase } from '../../src/database/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    try {
      setLoading(true);

      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message ??
          'Não foi possível entrar.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Moven
      </Text>

      <Text style={styles.subtitle}>
        Controle sua rotina financeira.
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="E-mail"
        placeholderTextColor="#71717A"
        autoCapitalize="none"
        style={styles.input}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Senha"
        placeholderTextColor="#71717A"
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading
            ? 'Entrando...'
            : 'Entrar'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() =>
          router.push('/(auth)/cadastro')
        }
      >
        <Text style={styles.link}>
          Criar conta
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },

  title: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '800',
  },

  subtitle: {
    color: '#71717A',
    marginTop: 8,
    marginBottom: 40,
    fontSize: 16,
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