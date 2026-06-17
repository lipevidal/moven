import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/database/supabase';
import { getFriends } from '../../../src/features/friendships/services/getFriends';
import { searchUsers } from '../../../src/features/friendships/services/searchUsers';
import { sendFriendRequest } from '../../../src/features/friendships/services/sendFriendRequest';

export default function FriendsScreen() {
  const [friends, setFriends] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
        loadFriends();
    }, []),
  );

  useEffect(() => {
    const channel = supabase
        .channel('friendships-friends-list')
        .on(
        'postgres_changes',
        {
            event: '*',
            schema: 'public',
            table: 'friendships',
        },
        async () => {
            await loadFriends();
        },
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
    }, []);

  async function loadFriends() {
    setFriends(await getFriends());
  }

  async function handleSearch(text: string) {
    setSearch(text);

    if (text.trim().length < 2) {
      setResults([]);
      return;
    }

    setResults(await searchUsers(text));
  }

  async function handleSendRequest(userId: string) {
    try {
      await sendFriendRequest(userId);
      Alert.alert('Solicitação enviada', 'Agora é só aguardar a pessoa aceitar.');
      setResults((prev) => prev.filter((item) => item.id !== userId));
    } catch (error: any) {
      Alert.alert('Erro', error.message ?? 'Não foi possível enviar a solicitação.');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Header title="Amigos" />

      <TextInput
        value={search}
        onChangeText={handleSearch}
        placeholder="Buscar motoristas"
        placeholderTextColor="#71717A"
        style={styles.input}
      />

      {search.trim().length >= 2 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resultados</Text>

          {results.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum motorista encontrado.</Text>
          ) : (
            results.map((item) => (
              <UserCard
                key={item.id}
                user={item}
                buttonLabel="Adicionar"
                buttonIcon="person-add-outline"
                onPress={() => handleSendRequest(item.id)}
              />
            ))
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Meus amigos</Text>

        {friends.length === 0 ? (
          <Text style={styles.emptyText}>Você ainda não tem amigos adicionados.</Text>
        ) : (
          friends.map((item) => (
            <UserCard
              key={item.id}
              user={item}
              buttonLabel="Mensagem"
              buttonIcon="chatbubble-ellipses-outline"
              onPress={() =>
                router.push({
                  pathname: '/(private)/chat-privado',
                  params: { userId: item.id },
                })
              }
            />
          ))
        )}
      </View>
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

function UserCard({
  user,
  buttonLabel,
  buttonIcon,
  onPress,
}: {
  user: any;
  buttonLabel: string;
  buttonIcon: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() =>
            router.push({
            pathname: '/(private)/perfil/[userId]',
            params: {
                userId: user.id,
            },
            })
        }
        >
        {user.avatar_url ? (
            <Image
            source={{ uri: user.avatar_url }}
            style={styles.avatar}
            />
        ) : (
            <View style={styles.avatarFallback}>
            <Ionicons
                name="person"
                size={22}
                color="#FFFFFF"
            />
            </View>
        )}

        <View style={{ flex: 1 }}>
            <Text style={styles.name}>
            {user.full_name || user.name || 'Motorista'}
            </Text>

            <Text style={styles.bio} numberOfLines={1}>
            {user.bio || 'Motorista/entregador'}
            </Text>
        </View>

        <TouchableOpacity
            style={styles.actionButton}
            onPress={onPress}
        >
            <Ionicons
            name={buttonIcon}
            size={17}
            color="#FFFFFF"
            />

            <Text style={styles.actionButtonText}>
            {buttonLabel}
            </Text>
        </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  content: { padding: 18, paddingTop: 54, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
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
    marginBottom: 20,
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },
  emptyText: {
    color: '#71717A',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 18,
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
  actionButton: {
    minHeight: 38,
    borderRadius: 13,
    backgroundColor: '#22C55E',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
});