import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Alert } from 'react-native';
import { supabase } from '../../../src/database/supabase';
import { getSharedResults } from '../../../src/features/sharedResults/services/getSharedResults';
import { removeFriend } from '../../../src/features/friendships/services/removeFriend';
import { blockUser } from '../../../src/features/friendships/services/blockUser';
import { reportUser } from '../../../src/features/friendships/services/reportUser';
import { getFriendshipStatus } from '../../../src/features/friendships/services/getFriendshipStatus';
import { sendFriendRequest } from '../../../src/features/friendships/services/sendFriendRequest';
import { respondFriendRequest } from '../../../src/features/friendships/services/respondFriendRequest';
import { cancelFriendRequest } from '../../../src/features/friendships/services/cancelFriendRequest';

export default function FriendProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [menuVisible, setMenuVisible] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [feedType, setFeedType] = useState<'session' | 'day' | 'week' | 'month' | 'year'>('session');
  const [friendshipStatus, setFriendshipStatus] = useState<any>('none');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
    loadRelationship();
  }, [userId]);

  useEffect(() => {
    loadFeed();
  }, [userId, feedType]);

  async function loadProfile() {
    if (!userId) return;

    const { data } = await supabase
      .from('profiles')
      .select('id, name, full_name, avatar_url, bio')
      .eq('id', userId)
      .single();

    setProfile(data);
  }

  async function handleRelationshipAction() {
    if (!profile?.id) return;

    if (friendshipStatus === 'friends') {
        router.push({
            pathname: '/(private)/chat-privado',
            params: {
            userId: profile.id,
        },
    });

  return;
}

    if (friendshipStatus === 'none') {
        await sendFriendRequest(profile.id);
        Alert.alert('Solicitação enviada', 'Agora é só aguardar a pessoa aceitar.');
        await loadRelationship();
        return;
    }

    if (friendshipStatus === 'request_sent') {
        Alert.alert(
            'Cancelar solicitação',
            'Deseja cancelar esta solicitação de amizade?',
            [
            {
                text: 'Não',
                style: 'cancel',
            },
            {
                text: 'Cancelar solicitação',
                style: 'destructive',
                onPress: async () => {
                if (!friendshipId) return;

                await cancelFriendRequest(friendshipId);

                await loadRelationship();

                Alert.alert(
                    'Pronto',
                    'Solicitação cancelada.',
                );
                },
            },
        ],
    );

    return;
    }

    if (friendshipStatus === 'request_received') {
        Alert.alert(
        'Solicitação recebida',
        'Deseja aceitar essa solicitação de amizade?',
        [
            { text: 'Cancelar', style: 'cancel' },
            {
            text: 'Aceitar',
            onPress: async () => {
                if (!friendshipId) return;

                await respondFriendRequest(friendshipId, 'accepted');
                await loadRelationship();
            },
            },
            {
            text: 'Recusar',
            style: 'destructive',
            onPress: async () => {
                if (!friendshipId) return;

                await respondFriendRequest(friendshipId, 'rejected');
                await loadRelationship();
            },
            },
        ],
        );
    }
  }

  async function loadFeed() {
    if (!userId) return;

    const response = await getSharedResults(feedType);
    setFeed(response.filter((item: any) => item.user_id === userId));
  }

  if (!profile) return null;

  const tabs = [
    { label: 'Jornadas', value: 'session' },
    { label: 'Dias', value: 'day' },
    { label: 'Semanas', value: 'week' },
    { label: 'Meses', value: 'month' },
    { label: 'Anos', value: 'year' },
  ] as const;

function getRelationshipButtonLabel() {
  if (friendshipStatus === 'friends') return 'Mensagem';
  if (friendshipStatus === 'none') return 'Solicitar amizade';
  if (friendshipStatus === 'request_sent') return 'Cancelar solicitação';
  if (friendshipStatus === 'request_received') return 'Responder solicitação';
  if (friendshipStatus === 'blocked') return 'Usuário bloqueado';

  return 'Solicitar amizade';
}

