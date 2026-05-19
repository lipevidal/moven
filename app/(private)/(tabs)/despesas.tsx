import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';

import { useEffect, useMemo, useState } from 'react';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../src/constants/colors';

import { getVehicles } from '../../../src/features/vehicles/services/getVehicles';

import { createExpense } from '../../../src/features/expenses/services/createExpense';

import { getExpenses } from '../../../src/features/expenses/services/getExpenses';

const categories: {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'Combustível', icon: 'flash-outline' },
  { id: 'Alimentação', icon: 'restaurant-outline' },
  { id: 'Manutenção', icon: 'construct-outline' },
  { id: 'Lavagem', icon: 'water-outline' },
  { id: 'Seguro', icon: 'shield-outline' },
  { id: 'Financiamento', icon: 'card-outline' },
  { id: 'Imposto', icon: 'document-text-outline' },
  { id: 'Multa', icon: 'alert-circle-outline' },
  { id: 'Pedágio', icon: 'car-outline' },
  { id: 'Internet', icon: 'wifi-outline' },
  { id: 'Aplicativos', icon: 'phone-portrait-outline' },
  { id: 'Outros', icon: 'apps-outline' },
];

const filters = [
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
  { id: 'general', label: 'Geral' },
];

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('month');
  const [expandedExpense, setExpandedExpense] =
    useState<string | null>(null);

  const [category, setCategory] = useState('Combustível');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedVehicle, setSelectedVehicle] =
    useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [expensesResponse, vehiclesResponse] =
        await Promise.all([getExpenses(), getVehicles()]);

      setExpenses(expensesResponse);
      setVehicles(vehiclesResponse);

      if (vehiclesResponse.length > 0) {
        setSelectedVehicle(vehiclesResponse[0]);
      }
    } catch (error) {
      console.log(error);
    }
  }

  async function handleCreateExpense() {
    try {
      if (!description || !amount) {
        Alert.alert(
          'Atenção',
          'Preencha os campos obrigatórios.',
        );
        return;
      }

      await createExpense({
        vehicle_id: selectedVehicle?.id,
        category,
        description,
        location,
        amount: Number(amount),
        expense_date: new Date(),
      });

      setModalVisible(false);
      setDescription('');
      setLocation('');
      setAmount('');

      loadData();
    } catch (error) {
      console.log(error);

      Alert.alert(
        'Erro',
        'Não foi possível cadastrar a despesa.',
      );
    }
  }

  const filteredExpenses = useMemo(() => {
    const now = new Date();

    return expenses.filter((expense) => {
      const expenseDate = new Date(expense.expense_date);

      const diffDays =
        (now.getTime() - expenseDate.getTime()) /
        (1000 * 60 * 60 * 24);

      switch (selectedFilter) {
        case 'week':
          return diffDays <= 7;

        case 'month':
          return diffDays <= 30;

        default:
          return true;
      }
    });
  }, [expenses, selectedFilter]);

  const totalExpenses = filteredExpenses.reduce(
    (total, expense) => total + Number(expense.amount),
    0,
  );

  const categoriesTotals = filteredExpenses.reduce(
    (acc: any, expense) => {
      acc[expense.category] =
        (acc[expense.category] ?? 0) + Number(expense.amount);

      return acc;
    },
    {},
  );

  function getCategoryIcon(
    categoryName: string,
  ): keyof typeof Ionicons.glyphMap {
    return (
      categories.find((item) => item.id === categoryName)?.icon ??
      'apps-outline'
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Despesas</Text>

            <Text style={styles.subtitle}>
              Controle seus gastos.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterButton,
                selectedFilter === filter.id && {
                  backgroundColor: '#22C55E',
                },
              ]}
              onPress={() => setSelectedFilter(filter.id)}
            >
              <Text style={styles.filterText}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>
            Total de despesas
          </Text>

          <Text style={styles.summaryValue}>
            R${' '}
            {totalExpenses.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>

        <View style={styles.categoriesCard}>
          <Text style={styles.categoriesTitle}>
            Categorias
          </Text>

          {Object.entries(categoriesTotals).map(
            ([categoryName, value]: any) => {
              const percentage =
                totalExpenses > 0
                  ? (Number(value) / totalExpenses) * 100
                  : 0;

              return (
                <View
                  key={categoryName}
                  style={styles.categoryItem}
                >
                  <View style={styles.categoryRow}>
                    <View style={styles.categoryInfo}>
                      <Ionicons
                        name={getCategoryIcon(categoryName)}
                        size={18}
                        color="#22C55E"
                      />

                      <Text style={styles.categoryName}>
                        {categoryName}
                      </Text>
                    </View>

                    <Text style={styles.categoryValue}>
                      {Math.round(percentage)}%
                    </Text>
                  </View>

                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${percentage}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            },
          )}
        </View>

        {filteredExpenses.map((expense) => {
          const expanded = expandedExpense === expense.id;

          return (
            <TouchableOpacity
              key={expense.id}
              style={styles.expenseCard}
              onPress={() =>
                setExpandedExpense(expanded ? null : expense.id)
              }
            >
              <View style={styles.expenseTop}>
                <View style={styles.expenseInfo}>
                  <Ionicons
                    name={getCategoryIcon(expense.category)}
                    size={22}
                    color="#22C55E"
                  />

                  <View>
                    <Text style={styles.expenseTitle}>
                      {expense.description}
                    </Text>

                    <Text style={styles.expenseCategory}>
                      {expense.category}
                    </Text>
                  </View>
                </View>

                <Text style={styles.expenseValue}>
                  R${' '}
                  {Number(expense.amount).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </View>

              {expanded && (
                <View style={styles.expandedContent}>
                  <Text style={styles.expandedText}>
                    Data:{' '}
                    {new Date(
                      expense.expense_date,
                    ).toLocaleDateString('pt-BR')}
                  </Text>

                  <Text style={styles.expandedText}>
                    Local: {expense.location || 'Não informado'}
                  </Text>

                  <Text style={styles.expandedText}>
                    Veículo:{' '}
                    {expense.vehicle
                      ? `${expense.vehicle.brand} ${expense.vehicle.model}`
                      : 'Não informado'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nova despesa</Text>

                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                >
                  <Ionicons
                    name="close"
                    size={26}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoriesScroll}
              >
                {categories.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.categoryButton,
                      category === item.id && {
                        backgroundColor: '#22C55E',
                      },
                    ]}
                    onPress={() => setCategory(item.id)}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color="#FFFFFF"
                    />

                    <Text style={styles.categoryButtonText}>
                      {item.id}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Descrição"
                placeholderTextColor="#71717A"
                style={styles.input}
              />

              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="Local"
                placeholderTextColor="#71717A"
                style={styles.input}
              />

              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="Valor"
                placeholderTextColor="#71717A"
                style={styles.input}
              />

              <Text style={styles.vehicleLabel}>Veículo</Text>

              {vehicles.map((vehicle) => (
                <TouchableOpacity
                  key={vehicle.id}
                  style={[
                    styles.vehicleButton,
                    selectedVehicle?.id === vehicle.id && {
                      borderColor: '#22C55E',
                    },
                  ]}
                  onPress={() => setSelectedVehicle(vehicle)}
                >
                  <Text style={styles.vehicleButtonText}>
                    {vehicle.brand} {vehicle.model}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleCreateExpense}
              >
                <Text style={styles.saveButtonText}>
                  Salvar despesa
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },

  subtitle: {
    color: '#71717A',
    marginTop: 6,
  },

  addButton: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  filtersContainer: {
    marginBottom: 18,
  },

  filterButton: {
    height: 42,
    borderRadius: 14,
    backgroundColor: '#18181B',
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  filterText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  summaryCard: {
    backgroundColor: '#111827',
    borderRadius: 28,
    padding: 24,
    marginBottom: 18,
  },

  summaryLabel: {
    color: '#A1A1AA',
  },

  summaryValue: {
    color: '#EF4444',
    fontSize: 34,
    fontWeight: '800',
    marginTop: 8,
  },

  categoriesCard: {
    backgroundColor: '#18181B',
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
  },

  categoriesTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20,
  },

  categoryItem: {
    marginBottom: 14,
  },

  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  categoryName: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  categoryValue: {
    color: '#22C55E',
    fontWeight: '800',
  },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#27272A',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 999,
  },

  expenseCard: {
    backgroundColor: '#18181B',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },

  expenseTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  expenseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },

  expenseTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  expenseCategory: {
    color: '#71717A',
    marginTop: 4,
  },

  expenseValue: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 16,
  },

  expandedContent: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    paddingTop: 16,
    gap: 8,
  },

  expandedText: {
    color: '#A1A1AA',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },

  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },

  modalContent: {
    backgroundColor: '#111827',
    borderRadius: 28,
    padding: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },

  categoriesScroll: {
    marginBottom: 18,
  },

  categoryButton: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#18181B',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 10,
  },

  categoryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  input: {
    height: 58,
    borderRadius: 18,
    backgroundColor: '#18181B',
    paddingHorizontal: 18,
    color: '#FFFFFF',
    marginBottom: 14,
  },

  vehicleLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 12,
  },

  vehicleButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  vehicleButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  saveButton: {
    height: 58,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});