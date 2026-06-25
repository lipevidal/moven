import { useCallback, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { getUserLevel, UserLevelInfo } from '../services/getUserLevel';

type ProfileLevelCardProps = {
  userId?: string;
};

export function ProfileLevelCard({ userId }: ProfileLevelCardProps) {
  const [loading, setLoading] = useState(true);
  const [levelInfo, setLevelInfo] = useState<UserLevelInfo | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadLevel();
    }, [userId]),
  );

  async function loadLevel() {
    try {
      setLoading(true);
      const response = await getUserLevel(userId);
      setLevelInfo(response);
    } catch (error) {
      console.log(error);
      setLevelInfo(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  const info = levelInfo ?? {
    level: 1,
    xp: 0,
    total_xp: 0,
    xp_required: 100,
    xp_to_next_level: 100,
    progress_percent: 0,
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons
            name="sparkles-outline"
            size={26}
            color="#FACC15"
          />
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.title}>
            Nível atual
          </Text>

          <Text style={styles.subtitle}>
            A cada 100 XP você sobe um nível.
          </Text>
        </View>

        <View style={styles.levelBadge}>
          <Text style={styles.levelBadgeText}>
            Nv. {info.level}
          </Text>
        </View>
      </View>

      <View style={styles.levelRow}>
        <View>
          <Text style={styles.levelLabel}>
            Progresso do nível
          </Text>

          <Text style={styles.levelValue}>
            {info.xp}/{info.xp_required} XP
          </Text>
        </View>

        <Text style={styles.percentText}>
          {Math.round(info.progress_percent)}%
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${info.progress_percent}%` as `${number}%`,
            },
          ]}
        />
      </View>

      <View style={styles.metricsRow}>
        <Metric
          icon="flash-outline"
          label="XP atual"
          value={`${info.xp}`}
        />

        <Metric
          icon="trophy-outline"
          label="XP total"
          value={`${info.total_xp}`}
        />

        <Metric
          icon="arrow-up-circle-outline"
          label="Faltam"
          value={`${info.xp_to_next_level}`}
        />
      </View>
    </View>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Ionicons
        name={icon}
        size={18}
        color="#22C55E"
      />

      <Text style={styles.metricValue}>
        {value}
      </Text>

      <Text style={styles.metricLabel}>
        {label}
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
    minHeight: 190,
    justifyContent: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#2A2408',
    borderWidth: 1,
    borderColor: '#713F12',
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
    lineHeight: 17,
    marginTop: 4,
  },

  levelBadge: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: '#052E16',
    borderWidth: 1,
    borderColor: '#166534',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  levelBadgeText: {
    color: '#BBF7D0',
    fontSize: 12,
    fontWeight: '900',
  },

  levelRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  levelLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '800',
  },

  levelValue: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 4,
  },

  percentText: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '900',
  },

  progressTrack: {
    height: 11,
    borderRadius: 999,
    backgroundColor: '#18181B',
    overflow: 'hidden',
    marginBottom: 14,
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },

  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },

  metricCard: {
    flex: 1,
    minHeight: 68,
    borderRadius: 17,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },

  metricValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 5,
  },

  metricLabel: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
    textAlign: 'center',
  },
});
