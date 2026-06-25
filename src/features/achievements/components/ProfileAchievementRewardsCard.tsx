import { useCallback, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { getUserAchievementRewards } from '../services/getUserAchievementRewards';

type ProfileAchievementRewardsCardProps = {
  userId?: string;
};

export function ProfileAchievementRewardsCard({
  userId,
}: ProfileAchievementRewardsCardProps) {
  const [loading, setLoading] = useState(true);
  const [achievements, setAchievements] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadAchievements();
    }, [userId]),
  );

  async function loadAchievements() {
    try {
      setLoading(true);
      const response = await getUserAchievementRewards(userId);
      setAchievements(response);
    } catch (error) {
      console.log(error);
      setAchievements([]);
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

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons
            name="ribbon-outline"
            size={25}
            color="#FACC15"
          />
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.title}>
            Conquistas
          </Text>

          <Text style={styles.subtitle}>
            Medalhas, troféus e diamantes conquistados.
          </Text>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>
            {achievements.length}
          </Text>
        </View>
      </View>

      {achievements.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>
            Nenhuma conquista ainda
          </Text>

          <Text style={styles.emptyText}>
            Ao cumprir desafios, as conquistas aparecerão aqui.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {achievements.map((item) => (
            <View key={item.id} style={styles.achievementCard}>
              <Text style={styles.achievementIcon}>
                {item.achievement_definitions?.icon ?? getRewardIcon(item.reward_kind)}
              </Text>

              <Text style={styles.achievementTitle} numberOfLines={2}>
                {item.achievement_definitions?.title ?? item.reward_label}
              </Text>

              <Text style={styles.achievementReward}>
                {item.reward_label}
              </Text>

              <View style={styles.xpBadge}>
                <Ionicons
                  name="flash"
                  size={12}
                  color="#FACC15"
                />

                <Text style={styles.xpBadgeText}>
                  {item.reward_xp} XP
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function getRewardIcon(kind?: string) {
  if (kind === 'medal_silver') return '🥈';
  if (kind === 'medal_gold') return '🥇';
  if (kind === 'trophy') return '🏆';
  if (kind === 'diamond') return '💎';
  return '🏅';
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 14,
    minHeight: 180,
    justifyContent: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
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
    marginTop: 4,
  },

  countBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#052E16',
    borderWidth: 1,
    borderColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  countBadgeText: {
    color: '#BBF7D0',
    fontSize: 13,
    fontWeight: '900',
  },

  emptyBox: {
    minHeight: 100,
    borderRadius: 20,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  emptyText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },

  list: {
    gap: 10,
    paddingRight: 8,
  },

  achievementCard: {
    width: 140,
    minHeight: 150,
    borderRadius: 20,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 12,
    alignItems: 'center',
  },

  achievementIcon: {
    fontSize: 34,
    marginBottom: 8,
  },

  achievementTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    minHeight: 32,
  },

  achievementReward: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center',
  },

  xpBadge: {
    minHeight: 26,
    borderRadius: 999,
    backgroundColor: '#2A2408',
    borderWidth: 1,
    borderColor: '#713F12',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    marginTop: 8,
  },

  xpBadgeText: {
    color: '#FACC15',
    fontSize: 10,
    fontWeight: '900',
  },
});
