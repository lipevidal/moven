import { useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  Alert,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { searchUsers } from '../../src/features/friendships/services/searchUsers';
import { sendFriendRequest } from '../../src/features/friendships/services/sendFriendRequest';

export default function SearchDriversScreen() {
  const [search, setSearch] = useState('');
  const [drivers, setDrivers] = useState<any[]>([]);

  async function handleSearch(text: string) {
    setSearch(text);

    if (text.trim().length < 2) {
      setDrivers([]);
      return;
    }

    const response = await searchUsers(text);
    setDrivers(response);
  }

  async function handleSendRequest(userId: string) {
    try {
      await sendFriendRequest(userId);

      Alert.alert(
        'Solicitação enviada',
        'Agora é só aguardar a pessoa aceitar.',
      );

      setDrivers((prev) => prev.filter((item) => item.id !== userId));
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message ?? 'Não foi possível enviar a solicitação.',
      );
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.title}>Buscar motoristas</Text>
      </View>

      <TextInput
        value={search}
        onChangeText={handleSearch}
        placeholder="Buscar por nome"
        placeholderTextColor="#71717A"
        style={styles.input}
      />

      {search.trim().length < 2 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="search-outline" size={44} color="#71717A" />

          <Text style={styles.emptyTitle}>Encontre motoristas</Text>

          <Text style={styles.emptyText}>
            Digite pelo menos 2 letras para buscar pessoas na comunidade.
          </Text>
        </View>
      ) : drivers.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="person-outline" size={44} color="#71717A" />

          <Text style={styles.emptyTitle}>Nenhum motorista encontrado</Text>

          <Text style={styles.emptyText}>
            Tente buscar por outro nome.
          </Text>
        </View>
      ) : (
        drivers.map((item) => (
          <View key={item.id} style={styles.card}>
            <TouchableOpacity
              style={styles.userInfo}
              onPress={() =>
                router.push({
                  pathname: '/(private)/perfil/[userId]',
                  params: { userId: item.id },
                })
              }
            >
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name="person" size={22} color="#FFFFFF" />
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.full_name || item.name || 'Motorista'}
                </Text>

                <Text style={styles.bio} numberOfLines={1}>
                  {item.bio || 'Motorista/entregador'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => handleSendRequest(item.id)}
            >
              <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  content: {
    padding: 18,
    paddingTop: 54,
    paddingBottom: 120,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 22,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },

  input: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 18,
  },

  card: {
    minHeight: 74,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },

  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 999,
  },

  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  name: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  bio: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },

  addButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyBox: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 14,
  },

  emptyText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});