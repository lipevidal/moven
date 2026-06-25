import { useEffect, useMemo, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
} from 'react-native';

import { router, useLocalSearchParams } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../src/constants/colors';

import { getVehicleDetails } from '../../src/features/vehicles/services/getVehicleDetails';

function getVehicleImage(type: string) {
  switch (type) {
    case 'motorcycle':
      return require('../../assets/vehicles/motorcycle.png');

    case 'utility':
      return require('../../assets/vehicles/utility.png');

    default:
      return require('../../assets/vehicles/car.png');
  }
}

function getVehicleTypeLabel(type?: string) {
  switch (type) {
    case 'motorcycle':
      return 'Moto';

    case 'utility':
      return 'Utilitário';

    default:
      return 'Carro';
  }
}

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

function formatDate(date?: string | null) {
  if (!date) return '--/--/----';

  return new Date(date).toLocaleDateString('pt-BR');
}

function getCategoryIcon(category?: string) {
  const normalized = String(category ?? '').toLowerCase();

  if (normalized.includes('combust')) return 'flame-outline';
  if (normalized.includes('manuten')) return 'construct-outline';
  if (normalized.includes('financ')) return 'card-outline';
  if (normalized.includes('lavagem')) return 'water-outline';
  if (normalized.includes('seguro')) return 'shield-checkmark-outline';
  if (normalized.includes('imposto') || normalized.includes('ipva')) return 'document-text-outline';
  if (normalized.includes('pneu')) return 'ellipse-outline';
  if (normalized.includes('óleo') || normalized.includes('oleo')) return 'color-fill-outline';

  return 'receipt-outline';
}

function getCategoryColor(index: number) {
  const palette = [
    '#22C55E',
    '#3B82F6',
    '#F59E0B',
    '#A855F7',
    '#EF4444',
    '#06B6D4',
    '#84CC16',
    '#F97316',
  ];

  return palette[index % palette.length];
}

