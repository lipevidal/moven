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

function getPointMetricStatusLabel(status: string) {
  if (status === 'above') return 'Bom';
  if (status === 'intermediate') return 'Intermediário';
  if (status === 'below') return 'Ruim';

  return 'Sem dados';
}

function getMetricPoints(status: string) {
  if (status === 'above') return 100;
  if (status === 'intermediate') return 50;
  if (status === 'below') return 10;

  return 0;
}

function getExpensesPoints(expensesPercent: number) {
  const percent = Number(expensesPercent ?? 0);

  if (percent <= 20) return 100;
  if (percent <= 30) return 80;
  if (percent <= 40) return 50;
  if (percent <= 50) return 30;

  return 10;
}

function getExpensesPointLabel(expensesPercent: number) {
  const percent = Number(expensesPercent ?? 0);

  if (percent <= 20) return 'Bom';
  if (percent <= 30) return 'Controlado';
  if (percent <= 40) return 'Intermediário';
  if (percent <= 50) return 'Atenção';

  return 'Ruim';
}

function getExpensesPointColor(expensesPercent: number) {
  const percent = Number(expensesPercent ?? 0);

  if (percent <= 30) return '#22C55E';
  if (percent <= 50) return '#FACC15';

  return '#EF4444';
}

function getScoreLevel(totalPoints: number) {
  if (totalPoints <= 100) return 'bad';
  if (totalPoints <= 200) return 'intermediate';

  return 'good';
}

function getScoreColor(level: string) {
  if (level === 'good') return '#22C55E';
  if (level === 'intermediate') return '#FACC15';

  return '#EF4444';
}

function getScoreIcon(level: string) {
  if (level === 'good') return 'checkmark-circle-outline';
  if (level === 'intermediate') return 'alert-circle-outline';

  return 'warning-outline';
}

function getScoreBadge(level: string) {
  if (level === 'good') return 'Bom';
  if (level === 'intermediate') return 'Intermediário';

  return 'Ruim';
}

