import { useCallback, useState } from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getChallengeSummary } from '../services/getChallengeSummary';

export function DashboardChallengeCard() {
  const [loading, setLoading] =
    useState(true);

  const [summary, setSummary] =
    useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, []),
  );

  async function loadSummary() {
    try {
      setLoading(true);

      const response =
        await getChallengeSummary();

      setSummary(response);
    } catch (error) {
      console.log(error);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  function getChallengeTypeLabel(value?: string) {
    if (value === 'day') return 'Diário';
    if (value === 'week') return 'Semanal';
    if (value === 'month') return 'Mensal';

    return 'Desafio';
  }

  function getStatusLabel(value?: string) {
    if (value === 'ongoing') return 'Em andamento';
    if (value === 'waiting_proof') return 'Enviar comprovantes';
    if (value === 'under_review') return 'Em análise';
    if (value === 'completed') return 'Concluído';
    if (value === 'disqualified') return 'Reprovado';

    return 'Inscrito';
  }

  function getStatusColor(value?: string) {
    if (value === 'completed') return '#22C55E';
    if (value === 'waiting_proof') return '#3B82F6';
    if (value === 'under_review') return '#F59E0B';
    if (value === 'disqualified') return '#EF4444';

    return '#A1A1AA';
  }

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  if (!summary?.active) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Ionicons
              name="flag-outline"
              size={24}
              color="#22C55E"
            />
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.title}>
              Desafios
            </Text>

            <Text style={styles.subtitle}>
              Participe de rankings e dispute medalhas.
            </Text>
          </View>
        </View>

        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>
            Nenhum desafio ativo
          </Text>

          <Text style={styles.emptyText}>
            Inscreva-se em um desafio diário, semanal ou mensal.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(private)/desafios')}
        >
          <Text style={styles.primaryButtonText}>
            Ver desafios
          </Text>

          <Ionicons
            name="arrow-forward"
            size={18}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
    );
  }

  const active = summary.active;
  const statusColor = getStatusColor(active.status);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() =>
        router.push({
          pathname: '/(private)/desafios/[id]',
          params: {
            id: active.id,
          },
        })
      }
    >
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons
            name="flag"
            size={24}
            color="#22C55E"
          />
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.title}>
            Desafio ativo
          </Text>

          <Text style={styles.subtitle}>
            Acompanhe seu desempenho competitivo.
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={22}
          color="#71717A"
        />
      </View>

      <View style={styles.activeBox}>
        <View>
          <Text style={styles.activeTitle}>
            Desafio {getChallengeTypeLabel(active.challenge_type)}
          </Text>

          <Text style={styles.activeSubtitle}>
            {active.vehicle_type === 'moto' ? 'Moto' : 'Carro'} • {active.region ?? 'Região'}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              borderColor: statusColor,
            },
          ]}
        >
          <Text
            style={[
              styles.statusBadgeText,
              {
                color: statusColor,
              },
            ]}
          >
            {getStatusLabel(active.status)}
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <Metric
          label="Pendentes"
          value={String(summary.waitingProof)}
        />

        <Metric
          label="Em análise"
          value={String(summary.underReview)}
        />

        <Metric
          label="Concluídos"
          value={String(summary.completed)}
        />
      </View>
    </TouchableOpacity>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricLabel}>
        {label}
      </Text>

      <Text style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 14,
    minHeight: 160,
    justifyContent: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: '#052E16',
    borderWidth: 1,
    borderColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  headerInfo: {
    flex: 1,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 4,
  },

  emptyBox: {
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 14,
    marginBottom: 14,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  emptyText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 4,
  },

  primaryButton: {
    height: 46,
    borderRadius: 15,
    backgroundColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  activeBox: {
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },

  activeTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  activeSubtitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  statusBadge: {
    alignSelf: 'flex-start',
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

  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },

  metricBox: {
    flex: 1,
    minHeight: 58,
    borderRadius: 15,
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
    fontSize: 16,
    fontWeight: '900',
    marginTop: 5,
  },
});
