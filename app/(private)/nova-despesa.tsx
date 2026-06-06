import { useEffect, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getVehicles } from '../../src/features/vehicles/services/getVehicles';
import { createExpense } from '../../src/features/expenses/services/createExpense';

const categories = [
  'Combustível',
  'Manutenção',
  'Lavagem',
  'Alimentação',
  'Estacionamento',
  'Multa',
  'Imposto',
  'Seguro',
  'Outros',
];

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Combustível: 'car-sport-outline',
  Manutenção: 'build-outline',
  Lavagem: 'water-outline',
  Alimentação: 'restaurant-outline',
  Estacionamento: 'car-outline',
  Multa: 'alert-circle-outline',
  Imposto: 'document-text-outline',
  Seguro: 'shield-checkmark-outline',
  Outros: 'ellipsis-horizontal-circle-outline',
};

function getVehicleImage(type?: string) {
  switch (type) {
    case 'motorcycle':
      return require('../../assets/vehicles/motorcycle.png');

    case 'utility':
      return require('../../assets/vehicles/utility.png');

    default:
      return require('../../assets/vehicles/car.png');
  }
}

function formatMoney(text: string) {
  const numbers = text.replace(/\D/g, '');
  const value = (Number(numbers) / 100).toFixed(2);

  return value.replace('.', ',');
}

function parseMoney(text: string) {
  return Number(text.replace(/\./g, '').replace(',', '.')) || 0;
}

