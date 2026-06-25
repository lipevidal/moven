import { useEffect, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { getUserBadges } from '../services/getUserBadges';

type ProfileBadgesCardProps = {
  userId: string;
};

export default function ProfileBadgesCard({
  userId,
}: ProfileBadgesCardProps) {
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState<any[]>([]);

  useEffect(() => {
    loadBadges();
  }, [userId]);

  async function loadBadges() {
    try {
      setLoading(true);

      const response = await getUserBadges(userId);

      setBadges(response);
    } catch {
      setBadges([]);
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
        <View>
          <Text style={styles.title}>
            Selos conquistados
          </Text>

          <Text style={styles.subtitle}>
            Recompensas desbloqueadas pelo desempenho.
          </Text>
        </View>

        <View style={styles.countBox}>
          <Text style={styles.countText}>
            {badges.length}
          </Text>
        </View>
      </View>

      {badges.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons
            name="ribbon-outline"
            size={34}
            color="#71717A"
          />

          <Text style={styles.emptyTitle}>
            Nenhum selo ainda
          </Text>

          <Text style={styles.emptyText}>
            Participe de desafios para desbloquear seus primeiros selos.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.badgesRow}
        >
          {badges.map((item) => {
            const badge = item.badge;

            return (
              <View key={item.id} style={styles.badgeItem}>
                <View style={styles.badgeIconBox}>
                  <Ionicons
                    name={badge?.icon ?? 'ribbon-outline'}
                    size={24}
                    color="#FACC15"
                  />
                </View>

                <Text style={styles.badgeTitle} numberOfLines={2}>
                  {badge?.title ?? 'Selo'}
                </Text>

                <Text style={styles.badgeDescription} numberOfLines={2}>
                  {badge?.description ?? 'Conquista desbloqueada.'}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
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
    justifyContent: 'space-between',
    marginBottom: 16,
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
  },

  countBox: {
    minWidth: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  countText: {
    color: '#22C55E',
    fontSize: 15,
    fontWeight: '900',
  },

  emptyBox: {
    minHeight: 140,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 10,
  },

  emptyText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  badgesRow: {
    gap: 12,
    paddingRight: 4,
  },

  badgeItem: {
    width: 138,
    minHeight: 150,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 12,
  },

  badgeIconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#2A2408',
    borderWidth: 1,
    borderColor: '#713F12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  badgeTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
  },

  badgeDescription: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 5,
  },
});
