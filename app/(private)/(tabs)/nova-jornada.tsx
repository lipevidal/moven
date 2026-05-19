import { useEffect, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../src/constants/colors';
import { getVehicles } from '../../../src/features/vehicles/services/getVehicles';
import { createWorkSession } from '../../../src/features/workSessions/services/createWorkSession';

function getVehicleImage(type: string) {
  switch (type) {
    case 'motorcycle':
      return require('../../../assets/vehicles/motorcycle.png');
    case 'utility':
      return require('../../../assets/vehicles/utility.png');
    default:
      return require('../../../assets/vehicles/car.png');
  }
}

function formatKm(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 6);
  return numbers ? Number(numbers).toLocaleString('pt-BR') : '';
}

function onlyNumbers(value: string) {
  return Number(value.replace(/\./g, '')) || 0;
}

function formatDateInput(date: Date) {
  return date.toLocaleDateString('pt-BR');
}

function formatTimeInput(date: Date) {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
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

function maskTime(text: string) {
  const numbers = text.replace(/\D/g, '').slice(0, 4);

  if (numbers.length > 2) {
    return `${numbers.slice(0, 2)}:${numbers.slice(2)}`;
  }

  return numbers;
}

function parseDateTime(dateText: string, timeText: string) {
  const [day, month, year] = dateText.split('/');
  const [hour, minute] = timeText.split(':');

  if (!day || !month || !year || !hour || !minute) {
    return null;
  }

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export default function NewSessionScreen() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [manualTimeModalVisible, setManualTimeModalVisible] = useState(false);

  const [startKm, setStartKm] = useState('');
  const [loading, setLoading] = useState(false);

  const [manualStartDate, setManualStartDate] = useState<Date | null>(null);
  const [dateInput, setDateInput] = useState(formatDateInput(new Date()));
  const [timeInput, setTimeInput] = useState(formatTimeInput(new Date()));

  useEffect(() => {
    loadVehicles();
  }, []);

  async function loadVehicles() {
    try {
      const response = await getVehicles();

      setVehicles(response);

      if (response.length > 0) {
        setSelectedVehicle(response[0]);

        setStartKm(
          Number(response[0].current_km ?? 0).toLocaleString('pt-BR'),
        );
      }
    } catch (error) {
      console.log(error);
    }
  }

  function openManualTimeModal() {
    const date = manualStartDate ?? new Date();

    setDateInput(formatDateInput(date));
    setTimeInput(formatTimeInput(date));
    setManualTimeModalVisible(true);
  }

  function handleSaveManualTime() {
    const parsedDate = parseDateTime(dateInput, timeInput);

    if (!parsedDate) {
      Alert.alert('Data inválida', 'Informe uma data e hora válidas.');
      return;
    }

    const now = new Date();

    if (parsedDate > now) {
    Alert.alert(
        'Horário inválido',
        'O horário inicial não pode ser maior que o horário atual.',
    );
    return;
    }

    setManualStartDate(parsedDate);
    setManualTimeModalVisible(false);
  }

  function handleDeleteManualTime() {
    Alert.alert(
      'Remover horário',
      'Deseja remover o horário inicial manual?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => setManualStartDate(null),
        },
      ],
    );
  }

  async function handleStartSession() {
    try {
      if (!selectedVehicle) {
        Alert.alert('Atenção', 'Selecione um veículo.');
        return;
      }

      const parsedKm = onlyNumbers(startKm);

      if (!parsedKm) {
        Alert.alert('Atenção', 'Informe o KM inicial.');
        return;
      }

      setLoading(true);

      const session = await createWorkSession({
        vehicle_id: selectedVehicle.id,
        start_km: parsedKm,
        started_at: manualStartDate ?? new Date(),
      });

      router.replace({
        pathname: '/(private)/jornada-ativa',
        params: {
          id: session.id,
        },
      });
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message ?? 'Não foi possível iniciar a jornada.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Nova jornada</Text>

        <Text style={styles.subtitle}>
          Defina o veículo e inicie seu turno.
        </Text>

        <Text style={styles.label}>Veículo</Text>

        <TouchableOpacity
          style={styles.vehicleSelect}
          onPress={() => setVehicleModalVisible(true)}
          activeOpacity={0.85}
        >
          {selectedVehicle ? (
            <>
              <Image
                source={getVehicleImage(selectedVehicle.type)}
                style={styles.vehicleImage}
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.vehicleName}>
                  {selectedVehicle.model} - {selectedVehicle.plate}
                </Text>

                <Text style={styles.vehicleKm}>
                  {Number(selectedVehicle.current_km ?? 0).toLocaleString(
                    'pt-BR',
                  )}{' '}
                  km
                </Text>
              </View>

              <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
            </>
          ) : (
            <Text style={styles.emptyText}>Nenhum veículo cadastrado</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>KM inicial</Text>

        <View style={styles.inputBox}>
          <TextInput
            value={startKm}
            onChangeText={(text) => setStartKm(formatKm(text))}
            keyboardType="numeric"
            placeholder="Ex: 45.678"
            placeholderTextColor="#71717A"
            style={styles.input}
          />

          <Text style={styles.kmSuffix}>km</Text>
        </View>

        {!manualStartDate ? (
          <TouchableOpacity
            style={styles.manualTimeButton}
            onPress={openManualTimeModal}
          >
            <Ionicons name="time-outline" size={20} color="#22C55E" />

            <Text style={styles.manualTimeButtonText}>
              Definir horário inicial manualmente
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.manualTimeCard}>
            <View>
              <Text style={styles.manualTimeLabel}>Horário inicial</Text>

              <Text style={styles.manualTimeValue}>
                {formatDateInput(manualStartDate)} às{' '}
                {formatTimeInput(manualStartDate)}
              </Text>
            </View>

            <View style={styles.manualActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={openManualTimeModal}
              >
                <Ionicons name="create-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconButtonDanger}
                onPress={handleDeleteManualTime}
              >
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={handleStartSession}
          disabled={loading}
        >
          <Ionicons name="play-circle-outline" size={26} color="#FFFFFF" />

          <Text style={styles.buttonText}>
            {loading ? 'Iniciando...' : 'Iniciar jornada'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={vehicleModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Escolher veículo</Text>

              <TouchableOpacity onPress={() => setVehicleModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {vehicles.map((vehicle) => (
              <TouchableOpacity
                key={vehicle.id}
                style={styles.vehicleOption}
                onPress={() => {
                  setSelectedVehicle(vehicle);
                  setStartKm(
                    Number(vehicle.current_km ?? 0).toLocaleString('pt-BR'),
                  );
                  setVehicleModalVisible(false);
                }}
              >
                <Image
                  source={getVehicleImage(vehicle.type)}
                  style={styles.vehicleOptionImage}
                />

                <View>
                  <Text style={styles.vehicleOptionTitle}>
                    {vehicle.brand} {vehicle.model}
                  </Text>

                  <Text style={styles.vehicleOptionPlate}>
                    {vehicle.plate}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={manualTimeModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Horário inicial</Text>

                <TouchableOpacity
                  onPress={() => setManualTimeModalVisible(false)}
                >
                  <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.dateRow}>
                <View style={[styles.inputBox, { flex: 1 }]}>
                  <TextInput
                    value={dateInput}
                    onChangeText={(text) => setDateInput(maskDate(text))}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor="#71717A"
                    keyboardType="numeric"
                    maxLength={10}
                    style={styles.input}
                  />
                </View>

                <View style={[styles.inputBox, { flex: 1 }]}>
                  <TextInput
                    value={timeInput}
                    onChangeText={(text) => setTimeInput(maskTime(text))}
                    placeholder="HH:MM"
                    placeholderTextColor="#71717A"
                    keyboardType="numeric"
                    maxLength={5}
                    style={styles.input}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveManualTime}
              >
                <Text style={styles.modalSaveButtonText}>Definir horário</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },

  subtitle: {
    color: '#71717A',
    marginTop: 6,
    marginBottom: 28,
  },

  label: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },

  vehicleSelect: {
    minHeight: 74,
    borderRadius: 16,
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 18,
  },

  vehicleImage: {
    width: 82,
    height: 52,
    resizeMode: 'contain',
    marginRight: 12,
  },

  vehicleName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  vehicleKm: {
    color: '#A1A1AA',
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
  },

  emptyText: {
    color: '#71717A',
    fontWeight: '700',
  },

  inputBox: {
    height: 58,
    borderRadius: 16,
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    padding: 0,
  },

  kmSuffix: {
    color: '#A1A1AA',
    fontSize: 15,
    fontWeight: '700',
  },

  manualTimeButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
  },

  manualTimeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  manualTimeCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  manualTimeLabel: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
  },

  manualTimeValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },

  manualActions: {
    flexDirection: 'row',
    gap: 8,
  },

  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconButtonDanger: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },

  button: {
    height: 62,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  modalContent: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },

  vehicleOption: {
    height: 76,
    borderRadius: 18,
    backgroundColor: '#18181B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 10,
  },

  vehicleOptionImage: {
    width: 76,
    height: 50,
    resizeMode: 'contain',
    marginRight: 12,
  },

  vehicleOptionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  vehicleOptionPlate: {
    color: '#71717A',
    marginTop: 4,
    fontSize: 13,
  },

  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },

  modalSaveButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});