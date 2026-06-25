import { useEffect, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { getChallengeHistory } from '../services/getChallengeHistory';

type Props = {
  userId: string;
};

export default function ProfileChallengeHistory({ userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    loadHistory();
  }, [userId]);

  async function loadHistory() {
    try {
      setLoading(true);

      const response = await getChallengeHistory(userId);

      setHistory(response);
    } catch (error) {
      console.log(error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }

  function getChallengeLabel(type: string) {
    if (type === 'day') return 'Diário';
    if (type === 'week') return 'Semanal';
    if (type === 'month') return 'Mensal';
    return 'Desafio';
  }

  function getStatusLabel(status: string) {
    if (status === 'completed') return 'Concluído';
    if (status === 'under_review') return 'Em análise';
    if (status === 'waiting_proof') return 'Aguardando comprovante';
    if (status === 'disqualified') return 'Desclassificado';
    if (status === 'ongoing') return 'Em andamento';
    return status ?? 'Status';
  }

  function getStatusColor(status: string) {
    if (status === 'completed') return '#22C55E';
    if (status === 'under_review') return '#F59E0B';
    if (status === 'waiting_proof') return '#60A5FA';
    if (status === 'disqualified') return '#EF4444';
    return '#A1A1AA';
  }

  function getMedalIcon(medal?: string) {
    if (medal === 'gold') return '🥇';
    if (medal === 'silver') return '🥈';
    if (medal === 'bronze') return '🥉';
    return null;
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
          <Text style={styles.title}>Histórico de desafios</Text>
          <Text style={styles.subtitle}>Últimas participações do motorista</Text>
        </View>

        <View style={styles.iconBox}>
          <Ionicons name="podium-outline" size={22} color="#22C55E" />
        </View>
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="flag-outline" size={34} color="#71717A" />
          <Text style={styles.emptyTitle}>Nenhum desafio ainda</Text>
          <Text style={styles.emptyText}>Quando participar de desafios, eles aparecerão aqui.</Text>
        </View>
      ) : (
        history.map((item) => {
          const medalIcon = getMedalIcon(item.medal);

          return (
            <View key={item.id} style={styles.historyItem}>
              <View style={styles.historyTop}>
                <View style={styles.challengeIconBox}>
                  <Ionicons name="trophy-outline" size={20} color="#22C55E" />
                </View>

                <View style={styles.historyInfo}>
                  <Text style={styles.historyTitle}>
                    Desafio {getChallengeLabel(item.challenge_type)}
                  </Text>

                  <Text style={styles.historySubtitle}>
                    {item.vehicle_type === 'carro' ? 'Carro' : 'Moto'} • {item.region ?? 'Nacional'}
                  </Text>
                </View>

                {medalIcon && <Text style={styles.medalIcon}>{medalIcon}</Text>}
              </View>

              <View style={styles.historyBottom}>
                <View>
                  <Text style={styles.amountLabel}>Faturamento aprovado</Text>
                  <Text style={styles.amountValue}>
                    R$ {Number(item.approved_amount ?? 0).toFixed(2).replace('.', ',')}
                  </Text>
                </View>

                <View style={styles.statusBox}>
                  {item.position ? (
                    <Text style={styles.positionText}>{item.position}º lugar</Text>
                  ) : null}

                  <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })
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
    padding: 16,
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
    fontSize: 17,
    fontWeight: '900',
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyBox: {
    minHeight: 150,
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
    fontSize: 15,
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

  historyItem: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 14,
    marginBottom: 12,
  },

  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  challengeIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  historyInfo: {
    flex: 1,
  },

  historyTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  historySubtitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  medalIcon: {
    fontSize: 24,
  },

  historyBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
  },

  amountLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
  },

  amountValue: {
    color: '#22C55E',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
  },

  statusBox: {
    alignItems: 'flex-end',
  },

  positionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 3,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '900',
  },
});
