import { useEffect, useState } from 'react';

import { Text, StyleSheet } from 'react-native';

import { getPublicProfileHeaderStats } from '../services/getPublicProfileHeaderStats';

type PublicProfileNameLineProps = {
  userId: string;
  name: string;
};

export function PublicProfileNameLine({
  userId,
  name,
}: PublicProfileNameLineProps) {
  const [stats, setStats] = useState<{
    nationalPosition: number | null;
    bestRewardIcon: string | null;
    bestRewardCount: number;
  } | null>(null);

  useEffect(() => {
    loadStats();
  }, [userId]);

  async function loadStats() {
    try {
      const response = await getPublicProfileHeaderStats(userId);
      setStats(response);
    } catch (error) {
      console.log(error);
      setStats(null);
    }
  }

  return (
    <Text style={styles.name} numberOfLines={2}>
      {name}
      {stats?.nationalPosition ? (
        <Text style={styles.rank}> {`(#${stats.nationalPosition})`}</Text>
      ) : null}
      {stats?.bestRewardIcon && stats.bestRewardCount > 0 ? (
        <Text style={styles.reward}> {`${stats.bestRewardCount}x${stats.bestRewardIcon}`}</Text>
      ) : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  name: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
  },

  rank: {
    color: '#A7F3D0',
    fontSize: 17,
    fontWeight: '900',
  },

  reward: {
    color: '#FACC15',
    fontSize: 17,
    fontWeight: '900',
  },
});