async function loadRelationship() {
  if (!userId) return;

  const response = await getFriendshipStatus(userId);

  setFriendshipStatus(response.status);
  setFriendshipId(response.friendshipId);
}

function handleRemoveFriend() {
  Alert.alert(
    'Remover amizade',
    'Deseja remover esta pessoa da sua lista de amigos?',
    [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFriend(profile.id);

            setMenuVisible(false);

            Alert.alert(
              'Amizade removida',
              'Este usuário foi removido da sua lista de amigos.'
            );

            router.back();
          } catch (error: any) {
            Alert.alert(
              'Erro',
              error.message ?? 'Não foi possível remover a amizade.'
            );
          }
        },
      },
    ],
  );
}

function handleBlockUser() {
  Alert.alert(
    'Bloquear usuário',
    'Essa pessoa não poderá mais interagir com você. Deseja continuar?',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Bloquear',
        style: 'destructive',
        onPress: async () => {
          await blockUser(profile.id);
          setMenuVisible(false);
          Alert.alert('Usuário bloqueado', 'Essa pessoa foi bloqueada.');
          router.back();
        },
      },
    ],
  );
}

function handleReportUser() {
  Alert.alert(
    'Denunciar usuário',
    'Deseja denunciar este perfil por comportamento inadequado?',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Denunciar',
        style: 'destructive',
        onPress: async () => {
          await reportUser(profile.id, 'Comportamento inadequado');
          setMenuVisible(false);
          Alert.alert(
            'Denúncia enviada',
            'Obrigado por ajudar a manter a comunidade segura.',
          );
        },
      },
    ],
  );
}


  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.title}>Perfil</Text>

        {friendshipStatus === 'friends' && (
            <TouchableOpacity
                style={styles.headerSideButton}
                onPress={() => setMenuVisible(true)}
            >
                <Ionicons
                name="ellipsis-horizontal"
                size={24}
                color="#FFFFFF"
                />
            </TouchableOpacity>
            )}
      </View>

      <View style={styles.profileTop}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Ionicons name="person" size={42} color="#FFFFFF" />
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Amigos</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{feed.length}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
        </View>
      </View>

      <Text style={styles.name}>
        {profile.full_name || profile.name || 'Motorista'}
      </Text>

      <Text style={styles.bio}>
        {profile.bio || 'Motorista/entregador'}
      </Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity
            style={[
                styles.messageButton,
                friendshipStatus === 'request_sent' && { backgroundColor: '#27272A' },
                friendshipStatus === 'blocked' && { backgroundColor: '#3F1D1D' },
            ]}
            disabled={friendshipStatus === 'blocked'}
            onPress={handleRelationshipAction}
        >
            <Ionicons
                name={
                friendshipStatus === 'friends'
                    ? 'chatbubble-ellipses-outline'
                    : friendshipStatus === 'request_received'
                    ? 'person-add-outline'
                    : friendshipStatus === 'request_sent'
                        ? 'close-circle-outline'
                        : 'person-add-outline'
                }
                size={18}
                color="#FFFFFF"
            />

            <Text style={styles.messageButtonText}>
                {getRelationshipButtonLabel()}
            </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.feedTabs}>
        {tabs.map((tab) => {
          const active = feedType === tab.value;

          return (
            <TouchableOpacity
              key={tab.value}
              style={[styles.feedTab, active && styles.feedTabActive]}
              onPress={() => setFeedType(tab.value)}
            >
              <Text style={[styles.feedTabText, active && styles.feedTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {friendshipStatus !== 'friends' && friendshipStatus !== 'self' ? (
        <View style={styles.lockedProfileBox}>
            <Ionicons name="lock-closed-outline" size={42} color="#71717A" />

            <Text style={styles.lockedProfileTitle}>
            Perfil privado
            </Text>

            <Text style={styles.lockedProfileText}>
            Envie uma solicitação de amizade para ver este perfil.
            </Text>
        </View>
        ) : feed.length === 0 ? (
        <View style={styles.emptyFeed}>
          <Ionicons name="bar-chart-outline" size={42} color="#71717A" />

          <Text style={styles.emptyFeedTitle}>Nenhum resultado compartilhado</Text>
          <Text style={styles.emptyFeedText}>
            Esse motorista ainda não compartilhou resultados desse tipo.
          </Text>
        </View>
      ) : (
        feed.map((item) => (
          <View key={item.id} style={styles.feedCard}>
            <Text style={styles.feedTitle}>{item.title}</Text>
            <Text style={styles.feedDate}>{item.period_label}</Text>

            <View style={styles.metricsGrid}>
              <Metric label="Faturamento" value={`R$ ${Number(item.revenue).toFixed(2).replace('.', ',')}`} />
              <Metric label="Despesas" value={`R$ ${Number(item.expenses).toFixed(2).replace('.', ',')}`} />
              <Metric label="Lucro" value={`R$ ${Number(item.profit).toFixed(2).replace('.', ',')}`} />
              <Metric label="KM" value={`${Number(item.km_driven ?? 0)} km`} />
            </View>
          </View>
        ))
      )}

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
        >
        <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
        >
            <View style={styles.menuContent}>
                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                    setMenuVisible(false);

                    router.push({
                        pathname: '/(private)/perfil/[userId]',
                        params: { userId: profile.id },
                    })
                    }}
                >
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.menuItemText}>Enviar mensagem</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleRemoveFriend}>
                    <Ionicons name="person-remove-outline" size={20} color="#F59E0B" />
                    <Text style={styles.menuItemText}>Remover amizade</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleBlockUser}>
                    <Ionicons name="ban-outline" size={20} color="#EF4444" />
                    <Text style={styles.menuDangerText}>Bloquear</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleReportUser}>
                    <Ionicons name="flag-outline" size={20} color="#EF4444" />
                    <Text style={styles.menuDangerText}>Denunciar usuário</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
        </Modal>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  content: { padding: 18, paddingTop: 54, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },

  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  avatar: {
    width: 92,
    height: 92,
    borderRadius: 999,
    marginRight: 18,
  },

  avatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },

  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },

  statItem: { alignItems: 'center' },

  statNumber: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  statLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  name: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  bio: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 20,
  },

  actionsRow: {
    flexDirection: 'row',
    marginTop: 18,
    marginBottom: 22,
  },

  messageButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  messageButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  feedTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },

  feedTab: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  feedTabActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  feedTabText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '900',
  },

  feedTabTextActive: { color: '#FFFFFF' },

  emptyFeed: {
    minHeight: 220,
    borderRadius: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },

  emptyFeedTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 12,
  },

  emptyFeedText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },

  feedCard: {
    borderRadius: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 14,
  },

  feedTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  feedDate: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 12,
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  metricCard: {
    width: '48%',
    minHeight: 70,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 12,
    marginBottom: 10,
  },

  metricLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '800',
  },

  metricValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 8,
  },

    headerSideButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    },

    menuButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    },

    menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    },

    menuContent: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 18,
    paddingBottom: 34,
    },

    menuItem: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    },

    menuItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    },

    menuDangerText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '900',
    },
    lockedProfileBox: {
  minHeight: 240,
  borderRadius: 22,
  backgroundColor: '#111827',
  borderWidth: 1,
  borderColor: '#1F2937',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
},

lockedProfileTitle: {
  color: '#FFFFFF',
  fontSize: 17,
  fontWeight: '900',
  marginTop: 14,
},

lockedProfileText: {
  color: '#A1A1AA',
  fontSize: 13,
  fontWeight: '600',
  textAlign: 'center',
  marginTop: 8,
  lineHeight: 20,
},
});