import { useEffect, useState } from 'react';

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

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  getPublicRankings,
  RankingPeriod,
  RankingScope,
  RankingVehicle,
} from '../../../src/features/rankings/services/getPublicRankings';

export default function RankingsScreen() {
  const [period, setPeriod] =
    useState<RankingPeriod>('day');

  const [scope, setScope] =
    useState<RankingScope>('regional');

  const [vehicleType, setVehicleType] =
    useState<RankingVehicle>('carro');

  const [region, setRegion] =
    useState('Belo Horizonte');

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [ranking, setRanking] =
    useState<any[]>([]);

  const periods = [
    {
      label: 'Dia',
      value: 'day',
    },
    {
      label: 'Semana',
      value: 'week',
    },
    {
      label: 'Mês',
      value: 'month',
    },
  ] as const;

  const scopes = [
    {
      label: 'Regional',
      value: 'regional',
    },
    {
      label: 'Nacional',
      value: 'nacional',
    },
    {
      label: 'Recordistas',
      value: 'recordists',
    },
  ] as const;

  const vehicles = [
    {
      label: 'Carro',
      value: 'carro',
    },
    {
      label: 'Moto',
      value: 'moto',
    },
  ] as const;

  const regions = [
    'Belo Horizonte',
    'São Paulo',
    'Rio de Janeiro',
  ];

  useEffect(() => {
    loadRanking();
  }, [period, scope, vehicleType, region]);

  async function loadRanking() {
    try {
      setLoading(true);

      const response = await getPublicRankings({
        period,
        scope,
        vehicleType,
        region,
      });

      setRanking(response);
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

  function getTitle() {
    if (scope === 'recordists') {
      return 'Recordistas';
    }

    if (scope === 'nacional') {
      return 'Ranking Nacional';
    }

    return 'Ranking Regional';
  }

  function getPeriodLabel() {
    if (period === 'day') return 'Diário';
    if (period === 'week') return 'Semanal';
    return 'Mensal';
  }

  function getMedalIcon(index: number) {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';

    return `${index + 1}º`;
  }

  function formatCurrency(value: number) {
    return Number(value ?? 0)
      .toFixed(2)
      .replace('.', ',');
  }

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
        <View>
          <Text style={styles.title}>
            Rankings
          </Text>

          <Text style={styles.subtitle}>
            Compare resultados por período, veículo e região.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/(private)/hall-of-fame')}
        >
          <Ionicons
            name="trophy-outline"
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.filtersCard}>
        <Text style={styles.filterTitle}>
          Período
        </Text>

        <View style={styles.optionsRow}>
          {periods.map((item) => {
            const active = period === item.value;

            return (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.option,
                  active && styles.optionActive,
                ]}
                onPress={() => setPeriod(item.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    active && styles.optionTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.filterTitle}>
          Tipo
        </Text>

        <View style={styles.optionsRow}>
          {scopes.map((item) => {
            const active = scope === item.value;

            return (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.option,
                  active && styles.optionActive,
                ]}
                onPress={() => setScope(item.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    active && styles.optionTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.filterTitle}>
          Veículo
        </Text>

        <View style={styles.optionsRow}>
          {vehicles.map((item) => {
            const active = vehicleType === item.value;

            return (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.option,
                  active && styles.optionActive,
                ]}
                onPress={() => setVehicleType(item.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    active && styles.optionTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {scope === 'regional' && (
          <>
            <Text style={styles.filterTitle}>
              Região
            </Text>

            <View style={styles.regionsList}>
              {regions.map((item) => {
                const active = region === item;

                return (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.regionOption,
                      active && styles.regionOptionActive,
                    ]}
                    onPress={() => setRegion(item)}
                  >
                    <Text
                      style={[
                        styles.regionOptionText,
                        active && styles.regionOptionTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </View>

      <View style={styles.rankingHeader}>
        <View>
          <Text style={styles.rankingTitle}>
            {getTitle()}
          </Text>

          <Text style={styles.rankingSubtitle}>
            {getPeriodLabel()} • {vehicleType === 'carro' ? 'Carro' : 'Moto'}
            {scope === 'regional' ? ` • ${region}` : ''}
          </Text>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>
            {ranking.length}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#22C55E" />
        </View>
      ) : ranking.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons
            name="podium-outline"
            size={42}
            color="#71717A"
          />

          <Text style={styles.emptyTitle}>
            Nenhum ranking encontrado
          </Text>

          <Text style={styles.emptyText}>
            Ainda não existem participantes concluídos para estes filtros.
          </Text>
        </View>
      ) : (
        ranking.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.rankingCard,
              index < 3 && styles.rankingCardPodium,
            ]}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: '/(private)/perfil/[userId]',
                params: {
                  userId: item.user_id,
                },
              })
            }
          >
            <View
              style={[
                styles.positionBox,
                index === 0 && styles.positionGold,
                index === 1 && styles.positionSilver,
                index === 2 && styles.positionBronze,
              ]}
            >
              <Text style={styles.positionText}>
                {getMedalIcon(index)}
              </Text>
            </View>

            {item.user?.avatar_url ? (
              <Image
                source={{ uri: item.user.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons
                  name="person"
                  size={22}
                  color="#FFFFFF"
                />
              </View>
            )}

            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.user?.full_name ||
                  item.user?.name ||
                  'Motorista'}
              </Text>

              <Text style={styles.userMeta} numberOfLines={1}>
                {item.region ?? 'Brasil'} • {getPeriodLabel()}
              </Text>
            </View>

            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>
                Faturamento
              </Text>

              <Text style={styles.amountValue}>
                R$ {formatCurrency(item.approved_amount)}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
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
    justifyContent: 'space-between',
    marginBottom: 22,
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
    marginTop: 4,
    maxWidth: 280,
  },

  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  filtersCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 20,
  },

  filterTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
    marginTop: 8,
  },

  optionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },

  option: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  optionActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  optionText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '900',
  },

  optionTextActive: {
    color: '#FFFFFF',
  },

  regionsList: {
    gap: 8,
  },

  regionOption: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  regionOptionActive: {
    backgroundColor: '#14532D',
    borderColor: '#22C55E',
  },

  regionOptionText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '800',
  },

  regionOptionTextActive: {
    color: '#FFFFFF',
  },

  rankingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  rankingTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },

  rankingSubtitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  countBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  countBadgeText: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '900',
  },

  loadingBox: {
    minHeight: 180,
    borderRadius: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyBox: {
    minHeight: 220,
    borderRadius: 22,
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
    marginTop: 8,
    lineHeight: 19,
  },

  rankingCard: {
    minHeight: 82,
    borderRadius: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  rankingCardPodium: {
    borderColor: '#3F3F16',
    backgroundColor: '#14140A',
  },

  positionBox: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  positionGold: {
    backgroundColor: '#2A2408',
    borderColor: '#FACC15',
  },

  positionSilver: {
    backgroundColor: '#1F2937',
    borderColor: '#CBD5E1',
  },

  positionBronze: {
    backgroundColor: '#2A1607',
    borderColor: '#F97316',
  },

  positionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 999,
    marginRight: 12,
  },

  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#27272A',
    borderWidth: 1,
    borderColor: '#3F3F46',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  userInfo: {
    flex: 1,
  },

  userName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  userMeta: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },

  amountBox: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },

  amountLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '800',
  },

  amountValue: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
  },
});