export default function VehicleDetailsScreen() {
  const { id } = useLocalSearchParams();

  const [vehicle, setVehicle] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (id) {
      loadDetails(String(id));
    }
  }, [id]);

  async function loadDetails(vehicleId: string) {
    try {
      const response = await getVehicleDetails(vehicleId);

      setVehicle(response.vehicle);
      setSessions(response.sessions);
      setExpenses(response.expenses);
    } catch (error) {
      console.log(error);
    }
  }

  const totalRevenue = sessions.reduce((total, session) => {
    const sessionRevenue =
      session.earnings?.reduce(
        (sum: number, earning: any) => sum + Number(earning.amount),
        0,
      ) ?? 0;

    return total + sessionRevenue;
  }, 0);

  const totalExpenses = expenses.reduce(
    (total, expense) => total + Number(expense.amount),
    0,
  );

  const profit = totalRevenue - totalExpenses;

  const expensePercentage =
    totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;

  const expensesByCategory = expenses.reduce((acc: any, expense) => {
    acc[expense.category] =
      (acc[expense.category] ?? 0) + Number(expense.amount);

    return acc;
  }, {});

  const sortedExpenseCategories = useMemo(() => {
    return Object.entries(expensesByCategory).sort(
      ([, amountA]: any, [, amountB]: any) => Number(amountB) - Number(amountA),
    );
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    const term = search.toLowerCase().trim();

    if (!term) return expenses;

    return expenses.filter(
      (expense) =>
        expense.description?.toLowerCase().includes(term) ||
        expense.location?.toLowerCase().includes(term) ||
        expense.category?.toLowerCase().includes(term),
    );
  }, [expenses, search]);

  if (!vehicle) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIconBox}>
          <Ionicons name="car-sport-outline" size={34} color="#22C55E" />
        </View>

        <Text style={styles.loadingText}>Carregando veículo...</Text>
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
          activeOpacity={0.85}
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerEyebrow}>Gestão do veículo</Text>
          <Text style={styles.headerTitle}>Detalhes</Text>
        </View>

        <View style={styles.headerIconButton}>
          <Ionicons name="analytics-outline" size={22} color="#22C55E" />
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />

        <View style={styles.vehicleImageBox}>
          <Image
            source={getVehicleImage(vehicle.type)}
            style={styles.vehicleImage}
          />
        </View>

        <View style={styles.vehicleInfo}>
          <View style={styles.vehicleTypeBadge}>
            <Ionicons name="car-sport-outline" size={14} color="#8BFFBF" />
            <Text style={styles.vehicleTypeBadgeText}>
              {getVehicleTypeLabel(vehicle.type)}
            </Text>
          </View>

          <Text style={styles.vehicleTitle} numberOfLines={2}>
            {vehicle.brand} {vehicle.model}
          </Text>

          <View style={styles.vehicleMetaRow}>
            <View style={styles.plateBadge}>
              <Text style={styles.plateText}>{vehicle.plate}</Text>
            </View>

            {!!vehicle.year && (
              <View style={styles.yearBadge}>
                <Text style={styles.yearText}>{vehicle.year}</Text>
              </View>
            )}
          </View>

          <View style={styles.kmRow}>
            <Ionicons name="speedometer-outline" size={18} color="#A1A1AA" />
            <Text style={styles.vehicleKm}>
              {Number(vehicle.current_km).toLocaleString('pt-BR')} km atuais
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <View style={styles.metricTopRow}>
            <View style={styles.metricIconGreen}>
              <Ionicons name="cash-outline" size={22} color="#22C55E" />
            </View>

            <Text style={styles.metricLabel}>Faturamento</Text>
          </View>

          <Text style={styles.metricValueGreen}>
            R$ {formatCurrency(totalRevenue)}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricTopRow}>
            <View style={styles.metricIconRed}>
              <Ionicons name="card-outline" size={22} color="#EF4444" />
            </View>

            <Text style={styles.metricLabel}>Despesas</Text>
          </View>

          <Text style={styles.metricValueRed}>
            R$ {formatCurrency(totalExpenses)}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricTopRow}>
            <View style={styles.metricIconBlue}>
              <Ionicons name="trending-up-outline" size={22} color="#3B82F6" />
            </View>

            <Text style={styles.metricLabel}>Lucro</Text>
          </View>

          <Text
            style={[
              styles.metricValueWhite,
              profit < 0 && styles.metricValueRedText,
            ]}
          >
            R$ {formatCurrency(profit)}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricTopRow}>
            <View style={styles.metricIconOrange}>
              <Ionicons name="pie-chart-outline" size={22} color="#F59E0B" />
            </View>

            <Text style={styles.metricLabel}>Despesa/Fat.</Text>
          </View>

          <Text style={styles.metricValueOrange}>
            {Math.round(expensePercentage)}%
          </Text>
        </View>
      </View>

      <View style={styles.performanceCard}>
        <View style={styles.performanceHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.performanceTitle}>Saúde financeira</Text>
            <Text style={styles.performanceSubtitle}>
              Quanto do faturamento virou despesa
            </Text>
          </View>

          <View
            style={[
              styles.performanceStatusBadge,
              expensePercentage > 60 && styles.performanceStatusBadgeDanger,
            ]}
          >
            <Text
              style={[
                styles.performanceStatusText,
                expensePercentage > 60 && styles.performanceStatusTextDanger,
              ]}
            >
              {expensePercentage > 60 ? 'Atenção' : 'Controlado'}
            </Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              expensePercentage > 60 && styles.progressFillDanger,
              {
                width: `${Math.min(expensePercentage, 100)}%`,
              },
            ]}
          />
        </View>

        <View style={styles.performanceFooter}>
          <Text style={styles.performanceFooterText}>
            {formatNumber(sessions.length)} jornadas
          </Text>

          <View style={styles.performanceFooterDot} />

          <Text style={styles.performanceFooterText}>
            {formatNumber(expenses.length)} despesas
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Despesas por categoria</Text>
          <Text style={styles.sectionSubtitle}>
            Principais custos deste veículo
          </Text>
        </View>
      </View>

      <View style={styles.categoryCard}>
        {sortedExpenseCategories.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="receipt-outline" size={30} color="#71717A" />
            </View>

            <Text style={styles.emptyTitle}>Nenhuma despesa registrada</Text>
            <Text style={styles.emptyText}>
              Quando você lançar despesas para este veículo, elas aparecerão aqui.
            </Text>
          </View>
        ) : (
          sortedExpenseCategories.map(([category, amount]: any, index) => {
            const percentage =
              totalExpenses > 0 ? (Number(amount) / totalExpenses) * 100 : 0;

            const categoryColor = getCategoryColor(index);

            return (
              <View key={category} style={styles.categoryItem}>
                <View style={styles.categoryTop}>
                  <View style={styles.categoryLeft}>
                    <View
                      style={[
                        styles.categoryIconBox,
                        { backgroundColor: `${categoryColor}24` },
                      ]}
                    >
                      <Ionicons
                        name={getCategoryIcon(category) as any}
                        size={20}
                        color={categoryColor}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.categoryName} numberOfLines={1}>
                        {category}
                      </Text>

                      <Text style={styles.categoryPercent}>
                        {Math.round(percentage)}% das despesas
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.categoryValue}>
                    R$ {formatCurrency(Number(amount))}
                  </Text>
                </View>

                <View style={styles.categoryTrack}>
                  <View
                    style={[
                      styles.categoryFill,
                      {
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: categoryColor,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Lista de despesas</Text>
          <Text style={styles.sectionSubtitle}>
            Busque por descrição, local ou categoria
          </Text>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{filteredExpenses.length}</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#71717A" />

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar despesa"
          placeholderTextColor="#71717A"
          style={styles.searchInput}
        />

        {!!search && (
          <TouchableOpacity activeOpacity={0.85} onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color="#71717A" />
          </TouchableOpacity>
        )}
      </View>

      {filteredExpenses.length === 0 ? (
        <View style={styles.emptyListBox}>
          <Ionicons name="search-outline" size={30} color="#71717A" />
          <Text style={styles.emptyTitle}>Nenhuma despesa encontrada</Text>
          <Text style={styles.emptyText}>
            Tente buscar por outro termo ou verifique se existem despesas lançadas.
          </Text>
        </View>
      ) : (
        filteredExpenses.map((expense) => {
          const categoryIndex = sortedExpenseCategories.findIndex(
            ([category]) => category === expense.category,
          );
          const categoryColor = getCategoryColor(Math.max(categoryIndex, 0));

          return (
            <View key={expense.id} style={styles.expenseCard}>
              <View
                style={[
                  styles.expenseIconBox,
                  { backgroundColor: `${categoryColor}24` },
                ]}
              >
                <Ionicons
                  name={getCategoryIcon(expense.category) as any}
                  size={21}
                  color={categoryColor}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.expenseTitle} numberOfLines={1}>
                  {expense.description || 'Despesa sem descrição'}
                </Text>

                <View style={styles.expenseMetaRow}>
                  <Text style={styles.expenseCategory} numberOfLines={1}>
                    {expense.category}
                  </Text>

                  <View style={styles.expenseDot} />

                  <Text style={styles.expenseDate}>
                    {formatDate(expense.expense_date)}
                  </Text>
                </View>

                {!!expense.location && (
                  <View style={styles.expenseLocationRow}>
                    <Ionicons name="location-outline" size={14} color="#71717A" />
                    <Text style={styles.expenseLocation} numberOfLines={1}>
                      {expense.location}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.expenseCardValue}>
                R$ {formatCurrency(Number(expense.amount))}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  loadingIconBox: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: '#102A1A',
    borderWidth: 1,
    borderColor: '#14532D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 140,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
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

  headerTitleBlock: {
    flex: 1,
  },

  headerEyebrow: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },

  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#102A1A',
    borderWidth: 1,
    borderColor: '#14532D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroCard: {
    minHeight: 178,
    backgroundColor: '#0D1117',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },

  heroGlow: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    opacity: 0.08,
    right: -60,
    top: -50,
  },

  vehicleImageBox: {
    width: 116,
    height: 116,
    borderRadius: 28,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },

  vehicleImage: {
    width: 105,
    height: 82,
    resizeMode: 'contain',
  },

  vehicleInfo: {
    flex: 1,
  },

  vehicleTypeBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#052E1A',
    borderWidth: 1,
    borderColor: '#14532D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },

  vehicleTypeBadgeText: {
    color: '#8BFFBF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  vehicleTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
  },

  vehicleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },

  plateBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  plateText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },

  yearBadge: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  yearText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '900',
  },

  kmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
  },

  vehicleKm: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '800',
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },

  metricCard: {
    width: '48%',
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },

  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },

  metricIconGreen: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#052E1A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  metricIconRed: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#2A0D0D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  metricIconBlue: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#0B1F3A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  metricIconOrange: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#2A1A05',
    alignItems: 'center',
    justifyContent: 'center',
  },

  metricLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },

  metricValueGreen: {
    color: '#22C55E',
    fontSize: 19,
    fontWeight: '900',
  },

  metricValueRed: {
    color: '#EF4444',
    fontSize: 19,
    fontWeight: '900',
  },

  metricValueRedText: {
    color: '#EF4444',
  },

  metricValueWhite: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },

  metricValueOrange: {
    color: '#F59E0B',
    fontSize: 19,
    fontWeight: '900',
  },

  performanceCard: {
    backgroundColor: '#18181B',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 18,
    marginBottom: 24,
  },

  performanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },

  performanceTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  performanceSubtitle: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  performanceStatusBadge: {
    backgroundColor: '#052E1A',
    borderWidth: 1,
    borderColor: '#14532D',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  performanceStatusBadgeDanger: {
    backgroundColor: '#2A0D0D',
    borderColor: '#7F1D1D',
  },

  performanceStatusText: {
    color: '#8BFFBF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  performanceStatusTextDanger: {
    color: '#FCA5A5',
  },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#27272A',
    overflow: 'hidden',
    marginTop: 18,
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 999,
  },

  progressFillDanger: {
    backgroundColor: '#EF4444',
  },

  performanceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },

  performanceFooterText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
  },

  performanceFooterDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#52525B',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },

  sectionSubtitle: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  categoryCard: {
    backgroundColor: '#111827',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 24,
  },

  categoryItem: {
    marginBottom: 16,
  },

  categoryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
    alignItems: 'center',
  },

  categoryLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  categoryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  categoryName: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },

  categoryPercent: {
    color: '#71717A',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 2,
  },

  categoryValue: {
    color: '#E5E7EB',
    fontWeight: '900',
    fontSize: 13,
  },

  categoryTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#27272A',
    overflow: 'hidden',
  },

  categoryFill: {
    height: '100%',
    borderRadius: 999,
  },

  countBadge: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  searchBox: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },

  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  expenseCard: {
    backgroundColor: '#18181B',
    borderRadius: 22,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },

  expenseIconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  expenseTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  expenseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 5,
  },

  expenseCategory: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
    maxWidth: 110,
  },

  expenseDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#52525B',
  },

  expenseDate: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
  },

  expenseLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },

  expenseLocation: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },

  expenseCardValue: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '900',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 16,
  },

  emptyListBox: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 18,
    backgroundColor: '#18181B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
  },

  emptyIconBox: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },

  emptyText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
  },
});
