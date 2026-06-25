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
import { ProfileLevelCard } from '../../../src/features/gamification/components/ProfileLevelCard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getPublicProfile } from '../../../src/features/profile/services/getPublicProfile';
import { ProfileAchievementRewardsCard } from '../../../src/features/achievements/components/ProfileAchievementRewardsCard';


export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{
    userId: string;
  }>();

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [data, setData] =
    useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [userId]),
  );

  async function loadProfile() {
    if (!userId) return;

    try {
      setLoading(true);

      const response = await getPublicProfile(userId);

      setData(response);
    } catch (error) {
      console.log(error);
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadProfile();
  }

  function getLevelProgress(): `${number}%` {
    const level = Number(data?.level?.level ?? 1);
    const xp = Number(data?.level?.xp ?? 0);
    const requiredXp = level * 100;

    if (!requiredXp) return '0%';

    const progress = Math.min((xp / requiredXp) * 100, 100);

    return `${progress}%`;
  }

  function getChallengeLabel(value?: string) {
    if (value === 'day') return 'Diário';
    if (value === 'week') return 'Semanal';
    if (value === 'month') return 'Mensal';

    return 'Desafio';
  }

  function getMedalIcon(medal?: string) {
    if (medal === 'gold') return '🥇';
    if (medal === 'silver') return '🥈';
    if (medal === 'bronze') return '🥉';

    return '🏁';
  }

  function formatCurrency(value: number) {
    return Number(value ?? 0)
      .toFixed(2)
      .replace('.', ',');
  }

  if (loading) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  if (!data?.profile) {
    return (
      <View style={styles.loadingPage}>
        <Ionicons
          name="person-circle-outline"
          size={52}
          color="#71717A"
        />

        <Text style={styles.notFoundTitle}>
          Perfil não encontrado
        </Text>

        <TouchableOpacity
          style={styles.backHomeButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backHomeButtonText}>
            Voltar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const profile = data.profile;

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

        <Text style={styles.headerTitle}>
          Perfil
        </Text>
      </View>

      <View style={styles.profileCard}>
        {profile.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Ionicons
              name="person"
              size={44}
              color="#FFFFFF"
            />
          </View>
        )}

        <Text style={styles.name}>
          {profile.full_name || profile.name || 'Motorista'}
        </Text>

        {profile.username ? (
          <Text style={styles.username}>
            @{profile.username}
          </Text>
        ) : null}

        {profile.bio ? (
          <Text style={styles.bio}>
            {profile.bio}
          </Text>
        ) : null}

        <View style={styles.profileMetaRow}>
          {profile.city || profile.region ? (
            <View style={styles.metaBadge}>
              <Ionicons
                name="location-outline"
                size={15}
                color="#A1A1AA"
              />

              <Text style={styles.metaBadgeText}>
                {profile.city || profile.region}
              </Text>
            </View>
          ) : null}

          {profile.vehicle_type ? (
            <View style={styles.metaBadge}>
              <Ionicons
                name="car-outline"
                size={15}
                color="#A1A1AA"
              />

              <Text style={styles.metaBadgeText}>
                {profile.vehicle_type}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <ProfileLevelCard userId={userId} />
      <ProfileAchievementRewardsCard userId={userId} />

      <View style={styles.levelCard}>
        <View style={styles.levelTop}>
          <View>
            <Text style={styles.levelLabel}>
              Nível
            </Text>

            <Text style={styles.levelValue}>
              {data.level.level}
            </Text>
          </View>

          <View style={styles.xpBox}>
            <Text style={styles.xpText}>
              {data.level.total_xp} XP total
            </Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: getLevelProgress(),
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.metricsRow}>
        <Metric
          label="Medalhas"
          value={String(data.medalsCount)}
          icon="medal-outline"
        />

        <Metric
          label="Troféus"
          value={String(data.trophiesCount)}
          icon="trophy-outline"
        />

        <Metric
          label="Desafios"
          value={String(data.challenges.length)}
          icon="flag-outline"
        />
      </View>

      <Text style={styles.sectionTitle}>
        Histórico competitivo
      </Text>

      {data.challenges.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons
            name="podium-outline"
            size={42}
            color="#71717A"
          />

          <Text style={styles.emptyTitle}>
            Nenhum desafio concluído
          </Text>

          <Text style={styles.emptyText}>
            Quando este usuário concluir desafios, os resultados aparecerão aqui.
          </Text>
        </View>
      ) : (
        data.challenges.map((challenge: any) => (
          <View key={challenge.id} style={styles.challengeCard}>
            <View style={styles.medalBox}>
              <Text style={styles.medalText}>
                {getMedalIcon(challenge.medal)}
              </Text>
            </View>

            <View style={styles.challengeInfo}>
              <Text style={styles.challengeTitle}>
                Desafio {getChallengeLabel(challenge.challenge_type)}
              </Text>

              <Text style={styles.challengeSubtitle}>
                {challenge.vehicle_type === 'moto' ? 'Moto' : 'Carro'} • {challenge.region ?? 'Região'}
              </Text>
            </View>

            <View style={styles.challengeAmountBox}>
              <Text style={styles.challengeAmount}>
                R$ {formatCurrency(challenge.approved_amount)}
              </Text>

              <Text style={styles.challengePosition}>
                {challenge.position ? `${challenge.position}º lugar` : 'Ranking'}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.metricCard}>
      <Ionicons
        name={icon}
        size={22}
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
  loadingPage: {
    flex: 1,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  notFoundTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 14,
  },

  backHomeButton: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },

  backHomeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

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

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },

  profileCard: {
    backgroundColor: '#111827',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    padding: 22,
    marginBottom: 14,
  },

  avatar: {
    width: 98,
    height: 98,
    borderRadius: 999,
    marginBottom: 14,
  },

  avatarFallback: {
    width: 98,
    height: 98,
    borderRadius: 999,
    backgroundColor: '#27272A',
    borderWidth: 1,
    borderColor: '#3F3F46',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  name: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
  },

  username: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },

  bio: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 10,
  },

  profileMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 14,
  },

  metaBadge: {
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },

  metaBadgeText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '800',
  },

  levelCard: {
    backgroundColor: '#052E16',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#166534',
    padding: 16,
    marginBottom: 14,
  },

  levelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  levelLabel: {
    color: '#BBF7D0',
    fontSize: 12,
    fontWeight: '800',
  },

  levelValue: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 2,
  },

  xpBox: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: '#064E3B',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  xpText: {
    color: '#BBF7D0',
    fontSize: 12,
    fontWeight: '900',
  },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#064E3B',
    overflow: 'hidden',
    marginTop: 14,
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },

  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },

  metricCard: {
    flex: 1,
    minHeight: 90,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },

  metricValue: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 7,
  },

  metricLabel: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },

  emptyBox: {
    minHeight: 220,
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
    fontSize: 16,
    fontWeight: '900',
    marginTop: 12,
  },

  emptyText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
  },

  challengeCard: {
    minHeight: 80,
    borderRadius: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  medalBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  medalText: {
    fontSize: 22,
  },

  challengeInfo: {
    flex: 1,
  },

  challengeTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  challengeSubtitle: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },

  challengeAmountBox: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },

  challengeAmount: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '900',
  },

  challengePosition: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
});
