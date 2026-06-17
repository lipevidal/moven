import { useEffect, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getProfile } from '../../../src/features/profile/services/getProfile';
import { signOut } from '../../../src/features/auth/services/signOut';

export default function ProfileSettingsScreen() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const response = await getProfile();
    setProfile(response);
  }

  function handleLogout() {
    Alert.alert(
      'Sair da conta',
      'Deseja realmente sair?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  }

  const menuItems = [
    {
      title: 'Minha conta',
      icon: 'person-outline',
      route: '/(private)/perfil/minha-conta',
    },
    {
      title: 'Assinatura',
      icon: 'diamond-outline',
      route: '/(private)/perfil/assinatura',
    },
    {
      title: 'Meus veículos',
      icon: 'car-sport-outline',
      route: '/(private)/(tabs)/veiculos',
    },
    {
      title: 'Notificações',
      icon: 'notifications-outline',
      route: '/(private)/perfil/notificacoes',
    },
    {
      title: 'Privacidade',
      icon: 'shield-checkmark-outline',
      route: '/(private)/perfil/privacidade',
    },
    {
      title: 'Comunidade',
      icon: 'people-outline',
      route: '/(private)/perfil/comunidade',
    },
    {
      title: 'Central de ajuda',
      icon: 'help-circle-outline',
      route: '/(private)/perfil/ajuda',
    },
    {
      title: 'Sobre o Moven',
      icon: 'information-circle-outline',
      route: '/(private)/perfil/sobre',
    },
  ];

  if (!profile) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeader}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Ionicons name="person" size={30} color="#FFFFFF" />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{profile.full_name}</Text>
          <Text style={styles.email}>{profile.email}</Text>

          <View style={styles.planBadge}>
            <Ionicons
              name={profile.premium ? 'diamond' : 'ellipse-outline'}
              size={12}
              color={profile.premium ? '#FACC15' : '#A1A1AA'}
            />

            <Text
              style={[
                styles.planBadgeText,
                profile.premium && { color: '#FACC15' },
              ]}
            >
              {profile.premium ? 'Premium' : 'Free'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.menuCard}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={styles.menuItem}
            onPress={() => router.push(item.route as never)}
          >
            <View style={styles.menuLeft}>
              <Ionicons name={item.icon as any} size={18} color="#A1A1AA" />

              <Text style={styles.menuText}>{item.title}</Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color="#71717A" />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color="#EF4444" />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 120,
  },

  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  avatar: {
    width: 62,
    height: 62,
    borderRadius: 999,
    marginRight: 14,
  },

  avatarFallback: {
    width: 62,
    height: 62,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  name: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  email: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },

  planBadge: {
    alignSelf: 'flex-start',
    marginTop: 7,
    paddingHorizontal: 9,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  planBadgeText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '900',
  },

  menuCard: {
    backgroundColor: '#111827',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1F2937',
    overflow: 'hidden',
  },

  menuItem: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  menuText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  logoutButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginTop: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  logoutText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '900',
  },
});