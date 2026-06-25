import { useCallback, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getPendingChallenges } from '../../../../src/features/admin/services/getPendingChallenges';

export default function AdminProofsScreen() {
  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [items, setItems] =
    useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, []),
  );

  async function loadItems() {
    try {
      setLoading(true);

      const response = await getPendingChallenges();

      setItems(response);
    } catch (error) {
      console.log(error);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadItems();
  }

  function getChallengeTypeLabel(value?: string) {
    if (value === 'day') return 'Diário';
    if (value === 'week') return 'Semanal';
    if (value === 'month') return 'Mensal';

    return 'Desafio';
  }

  function formatCurrency(value: number) {
    return Number(value ?? 0)
      .toFixed(2)
      .replace('.', ',');
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#22C55E"
        />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <View>
          <Text style={styles.title}>
            Análise de comprovantes
          </Text>

          <Text style={styles.subtitle}>
            Aprove, corrija ou reprove resultados enviados.
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#22C55E" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons
            name="checkmark-done-outline"
            size={44}
            color="#71717A"
          />

          <Text style={styles.emptyTitle}>
            Nenhum comprovante pendente
          </Text>

          <Text style={styles.emptyText}>
            Quando usuários enviarem comprovantes, eles aparecerão aqui.
          </Text>
        </View>
      ) : (
        items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: '/(private)/admin/proofs/[id]',
                params: {
                  id: item.id,
                },
              })
            }
          >
            <View style={styles.cardTop}>
              {item.user?.avatar_url ? (
                <Image
                  source={{ uri: item.user.avatar_url }}
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

              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {item.user?.full_name ||
                    item.user?.name ||
                    'Motorista'}
                </Text>

                <Text style={styles.userMeta}>
                  {getChallengeTypeLabel(item.challenge_type)} • {item.vehicle_type === 'moto' ? 'Moto' : 'Carro'}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={22}
                color="#71717A"
              />
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>
                  Região
                </Text>

                <Text style={styles.infoValue}>
                  {item.region ?? '--'}
                </Text>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>
                  Informado
                </Text>

                <Text style={styles.infoValueGreen}>
                  R$ {formatCurrency(
                    item.submitted_amount ??
                      item.reported_amount ??
                      0,
                  )}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
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
    paddingBottom: 130,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 22,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
    maxWidth: 280,
  },

  loadingBox: {
    minHeight: 220,
    borderRadius: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyBox: {
    minHeight: 260,
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 12,
  },

  emptyText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },

  card: {
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 14,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 999,
    marginRight: 12,
  },

  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  userInfo: {
    flex: 1,
  },

  userName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  userMeta: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  infoRow: {
    flexDirection: 'row',
    gap: 10,
  },

  infoBox: {
    flex: 1,
    minHeight: 62,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 10,
    justifyContent: 'center',
  },

  infoLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '800',
  },

  infoValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 6,
  },

  infoValueGreen: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 6,
  },
});
