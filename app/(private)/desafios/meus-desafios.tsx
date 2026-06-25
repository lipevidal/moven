import { useCallback, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getMyChallenges } from '../../../src/features/challenges/services/getMyChallenges';

type ChallengeStatus =
  | 'all'
  | 'ongoing'
  | 'waiting_proof'
  | 'under_review'
  | 'completed'
  | 'disqualified';

export default function MyChallengesScreen() {
  const [status, setStatus] =
    useState<ChallengeStatus>('all');

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [challenges, setChallenges] =
    useState<any[]>([]);

  const tabs = [
    {
      label: 'Todos',
      value: 'all',
    },
    {
      label: 'Em andamento',
      value: 'ongoing',
    },
    {
      label: 'Enviar prints',
      value: 'waiting_proof',
    },
    {
      label: 'Em análise',
      value: 'under_review',
    },
    {
      label: 'Concluídos',
      value: 'completed',
    },
    {
      label: 'Reprovados',
      value: 'disqualified',
    },
  ] as const;

  useFocusEffect(
    useCallback(() => {
      loadChallenges();
    }, [status]),
  );

  async function loadChallenges() {
    try {
      setLoading(true);

      const response = await getMyChallenges(
        status === 'all' ? undefined : status,
      );

      setChallenges(response);
    } catch (error) {
      console.log(error);
      setChallenges([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadChallenges();
  }

  function getStatusLabel(value: string) {
    if (value === 'ongoing') return 'Em andamento';
    if (value === 'waiting_proof') return 'Aguardando comprovantes';
    if (value === 'under_review') return 'Em análise';
    if (value === 'completed') return 'Concluído';
    if (value === 'disqualified') return 'Reprovado';

    return 'Inscrito';
  }

  function getStatusColor(value: string) {
    if (value === 'completed') return '#22C55E';
    if (value === 'under_review') return '#F59E0B';
    if (value === 'waiting_proof') return '#3B82F6';
    if (value === 'disqualified') return '#EF4444';

    return '#A1A1AA';
  }

  function getChallengeTypeLabel(value?: string) {
    if (value === 'day') return 'Diário';
    if (value === 'week') return 'Semanal';
    if (value === 'month') return 'Mensal';

    return 'Desafio';
  }

  function getMedalIcon(medal?: string) {
    if (medal === 'gold') return '🥇';
    if (medal === 'silver') return '🥈';
    if (medal === 'bronze') return '🥉';

    return null;
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
            Meus desafios
          </Text>

          <Text style={styles.subtitle}>
            Acompanhe suas inscrições, comprovantes e resultados.
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {tabs.map((item) => {
          const active = status === item.value;

          return (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.tab,
                active && styles.tabActive,
              ]}
              onPress={() => setStatus(item.value)}
            >
              <Text
                style={[
                  styles.tabText,
                  active && styles.tabTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#22C55E" />
        </View>
      ) : challenges.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons
            name="flag-outline"
            size={44}
            color="#71717A"
          />

          <Text style={styles.emptyTitle}>
            Nenhum desafio encontrado
          </Text>

          <Text style={styles.emptyText}>
            Quando você se inscrever em um desafio, ele aparecerá aqui.
          </Text>

          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(private)/desafios')}
          >
            <Text style={styles.emptyButtonText}>
              Ver desafios disponíveis
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        challenges.map((item) => {
          const medalIcon = getMedalIcon(item.medal);

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.challengeCard}
              activeOpacity={0.85}
              onPress={() =>
                router.push({
                  pathname: '/(private)/desafios/[id]',
                  params: {
                    id: item.id,
                  },
                })
              }
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.challengeTitle}>
                    Desafio {getChallengeTypeLabel(item.challenge_type)}
                  </Text>

                  <Text style={styles.challengeSubtitle}>
                    {item.vehicle_type === 'moto' ? 'Moto' : 'Carro'} • {item.region ?? 'Região'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      borderColor: getStatusColor(item.status),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color: getStatusColor(item.status),
                      },
                    ]}
                  >
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              </View>

              {Array.isArray(item.platforms) && item.platforms.length > 0 && (
                <View style={styles.platformsRow}>
                  {item.platforms.slice(0, 4).map((platform: string) => (
                    <View key={platform} style={styles.platformBadge}>
                      <Text style={styles.platformBadgeText}>
                        {platform}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.metricsRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>
                    Valor aprovado
                  </Text>

                  <Text style={styles.metricValue}>
                    R$ {formatCurrency(item.approved_amount)}
                  </Text>
                </View>

                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>
                    Posição
                  </Text>

                  <Text style={styles.metricValue}>
                    {item.position ? `${item.position}º` : '--'}
                  </Text>
                </View>

                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>
                    Medalha
                  </Text>

                  <Text style={styles.metricValue}>
                    {medalIcon ?? '--'}
                  </Text>
                </View>
              </View>

              {item.status === 'waiting_proof' && (
                <TouchableOpacity
                  style={styles.proofButton}
                  onPress={() =>
                    router.push({
                      pathname: '/(private)/desafios/enviar-comprovantes',
                      params: {
                        challengeId: item.id,
                      },
                    })
                  }
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={18}
                    color="#FFFFFF"
                  />

                  <Text style={styles.proofButtonText}>
                    Enviar comprovantes
                  </Text>
                </TouchableOpacity>
              )}

              {item.review_notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>
                    {item.review_notes}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })
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
    fontSize: 24,
    fontWeight: '900',
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
    maxWidth: 280,
  },

  tabsRow: {
    gap: 8,
    paddingRight: 18,
    marginBottom: 18,
  },

  tab: {
    height: 38,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  tabActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  tabText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '900',
  },

  tabTextActive: {
    color: '#FFFFFF',
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

  emptyButton: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 18,
  },

  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  challengeCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 14,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },

  challengeTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  challengeSubtitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  statusBadge: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },

  platformsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },

  platformBadge: {
    minHeight: 28,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  platformBadgeText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '800',
  },

  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },

  metricBox: {
    flex: 1,
    minHeight: 66,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 10,
    justifyContent: 'center',
  },

  metricLabel: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '800',
  },

  metricValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 7,
  },

  proofButton: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  proofButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  notesBox: {
    borderRadius: 14,
    backgroundColor: '#2A1607',
    borderWidth: 1,
    borderColor: '#7C2D12',
    padding: 12,
    marginTop: 14,
  },

  notesText: {
    color: '#FDBA74',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
});
