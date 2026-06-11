import { useEffect, useMemo, useState } from 'react';
import { searchMunicipalities } from '../../../src/features/municipalities/services/searchMunicipalities';
import { getLastMunicipality } from '../../../src/features/municipalities/services/getLastMunicipality';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Modal,
  Alert,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { colors } from '../../../src/constants/colors';

import { getVehicles } from '../../../src/features/vehicles/services/getVehicles';
import { createWorkSession } from '../../../src/features/workSessions/services/createWorkSession';

function vehicleImage(type: string) {
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

  if (!numbers) return '';

  return Number(numbers).toLocaleString('pt-BR');
}

function parseKm(value: string) {
  return Number(value.replace(/\./g, ''));
}

function formatDate(date: Date) {
  return date.toLocaleDateString('pt-BR');
}

function formatTime(date: Date) {
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

export default function NewJourneyScreen() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

  const [vehicleModal, setVehicleModal] = useState(false);
  const [timeModalVisible, setTimeModalVisible] = useState(false);

  const [kmInitial, setKmInitial] = useState('');
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState(new Date());

  const [municipalityModalVisible, setMunicipalityModalVisible] = useState(false);
  const [municipalitySearch, setMunicipalitySearch] = useState('');
  const [municipalities, setMunicipalities] = useState<any[]>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState<any>(null);

  const [dateInput, setDateInput] = useState(
    formatDate(new Date()),
  );

  const [timeInput, setTimeInput] = useState(
    formatTime(new Date()),
  );

  async function handleSearchMunicipalities(text: string) {
    setMunicipalitySearch(text);

    if (text.trim().length < 2) {
      setMunicipalities([]);
      return;
    }

    const response = await searchMunicipalities(text);

    console.log('Cidades encontradas:', response);

    setMunicipalities(response);
  }

  async function loadLastMunicipality() {
    try {
      const lastMunicipality =
        await getLastMunicipality();

      if (lastMunicipality) {
        setSelectedMunicipality(
          lastMunicipality,
        );
      }
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    loadVehicles();
    loadLastMunicipality();
  }, []);

  async function loadVehicles() {
    try {
      const data = await getVehicles();

      setVehicles(data);

      if (data.length > 0) {
        setSelectedVehicle(data[0]);

        setKmInitial(
          Number(data[0].current_km ?? 0).toLocaleString('pt-BR'),
        );
      }
    } catch (error) {
      console.log(error);
    }
  }

  const startTimeLabel = useMemo(() => {
    return formatTime(startDate);
  }, [startDate]);

  function openTimeModal() {
    setDateInput(formatDate(startDate));
    setTimeInput(formatTime(startDate));

    setTimeModalVisible(true);
  }

  function handleSaveStartTime() {
    const parsedDate = parseDateTime(dateInput, timeInput);

    if (!parsedDate) {
      Alert.alert(
        'Data inválida',
        'Informe uma data e hora válidas.',
      );

      return;
    }

    if (parsedDate > new Date()) {
      Alert.alert(
        'Horário inválido',
        'O horário inicial não pode ser maior que o horário atual.',
      );

      return;
    }

    setStartDate(parsedDate);

    setTimeModalVisible(false);
  }

  async function handleStartJourney() {
    try {
      if (!selectedVehicle) {
        Alert.alert(
          'Atenção',
          'Selecione um veículo.',
        );

        return;
      }

      if (!kmInitial) {
        Alert.alert(
          'Atenção',
          'Informe o KM inicial.',
        );

        return;
      }

      if (!selectedMunicipality?.id) {
        Alert.alert(
          'Cidade obrigatória',
          'Selecione uma cidade para iniciar a jornada.',
        );

        return;
      }

      setLoading(true);

      const session = await createWorkSession({
        vehicle_id: selectedVehicle.id,
        start_km: parseKm(kmInitial),
        started_at: startDate,
        municipality_id: selectedMunicipality.id,
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
        error.message ??
          'Não foi possível iniciar a jornada.',
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
        <View style={styles.header}>
          <Text style={styles.title}>
            Nova jornada
          </Text>

          <Text style={styles.subtitle}>
            Inicie sua jornada de trabalho
          </Text>
        </View>

        <View style={styles.liveCard}>
          <View style={styles.liveLeft}>
            <View style={styles.liveDot} />

            <Text style={styles.liveText}>
              Jornada iniciará às {startTimeLabel}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.changeTimeButton}
            onPress={openTimeModal}
          >
            <Text style={styles.changeTimeText}>
              Alterar
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>
          Veículo
        </Text>

        <TouchableOpacity
          style={styles.vehicleCard}
          activeOpacity={0.85}
          onPress={() => setVehicleModal(true)}
        >
          {selectedVehicle ? (
            <>
              <Image
                source={vehicleImage(
                  selectedVehicle.type,
                )}
                style={styles.vehicleImage}
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.vehicleTitle}>
                  {selectedVehicle.model} -{' '}
                  {selectedVehicle.plate}
                </Text>

                <Text style={styles.vehicleKm}>
                  {Number(
                    selectedVehicle.current_km ?? 0,
                  ).toLocaleString('pt-BR')}{' '}
                  km
                </Text>
              </View>

              <Ionicons
                name="chevron-down"
                size={22}
                color="#FFFFFF"
              />
            </>
          ) : (
            <Text style={{ color: '#FFFFFF' }}>
              Nenhum veículo encontrado
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>
          KM atual
        </Text>

        <View style={styles.inputCard}>
          <TextInput
            value={kmInitial}
            onChangeText={(text) =>
              setKmInitial(formatKm(text))
            }
            keyboardType="numeric"
            placeholder="45.678 km"
            placeholderTextColor="#71717A"
            style={styles.input}
          />

          <Text style={styles.kmText}>
            km
          </Text>
        </View>

        <Text style={styles.label}>Cidade base</Text>

        <TouchableOpacity
          style={styles.selectCard}
          onPress={() => setMunicipalityModalVisible(true)}
        >
          <Ionicons name="location-outline" size={24} color="#22C55E" />

          <View style={{ flex: 1 }}>
            <Text style={styles.selectText}>
              {selectedMunicipality
                ? `${selectedMunicipality.name} - ${selectedMunicipality.uf}`
                : 'Selecionar cidade'}
            </Text>

            {selectedMunicipality?.immediate_region && (
              <Text style={styles.selectSubText}>
                Região: {selectedMunicipality.immediate_region}
              </Text>
            )}
          </View>

          <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.startButton}
          activeOpacity={0.85}
          onPress={handleStartJourney}
          disabled={loading}
        >
          <Ionicons
            name="play-circle"
            size={24}
            color="#FFFFFF"
          />

          <Text style={styles.startButtonText}>
            {loading
              ? 'Iniciando...'
              : 'Iniciar jornada'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={vehicleModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Selecionar veículo
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setVehicleModal(false)
                }
              >
                <Ionicons
                  name="close"
                  size={26}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            {vehicles.map((vehicle) => (
              <TouchableOpacity
                key={vehicle.id}
                style={styles.modalVehicle}
                activeOpacity={0.85}
                onPress={() => {
                  setSelectedVehicle(vehicle);

                  setKmInitial(
                    Number(
                      vehicle.current_km ?? 0,
                    ).toLocaleString('pt-BR'),
                  );

                  setVehicleModal(false);
                }}
              >
                <Image
                  source={vehicleImage(
                    vehicle.type,
                  )}
                  style={
                    styles.modalVehicleImage
                  }
                />

                <View style={{ flex: 1 }}>
                  <Text
                    style={
                      styles.modalVehicleTitle
                    }
                  >
                    {vehicle.model}
                  </Text>

                  <Text
                    style={
                      styles.modalVehiclePlate
                    }
                  >
                    {vehicle.plate}
                  </Text>
                </View>

                {selectedVehicle?.id ===
                  vehicle.id && (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color="#22C55E"
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal
        visible={timeModalVisible}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Alterar horário
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setTimeModalVisible(false)
                }
              >
                <Ionicons
                  name="close"
                  size={26}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              O horário não pode ser maior
              que o horário atual.
            </Text>

            <View style={styles.dateRow}>
              <View
                style={styles.dateInputBox}
              >
                <Text style={styles.inputLabel}>
                  Data
                </Text>

                <TextInput
                  value={dateInput}
                  onChangeText={(text) =>
                    setDateInput(
                      maskDate(text),
                    )
                  }
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#71717A"
                  keyboardType="numeric"
                  maxLength={10}
                  style={styles.modalInput}
                />
              </View>

              <View
                style={styles.dateInputBox}
              >
                <Text style={styles.inputLabel}>
                  Hora
                </Text>

                <TextInput
                  value={timeInput}
                  onChangeText={(text) =>
                    setTimeInput(
                      maskTime(text),
                    )
                  }
                  placeholder="HH:MM"
                  placeholderTextColor="#71717A"
                  keyboardType="numeric"
                  maxLength={5}
                  style={styles.modalInput}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.saveTimeButton}
              onPress={
                handleSaveStartTime
              }
            >
              <Text
                style={
                  styles.saveTimeButtonText
                }
              >
                Salvar horário
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={municipalityModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMunicipalityModalVisible(false)}
      >
        <View style={styles.municipalityModalOverlay}>
          <View style={styles.municipalityModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Escolher cidade</Text>

              <TouchableOpacity onPress={() => setMunicipalityModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={municipalitySearch}
              onChangeText={handleSearchMunicipalities}
              placeholder="Buscar cidade ou região"
              placeholderTextColor="#71717A"
              style={styles.municipalitySearchInput}
            />

            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {municipalitySearch.trim().length < 2 ? (
                <Text style={styles.emptyText}>
                  Digite pelo menos 2 letras para buscar uma cidade.
                </Text>
              ) : municipalities.length === 0 ? (
                <Text style={styles.emptyText}>Nenhuma cidade encontrada.</Text>
              ) : (
                municipalities.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.municipalityItem}
                    onPress={() => {
                      setSelectedMunicipality(item);
                      setMunicipalityModalVisible(false);
                    }}
                  >
                    <View>
                      <Text style={styles.municipalityName}>
                        {item.name} - {item.uf}
                      </Text>

                      <Text style={styles.municipalityRegion}>
                        Região: {item.immediate_region}
                      </Text>
                    </View>

                    {selectedMunicipality?.id === item.id && (
                      <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
                    )}
                  </TouchableOpacity>
                ))
              )}
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
    backgroundColor: colors.background,
  },

  content: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },

  header: {
    marginBottom: 24,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },

  subtitle: {
    color: '#71717A',
    fontSize: 15,
    marginTop: 4,
  },

  liveCard: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#03150C',
    borderWidth: 1,
    borderColor: '#14532D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 26,
  },

  liveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    marginRight: 10,
  },

  liveText: {
    color: '#DCFCE7',
    fontWeight: '700',
    flex: 1,
  },

  changeTimeButton: {
    height: 34,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  changeTimeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  label: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },

  vehicleCard: {
    minHeight: 82,
    borderRadius: 20,
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 22,
  },

  vehicleImage: {
    width: 86,
    height: 54,
    resizeMode: 'contain',
    marginRight: 12,
  },

  vehicleTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  vehicleKm: {
    color: '#71717A',
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
  },

  inputCard: {
    height: 74,
    borderRadius: 20,
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
  },

  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    padding: 0,
  },

  kmText: {
    color: '#71717A',
    fontSize: 16,
    fontWeight: '700',
  },

  startButton: {
    height: 62,
    borderRadius: 20,
    backgroundColor: '#003400',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 25
  },

  startButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.75)',
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
    marginBottom: 20,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },

  modalVehicle: {
    height: 78,
    borderRadius: 18,
    backgroundColor: '#18181B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 10,
  },

  modalVehicleImage: {
    width: 76,
    height: 50,
    resizeMode: 'contain',
    marginRight: 12,
  },

  modalVehicleTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  modalVehiclePlate: {
    color: '#71717A',
    marginTop: 4,
    fontSize: 13,
  },

  modalDescription: {
    color: '#A1A1AA',
    fontSize: 13,
    marginBottom: 14,
  },

  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },

  dateInputBox: {
    flex: 1,
    minHeight: 76,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  inputLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },

  modalInput: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    padding: 0,
  },

  saveTimeButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveTimeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  selectSubText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  municipalityItem: {
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  municipalityName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  municipalityRegion: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  selectCard: {
    minHeight: 62,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  selectText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  municipalityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },

  municipalityModalContent: {
    height: '75%',
    backgroundColor: '#09090B',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
  },

  municipalitySearchInput: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },

  emptyText: {
    color: '#71717A',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '600',
  },
});