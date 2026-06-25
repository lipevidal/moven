import { useEffect, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { getUserStreak } from '../services/getUserStreak';

type ProfileStreakCardProps = {
  userId: string;
};

export default function ProfileStreakCard({
  userId,
}: ProfileStreakCardProps) {
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<any>(null);

  useEffect(() => {
    loadStreak();
  }, [userId]);

  async function loadStreak() {
    try {
      setLoading(true);

      const response = await getUserStreak(userId);

      setStreak(response);
    } catch {
      setStreak({
        current_streak: 0,
        longest_streak: 0,
      });
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

  const currentStreak = Number(streak?.current_streak ?? 0);
  const longestStreak = Number(streak?.longest_streak ?? 0);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="flame" size={24} color="#F97316" />
        </View>

        <View>
          <Text style={styles.title}>
            Sequência de desafios
          </Text>

          <Text style={styles.subtitle}>
            Continue participando para aumentar sua sequência.
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {currentStreak}
          </Text>

          <Text style={styles.statLabel}>
            Atual
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {longestStreak}
          </Text>

          <Text style={styles.statLabel}>
            Maior sequência
          </Text>
        </View>
      </View>

      <View style={styles.badge}>
        <Ionicons
          name="trophy-outline"
          size={16}
          color="#FACC15"
        />

        <Text style={styles.badgeText}>
          Marcos: 3, 7, 15 e 30 dias geram XP bônus
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 18,
    marginBottom: 16,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },

  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#2A1607',
    borderWidth: 1,
    borderColor: '#7C2D12',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
    maxWidth: 250,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 14,
  },

  statBox: {
    flex: 1,
    alignItems: 'center',
  },

  statValue: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },

  statLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },

  divider: {
    width: 1,
    height: 42,
    backgroundColor: '#27272A',
  },

  badge: {
    marginTop: 14,
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: '#1A1A0B',
    borderWidth: 1,
    borderColor: '#3F3F16',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  badgeText: {
    color: '#FACC15',
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
});
