import { useEffect, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { router } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../src/constants/colors';

import { createVehicle } from '../../../src/features/vehicles/services/createVehicle';
import { getVehicles } from '../../../src/features/vehicles/services/getVehicles';

const vehicleTypes = [
  { id: 'car', label: 'Carro', icon: 'car-outline' },
  { id: 'motorcycle', label: 'Moto', icon: 'bicycle-outline' },
  { id: 'utility', label: 'Utilitário', icon: 'cube-outline' },
];

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

function getRevisionStatus(currentKm: number, nextRevisionKm: number) {
  const remainingKm = nextRevisionKm - currentKm;

  if (!nextRevisionKm) {
    return {
      label: 'Sem revisão',
      color: '#71717A',
      hint: 'Informe a próxima revisão',
    };
  }

  if (remainingKm <= 0) {
    return {
      label: 'Atrasada',
      color: '#EF4444',
      hint: 'Revisão vencida',
    };
  }

  if (remainingKm <= 1000) {
    return {
      label: 'Próxima',
      color: '#F59E0B',
      hint: `Faltam ${remainingKm.toLocaleString('pt-BR')} km`,
    };
  }

  return {
    label: 'Em dia',
    color: '#22C55E',
    hint: `Faltam ${remainingKm.toLocaleString('pt-BR')} km`,
  };
}

export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');
  const [type, setType] = useState('car');
  const [currentKm, setCurrentKm] = useState('');
  const [nextRevisionKm, setNextRevisionKm] = useState('');

  useEffect(() => {
    loadVehicles();
  }, []);

  async function loadVehicles() {
    try {
      const response = await getVehicles();

      setVehicles(response);
    } catch (error) {
      console.log(error);
    }
  }

  async function handleCreateVehicle() {
    try {
      if (!brand || !model || !year || !plate) {
        Alert.alert('Atenção', 'Preencha os campos obrigatórios.');
        return;
      }

      await createVehicle({
        brand,
        model,
        year: Number(year),
        plate,
        type,
        current_km:
        Number(
            currentKm.replace(/\./g, ''),
            ) || 0,

        next_revision_km:
            Number(
            nextRevisionKm.replace(/\./g, ''),
            ) || 0,
      });

      setModalVisible(false);

      setBrand('');
      setModel('');
      setYear('');
      setPlate('');
      setType('car');
      setCurrentKm('');
      setNextRevisionKm('');

      loadVehicles();
    } catch (error) {
      console.log(error);

      Alert.alert('Erro', 'Não foi possível cadastrar o veículo.');
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
          <View>
            <Text style={styles.title}>Veículos</Text>

            <Text style={styles.subtitle}>Gerencie seus veículos.</Text>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {vehicles.map((vehicle, index) => {
          const current = Number(vehicle.current_km ?? 0);
          const nextRevision = Number(vehicle.next_revision_km ?? 0);
          const revisionStatus = getRevisionStatus(current, nextRevision);

          return (
            <TouchableOpacity
              key={vehicle.id}
              activeOpacity={0.85}
              style={styles.vehicleCard}
              onPress={() =>
                router.push({
                  pathname: '/(private)/veiculo-detalhes',
                  params: {
                    id: vehicle.id,
                  },
                })
              }
            >
              <View style={styles.vehicleTop}>
                <Image
                  source={getVehicleImage(vehicle.type)}
                  style={styles.vehicleImage}
                />

                <View style={{ flex: 1 }}>
                  <View style={styles.vehicleTitleRow}>
                    <Text style={styles.vehicleTitle}>
                      {vehicle.model}
                    </Text>

                    {index === 0 ? (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>
                          Padrão
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.vehiclePlate}>
                    {vehicle.plate}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.vehicleInfoRow}>
                <View>
                  <Text style={styles.infoLabel}>Km atual</Text>

                  <Text style={styles.infoValue}>
                    {current.toLocaleString('pt-BR')} km
                  </Text>
                </View>

                <View>
                  <Text style={styles.infoLabel}>Próxima revisão</Text>

                  <Text style={styles.infoValue}>
                    {nextRevision.toLocaleString('pt-BR')} km
                  </Text>
                </View>
              </View>

              <View style={styles.revisionFooter}>
                <View
                  style={[
                    styles.revisionBadge,
                    {
                      borderColor: revisionStatus.color,
                      backgroundColor: `${revisionStatus.color}20`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.revisionBadgeText,
                      {
                        color: revisionStatus.color,
                      },
                    ]}
                  >
                    {revisionStatus.label}
                  </Text>
                </View>

                <Text style={styles.revisionHint}>
                  {revisionStatus.hint}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
        behavior={
            Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
        style={{ flex: 1 }}
        >
            <View style={styles.modalOverlay}>
                <ScrollView
                    contentContainerStyle={styles.modalScroll}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHeaderLeft}>
                                <View style={styles.modalIcon}>
                                    <Ionicons
                                    name="car-outline"
                                    size={25}
                                    color="#FFFFFF"
                                    />
                                </View>

                                <View>
                                    <Text style={styles.modalTitle}>Novo veículo</Text>

                                    <Text style={styles.modalSubtitle}>
                                        Preencha as informações do veículo
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setModalVisible(false)}
                            >
                            <Ionicons name="close" size={25} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.typesRow}>
                            {vehicleTypes.map((item) => {
                            const selected = type === item.id;

                            return (
                                <TouchableOpacity
                                key={item.id}
                                style={[
                                    styles.typeButton,
                                    selected && styles.typeButtonActive,
                                ]}
                                onPress={() => setType(item.id)}
                                activeOpacity={0.85}
                                >
                                <Ionicons
                                    name={item.icon as any}
                                    size={24}
                                    color="#FFFFFF"
                                />

                                <Text style={styles.typeText}>{item.label}</Text>

                                {selected ? <View style={styles.typeArrow} /> : null}
                                </TouchableOpacity>
                            );
                            })}
                        </View>

                        <View style={styles.inputBox}>
                            <Ionicons name="pricetag-outline" size={22} color="#22C55E" />

                            <View style={{ flex: 1 }}>
                            <Text style={styles.inputLabel}>Marca</Text>

                            <TextInput
                                value={brand}
                                onChangeText={setBrand}
                                placeholder="Ex: Toyota, Honda, Fiat"
                                placeholderTextColor="#71717A"
                                style={styles.input}
                            />
                            </View>
                        </View>

                        <View style={styles.inputBox}>
                            <Ionicons name="car-outline" size={22} color="#22C55E" />

                            <View style={{ flex: 1 }}>
                            <Text style={styles.inputLabel}>Modelo</Text>

                            <TextInput
                                value={model}
                                onChangeText={setModel}
                                placeholder="Ex: Corolla, Civic, Uno"
                                placeholderTextColor="#71717A"
                                style={styles.input}
                            />
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={[styles.inputBox, { flex: 1 }]}>
                            <Ionicons
                                name="calendar-outline"
                                size={22}
                                color="#22C55E"
                            />

                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Ano</Text>

                                <TextInput
                                value={year}
                                onChangeText={setYear}
                                placeholder="2024"
                                placeholderTextColor="#71717A"
                                keyboardType="numeric"
                                maxLength={4}
                                style={styles.input}
                                />
                            </View>
                            </View>

                            <View style={[styles.inputBox, { flex: 1 }]}>
                            <Ionicons
                                name="barcode-outline"
                                size={22}
                                color="#22C55E"
                            />

                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Placa</Text>

                                <TextInput
                                value={plate}
                                onChangeText={(text) => setPlate(text.toUpperCase())}
                                placeholder="ABC1D23"
                                placeholderTextColor="#71717A"
                                autoCapitalize="characters"
                                maxLength={7}
                                style={styles.input}
                                />
                            </View>
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={[styles.inputBox, { flex: 1 }]}>
                            <Ionicons
                                name="speedometer-outline"
                                size={22}
                                color="#22C55E"
                            />

                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>KM atual</Text>

                                <TextInput
                                value={currentKm}
                                onChangeText={(text) => {
                                    const numbers = text.replace(/\D/g, '').slice(0, 6);

                                    const formatted = Number(numbers).toLocaleString('pt-BR');

                                    setCurrentKm(
                                    numbers ? formatted : '',
                                    );
                                }}
                                placeholder="Ex: 58.450"
                                placeholderTextColor="#71717A"
                                keyboardType="numeric"
                                style={styles.input}
                                />
                            </View>
                            </View>

                            <View style={[styles.inputBox, { flex: 1 }]}>
                            <Ionicons
                                name="construct-outline"
                                size={22}
                                color="#22C55E"
                            />

                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Próxima revisão</Text>

                                <TextInput
                                value={nextRevisionKm}
                                onChangeText={(text) => {
                                    const numbers = text.replace(/\D/g, '').slice(0, 6);

                                    const formatted = Number(numbers).toLocaleString('pt-BR');

                                    setNextRevisionKm(
                                    numbers ? formatted : '',
                                    );
                                }}
                                placeholder="Ex: 60.000"
                                placeholderTextColor="#71717A"
                                keyboardType="numeric"
                                style={styles.input}
                                />
                            </View>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleCreateVehicle}
                            activeOpacity={0.9}
                        >
                            <Ionicons
                            name="checkmark-circle-outline"
                            size={22}
                            color="#FFFFFF"
                            />

                            <Text style={styles.saveButtonText}>Salvar veículo</Text>
                        </TouchableOpacity>

                        <View style={styles.secureRow}>
                            <Ionicons name="lock-closed-outline" size={18} color="#71717A" />

                            <Text style={styles.secureText}>
                            Suas informações estão seguras
                            </Text>
                        </View>
                    </View>
                </ScrollView>
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
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

  vehicleCard: {
    backgroundColor: '#0D1117',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 14,
  },

  vehicleTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  vehicleImage: {
    width: 82,
    height: 58,
    resizeMode: 'contain',
    marginRight: 14,
  },

  vehicleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  vehicleTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  vehiclePlate: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },

  defaultBadge: {
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderColor: 'rgba(34,197,94,0.35)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  defaultBadgeText: {
    color: '#22C55E',
    fontSize: 10,
    fontWeight: '800',
  },

  divider: {
    height: 1,
    backgroundColor: '#1F2937',
    marginVertical: 14,
  },

  vehicleInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  infoLabel: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
  },

  infoValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 6,
  },

  revisionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },

  revisionBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  revisionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },

  revisionHint: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },

  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 28,
  },

  modalContent: {
    backgroundColor: '#07111F',
    borderRadius: 34,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1F2937',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 26,
  },

  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  modalIcon: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },

  modalSubtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    marginTop: 3,
  },

  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  typesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },

  typeButton: {
    flex: 1,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#151E2B',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#1F2937',
  },

  typeButtonActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  typeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 0,
  },

  typeArrow: {
    position: 'absolute',
    bottom: -11,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#22C55E',
  },

  inputBox: {
    minHeight: 72,
    borderRadius: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },

  inputLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 5,
  },

  input: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    padding: 0,
    margin: 0,
  },

  formRow: {
    flexDirection: 'row',
    gap: 12,
  },

  saveButton: {
    height: 50,
    borderRadius: 22,
    backgroundColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 18,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  secureRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
  },

  secureText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
  },
});