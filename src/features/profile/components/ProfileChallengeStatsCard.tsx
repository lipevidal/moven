import { useEffect, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { getProfileChallengeStats } from '../services/getProfileChallengeStats';

type Props = {
  userId: string;
};

type Stats = {
  participations: number;
  completed: number;
  podiums: number;
  best_position: number | null;
  total_approved_amount: number;
  biggest_earning: number;
};

export default function ProfileChallengeStatsCard({ userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    participations: 0,
    completed: 0,
    podiums: 0,
    best_position: null,
    total_approved_amount: 0,
    biggest_earning: 0,
  });

  useEffect(() => {
    loadStats();
  }, [userId]);

  async function loadStats() {
    try {
      setLoading(true);

      const response = await getProfileChallengeStats(userId);

      setStats(response);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(value: number) {
    return Number(value ?? 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Estatísticas em desafios</Text>
          <Text style={styles.subtitle}>Resumo competitivo do motorista</Text>
        </View>

        <View style={styles.iconBox}>
          <Ionicons name="stats-chart-outline" size={22} color="#22C55E" />
        </View>
      </View>

      <View style={styles.grid}>
        <StatItem
          label="Participações"
          value={String(stats.participations)}
          icon="flag-outline"
        />

        <StatItem
          label="Concluídos"
          value={String(stats.completed)}
          icon="checkmark-circle-outline"
        />

        <StatItem
          label="Pódios"
          value={String(stats.podiums)}
          icon="podium-outline"
        />

        <StatItem
          label="Melhor posição"
          value={stats.best_position ? `${stats.best_position}º` : '-'}
          icon="trophy-outline"
        />

        <StatItem
          label="Maior faturamento"
          value={formatCurrency(stats.biggest_earning)}
          icon="trending-up-outline"
        />

        <StatItem
          label="Total aprovado"
          value={formatCurrency(stats.total_approved_amount)}
          icon="cash-outline"
        />
      </View>
    </View>
  );
}

function StatItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={20} color="#22C55E" />

      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>

      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 16,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
    marginTop: 3,
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },

  statItem: {
    width: '48%',
    minHeight: 92,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 12,
    justifyContent: 'center',
  },

  statValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 8,
  },

  statLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    lineHeight: 15,
  },
});
