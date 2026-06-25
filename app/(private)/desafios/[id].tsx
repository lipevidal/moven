import { useCallback, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getChallengeById } from '../../../src/features/challenges/services/getChallengeById';
import { getChallengeProofs } from '../../../src/features/challenges/services/getChallengeProofs';

export default function ChallengeDetailsScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [challenge, setChallenge] =
    useState<any>(null);

  const [proofs, setProofs] =
    useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadChallenge();
    }, [id]),
  );

  async function loadChallenge() {
    if (!id) return;

    try {
      setLoading(true);

      const response = await getChallengeById(id);
      const proofsResponse = await getChallengeProofs(id);

      setChallenge(response);
      setProofs(proofsResponse);
    } catch (error) {
      console.log(error);
      setChallenge(null);
      setProofs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadChallenge();
  }

  function getStatusLabel(value?: string) {
    if (value === 'ongoing') return 'Em andamento';
    if (value === 'waiting_proof') return 'Aguardando comprovantes';
    if (value === 'under_review') return 'Em análise';
    if (value === 'completed') return 'Concluído';
    if (value === 'disqualified') return 'Reprovado';

    return 'Inscrito';
  }

  function getStatusColor(value?: string) {
    if (value === 'completed') return '#22C55E';
    if (value === 'under_review') return '#F59E0B';
    if (value === 'waiting_proof') return '#3B82F6';
    if (value === 'disqualified') return '#EF4444';

    return '#A1A1AA';
  }

  function getChallengeTypeLabel(value?: string) {
    if (value === 'day') return 'Diário';
    if (value === 'week') return 'Semanal';
    if (value === 'month') return 'Mensal';

    return 'Desafio';
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

  if (loading) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  if (!challenge) {
    return (
      <View style={styles.loadingPage}>
        <Ionicons
          name="alert-circle-outline"
          size={42}
          color="#71717A"
        />

        <Text style={styles.notFoundTitle}>
          Desafio não encontrado
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

        <View>
          <Text style={styles.title}>
            Detalhes do desafio
          </Text>

          <Text style={styles.subtitle}>
            Acompanhe envio, análise e resultado.
          </Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.challengeTitle}>
              Desafio {getChallengeTypeLabel(challenge.challenge_type)}
            </Text>

            <Text style={styles.challengeSubtitle}>
              {challenge.vehicle_type === 'moto' ? 'Moto' : 'Carro'} • {challenge.region ?? 'Região'}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                borderColor: getStatusColor(challenge.status),
              },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                {
                  color: getStatusColor(challenge.status),
                },
              ]}
            >
              {getStatusLabel(challenge.status)}
            </Text>
          </View>
        </View>

        {Array.isArray(challenge.platforms) && challenge.platforms.length > 0 && (
          <View style={styles.platformsRow}>
            {challenge.platforms.map((platform: string) => (
              <View key={platform} style={styles.platformBadge}>
                <Text style={styles.platformBadgeText}>
                  {platform}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.metricsGrid}>
        <Metric
          label="Valor informado"
          value={`R$ ${formatCurrency(
            challenge.submitted_amount ??
              challenge.reported_amount ??
              0,
          )}`}
        />

        <Metric
          label="Valor aprovado"
          value={`R$ ${formatCurrency(challenge.approved_amount ?? 0)}`}
        />

        <Metric
          label="Posição"
          value={challenge.position ? `${challenge.position}º` : '—'}
        />

        <Metric
          label="Medalha"
          value={getMedalIcon(challenge.medal)}
        />
      </View>

      {challenge.status === 'waiting_proof' && (
        <View style={styles.actionCard}>
          <Ionicons
            name="cloud-upload-outline"
            size={32}
            color="#3B82F6"
          />

          <Text style={styles.actionTitle}>
            Envie seus comprovantes
          </Text>

          <Text style={styles.actionText}>
            Envie os prints de faturamento das plataformas usadas no desafio.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              router.push({
                pathname: '/(private)/desafios/enviar-comprovantes',
                params: {
                  challengeId: challenge.id,
                },
              })
            }
          >
            <Text style={styles.primaryButtonText}>
              Enviar comprovantes
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {challenge.status === 'under_review' && (
        <View style={styles.warningCard}>
          <Ionicons
            name="time-outline"
            size={28}
            color="#F59E0B"
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>
              Aguardando análise
            </Text>

            <Text style={styles.warningText}>
              Seus comprovantes foram enviados e estão aguardando validação administrativa.
            </Text>
          </View>
        </View>
      )}

      {challenge.status === 'completed' && (
        <View style={styles.successCard}>
          <Ionicons
            name="checkmark-circle-outline"
            size={30}
            color="#22C55E"
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.successTitle}>
              Resultado aprovado
            </Text>

            <Text style={styles.successText}>
              Seu faturamento foi validado e já pode aparecer nos rankings.
            </Text>
          </View>
        </View>
      )}

      {challenge.status === 'disqualified' && (
        <View style={styles.dangerCard}>
          <Ionicons
            name="close-circle-outline"
            size={30}
            color="#EF4444"
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.dangerTitle}>
              Desafio reprovado
            </Text>

            <Text style={styles.dangerText}>
              {challenge.review_notes ??
                'Os comprovantes não foram aprovados pela administração.'}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Comprovantes enviados
        </Text>

        <Text style={styles.sectionCount}>
          {proofs.length}
        </Text>
      </View>

      {proofs.length === 0 ? (
        <View style={styles.emptyProofs}>
          <Ionicons
            name="images-outline"
            size={38}
            color="#71717A"
          />

          <Text style={styles.emptyProofsTitle}>
            Nenhum comprovante enviado
          </Text>

          <Text style={styles.emptyProofsText}>
            Quando você enviar seus prints, eles aparecerão aqui.
          </Text>
        </View>
      ) : (
        <View style={styles.proofsGrid}>
          {proofs.map((proof) => (
            <View key={proof.id} style={styles.proofCard}>
              <Image
                source={{ uri: proof.image_url }}
                style={styles.proofImage}
              />

              <View style={styles.proofFooter}>
                <Text style={styles.proofStatus}>
                  {getStatusLabel(proof.status)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>
        {label}
      </Text>

      <Text style={styles.metricValue}>
        {value}
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

  title: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },

  heroCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 14,
  },

  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },

  challengeTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  challengeSubtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },

  statusBadge: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },

  platformsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  platformBadge: {
    minHeight: 28,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 10,
    justifyContent: 'center',
  },

  platformBadgeText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '800',
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },

  metricCard: {
    width: '48%',
    minHeight: 78,
    borderRadius: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
    justifyContent: 'center',
  },

  metricLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '800',
  },

  metricValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 8,
  },

  actionCard: {
    borderRadius: 24,
    backgroundColor: '#071525',
    borderWidth: 1,
    borderColor: '#1D4ED8',
    alignItems: 'center',
    padding: 18,
    marginBottom: 14,
  },

  actionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 10,
  },

  actionText: {
    color: '#BFDBFE',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
  },

  primaryButton: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  warningCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 22,
    backgroundColor: '#2A1607',
    borderWidth: 1,
    borderColor: '#92400E',
    padding: 14,
    marginBottom: 14,
  },

  warningTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  warningText: {
    color: '#FDBA74',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },

  successCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 22,
    backgroundColor: '#052E16',
    borderWidth: 1,
    borderColor: '#166534',
    padding: 14,
    marginBottom: 14,
  },

  successTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  successText: {
    color: '#BBF7D0',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },

  dangerCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 22,
    backgroundColor: '#2A0A0A',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    padding: 14,
    marginBottom: 14,
  },

  dangerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  dangerText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 12,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  sectionCount: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '900',
  },

  emptyProofs: {
    minHeight: 180,
    borderRadius: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },

  emptyProofsTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 10,
  },

  emptyProofsText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },

  proofsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  proofCard: {
    width: '48%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 12,
  },

  proofImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#18181B',
  },

  proofFooter: {
    padding: 10,
  },

  proofStatus: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '800',
  },
});
