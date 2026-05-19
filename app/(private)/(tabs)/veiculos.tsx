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

import { useEffect, useState } from 'react';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../src/constants/colors';

import { createVehicle } from '../../../src/features/vehicles/services/createVehicle';

import { getVehicles } from '../../../src/features/vehicles/services/getVehicles';

const vehicleTypes = [
  {
    id: 'car',
    label: 'Carro',
    icon: 'car-outline',
  },

  {
    id: 'motorcycle',
    label: 'Moto',
    icon: 'bicycle-outline',
  },

  {
    id: 'utility',
    label: 'Utilitário',
    icon: 'bus-outline',
  },
];

export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState<any[]>([]);

  const [modalVisible, setModalVisible] =
    useState(false);

  const [brand, setBrand] = useState('');

  const [model, setModel] = useState('');

  const [year, setYear] = useState('');

  const [plate, setPlate] = useState('');

  const [type, setType] = useState('car');

  const [currentKm, setCurrentKm] =
    useState('');

  const [nextRevisionKm, setNextRevisionKm] =
    useState('');

  async function loadVehicles() {
    try {
      const response =
        await getVehicles();

      setVehicles(response);
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    loadVehicles();
  }, []);

  async function handleCreateVehicle() {
    try {
      if (
        !brand ||
        !model ||
        !year ||
        !plate
      ) {
        Alert.alert(
          'Atenção',
          'Preencha os campos obrigatórios.',
        );

        return;
      }

      await createVehicle({
        brand,

        model,

        year: Number(year),

        plate,

        type,

        current_km:
          Number(currentKm) || 0,

        next_revision_km:
          Number(nextRevisionKm) || 0,
      });

      setModalVisible(false);

      setBrand('');

      setModel('');

      setYear('');

      setPlate('');

      setCurrentKm('');

      setNextRevisionKm('');

      loadVehicles();
    } catch (error) {
      console.log(error);

      Alert.alert(
        'Erro',
        'Não foi possível cadastrar o veículo.',
      );
    }
  }

  function getVehicleIcon(type: string) {
    switch (type) {
      case 'motorcycle':
        return 'bicycle-outline';

      case 'utility':
        return 'bus-outline';

      default:
        return 'car-outline';
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
            <Text style={styles.title}>
              Veículos
            </Text>

            <Text style={styles.subtitle}>
              Gerencie seus veículos.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() =>
              setModalVisible(true)
            }
          >
            <Ionicons
              name="add"
              size={26}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        {vehicles.map((vehicle) => {
          const remainingKm =
            Number(
              vehicle.next_revision_km,
            ) -
            Number(
              vehicle.current_km,
            );

          return (
            <View
              key={vehicle.id}
              style={styles.vehicleCard}
            >
              <View style={styles.vehicleTop}>
                <View style={styles.vehicleIcon}>
                  <Ionicons
                    name={getVehicleIcon(
                      vehicle.type,
                    )}
                    size={26}
                    color="#22C55E"
                  />
                </View>

                <View
                  style={{ flex: 1 }}
                >
                  <Text
                    style={
                      styles.vehicleTitle
                    }
                  >
                    {vehicle.brand}{' '}
                    {vehicle.model}
                  </Text>

                  <Text
                    style={
                      styles.vehiclePlate
                    }
                  >
                    {vehicle.plate}
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.vehicleInfoRow
                }
              >
                <View>
                  <Text
                    style={
                      styles.infoLabel
                    }
                  >
                    KM atual
                  </Text>

                  <Text
                    style={
                      styles.infoValue
                    }
                  >
                    {Number(
                      vehicle.current_km,
                    ).toLocaleString(
                      'pt-BR',
                    )}
                  </Text>
                </View>

                <View>
                  <Text
                    style={
                      styles.infoLabel
                    }
                  >
                    Revisão
                  </Text>

                  <Text
                    style={[
                      styles.infoValue,

                      remainingKm <=
                        1000 && {
                        color:
                          '#F59E0B',
                      },
                    ]}
                  >
                    {remainingKm <= 0
                      ? 'Atrasada'
                      : `${remainingKm.toLocaleString(
                          'pt-BR',
                        )} km`}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <ScrollView
            contentContainerStyle={
              styles.modalScroll
            }
          >
            <View
              style={
                styles.modalContent
              }
            >
              <View
                style={
                  styles.modalHeader
                }
              >
                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Novo veículo
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    setModalVisible(
                      false,
                    )
                  }
                >
                  <Ionicons
                    name="close"
                    size={26}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>

              <View
                style={
                  styles.typesRow
                }
              >
                {vehicleTypes.map(
                  (item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.typeButton,

                        type ===
                          item.id && {
                          backgroundColor:
                            '#22C55E',
                        },
                      ]}
                      onPress={() =>
                        setType(
                          item.id,
                        )
                      }
                    >
                      <Ionicons
                        name={
                          item.icon as any
                        }
                        size={20}
                        color="#FFFFFF"
                      />

                      <Text
                        style={
                          styles.typeText
                        }
                      >
                        {
                          item.label
                        }
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>

              <TextInput
                value={brand}
                onChangeText={
                  setBrand
                }
                placeholder="Marca"
                placeholderTextColor="#71717A"
                style={styles.input}
              />

              <TextInput
                value={model}
                onChangeText={
                  setModel
                }
                placeholder="Modelo"
                placeholderTextColor="#71717A"
                style={styles.input}
              />

              <View
                style={styles.row}
              >
                <TextInput
                  value={year}
                  onChangeText={
                    setYear
                  }
                  placeholder="Ano"
                  keyboardType="numeric"
                  placeholderTextColor="#71717A"
                  style={[
                    styles.input,
                    {
                      flex: 1,
                    },
                  ]}
                />

                <TextInput
                  value={plate}
                  onChangeText={(
                    text,
                  ) =>
                    setPlate(
                      text.toUpperCase(),
                    )
                  }
                  placeholder="Placa"
                  placeholderTextColor="#71717A"
                  style={[
                    styles.input,
                    {
                      flex: 1,
                    },
                  ]}
                />
              </View>

              <View
                style={styles.row}
              >
                <TextInput
                  value={currentKm}
                  onChangeText={
                    setCurrentKm
                  }
                  placeholder="KM atual"
                  keyboardType="numeric"
                  placeholderTextColor="#71717A"
                  style={[
                    styles.input,
                    {
                      flex: 1,
                    },
                  ]}
                />

                <TextInput
                  value={
                    nextRevisionKm
                  }
                  onChangeText={
                    setNextRevisionKm
                  }
                  placeholder="Próxima revisão"
                  keyboardType="numeric"
                  placeholderTextColor="#71717A"
                  style={[
                    styles.input,
                    {
                      flex: 1,
                    },
                  ]}
                />
              </View>

              <TouchableOpacity
                style={
                  styles.saveButton
                }
                onPress={
                  handleCreateVehicle
                }
              >
                <Text
                  style={
                    styles.saveButtonText
                  }
                >
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
    backgroundColor:
      colors.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 140,
  },

  header: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',

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

    backgroundColor:
      '#22C55E',

    alignItems: 'center',

    justifyContent: 'center',
  },

  vehicleCard: {
    backgroundColor:
      '#18181B',

    borderRadius: 26,

    padding: 18,

    marginBottom: 14,
  },

  vehicleTop: {
    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 20,
  },

  vehicleIcon: {
    width: 58,

    height: 58,

    borderRadius: 18,

    backgroundColor:
      '#111827',

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 14,
  },

  vehicleTitle: {
    color: '#FFFFFF',

    fontSize: 18,

    fontWeight: '800',
  },

  vehiclePlate: {
    color: '#71717A',

    marginTop: 4,
  },

  vehicleInfoRow: {
    flexDirection: 'row',

    justifyContent:
      'space-between',
  },

  infoLabel: {
    color: '#71717A',

    fontSize: 13,
  },

  infoValue: {
    color: '#FFFFFF',

    fontSize: 18,

    fontWeight: '800',

    marginTop: 6,
  },

  modalOverlay: {
    flex: 1,

    backgroundColor:
      'rgba(0,0,0,0.7)',
  },

  modalScroll: {
    flexGrow: 1,

    justifyContent:
      'center',

    padding: 20,
  },

  modalContent: {
    backgroundColor:
      '#111827',

    borderRadius: 28,

    padding: 20,
  },

  modalHeader: {
    flexDirection: 'row',

    justifyContent:
      'space-between',

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

    justifyContent:
      'space-between',

    marginBottom: 18,
  },

  typeButton: {
    flex: 1,

    height: 54,

    borderRadius: 18,

    backgroundColor:
      '#18181B',

    alignItems: 'center',

    justifyContent: 'center',

    marginHorizontal: 4,
  },

  typeText: {
    color: '#FFFFFF',

    fontSize: 12,

    fontWeight: '700',

    marginTop: 4,
  },

  input: {
    height: 58,

    backgroundColor:
      '#18181B',

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

    backgroundColor:
      '#22C55E',

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