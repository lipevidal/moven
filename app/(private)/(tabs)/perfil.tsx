import { useEffect, useState } from 'react';
import { supabase } from '../../../src/database/supabase'
import { getSharedResults } from '../../../src/features/sharedResults/services/getSharedResults';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { toggleLikeSharedResult } from '../../../src/features/sharedResults/services/toggleLikeSharedResult';
import { markSharedResultView } from '../../../src/features/sharedResults/services/markSharedResultView';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getFriendshipStats } from '../../../src/features/friendships/services/getFriendshipStats';
import { getProfile } from '../../../src/features/profile/services/getProfile';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

export default function SocialProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [requestsCount, setRequestsCount] = useState(0);
  const [feedType, setFeedType] = useState<'session' | 'day' | 'week' | 'month' | 'year'>('session');
  const [feed, setFeed] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, []),
  );

  useEffect(() => {
    loadFeed(feedType);
  }, [feedType]);

  useEffect(() => {
    const channel = supabase
      .channel('friendships-profile')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
        },
        () => {
          loadProfile();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadProfile() {
    const response = await getProfile();

    setProfile(response);
    // Depois vamos ligar nos services reais
    const stats = await getFriendshipStats();
    setFriendsCount(stats.friendsCount);
    setRequestsCount(stats.requestsCount);
  }

  async function loadFeed(type: any) {
    const response = await getSharedResults(type);
    setFeed(response);
  }

  if (!profile) return null;

  const tabs = [
    { label: 'Jornadas', value: 'session' },
    { label: 'Dias', value: 'day' },
    { label: 'Semanas', value: 'week' },
    { label: 'Meses', value: 'month' },
    { label: 'Anos', value: 'year' },
  ] as const;

  function Metric({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.feedMetricCard}>
        <Text style={styles.feedMetricLabel}>{label}</Text>
        <Text style={styles.feedMetricValue}>{value}</Text>
      </View>
    );
  }

  async function handleLike(itemId: string) {
    await toggleLikeSharedResult(itemId);
    await loadFeed(feedType);
  }

  async function handleOpenComments(item: any) {
    await markSharedResultView(item.id);

    router.push({
      pathname: '/(private)/perfil/comentarios',
      params: {
        sharedResultId: item.id,
      },
    });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Perfil</Text>

        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => router.push('/(private)/perfil/configuracoes')}
        >
          <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
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
          <TouchableOpacity 
            style={styles.statItem} 
            onPress={() => router.push('/(private)/perfil/amigos')}
          >
            <Text style={styles.statNumber}>{friendsCount}</Text>
            <Text style={styles.statLabel}>Amigos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statItem}
            onPress={() => router.push('/(private)/perfil/solicitacoes')}
          >
            <Text style={styles.statNumber}>{requestsCount}</Text>
            <Text style={styles.statLabel}>Solicitações</Text>
          </TouchableOpacity>

          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
        </View>
      </View>

      <Text style={styles.name}>
        {profile.full_name || profile.name || 'Motorista'}
      </Text>

      <Text style={styles.bio}>
        {profile.bio || 'Adicione uma descrição ao seu perfil.'}
      </Text>

      <View style={styles.profileActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push('/(private)/perfil/minha-conta')}
        >
          <Text style={styles.editButtonText}>Editar perfil</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addFriendButton}
          onPress={() => router.push('/(private)/buscar-motoristas')}
        >
          <Ionicons name="people-outline" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.shareCard}>
        <Text style={styles.shareTitle}>Compartilhar resultado</Text>

        <View style={styles.shareGrid}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.value}
              style={styles.shareButton}
              onPress={() =>
                router.push({
                  pathname: '/(private)/perfil/compartilhar',
                  params: { type: tab.value },
                })
              }
            >
              <Ionicons name="share-social-outline" size={18} color="#22C55E" />
              <Text style={styles.shareButtonText}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.feedTabs}>
        {tabs.map((tab) => {
          const active = feedType === tab.value;

          return (
            <TouchableOpacity
              key={tab.value}
              style={[
                styles.feedTab,
                active && styles.feedTabActive,
              ]}
              onPress={() => setFeedType(tab.value)}
            >
              <Text
                style={[
                  styles.feedTabText,
                  active && styles.feedTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {feed.length === 0 ? (
        <View style={styles.emptyFeed}>
          <Ionicons name="bar-chart-outline" size={42} color="#71717A" />

          <Text style={styles.emptyFeedTitle}>
            Nenhum resultado compartilhado
          </Text>

          <Text style={styles.emptyFeedText}>
            Compartilhe suas jornadas, dias, semanas, meses ou anos para aparecerem aqui.
          </Text>
        </View>
      ) : (
        feed.map((item) => (
          <View key={item.id} style={styles.feedCard}>
            <View style={styles.feedHeader}>
              {item.user?.avatar_url ? (
                <Image source={{ uri: item.user.avatar_url }} style={styles.feedAvatar} />
              ) : (
                <View style={styles.feedAvatarFallback}>
                  <Ionicons name="person" size={20} color="#FFFFFF" />
                </View>
              )}

              <View>
                <Text style={styles.feedName}>
                  {item.user?.full_name || item.user?.name || 'Motorista'}
                </Text>
                <Text style={styles.feedDate}>{item.period_label}</Text>
              </View>
            </View>

            <Text style={styles.feedTitle}>{item.title}</Text>

            <View style={styles.metricsGrid}>
              <Metric label="Faturamento" value={`R$ ${Number(item.revenue).toFixed(2).replace('.', ',')}`} />
              <Metric label="Despesas" value={`R$ ${Number(item.expenses).toFixed(2).replace('.', ',')}`} />
              <Metric label="Lucro" value={`R$ ${Number(item.profit).toFixed(2).replace('.', ',')}`} />
              <Metric label="KM" value={`${Number(item.km_driven ?? 0)} km`} />
            </View>

            <View style={styles.feedActions}>
              <TouchableOpacity
                style={styles.feedActionButton}
                onPress={() => handleLike(item.id)}
              >
                <Ionicons
                  name={item.liked_by_me ? 'heart' : 'heart-outline'}
                  size={21}
                  color={item.liked_by_me ? '#EF4444' : '#FFFFFF'}
                />

                <Text style={styles.feedActionText}>
                  {item.likes_count}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.feedActionButton}
                onPress={() => handleOpenComments(item)}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />

                <Text style={styles.feedActionText}>
                  {item.comments_count}
                </Text>
              </TouchableOpacity>

              <View style={styles.feedActionButton}>
                <Ionicons name="eye-outline" size={21} color="#FFFFFF" />

                <Text style={styles.feedActionText}>
                  {item.views_count}
                </Text>
              </View>
            </View>
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
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 130,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },

  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

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
    justifyContent: 'space-between',
  },

  statItem: {
    alignItems: 'center',
  },

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

  profileActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    marginBottom: 22,
  },

  editButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  addFriendButton: {
    width: 48,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  shareCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
  },

  shareTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 14,
  },

  shareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  shareButton: {
    width: '48%',
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
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

  feedTabTextActive: {
    color: '#FFFFFF',
  },

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

  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },

  feedAvatar: {
    width: 42,
    height: 42,
    borderRadius: 999,
  },

  feedAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  feedName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  feedDate: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },

  feedTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },

  feedMetricCard: {
    width: '48%',
    minHeight: 70,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 12,
  },

  feedMetricLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '800',
  },

  feedMetricValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  feedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
  },

  feedActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  feedActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});