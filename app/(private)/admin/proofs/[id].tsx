import { useCallback, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getChallengeReview } from '../../../../src/features/admin/services/getChallengeReview';
import { approveChallenge } from '../../../../src/features/admin/services/approveChallenge';
import { rejectChallenge } from '../../../../src/features/admin/services/rejectChallenge';

export default function AdminProofDetailScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [challenge, setChallenge] =
    useState<any>(null);

  const [proofs, setProofs] =
    useState<any[]>([]);

  const [approvedAmount, setApprovedAmount] =
    useState('');

  const [reason, setReason] =
    useState('');

  useFocusEffect(
    useCallback(() => {
      loadReview();
    }, [id]),
  );

  async function loadReview() {
    if (!id) return;

    try {
      setLoading(true);

      const response = await getChallengeReview(id);

      setChallenge(response.challenge);
      setProofs(response.proofs);

      const currentAmount =
        response.challenge.submitted_amount ??
        response.challenge.reported_amount ??
        response.challenge.approved_amount ??
        0;

      setApprovedAmount(formatCurrencyInput(String(Number(currentAmount) * 100)));
    } catch (error) {
      console.log(error);
      setChallenge(null);
      setProofs([]);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrencyInput(value: string) {
    const numbers = value.replace(/\D/g, '');

    if (!numbers) return '';

    const cents = Number(numbers) / 100;

    return cents.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function parseCurrency(value: string) {
    if (!value) return 0;

    return Number(
      value
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^\d.]/g, ''),
    );
  }

  async function handleApprove() {
    if (!id) return;

    const amount = parseCurrency(approvedAmount);

    if (amount <= 0) {
      Alert.alert(
        'Valor inválido',
        'Informe o valor aprovado para este desafio.',
      );

      return;
    }

    Alert.alert(
      'Aprovar comprovante',
      'Deseja aprovar este resultado e liberar para o ranking?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Aprovar',
          onPress: async () => {
            try {
              setSaving(true);

              await approveChallenge(id, amount);

              Alert.alert(
                'Aprovado',
                'Resultado aprovado com sucesso.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.back(),
                  },
                ],
              );
            } catch (error: any) {
              Alert.alert(
                'Erro',
                error.message ??
                  'Não foi possível aprovar o comprovante.',
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }

  async function handleReject() {
    if (!id) return;

    if (!reason.trim()) {
      Alert.alert(
        'Motivo obrigatório',
        'Informe o motivo da reprovação.',
      );

      return;
    }

    Alert.alert(
      'Reprovar comprovante',
      'Deseja reprovar este resultado?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Reprovar',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);

              await rejectChallenge(id, reason.trim());

              Alert.alert(
                'Reprovado',
                'Resultado reprovado com sucesso.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.back(),
                  },
                ],
              );
            } catch (error: any) {
              Alert.alert(
                'Erro',
                error.message ??
                  'Não foi possível reprovar o comprovante.',
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }

  function formatCurrency(value: number) {
    return Number(value ?? 0)
      .toFixed(2)
      .replace('.', ',');
  }

  function getChallengeTypeLabel(value?: string) {
    if (value === 'day') return 'Diário';
    if (value === 'week') return 'Semanal';
    if (value === 'month') return 'Mensal';

    return 'Desafio';
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
          Análise não encontrada
        </Text>
      </View>
    );
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
            Analisar comprovante
          </Text>

          <Text style={styles.subtitle}>
            Confira os prints e valide o valor.
          </Text>
        </View>
      </View>

      <View style={styles.userCard}>
        {challenge.user?.avatar_url ? (
          <Image
            source={{ uri: challenge.user.avatar_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Ionicons
              name="person"
              size={24}
              color="#FFFFFF"
            />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>
            {challenge.user?.full_name ||
              challenge.user?.name ||
              'Motorista'}
          </Text>

          <Text style={styles.userMeta}>
            {getChallengeTypeLabel(challenge.challenge_type)} • {challenge.vehicle_type === 'moto' ? 'Moto' : 'Carro'} • {challenge.region ?? 'Região'}
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>
            Informado
          </Text>

          <Text style={styles.metricValue}>
            R$ {formatCurrency(
              challenge.submitted_amount ??
                challenge.reported_amount ??
                0,
            )}
          </Text>
        </View>

        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>
            Prints
          </Text>

          <Text style={styles.metricValue}>
            {proofs.length}
          </Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>
          Valor aprovado
        </Text>

        <View style={styles.inputBox}>
          <Text style={styles.currencyPrefix}>
            R$
          </Text>

          <TextInput
            value={approvedAmount}
            onChangeText={(text) =>
              setApprovedAmount(formatCurrencyInput(text))
            }
            placeholder="0,00"
            placeholderTextColor="#71717A"
            keyboardType="numeric"
            style={styles.input}
          />
        </View>

        <Text style={styles.label}>
          Motivo da reprovação
        </Text>

        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Ex: print ilegível, valor divergente..."
          placeholderTextColor="#71717A"
          multiline
          style={styles.reasonInput}
        />
      </View>

      <Text style={styles.sectionTitle}>
        Comprovantes
      </Text>

      {proofs.length === 0 ? (
        <View style={styles.emptyProofs}>
          <Text style={styles.emptyProofsText}>
            Nenhum comprovante enviado.
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
                <Text style={styles.proofText}>
                  R$ {formatCurrency(proof.declared_amount ?? 0)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[
            styles.rejectButton,
            saving && styles.disabledButton,
          ]}
          disabled={saving}
          onPress={handleReject}
        >
          <Text style={styles.rejectButtonText}>
            Reprovar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.approveButton,
            saving && styles.disabledButton,
          ]}
          disabled={saving}
          onPress={handleApprove}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.approveButtonText}>
              Aprovar
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
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
    fontSize: 22,
    fontWeight: '900',
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
    marginBottom: 14,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    marginRight: 12,
  },

  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  userName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  userMeta: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },

  metricBox: {
    flex: 1,
    minHeight: 72,
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
    color: '#22C55E',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 8,
  },

  formCard: {
    backgroundColor: '#111827',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 16,
  },

  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },

  inputBox: {
    height: 50,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 16,
  },

  currencyPrefix: {
    color: '#22C55E',
    fontSize: 15,
    fontWeight: '900',
    marginRight: 8,
  },

  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  reasonInput: {
    minHeight: 96,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    padding: 14,
    textAlignVertical: 'top',
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 12,
  },

  emptyProofs: {
    minHeight: 120,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  emptyProofsText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
  },

  proofsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
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
    height: 170,
    backgroundColor: '#18181B',
  },

  proofFooter: {
    padding: 10,
  },

  proofText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  rejectButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#3F1D1D',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rejectButtonText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '900',
  },

  approveButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  disabledButton: {
    opacity: 0.6,
  },
});
