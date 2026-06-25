import { useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { generateChallengeRanking } from '../../../../src/features/admin/services/generateChallengeRanking';
import { generateRecordistRanking } from '../../../../src/features/admin/services/generateRecordistRanking';

type ChallengeType = 'day' | 'week' | 'month';
type VehicleType = 'carro' | 'moto';
type ScopeType = 'regional' | 'nacional';

export default function AdminRankingsScreen() {
  const [challengeType, setChallengeType] =
    useState<ChallengeType>('day');

  const [vehicleType, setVehicleType] =
    useState<VehicleType>('carro');

  const [scope, setScope] =
    useState<ScopeType>('regional');

  const [region, setRegion] =
    useState('Belo Horizonte');

  const [loadingRanking, setLoadingRanking] =
    useState(false);

  const [loadingRecordists, setLoadingRecordists] =
    useState(false);

  const [results, setResults] =
    useState<any[]>([]);

  const challengeTypes = [
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

  const vehicleTypes = [
    {
      label: 'Carro',
      value: 'carro',
    },
    {
      label: 'Moto',
      value: 'moto',
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
  ] as const;

  const regions = [
    'Belo Horizonte',
    'São Paulo',
    'Rio de Janeiro',
  ];

  async function handleGenerateRanking() {
    try {
      setLoadingRanking(true);

      const response =
        await generateChallengeRanking({
          challengeType,
          vehicleType,
          scope,
          region: scope === 'regional' ? region : undefined,
        });

      setResults(response);

      Alert.alert(
        'Ranking gerado',
        'Ranking, posições, medalhas, XP e notificações foram processados.',
      );
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message ??
          'Não foi possível gerar o ranking.',
      );
    } finally {
      setLoadingRanking(false);
    }
  }

  async function handleGenerateRecordists() {
    try {
      setLoadingRecordists(true);

      const response =
        await generateRecordistRanking({
          challengeType,
          vehicleType,
          scope,
          region: scope === 'regional' ? region : undefined,
        });

      setResults(response);

      Alert.alert(
        'Recordistas gerados',
        'Troféus, XP e notificações dos recordistas foram processados.',
      );
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message ??
          'Não foi possível gerar os recordistas.',
      );
    } finally {
      setLoadingRecordists(false);
    }
  }

  function getChallengeLabel(value: string) {
    if (value === 'day') return 'Diário';
    if (value === 'week') return 'Semanal';
    if (value === 'month') return 'Mensal';

    return value;
  }

  function getMedalIcon(medal?: string) {
    if (medal === 'gold') return '🥇';
    if (medal === 'silver') return '🥈';
    if (medal === 'bronze') return '🥉';

    return '—';
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

        <View>
          <Text style={styles.title}>
            Gerar rankings
          </Text>

          <Text style={styles.subtitle}>
            Processe rankings, medalhas e recordistas.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Período
        </Text>

        <View style={styles.optionsRow}>
          {challengeTypes.map((item) => (
            <Option
              key={item.value}
              label={item.label}
              active={challengeType === item.value}
              onPress={() => setChallengeType(item.value)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>
          Veículo
        </Text>

        <View style={styles.optionsRow}>
          {vehicleTypes.map((item) => (
            <Option
              key={item.value}
              label={item.label}
              active={vehicleType === item.value}
              onPress={() => setVehicleType(item.value)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>
          Tipo
        </Text>

        <View style={styles.optionsRow}>
          {scopes.map((item) => (
            <Option
              key={item.value}
              label={item.label}
              active={scope === item.value}
              onPress={() => setScope(item.value)}
            />
          ))}
        </View>

        {scope === 'regional' && (
          <>
            <Text style={styles.sectionTitle}>
              Região
            </Text>

            <View style={styles.regionList}>
              {regions.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.regionOption,
                    region === item && styles.regionOptionActive,
                  ]}
                  onPress={() => setRegion(item)}
                >
                  <Text
                    style={[
                      styles.regionOptionText,
                      region === item && styles.regionOptionTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.actionsCard}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            loadingRanking && styles.disabledButton,
          ]}
          disabled={loadingRanking || loadingRecordists}
          onPress={handleGenerateRanking}
        >
          {loadingRanking ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name="podium-outline"
                size={20}
                color="#FFFFFF"
              />

              <Text style={styles.primaryButtonText}>
                Gerar ranking e medalhas
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryButton,
            loadingRecordists && styles.disabledButton,
          ]}
          disabled={loadingRanking || loadingRecordists}
          onPress={handleGenerateRecordists}
        >
          {loadingRecordists ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name="trophy-outline"
                size={20}
                color="#FACC15"
              />

              <Text style={styles.secondaryButtonText}>
                Gerar recordistas
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>
          Configuração atual
        </Text>

        <Text style={styles.summaryText}>
          {getChallengeLabel(challengeType)} • {vehicleType === 'carro' ? 'Carro' : 'Moto'} • {scope === 'regional' ? region : 'Nacional'}
        </Text>
      </View>

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>
          Resultado
        </Text>

        <Text style={styles.resultsCount}>
          {results.length}
        </Text>
      </View>

      {results.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons
            name="stats-chart-outline"
            size={44}
            color="#71717A"
          />

          <Text style={styles.emptyTitle}>
            Nenhum resultado gerado
          </Text>

          <Text style={styles.emptyText}>
            Gere um ranking ou recordistas para visualizar os participantes processados.
          </Text>
        </View>
      ) : (
        results.map((item, index) => (
          <View key={item.id} style={styles.resultCard}>
            <View style={styles.positionBox}>
              <Text style={styles.positionText}>
                {item.record_position ?? item.position ?? index + 1}º
              </Text>
            </View>

            <View style={styles.resultInfo}>
              <Text style={styles.resultTitle}>
                Usuário {String(item.user_id).slice(0, 8)}
              </Text>

              <Text style={styles.resultSubtitle}>
                {item.region ?? 'Brasil'} • R$ {formatCurrency(item.approved_amount)}
              </Text>
            </View>

            <Text style={styles.medalText}>
              {getMedalIcon(item.medal ?? item.trophy)}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Option({
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
        styles.option,
        active && styles.optionActive,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.optionText,
          active && styles.optionTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
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

  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },

  card: {
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 14,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
    marginTop: 6,
  },

  optionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },

  option: {
    flex: 1,
    height: 42,
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

  regionList: {
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

  actionsCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    gap: 10,
    marginBottom: 14,
  },

  primaryButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  secondaryButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#2A2408',
    borderWidth: 1,
    borderColor: '#713F12',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  secondaryButtonText: {
    color: '#FACC15',
    fontSize: 14,
    fontWeight: '900',
  },

  disabledButton: {
    opacity: 0.6,
  },

  summaryCard: {
    borderRadius: 20,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 14,
    marginBottom: 16,
  },

  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  summaryText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },

  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  resultsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  resultsCount: {
    color: '#22C55E',
    fontSize: 15,
    fontWeight: '900',
  },

  emptyBox: {
    minHeight: 220,
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
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
    marginTop: 6,
  },

  resultCard: {
    minHeight: 76,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  positionBox: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  positionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  resultInfo: {
    flex: 1,
  },

  resultTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  resultSubtitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  medalText: {
    fontSize: 24,
  },
});
