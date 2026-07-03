import { useEffect, useMemo, useRef, useState } from 'react';

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
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalLoading } from '../../../src/components/GlobalLoadingProvider';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { supabase } from '../../../src/database/supabase';
import { getExpenses } from '../../../src/features/expenses/services/getExpenses';
import { getRevenueByPeriod } from '../../../src/features/expenses/services/getRevenueByPeriod';
import { getVehicles } from '../../../src/features/vehicles/services/getVehicles';

LocaleConfig.locales['pt-br'] = {
  monthNames: [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ],
  monthNamesShort: [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ],
  dayNames: [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje',
};

LocaleConfig.defaultLocale = 'pt-br';

type PeriodType = 'week' | 'month' | 'general' | 'custom';

type ExpenseFormErrors = {
  description?: string;
  amount?: string;
  category?: string;
  date?: string;
};

const periodOptions: { id: PeriodType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'week', label: 'Semana', icon: 'calendar-outline' },
  { id: 'month', label: 'Mês', icon: 'calendar-number-outline' },
  { id: 'general', label: 'Geral', icon: 'infinite-outline' },
  { id: 'custom', label: 'Período', icon: 'options-outline' },
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
  Combustível: 'speedometer-outline',
  Seguro: 'shield-checkmark-outline',
  Financiamento: 'card-outline',
  Carregamento: 'battery-charging-outline',
  Aluguel: 'car-outline',
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
  return Number(value ?? 0).toLocaleString('pt-BR', {
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

function maskCurrency(text: string) {
  const numbers = text.replace(/\D/g, '').slice(0, 12);

  if (!numbers) return '';

  const value = Number(numbers) / 100;

  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrency(text: string) {
  const normalized = text.replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);

  return Number.isFinite(value) ? value : 0;
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
  } - ${weekDays[end.getDay()]}, ${end.getDate()} ${months[end.getMonth()]}`;
}

function toCalendarDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseCalendarDate(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function isSameWeek(a: Date, b: Date) {
  const weekA = getWeekRange(a);
  const weekB = getWeekRange(b);

  return toCalendarDateKey(weekA.start) === toCalendarDateKey(weekB.start);
}

function isSameMonth(a: Date, b: Date) {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function generateRecentWeeks(referenceDate: Date, count = 16) {
  const { start } = getWeekRange(referenceDate);

  return Array.from({ length: count }).map((_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() - index * 7);

    const range = getWeekRange(date);

    return {
      id: toCalendarDateKey(range.start),
      date,
      label: getWeekLabel(range.start, range.end),
      start: range.start,
      end: range.end,
    };
  });
}

function generateRecentMonths(referenceDate: Date, count = 18) {
  const monthStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    1,
    12,
    0,
    0,
    0,
  );

  return Array.from({ length: count }).map((_, index) => {
    const date = new Date(monthStart);
    date.setMonth(monthStart.getMonth() - index);

    return {
      id: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      date,
      label: formatMonth(date),
    };
  });
}

function getVehicleLabel(vehicle: any) {
  const brand = String(vehicle?.brand ?? '').trim();
  const model = String(vehicle?.model ?? '').trim();
  const plate = String(vehicle?.plate ?? '').trim().toUpperCase();

  const name = [brand, model].filter(Boolean).join(' ') || 'Veículo';

  return plate ? `${name} • ${plate}` : name;
}


export default function ExpensesScreen() {
  const { withLoading } = useGlobalLoading();
  const params = useLocalSearchParams<{ openExpense?: string; t?: string }>();
  const mainScrollRef = useRef<ScrollView>(null);
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [baseDate, setBaseDate] = useState(new Date());

  const [expenses, setExpenses] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  const [loading, setLoading] = useState(true);
  const [savingExpense, setSavingExpense] = useState(false);

  const [filtersModalVisible, setFiltersModalVisible] = useState(false);
  const [periodModalVisible, setPeriodModalVisible] = useState(false);
  const [periodListModalVisible, setPeriodListModalVisible] = useState(false);
  const [activeDatePicker, setActiveDatePicker] = useState<
    'customStart' | 'customEnd' | 'expense' | null
  >(null);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);

  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [vehicleId, setVehicleId] = useState<string>('todos');
  const [sortType, setSortType] = useState<'recent' | 'oldest' | 'highest' | 'lowest'>('recent');

  const [customStartDate, setCustomStartDate] = useState(formatDate(new Date()));
  const [customEndDate, setCustomEndDate] = useState(formatDate(new Date()));
  const [customRange, setCustomRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseDate, setExpenseDate] = useState(formatDate(new Date()));
  const [expenseLocation, setExpenseLocation] = useState('');
  const [expenseVehicleId, setExpenseVehicleId] = useState('nenhum');
  const [expenseErrors, setExpenseErrors] = useState<ExpenseFormErrors>({});
  const [lastOpenExpenseToken, setLastOpenExpenseToken] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [periodType, baseDate, customRange, vehicleId]),
  );

  useEffect(() => {
    loadData();
  }, [periodType, baseDate, customRange, vehicleId]);


  useEffect(() => {
    if (params.openExpense !== '1') return;

    const token = String(params.t ?? params.openExpense);

    if (!token || token === lastOpenExpenseToken) return;

    setLastOpenExpenseToken(token);
    openCreateExpenseModal();

    // Limpa visualmente os parâmetros para evitar reabrir o modal sem novo clique.
    setTimeout(() => {
      router.setParams({
        openExpense: undefined,
        t: undefined,
      } as any);
    }, 300);
  }, [params.openExpense, params.t, lastOpenExpenseToken]);

  useEffect(() => {
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
    let componentMounted = true;

    async function subscribeToExpenseChanges() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id || !componentMounted) return;

      realtimeChannel = supabase
        .channel(`expenses-screen-sync-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'expenses',
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            await loadData();
          },
        )
        .subscribe();
    }

    subscribeToExpenseChanges();

    return () => {
      componentMounted = false;

      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [periodType, baseDate, customRange, vehicleId]);


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
      return `${formatDate(customRange.start)} até ${formatDate(customRange.end)}`;
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
    await withLoading(async () => {
    try {
      setLoading(true);

      const { start, end } = getPeriodRange();

      const startDate = toLocalISOString(start);
      const endDate = toLocalISOString(end);

      const [expensesResponse, vehiclesResponse, revenueResponse] = await Promise.all([
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

      setExpenses(expensesResponse ?? []);
      setVehicles(vehiclesResponse ?? []);
      setTotalRevenue(Number(revenueResponse ?? 0));
    } catch (error) {
      console.log('Erro ao carregar despesas:', error);
      Alert.alert('Erro', 'Não foi possível carregar suas despesas.');
    } finally {
      setLoading(false);
    }
  
    });
  }

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
      Alert.alert('Período inválido', 'A data inicial não pode ser maior que a data final.');
      return;
    }

    setCustomRange({ start, end });
    setPeriodType('custom');
    setActiveDatePicker(null);
    setPeriodModalVisible(false);
  }

  function openDatePicker(target: 'customStart' | 'customEnd' | 'expense') {
    setActiveDatePicker(target);
  }

  function getActiveCalendarDate() {
    const parsedDate =
      activeDatePicker === 'customStart'
        ? parseDate(customStartDate)
        : activeDatePicker === 'customEnd'
          ? parseDate(customEndDate)
          : activeDatePicker === 'expense'
            ? parseDate(expenseDate)
            : null;

    return parsedDate ?? new Date();
  }

  function handleCalendarDayPress(dateString: string) {
    const selectedDate = parseCalendarDate(dateString);
    const formattedDate = formatDate(selectedDate);

    if (activeDatePicker === 'customStart') {
      setCustomStartDate(formattedDate);
    }

    if (activeDatePicker === 'customEnd') {
      setCustomEndDate(formattedDate);
    }

    if (activeDatePicker === 'expense') {
      setExpenseDate(formattedDate);
      clearExpenseError('date');
    }

    setActiveDatePicker(null);
  }

  function isCurrentListedPeriodSelected() {
    const today = new Date();

    if (periodType === 'week') {
      return isSameWeek(baseDate, today);
    }

    if (periodType === 'month') {
      return isSameMonth(baseDate, today);
    }

    return true;
  }

  function handleGoToCurrentListedPeriod() {
    setBaseDate(new Date());
    setPeriodListModalVisible(false);
  }

  function handleSelectListedPeriod(date: Date) {
    setBaseDate(date);
    setPeriodListModalVisible(false);
  }

  const filteredExpenses = useMemo(() => {
    let data = [...expenses];

    if (search.trim()) {
      const term = search.toLowerCase();

      data = data.filter(
        (expense) =>
          expense.description?.toLowerCase().includes(term) ||
          expense.location?.toLowerCase().includes(term) ||
          expense.category?.toLowerCase().includes(term),
      );
    }

    if (selectedCategories.length > 0) {
      data = data.filter((expense) => selectedCategories.includes(expense.category));
    }

    if (sortType === 'recent') {
      data.sort(
        (a, b) =>
          new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime(),
      );
    }

    if (sortType === 'oldest') {
      data.sort(
        (a, b) =>
          new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime(),
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
    (total, expense) => total + Number(expense.amount ?? 0),
    0,
  );

  const expensePercentageOfRevenue =
    totalRevenue > 0 ? Math.round((totalExpenses / totalRevenue) * 100) : 0;

  const averageExpense =
    filteredExpenses.length > 0 ? totalExpenses / filteredExpenses.length : 0;

  const expensesByCategory = filteredExpenses.reduce((acc: any, expense) => {
    acc[expense.category] = (acc[expense.category] ?? 0) + Number(expense.amount ?? 0);

    return acc;
  }, {});

  const chartData = Object.entries(expensesByCategory)
    .map(([category, value]: any) => ({
      category,
      amount: Number(value),
      percentage: totalExpenses > 0 ? (Number(value) / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const activeFiltersCount =
    selectedCategories.length + (vehicleId !== 'todos' ? 1 : 0) + (search.trim() ? 1 : 0);

  const recentWeeks = useMemo(() => generateRecentWeeks(new Date(), 16), []);
  const recentMonths = useMemo(() => generateRecentMonths(new Date(), 18), []);
  const periodListItems = periodType === 'week' ? recentWeeks : recentMonths;

  function toggleCategoryFilter(item: string) {
    const selected = selectedCategories.includes(item);

    if (selected) {
      setSelectedCategories((old) => old.filter((category) => category !== item));
      return;
    }

    setSelectedCategories((old) => [...old, item]);
  }

  function clearExpenseError(field: keyof ExpenseFormErrors) {
    setExpenseErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  }

  function resetExpenseForm() {
    setActiveDatePicker(null);
    setEditingExpenseId(null);
    setExpenseDescription('');
    setExpenseAmount('');
    setExpenseCategory('');
    setExpenseDate(formatDate(new Date()));
    setExpenseLocation('');
    setExpenseVehicleId('nenhum');
    setExpenseErrors({});
  }

  function openCreateExpenseModal() {
    resetExpenseForm();
    setExpenseModalVisible(true);
  }

  function openEditExpenseModal(expense: any) {
    setActiveDatePicker(null);
    setEditingExpenseId(String(expense.id));
    setExpenseDescription(expense.description ?? '');
    setExpenseAmount(formatCurrency(Number(expense.amount ?? 0)));
    setExpenseCategory(expense.category ?? '');
    setExpenseDate(formatDate(expense.expense_date ?? new Date()));
    setExpenseLocation(expense.location ?? '');
    setExpenseVehicleId(expense.vehicle_id ?? expense.vehicle?.id ?? 'nenhum');
    setExpenseErrors({});
    setExpandedExpenseId(null);
    setExpenseModalVisible(true);
  }

  function validateExpenseForm() {
    const nextErrors: ExpenseFormErrors = {};
    const cleanDescription = expenseDescription.trim();
    const amount = parseCurrency(expenseAmount);
    const parsedDate = parseDate(expenseDate);

    if (!cleanDescription) {
      nextErrors.description = 'Informe uma descrição para a despesa.';
    } else if (cleanDescription.length < 3) {
      nextErrors.description = 'A descrição precisa ter pelo menos 3 caracteres.';
    }

    if (!expenseAmount.trim()) {
      nextErrors.amount = 'Informe o valor da despesa.';
    } else if (amount <= 0) {
      nextErrors.amount = 'O valor precisa ser maior que zero.';
    }

    if (!expenseCategory) {
      nextErrors.category = 'Selecione uma categoria.';
    }

    if (!parsedDate) {
      nextErrors.date = 'Informe uma data válida.';
    } else {
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (parsedDate > today) {
        nextErrors.date = 'A data da despesa não pode ser futura.';
      }
    }

    setExpenseErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function handleSaveExpense() {
    try {
      const valid = validateExpenseForm();

      if (!valid) return;

      setSavingExpense(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user?.id) {
        Alert.alert('Sessão expirada', 'Entre novamente para salvar despesas.');
        return;
      }

      const parsedDate = parseDate(expenseDate);

      if (!parsedDate) return;

      parsedDate.setHours(12, 0, 0, 0);

      const expenseData = {
        description: expenseDescription.trim(),
        amount: parseCurrency(expenseAmount),
        category: expenseCategory,
        expense_date: toLocalISOString(parsedDate),
        location: expenseLocation.trim() || null,
        vehicle_id: expenseVehicleId === 'nenhum' ? null : expenseVehicleId,
      };

      const { error } = editingExpenseId
        ? await supabase
            .from('expenses')
            .update(expenseData)
            .eq('id', editingExpenseId)
            .eq('user_id', user.id)
        : await supabase.from('expenses').insert({
            user_id: user.id,
            ...expenseData,
          });

      if (error) throw error;

      setExpenseModalVisible(false);
      resetExpenseForm();
      await loadData();

      Alert.alert(
        editingExpenseId ? 'Despesa atualizada' : 'Despesa cadastrada',
        editingExpenseId
          ? 'Sua despesa foi atualizada com sucesso.'
          : 'Sua despesa foi adicionada com sucesso.',
      );
    } catch (error: any) {
      console.log('Erro ao salvar despesa:', error);

      const message = String(error?.message ?? '').toLowerCase();

      Alert.alert(
        'Erro ao salvar despesa',
        message.includes('expense_date')
          ? 'Não encontrei a coluna expense_date na tabela expenses. Confira o nome da coluna no Supabase.'
          : message.includes('vehicle_id')
            ? 'Não encontrei a coluna vehicle_id na tabela expenses. Confira a estrutura da tabela no Supabase.'
            : 'Não foi possível salvar a despesa. Confira os dados e tente novamente.',
      );
    } finally {
      setSavingExpense(false);
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    Alert.alert(
      'Excluir despesa',
      'Tem certeza que deseja excluir esta despesa? Essa ação não pode ser desfeita.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const {
                data: { user },
                error: userError,
              } = await supabase.auth.getUser();

              if (userError) throw userError;

              if (!user?.id) {
                Alert.alert('Sessão expirada', 'Entre novamente para excluir despesas.');
                return;
              }

              const { error } = await supabase
                .from('expenses')
                .delete()
                .eq('id', expenseId)
                .eq('user_id', user.id);

              if (error) throw error;

              setExpandedExpenseId(null);
              await loadData();

              Alert.alert('Despesa excluída', 'A despesa foi removida com sucesso.');
            } catch (error) {
              console.log('Erro ao excluir despesa:', error);
              Alert.alert('Erro', 'Não foi possível excluir esta despesa.');
            }
          },
        },
      ],
    );
  }

  function renderInlineCalendar() {
    return (
      <View style={styles.inlineCalendarBox}>
        <View style={styles.inlineCalendarHeader}>
          <Ionicons name="calendar-outline" size={18} color="#22C55E" />
          <Text style={styles.inlineCalendarTitle}>Escolha uma data</Text>
        </View>

        <Calendar
          current={toCalendarDateKey(getActiveCalendarDate())}
          firstDay={1}
          maxDate={toCalendarDateKey(new Date())}
          onDayPress={(day: { dateString: string }) =>
            handleCalendarDayPress(day.dateString)
          }
          markedDates={{
            [toCalendarDateKey(getActiveCalendarDate())]: {
              selected: true,
              selectedColor: '#22C55E',
              selectedTextColor: '#06130B',
            },
          }}
          theme={{
            calendarBackground: '#111827',
            dayTextColor: '#FFFFFF',
            monthTextColor: '#FFFFFF',
            textDisabledColor: '#3F3F46',
            arrowColor: '#22C55E',
            todayTextColor: '#22C55E',
            selectedDayBackgroundColor: '#22C55E',
            selectedDayTextColor: '#06130B',
            textSectionTitleColor: '#A1A1AA',
            textDayFontWeight: '700',
            textMonthFontWeight: '900',
            textDayHeaderFontWeight: '900',
          }}
        />
      </View>
    );
  }

  function clearAllFilters() {
    setSearch('');
    setSelectedCategories([]);
    setVehicleId('todos');
    setSortType('recent');
  }

  return (
    <>
      <KeyboardAvoidingView
        style={styles.screenKeyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <ScrollView
        ref={mainScrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.topHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerEyebrow}>Controle financeiro</Text>
            <Text style={styles.title}>Despesas</Text>

            <Text style={styles.subtitle}>Acompanhe seus gastos por período, categoria e veículo.</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.headerAddButton}
            onPress={openCreateExpenseModal}
          >
            <Ionicons name="add" size={30} color="#06130B" />
          </TouchableOpacity>
        </View>

        <View style={styles.periodMenu}>
          {periodOptions.map((item) => {
            const active = periodType === item.id;

            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                style={[styles.periodButton, active && styles.periodButtonActive]}
                onPress={() => handleSelectPeriod(item.id)}
              >
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={active ? '#06130B' : '#A1A1AA'}
                />

                <Text style={[styles.periodText, active && styles.periodTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.periodNavigatorCard}>
          {periodType === 'week' || periodType === 'month' ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.periodArrow}
              onPress={goPreviousPeriod}
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.periodArrow} />
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            style={{ flex: 1 }}
            onPress={() => {
              if (periodType === 'week' || periodType === 'month') {
                setPeriodListModalVisible(true);
                return;
              }

              if (periodType === 'custom') {
                setPeriodModalVisible(true);
              }
            }}
          >
            <Text style={styles.periodNavigatorText}>{getPeriodLabel()}</Text>
          </TouchableOpacity>

          {periodType === 'week' || periodType === 'month' ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.periodArrow}
              onPress={goNextPeriod}
            >
              <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.periodArrow} />
          )}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryIconBox}>
              <Ionicons name="trending-down-outline" size={26} color="#FCA5A5" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Total de despesas</Text>
              <Text style={styles.summaryValue}>R$ {formatCurrency(totalExpenses)}</Text>
            </View>
          </View>

          <View style={styles.summaryMiniGrid}>
            <View style={styles.summaryMiniCard}>
              <View style={styles.summaryMiniHeader}>
                <View style={[styles.summaryMiniIconBox, styles.summaryMiniIconRevenue]}>
                  <Ionicons name="cash-outline" size={17} color="#86EFAC" />
                </View>
                <Text style={styles.summaryMiniLabel}>Faturamento</Text>
              </View>
              <Text style={styles.summaryMiniValue}>R$ {formatCurrency(totalRevenue)}</Text>
            </View>

            <View style={styles.summaryMiniCard}>
              <View style={styles.summaryMiniHeader}>
                <View style={[styles.summaryMiniIconBox, styles.summaryMiniIconWeight]}>
                  <Ionicons name="pie-chart-outline" size={17} color="#FCA5A5" />
                </View>
                <Text style={styles.summaryMiniLabel}>Peso no faturamento</Text>
              </View>
              <Text style={styles.summaryMiniValue}>{expensePercentageOfRevenue}%</Text>
            </View>

            <View style={styles.summaryMiniCard}>
              <View style={styles.summaryMiniHeader}>
                <View style={[styles.summaryMiniIconBox, styles.summaryMiniIconCount]}>
                  <Ionicons name="receipt-outline" size={17} color="#C4B5FD" />
                </View>
                <Text style={styles.summaryMiniLabel}>Qtd. despesas</Text>
              </View>
              <Text style={styles.summaryMiniValue}>{filteredExpenses.length}</Text>
            </View>

            <View style={styles.summaryMiniCard}>
              <View style={styles.summaryMiniHeader}>
                <View style={[styles.summaryMiniIconBox, styles.summaryMiniIconAverage]}>
                  <Ionicons name="stats-chart-outline" size={17} color="#93C5FD" />
                </View>
                <Text style={styles.summaryMiniLabel}>Ticket médio</Text>
              </View>
              <Text style={styles.summaryMiniValue}>R$ {formatCurrency(averageExpense)}</Text>
            </View>
          </View>

          {chartData.length > 0 ? (
            <View style={styles.chartContainer}>
              {chartData.slice(0, 6).map((item) => (
                <View key={item.category} style={styles.chartItem}>
                  <View style={styles.chartHeader}>
                    <View style={styles.chartCategoryRow}>
                      <View style={styles.chartIconBox}>
                        <Ionicons
                          name={expenseCategoryIcons[item.category] ?? 'pricetag-outline'}
                          size={15}
                          color="#FCA5A5"
                        />
                      </View>

                      <Text style={styles.chartTitle} numberOfLines={1}>
                        {item.category}
                      </Text>
                    </View>

                    <Text style={styles.chartValue}>
                      R$ {formatCurrency(item.amount)} • {Math.round(item.percentage)}%
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
          ) : (
            <View style={styles.emptyChartBox}>
              <Ionicons name="pie-chart-outline" size={24} color="#71717A" />
              <Text style={styles.emptyChartText}>
                Cadastre despesas para visualizar o resumo por categoria.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.filtersRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color="#71717A" />

            <TextInput
              value={search}
              onChangeText={setSearch}
              onFocus={() => {
                setTimeout(() => {
                  mainScrollRef.current?.scrollTo({
                    y: 360,
                    animated: true,
                  });
                }, 120);
              }}
              placeholder="Buscar descrição, local ou categoria"
              placeholderTextColor="#71717A"
              style={styles.searchInput}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.filterButton}
            onPress={() => setFiltersModalVisible(true)}
          >
            <Ionicons name="options-outline" size={22} color="#FFFFFF" />

            {activeFiltersCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {selectedCategories.length > 0 ? (
          <View style={styles.selectedFiltersWrapper}>
            {selectedCategories.map((item) => (
              <View key={item} style={styles.selectedFilterCard}>
                <Ionicons
                  name={expenseCategoryIcons[item] ?? 'pricetag-outline'}
                  size={14}
                  color="#06130B"
                />

                <Text style={styles.selectedFilterText}>{item}</Text>

                <TouchableOpacity onPress={() => toggleCategoryFilter(item)}>
                  <Ionicons name="close" size={16} color="#06130B" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingList}>
            <ActivityIndicator color="#22C55E" />
            <Text style={styles.loadingText}>Carregando despesas...</Text>
          </View>
        ) : filteredExpenses.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <Ionicons name="receipt-outline" size={36} color="#71717A" />
            </View>

            <Text style={styles.emptyStateTitle}>Nenhuma despesa encontrada</Text>

            <Text style={styles.emptyStateText}>
              Cadastre uma nova despesa ou ajuste os filtros para visualizar seus gastos.
            </Text>

            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.emptyStateButton}
              onPress={openCreateExpenseModal}
            >
              <Ionicons name="add" size={21} color="#06130B" />
              <Text style={styles.emptyStateButtonText}>Nova despesa</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredExpenses.map((expense) => (
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
                <View style={styles.expenseIcon}>
                  <Ionicons
                    name={expenseCategoryIcons[expense.category] ?? 'pricetag-outline'}
                    size={22}
                    color="#FCA5A5"
                  />
                </View>

                <View style={styles.expenseTextContent}>
                  <Text style={styles.expenseTitle} numberOfLines={1}>
                    {expense.description || 'Despesa'}
                  </Text>

                  <Text style={styles.expenseInfo} numberOfLines={1}>
                    {expense.category} • {formatDate(expense.expense_date)}
                  </Text>
                </View>

                <View style={styles.expenseValueBox}>
                  <Text style={styles.expenseValue}>
                    - R$ {formatCurrency(Number(expense.amount ?? 0))}
                  </Text>

                  <Ionicons
                    name={
                      expandedExpenseId === String(expense.id)
                        ? 'chevron-up'
                        : 'chevron-down'
                    }
                    size={18}
                    color="#71717A"
                  />
                </View>
              </View>

              {expandedExpenseId === String(expense.id) ? (
                <View style={styles.expenseDetails}>
                  <DetailLine icon="calendar-outline" text={`Data: ${formatDate(expense.expense_date)}`} />

                  {expense.location ? (
                    <DetailLine icon="location-outline" text={`Local: ${expense.location}`} />
                  ) : null}

                  {expense.vehicle ? (
                    <DetailLine
                      icon="car-sport-outline"
                      text={`Veículo: ${getVehicleLabel(expense.vehicle)}`}
                    />
                  ) : null}

                  <View style={styles.expenseActionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.86}
                      style={styles.expenseEditButton}
                      onPress={() => openEditExpenseModal(expense)}
                    >
                      <Ionicons name="create-outline" size={18} color="#06130B" />
                      <Text style={styles.expenseEditButtonText}>Editar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.86}
                      style={styles.expenseDeleteButton}
                      onPress={() => handleDeleteExpense(String(expense.id))}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
                      <Text style={styles.expenseDeleteButtonText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </Pressable>
          ))
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={periodModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Filtro</Text>
                <Text style={styles.modalTitle}>Período personalizado</Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setActiveDatePicker(null);
                  setPeriodModalVisible(false);
                }}
              >
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Data inicial</Text>
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.datePickerButton}
              onPress={() => openDatePicker('customStart')}
            >
              <Ionicons name="calendar-outline" size={19} color="#22C55E" />
              <Text style={styles.datePickerButtonText}>{customStartDate}</Text>
              <Ionicons
                name={activeDatePicker === 'customStart' ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#71717A"
              />
            </TouchableOpacity>

            {activeDatePicker === 'customStart' ? renderInlineCalendar() : null}

            <Text style={styles.fieldLabel}>Data final</Text>
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.datePickerButton}
              onPress={() => openDatePicker('customEnd')}
            >
              <Ionicons name="calendar-outline" size={19} color="#22C55E" />
              <Text style={styles.datePickerButtonText}>{customEndDate}</Text>
              <Ionicons
                name={activeDatePicker === 'customEnd' ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#71717A"
              />
            </TouchableOpacity>

            {activeDatePicker === 'customEnd' ? renderInlineCalendar() : null}

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.confirmButton}
              onPress={handleApplyCustomRange}
            >
              <Text style={styles.confirmButtonText}>Aplicar período</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={periodListModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>
                  {periodType === 'week' ? 'Semanas recentes' : 'Meses recentes'}
                </Text>
                <Text style={styles.modalTitle}>
                  {periodType === 'week' ? 'Selecionar semana' : 'Selecionar mês'}
                </Text>
              </View>

              <TouchableOpacity onPress={() => setPeriodListModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {!isCurrentListedPeriodSelected() ? (
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.currentPeriodButton}
                onPress={handleGoToCurrentListedPeriod}
              >
                <Ionicons name="refresh-outline" size={18} color="#06130B" />
                <Text style={styles.currentPeriodButtonText}>
                  {periodType === 'week' ? 'Ver semana atual' : 'Ver mês atual'}
                </Text>
              </TouchableOpacity>
            ) : null}

            <ScrollView
              style={styles.periodListScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.periodListContent}
            >
              {periodListItems.map((item) => {
                const active =
                  periodType === 'week'
                    ? isSameWeek(baseDate, item.date)
                    : isSameMonth(baseDate, item.date);

                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.86}
                    style={[
                      styles.periodListItem,
                      active && styles.periodListItemActive,
                    ]}
                    onPress={() => handleSelectListedPeriod(item.date)}
                  >
                    <View style={styles.periodListIconBox}>
                      <Ionicons
                        name={periodType === 'week' ? 'calendar-outline' : 'calendar-number-outline'}
                        size={18}
                        color={active ? '#06130B' : '#22C55E'}
                      />
                    </View>

                    <Text
                      style={[
                        styles.periodListItemText,
                        active && styles.periodListItemTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>

                    {active ? (
                      <Ionicons name="checkmark-circle" size={20} color="#06130B" />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={expenseModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlayCenter}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.expenseModalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 22 }}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>
                    {editingExpenseId ? 'Edição' : 'Cadastro'}
                  </Text>
                  <Text style={styles.modalTitle}>
                    {editingExpenseId ? 'Editar despesa' : 'Nova despesa'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setActiveDatePicker(null);
                    setExpenseModalVisible(false);
                    resetExpenseForm();
                  }}
                >
                  <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Descrição</Text>
              <TextInput
                value={expenseDescription}
                onChangeText={(text) => {
                  setExpenseDescription(text);
                  clearExpenseError('description');
                }}
                placeholder="Ex: Troca de óleo"
                placeholderTextColor="#71717A"
                style={[styles.input, expenseErrors.description && styles.inputError]}
              />
              {expenseErrors.description ? (
                <Text style={styles.errorText}>{expenseErrors.description}</Text>
              ) : null}

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Valor</Text>
                  <TextInput
                    value={expenseAmount}
                    onChangeText={(text) => {
                      setExpenseAmount(maskCurrency(text));
                      clearExpenseError('amount');
                    }}
                    placeholder="0,00"
                    placeholderTextColor="#71717A"
                    keyboardType="numeric"
                    style={[styles.input, expenseErrors.amount && styles.inputError]}
                  />
                  {expenseErrors.amount ? (
                    <Text style={styles.errorText}>{expenseErrors.amount}</Text>
                  ) : null}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Data</Text>
                  <TouchableOpacity
                    activeOpacity={0.86}
                    style={[
                      styles.datePickerButton,
                      styles.expenseDatePickerButton,
                      expenseErrors.date && styles.inputError,
                    ]}
                    onPress={() => openDatePicker('expense')}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#22C55E" />
                    <Text
                      style={[styles.datePickerButtonText, styles.expenseDatePickerButtonText]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                    >
                      {expenseDate}
                    </Text>
                    <Ionicons
                      name={activeDatePicker === 'expense' ? 'chevron-up' : 'chevron-down'}
                      size={17}
                      color="#71717A"
                    />
                  </TouchableOpacity>
                  {expenseErrors.date ? (
                    <Text style={styles.errorText}>{expenseErrors.date}</Text>
                  ) : null}
                </View>
              </View>

              {activeDatePicker === 'expense' ? renderInlineCalendar() : null}

              <Text style={styles.fieldLabel}>Categoria</Text>
              {expenseErrors.category ? (
                <Text style={[styles.errorText, { marginBottom: 8 }]}>
                  {expenseErrors.category}
                </Text>
              ) : null}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryChipsScroll}
              >
                {expenseCategories.map((item) => {
                  const selected = expenseCategory === item;

                  return (
                    <TouchableOpacity
                      key={item}
                      activeOpacity={0.86}
                      style={[
                        styles.categoryChip,
                        selected && styles.categoryChipActive,
                        expenseErrors.category && styles.categoryChipError,
                      ]}
                      onPress={() => {
                        setExpenseCategory(item);
                        clearExpenseError('category');
                      }}
                    >
                      <View
                        style={[
                          styles.categoryChipIcon,
                          selected && styles.categoryChipIconActive,
                        ]}
                      >
                        <Ionicons
                          name={expenseCategoryIcons[item] ?? 'pricetag-outline'}
                          size={17}
                          color={selected ? '#06130B' : '#FCA5A5'}
                        />
                      </View>

                      <Text
                        style={[
                          styles.categoryChipText,
                          selected && styles.categoryChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.fieldLabel}>Veículo</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.vehiclePicker}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.vehicleSelectCard,
                    expenseVehicleId === 'nenhum' && styles.vehicleSelectCardActive,
                  ]}
                  onPress={() => setExpenseVehicleId('nenhum')}
                >
                  <View
                    style={[
                      styles.vehicleSelectIcon,
                      expenseVehicleId === 'nenhum' && styles.vehicleSelectIconActive,
                    ]}
                  >
                    <Ionicons
                      name="remove-circle-outline"
                      size={18}
                      color={expenseVehicleId === 'nenhum' ? '#06130B' : '#A1A1AA'}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.vehicleSelectTitle,
                        expenseVehicleId === 'nenhum' && styles.vehicleSelectTitleActive,
                      ]}
                    >
                      Nenhum veículo
                    </Text>
                    <Text
                      style={[
                        styles.vehicleSelectPlate,
                        expenseVehicleId === 'nenhum' && styles.vehicleSelectPlateActive,
                      ]}
                    >
                      Despesa geral
                    </Text>
                  </View>
                </TouchableOpacity>

                {vehicles.map((vehicle) => {
                  const selected = expenseVehicleId === vehicle.id;
                  const plate = String(vehicle?.plate ?? '').trim().toUpperCase();

                  return (
                    <TouchableOpacity
                      key={vehicle.id}
                      activeOpacity={0.85}
                      style={[
                        styles.vehicleSelectCard,
                        selected && styles.vehicleSelectCardActive,
                      ]}
                      onPress={() => setExpenseVehicleId(vehicle.id)}
                    >
                      <View
                        style={[
                          styles.vehicleSelectIcon,
                          selected && styles.vehicleSelectIconActive,
                        ]}
                      >
                        <Ionicons
                          name="car-sport-outline"
                          size={18}
                          color={selected ? '#06130B' : '#A1A1AA'}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.vehicleSelectTitle,
                            selected && styles.vehicleSelectTitleActive,
                          ]}
                          numberOfLines={1}
                        >
                          {[vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Veículo'}
                        </Text>

                        <Text
                          style={[
                            styles.vehicleSelectPlate,
                            selected && styles.vehicleSelectPlateActive,
                          ]}
                          numberOfLines={1}
                        >
                          {plate || 'Sem placa'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.fieldLabel}>Local ou observação</Text>
              <TextInput
                value={expenseLocation}
                onChangeText={setExpenseLocation}
                placeholder="Ex: Posto Shell, oficina, mercado..."
                placeholderTextColor="#71717A"
                style={styles.input}
              />

              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.confirmButton, savingExpense && styles.confirmButtonDisabled]}
                onPress={handleSaveExpense}
                disabled={savingExpense}
              >
                {savingExpense ? (
                  <ActivityIndicator color="#06130B" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={22} color="#06130B" />
                    <Text style={styles.confirmButtonText}>
                      {editingExpenseId ? 'Salvar alterações' : 'Cadastrar despesa'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={filtersModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>Organizar</Text>
                  <Text style={styles.modalTitle}>Filtros</Text>
                </View>

                <TouchableOpacity onPress={() => setFiltersModalVisible(false)}>
                  <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.clearFiltersButton}
                onPress={clearAllFilters}
              >
                <Ionicons name="refresh-outline" size={18} color="#FCA5A5" />
                <Text style={styles.clearFiltersText}>Limpar filtros</Text>
              </TouchableOpacity>

              <Text style={styles.filterTitle}>Veículo</Text>

              <View style={styles.filterGrid}>
                <TouchableOpacity
                  style={[styles.filterCard, vehicleId === 'todos' && styles.filterCardActive]}
                  onPress={() => setVehicleId('todos')}
                >
                  <Ionicons
                    name="car-outline"
                    size={20}
                    color={vehicleId === 'todos' ? '#06130B' : '#FFFFFF'}
                  />
                  <Text
                    style={[
                      styles.filterCardText,
                      vehicleId === 'todos' && styles.filterCardTextActive,
                    ]}
                  >
                    Todos
                  </Text>
                </TouchableOpacity>

                {vehicles.map((vehicle) => (
                  <TouchableOpacity
                    key={vehicle.id}
                    style={[styles.filterCard, vehicleId === vehicle.id && styles.filterCardActive]}
                    onPress={() => setVehicleId(vehicle.id)}
                  >
                    <Ionicons
                      name="car-sport-outline"
                      size={20}
                      color={vehicleId === vehicle.id ? '#06130B' : '#FFFFFF'}
                    />
                    <Text
                      style={[
                        styles.filterCardText,
                        vehicleId === vehicle.id && styles.filterCardTextActive,
                      ]}
                      numberOfLines={2}
                    >
                      {getVehicleLabel(vehicle)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.filterTitle, { marginTop: 22 }]}>Ordenar por</Text>

              <View style={styles.filterGrid}>
                {[
                  { id: 'recent', label: 'Mais recente', icon: 'arrow-down-outline' },
                  { id: 'oldest', label: 'Mais antigo', icon: 'arrow-up-outline' },
                  { id: 'highest', label: 'Mais caro', icon: 'trending-up-outline' },
                  { id: 'lowest', label: 'Mais barato', icon: 'trending-down-outline' },
                ].map((item) => {
                  const active = sortType === item.id;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.filterCard, active && styles.filterCardActive]}
                      onPress={() => setSortType(item.id as any)}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={20}
                        color={active ? '#06130B' : '#FFFFFF'}
                      />

                      <Text style={[styles.filterCardText, active && styles.filterCardTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.filterTitle, { marginTop: 22 }]}>Categorias</Text>

              <View style={styles.filterGrid}>
                {expenseCategories.map((item) => {
                  const selected = selectedCategories.includes(item);

                  return (
                    <TouchableOpacity
                      key={item}
                      style={[styles.filterCard, selected && styles.filterCardActive]}
                      onPress={() => toggleCategoryFilter(item)}
                    >
                      <Ionicons
                        name={expenseCategoryIcons[item] ?? 'pricetag-outline'}
                        size={20}
                        color={selected ? '#06130B' : '#FFFFFF'}
                      />

                      <Text
                        style={[
                          styles.filterCardText,
                          selected && styles.filterCardTextActive,
                        ]}
                      >
                        {item}
                      </Text>
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

function DetailLine({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.detailLine}>
      <Ionicons name={icon} size={16} color="#A1A1AA" />
      <Text style={styles.expenseInfo}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  screenKeyboardAvoidingView: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 150,
  },

  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },

  headerEyebrow: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 2,
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
    lineHeight: 18,
  },

  headerAddButton: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },

  periodMenu: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 5,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
  },

  periodButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  periodButtonActive: {
    backgroundColor: '#22C55E',
  },

  periodText: {
    color: '#A1A1AA',
    fontWeight: '900',
    fontSize: 11,
  },

  periodTextActive: {
    color: '#06130B',
  },

  periodNavigatorCard: {
    height: 58,
    backgroundColor: '#111827',
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 10,
  },

  periodArrow: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181B',
  },

  periodNavigatorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'capitalize',
  },

  summaryCard: {
    backgroundColor: '#111827',
    borderRadius: 30,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },

  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 16,
  },

  summaryIconBox: {
    width: 54,
    height: 54,
    borderRadius: 19,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryLabel: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '900',
  },

  summaryValue: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '900',
    marginTop: 3,
  },

  summaryMiniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  summaryMiniCard: {
    width: '48%',
    minHeight: 86,
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryMiniLabel: {
    flex: 1,
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'left',
    lineHeight: 13,
  },

  summaryMiniValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'center',
    alignSelf: 'center',
  },

  summaryMiniHeader: {
    width: '100%',
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  summaryMiniIconBox: {
    width: 30,
    height: 30,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  summaryMiniIconRevenue: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.24)',
  },

  summaryMiniIconWeight: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.24)',
  },

  summaryMiniIconCount: {
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderColor: 'rgba(139,92,246,0.24)',
  },

  summaryMiniIconAverage: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.24)',
  },

  chartContainer: {
    marginTop: 18,
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

  chartIconBox: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  chartTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    flex: 1,
  },

  chartValue: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
  },

  progressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: '#27272A',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#EF4444',
  },

  emptyChartBox: {
    marginTop: 18,
    minHeight: 76,
    borderRadius: 20,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },

  emptyChartText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 17,
  },

  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },

  searchBox: {
    flex: 1,
    height: 56,
    borderRadius: 19,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  searchInput: {
    flex: 1,
    height: '100%',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  filterButton: {
    width: 56,
    height: 56,
    borderRadius: 19,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },

  filterBadgeText: {
    color: '#06130B',
    fontSize: 11,
    fontWeight: '900',
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
    color: '#06130B',
    fontSize: 12,
    fontWeight: '900',
  },

  loadingList: {
    minHeight: 180,
    borderRadius: 26,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 10,
  },

  emptyState: {
    minHeight: 260,
    borderRadius: 28,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },

  emptyStateIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  emptyStateTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  emptyStateText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },

  emptyStateButton: {
    height: 46,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 18,
  },

  emptyStateButtonText: {
    color: '#06130B',
    fontSize: 14,
    fontWeight: '900',
  },

  expenseCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },

  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  expenseIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  expenseTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
    marginBottom: 0,
  },

  expenseTextContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 0,
  },

  expenseValueBox: {
    alignItems: 'flex-end',
    gap: 6,
  },

  expenseValue: {
    color: '#FCA5A5',
    fontWeight: '900',
    fontSize: 14,
  },

  expenseInfo: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 0,
    lineHeight: 15,
  },

  expenseDetails: {
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    marginTop: 14,
    paddingTop: 12,
    gap: 7,
  },

  detailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  expenseActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },

  expenseEditButton: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },

  expenseEditButtonText: {
    color: '#06130B',
    fontSize: 13,
    fontWeight: '900',
  },

  expenseDeleteButton: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },

  expenseDeleteButtonText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '900',
  },

  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 18,
    justifyContent: 'center',
  },

  modalContent: {
    backgroundColor: '#111827',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
    maxHeight: '86%',
  },

  expenseModalContent: {
    backgroundColor: '#111827',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
    maxHeight: '92%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 12,
  },

  modalEyebrow: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },


  currentPeriodButton: {
    height: 46,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },

  currentPeriodButtonText: {
    color: '#06130B',
    fontSize: 13,
    fontWeight: '900',
  },

  periodListScroll: {
    maxHeight: 390,
  },

  periodListContent: {
    paddingBottom: 6,
    gap: 9,
  },

  periodListItem: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  periodListItemActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  periodListIconBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  periodListItemText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'capitalize',
  },

  periodListItemTextActive: {
    color: '#06130B',
  },

  calendarModalContent: {
    backgroundColor: '#111827',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
    maxHeight: '88%',
  },

  inlineCalendarBox: {
    backgroundColor: '#111827',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 10,
    marginBottom: 14,
    overflow: 'hidden',
  },

  inlineCalendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  inlineCalendarTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  datePickerButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 15,
    marginBottom: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  expenseDatePickerButton: {
    marginBottom: 13,
    paddingHorizontal: 10,
    gap: 6,
  },

  datePickerButtonText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  expenseDatePickerButtonText: {
    fontSize: 13,
    textAlign: 'center',
    includeFontPadding: false,
  },

  fieldLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
    marginLeft: 4,
  },

  input: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#FFFFFF',
    paddingHorizontal: 15,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 13,
  },

  inputError: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },

  errorText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
    marginTop: -6,
    marginBottom: 10,
    marginLeft: 4,
    lineHeight: 17,
  },

  formRow: {
    flexDirection: 'row',
    gap: 10,
  },


  categoryChipsScroll: {
    gap: 8,
    paddingBottom: 14,
  },

  categoryChip: {
    height: 42,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingLeft: 7,
    paddingRight: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  categoryChipActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  categoryChipError: {
    borderColor: 'rgba(239,68,68,0.4)',
  },

  categoryChipIcon: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(239,68,68,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  categoryChipIconActive: {
    backgroundColor: 'rgba(6,19,11,0.12)',
  },

  categoryChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    maxWidth: 150,
  },

  categoryChipTextActive: {
    color: '#06130B',
  },

  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 14,
  },

  categoryCard: {
    width: '48%',
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  categoryCardActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  categoryCardError: {
    borderColor: 'rgba(239,68,68,0.4)',
  },

  categoryCardText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 15,
  },

  categoryCardTextActive: {
    color: '#06130B',
  },

  vehiclePicker: {
    gap: 8,
    paddingBottom: 13,
  },

  vehicleSelectCard: {
    width: 205,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  vehicleSelectCardActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  vehicleSelectIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },

  vehicleSelectIconActive: {
    backgroundColor: 'rgba(6,19,11,0.12)',
  },

  vehicleSelectTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  vehicleSelectTitleActive: {
    color: '#06130B',
  },

  vehicleSelectPlate: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
    textTransform: 'uppercase',
  },

  vehicleSelectPlateActive: {
    color: '#14532D',
  },


  vehicleChip: {
    height: 42,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 150,
  },

  vehicleChipActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  vehicleChipText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '900',
  },

  vehicleChipTextActive: {
    color: '#06130B',
  },

  confirmButton: {
    height: 58,
    borderRadius: 19,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },

  confirmButtonDisabled: {
    opacity: 0.65,
  },

  confirmButtonText: {
    color: '#06130B',
    fontWeight: '900',
    fontSize: 15,
  },

  clearFiltersButton: {
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.20)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 18,
  },

  clearFiltersText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '900',
  },

  filterTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
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
    minHeight: 76,
    borderRadius: 18,
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
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 8,
  },

  filterCardTextActive: {
    color: '#06130B',
  },
});



