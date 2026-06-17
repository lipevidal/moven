import { useEffect, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getFriendsTimeline } from '../../src/features/sharedResults/services/getFriendsTimeline';

function formatMoney(value: number) {
  return Number(value ?? 0).toFixed(2).replace('.', ',');
}

export default function TimelineScreen() {
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    loadTimeline();
  }, []);

  async function loadTimeline() {
    const response = await getFriendsTimeline();
    setPosts(response);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.title}>Timeline</Text>
      </View>

      {posts.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={44} color="#71717A" />

          <Text style={styles.emptyTitle}>Nada por aqui ainda</Text>

          <Text style={styles.emptyText}>
            Adicione amigos ou compartilhe seus próprios resultados para aparecerem na timeline.
          </Text>
        </View>
      ) : (
        posts.map((item) => (
          <View key={item.id} style={styles.postCard}>
            <TouchableOpacity
              style={styles.postHeader}
              onPress={() =>
                router.push({
                  pathname: '/(private)/perfil/[userId]',
                  params: { userId: item.user_id },
                })
              }
            >
              {item.user?.avatar_url ? (
                <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name="person" size={20} color="#FFFFFF" />
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.user?.full_name || item.user?.name || 'Motorista'}
                </Text>

                <Text style={styles.date}>
                  {item.period_label}
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.postTitle}>{item.title}</Text>

            <View style={styles.metricsGrid}>
              <Metric label="Faturamento" value={`R$ ${formatMoney(item.revenue)}`} />
              <Metric label="Despesas" value={`R$ ${formatMoney(item.expenses)}`} />
              <Metric label="Lucro" value={`R$ ${formatMoney(item.profit)}`} />
              <Metric label="KM" value={`${Number(item.km_driven ?? 0)} km`} />
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="heart-outline" size={21} color="#FFFFFF" />
                <Text style={styles.actionText}>0</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  router.push({
                    pathname: '/(private)/perfil/comentarios',
                    params: { sharedResultId: item.id },
                  })
                }
              >
                <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
                <Text style={styles.actionText}>0</Text>
              </TouchableOpacity>

              <View style={styles.actionButton}>
                <Ionicons name="eye-outline" size={21} color="#FFFFFF" />
                <Text style={styles.actionText}>0</Text>
              </View>
            </View>
          </View>
        ))
      )}
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
    marginBottom: 24,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },

  emptyBox: {
    minHeight: 300,
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

  postCard: {
    borderRadius: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 14,
  },

  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
  },

  avatarFallback: {
    width: 44,
    height: 44,
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

  date: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },

  postTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
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

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  actionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});