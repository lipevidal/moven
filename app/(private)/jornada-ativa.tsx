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

import { getSessionRides } from '../../src/features/rides/services/getSessionRides';
import { createRide } from '../../src/features/rides/services/createRide';
import { updateRide } from '../../src/features/rides/services/updateRide';
import { deleteRide } from '../../src/features/rides/services/deleteRide';
import { startWaitingRide } from '../../src/features/rides/services/startWaitingRide';
import { finishRide } from '../../src/features/rides/services/finishRide';
import { updateFinishedRide } from '../../src/features/rides/services/updateFinishedRide';
import { deleteFinishedRide } from '../../src/features/rides/services/deleteFinishedRide';

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

function calculateSecondsFromDate(date?: string | null) {
  if (!date) return 0;

  const start = new Date(date).getTime();
  const now = new Date().getTime();

  const seconds = Math.floor((now - start) / 1000);

  return seconds > 0 ? seconds : 0;
}

function parseMoney(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.')) || 0;
}

export default function ActiveSessionScreen() {
  const [session, setSession] = useState<any>(null);
  const [rides, setRides] = useState<any[]>([]);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());

  const [gainModalVisible, setGainModalVisible] = useState(false);
  const [kmModalVisible, setKmModalVisible] = useState(false);
  const [finishModalVisible, setFinishModalVisible] = useState(false);

  const [rideModalVisible, setRideModalVisible] = useState(false);
  const [finishRideModalVisible, setFinishRideModalVisible] = useState(false);
  const [startWaitingRideModalVisible, setStartWaitingRideModalVisible] =
    useState(false);
  const [finishedDrawerVisible, setFinishedDrawerVisible] = useState(false);

  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [gainValue, setGainValue] = useState('');
  const [editingEarningId, setEditingEarningId] = useState<string | null>(null);

  const [kmValue, setKmValue] = useState('');

  const [ridePlatform, setRidePlatform] = useState('');
  const [rideAmount, setRideAmount] = useState('');
  const [rideStartKm, setRideStartKm] = useState('');
  const [rideEndKm, setRideEndKm] = useState('');
  const [editingRide, setEditingRide] = useState<any>(null);
  const [finishingRide, setFinishingRide] = useState<any>(null);
  const [startingWaitingRide, setStartingWaitingRide] = useState<any>(null);
  const [rideResultModalVisible, setRideResultModalVisible] = useState(false);
  const [rideResult, setRideResult] = useState<any>(null);
  const [editFinishedRideModalVisible, setEditFinishedRideModalVisible] =
  useState(false);
  const [editingFinishedRide, setEditingFinishedRide] = useState<any>(null);
  const [finishedRideAmount, setFinishedRideAmount] = useState('');
  const [returnToFinishModalAfterGain, setReturnToFinishModalAfterGain] =
    useState(false);
  const [lockedGainPlatform, setLockedGainPlatform] = useState(false);
  
  function openEditFinishedRideModal(ride: any) {
    setFinishedDrawerVisible(false);

    setTimeout(() => {
      setEditingFinishedRide(ride);

      setFinishedRideAmount(
        String(ride.amount).replace('.', ','),
      );

      setEditFinishedRideModalVisible(true);
    }, 300);
  }

  async function handleUpdateFinishedRide() {
    const newAmount = parseMoney(finishedRideAmount);

    if (!editingFinishedRide) return;

    if (!newAmount || newAmount <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido.');
      return;
    }

    await updateFinishedRide({
      ride_id: editingFinishedRide.id,
      session_id: session.id,
      platform: editingFinishedRide.platform,
      old_amount: Number(editingFinishedRide.amount),
      new_amount: newAmount,
    });

    setEditFinishedRideModalVisible(false);
    setEditingFinishedRide(null);
    setFinishedRideAmount('');

    await loadSession();
  }

  function handleDeleteFinishedRide(ride: any) {
    Alert.alert(
      'Excluir corrida',
      'Deseja realmente excluir esta corrida? O valor será removido dos ganhos da plataforma e do total da jornada.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteFinishedRide({
              ride_id: ride.id,
              session_id: session.id,
              platform: ride.platform,
              amount: Number(ride.amount),
            });

            await loadSession();
          },
        },
      ],
    );
  }

  async function loadSession() {
    const response = await getActiveSession();

    if (!response) {
      router.replace('/(private)/(tabs)/dashboard');
      return;
    }

    setSession(response);

    const currentKm = response.end_km ?? response.start_km;
    setKmValue(Number(currentKm).toLocaleString('pt-BR'));

    const ridesResponse = await getSessionRides(response.id);
    setRides(ridesResponse);
  }

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => clearInterval(interval);
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

  const activeRide = rides.find((ride) => ride.status === 'active');

  const waitingRides = rides.filter((ride) => ride.status === 'waiting');

  const finishedRides = rides.filter((ride) => ride.status === 'finished');

  const oldestWaitingRide = waitingRides[0];

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

  function getCurrentVehicleKm() {
    const sessionKm = Number(session?.end_km ?? 0);
    const vehicleKm = Number(session?.vehicle?.current_km ?? 0);
    const startKm = Number(session?.start_km ?? 0);

    return sessionKm || vehicleKm || startKm || 0;
  }

    function openCreateRideModal() {
    setEditingRide(null);
    setRidePlatform('');
    setRideAmount('');
    setRideStartKm(
      activeRide
        ? ''
        : Number(getCurrentVehicleKm()).toLocaleString('pt-BR'),
    );
    setRideModalVisible(true);
  }

  function openEditRideModal(ride: any) {
    setEditingRide(ride);
    setRidePlatform(ride.platform);
    setRideAmount(String(ride.amount).replace('.', ','));
    setRideStartKm(
      ride.start_km
        ? Number(ride.start_km).toLocaleString('pt-BR')
        : '',
    );
    setRideModalVisible(true);
  }

  async function handleSaveRide() {
    const amount = parseMoney(rideAmount);

    if (!ridePlatform) {
      Alert.alert('Atenção', 'Selecione uma plataforma.');
      return;
    }

    if (!amount || amount <= 0) {
      Alert.alert('Atenção', 'Informe o valor da corrida/entrega.');
      return;
    }

    if (editingRide) {
      await updateRide({
        ride_id: editingRide.id,
        platform: ridePlatform,
        amount,
        start_km: rideStartKm ? onlyNumbers(rideStartKm) : null,
      });

      setRideModalVisible(false);
      await loadSession();
      return;
    }

    if (!activeRide) {
      const parsedStartKm = onlyNumbers(rideStartKm);

      if (!parsedStartKm) {
        Alert.alert('Atenção', 'Informe o KM inicial.');
        return;
      }

      await createRide({
        session_id: session.id,
        vehicle_id: session.vehicle_id,
        platform: ridePlatform,
        amount,
        start_km: parsedStartKm,
        status: 'active',
      });
    } else {
      await createRide({
        session_id: session.id,
        vehicle_id: session.vehicle_id,
        platform: ridePlatform,
        amount,
        status: 'waiting',
      });
    }

    setRideModalVisible(false);
    setRidePlatform('');
    setRideAmount('');
    setRideStartKm('');

    await loadSession();
  }

  function handleDeleteRide(ride: any) {
    Alert.alert(
      'Excluir corrida/entrega',
      'Deseja realmente excluir este registro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteRide(ride.id);
            await loadSession();
          },
        },
      ],
    );
  }

  function openStartWaitingRideModal(ride: any) {
    setStartingWaitingRide(ride);
    setRideStartKm(Number(getCurrentVehicleKm()).toLocaleString('pt-BR'));
    setStartWaitingRideModalVisible(true);
  }

  async function handleStartWaitingRide() {
    const parsedStartKm = onlyNumbers(rideStartKm);

    if (!parsedStartKm) {
      Alert.alert('Atenção', 'Informe o KM inicial.');
      return;
    }

    await startWaitingRide({
      ride_id: startingWaitingRide.id,
      start_km: parsedStartKm,
    });

    setStartWaitingRideModalVisible(false);
    setStartingWaitingRide(null);
    setRideStartKm('');

    await loadSession();
  }

  function openFinishRideModal(ride: any) {
    setFinishingRide(ride);

    setRideEndKm(
        Number(getCurrentVehicleKm()).toLocaleString('pt-BR'),
    );

    setRideAmount(
        String(ride.amount).replace('.', ','),
    );

    setFinishRideModalVisible(true);
  }


  async function handleFinishRide() {
    const parsedEndKm = onlyNumbers(rideEndKm);

    if (!finishingRide) return;

    if (!parsedEndKm || parsedEndKm < Number(finishingRide.start_km)) {
      Alert.alert(
        'KM inválido',
        'O KM final não pode ser menor que o KM inicial da corrida.',
      );
      return;
    }

    const result = await finishRide({
      ride_id: finishingRide.id,
      session_id: session.id,
      vehicle_id: session.vehicle_id,
      platform: finishingRide.platform,
      amount: parseMoney(rideAmount),
      start_km: Number(finishingRide.start_km),
      end_km: parsedEndKm,
      started_at: finishingRide.started_at,
    });

    setFinishRideModalVisible(false);
    setFinishingRide(null);
    setRideEndKm('');
    setRideAmount('');

    await loadSession();

    setRideResult(result);
    setRideResultModalVisible(true);
  }

  function openCreateGainModal() {
    const cameFromFinishModal = finishModalVisible;

    setReturnToFinishModalAfterGain(cameFromFinishModal);
    setFinishModalVisible(false);

    setTimeout(() => {
      setSelectedPlatform('');
      setGainValue('');
      setEditingEarningId(null);
      setLockedGainPlatform(false);
      setGainModalVisible(true);
    }, 500);
  }

  function openEditGainModal(earning: any) {
    const cameFromFinishModal = finishModalVisible;

    setReturnToFinishModalAfterGain(cameFromFinishModal);
    setFinishModalVisible(false);

    setTimeout(() => {
      setSelectedPlatform(earning.platform);
      setGainValue(String(earning.amount).replace('.', ','));
      setEditingEarningId(earning.id);
      setLockedGainPlatform(true);
      setGainModalVisible(true);
    }, 500);
  }

  async function handleSaveGain() {
    const amount = parseMoney(gainValue);

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
    setLockedGainPlatform(false);

    await loadSession();

    if (returnToFinishModalAfterGain) {
      setTimeout(() => {
        setFinishModalVisible(true);
        setReturnToFinishModalAfterGain(false);
      }, 500);
    }
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

    if (activeRide) {
      Alert.alert(
        'Corrida em andamento',
        'Finalize ou exclua a corrida em andamento antes de pausar a jornada.',
      );
      return;
    }


    if (session.status === 'paused') {
      await resumeWorkSession(session.id);
    } else {
      await pauseWorkSession(session.id);
    }

    await loadSession();
  }

  function handleDeleteSession() {
    if (activeRide) {
      Alert.alert(
        'Corrida em andamento',
        'Finalize ou exclua a corrida em andamento antes de deletar a jornada.',
      );
      return;
    }

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
    if (activeRide) {
      Alert.alert(
        'Corrida em andamento',
        'Finalize ou exclua a corrida em andamento antes de finalizar a jornada.',
      );
      return;
    }

    const parsedKm = onlyNumbers(kmValue);

    if (!parsedKm || parsedKm < Number(session.start_km)) {
      Alert.alert(
        'KM inválido',
        'O KM final não pode ser menor que o KM inicial.',
      );
      return;
    }

    await finishWorkSession({
      session_id: session.id,
      end_km: parsedKm,
    });

    router.replace('/(private)/(tabs)/dashboard');
  }

  function getRideElapsedSeconds(ride: any) {
    if (!ride?.started_at) return 0;

    return calculateSecondsFromDate(ride.started_at);
  }

  function getRideGainPerHour(ride: any) {
    const seconds = getRideElapsedSeconds(ride);
    const hours = seconds / 3600;

    if (hours <= 0) return 0;

    return Number(ride.amount) / hours;
  }

  if (!session) return null;

    return (
    <>
      <ScrollView
        style={[
          styles.container,
          {
            backgroundColor:
              session.status === 'paused' ? '#3B1F0B' : '#001B12',
          },
        ]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() =>
            router.replace({
              pathname: '/(private)/(tabs)/dashboard',
              params: { hideActiveSession: '1' },
            })
          }
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.hero}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                session.status === 'paused' && { backgroundColor: '#F59E0B' },
              ]}
            />

            <View>
              <Text style={styles.statusTitle}>
                {session.status === 'paused'
                  ? 'Jornada pausada'
                  : 'Jornada ativa'}
              </Text>

              <Text style={styles.startedText}>
                Iniciada às{' '}
                {new Date(session.started_at).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>

          <Text style={styles.timer}>{formatTimer(elapsedSeconds)}</Text>
          <Text style={styles.timerLabel}>Tempo de trabalho</Text>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>FATURAMENTO</Text>
            <Text style={styles.metricValue}>R$ {formatCurrency(totalEarnings)}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>KM RODADOS</Text>
            <Text style={styles.metricValue}>{Math.max(kmDriven, 0)} km</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>GANHO/HORA</Text>
            <Text style={styles.metricValue}>R$ {formatCurrency(gainPerHour)}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>GANHO/KM</Text>
            <Text style={styles.metricValue}>R$ {formatCurrency(gainPerKm)}</Text>
          </View>
        </View>

        {activeRide && (
          <View style={styles.rideCardActive}>
            <Text style={styles.sectionTitle}>Corrida em andamento</Text>

            <Text style={styles.ridePlatform}>{activeRide.platform}</Text>

            <Text style={styles.rideValue}>
              R$ {formatCurrency(Number(activeRide.amount))}
            </Text>

            <Text style={styles.rideInfo}>
              Tempo: {formatTimer(getRideElapsedSeconds(activeRide))}
            </Text>

            <Text style={styles.rideInfo}>
              Ganho/hora agora: R$ {formatCurrency(getRideGainPerHour(activeRide))}
            </Text>

            <Text style={styles.rideInfo}>
              KM inicial: {Number(activeRide.start_km ?? 0).toLocaleString('pt-BR')} km
            </Text>

            <View style={styles.rideActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => openEditRideModal(activeRide)}
              >
                <Ionicons name="create-outline" size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconButtonDanger}
                onPress={() => handleDeleteRide(activeRide)}
              >
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.finishRideButton}
                onPress={() => openFinishRideModal(activeRide)}
              >
                <Text style={styles.finishRideButtonText}>Finalizar corrida</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {waitingRides.length > 0 && (
          <View style={styles.earningsCard}>
            <Text style={styles.sectionTitle}>Aguardando início</Text>

            {waitingRides.map((ride) => (
              <View key={ride.id} style={styles.rideWaitingItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.earningPlatform}>{ride.platform}</Text>
                  <Text style={styles.earningAmount}>
                    R$ {formatCurrency(Number(ride.amount))}
                  </Text>
                </View>

                <View style={styles.earningActions}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => openEditRideModal(ride)}
                  >
                    <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.iconButtonDanger}
                    onPress={() => handleDeleteRide(ride)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {!activeRide && oldestWaitingRide?.id === ride.id && (
                  <TouchableOpacity
                    style={styles.startRideButton}
                    onPress={() => openStartWaitingRideModal(ride)}
                  >
                    <Text style={styles.startRideButtonText}>Iniciar</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={openCreateGainModal}>
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

        <TouchableOpacity
          style={styles.finishButton}
          onPress={() => setFinishModalVisible(true)}
        >
          <Text style={styles.finishButtonText}>Finalizar jornada</Text>
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
      </ScrollView>

      <TouchableOpacity style={styles.floatingRideButton} onPress={openCreateRideModal}>
        <Ionicons name="navigate-outline" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {finishedRides.length > 0 && (
        <TouchableOpacity
          style={styles.finishedDrawerButton}
          onPress={() => setFinishedDrawerVisible(true)}
        >
          <Ionicons name="list-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <Modal visible={rideModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingRide ? 'Editar corrida/entrega' : activeRide ? 'Registrar corrida/entrega' : 'Iniciar corrida/entrega'}
              </Text>

              <TouchableOpacity onPress={() => setRideModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {platforms.map((platform) => (
                <TouchableOpacity
                  key={platform}
                  style={[
                    styles.platformChip,
                    ridePlatform === platform && styles.platformChipActive,
                  ]}
                  onPress={() => setRidePlatform(platform)}
                >
                  <Text style={styles.platformChipText}>{platform}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              value={rideAmount}
              onChangeText={setRideAmount}
              placeholder="Valor da corrida/entrega"
              placeholderTextColor="#71717A"
              keyboardType="numeric"
              style={styles.input}
            />

            {(!activeRide || editingRide?.start_km) && (
              <TextInput
                value={rideStartKm}
                onChangeText={(text) => setRideStartKm(formatKm(text))}
                placeholder="KM inicial"
                placeholderTextColor="#71717A"
                keyboardType="numeric"
                style={styles.input}
              />
            )}

            <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveRide}>
              <Text style={styles.modalSaveButtonText}>
                {editingRide ? 'Salvar alterações' : activeRide ? 'Registrar corrida/entrega' : 'Iniciar corrida/entrega'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/*<Modal visible={finishRideModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Finalizar corrida</Text>

              <TouchableOpacity onPress={() => setFinishRideModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={rideEndKm}
              onChangeText={(text) => setRideEndKm(formatKm(text))}
              placeholder="KM final"
              placeholderTextColor="#71717A"
              keyboardType="numeric"
              style={styles.input}
            />

            <TouchableOpacity style={styles.modalSaveButton} onPress={handleFinishRide}>
              <Text style={styles.modalSaveButtonText}>Finalizar corrida</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>*/}

      <Modal visible={startWaitingRideModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Iniciar corrida</Text>

              <TouchableOpacity onPress={() => setStartWaitingRideModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={rideStartKm}
              onChangeText={(text) => setRideStartKm(formatKm(text))}
              placeholder="KM inicial"
              placeholderTextColor="#71717A"
              keyboardType="numeric"
              style={styles.input}
            />

            <TouchableOpacity style={styles.modalSaveButton} onPress={handleStartWaitingRide}>
              <Text style={styles.modalSaveButtonText}>Iniciar corrida</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={finishedDrawerVisible} transparent animationType="slide">
        <View style={styles.drawerOverlay}>
          <View style={styles.drawer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Corridas concluídas</Text>

              <TouchableOpacity onPress={() => setFinishedDrawerVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {finishedRides.map((ride) => (
                <View key={ride.id} style={styles.finishedRideItem}>
                  <Text style={styles.earningPlatform}>
                    {new Date(ride.started_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    • {ride.platform}
                  </Text>

                  <Text style={styles.earningAmount}>
                    R$ {formatCurrency(Number(ride.amount))}
                  </Text>

                  <Text style={styles.rideInfo}>
                    Hora: R$ {formatCurrency(Number(ride.gain_per_hour ?? 0))} • Km: R${' '}
                    {formatCurrency(Number(ride.gain_per_km ?? 0))}
                  </Text>
                  <View style={styles.earningActions}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => openEditFinishedRideModal(ride)}
                    >
                      <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.iconButtonDanger}
                      onPress={() => handleDeleteFinishedRide(ride)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
              {lockedGainPlatform ? (
                <View style={styles.lockedPlatformBox}>
                  <Text style={styles.lockedPlatformLabel}>Plataforma</Text>

                  <Text style={styles.lockedPlatformValue}>
                    {selectedPlatform}
                  </Text>
                </View>
              ) : (
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
              )}
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

      <Modal visible={finishRideModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Finalizar corrida</Text>

                <TouchableOpacity onPress={() => setFinishRideModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            <TextInput
                value={rideAmount}
                onChangeText={setRideAmount}
                placeholder="Valor da corrida/entrega"
                placeholderTextColor="#71717A"
                keyboardType="numeric"
                style={styles.input}
            />

            <TextInput
                value={rideEndKm}
                onChangeText={(text) => setRideEndKm(formatKm(text))}
                placeholder="KM final"
                placeholderTextColor="#71717A"
                keyboardType="numeric"
                style={styles.input}
            />

            <TouchableOpacity style={styles.modalSaveButton} onPress={handleFinishRide}>
                <Text style={styles.modalSaveButtonText}>Finalizar corrida</Text>
            </TouchableOpacity>
            </View>
        </View>
      </Modal>

      <Modal visible={rideResultModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Corrida finalizada</Text>

                <TouchableOpacity onPress={() => setRideResultModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
                Resultado desta corrida/entrega
            </Text>

            <View style={styles.resultCard}>
                <Text style={styles.resultLabel}>Valor recebido</Text>
                <Text style={styles.resultValue}>
                R$ {formatCurrency(Number(rideResult?.amount ?? 0))}
                </Text>
            </View>

            <View style={styles.resultCard}>
                <Text style={styles.resultLabel}>Ganho por hora</Text>
                <Text style={styles.resultValue}>
                R$ {formatCurrency(Number(rideResult?.gain_per_hour ?? 0))}
                </Text>
            </View>

            <View style={styles.resultCard}>
                <Text style={styles.resultLabel}>Ganho por km</Text>
                <Text style={styles.resultValue}>
                R$ {formatCurrency(Number(rideResult?.gain_per_km ?? 0))}
                </Text>
            </View>

            <View style={styles.resultCard}>
                <Text style={styles.resultLabel}>KM rodados</Text>
                <Text style={styles.resultValue}>
                {Number(rideResult?.km_driven ?? 0).toLocaleString('pt-BR')} km
                </Text>
            </View>

            <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={() => setRideResultModalVisible(false)}
            >
                <Text style={styles.modalSaveButtonText}>Entendi</Text>
            </TouchableOpacity>
            </View>
        </View>
      </Modal>

      <Modal visible={editFinishedRideModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar corrida concluída</Text>

              <TouchableOpacity onPress={() => setEditFinishedRideModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Plataforma: {editingFinishedRide?.platform}
            </Text>

            <TextInput
              value={finishedRideAmount}
              onChangeText={setFinishedRideAmount}
              placeholder="Valor da corrida"
              placeholderTextColor="#71717A"
              keyboardType="numeric"
              style={styles.input}
            />

            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleUpdateFinishedRide}
            >
              <Text style={styles.modalSaveButtonText}>Salvar alteração</Text>
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
    paddingBottom: 160,
  },

  closeButton: {
    alignSelf: 'flex-end',
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  hero: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 28,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  statusDot: {
    width: 11,
    height: 11,
    borderRadius: 99,
    backgroundColor: '#22C55E',
  },

  statusTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  startedText: {
    color: '#A1A1AA',
    fontSize: 13,
    marginTop: 3,
  },

  timer: {
    color: '#FFFFFF',
    fontSize: 54,
    fontWeight: '900',
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
    fontWeight: '900',
  },

  metricValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 12,
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
    marginBottom: 10,
  },

  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  bottomActions: {
    flexDirection: 'row',
    gap: 10,
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

  rideCardActive: {
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#22C55E',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },

  ridePlatform: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  rideValue: {
    color: '#22C55E',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 6,
  },

  rideInfo: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },

  rideActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },

  finishRideButton: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },

  finishRideButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  rideWaitingItem: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },

  startRideButton: {
    height: 34,
    borderRadius: 10,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  startRideButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  floatingRideButton: {
    position: 'absolute',
    right: 18,
    bottom: 160,
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 999,
  },

  finishedDrawerButton: {
    position: 'absolute',
    right: 18,
    bottom: 230,
    width: 50,
    height: 50,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 999,
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

  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'flex-end',
  },

  drawer: {
    width: '86%',
    height: '100%',
    backgroundColor: '#111827',
    paddingTop: 54,
    paddingHorizontal: 18,
    borderLeftWidth: 1,
    borderLeftColor: '#27272A',
  },

  finishedRideItem: {
    backgroundColor: '#18181B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  resultCard: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#27272A',
    },

    resultLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
    },

    resultValue: {
    color: '#22C55E',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 6,
    },

    lockedPlatformBox: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },

  lockedPlatformLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
  },

  lockedPlatformValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 6,
  },

  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingBox: {
    backgroundColor: '#111827',
    borderRadius: 18,
    paddingHorizontal: 28,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: '#27272A',
  },

  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
});