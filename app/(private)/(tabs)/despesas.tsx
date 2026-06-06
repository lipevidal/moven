import { useEffect, useMemo, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { getExpenses } from '../../../src/features/expenses/services/getExpenses';
import { getRevenueByPeriod } from '../../../src/features/expenses/services/getRevenueByPeriod';
import { getVehicles } from '../../../src/features/vehicles/services/getVehicles';

type PeriodType = 'week' | 'month' | 'general' | 'custom';

const periodOptions: { id: PeriodType; label: string }[] = [
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
  { id: 'general', label: 'Geral' },
  { id: 'custom', label: 'Personalizado' },
];

const expenseCategories = [
  'Manutenção',
  'Lavagem/Limpeza',
  'Borracharia',
  'Alimentação',
  'Combustível',
  'Seguro',
  'Financiamento',
  'Carregamento',
  'Aluguel',
  'Imposto',
  'Multa',
  'Pedágio',
  'Plano de Internet',
  'Aplicativos',
  'Estacionamento',
  'Estoque de Produtos',
  'Aluguel de Garagem',
  'INSS',
  'Imposto de Renda',
  'Outros',
];

const expenseCategoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Manutenção: 'build-outline',
  'Lavagem/Limpeza': 'water-outline',
  Borracharia: 'disc-outline',
  Alimentação: 'restaurant-outline',
  Combustível: 'car-sport-outline',
  Seguro: 'shield-checkmark-outline',
  Financiamento: 'card-outline',
  Carregamento: 'battery-charging-outline',
  Aluguel: 'home-outline',
  Imposto: 'document-text-outline',
  Multa: 'alert-circle-outline',
  Pedágio: 'trail-sign-outline',
  'Plano de Internet': 'wifi-outline',
  Aplicativos: 'phone-portrait-outline',
  Estacionamento: 'car-outline',
  'Estoque de Produtos': 'cube-outline',
  'Aluguel de Garagem': 'business-outline',
  INSS: 'cash-outline',
  'Imposto de Renda': 'receipt-outline',
  Outros: 'ellipsis-horizontal-circle-outline',
};

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('pt-BR');
}

