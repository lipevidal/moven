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
    };
  }

  if (remainingKm <= 0) {
    return {
      label: 'Atrasada',
      color: '#EF4444',
    };
  }

  if (remainingKm <= 1000) {
    return {
      label: 'Próxima',
      color: '#F59E0B',
    };
  }

  return {
    label: 'Em dia',
    color: '#22C55E',
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
        current_km: Number(currentKm) || 0,
        next_revision_km: Number(nextRevisionKm) || 0,
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

            <Text style={styles.subtitle}>
              Gerencie seus veículos.
            </Text>
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
          const remainingKm = nextRevision - current;
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

                {remainingKm > 0 ? (
                  <Text style={styles.revisionHint}>
                    Faltam {remainingKm.toLocaleString('pt-BR')} km
                  </Text>
                ) : (
                  <Text style={styles.revisionHint}>
                    Revisão vencida
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Novo veículo</Text>

                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.typesRow}>
                {vehicleTypes.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.typeButton,
                      type === item.id && styles.typeButtonActive,
                    ]}
                    onPress={() => setType(item.id)}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={20}
                      color="#FFFFFF"
                    />

                    <Text style={styles.typeText}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                value={brand}
                onChangeText={setBrand}
                placeholder="Marca"
                placeholderTextColor="#71717A"
                style={styles.input}
              />

              <TextInput
                value={model}
                onChangeText={setModel}
                placeholder="Modelo"
                placeholderTextColor="#71717A"
                style={styles.input}
              />

              <View style={styles.row}>
                <TextInput
                  value={year}
                  onChangeText={setYear}
                  placeholder="Ano"
                  keyboardType="numeric"
                  placeholderTextColor="#71717A"
                  style={[styles.input, { flex: 1 }]}
                />

                <TextInput
                  value={plate}
                  onChangeText={(text) => setPlate(text.toUpperCase())}
                  placeholder="Placa"
                  placeholderTextColor="#71717A"
                  style={[styles.input, { flex: 1 }]}
                />
              </View>

              <View style={styles.row}>
                <TextInput
                  value={currentKm}
                  onChangeText={setCurrentKm}
                  placeholder="KM atual"
                  keyboardType="numeric"
                  placeholderTextColor="#71717A"
                  style={[styles.input, { flex: 1 }]}
                />

                <TextInput
                  value={nextRevisionKm}
                  onChangeText={setNextRevisionKm}
                  placeholder="Próxima revisão"
                  keyboardType="numeric"
                  placeholderTextColor="#71717A"
                  style={[styles.input, { flex: 1 }]}
                />
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleCreateVehicle}
              >
                <Text style={styles.saveButtonText}>
                  Salvar veículo
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

  typesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },

  typeButton: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  typeButtonActive: {
    backgroundColor: '#22C55E',
  },

  typeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  input: {
    height: 58,
    backgroundColor: '#18181B',
    borderRadius: 18,
    paddingHorizontal: 18,
    color: '#FFFFFF',
    marginBottom: 14,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
  },

  saveButton: {
    height: 58,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});