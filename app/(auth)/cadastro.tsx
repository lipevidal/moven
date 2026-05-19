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

export default function RegisterScreen() {
  const [name, setName] = useState('');

  const [email, setEmail] = useState('');

  const [password, setPassword] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  async function handleRegister() {
    try {
      setLoading(true);

      const {
        data,
        error,
      } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            name,
            email,
          });
      }

      Alert.alert(
        'Conta criada',
        'Sua conta foi criada com sucesso.',
      );

      router.replace('/(auth)/login');
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message ??
          'Não foi possível criar a conta.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Criar conta
      </Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Nome"
        placeholderTextColor="#71717A"
        style={styles.input}
      />

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
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading
            ? 'Criando...'
            : 'Criar conta'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() =>
          router.back()
        }
      >
        <Text style={styles.link}>
          Já tenho conta
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
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 36,
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