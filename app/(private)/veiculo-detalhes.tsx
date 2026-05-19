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

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
  });
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

  const filteredExpenses = useMemo(() => {
    const term = search.toLowerCase();

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
        <Text style={styles.loadingText}>Carregando...</Text>
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
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Detalhes do veículo</Text>

        <View style={styles.backButton} />
      </View>

      <View style={styles.vehicleCard}>
        <Image
          source={getVehicleImage(vehicle.type)}
          style={styles.vehicleImage}
        />

        <View style={{ flex: 1 }}>
          <Text style={styles.vehicleTitle}>
            {vehicle.brand} {vehicle.model}
          </Text>

          <Text style={styles.vehiclePlate}>{vehicle.plate}</Text>

          <Text style={styles.vehicleKm}>
            {Number(vehicle.current_km).toLocaleString('pt-BR')} km atuais
          </Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryLabel}>Faturamento</Text>

            <Text style={styles.revenueValue}>
              R$ {formatCurrency(totalRevenue)}
            </Text>
          </View>

          <View>
            <Text style={styles.summaryLabel}>Despesas</Text>

            <Text style={styles.expenseValue}>
              R$ {formatCurrency(totalExpenses)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryLabel}>Lucro</Text>

            <Text
              style={[
                styles.profitValue,
                profit < 0 && { color: '#EF4444' },
              ]}
            >
              R$ {formatCurrency(profit)}
            </Text>
          </View>

          <View>
            <Text style={styles.summaryLabel}>Despesa/Faturamento</Text>

            <Text style={styles.percentValue}>
              {Math.round(expensePercentage)}%
            </Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(expensePercentage, 100)}%`,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>
          Despesas por categoria
        </Text>

        {Object.entries(expensesByCategory).length === 0 ? (
          <Text style={styles.emptyText}>
            Nenhuma despesa registrada para este veículo.
          </Text>
        ) : (
          Object.entries(expensesByCategory).map(([category, amount]: any) => {
            const percentage =
              totalExpenses > 0 ? (Number(amount) / totalExpenses) * 100 : 0;

            return (
              <View key={category} style={styles.categoryItem}>
                <View style={styles.categoryRow}>
                  <Text style={styles.categoryName}>{category}</Text>

                  <Text style={styles.categoryValue}>
                    R$ {formatCurrency(Number(amount))} •{' '}
                    {Math.round(percentage)}%
                  </Text>
                </View>

                <View style={styles.categoryTrack}>
                  <View
                    style={[
                      styles.categoryFill,
                      {
                        width: `${Math.min(percentage, 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })
        )}
      </View>

      <Text style={styles.sectionTitle}>Lista de despesas</Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por descrição, local ou categoria"
        placeholderTextColor="#71717A"
        style={styles.searchInput}
      />

      {filteredExpenses.map((expense) => (
        <View key={expense.id} style={styles.expenseCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.expenseTitle}>
              {expense.description}
            </Text>

            <Text style={styles.expenseCategory}>
              {expense.category}
            </Text>

            <Text style={styles.expenseDate}>
              {new Date(expense.expense_date).toLocaleDateString('pt-BR')}
              {expense.location ? ` • ${expense.location}` : ''}
            </Text>
          </View>

          <Text style={styles.expenseCardValue}>
            R$ {formatCurrency(Number(expense.amount))}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#FFFFFF',
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
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },

  vehicleCard: {
    backgroundColor: '#0D1117',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  vehicleImage: {
    width: 96,
    height: 70,
    resizeMode: 'contain',
    marginRight: 16,
  },

  vehicleTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },

  vehiclePlate: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },

  vehicleKm: {
    color: '#71717A',
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
  },

  summaryCard: {
    backgroundColor: '#111827',
    borderRadius: 28,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
  },

  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },

  summaryLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
  },

  revenueValue: {
    color: '#22C55E',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },

  expenseValue: {
    color: '#EF4444',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },

  profitValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },

  percentValue: {
    color: '#F59E0B',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },

  divider: {
    height: 1,
    backgroundColor: '#27272A',
    marginVertical: 18,
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
    backgroundColor: '#EF4444',
    borderRadius: 999,
  },

  chartCard: {
    backgroundColor: '#18181B',
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },

  emptyText: {
    color: '#71717A',
    fontSize: 14,
    fontWeight: '600',
  },

  categoryItem: {
    marginBottom: 14,
  },

  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },

  categoryName: {
    color: '#FFFFFF',
    fontWeight: '800',
    flex: 1,
  },

  categoryValue: {
    color: '#A1A1AA',
    fontWeight: '700',
  },

  categoryTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: '#27272A',
    overflow: 'hidden',
  },

  categoryFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#EF4444',
  },

  searchInput: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 16,
    color: '#FFFFFF',
    marginBottom: 14,
  },

  expenseCard: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },

  expenseTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  expenseCategory: {
    color: '#A1A1AA',
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
  },

  expenseDate: {
    color: '#71717A',
    marginTop: 4,
    fontSize: 12,
  },

  expenseCardValue: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '800',
  },
});