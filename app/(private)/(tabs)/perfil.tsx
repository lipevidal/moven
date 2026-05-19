import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';

import { useEffect, useState } from 'react';

import { router } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../src/database/supabase';

import { colors } from '../../../src/constants/colors';

export default function ProfileScreen() {
  const [user, setUser] =
    useState<any>(null);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);
  }

  async function handleLogout() {
    Alert.alert(
      'Sair',
      'Deseja realmente sair da conta?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },

        {
          text: 'Sair',

          style: 'destructive',

          onPress: async () => {
            await supabase.auth.signOut();

            router.replace(
              '/(auth)/login',
            );
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.content
      }
      showsVerticalScrollIndicator={
        false
      }
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons
            name="person"
            size={42}
            color="#FFFFFF"
          />
        </View>

        <Text style={styles.name}>
          {user?.email?.split(
            '@',
          )[0] ?? 'Usuário'}
        </Text>

        <Text style={styles.email}>
          {user?.email}
        </Text>
      </View>

      <View style={styles.section}>
        <Text
          style={
            styles.sectionTitle
          }
        >
          Conta
        </Text>

        <TouchableOpacity
          style={styles.option}
        >
          <Ionicons
            name="person-outline"
            size={22}
            color="#22C55E"
          />

          <Text
            style={
              styles.optionText
            }
          >
            Editar perfil
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.option}
        >
          <Ionicons
            name="car-outline"
            size={22}
            color="#22C55E"
          />

          <Text
            style={
              styles.optionText
            }
          >
            Veículos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.option}
        >
          <Ionicons
            name="notifications-outline"
            size={22}
            color="#22C55E"
          />

          <Text
            style={
              styles.optionText
            }
          >
            Notificações
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.option}
        >
          <Ionicons
            name="shield-outline"
            size={22}
            color="#22C55E"
          />

          <Text
            style={
              styles.optionText
            }
          >
            Privacidade
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text
          style={
            styles.sectionTitle
          }
        >
          Aplicativo
        </Text>

        <TouchableOpacity
          style={styles.option}
        >
          <Ionicons
            name="star-outline"
            size={22}
            color="#22C55E"
          />

          <Text
            style={
              styles.optionText
            }
          >
            Avaliar aplicativo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.option}
        >
          <Ionicons
            name="help-circle-outline"
            size={22}
            color="#22C55E"
          />

          <Text
            style={
              styles.optionText
            }
          >
            Suporte
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Ionicons
          name="log-out-outline"
          size={22}
          color="#FFFFFF"
        />

        <Text
          style={
            styles.logoutText
          }
        >
          Sair da conta
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      colors.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 140,
  },

  header: {
    alignItems: 'center',
    marginBottom: 36,
  },

  avatar: {
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor:
      '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  name: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },

  email: {
    color: '#71717A',
    marginTop: 6,
  },

  section: {
    marginBottom: 26,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },

  option: {
    height: 62,
    borderRadius: 20,
    backgroundColor:
      '#18181B',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },

  optionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  logoutButton: {
    height: 58,
    borderRadius: 18,
    backgroundColor:
      '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },

  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});