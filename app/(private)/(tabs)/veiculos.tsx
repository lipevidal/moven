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
  ActivityIndicator,
} from 'react-native';

import { router } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../src/constants/colors';

import { supabase } from '../../../src/database/supabase';

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

function formatKmInput(value?: number | string | null) {
  const numbers = String(value ?? '').replace(/\D/g, '').slice(0, 6);

  if (!numbers) return '';

  return Number(numbers).toLocaleString('pt-BR');
}

function parseKmInput(value: string) {
  return Number(value.replace(/\./g, '')) || 0;
}

function resetVehicleFormFields({
  setBrand,
  setModel,
  setYear,
  setPlate,
  setType,
  setCurrentKm,
  setNextRevisionKm,
}: {
  setBrand: (value: string) => void;
  setModel: (value: string) => void;
  setYear: (value: string) => void;
  setPlate: (value: string) => void;
  setType: (value: string) => void;
  setCurrentKm: (value: string) => void;
  setNextRevisionKm: (value: string) => void;
}) {
  setBrand('');
  setModel('');
  setYear('');
  setPlate('');
  setType('car');
  setCurrentKm('');
  setNextRevisionKm('');
}

export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null);

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

  function resetVehicleForm() {
    setEditingVehicleId(null);

    resetVehicleFormFields({
      setBrand,
      setModel,
      setYear,
      setPlate,
      setType,
      setCurrentKm,
      setNextRevisionKm,
    });
  }

  function openCreateVehicleModal() {
    resetVehicleForm();
    setModalVisible(true);
  }

  function openEditVehicleModal(vehicle: any) {
    setEditingVehicleId(String(vehicle.id));
    setBrand(vehicle.brand ?? '');
    setModel(vehicle.model ?? '');
    setYear(vehicle.year ? String(vehicle.year) : '');
    setPlate(vehicle.plate ?? '');
    setType(vehicle.type ?? 'car');
    setCurrentKm(formatKmInput(vehicle.current_km));
    setNextRevisionKm(formatKmInput(vehicle.next_revision_km));
    setModalVisible(true);
  }

  function closeVehicleModal() {
    setModalVisible(false);
    resetVehicleForm();
  }

  async function handleSaveVehicle() {
    try {
      if (!brand || !model || !year || !plate) {
        Alert.alert('Atenção', 'Preencha os campos obrigatórios.');
        return;
      }

      setSavingVehicle(true);

      const vehicleData = {
        brand: brand.trim(),
        model: model.trim(),
        year: Number(year),
        plate: plate.trim().toUpperCase(),
        type,
        current_km: parseKmInput(currentKm),
        next_revision_km: parseKmInput(nextRevisionKm),
      };

      if (editingVehicleId) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user?.id) {
          Alert.alert('Sessão expirada', 'Entre novamente para editar o veículo.');
          return;
        }

        const { error } = await supabase
          .from('vehicles')
          .update(vehicleData)
          .eq('id', editingVehicleId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        await createVehicle(vehicleData);
      }

      closeVehicleModal();

      await loadVehicles();
    } catch (error) {
      console.log(error);

      Alert.alert(
        'Erro',
        editingVehicleId
          ? 'Não foi possível editar o veículo.'
          : 'Não foi possível cadastrar o veículo.',
      );
    } finally {
      setSavingVehicle(false);
    }
  }

  function handleDeleteVehicle(vehicle: any) {
    Alert.alert(
      'Excluir veículo',
      `Deseja realmente excluir ${vehicle.brand ?? ''} ${vehicle.model ?? ''}? Essa ação não poderá ser desfeita.`,
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
              setDeletingVehicleId(String(vehicle.id));

              const {
                data: { user },
                error: userError,
              } = await supabase.auth.getUser();

              if (userError) throw userError;

              if (!user?.id) {
                Alert.alert('Sessão expirada', 'Entre novamente para excluir o veículo.');
                return;
              }

              const { error } = await supabase
                .from('vehicles')
                .delete()
                .eq('id', vehicle.id)
                .eq('user_id', user.id);

              if (error) throw error;

              await loadVehicles();
            } catch (error: any) {
              console.log(error);

              const message = String(error?.message ?? '').toLowerCase();

              Alert.alert(
                'Erro',
                message.includes('foreign key') ||
                  message.includes('violates') ||
                  message.includes('constraint')
                  ? 'Não foi possível excluir este veículo porque ele possui jornadas ou despesas vinculadas.'
                  : 'Não foi possível excluir este veículo.',
              );
            } finally {
              setDeletingVehicleId(null);
            }
          },
        },
      ],
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
            <Text style={styles.title}>Veículos</Text>

            <Text style={styles.subtitle}>Gerencie seus veículos.</Text>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={openCreateVehicleModal}
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

                <View style={styles.vehicleActions}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.vehicleActionButton}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      openEditVehicleModal(vehicle);
                    }}
                  >
                    <Ionicons name="create-outline" size={18} color="#60A5FA" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.vehicleActionButtonDanger}
                    disabled={deletingVehicleId === String(vehicle.id)}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      handleDeleteVehicle(vehicle);
                    }}
                  >
                    {deletingVehicleId === String(vehicle.id) ? (
                      <ActivityIndicator size="small" color="#FCA5A5" />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
                    )}
                  </TouchableOpacity>
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
                                    <Text style={styles.modalTitle}>
                                        {editingVehicleId ? 'Editar veículo' : 'Novo veículo'}
                                    </Text>

                                    <Text style={styles.modalSubtitle}>
                                        {editingVehicleId
                                        ? 'Atualize as informações do veículo'
                                        : 'Preencha as informações do veículo'}
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={closeVehicleModal}
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
                            style={[styles.saveButton, savingVehicle && styles.saveButtonDisabled]}
                            onPress={handleSaveVehicle}
                            activeOpacity={0.9}
                            disabled={savingVehicle}
                        >
                            {savingVehicle ? (
                            <ActivityIndicator color="#FFFFFF" />
                            ) : (
                            <>
                                <Ionicons
                                name="checkmark-circle-outline"
                                size={22}
                                color="#FFFFFF"
                                />

                                <Text style={styles.saveButtonText}>
                                {editingVehicleId ? 'Salvar alterações' : 'Salvar veículo'}
                                </Text>
                            </>
                            )}
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

  vehicleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 10,
  },

  vehicleActionButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  vehicleActionButtonDanger: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
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

  saveButtonDisabled: {
    opacity: 0.65,
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