function formatDate(text: string) {
  const numbers = text.replace(/\D/g, '').slice(0, 8);

  if (numbers.length > 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4)}`;
  }

  if (numbers.length > 2) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  }

  return numbers;
}

function formatKm(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 6);

  if (!numbers) return '';

  return Number(numbers).toLocaleString('pt-BR');
}

function onlyNumbers(value: string) {
  return Number(value.replace(/\D/g, '')) || 0;
}

function dateToISO(dateText: string) {
  const [day, month, year] = dateText.split('/');

  if (!day || !month || !year) return null;

  const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

export default function NewExpenseScreen() {
  const [vehicles, setVehicles] = useState<any[]>([]);

  const [category, setCategory] = useState('Combustível');
  const [vehicle, setVehicle] = useState<any>(null);

  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(
    new Date().toLocaleDateString('pt-BR'),
  );

  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [maintenanceKm, setMaintenanceKm] = useState('');

  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadVehicles();
  }, []);

  async function loadVehicles() {
    const response = await getVehicles();

    setVehicles(response);

    if (response.length > 0) {
      setVehicle(response[0]);
    }
  }

  async function handleSaveExpense() {
    try {
      if (!vehicle) {
        Alert.alert('Atenção', 'Selecione um veículo.');
        return;
      }

      const parsedAmount = parseMoney(amount);

      if (!parsedAmount || parsedAmount <= 0) {
        Alert.alert('Atenção', 'Informe o valor da despesa.');
        return;
      }

      const parsedDate = dateToISO(expenseDate);

      if (!parsedDate) {
        Alert.alert('Atenção', 'Informe uma data válida.');
        return;
      }

      if (category === 'Manutenção' && !onlyNumbers(maintenanceKm)) {
        Alert.alert('Atenção', 'Informe o KM da manutenção.');
        return;
      }

      setLoading(true);

      await createExpense({
        vehicle_id: vehicle.id,
        category,
        amount: parsedAmount,
        expense_date: parsedDate,
        location,
        description,
        maintenance_km:
          category === 'Manutenção' ? onlyNumbers(maintenanceKm) : null,
      });

      Alert.alert('Sucesso', 'Despesa salva com sucesso.');

      router.back();
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message ?? 'Não foi possível salvar a despesa.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.title}>Nova despesa</Text>

            <View style={{ width: 24 }} />
          </View>

          <Text style={styles.label}>Categoria</Text>

          <TouchableOpacity
            style={styles.selectCard}
            onPress={() => setCategoryModalVisible(true)}
          >
            <View style={styles.categoryIcon}>
              <Ionicons
                name={categoryIcons[category] ?? 'pricetag-outline'}
                size={18}
                color="#22C55E"
              />
            </View>

            <Text style={styles.selectText}>{category}</Text>

            <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.label}>Veículo</Text>

          <TouchableOpacity
            style={styles.selectCard}
            onPress={() => setVehicleModalVisible(true)}
          >
            {vehicle ? (
              <Image
                source={getVehicleImage(vehicle.type)}
                style={styles.vehicleImage}
              />
            ) : (
              <Ionicons name="car-sport-outline" size={28} color="#A1A1AA" />
            )}

            <Text style={styles.selectText}>
              {vehicle ? `${vehicle.model} - ${vehicle.plate}` : 'Selecionar'}
            </Text>

            <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.label}>Valor</Text>

          <TextInput
            value={amount ? `R$ ${amount}` : ''}
            onChangeText={(text) => setAmount(formatMoney(text))}
            placeholder="R$ 0,00"
            placeholderTextColor="#71717A"
            keyboardType="numeric"
            style={styles.input}
          />

          <Text style={styles.label}>Data</Text>

          <View style={styles.inputWithIcon}>
            <TextInput
              value={expenseDate}
              onChangeText={(text) => setExpenseDate(formatDate(text))}
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#71717A"
              keyboardType="numeric"
              maxLength={10}
              style={styles.inputInside}
            />

            <Ionicons name="calendar-outline" size={22} color="#A1A1AA" />
          </View>

          {category === 'Manutenção' && (
            <>
              <Text style={styles.label}>KM da manutenção</Text>

              <TextInput
                value={maintenanceKm}
                onChangeText={(text) => setMaintenanceKm(formatKm(text))}
                placeholder="Ex: 45.000"
                placeholderTextColor="#71717A"
                keyboardType="numeric"
                style={styles.input}
              />
            </>
          )}

          <Text style={styles.label}>Local</Text>

          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Posto Shell - Av. Brasil"
            placeholderTextColor="#71717A"
            style={styles.input}
          />

          <Text style={styles.label}>Descrição</Text>

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Gasolina"
            placeholderTextColor="#71717A"
            style={styles.input}
          />

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveExpense}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Salvando...' : 'Salvar despesa'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={categoryModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
            >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Escolher categoria</Text>

              <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {categories.map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.modalOption,
                  category === item && styles.modalOptionActive,
                ]}
                onPress={() => {
                  setCategory(item);
                  setCategoryModalVisible(false);
                }}
              >
                <View style={styles.modalOptionLeft}>
                  <View style={styles.modalIconBox}>
                    <Ionicons
                      name={categoryIcons[item] ?? 'pricetag-outline'}
                      size={19}
                      color="#22C55E"
                    />
                  </View>

                  <Text style={styles.modalOptionText}>{item}</Text>
                </View>

                {category === item && (
                  <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
                )}
              </TouchableOpacity>
            ))}
            </ScrollView>
            </View>
            </View>
        </Modal>

      <Modal visible={vehicleModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Escolher veículo</Text>

              <TouchableOpacity onPress={() => setVehicleModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {vehicles.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.modalOption,
                  vehicle?.id === item.id && styles.modalOptionActive,
                ]}
                onPress={() => {
                  setVehicle(item);
                  setVehicleModalVisible(false);
                }}
              >
                <View style={styles.modalOptionLeft}>
                  <Image
                    source={getVehicleImage(item.type)}
                    style={styles.modalVehicleImage}
                  />

                  <Text style={styles.modalOptionText}>
                    {item.model} - {item.plate}
                  </Text>
                </View>

                {vehicle?.id === item.id && (
                  <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
                )}
              </TouchableOpacity>
            ))}
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 140,
  },

  header: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  label: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },

  selectCard: {
    height: 58,
    borderRadius: 14,
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 12,
  },

  categoryIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#052E16',
    alignItems: 'center',
    justifyContent: 'center',
  },

  vehicleImage: {
    width: 46,
    height: 36,
    resizeMode: 'contain',
  },

  selectText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  input: {
    height: 58,
    borderRadius: 14,
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#1F2937',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 14,
  },

  inputWithIcon: {
    height: 58,
    borderRadius: 14,
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  inputInside: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  saveButton: {
    height: 58,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: '#09090B',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    maxHeight: '75%',
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
    fontWeight: '900',
  },

  modalOption: {
    height: 62,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  modalOptionActive: {
    borderColor: '#22C55E',
    backgroundColor: '#052E16',
  },

  modalOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },

  modalIconBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#052E16',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalVehicleImage: {
    width: 54,
    height: 38,
    resizeMode: 'contain',
  },

  modalOptionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
});
