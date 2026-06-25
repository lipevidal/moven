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

import { processChallengeDeadlines } from '../../../../src/features/admin/services/processChallengeDeadlines';

export default function AdminMaintenanceScreen() {
  const [loading, setLoading] =
    useState(false);

  const [results, setResults] =
    useState<any[]>([]);

  async function handleProcessDeadlines() {
    Alert.alert(
      'Processar prazos',
      'Deseja atualizar desafios encerrados e desclassificar inscrições vencidas?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Processar',
          onPress: async () => {
            try {
              setLoading(true);

              const response =
                await processChallengeDeadlines();

              setResults(response);

              Alert.alert(
                'Processamento concluído',
                'Os prazos dos desafios foram atualizados.',
              );
            } catch (error: any) {
              Alert.alert(
                'Erro',
                error.message ??
                  'Não foi possível processar os prazos.',
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  }

  function getActionLabel(action: string) {
    if (action === 'daily_waiting_proof') {
      return 'Diários aguardando comprovantes';
    }

    if (action === 'weekly_waiting_proof') {
      return 'Semanais aguardando comprovantes';
    }

    if (action === 'monthly_waiting_proof') {
      return 'Mensais aguardando comprovantes';
    }

    if (action === 'expired_without_proof') {
      return 'Desclassificados por prazo vencido';
    }

    return action;
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
            Manutenção
          </Text>

          <Text style={styles.subtitle}>
            Execute rotinas administrativas dos desafios.
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.iconBox}>
          <Ionicons
            name="time-outline"
            size={34}
            color="#22C55E"
          />
        </View>

        <Text style={styles.infoTitle}>
          Processar prazos dos desafios
        </Text>

        <Text style={styles.infoText}>
          Essa rotina verifica desafios encerrados, libera o envio de comprovantes e desclassifica automaticamente quem perdeu o prazo.
        </Text>

        <View style={styles.rulesList}>
          <Rule text="Diário: libera envio no dia seguinte." />
          <Rule text="Semanal: libera envio após o domingo." />
          <Rule text="Mensal: libera envio no início do próximo mês." />
          <Rule text="Sem comprovante até o prazo: desclassificação automática." />
        </View>

        <TouchableOpacity
          style={[
            styles.processButton,
            loading && styles.processButtonDisabled,
          ]}
          disabled={loading}
          onPress={handleProcessDeadlines}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name="sync-outline"
                size={20}
                color="#FFFFFF"
              />

              <Text style={styles.processButtonText}>
                Processar agora
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>
        Último processamento
      </Text>

      {results.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons
            name="document-text-outline"
            size={42}
            color="#71717A"
          />

          <Text style={styles.emptyTitle}>
            Nenhum processamento executado
          </Text>

          <Text style={styles.emptyText}>
            Quando você executar a rotina, o resultado aparecerá aqui.
          </Text>
        </View>
      ) : (
        results.map((item) => (
          <View key={item.action} style={styles.resultCard}>
            <View style={styles.resultIconBox}>
              <Ionicons
                name="checkmark-circle-outline"
                size={24}
                color="#22C55E"
              />
            </View>

            <View style={styles.resultInfo}>
              <Text style={styles.resultTitle}>
                {getActionLabel(item.action)}
              </Text>

              <Text style={styles.resultSubtitle}>
                {Number(item.affected ?? 0)} registro(s) atualizado(s)
              </Text>
            </View>

            <Text style={styles.resultNumber}>
              {Number(item.affected ?? 0)}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Rule({ text }: { text: string }) {
  return (
    <View style={styles.ruleItem}>
      <Ionicons
        name="checkmark-circle"
        size={17}
        color="#22C55E"
      />

      <Text style={styles.ruleText}>
        {text}
      </Text>
    </View>
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
    fontSize: 26,
    fontWeight: '900',
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
    maxWidth: 280,
  },

  infoCard: {
    backgroundColor: '#111827',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 18,
    marginBottom: 22,
  },

  iconBox: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: '#052E16',
    borderWidth: 1,
    borderColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  infoTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },

  infoText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 8,
  },

  rulesList: {
    gap: 8,
    marginTop: 14,
  },

  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  ruleText: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },

  processButton: {
    height: 52,
    borderRadius: 17,
    backgroundColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },

  processButtonDisabled: {
    opacity: 0.6,
  },

  processButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },

  emptyBox: {
    minHeight: 200,
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
  },

  resultIconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#052E16',
    borderWidth: 1,
    borderColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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

  resultNumber: {
    color: '#22C55E',
    fontSize: 18,
    fontWeight: '900',
  },
});
