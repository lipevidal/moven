import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';

import { getVehicles } from '../../../src/features/vehicles/services/getVehicles';
import { createWorkSession } from '../../../src/features/workSessions/services/createWorkSession';
import { supabase } from '../../../src/database/supabase';

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

  async function loadUserDefaultMunicipality() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('default_municipality_id, city')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.log('Erro ao buscar perfil:', profileError);
        }

        if (profile?.default_municipality_id) {
          const { data: municipality, error: municipalityError } = await supabase
            .from('municipalities')
            .select('id, name, uf, state_name')
            .eq('id', profile.default_municipality_id)
            .maybeSingle();

          if (municipalityError) {
            console.log('Erro ao buscar cidade do usuário:', municipalityError);
          }

          if (municipality) {
            setSelectedMunicipality(municipality);
            return;
          }
        }

        if (profile?.city) {
          const response = await searchMunicipalities(profile.city);

          const municipality = response.find(
            (item: any) =>
              item.name?.toLowerCase() === profile.city?.toLowerCase(),
          ) ?? response[0];

          if (municipality) {
            setSelectedMunicipality(municipality);
            return;
          }
        }
      }

      const lastMunicipality = await getLastMunicipality();

      if (lastMunicipality) {
        setSelectedMunicipality(lastMunicipality);
      }
    } catch (error) {
      console.log(error);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
      loadUserDefaultMunicipality();
    }, []),
  );

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let componentMounted = true;

    async function subscribeToVehicleChanges() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id || !componentMounted) return;

      channel = supabase
        .channel(`new-journey-vehicles-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'vehicles',
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            await loadVehicles();
          },
        )
        .subscribe();
    }

    subscribeToVehicleChanges();

    return () => {
      componentMounted = false;

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  async function loadVehicles() {
    try {
      const data = await getVehicles();
      const safeVehicles = data ?? [];

      setVehicles(safeVehicles);

      setSelectedVehicle((current: any) => {
        if (safeVehicles.length === 0) {
          setKmInitial('');
          return null;
        }

        const stillSelected = safeVehicles.find(
          (vehicle: any) => vehicle.id === current?.id,
        );

        const nextVehicle = stillSelected ?? safeVehicles[0];

        if (!current?.id || current.id !== nextVehicle.id || !kmInitial.trim()) {
          setKmInitial(
            Number(nextVehicle.current_km ?? 0).toLocaleString('pt-BR'),
          );
        }

        return nextVehicle;
      });
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
            Configure veículo, KM inicial, cidade base e horário de início.
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
                color="#F5F0E6"
              />
            </>
          ) : (
            <View style={{ flex: 1 }}>
              <Text style={styles.noVehicleTitle}>
                Nenhum veículo encontrado
              </Text>

              <Text style={styles.noVehicleText}>
                Cadastre um veículo e ele aparecerá aqui automaticamente.
              </Text>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.reloadVehiclesButton}
                onPress={loadVehicles}
              >
                <Ionicons name="refresh-outline" size={17} color="#080808" />

                <Text style={styles.reloadVehiclesButtonText}>
                  Atualizar lista
                </Text>
              </TouchableOpacity>
            </View>
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
            placeholderTextColor="#8F8A91"
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
          <Ionicons name="location-outline" size={24} color="#D4A64A" />

          <View style={{ flex: 1 }}>
            <Text style={styles.selectText}>
              {selectedMunicipality
                ? `${selectedMunicipality.name} - ${selectedMunicipality.uf}`
                : 'Selecionar cidade'}
            </Text>

          </View>

          <Ionicons name="chevron-forward" size={22} color="#F5F0E6" />
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
            color="#F5F0E6"
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
                  color="#F5F0E6"
                />
              </TouchableOpacity>
            </View>

            {vehicles.length === 0 ? (
              <View style={styles.modalEmptyVehicles}>
                <Ionicons name="car-sport-outline" size={34} color="#8F8A91" />

                <Text style={styles.modalEmptyVehiclesTitle}>
                  Nenhum veículo cadastrado
                </Text>

                <Text style={styles.modalEmptyVehiclesText}>
                  Cadastre um veículo e volte para esta tela. A lista será atualizada ao focar novamente.
                </Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.modalReloadVehiclesButton}
                  onPress={loadVehicles}
                >
                  <Ionicons name="refresh-outline" size={18} color="#080808" />

                  <Text style={styles.modalReloadVehiclesButtonText}>
                    Atualizar veículos
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              vehicles.map((vehicle) => (
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
                      color="#D4A64A"
                    />
                  )}
                </TouchableOpacity>
              ))
            )}
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
                  color="#F5F0E6"
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
                  placeholderTextColor="#8F8A91"
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
                  placeholderTextColor="#8F8A91"
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
            <View style={styles.municipalityHandle} />

            <View style={styles.municipalityHeader}>
              <View style={styles.municipalityHeaderLeft}>
                <View style={styles.municipalityHeaderIcon}>
                  <Ionicons name="location-outline" size={24} color="#D4A64A" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.municipalityEyebrow}>Cidade base</Text>
                  <Text style={styles.municipalityTitle}>Escolher cidade</Text>
                  <Text style={styles.municipalityDescription}>
                    Busque pela cidade onde você irá iniciar sua jornada.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.municipalityCloseButton}
                onPress={() => setMunicipalityModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <View style={styles.municipalitySearchBox}>
              <Ionicons name="search-outline" size={20} color="#8F8A91" />

              <TextInput
                value={municipalitySearch}
                onChangeText={handleSearchMunicipalities}
                placeholder="Buscar cidade"
                placeholderTextColor="#8F8A91"
                autoCapitalize="words"
                autoCorrect={false}
                style={styles.municipalitySearchInput}
              />

              {municipalitySearch.length > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    setMunicipalitySearch('');
                    setMunicipalities([]);
                  }}
                >
                  <Ionicons name="close-circle" size={20} color="#8F8A91" />
                </TouchableOpacity>
              ) : null}
            </View>

            {selectedMunicipality ? (
              <View style={styles.selectedCityPreview}>
                <Ionicons name="checkmark-circle" size={20} color="#D4A64A" />

                <Text style={styles.selectedCityPreviewText} numberOfLines={1}>
                  Atual: {selectedMunicipality.name} - {selectedMunicipality.uf}
                </Text>
              </View>
            ) : null}

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.municipalityListContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {municipalitySearch.trim().length < 2 ? (
                <View style={styles.municipalityEmptyState}>
                  <View style={styles.municipalityEmptyIcon}>
                    <Ionicons name="map-outline" size={32} color="#8F8A91" />
                  </View>

                  <Text style={styles.municipalityEmptyTitle}>
                    Busque sua cidade
                  </Text>

                  <Text style={styles.municipalityEmptyText}>
                    Digite pelo menos 2 letras para encontrar a cidade base da jornada.
                  </Text>
                </View>
              ) : municipalities.length === 0 ? (
                <View style={styles.municipalityEmptyState}>
                  <View style={styles.municipalityEmptyIcon}>
                    <Ionicons name="search-outline" size={32} color="#8F8A91" />
                  </View>

                  <Text style={styles.municipalityEmptyTitle}>
                    Nenhuma cidade encontrada
                  </Text>

                  <Text style={styles.municipalityEmptyText}>
                    Confira o nome digitado e tente novamente.
                  </Text>
                </View>
              ) : (
                municipalities.map((item) => {
                  const selected = selectedMunicipality?.id === item.id;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.86}
                      style={[
                        styles.municipalityItem,
                        selected && styles.municipalityItemActive,
                      ]}
                      onPress={() => {
                        setSelectedMunicipality(item);
                        setMunicipalityModalVisible(false);
                        setMunicipalitySearch('');
                        setMunicipalities([]);
                      }}
                    >
                      <View style={styles.municipalityItemIcon}>
                        <Ionicons
                          name="location-outline"
                          size={21}
                          color={selected ? '#D4A64A' : '#9B969B'}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.municipalityName}>
                          {item.name}
                        </Text>

                        <Text style={styles.municipalityUf}>
                          {item.uf}
                        </Text>
                      </View>

                      {selected ? (
                        <View style={styles.municipalitySelectedBadge}>
                          <Ionicons name="checkmark" size={16} color="#080808" />
                        </View>
                      ) : (
                        <Ionicons name="chevron-forward" size={20} color="#8F8A91" />
                      )}
                    </TouchableOpacity>
                  );
                })
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
    backgroundColor: '#050505',
  },
  content: {
    paddingTop: 48,
    paddingHorizontal: 18,
    paddingBottom: 150,
    backgroundColor: '#050505',
  },
  header: {
    marginHorizontal: -18,
    marginTop: -48,
    marginBottom: 18,
    paddingTop: 48,
    paddingBottom: 18,
    paddingHorizontal: 18,
    backgroundColor: '#070707',
    borderBottomWidth: 1,
    borderBottomColor: '#211D16',
  },
  title: {
    color: '#F5F0E6',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    lineHeight: 19,
  },
  liveCard: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderLeftWidth: 4,
    borderLeftColor: '#D4A64A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 22,
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
    backgroundColor: '#D4A64A',
    marginRight: 10,
  },
  liveText: {
    color: '#F5F0E6',
    fontWeight: '800',
    flex: 1,
    fontSize: 13,
  },
  changeTimeButton: {
    height: 35,
    borderRadius: 10,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeTimeText: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
  },
  label: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.2,
  },
  vehicleCard: {
    minHeight: 88,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  vehicleImage: {
    width: 86,
    height: 54,
    resizeMode: 'contain',
    marginRight: 12,
  },
  vehicleTitle: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },
  vehicleKm: {
    color: '#9B969B',
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
  },
  noVehicleTitle: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },
  noVehicleText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    lineHeight: 17,
  },
  reloadVehiclesButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: '#D4A64A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  reloadVehiclesButtonText: {
    color: '#080808',
    fontSize: 12,
    fontWeight: '900',
  },
  inputCard: {
    height: 74,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  input: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 30,
    fontWeight: '900',
    padding: 0,
  },
  kmText: {
    color: '#9B969B',
    fontSize: 16,
    fontWeight: '800',
  },
  startButton: {
    height: 60,
    borderRadius: 14,
    backgroundColor: '#D4A64A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
    shadowColor: '#D4A64A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
  },
  startButtonText: {
    color: '#080808',
    fontSize: 16,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.84)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    backgroundColor: '#101014',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    borderTopColor: 'rgba(212,166,74,0.34)',
    maxHeight: '86%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#211D16',
  },
  modalTitle: {
    color: '#F5F0E6',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  modalEmptyVehicles: {
    minHeight: 190,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    marginBottom: 10,
  },
  modalEmptyVehiclesTitle: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 10,
    textAlign: 'center',
  },
  modalEmptyVehiclesText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalReloadVehiclesButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#D4A64A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
  },
  modalReloadVehiclesButtonText: {
    color: '#080808',
    fontSize: 13,
    fontWeight: '900',
  },
  modalVehicle: {
    height: 78,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
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
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },
  modalVehiclePlate: {
    color: '#9B969B',
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
  },
  modalDescription: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
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
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inputLabel: {
    color: '#D4A64A',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  modalInput: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
    padding: 0,
  },
  saveTimeButton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTimeButtonText: {
    color: '#080808',
    fontSize: 16,
    fontWeight: '900',
  },
  municipalityHandle: {
    width: 46,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D4A64A',
    opacity: 0.65,
    alignSelf: 'center',
    marginBottom: 16,
  },
  municipalityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#211D16',
  },

  municipalityHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  municipalityHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  municipalityEyebrow: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  municipalityTitle: {
    color: '#F5F0E6',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 3,
    letterSpacing: -0.3,
  },
  municipalityDescription: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 4,
  },
  municipalityCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },
  municipalitySearchBox: {
    height: 56,
    borderRadius: 13,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 12,
  },
  selectedCityPreview: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  selectedCityPreviewText: {
    flex: 1,
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
  },

  municipalityListContent: {
    paddingBottom: 24,
  },
  municipalityItem: {
    minHeight: 70,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  municipalityItemActive: {
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderColor: 'rgba(212,166,74,0.55)',
  },
  municipalityItemIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#101014',
    alignItems: 'center',
    justifyContent: 'center',
  },
  municipalityName: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },
  municipalityUf: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  municipalitySelectedBadge: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  municipalityEmptyState: {
    minHeight: 210,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    marginTop: 8,
  },
  municipalityEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#101014',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  municipalityEmptyTitle: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  municipalityEmptyText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 7,
  },
  selectCard: {
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectText: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },
  municipalityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.84)',
    justifyContent: 'flex-end',
  },
  municipalityModalContent: {
    height: '82%',
    backgroundColor: '#101014',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    borderTopColor: 'rgba(212,166,74,0.34)',
  },
  municipalitySearchInput: {
    flex: 1,
    height: '100%',
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '800',
    padding: 0,
  },

  emptyText: {
    color: '#8F8A91',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '600',
  },
});