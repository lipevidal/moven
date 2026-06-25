import { useEffect, useMemo, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { getUserMedals } from '../services/getUserMedals';
import { getUserTrophies } from '../services/getUserTrophies';

type Props = {
  userId: string;
};

export default function ProfileAchievementsCard({ userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [medals, setMedals] = useState<any[]>([]);
  const [trophies, setTrophies] = useState<any[]>([]);

  useEffect(() => {
    loadAchievements();
  }, [userId]);

  async function loadAchievements() {
    try {
      setLoading(true);

      const [medalsResponse, trophiesResponse] = await Promise.all([
        getUserMedals(userId),
        getUserTrophies(userId),
      ]);

      setMedals(medalsResponse);
      setTrophies(trophiesResponse);
    } catch (error) {
      console.log(error);
      setMedals([]);
      setTrophies([]);
    } finally {
      setLoading(false);
    }
  }

  const medalStats = useMemo(() => {
    return {
      gold: medals.filter((item) => item.medal_type === 'gold').length,
      silver: medals.filter((item) => item.medal_type === 'silver').length,
      bronze: medals.filter((item) => item.medal_type === 'bronze').length,
    };
  }, [medals]);

  const trophyStats = useMemo(() => {
    return {
      gold: trophies.filter((item) => item.trophy_type === 'gold').length,
      silver: trophies.filter((item) => item.trophy_type === 'silver').length,
      bronze: trophies.filter((item) => item.trophy_type === 'bronze').length,
    };
  }, [trophies]);

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
          <Text style={styles.title}>Conquistas</Text>
          <Text style={styles.subtitle}>Medalhas e recordes do motorista</Text>
        </View>

        <View style={styles.iconBox}>
          <Ionicons name="trophy-outline" size={22} color="#22C55E" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Medalhas</Text>

        <View style={styles.grid}>
          <AchievementItem icon="🥇" label="Ouro" value={medalStats.gold} />
          <AchievementItem icon="🥈" label="Prata" value={medalStats.silver} />
          <AchievementItem icon="🥉" label="Bronze" value={medalStats.bronze} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recordistas</Text>

        <View style={styles.grid}>
          <AchievementItem icon="🏆" label="Ouro" value={trophyStats.gold} />
          <AchievementItem icon="🥈" label="Prata" value={trophyStats.silver} />
          <AchievementItem icon="🥉" label="Bronze" value={trophyStats.bronze} />
        </View>
      </View>
    </View>
  );
}

function AchievementItem({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.achievementItem}>
      <Text style={styles.achievementIcon}>{icon}</Text>
      <Text style={styles.achievementValue}>{value}</Text>
      <Text style={styles.achievementLabel}>{label}</Text>
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

  section: {
    marginTop: 10,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },

  grid: {
    flexDirection: 'row',
    gap: 10,
  },

  achievementItem: {
    flex: 1,
    minHeight: 88,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },

  achievementIcon: {
    fontSize: 22,
    marginBottom: 6,
  },

  achievementValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  achievementLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
});
