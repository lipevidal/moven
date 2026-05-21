import { useEffect, useMemo, useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  Image,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getActiveSession } from '../../src/features/workSessions/services/getActiveSession';
import { createEarning } from '../../src/features/workSessions/services/createEarning';
import { updateEarning } from '../../src/features/workSessions/services/updateEarning';
import { deleteEarning } from '../../src/features/workSessions/services/deleteEarning';
import { updateSessionKm } from '../../src/features/workSessions/services/updateSessionKm';
import { pauseWorkSession } from '../../src/features/workSessions/services/pauseWorkSession';
import { resumeWorkSession } from '../../src/features/workSessions/services/resumeWorkSession';
import { deleteWorkSession } from '../../src/features/workSessions/services/deleteWorkSession';
import { finishWorkSession } from '../../src/features/workSessions/services/finishWorkSession';

const platforms = [
  'Particular',
  '99',
  'Uber',
  'inDrive',
  '99Food',
  'Uber Eats',
  'Ifood',
  'Rappi',
  'Zé Delivery',
  'Keeta',
  'Shopee',
  'Mercado Livre',
  'Loggi',
  'Lalamove',
  'Produtos',
];

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

function formatKm(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 6);
  return numbers ? Number(numbers).toLocaleString('pt-BR') : '';
}

function onlyNumbers(value: string) {
  return Number(value.replace(/\./g, '')) || 0;
}

function formatTimer(seconds: number) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');

  return `${h}:${m}:${s}`;
}

