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

import {
  getXpRanking,
  XpRankingScope,
  XpRankingUser,
} from '../../../src/features/rankings/services/getXpRanking';

export default function XpRankingScreen() {
  const [scope, setScope] = useState<XpRankingScope>('national');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  const [ranking, setRanking] = useState<XpRankingUser[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadRanking();
    }, [scope]),
  );

  async function loadRanking() {
    try {
      setLoading(true);

      const response = await getXpRanking(scope);

      setCity(response.city);
      setRanking(response.ranking);
    } catch (error) {
      console.log(error);
      setRanking([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadRanking();
  }

  const topUsers = ranking.slice(0, 10);
  const otherUsers = ranking.slice(10);

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

        <View style={styles.headerInfo}>
          <Text style={styles.title}>
            Ranking XP
          </Text>

          <Text style={styles.subtitle}>
            Os motoristas com mais XP acumulado.
          </Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <TabButton
          label="Nacional"
          active={scope === 'national'}
          onPress={() => setScope('national')}
        />

        <TabButton
          label="Regional"
          active={scope === 'regional'}
          onPress={() => setScope('regional')}
        />
      </View>

      {scope === 'regional' && (
        <View style={styles.cityCard}>
          <Ionicons
            name="location-outline"
            size={20}
            color="#22C55E"
          />

          <Text style={styles.cityText}>
            {city ? `Ranking de ${city}` : 'Cadastre sua cidade para ver o ranking regional'}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#22C55E" />
        </View>
      ) : ranking.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons
            name="podium-outline"
            size={48}
            color="#71717A"
          />

          <Text style={styles.emptyTitle}>
            Nenhum usuário no ranking
          </Text>

          <Text style={styles.emptyText}>
            Quando os usuários ganharem XP, eles aparecerão aqui.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Top 10
            </Text>

            <Text style={styles.sectionSubtitle}>
              Destaques {scope === 'national' ? 'nacionais' : 'regionais'}
            </Text>
          </View>

          <View style={styles.topList}>
            {topUsers.map((user) => (
              <RankingLargeCard
                key={user.user_id}
                user={user}
              />
            ))}
          </View>

          {otherUsers.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Demais posições
                </Text>

                <Text style={styles.sectionSubtitle}>
                  Continue subindo no ranking
                </Text>
              </View>

              <View style={styles.grid}>
                {otherUsers.map((user) => (
                  <RankingSmallCard
                    key={user.user_id}
                    user={user}
                  />
                ))}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.tab,
        active && styles.tabActive,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.tabText,
          active && styles.tabTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function RankingLargeCard({ user }: { user: XpRankingUser }) {
  return (
    <TouchableOpacity
      style={styles.largeCard}
      activeOpacity={0.85}
      onPress={() =>
        router.push({
          pathname: '/(private)/perfil/[userId]',
          params: {
            userId: user.user_id,
          },
        })
      }
    >
      <PositionBadge position={user.position} large />

      <UserAvatar user={user} large />

      <View style={styles.largeUserInfo}>
        <Text style={styles.largeName} numberOfLines={1}>
          {user.name}{user.username ? ` • @${user.username}` : ''}
        </Text>

        <Text style={styles.city} numberOfLines={1}>
          {user.city ?? 'Cidade não informada'}
        </Text>

        <Text style={styles.xpText}>
          {formatNumber(user.total_xp)} XP total
        </Text>
      </View>

      <LevelBadge level={user.level} />
    </TouchableOpacity>
  );
}

function RankingSmallCard({ user }: { user: XpRankingUser }) {
  return (
    <TouchableOpacity
      style={styles.smallCard}
      activeOpacity={0.85}
      onPress={() =>
        router.push({
          pathname: '/(private)/perfil/[userId]',
          params: {
            userId: user.user_id,
          },
        })
      }
    >
      <View style={styles.smallTopRow}>
        <PositionBadge position={user.position} />
        <LevelBadge level={user.level} small />
      </View>

      <UserAvatar user={user} />

      <Text style={styles.smallName} numberOfLines={1}>
        {user.name}
      </Text>

      {user.username ? (
        <Text style={styles.username} numberOfLines={1}>
          @{user.username}
        </Text>
      ) : null}

      <Text style={styles.smallCity} numberOfLines={1}>
        {user.city ?? 'Cidade não informada'}
      </Text>

      <Text style={styles.smallXp}>
        {formatNumber(user.total_xp)} XP
      </Text>
    </TouchableOpacity>
  );
}

function PositionBadge({
  position,
  large,
}: {
  position: number;
  large?: boolean;
}) {
  return (
    <View
      style={[
        styles.positionBadge,
        large && styles.positionBadgeLarge,
      ]}
    >
      <Text
        style={[
          styles.positionText,
          large && styles.positionTextLarge,
        ]}
      >
        #{position}
      </Text>
    </View>
  );
}

function UserAvatar({
  user,
  large,
}: {
  user: XpRankingUser;
  large?: boolean;
}) {
  const canShowAvatar = user.avatar_url && user.show_avatar !== false;

  if (canShowAvatar) {
    return (
      <Image
        source={{ uri: user.avatar_url as string }}
        style={large ? styles.avatarLarge : styles.avatarSmall}
      />
    );
  }

  return (
    <View style={large ? styles.avatarLargeFallback : styles.avatarSmallFallback}>
      <Ionicons
        name="person"
        size={large ? 28 : 22}
        color="#FFFFFF"
      />
    </View>
  );
}

function LevelBadge({
  level,
  small,
}: {
  level: number;
  small?: boolean;
}) {
  return (
    <View style={small ? styles.levelBadgeSmall : styles.levelBadge}>
      <Ionicons
        name="flash"
        size={small ? 11 : 13}
        color="#FACC15"
      />

      <Text style={small ? styles.levelBadgeTextSmall : styles.levelBadgeText}>
        Nv. {level}
      </Text>
    </View>
  );
}

function formatNumber(value: number) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    maximumFractionDigits: 0,
  });
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
    marginBottom: 18,
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

  headerInfo: {
    flex: 1,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },

  tabs: {
    height: 48,
    borderRadius: 17,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 4,
    flexDirection: 'row',
    marginBottom: 14,
  },

  tab: {
    flex: 1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabActive: {
    backgroundColor: '#22C55E',
  },

  tabText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '900',
  },

  tabTextActive: {
    color: '#FFFFFF',
  },

  cityCard: {
    minHeight: 48,
    borderRadius: 17,
    backgroundColor: '#052E16',
    borderWidth: 1,
    borderColor: '#166534',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },

  cityText: {
    flex: 1,
    color: '#BBF7D0',
    fontSize: 13,
    fontWeight: '800',
  },

  loadingBox: {
    minHeight: 260,
    borderRadius: 24,
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
    marginTop: 7,
  },

  sectionHeader: {
    marginTop: 8,
    marginBottom: 12,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },

  sectionSubtitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  topList: {
    gap: 12,
    marginBottom: 12,
  },

  largeCard: {
    minHeight: 94,
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  positionBadge: {
    minWidth: 38,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  positionBadgeLarge: {
    minWidth: 48,
    height: 38,
    marginRight: 10,
  },

  positionText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '900',
  },

  positionTextLarge: {
    color: '#FFFFFF',
    fontSize: 13,
  },

  avatarLarge: {
    width: 58,
    height: 58,
    borderRadius: 999,
    marginRight: 12,
  },

  avatarLargeFallback: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  avatarSmall: {
    width: 54,
    height: 54,
    borderRadius: 999,
    marginTop: 10,
    marginBottom: 8,
  },

  avatarSmallFallback: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 8,
  },

  largeUserInfo: {
    flex: 1,
  },

  largeName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  city: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  xpText: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 5,
  },

  levelBadge: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: '#2A2408',
    borderWidth: 1,
    borderColor: '#713F12',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  levelBadgeText: {
    color: '#FACC15',
    fontSize: 11,
    fontWeight: '900',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },

  smallCard: {
    width: '48%',
    minHeight: 205,
    borderRadius: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },

  smallTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  levelBadgeSmall: {
    minHeight: 27,
    borderRadius: 999,
    backgroundColor: '#2A2408',
    borderWidth: 1,
    borderColor: '#713F12',
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  levelBadgeTextSmall: {
    color: '#FACC15',
    fontSize: 9,
    fontWeight: '900',
  },

  smallName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },

  username: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },

  smallCity: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
    textAlign: 'center',
  },

  smallXp: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 7,
  },
});
