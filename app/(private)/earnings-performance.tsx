import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import {
  EarningsPerformanceAnalysis,
  getEarningsPerformanceAnalysis,
  getMetricStatusLabel,
} from '../../src/features/performance/services/getEarningsPerformanceAnalysis';

function formatCurrency(value: number) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumber(value: number) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    maximumFractionDigits: 0,
  });
}

function formatMetric(value: number, decimals = 2) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatHours(value: number) {
  const totalMinutes = Math.round(Number(value ?? 0) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatDate(value?: string | null) {
  if (!value) return '--/--/----';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '--/--/----';

  return date.toLocaleDateString('pt-BR');
}

function getStatusColor(status: string) {
  if (status === 'above') return '#22C55E';
  if (status === 'intermediate') return '#FACC15';
  if (status === 'below') return '#EF4444';

  return '#A1A1AA';
}

function getStatusIcon(status: string) {
  if (status === 'above') return 'arrow-up-circle-outline';
  if (status === 'intermediate') return 'remove-circle-outline';
  if (status === 'below') return 'arrow-down-circle-outline';

  return 'analytics-outline';
}

function MetricCard({
  icon,
  label,
  value,
  subtitle,
  color = '#22C55E',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconBox, { backgroundColor: `${color}1F`, borderColor: `${color}45` }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>

      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {subtitle ? <Text style={styles.metricSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function StatusCard({
  title,
  value,
  status,
  target,
  color,
  icon,
}: {
  title: string;
  value: string;
  status: string;
  target: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statusCard}>
      <View style={styles.statusTopRow}>
        <View style={[styles.statusIconBox, { backgroundColor: `${color}1F`, borderColor: `${color}45` }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>

        <View style={[styles.statusBadge, { backgroundColor: `${color}1F`, borderColor: `${color}45` }]}>
          <Text style={[styles.statusBadgeText, { color }]}>{status}</Text>
        </View>
      </View>

      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusValue}>{value}</Text>
      <Text style={styles.statusTarget}>{target}</Text>
    </View>
  );
}

function TextListCard({
  title,
  icon,
  color,
  items,
  empty,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  items: string[];
  empty: string;
}) {
  return (
    <View style={styles.textListCard}>
      <View style={styles.sectionHeaderRow}>
        <View style={[styles.sectionIconBox, { backgroundColor: `${color}1F`, borderColor: `${color}45` }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      {items.length > 0 ? (
        items.map((item, index) => (
          <View key={`${title}-${index}`} style={styles.textListItem}>
            <View style={[styles.textListDot, { backgroundColor: color }]} />
            <Text style={styles.textListText}>{item}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.emptyListText}>{empty}</Text>
      )}
    </View>
  );
}

export default function EarningsPerformanceScreen() {
  const [analysis, setAnalysis] = useState<EarningsPerformanceAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadAnalysis() {
    try {
      setLoading(true);
      const response = await getEarningsPerformanceAnalysis();
      setAnalysis(response);
    } catch (error) {
      console.log('Erro ao carregar desempenho de ganhos:', error);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadAnalysis();
    }, []),
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#22C55E" />
        <Text style={styles.loadingText}>Analisando seus dias disponíveis...</Text>
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="analytics-outline" size={32} color="#A1A1AA" />
        </View>
        <Text style={styles.emptyTitle}>Não foi possível carregar</Text>
        <Text style={styles.emptyText}>
          Tente novamente em alguns instantes ou confira se existem ganhos, jornadas e despesas cadastrados.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadAnalysis}>
          <Ionicons name="refresh-outline" size={18} color="#06130B" />
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const overall = analysis.overall;
  const hourStatusLabel = getMetricStatusLabel(analysis.hourStatus);
  const kmStatusLabel = getMetricStatusLabel(analysis.kmStatus);
  const hourStatusColor = getStatusColor(analysis.hourStatus);
  const kmStatusColor = getStatusColor(analysis.kmStatus);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.headerEyebrow}>
              {analysis.usesAvailableDays
                ? `${analysis.periodDays} dia(s) com dados`
                : `Últimos ${analysis.maxPeriodDays} dias`}
            </Text>
            <Text style={styles.headerTitle}>Desempenho dos ganhos</Text>
          </View>
        </View>

        <View
          style={[
            styles.heroCard,
            { backgroundColor: overall.backgroundColor, borderColor: overall.borderColor },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={[styles.heroIconBox, { backgroundColor: `${overall.color}20` }]}>
              <Ionicons
                name={overall.iconName as keyof typeof Ionicons.glyphMap}
                size={31}
                color={overall.color}
              />
            </View>

            <View style={[styles.heroBadge, { backgroundColor: `${overall.color}20`, borderColor: `${overall.color}45` }]}>
              <Text style={[styles.heroBadgeText, { color: overall.color }]}>
                {analysis.earningsPerformance.name}
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{overall.title}</Text>
          <Text style={styles.heroText}>{overall.message}</Text>

          <View style={styles.recommendationBox}>
            <View style={styles.recommendationIcon}>
              <Ionicons name="bulb-outline" size={18} color="#FACC15" />
            </View>
            <Text style={styles.recommendationText}>{overall.recommendation}</Text>
          </View>
        </View>

        <View style={styles.periodCard}>
          <Ionicons name="calendar-outline" size={18} color="#22C55E" />
          <Text style={styles.periodText}>
            {analysis.usesAvailableDays
              ? `Análise baseada em ${analysis.periodDays} dia(s) com dados, de ${formatDate(
                  analysis.startDate,
                )} até ${formatDate(analysis.endDate)}`
              : `Análise dos últimos ${analysis.maxPeriodDays} dias, de ${formatDate(
                  analysis.startDate,
                )} até ${formatDate(analysis.endDate)}`}
          </Text>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard
            icon="cash-outline"
            label="Faturamento"
            value={`R$ ${formatCurrency(analysis.revenue)}`}
            subtitle="Ganhos totais"
            color="#22C55E"
          />
          <MetricCard
            icon="receipt-outline"
            label="Despesas"
            value={`R$ ${formatCurrency(analysis.expenses)}`}
            subtitle={`${analysis.expensesPercent}% do faturamento`}
            color={analysis.expensesPerformance.color}
          />
          <MetricCard
            icon="wallet-outline"
            label="Lucro"
            value={`R$ ${formatCurrency(analysis.profit)}`}
            subtitle={`${analysis.profitMarginPercent}% de margem`}
            color={analysis.profit >= 0 ? '#22C55E' : '#EF4444'}
          />
          <MetricCard
            icon="calendar-number-outline"
            label="Dias ativos"
            value={`${analysis.activeDays}`}
            subtitle={`Média R$ ${formatCurrency(analysis.averageProfitPerDay)}/dia`}
            color="#60A5FA"
          />
        </View>

        <View style={styles.statusGrid}>
          <StatusCard
            title="Ganho por hora"
            value={`R$ ${formatCurrency(analysis.revenuePerHour)}/h`}
            status={hourStatusLabel}
            target={`Meta: R$ ${formatCurrency(analysis.targets.goodGainPerHour)}/h • mínimo: R$ ${formatCurrency(analysis.targets.badGainPerHour)}/h`}
            color={hourStatusColor}
            icon={getStatusIcon(analysis.hourStatus) as keyof typeof Ionicons.glyphMap}
          />

          <StatusCard
            title="Ganho por km"
            value={`R$ ${formatCurrency(analysis.revenuePerKm)}/km`}
            status={kmStatusLabel}
            target={`Meta: R$ ${formatCurrency(analysis.targets.goodGainPerKm)}/km • mínimo: R$ ${formatCurrency(analysis.targets.badGainPerKm)}/km`}
            color={kmStatusColor}
            icon={getStatusIcon(analysis.kmStatus) as keyof typeof Ionicons.glyphMap}
          />
        </View>

        <View style={styles.analysisCard}>
          <View style={styles.sectionHeaderRow}>
            <View
              style={[
                styles.sectionIconBox,
                {
                  backgroundColor: `${analysis.earningsPerformance.color}1F`,
                  borderColor: `${analysis.earningsPerformance.color}45`,
                },
              ]}
            >
              <Ionicons
                name={analysis.earningsPerformance.iconName as keyof typeof Ionicons.glyphMap}
                size={18}
                color={analysis.earningsPerformance.color}
              />
            </View>
            <Text style={styles.sectionTitle}>Ganhos: {analysis.earningsPerformance.name}</Text>
          </View>
          <Text style={styles.analysisText}>{analysis.earningsPerformance.message}</Text>
        </View>

        <View style={styles.analysisCard}>
          <View style={styles.sectionHeaderRow}>
            <View
              style={[
                styles.sectionIconBox,
                {
                  backgroundColor: `${analysis.expensesPerformance.color}1F`,
                  borderColor: `${analysis.expensesPerformance.color}45`,
                },
              ]}
            >
              <Ionicons
                name={analysis.expensesPerformance.iconName as keyof typeof Ionicons.glyphMap}
                size={18}
                color={analysis.expensesPerformance.color}
              />
            </View>
            <Text style={styles.sectionTitle}>{analysis.expensesPerformance.name}</Text>
          </View>
          <Text style={styles.analysisText}>{analysis.expensesPerformance.message}</Text>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard
            icon="time-outline"
            label="Tempo trabalhado"
            value={formatHours(analysis.totalHours)}
            subtitle={`${analysis.sessionCount} jornada(s)`}
            color="#A78BFA"
          />
          <MetricCard
            icon="speedometer-outline"
            label="KM rodados"
            value={`${formatNumber(analysis.totalKm)} km`}
            subtitle="Baseado nas jornadas"
            color="#38BDF8"
          />
          <MetricCard
            icon="add-circle-outline"
            label="Ganhos avulsos"
            value={`R$ ${formatCurrency(analysis.standaloneRevenue)}`}
            subtitle="Fora de jornadas"
            color="#FACC15"
          />
          <MetricCard
            icon="briefcase-outline"
            label="Ganhos em jornada"
            value={`R$ ${formatCurrency(analysis.sessionRevenue)}`}
            subtitle="Vinculados aos turnos"
            color="#22C55E"
          />
        </View>

        <TextListCard
          title="Pontos fortes"
          icon="checkmark-circle-outline"
          color="#22C55E"
          items={analysis.strengths}
          empty="Ainda não encontrei pontos fortes suficientes. Cadastre mais jornadas e despesas para melhorar a análise."
        />

        <TextListCard
          title="Pontos de atenção"
          icon="warning-outline"
          color="#FACC15"
          items={analysis.alerts}
          empty="Nenhum alerta importante encontrado nos dias analisados."
        />

        <View style={styles.logicCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBox, { backgroundColor: 'rgba(96,165,250,0.15)', borderColor: 'rgba(96,165,250,0.32)' }]}>
              <Ionicons name="git-compare-outline" size={18} color="#60A5FA" />
            </View>
            <Text style={styles.sectionTitle}>Como o app avaliou</Text>
          </View>

          <View style={styles.logicRow}>
            <Text style={styles.logicLabel}>Ganhos</Text>
            <Text style={[styles.logicValue, { color: analysis.earningsPerformance.color }]}>
              {analysis.earningsPerformance.name}
            </Text>
          </View>

          <View style={styles.logicRow}>
            <Text style={styles.logicLabel}>Despesas</Text>
            <Text style={[styles.logicValue, { color: analysis.expensesPerformance.color }]}>
              {analysis.expensesPerformance.name}
            </Text>
          </View>

          <View style={styles.logicRow}>
            <Text style={styles.logicLabel}>Resultado final</Text>
            <Text style={[styles.logicValue, { color: overall.color }]}>{overall.title}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  container: {
    flex: 1,
  },

  content: {
    padding: 18,
    paddingBottom: 36,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  loadingText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 12,
    textAlign: 'center',
  },

  emptyIconBox: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  emptyText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
  },

  retryButton: {
    height: 48,
    borderRadius: 17,
    backgroundColor: '#22C55E',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 18,
  },

  retryButtonText: {
    color: '#06130B',
    fontSize: 13,
    fontWeight: '900',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerEyebrow: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },

  heroCard: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },

  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  heroIconBox: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroBadge: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },

  heroText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 10,
  },

  recommendationBox: {
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  recommendationIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(250,204,21,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  recommendationText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },

  periodCard: {
    minHeight: 46,
    borderRadius: 17,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },

  periodText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
  },

  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },

  metricCard: {
    width: '48.5%',
    minHeight: 128,
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 13,
  },

  metricIconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  metricLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  metricValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 6,
  },

  metricSubtitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
    marginTop: 5,
  },

  statusGrid: {
    gap: 10,
    marginBottom: 14,
  },

  statusCard: {
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
  },

  statusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  statusIconBox: {
    width: 40,
    height: 40,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusBadge: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },

  statusTitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '900',
  },

  statusValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },

  statusTarget: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 6,
    lineHeight: 16,
  },

  analysisCard: {
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
    marginBottom: 14,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 10,
  },

  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  analysisText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },

  textListCard: {
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
    marginBottom: 14,
  },

  textListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginBottom: 9,
  },

  textListDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginTop: 6,
  },

  textListText: {
    flex: 1,
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },

  emptyListText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },

  logicCard: {
    borderRadius: 24,
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
  },

  logicRow: {
    minHeight: 42,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  logicLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
  },

  logicValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '900',
  },
});