function formatMonth(date: Date) {
  return date.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

function maskDate(text: string) {
  const numbers = text.replace(/\D/g, '').slice(0, 8);

  if (numbers.length > 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4)}`;
  }

  if (numbers.length > 2) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  }

  return numbers;
}

function parseDate(text: string) {
  const [day, month, year] = text.split('/');

  if (!day || !month || !year) return null;

  const date = new Date(Number(year), Number(month) - 1, Number(day));

  if (Number.isNaN(date.getTime())) return null;

  if (
    date.getDate() !== Number(day) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getFullYear() !== Number(year)
  ) {
    return null;
  }

  return date;
}

function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, -1);
}

function getWeekRange(baseDate: Date) {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const start = new Date(date);
  start.setDate(date.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getMonthRange(baseDate: Date) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getWeekLabel(start: Date, end: Date) {
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const months = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Maio',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];

  return `${weekDays[start.getDay()]}, ${start.getDate()} ${
    months[start.getMonth()]
  } - ${weekDays[end.getDay()]}, ${end.getDate()} ${
    months[end.getMonth()]
  }`;
}

export default function ExpensesScreen() {
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [baseDate, setBaseDate] = useState(new Date());

  const [expenses, setExpenses] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  const [filtersModalVisible, setFiltersModalVisible] = useState(false);
  const [periodModalVisible, setPeriodModalVisible] = useState(false);

  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(
    null,
  );

  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [vehicleId, setVehicleId] = useState<string>('todos');
  const [sortType, setSortType] = useState<
    'recent' | 'oldest' | 'highest' | 'lowest'
  >('recent');

  const [customStartDate, setCustomStartDate] = useState(formatDate(new Date()));
  const [customEndDate, setCustomEndDate] = useState(formatDate(new Date()));
  const [customRange, setCustomRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  function getPeriodRange() {
    if (periodType === 'week') {
      return getWeekRange(baseDate);
    }

    if (periodType === 'month') {
      return getMonthRange(baseDate);
    }

    if (periodType === 'custom' && customRange) {
      return customRange;
    }

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const start = new Date();

    if (periodType === 'general') {
      start.setFullYear(start.getFullYear() - 10);
      start.setHours(0, 0, 0, 0);
    }

    if (periodType === 'custom' && !customRange) {
      start.setDate(end.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    }

    return { start, end };
  }

  function getPeriodLabel() {
    const { start, end } = getPeriodRange();

    if (periodType === 'week') {
      return getWeekLabel(start, end);
    }

    if (periodType === 'month') {
      return formatMonth(baseDate);
    }

    if (periodType === 'custom' && customRange) {
      return `${formatDate(customRange.start)} até ${formatDate(
        customRange.end,
      )}`;
    }

    return 'Todas as despesas';
  }

  function goPreviousPeriod() {
    const newDate = new Date(baseDate);

    if (periodType === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    }

    if (periodType === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    }

    setBaseDate(newDate);
  }

  function goNextPeriod() {
    const newDate = new Date(baseDate);

    if (periodType === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    }

    if (periodType === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    }

    setBaseDate(newDate);
  }

  async function loadData() {
    try {
      const { start, end } = getPeriodRange();

      const startDate = toLocalISOString(start);
      const endDate = toLocalISOString(end);

      const [expensesResponse, vehiclesResponse, revenueResponse] =
        await Promise.all([
          getExpenses({
            startDate,
            endDate,
            category: 'Todas',
            vehicleId,
            search: '',
          }),

          getVehicles(),

          getRevenueByPeriod({
            startDate,
            endDate,
            vehicleId,
          }),
        ]);

      setExpenses(expensesResponse);
      setVehicles(vehiclesResponse);
      setTotalRevenue(revenueResponse);
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    loadData();
  }, [periodType, baseDate, customRange, vehicleId]);

  function handleSelectPeriod(type: PeriodType) {
    setPeriodType(type);

    if (type === 'custom') {
      setPeriodModalVisible(true);
    }
  }

  function handleApplyCustomRange() {
    const start = parseDate(customStartDate);
    const end = parseDate(customEndDate);

    if (!start || !end) {
      Alert.alert('Data inválida', 'Informe um período válido.');
      return;
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      Alert.alert(
        'Período inválido',
        'A data inicial não pode ser maior que a data final.',
      );
      return;
    }

    setCustomRange({ start, end });
    setPeriodType('custom');
    setPeriodModalVisible(false);
  }

  const filteredExpenses = useMemo(() => {
    let data = [...expenses];

    if (search.trim()) {
      const term = search.toLowerCase();

      data = data.filter(
        (expense) =>
          expense.description?.toLowerCase().includes(term) ||
          expense.location?.toLowerCase().includes(term),
      );
    }

    if (selectedCategories.length > 0) {
      data = data.filter((expense) =>
        selectedCategories.includes(expense.category),
      );
    }

    if (sortType === 'recent') {
      data.sort(
        (a, b) =>
          new Date(b.expense_date).getTime() -
          new Date(a.expense_date).getTime(),
      );
    }

    if (sortType === 'oldest') {
      data.sort(
        (a, b) =>
          new Date(a.expense_date).getTime() -
          new Date(b.expense_date).getTime(),
      );
    }

    if (sortType === 'highest') {
      data.sort((a, b) => Number(b.amount) - Number(a.amount));
    }

    if (sortType === 'lowest') {
      data.sort((a, b) => Number(a.amount) - Number(b.amount));
    }

    return data;
  }, [expenses, search, selectedCategories, sortType]);

  const totalExpenses = filteredExpenses.reduce(
    (total, expense) => total + Number(expense.amount),
    0,
  );

  const expensesByCategory = filteredExpenses.reduce((acc: any, expense) => {
    acc[expense.category] =
      (acc[expense.category] ?? 0) + Number(expense.amount);

    return acc;
  }, {});

  const chartData = Object.entries(expensesByCategory).map(
    ([category, value]: any) => ({
      category,
      amount: Number(value),
      percentage: totalExpenses > 0 ? (Number(value) / totalExpenses) * 100 : 0,
    }),
  );

  function toggleCategoryFilter(item: string) {
    const selected = selectedCategories.includes(item);

    if (selected) {
      setSelectedCategories((old) =>
        old.filter((category) => category !== item),
      );
      return;
    }

    setSelectedCategories((old) => [...old, item]);
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.title}>Despesas</Text>

            <Text style={styles.subtitle}>
              Controle seus gastos por período
            </Text>
          </View>

          <TouchableOpacity
            style={styles.headerAddButton}
            onPress={() => router.push('/nova-despesa')}
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.periodMenu}>
          {periodOptions.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.periodButton,
                periodType === item.id && styles.periodButtonActive,
              ]}
              onPress={() => handleSelectPeriod(item.id)}
            >
              <Text
                style={[
                  styles.periodText,
                  periodType === item.id && styles.periodTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.periodNavigatorCard}>
          {periodType === 'week' || periodType === 'month' ? (
            <TouchableOpacity
              style={styles.periodArrow}
              onPress={goPreviousPeriod}
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.periodArrow} />
          )}

          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => {
              if (periodType === 'custom') {
                setPeriodModalVisible(true);
              }
            }}
          >
            <Text style={styles.periodNavigatorText}>{getPeriodLabel()}</Text>
          </TouchableOpacity>

          {periodType === 'week' || periodType === 'month' ? (
            <TouchableOpacity style={styles.periodArrow} onPress={goNextPeriod}>
              <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.periodArrow} />
          )}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryLabel}>Total de despesas</Text>

            <View style={styles.revenueBadge}>
              <Text style={styles.revenueBadgeLabel}>Faturamento</Text>

              <Text style={styles.revenueBadgeValue}>
                R$ {formatCurrency(totalRevenue)}
              </Text>
            </View>
          </View>

          <Text style={styles.summaryValue}>R$ {formatCurrency(totalExpenses)}</Text>

          <Text style={styles.summaryInfo}>
            {filteredExpenses.length} despesa
            {filteredExpenses.length === 1 ? '' : 's'}
          </Text>

          {chartData.length > 0 ? (
            <View style={styles.chartContainer}>
              {chartData.map((item) => (
                <View key={item.category} style={styles.chartItem}>
                  <View style={styles.chartHeader}>
                    <View style={styles.chartCategoryRow}>
                      <Ionicons
                        name={
                          expenseCategoryIcons[item.category] ??
                          'pricetag-outline'
                        }
                        size={16}
                        color="#FFFFFF"
                      />

                      <Text style={styles.chartTitle}>{item.category}</Text>
                    </View>

                    <Text style={styles.chartValue}>
                      R$ {formatCurrency(item.amount)} •{' '}
                      {Math.round(item.percentage)}%
                    </Text>
                  </View>

                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(item.percentage, 100)}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.filtersRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por descrição ou local"
            placeholderTextColor="#71717A"
            style={styles.searchInput}
          />

          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setFiltersModalVisible(true)}
          >
            <Ionicons name="options-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {selectedCategories.length > 0 ? (
          <View style={styles.selectedFiltersWrapper}>
            {selectedCategories.map((item) => (
              <View key={item} style={styles.selectedFilterCard}>
                <Ionicons
                  name={expenseCategoryIcons[item] ?? 'pricetag-outline'}
                  size={14}
                  color="#FFFFFF"
                />

                <Text style={styles.selectedFilterText}>{item}</Text>

                <TouchableOpacity onPress={() => toggleCategoryFilter(item)}>
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        {filteredExpenses.map((expense) => (
          <Pressable
            key={String(expense.id)}
            style={styles.expenseCard}
            onPress={() => {
              setExpandedExpenseId((old) =>
                old === String(expense.id) ? null : String(expense.id),
              );
            }}
          >
            <View style={styles.expenseRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.expenseTitle}>{expense.description}</Text>

                <View style={styles.expenseCategoryRow}>
                  <Ionicons
                    name={
                      expenseCategoryIcons[expense.category] ??
                      'pricetag-outline'
                    }
                    size={16}
                    color="#A1A1AA"
                  />

                  <Text style={styles.expenseInfo}>{expense.category}</Text>
                </View>
              </View>

              <Text style={styles.expenseValue}>
                - R$ {formatCurrency(Number(expense.amount))}
              </Text>
            </View>

            {expandedExpenseId === String(expense.id) ? (
              <View style={styles.expenseDetails}>
                <Text style={styles.expenseInfo}>
                  Data: {formatDate(expense.expense_date)}
                </Text>

                {expense.location ? (
                  <Text style={styles.expenseInfo}>
                    Local: {expense.location}
                  </Text>
                ) : null}

                {expense.vehicle ? (
                  <Text style={styles.expenseInfo}>
                    Veículo: {expense.vehicle.brand} {expense.vehicle.model}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={periodModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Período personalizado</Text>

              <TouchableOpacity onPress={() => setPeriodModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={customStartDate}
              onChangeText={(text) => setCustomStartDate(maskDate(text))}
              placeholder="Data inicial"
              placeholderTextColor="#71717A"
              keyboardType="numeric"
              maxLength={10}
              style={styles.input}
            />

            <TextInput
              value={customEndDate}
              onChangeText={(text) => setCustomEndDate(maskDate(text))}
              placeholder="Data final"
              placeholderTextColor="#71717A"
              keyboardType="numeric"
              maxLength={10}
              style={styles.input}
            />

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleApplyCustomRange}
            >
              <Text style={styles.confirmButtonText}>Aplicar período</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={filtersModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filtros</Text>

                <TouchableOpacity onPress={() => setFiltersModalVisible(false)}>
                  <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.filterTitle}>Veículo</Text>

              <View style={styles.filterGrid}>
                <TouchableOpacity
                  style={[
                    styles.filterCard,
                    vehicleId === 'todos' && styles.filterCardActive,
                  ]}
                  onPress={() => setVehicleId('todos')}
                >
                  <Ionicons name="car-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.filterCardText}>Todos</Text>
                </TouchableOpacity>

                {vehicles.map((vehicle) => (
                  <TouchableOpacity
                    key={vehicle.id}
                    style={[
                      styles.filterCard,
                      vehicleId === vehicle.id && styles.filterCardActive,
                    ]}
                    onPress={() => setVehicleId(vehicle.id)}
                  >
                    <Ionicons name="car-sport-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.filterCardText}>
                      {vehicle.model}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.filterTitle, { marginTop: 22 }]}>Ordenar por</Text>

              <View style={styles.filterGrid}>
                {[
                  {
                    id: 'recent',
                    label: 'Mais recente',
                    icon: 'arrow-down-outline',
                  },
                  {
                    id: 'oldest',
                    label: 'Mais antigo',
                    icon: 'arrow-up-outline',
                  },
                  {
                    id: 'highest',
                    label: 'Mais caro',
                    icon: 'trending-up-outline',
                  },
                  {
                    id: 'lowest',
                    label: 'Mais barato',
                    icon: 'trending-down-outline',
                  },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.filterCard,
                      sortType === item.id && styles.filterCardActive,
                    ]}
                    onPress={() => setSortType(item.id as any)}
                  >
                    <Ionicons name={item.icon as any} size={20} color="#FFFFFF" />

                    <Text style={styles.filterCardText}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.filterTitle, { marginTop: 22 }]}>Categorias</Text>

              <View style={styles.filterGrid}>
                {expenseCategories.map((item) => {
                  const selected = selectedCategories.includes(item);

                  return (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.filterCard,
                        selected && styles.filterCardActive,
                      ]}
                      onPress={() => toggleCategoryFilter(item)}
                    >
                      <Ionicons
                        name={expenseCategoryIcons[item] ?? 'pricetag-outline'}
                        size={20}
                        color="#FFFFFF"
                      />

                      <Text style={styles.filterCardText}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 140,
  },

  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 15,
    marginTop: 6,
  },

  headerAddButton: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  periodMenu: {
    flexDirection: 'row',
    backgroundColor: '#0D1117',
    borderRadius: 16,
    padding: 4,
    marginBottom: 14,
  },

  periodButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  periodButtonActive: {
    backgroundColor: '#22C55E',
  },

  periodText: {
    color: '#A1A1AA',
    fontWeight: '700',
    fontSize: 12,
  },

  periodTextActive: {
    color: '#FFFFFF',
  },

  periodNavigatorCard: {
    height: 58,
    backgroundColor: '#09121A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#16212B',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 10,
  },

  periodArrow: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },

  periodNavigatorText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'capitalize',
  },

  summaryCard: {
    backgroundColor: '#111827',
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },

  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  summaryLabel: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '700',
  },

  revenueBadge: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'flex-end',
  },

  revenueBadgeLabel: {
    color: '#86EFAC',
    fontSize: 10,
    fontWeight: '700',
  },

  revenueBadgeValue: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },

  summaryValue: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    marginTop: 6,
  },

  summaryInfo: {
    color: '#71717A',
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
  },

  chartContainer: {
    marginTop: 20,
  },

  chartItem: {
    marginBottom: 14,
  },

  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },

  chartCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },

  chartTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },

  chartValue: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
  },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#27272A',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#EF4444',
  },

  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },

  searchInput: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#1F2937',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '600',
  },

  filterButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedFiltersWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },

  selectedFilterCard: {
    height: 34,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  selectedFilterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  expenseCard: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },

  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },

  expenseTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    flex: 1,
  },

  expenseValue: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 15,
  },

  expenseCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },

  expenseInfo: {
    color: '#A1A1AA',
    fontSize: 13,
  },

  expenseDetails: {
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    marginTop: 14,
    paddingTop: 12,
    gap: 6,
  },

  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },

  modalContent: {
    backgroundColor: '#09121A',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#16212B',
    maxHeight: '85%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },

  input: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#1F2937',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 14,
  },

  confirmButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },

  filterTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 12,
  },

  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  filterCard: {
    width: '48%',
    minHeight: 78,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },

  filterCardActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  filterCardText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
});