function buildScorePerformanceInfo(analysis: EarningsPerformanceAnalysis) {
  const hourPoints = getMetricPoints(analysis.hourStatus);
  const kmPoints = getMetricPoints(analysis.kmStatus);
  const expensesPoints = getExpensesPoints(analysis.expensesPercent);
  const totalPoints = hourPoints + kmPoints + expensesPoints;
  const progressPercent = Math.round((totalPoints / 300) * 100);
  const level = getScoreLevel(totalPoints);
  const color = getScoreColor(level);
  const expenseColor = getExpensesPointColor(analysis.expensesPercent);

  const hourLabel = getPointMetricStatusLabel(analysis.hourStatus);
  const kmLabel = getPointMetricStatusLabel(analysis.kmStatus);
  const expenseLabel = getExpensesPointLabel(analysis.expensesPercent);

  const positiveItems: string[] = [];
  const improvementItems: string[] = [];

  if (analysis.hourStatus === 'above') {
    positiveItems.push(
      `Seu ganho por hora está bom: R$ ${formatCurrency(
        analysis.revenuePerHour,
      )}/h, dentro ou acima da meta definida por você.`,
    );
  } else if (analysis.hourStatus === 'intermediate') {
    positiveItems.push(
      `Seu ganho por hora está próximo do aceitável: R$ ${formatCurrency(
        analysis.revenuePerHour,
      )}/h.`,
    );
    improvementItems.push(
      'Aumente o ganho por hora priorizando horários, regiões e plataformas que pagam melhor.',
    );
  } else {
    improvementItems.push(
      `Seu ganho por hora está ruim: R$ ${formatCurrency(
        analysis.revenuePerHour,
      )}/h. Reveja horários, regiões, tempo parado e corridas de baixo retorno.`,
    );
  }

  if (analysis.kmStatus === 'above') {
    positiveItems.push(
      `Seu ganho por km está bom: R$ ${formatCurrency(
        analysis.revenuePerKm,
      )}/km, dentro ou acima da meta definida por você.`,
    );
  } else if (analysis.kmStatus === 'intermediate') {
    positiveItems.push(
      `Seu ganho por km está em uma faixa intermediária: R$ ${formatCurrency(
        analysis.revenuePerKm,
      )}/km.`,
    );
    improvementItems.push(
      'Melhore o ganho por km evitando deslocamentos longos sem retorno e corridas que pagam pouco pela distância.',
    );
  } else {
    improvementItems.push(
      `Seu ganho por km está ruim: R$ ${formatCurrency(
        analysis.revenuePerKm,
      )}/km. Evite corridas longas com baixa tarifa e reduza deslocamentos vazios.`,
    );
  }

  if (analysis.expensesPercent <= 20) {
    positiveItems.push(
      `Suas despesas estão muito bem controladas: ${analysis.expensesPercent}% do faturamento.`,
    );
  } else if (analysis.expensesPercent <= 30) {
    positiveItems.push(
      `Suas despesas ainda estão controladas: ${analysis.expensesPercent}% do faturamento.`,
    );
  } else if (analysis.expensesPercent <= 40) {
    improvementItems.push(
      `Suas despesas estão em nível intermediário: ${analysis.expensesPercent}% do faturamento. Acompanhe combustível, manutenção e custos fixos.`,
    );
  } else if (analysis.expensesPercent <= 50) {
    improvementItems.push(
      `Suas despesas estão altas: ${analysis.expensesPercent}% do faturamento. Reduza custos antes que o lucro fique comprometido.`,
    );
  } else {
    improvementItems.push(
      `Suas despesas estão muito altas: ${analysis.expensesPercent}% do faturamento. Essa deve ser uma das principais prioridades de melhoria.`,
    );
  }

  if (positiveItems.length === 0) {
    positiveItems.push(
      'Ainda não há pontos positivos suficientes na análise. O foco agora deve ser corrigir os indicadores mais fracos.',
    );
  }

  if (improvementItems.length === 0) {
    improvementItems.push(
      'Mantenha a estratégia atual e continue acompanhando os indicadores para não deixar custos e ganhos saírem do controle.',
    );
  }

  const title =
    level === 'good'
      ? 'Seu desempenho está bom'
      : level === 'intermediate'
        ? 'Seu desempenho está intermediário'
        : 'Seu desempenho está ruim';

  const message =
    level === 'good'
      ? `Seu progresso geral ficou em ${progressPercent}%. Os ganhos por hora, ganhos por km e despesas estão formando uma operação saudável.`
      : level === 'intermediate'
        ? `Seu progresso geral ficou em ${progressPercent}%. Existem pontos positivos, mas alguns indicadores ainda precisam de ajuste para a operação compensar melhor.`
        : `Seu progresso geral ficou em ${progressPercent}%. A operação está em alerta e precisa de ajustes nos indicadores mais fracos.`;

  const recommendation =
    level === 'good'
      ? 'Continue mantendo o controle dos custos e priorizando as corridas que fortalecem seu ganho por hora e por km.'
      : level === 'intermediate'
        ? 'Mantenha o que está funcionando, mas corrija os pontos de atenção para passar para uma operação realmente boa.'
        : 'Priorize imediatamente os pontos de melhoria: ganho por hora, ganho por km e percentual de despesas sobre o faturamento.';

  const gainsMessage = `Ganho por hora: ${hourLabel}. Ganho por km: ${kmLabel}. Esses dois indicadores usam as metas de ganho bom e ganho ruim que você definiu nos parâmetros.`;

  const expensesMessage = `Despesas sobre faturamento: ${expenseLabel}. Suas despesas representam ${analysis.expensesPercent}% do faturamento. Esse indicador mostra quanto do que você ganhou foi consumido pelos custos da operação e ajuda a entender se o lucro está sendo preservado ou se precisa de ajuste.`;

  return {
    totalPoints,
    progressPercent,
    level,
    color,
    expenseColor,
    title,
    message,
    recommendation,
    badge: getScoreBadge(level),
    icon: getScoreIcon(level),
    hourLabel,
    kmLabel,
    expenseLabel,
    positiveItems,
    improvementItems,
    gainsMessage,
    expensesMessage,
  };
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
        <ActivityIndicator color="#D4A64A" />
        <Text style={styles.loadingText}>Analisando seus dias disponíveis...</Text>
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="analytics-outline" size={32} color="#9B969B" />
        </View>
        <Text style={styles.emptyTitle}>Não foi possível carregar</Text>
        <Text style={styles.emptyText}>
          Tente novamente em alguns instantes ou confira se existem ganhos, jornadas e despesas cadastrados.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadAnalysis}>
          <Ionicons name="refresh-outline" size={18} color="#080808" />
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scoreInfo = buildScorePerformanceInfo(analysis);
  const hourStatusLabel = scoreInfo.hourLabel;
  const kmStatusLabel = scoreInfo.kmLabel;
  const hourStatusColor = getStatusColor(analysis.hourStatus);
  const kmStatusColor = getStatusColor(analysis.kmStatus);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <View style={styles.header}>

          <View style={styles.headerTitleRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerEyebrow}>
                {analysis.usesAvailableDays
                  ? `${analysis.periodDays} dia(s) com dados`
                  : `Últimos ${analysis.maxPeriodDays} dias`}
              </Text>
              <Text style={styles.headerTitle}>Desempenho dos ganhos</Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.heroCard,
            { borderColor: `${scoreInfo.color}55` },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={[styles.heroIconBox, { backgroundColor: `${scoreInfo.color}20` }]}>
              <Ionicons
                name={scoreInfo.icon as keyof typeof Ionicons.glyphMap}
                size={31}
                color={scoreInfo.color}
              />
            </View>

            <View style={[styles.heroBadge, { backgroundColor: `${scoreInfo.color}20`, borderColor: `${scoreInfo.color}45` }]}>
              <Text style={[styles.heroBadgeText, { color: scoreInfo.color }]}>
                {scoreInfo.badge}
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{scoreInfo.title}</Text>
          <Text style={styles.heroText}>{scoreInfo.message}</Text>

          <View style={styles.scoreProgressBox}>
            <View style={styles.scoreProgressHeader}>
              <Text style={styles.scoreProgressLabel}>Progresso geral</Text>
              <Text style={[styles.scoreProgressPercent, { color: scoreInfo.color }]}>
                {scoreInfo.progressPercent}%
              </Text>
            </View>

            <View style={styles.scoreProgressTrack}>
              <View
                style={[
                  styles.scoreProgressFill,
                  {
                    width: `${scoreInfo.progressPercent}%`,
                    backgroundColor: scoreInfo.color,
                  },
                ]}
              />
            </View>

            <Text style={styles.scoreProgressHint}>
              Calculado por ganho/hora, ganho/km e despesas sobre o faturamento.
            </Text>
          </View>

          <View style={styles.recommendationBox}>
            <View style={styles.recommendationIcon}>
              <Ionicons name="bulb-outline" size={18} color="#FACC15" />
            </View>
            <Text style={styles.recommendationText}>{scoreInfo.recommendation}</Text>
          </View>
        </View>

        <View style={styles.periodCard}>
          <Ionicons name="calendar-outline" size={18} color="#D4A64A" />
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
                  backgroundColor: `${scoreInfo.color}1F`,
                  borderColor: `${scoreInfo.color}45`,
                },
              ]}
            >
              <Ionicons
                name="trending-up-outline"
                size={18}
                color={scoreInfo.color}
              />
            </View>
            <Text style={styles.sectionTitle}>Ganhos por hora e por km</Text>
          </View>
          <Text style={styles.analysisText}>{scoreInfo.gainsMessage}</Text>
        </View>

        <View style={styles.analysisCard}>
          <View style={styles.sectionHeaderRow}>
            <View
              style={[
                styles.sectionIconBox,
                {
                  backgroundColor: `${scoreInfo.expenseColor}1F`,
                  borderColor: `${scoreInfo.expenseColor}45`,
                },
              ]}
            >
              <Ionicons
                name="receipt-outline"
                size={18}
                color={scoreInfo.expenseColor}
              />
            </View>
            <Text style={styles.sectionTitle}>Despesas sobre faturamento</Text>
          </View>
          <Text style={styles.analysisText}>{scoreInfo.expensesMessage}</Text>
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
          title="Pontos positivos"
          icon="checkmark-circle-outline"
          color="#22C55E"
          items={scoreInfo.positiveItems}
          empty="Ainda não encontrei pontos positivos suficientes. Cadastre mais jornadas e despesas para melhorar a análise."
        />

        <TextListCard
          title="Pontos que precisam melhorar"
          icon="warning-outline"
          color={scoreInfo.level === 'bad' ? '#EF4444' : '#FACC15'}
          items={scoreInfo.improvementItems}
          empty="Nenhum ponto crítico encontrado nos dias analisados."
        />

        <View style={styles.logicCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBox, { backgroundColor: 'rgba(96,165,250,0.15)', borderColor: 'rgba(96,165,250,0.32)' }]}>
              <Ionicons name="git-compare-outline" size={18} color="#60A5FA" />
            </View>
            <Text style={styles.sectionTitle}>Como o progresso foi calculado</Text>
          </View>

          <View style={styles.logicRow}>
            <Text style={styles.logicLabel}>Ganho por hora</Text>
            <Text style={[styles.logicValue, { color: hourStatusColor }]}>
              {hourStatusLabel}
            </Text>
          </View>

          <View style={styles.logicRow}>
            <Text style={styles.logicLabel}>Ganho por km</Text>
            <Text style={[styles.logicValue, { color: kmStatusColor }]}>
              {kmStatusLabel}
            </Text>
          </View>

          <View style={styles.logicRow}>
            <Text style={styles.logicLabel}>Despesas/Faturamento</Text>
            <Text style={[styles.logicValue, { color: scoreInfo.expenseColor }]}>
              {scoreInfo.expenseLabel}
            </Text>
          </View>

          <View style={styles.logicRow}>
            <Text style={styles.logicLabel}>Resultado final</Text>
            <Text style={[styles.logicValue, { color: scoreInfo.color }]}>{scoreInfo.title}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 150,
    backgroundColor: '#050505',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyIconBox: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
  },
  retryButton: {
    height: 48,
    borderRadius: 11,
    backgroundColor: '#D4A64A',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 18,
  },
  retryButtonText: {
    color: '#080808',
    fontSize: 13,
    fontWeight: '900',
  },
  header: {
    marginHorizontal: -18,
    marginTop: -48,
    marginBottom: 16,
    paddingTop: 48,
    paddingBottom: 18,
    paddingHorizontal: 18,
    backgroundColor: '#070707',
    borderBottomWidth: 1,
    borderBottomColor: '#211D16',
    zIndex: 20,
    elevation: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEyebrow: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  headerTitle: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
    backgroundColor: '#101014',
    shadowColor: '#D4A64A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.07,
    shadowRadius: 22,
    elevation: 8,
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
    borderRadius: 16,
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
    color: '#F5F0E6',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  heroText: {
    color: '#D8D1C4',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 10,
  },
  recommendationBox: {
    borderRadius: 11,
    backgroundColor: 'rgba(212,166,74,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.18)',
    padding: 12,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  recommendationIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(250,204,21,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationText: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },

  scoreProgressBox: {
    backgroundColor: 'rgba(0,0,0,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },

  scoreProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },

  scoreProgressLabel: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  scoreProgressPercent: {
    fontSize: 18,
    fontWeight: '900',
  },

  scoreProgressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#2A2830',
    overflow: 'hidden',
  },

  scoreProgressFill: {
    height: '100%',
    borderRadius: 999,
  },

  scoreProgressHint: {
    color: '#8F8A91',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
    marginTop: 8,
  },
  periodCard: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  periodText: {
    flex: 1,
    color: '#9B969B',
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
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 13,
  },
  metricIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricLabel: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricValue: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 6,
  },
  metricSubtitle: {
    color: '#8F8A91',
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
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
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
    borderRadius: 12,
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
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '900',
  },
  statusValue: {
    color: '#F5F0E6',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  statusTarget: {
    color: '#8F8A91',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 6,
    lineHeight: 16,
  },
  analysisCard: {
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
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
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },
  analysisText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  textListCard: {
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
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
    color: '#D8D1C4',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  emptyListText: {
    color: '#8F8A91',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  logicCard: {
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 14,
  },
  logicRow: {
    minHeight: 42,
    borderTopWidth: 1,
    borderTopColor: '#2A2830',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  logicLabel: {
    color: '#9B969B',
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
