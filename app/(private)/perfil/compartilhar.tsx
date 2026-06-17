import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';

import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getUnsharedResults } from '../../../src/features/sharedResults/services/getUnsharedResults';
import { shareResult } from '../../../src/features/sharedResults/services/shareResult';

function formatCurrency(value: number) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pt-BR');
}

export default function ShareResultScreen() {
  const { type } = useLocalSearchParams<{ type: any }>();

  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    loadItems();
  }, [type]);

  async function loadItems() {
    if (!type) return;

    const response = await getUnsharedResults(type);
    setItems(response);
  }

  async function handleShare(item: any) {
    await shareResult({
      type,
      reference_id: item.id,
      title: 'Resultado da jornada',
      period_label: formatDate(item.started_at),
      revenue: Number(item.total_earnings ?? 0),
      expenses: Number(item.total_expenses ?? 0),
      profit: Number(item.profit ?? 0),
      worked_seconds: Number(item.worked_seconds ?? 0),
      km_driven: Number(item.km_driven ?? 0),
      gain_per_hour: Number(item.gain_per_hour ?? 0),
      gain_per_km: Number(item.gain_per_km ?? 0),
    });

    Alert.alert('Compartilhado', 'Seu resultado foi publicado no feed.');

    await loadItems();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.title}>Compartilhar</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="checkmark-circle-outline" size={44} color="#71717A" />
          <Text style={styles.emptyTitle}>Nada para compartilhar</Text>
          <Text style={styles.emptyText}>
            Você já compartilhou todos os resultados disponíveis desse tipo.
          </Text>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              Jornada de {formatDate(item.started_at)}
            </Text>

            <View style={styles.metricsGrid}>
              <Metric label="Faturamento" value={`R$ ${formatCurrency(item.total_earnings)}`} />
              <Metric label="Despesas" value={`R$ ${formatCurrency(item.total_expenses)}`} />
              <Metric label="Lucro" value={`R$ ${formatCurrency(item.profit)}`} />
              <Metric label="KM" value={`${Number(item.km_driven ?? 0)} km`} />
            </View>

            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => handleShare(item)}
            >
              <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
              <Text style={styles.shareButtonText}>Compartilhar jornada</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  content: { padding: 18, paddingTop: 54, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  emptyBox: {
    minHeight: 240,
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
    fontSize: 17,
    fontWeight: '900',
    marginTop: 12,
  },
  emptyText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  card: {
    borderRadius: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 14,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    minHeight: 72,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 12,
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
  shareButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});