export default function ActiveSessionScreen() {
  const [session, setSession] = useState<any>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [gainModalVisible, setGainModalVisible] = useState(false);
  const [kmModalVisible, setKmModalVisible] = useState(false);
  const [finishModalVisible, setFinishModalVisible] = useState(false);

  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [gainValue, setGainValue] = useState('');
  const [editingEarningId, setEditingEarningId] = useState<string | null>(null);

  const [kmValue, setKmValue] = useState('');

  async function loadSession() {
    const response = await getActiveSession();

    if (!response) {
      router.replace('/(private)/(tabs)/dashboard');
      return;
    }

    setSession(response);

    const currentKm = response.end_km ?? response.start_km;
    setKmValue(Number(currentKm).toLocaleString('pt-BR'));
  }

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (!session?.started_at) return;

    function updateTimer() {
        const startTime = new Date(session.started_at).getTime();
        const now = new Date().getTime();

        const totalPausedSeconds = Number(session.total_paused_seconds ?? 0);

        let currentPauseSeconds = 0;

        if (session.status === 'paused' && session.paused_at) {
        currentPauseSeconds = Math.floor(
            (now - new Date(session.paused_at).getTime()) / 1000,
        );
        }

        const diffInSeconds = Math.floor((now - startTime) / 1000);

        const realWorkedSeconds =
        diffInSeconds - totalPausedSeconds - currentPauseSeconds;

        setElapsedSeconds(realWorkedSeconds > 0 ? realWorkedSeconds : 0);
    }

    updateTimer();

    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
    }, [
    session?.started_at,
    session?.status,
    session?.paused_at,
    session?.total_paused_seconds,
  ]);

  const earnings = session?.earnings ?? [];

  const totalEarnings = earnings.reduce(
    (total: number, item: any) => total + Number(item.amount),
    0,
  );

  const kmDriven =
    Number(session?.end_km ?? session?.start_km ?? 0) -
    Number(session?.start_km ?? 0);

  const workedHours = elapsedSeconds / 3600;

  const gainPerHour = workedHours > 0 ? totalEarnings / workedHours : 0;
  const gainPerKm = kmDriven > 0 ? totalEarnings / kmDriven : 0;

  const availablePlatforms = useMemo(() => {
    return platforms.filter((platform) => {
      const exists = earnings.find(
        (earning: any) => earning.platform === platform,
      );

      if (editingEarningId) {
        const editing = earnings.find(
          (earning: any) => earning.id === editingEarningId,
        );

        return !exists || editing?.platform === platform;
      }

      return !exists;
    });
  }, [earnings, editingEarningId]);

  function openCreateGainModal() {
    setSelectedPlatform('');
    setGainValue('');
    setEditingEarningId(null);
    setGainModalVisible(true);
  }

  function openEditGainModal(earning: any) {
    setSelectedPlatform(earning.platform);
    setGainValue(String(earning.amount).replace('.', ','));
    setEditingEarningId(earning.id);
    setGainModalVisible(true);
  }

  async function handleSaveGain() {
    const amount = Number(gainValue.replace(/\./g, '').replace(',', '.'));

    if (!selectedPlatform) {
      Alert.alert('Atenção', 'Selecione uma plataforma.');
      return;
    }

    if (!amount || amount <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido.');
      return;
    }

    if (editingEarningId) {
      await updateEarning({
        earning_id: editingEarningId,
        amount,
      });
    } else {
      await createEarning({
        session_id: session.id,
        platform: selectedPlatform,
        amount,
      });
    }

    setGainModalVisible(false);
    setSelectedPlatform('');
    setGainValue('');
    setEditingEarningId(null);

    await loadSession();
  }

  function handleDeleteGain(earningId: string) {
    Alert.alert('Excluir ganho', 'Deseja realmente excluir este ganho?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteEarning(earningId);
          await loadSession();
        },
      },
    ]);
  }

  async function handleUpdateKm() {
    const parsedKm = onlyNumbers(kmValue);

    if (!parsedKm || parsedKm < Number(session.start_km)) {
      Alert.alert(
        'KM inválido',
        'O KM atual não pode ser menor que o KM inicial da jornada.',
      );
      return;
    }

    await updateSessionKm({
      session_id: session.id,
      end_km: parsedKm,
    });

    setKmModalVisible(false);
    await loadSession();
  }

  async function handleTogglePause() {
    if (session.status === 'paused') {
      await resumeWorkSession(session.id);
    } else {
      await pauseWorkSession(session.id);
    }

    await loadSession();
  }

  function handleDeleteSession() {
    Alert.alert('Excluir jornada', 'Deseja realmente excluir esta jornada?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkSession(session.id);
          router.replace('/(private)/(tabs)/dashboard');
        },
      },
    ]);
  }

  async function handleFinishSession() {
    const parsedKm = onlyNumbers(kmValue);

    if (!parsedKm || parsedKm < Number(session.start_km)) {
      Alert.alert(
        'KM inválido',
        'O KM final não pode ser menor que o KM inicial.',
      );
      return;
    }

    if (earnings.length === 0) {
      Alert.alert(
        'Atenção',
        'Adicione pelo menos um ganho antes de finalizar.',
      );
      return;
    }

    await finishWorkSession({
      session_id: session.id,
      end_km: parsedKm,
    });

    router.replace('/(private)/(tabs)/dashboard');
  }

  if (!session) return null;

    return (
    <>
      <ScrollView
        style={[
            styles.container,

            {
                backgroundColor:
                session?.status === 'paused'
                    ? '#1d0f07'
                    : '#001B12',
            },
        ]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.hero}>
          <View style={styles.statusRow}>
            <View style={{flexDirection: 'column', alignItems: 'center'}}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <View
                        style={[
                            styles.statusDot,
                            session.status === 'paused' && {
                            backgroundColor: '#F59E0B',
                            },
                        ]}
                    />
                    <Text style={styles.statusTitle}>
                        {session.status === 'paused'
                        ? 'Jornada pausada'
                        : 'Jornada ativa'}
                    </Text>
                </View>

                <Text style={styles.startedText}>
                    Iniciada às{' '}
                    {new Date(session.started_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    })}
                </Text>
            </View>

            <TouchableOpacity
                style={styles.closeButton}
                onPress={() => router.replace('/(private)/(tabs)/dashboard')}
            >
            <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.timer}>{formatTimer(elapsedSeconds)}</Text>

          <Text style={styles.timerLabel}>Tempo de trabalho</Text>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>FATURAMENTO</Text>

            <Text style={styles.metricValue}>
              R$ {formatCurrency(totalEarnings)}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>KM RODADOS</Text>

            <Text style={styles.metricValue}>{Math.max(kmDriven, 0)} km</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>GANHO POR HORA</Text>

            <Text style={styles.metricValue}>
              R$ {formatCurrency(gainPerHour)}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>GANHO POR KM</Text>

            <Text style={styles.metricValue}>
              R$ {formatCurrency(gainPerKm)}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.vehicleCard} activeOpacity={0.85}>
            <View>
                <Text style={styles.vehicleLabel}>Veículo</Text>

                <View style={styles.vehicleRow}>
                    <Image
                    source={getVehicleImage(session.vehicle?.type)}
                    style={styles.vehicleImage}
                    />

                    <View>
                        <Text style={styles.vehicleTitle}>
                            {session.vehicle?.model} - {session.vehicle?.plate}
                        </Text>

                        <Text style={styles.vehicleKm}>
                            {Number(session.vehicle?.current_km ?? 0).toLocaleString(
                            'pt-BR',
                            )}{' '}
                            km
                        </Text>
                    </View>
                </View>
            </View>
            {/*<Ionicons name="chevron-forward" size={22} color="#FFFFFF" />*/}
        </TouchableOpacity>

        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.bottomButton} onPress={handleTogglePause}>
            <Ionicons
              name={session.status === 'paused' ? 'play' : 'pause'}
              size={18}
              color="#FFFFFF"
            />

            <Text style={styles.bottomButtonText}>
              {session.status === 'paused' ? 'Retomar' : 'Pausar'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bottomButton} onPress={handleDeleteSession}>
            <Ionicons name="stop" size={16} color="#FFFFFF" />

            <Text style={styles.bottomButtonText}>Deletar</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.finishButton}
          onPress={() => setFinishModalVisible(true)}
        >
          <Text style={styles.finishButtonText}>Finalizar jornada</Text>
        </TouchableOpacity>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={openCreateGainModal}
          >
            <Ionicons name="cash-outline" size={20} color="#FFFFFF" />

            <Text style={styles.secondaryButtonText}>Adicionar ganho</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setKmModalVisible(true)}
          >
            <Ionicons name="speedometer-outline" size={20} color="#FFFFFF" />

            <Text style={styles.secondaryButtonText}>Atualizar KM</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.earningsCard}>
          <Text style={styles.sectionTitle}>Ganhos da jornada</Text>

          {earnings.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum ganho registrado.</Text>
          ) : (
            earnings.map((earning: any) => (
              <View key={earning.id} style={styles.earningItem}>
                <View>
                  <Text style={styles.earningPlatform}>{earning.platform}</Text>

                  <Text style={styles.earningAmount}>
                    R$ {formatCurrency(Number(earning.amount))}
                  </Text>
                </View>

                <View style={styles.earningActions}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => openEditGainModal(earning)}
                  >
                    <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.iconButtonDanger}
                    onPress={() => handleDeleteGain(earning.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>

      <Modal visible={gainModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingEarningId ? 'Editar ganho' : 'Adicionar ganho'}
              </Text>

              <TouchableOpacity onPress={() => setGainModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {availablePlatforms.map((platform) => (
                <TouchableOpacity
                  key={platform}
                  style={[
                    styles.platformChip,
                    selectedPlatform === platform && styles.platformChipActive,
                  ]}
                  onPress={() => setSelectedPlatform(platform)}
                >
                  <Text style={styles.platformChipText}>{platform}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              value={gainValue}
              onChangeText={setGainValue}
              placeholder="Valor do ganho"
              placeholderTextColor="#71717A"
              keyboardType="numeric"
              style={styles.input}
            />

            <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveGain}>
              <Text style={styles.modalSaveButtonText}>Salvar ganho</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={kmModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Atualizar KM</Text>

              <TouchableOpacity onPress={() => setKmModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={kmValue}
              onChangeText={(text) => setKmValue(formatKm(text))}
              placeholder="KM atual"
              placeholderTextColor="#71717A"
              keyboardType="numeric"
              style={styles.input}
            />

            <TouchableOpacity style={styles.modalSaveButton} onPress={handleUpdateKm}>
              <Text style={styles.modalSaveButtonText}>Atualizar KM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={finishModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Finalizar jornada</Text>

              <TouchableOpacity onPress={() => setFinishModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Confira os ganhos e o KM final antes de encerrar.
            </Text>

            <TextInput
              value={kmValue}
              onChangeText={(text) => setKmValue(formatKm(text))}
              placeholder="KM final"
              placeholderTextColor="#71717A"
              keyboardType="numeric"
              style={styles.input}
            />

            <TouchableOpacity
              style={styles.addInsideFinishButton}
              onPress={openCreateGainModal}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />

              <Text style={styles.addInsideFinishText}>Adicionar ganho</Text>
            </TouchableOpacity>

            <ScrollView style={{ maxHeight: 240 }}>
              {earnings.map((earning: any) => (
                <View key={earning.id} style={styles.earningItem}>
                  <View>
                    <Text style={styles.earningPlatform}>{earning.platform}</Text>

                    <Text style={styles.earningAmount}>
                      R$ {formatCurrency(Number(earning.amount))}
                    </Text>
                  </View>

                  <View style={styles.earningActions}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => openEditGainModal(earning)}
                    >
                      <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.iconButtonDanger}
                      onPress={() => handleDeleteGain(earning.id)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalFinishButton}
              onPress={handleFinishSession}
            >
              <Text style={styles.modalFinishButtonText}>Concluir jornada</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 14,
    paddingTop: 48,
    paddingBottom: 140,
  },

  closeButton: {
    alignSelf: 'flex-end',
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
  },

  hero: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 38,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center'
  },

  statusDot: {
    width: 11,
    height: 11,
    borderRadius: 99,
    marginRight: 5,
    backgroundColor: '#22C55E',
  },

  statusTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },

  startedText: {
    color: '#A1A1AA',
    fontSize: 13,
    marginTop: 3,
    marginLeft: 15,
  },

  timer: {
    color: '#FFFFFF',
    fontSize: 62,
    fontWeight: '500',
    marginTop: 28,
  },

  timerLabel: {
    color: '#A1A1AA',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },

  metricCard: {
    width: '48%',
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#243142',
    borderRadius: 14,
    padding: 14,
  },

  metricLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
  },

  metricValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
  },

  vehicleCard: {
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#243142',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  vehicleLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 12,
  },

  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  vehicleImage: {
    width: 82,
    height: 54,
    resizeMode: 'contain',
    marginRight: 12,
  },

  vehicleTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  vehicleKm: {
    color: '#A1A1AA',
    marginTop: 5,
    fontSize: 13,
    fontWeight: '700',
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },

  secondaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#243142',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  secondaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },

  earningsCard: {
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#243142',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },

  emptyText: {
    color: '#71717A',
    fontWeight: '700',
  },

  earningItem: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  earningPlatform: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  earningAmount: {
    color: '#22C55E',
    marginTop: 4,
    fontSize: 15,
    fontWeight: '900',
  },

  earningActions: {
    flexDirection: 'row',
    gap: 8,
  },

  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconButtonDanger: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },

  finishButton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 10,
  },

  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  bottomActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },

  bottomButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#243142',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  bottomButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },

  modalContent: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272A',
  },

  modalContentLarge: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    maxHeight: '85%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },

  modalSubtitle: {
    color: '#A1A1AA',
    marginBottom: 14,
    fontSize: 13,
    fontWeight: '700',
  },

  platformChip: {
    height: 42,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 16,
  },

  platformChipActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  platformChipText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  input: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 14,
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
    fontWeight: '900',
  },

  addInsideFinishButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },

  addInsideFinishText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  modalFinishButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  modalFinishButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
});