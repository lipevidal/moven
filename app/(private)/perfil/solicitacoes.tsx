import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getFriendRequests } from '../../../src/features/friendships/services/getFriendRequests';
import { respondFriendRequest } from '../../../src/features/friendships/services/respondFriendRequest';

export default function FriendRequestsScreen() {
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setRequests(await getFriendRequests());
  }

  async function handleRespond(
      id: string,
      status: 'accepted' | 'rejected',
    ) {
    await respondFriendRequest(id, status);

    setRequests((prev) =>
      prev.filter((item) => item.id !== id),
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Header title="Solicitações" />

      {requests.length === 0 ? (
        <Text style={styles.emptyText}>Nenhuma solicitação pendente.</Text>
      ) : (
        requests.map((item) => (
          <View key={item.id} style={styles.card}>
            {item.user?.avatar_url ? (
              <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={22} color="#FFFFFF" />
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {item.user?.full_name || item.user?.name || 'Motorista'}
              </Text>

              <Text style={styles.bio} numberOfLines={1}>
                {item.user?.bio || 'Motorista/entregador'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleRespond(item.id, 'accepted')}
            >
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleRespond(item.id, 'rejected')}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Header({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  content: { padding: 18, paddingTop: 54, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  emptyText: { color: '#71717A', fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 30 },
  card: {
    minHeight: 74,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    marginBottom: 10,
  },
  avatar: { width: 48, height: 48, borderRadius: 999 },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  bio: { color: '#A1A1AA', fontSize: 12, fontWeight: '600', marginTop: 3 },
  acceptButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
});