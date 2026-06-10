import { useEffect, useMemo, useState } from 'react';
import { getOnlineDriversByMunicipality } from '../../src/features/municipalities/services/getOnlineDriversByMunicipality';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { searchMunicipalities } from '../../src/features/municipalities/services/searchMunicipalities';
import { updateSessionMunicipality } from '../../src/features/municipalities/services/updateSessionMunicipality';
import { getActiveSession } from '../../src/features/workSessions/services/getActiveSession';
import { createEarning } from '../../src/features/workSessions/services/createEarning';
import { updateEarning } from '../../src/features/workSessions/services/updateEarning';
import { deleteEarning } from '../../src/features/workSessions/services/deleteEarning';
import { updateSessionKm } from '../../src/features/workSessions/services/updateSessionKm';
import { pauseWorkSession } from '../../src/features/workSessions/services/pauseWorkSession';
import { resumeWorkSession } from '../../src/features/workSessions/services/resumeWorkSession';
import { deleteWorkSession } from '../../src/features/workSessions/services/deleteWorkSession';
import { finishWorkSession } from '../../src/features/workSessions/services/finishWorkSession';
import { getCityChatMessages } from '../../src/features/cityChat/services/getCityChatMessages';
import { sendCityChatMessage } from '../../src/features/cityChat/services/sendCityChatMessage';
import { getUnreadCityChatCount } from '../../src/features/cityChat/services/getUnreadCityChatCount';
import { markCityChatAsRead } from '../../src/features/cityChat/services/markCityChatAsRead';
import { getSessionRides } from '../../src/features/rides/services/getSessionRides';
import { createRide } from '../../src/features/rides/services/createRide';
import { updateRide } from '../../src/features/rides/services/updateRide';
import { deleteRide } from '../../src/features/rides/services/deleteRide';
import { startWaitingRide } from '../../src/features/rides/services/startWaitingRide';
import { finishRide } from '../../src/features/rides/services/finishRide';
import { updateFinishedRide } from '../../src/features/rides/services/updateFinishedRide';
import { deleteFinishedRide } from '../../src/features/rides/services/deleteFinishedRide';

import { getPlatforms } from '../../src/features/platforms/services/getPlatforms';
import { getUserPlatforms } from '../../src/features/platforms/services/getUserPlatforms';
import { toggleUserPlatform } from '../../src/features/platforms/services/toggleUserPlatform';
import { supabase } from '../../src/database/supabase';


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
  const [cityChatVisible, setCityChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [currentUserId, setCurrentUserId] = useState('');
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
  const [platformsList, setPlatformsList] = useState<any[]>([]);
  const [userPlatforms, setUserPlatforms] = useState<any[]>([]);
  const [platformDrawerVisible, setPlatformDrawerVisible] = useState(false);
  const [returnToGainModalAfterPlatforms, setReturnToGainModalAfterPlatforms] =
  useState(false);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);
  const [finishPlatformValues, setFinishPlatformValues] = useState<Record<string, string>>({});

  const [onlineDrivers, setOnlineDrivers] = useState<any[]>([]);
  const [driversModalVisible, setDriversModalVisible] = useState(false);
  const [municipalityModalVisible, setMunicipalityModalVisible] = useState(false);

  const [municipalitySearch, setMunicipalitySearch] = useState('');
  const [municipalities, setMunicipalities] = useState<any[]>([]);

  async function handleSearchMunicipalities(text: string) {
    setMunicipalitySearch(text);

    if (text.trim().length < 2) {
      setMunicipalities([]);
      return;
    }

    const response = await searchMunicipalities(text);

    setMunicipalities(response);
  }

  async function loadCityChat() {
    if (!session?.municipality_id) return;

    const response = await getCityChatMessages(session.municipality_id);
    const unread = await getUnreadCityChatCount(session.municipality_id);

    setChatMessages(response);
    setUnreadChatCount(unread);
  }

  async function openCityChat() {
    if (!session?.municipality_id) return;

    setCityChatVisible(true);

    const response = await getCityChatMessages(session.municipality_id);
    setChatMessages(response);

    await markCityChatAsRead(session.municipality_id);
    setUnreadChatCount(0);
  }

  async function handleSendCityMessage() {
    if (!chatMessage.trim() || !session?.municipality_id) return;

    await sendCityChatMessage(session.municipality_id, chatMessage);

    setChatMessage('');
    await loadCityChat();
  }

  async function handleChangeMunicipality(municipality: any) {
    const updatedSession = await updateSessionMunicipality(
      session.id,
      municipality.id,
    );

    setSession(updatedSession);
    setMunicipalityModalVisible(false);
    setMunicipalitySearch('');
    setMunicipalities([]);

    await loadOnlineDrivers(municipality.id);
  }

  function openPlatformDrawerFromGainModal() {
    setReturnToGainModalAfterPlatforms(true);
    setGainModalVisible(false);

    setTimeout(() => {
      setPlatformDrawerVisible(true);
    }, 400);
  }

  function openFinishSessionModal() {
    const values: Record<string, string> = {};

    userPlatforms.forEach((item: any) => {
      const platform = item.platform;

      if (!platform) return;

      const earning = earnings.find(
        (earning: any) => earning.platform === platform.name,
      );

      values[platform.name] = earning
        ? String(earning.amount).replace('.', ',')
        : '';
    });

    setFinishPlatformValues(values);
    setFinishModalVisible(true);
  }


  async function loadPlatforms() {
    const allPlatforms = await getPlatforms();
    const selectedPlatforms = await getUserPlatforms();

    setPlatformsList(allPlatforms);
    setUserPlatforms(selectedPlatforms);

    setSelectedPlatformIds(
      selectedPlatforms.map((item: any) => item.platform_id),
    );
  }

  function getPlatformByName(platformName: string) {
    return platformsList.find(
      (platform) => platform.name === platformName,
    );
  }

  function togglePlatformSelection(platformId: string) {
    setSelectedPlatformIds((prev) => {
      if (prev.includes(platformId)) {
        return prev.filter((id) => id !== platformId);
      }

      return [...prev, platformId];
    });
  }

  async function handleSaveUserPlatforms() {
    for (const platform of platformsList) {
      const selected = selectedPlatformIds.includes(platform.id);

      await toggleUserPlatform(platform.id, selected);
    }

    await loadPlatforms();

    setPlatformDrawerVisible(false);

    if (returnToGainModalAfterPlatforms) {
      setTimeout(() => {
        setGainModalVisible(true);
        setReturnToGainModalAfterPlatforms(false);
      }, 400);
    }
  }

  function formatRideHour(date?: string | null) {
    if (!date) return '--:--';

    return new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getFinishedRideDuration(ride: any) {
    if (!ride.started_at || !ride.finished_at) return '00:00';

    const start = new Date(ride.started_at).getTime();
    const end = new Date(ride.finished_at).getTime();

    const totalMinutes = Math.max(
      Math.floor((end - start) / (1000 * 60)),
      0,
    );

    const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const minutes = String(totalMinutes % 60).padStart(2, '0');

    return `${hours}:${minutes}`;
  }

  function getFinishedRideKm(ride: any) {
    return Math.max(Number(ride.end_km ?? 0) - Number(ride.start_km ?? 0), 0);
  }

  
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

    await loadPlatforms();
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

  useEffect(() => {
    if (!session?.municipality_id) return;

    loadCityChat();

    const channel = supabase
      .channel(`city-chat-${session.municipality_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'city_chat_messages',
          filter: `municipality_id=eq.${session.municipality_id}`,
        },
        async () => {
          await loadCityChat();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.municipality_id]);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id ?? '');
    }

    loadUser();
  }, []);

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

    const hasAnyGain = Object.values(finishPlatformValues).some(
      (value) => parseMoney(value) > 0,
    );

    if (!hasAnyGain) {
      Alert.alert(
        'Nenhum ganho informado',
        'Informe pelo menos um ganho em uma plataforma antes de concluir a jornada.',
      );
      return;
    }

    for (const item of userPlatforms) {
      const platform = item.platform;

      if (!platform) continue;

      const amount = parseMoney(finishPlatformValues[platform.name] ?? '');

      const existingEarning = earnings.find(
        (earning: any) => earning.platform === platform.name,
      );

      if (existingEarning) {
        if (amount > 0) {
          await updateEarning({
            earning_id: existingEarning.id,
            amount,
          });
        } else {
          await deleteEarning(existingEarning.id);
        }
      } else if (amount > 0) {
        await createEarning({
          session_id: session.id,
          platform: platform.name,
          amount,
        });
      }
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

  useEffect(() => {
    if (session?.municipality_id) {
      loadOnlineDrivers(session.municipality_id);
    }
  }, [session?.municipality_id]);

  function getRideGainPerHour(ride: any) {
    const seconds = getRideElapsedSeconds(ride);
    const hours = seconds / 3600;

    if (hours <= 0) return 0;

    return Number(ride.amount) / hours;
  }

  useEffect(() => {
    if (!session?.municipality_id) return;

    loadOnlineDrivers(session.municipality_id);

    const channel = supabase
      .channel(`online-drivers-${session.municipality_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_sessions',
        },
        async () => {
          await loadOnlineDrivers(session.municipality_id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.municipality_id]);

  if (!session) return null;

  const activeRidePlatform = activeRide
    ? getPlatformByName(activeRide.platform)
    : null;


  async function loadOnlineDrivers(municipalityId: string) {
    const response = await getOnlineDriversByMunicipality(municipalityId);
    setOnlineDrivers(response);
  }
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

        <View style={{alignItems: 'center', justifyContent: 'center'}}>
          <View style={styles.statusRow}>
            <View style={{justifyContent: 'center', alignItems: 'center'}}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View
                  style={[
                    styles.statusDot,
                    session.status === 'paused' && { backgroundColor: '#F59E0B' },
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
          </View>

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
        </View>

        <View style={styles.hero}>
          <Text style={styles.timer}>{formatTimer(elapsedSeconds)}</Text>
          <Text style={styles.timerLabel}>Tempo de trabalho</Text>
        </View>
      
        {activeRide && (
          <View style={styles.rideCardActive}>
            <View style={styles.rideActiveBadge}>
              <Ionicons name="car-sport-outline" size={14} color="#8BFFBF" />
              <Text style={styles.rideActiveBadgeText}>CORRIDA EM ANDAMENTO</Text>
            </View>

            <View style={styles.rideHeader}>
              <View style={styles.ridePlatformRow}>
                {activeRidePlatform?.logo_url ? (
                  <Image
                    source={{ uri: activeRidePlatform.logo_url }}
                    style={styles.rideLogo}
                  />
                ) : (
                  <View style={styles.rideLogoFallback}>
                    <Text style={styles.rideLogoFallbackText}>
                      {activeRide.platform.slice(0, 2)}
                    </Text>
                  </View>
                )}

                <View>
                  <Text style={styles.ridePlatform}>{activeRide.platform}</Text>
                  <Text style={styles.rideValue}>
                    R$ {formatCurrency(Number(activeRide.amount))}
                  </Text>
                </View>
              </View>

              <View style={styles.rideCircleIcon}>
                <Ionicons name="speedometer-outline" size={42} color="#22C55E" />
              </View>
            </View>

            <View style={styles.rideStatsBox}>
              <View style={styles.rideStatsRow}>
                <View style={styles.rideStatItem}>
                  <Text style={styles.rideStatLabel}>Tempo em andamento</Text>
                  <Text style={styles.rideStatValue}>
                    {formatTimer(getRideElapsedSeconds(activeRide))}
                  </Text>
                </View>

                <View style={styles.rideStatDivider} />

                <View style={styles.rideStatItem}>
                  <Text style={styles.rideStatLabel}>Ganho/hora agora</Text>
                  <Text style={styles.rideStatValue}>
                    R$ {Number(getRideGainPerHour(activeRide) ?? 0).toFixed(2).replace('.', ',')}
                  </Text>
                </View>
              </View>

              <View style={styles.rideKmBox}>
                <Text style={styles.rideStatLabel}>KM inicial</Text>
                <Text style={styles.rideStatValue}>
                  {Number(activeRide.start_km ?? 0).toLocaleString('pt-BR')} km
                </Text>
              </View>
            </View>

            <View style={styles.rideActions}>
              <TouchableOpacity
                style={styles.rideActionEdit}
                onPress={() => openEditRideModal(activeRide)}
              >
                <Ionicons name="create-outline" size={18} color="#4DA3FF" />
                <Text style={styles.rideActionTextBlue}>Editar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rideActionDelete}
                onPress={() => handleDeleteRide(activeRide)}
              >
                <Ionicons name="trash-outline" size={18} color="#FF5B5B" />
                <Text style={styles.rideActionTextRed}>Excluir</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rideActionFinish}
                onPress={() => openFinishRideModal(activeRide)}
              >
                <Ionicons name="flag-outline" size={18} color="#FFFFFF" />
                <Text style={styles.rideActionTextGreen}>Finalizar corrida</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {waitingRides.length > 0 && (
          <View>
            {waitingRides.map((ride) => {
              if (!ride) return null;

              const ridePlatformData = ride.platform
                ? getPlatformByName(ride.platform)
                : null;

              return (
                <View key={ride.id} style={styles.rideWaitingItem}>
                  <View style={styles.rideWaitingBadge}>
                    <Ionicons name="time-outline" size={14} color="#60A5FA" />

                    <Text style={styles.rideWaitingBadgeText}>
                      AGUARDANDO INÍCIO
                    </Text>
                  </View>

                  <View style={styles.rideHeader}>
                    <View style={styles.ridePlatformRow}>
                      {ridePlatformData?.logo_url ? (
                        <Image
                          source={{ uri: ridePlatformData.logo_url }}
                          style={styles.rideLogo}
                        />
                      ) : (
                        <View style={styles.rideLogoFallbackYellow}>
                          <Text style={styles.rideLogoFallbackYellowText}>
                            {ride.platform?.slice(0, 2) ?? '--'}
                          </Text>
                        </View>
                      )}

                      <View>
                        <Text style={styles.ridePlatform}>
                          {ride.platform ?? 'Plataforma'}
                        </Text>

                        <Text style={styles.rideWaitingValue}>
                          R$ {formatCurrency(Number(ride.amount ?? 0))}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.rideWaitingCircleIcon}>
                      <Ionicons name="hourglass-outline" size={42} color="#3B82F6" />
                    </View>
                  </View>

                  <View style={styles.rideWaitingActions}>
                    <TouchableOpacity
                      style={styles.rideActionEdit}
                      onPress={() => openEditRideModal(ride)}
                    >
                      <Ionicons name="create-outline" size={18} color="#4DA3FF" />
                      <Text style={styles.rideActionTextBlue}>Editar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.rideActionDelete}
                      onPress={() => handleDeleteRide(ride)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FF5B5B" />
                      <Text style={styles.rideActionTextRed}>Excluir</Text>
                    </TouchableOpacity>

                    {!activeRide && oldestWaitingRide?.id === ride.id && (
                      <TouchableOpacity
                        style={styles.startRideButton}
                        onPress={() => openStartWaitingRideModal(ride)}
                      >
                        <Ionicons name="play-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.startRideButtonText}>Iniciar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

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
            <Text style={styles.metricValue}>R$ {Number(gainPerHour ?? 0).toFixed(2).replace('.', ',')}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>GANHO/KM</Text>
            <Text style={styles.metricValue}>R$ {Number(gainPerKm ?? 0).toFixed(2).replace('.', ',')}</Text>
          </View>
        </View>

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
          onPress={openFinishSessionModal}
        >
          <Text style={styles.finishButtonText}>Finalizar jornada</Text>
        </TouchableOpacity>

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

            <View style={styles.platformsGrid}>
              {userPlatforms.map((item) => {
                const platform = item.platform;
                if (!platform) return null;

                const selected = ridePlatform === platform.name;

                return (
                  <TouchableOpacity
                    key={platform.id}
                    style={[
                      styles.platformGridCard,
                      selected && styles.platformGridCardActive,
                    ]}
                    onPress={() => setRidePlatform(platform.name)}
                  >
                    {platform.logo_url ? (
                      <Image source={{ uri: platform.logo_url }} style={styles.platformGridLogo} />
                    ) : (
                      <View style={styles.platformGridLogoFallback}>
                        <Text style={styles.platformGridLogoFallbackText}>
                          {platform.name.slice(0, 1)}
                        </Text>
                      </View>
                    )}

                    <Text style={styles.platformGridName} numberOfLines={1}>
                      {platform.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.finishInputLabel}>
              Valor da corrida/entrega
            </Text>

            <TextInput
              value={rideAmount}
              onChangeText={(text) => {
                let sanitized = text.replace(/[^0-9,]/g, '');

                const parts = sanitized.split(',');
                if (parts.length > 2) {
                  sanitized = parts[0] + ',' + parts[1];
                }
                if (parts[1]?.length > 2) {
                  sanitized =
                    parts[0] + ',' + parts[1].slice(0, 2);
                }
                setRideAmount(sanitized);
              }}
              placeholder="0,00"
              placeholderTextColor="#71717A"
              keyboardType="numeric"
              style={styles.input}
            />

            {(!activeRide || editingRide?.start_km) && (
              <>
                <Text style={styles.finishInputLabel}>KM inicial</Text>

                <TextInput
                  value={rideStartKm}
                  onChangeText={(text) => setRideStartKm(formatKm(text))}
                  placeholder="KM inicial"
                  placeholderTextColor="#71717A"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </>
            )}

            <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveRide}>
              <Text style={styles.modalSaveButtonText}>
                {editingRide ? 'Salvar alterações' : activeRide ? 'Registrar corrida/entrega' : 'Iniciar corrida/entrega'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addPlatformGridCard}
              onPress={() => {
                setRideModalVisible(false);

                setTimeout(() => {
                  setPlatformDrawerVisible(true);
                }, 400);
              }}
            >
              <Ionicons name="add" size={24} color="#FFFFFF" />

              <Text style={styles.addPlatformGridText}>
                Gerenciar plataformas
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
              {finishedRides.map((ride) => {
                const platformData = getPlatformByName(ride.platform);

                return (
                  <View key={ride.id} style={styles.finishedRideCard}>
                    <View style={styles.finishedRideTop}>
                      {platformData?.logo_url ? (
                        <Image
                          source={{ uri: platformData.logo_url }}
                          style={styles.finishedRideLogo}
                        />
                      ) : (
                        <View style={styles.finishedRideLogoFallback}>
                          <Text style={styles.finishedRideLogoFallbackText}>
                            {ride.platform?.slice(0, 2)}
                          </Text>
                        </View>
                      )}

                      <View style={{ flex: 1 }}>
                        <Text style={styles.finishedRideTitle}>
                          {formatRideHour(ride.started_at)} - {formatRideHour(ride.finished_at)} · {ride.platform}
                        </Text>

                        <Text style={styles.finishedRideAmount}>
                          R$ {formatCurrency(Number(ride.amount))}
                        </Text>
                      </View>

                      <View style={styles.finishedBadge}>
                        <Text style={styles.finishedBadgeText}>Concluída</Text>
                      </View>
                    </View>

                    <View style={styles.finishedDivider} />

                    <View style={styles.finishedStatsRow}>
                      <Text style={styles.finishedStatText}>
                        Tempo: {getFinishedRideDuration(ride)}
                      </Text>

                      <Text style={styles.finishedStatText}>
                        {getFinishedRideKm(ride).toLocaleString('pt-BR')} km
                      </Text>
                    </View>

                    <View style={styles.finishedStatsRow1}>
                      <View style={styles.finishedStatsRow2}>
                        <Text style={styles.finishedStatText1}>
                          Ganho/Hora
                        </Text>

                        <Text style={styles.finishedStatText2}>
                          R$ {formatCurrency(Number(ride.gain_per_hour ?? 0))}
                        </Text>
                      </View>

                       <View style={styles.finishedStatsRow2}>
                        <Text style={styles.finishedStatText1}>
                          Ganho/Km
                        </Text>

                        <Text style={styles.finishedStatText2}>
                          R$ {formatCurrency(Number(ride.gain_per_km ?? 0))}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.finishedActions}>
                      <TouchableOpacity
                        style={styles.finishedEditButton}
                        onPress={() => openEditFinishedRideModal(ride)}
                      >
                        <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.finishedEditText}>Editar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.finishedDeleteButton}
                        onPress={() => handleDeleteFinishedRide(ride)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#FF5B5B" />
                        <Text style={styles.finishedDeleteText}>Excluir</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={gainModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
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

              {editingEarningId ? (
                <View style={styles.platformLockedCard}>
                  {(() => {
                    const platformItem = userPlatforms.find(
                      (item) =>
                        item.platform?.name === selectedPlatform,
                    );

                    const platform = platformItem?.platform;

                    if (!platform) return null;

                    return (
                      <>
                        {platform.logo_url ? (
                          <Image
                            source={{ uri: platform.logo_url }}
                            style={styles.platformLockedLogo}
                          />
                        ) : (
                          <View style={styles.platformLockedLogoFallback}>
                            <Text style={styles.platformLockedLogoFallbackText}>
                              {platform.name.slice(0, 1)}
                            </Text>
                          </View>
                        )}

                        <View style={{ flex: 1 }}>
                          <Text style={styles.platformLockedName}>
                            {platform.name}
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </View>
              ) : (
                <View style={styles.platformsGrid}>
                  {userPlatforms.length === 0 ? (
                    <TouchableOpacity
                      style={styles.emptyPlatformsBox}
                      onPress={openPlatformDrawerFromGainModal}
                    >
                      <Ionicons
                        name="apps-outline"
                        size={34}
                        color="#A1A1AA"
                      />

                      <Text style={styles.emptyPlatformsTitle}>
                        Nenhuma plataforma definida
                      </Text>

                      <Text style={styles.emptyPlatformsText}>
                        Clique em gerenciar plataformas e defina ao menos uma plataforma para continuar.
                      </Text>

                      <View style={styles.emptyPlatformsButton}>
                        <Text style={styles.emptyPlatformsButtonText}>
                          Gerenciar plataformas
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.platformsGrid}>
                      {userPlatforms.map((item) => {
                        const platform = item.platform;

                        if (!platform) return null;

                        const selected =
                          selectedPlatform === platform.name;

                        const alreadyHasGain = earnings.some(
                          (earning: any) =>
                            earning.platform === platform.name,
                        );

                        return (
                          <TouchableOpacity
                            key={platform.id}
                            disabled={alreadyHasGain}
                            style={[
                              styles.platformGridCard,
                              selected &&
                                styles.platformGridCardActive,
                              alreadyHasGain && {
                                opacity: 0.35,
                              },
                            ]}
                            onPress={() => {
                              if (alreadyHasGain) return;

                              setSelectedPlatform(platform.name);
                            }}
                          >
                            {platform.logo_url ? (
                              <Image
                                source={{
                                  uri: platform.logo_url,
                                }}
                                style={styles.platformGridLogo}
                              />
                            ) : (
                              <View
                                style={
                                  styles.platformGridLogoFallback
                                }
                              >
                                <Text
                                  style={
                                    styles.platformGridLogoFallbackText
                                  }
                                >
                                  {platform.name.slice(0, 1)}
                                </Text>
                              </View>
                            )}

                            <Text
                              style={styles.platformGridName}
                              numberOfLines={1}
                            >
                              {platform.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              <Text style={{color: '#ffffff', marginLeft: 5, marginBottom: 5}}>Valor do ganho</Text>
              <TextInput
                value={gainValue}
                onChangeText={setGainValue}
                placeholder="Valor do ganho"
                placeholderTextColor="#71717A"
                keyboardType="numeric"
                style={styles.input}
              />

              {!editingEarningId && (
                <TouchableOpacity
                  style={styles.addPlatformGridCard}
                  onPress={openPlatformDrawerFromGainModal}
                >
                  <Ionicons name="add" size={24} color="#FFFFFF" />

                  <Text style={styles.addPlatformGridText}>
                    Gerenciar plataformas
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveGain}>
                <Text style={styles.modalSaveButtonText}>Salvar ganho</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContentLarge}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Finalizar jornada</Text>

                <TouchableOpacity onPress={() => setFinishModalVisible(false)}>
                  <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Confira o KM final e informe os ganhos das plataformas.
              </Text>

              <ScrollView>

                <Text style={styles.finishInputLabel}>Km final</Text>

                <TextInput
                  value={kmValue}
                  onChangeText={(text) => setKmValue(formatKm(text))}
                  placeholder="KM final"
                  placeholderTextColor="#71717A"
                  keyboardType="numeric"
                  style={styles.input}
                />

                {userPlatforms.length === 0 ? (
                  <TouchableOpacity
                    style={styles.emptyPlatformsBox}
                    onPress={() => {
                      setFinishModalVisible(false);

                      setTimeout(() => {
                        setPlatformDrawerVisible(true);
                      }, 400);
                    }}
                  >
                    <Ionicons name="apps-outline" size={34} color="#A1A1AA" />

                    <Text style={styles.emptyPlatformsTitle}>
                      Nenhuma plataforma definida
                    </Text>

                    <Text style={styles.emptyPlatformsText}>
                      Clique em gerenciar plataformas e defina ao menos uma plataforma para continuar.
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    {userPlatforms.map((item: any) => {
                      const platform = item.platform;

                      if (!platform) return null;

                      return (
                        <View key={platform.id} style={styles.finishPlatformItem}>
                          <View style={styles.finishPlatformHeader}>
                            {platform.logo_url ? (
                              <Image
                                source={{ uri: platform.logo_url }}
                                style={styles.finishPlatformLogo}
                              />
                            ) : (
                              <View style={styles.finishPlatformLogoFallback}>
                                <Text style={styles.finishPlatformLogoFallbackText}>
                                  {platform.name.slice(0, 1)}
                                </Text>
                              </View>
                            )}

                            <Text style={styles.finishPlatformName}>
                              {platform.name}
                            </Text>
                          </View>

                          <TextInput
                            value={finishPlatformValues[platform.name] ?? ''}
                            onChangeText={(text) =>
                              setFinishPlatformValues((prev) => ({
                                ...prev,
                                [platform.name]: text,
                              }))
                            }
                            placeholder="0,00"
                            placeholderTextColor="#71717A"
                            keyboardType="numeric"
                            style={styles.finishPlatformInput}
                          />
                        </View>
                      );
                    })}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.managePlatformsButton}
                  onPress={() => {
                    setFinishModalVisible(false);

                    setTimeout(() => {
                      setPlatformDrawerVisible(true);
                    }, 400);
                  }}
                >
                  <Ionicons
                    name="apps-outline"
                    size={20}
                    color="#FFFFFF"
                  />

                  <Text style={styles.managePlatformsButtonText}>
                    Gerenciar plataformas
                  </Text>
                </TouchableOpacity>

              </ScrollView>

              <TouchableOpacity
                style={styles.modalFinishButton}
                onPress={handleFinishSession}
              >
                <Text style={styles.modalFinishButtonText}>Concluir jornada</Text>
              </TouchableOpacity>
              
            </View>
          </View>
        </KeyboardAvoidingView>
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

      <Modal visible={platformDrawerVisible} transparent animationType="slide">
        <View style={styles.drawerOverlay}>
          <View style={styles.drawer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Minhas plataformas</Text>

              <TouchableOpacity onPress={() => setPlatformDrawerVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {platformsList.map((platform) => {
                const selected = selectedPlatformIds.includes(platform.id);

                return (
                  <TouchableOpacity
                    key={platform.id}
                    style={[
                      styles.platformListItem,
                      selected && styles.platformListItemSelected,
                    ]}
                    onPress={() => togglePlatformSelection(platform.id)}
                  >
                    {platform.logo_url ? (
                      <Image source={{ uri: platform.logo_url }} style={styles.platformLogo} />
                    ) : (
                      <View style={styles.platformLogoFallback}>
                        <Text style={styles.platformLogoFallbackText}>
                          {platform.name.slice(0, 1)}
                        </Text>
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <Text style={styles.platformListName}>{platform.name}</Text>
                      <Text style={styles.platformListDescription}>{platform.description}</Text>
                    </View>

                    {selected && (
                      <TouchableOpacity
                        style={styles.removePlatformButton}
                        onPress={(event) => {
                          event.stopPropagation();
                          togglePlatformSelection(platform.id);
                        }}
                      >
                        <Ionicons name="close" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveUserPlatforms}>
              <Text style={styles.modalSaveButtonText}>Concluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={driversModalVisible} transparent animationType="slide">
        <View style={styles.cityModalOverlay}>
          <View style={styles.cityModalContent}>
            <View style={styles.cityModalHeader}>
              <Text style={styles.cityModalTitle}>
                Rodando agora
              </Text>

              <TouchableOpacity onPress={() => setDriversModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {onlineDrivers.map((item) => (
                <View key={item.id} style={styles.driverOnlineItem}>
                  {item.user?.avatar_url ? (
                    <Image
                      source={{ uri: item.user.avatar_url }}
                      style={styles.driverAvatar}
                    />
                  ) : (
                    <View style={styles.driverAvatarFallback}>
                      <Ionicons name="person" size={22} color="#FFFFFF" />
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverName}>
                      {item.user?.full_name || item.user?.name || 'Motorista'}
                    </Text>

                    <Text style={styles.driverStatus}>
                      {item.status === 'active' ? 'Rodando' : 'Em pausa'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.driverStatusDot,
                      {
                        backgroundColor:
                          item.status === 'active' ? '#22C55E' : '#F59E0B',
                      },
                    ]}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={municipalityModalVisible} transparent animationType="slide">
        <View style={styles.cityModalOverlay}>
          <View style={styles.cityModalContent}>
            <View style={styles.cityModalHeader}>
              <Text style={styles.cityModalTitle}>
                Alterar cidade
              </Text>

              <TouchableOpacity onPress={() => setMunicipalityModalVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={municipalitySearch}
              onChangeText={handleSearchMunicipalities}
              placeholder="Buscar cidade"
              placeholderTextColor="#71717A"
              style={styles.citySearchInput}
            />

            <ScrollView keyboardShouldPersistTaps="handled">
              {municipalities.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.cityOptionItem}
                  onPress={() => handleChangeMunicipality(item)}
                >
                  <View>
                    <Text style={styles.cityOptionName}>
                      {item.name} - {item.uf}
                    </Text>

                    <Text style={styles.cityOptionRegion}>
                      Região: {item.immediate_region}
                    </Text>
                  </View>

                  {session?.municipality_id === item.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color="#22C55E"
                    />
                  )}
                </TouchableOpacity>
              ))}

              {municipalitySearch.trim().length >= 2 &&
                municipalities.length === 0 && (
                  <Text style={styles.emptyText}>
                    Nenhuma cidade encontrada.
                  </Text>
                )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={cityChatVisible} transparent animationType="slide">
        <View style={styles.cityModalOverlay}>
          <View style={styles.cityChatContent}>
            <View style={styles.cityModalHeader}>
              <View>
                <Text style={styles.cityModalTitle}>Chat da cidade</Text>
                <Text style={styles.cityBottomSubtitle}>
                  {session?.municipality?.name} - {session?.municipality?.uf}
                </Text>
              </View>

              <TouchableOpacity onPress={() => setCityChatVisible(false)}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {chatMessages.map((item) => {
                const isMe = item.user_id === currentUserId;
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.chatMessageItem,
                      {
                        justifyContent: isMe ? 'flex-end' : 'flex-start',
                      },
                    ]}
                  >
                    {!isMe && (
                      item.user?.avatar_url ? (
                        <Image
                          source={{ uri: item.user.avatar_url }}
                          style={styles.chatAvatar}
                        />
                      ) : (
                        <View style={styles.chatAvatarFallback}>
                          <Ionicons name="person" size={18} color="#FFFFFF" />
                        </View>
                      )
                    )}

                    <View
                      style={[
                        styles.chatBubble,
                        {
                          backgroundColor: isMe ? '#22C55E' : '#18181B',
                          marginLeft: isMe ? 10 : 0,
                          marginRight: isMe ? 0 : 10,
                        },
                      ]}
                    >
                      {!isMe && (
                        <Text style={styles.chatUserName}>
                          {item.user?.full_name || item.user?.name || 'Motorista'}
                        </Text>
                      )}

                      <Text style={styles.chatText}>{item.message}</Text>

                      <Text style={styles.chatHour}>
                        {new Date(item.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.chatInputRow}>
              <TextInput
                value={chatMessage}
                onChangeText={setChatMessage}
                placeholder="Digite uma mensagem..."
                placeholderTextColor="#71717A"
                style={styles.chatInput}
              />

              <TouchableOpacity
                style={styles.chatSendButton}
                onPress={handleSendCityMessage}
              >
                <Ionicons name="send" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {session?.municipality && (
        <View style={styles.cityBottomMenu}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setDriversModalVisible(true)}
          >
            <Text style={styles.cityBottomTitle}>
              {onlineDrivers.length} rodando agora
            </Text>

            <Text style={styles.cityBottomSubtitle}>
              {session.municipality.name} - {session.municipality.uf}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cityChangeButton}
            onPress={() => setMunicipalityModalVisible(true)}
          >
            <Ionicons
              name="location-outline"
              size={18}
              color="#FFFFFF"
            />

            <Text style={styles.cityChangeText}>
              Alterar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cityChatButton} onPress={openCityChat}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFFFFF" />

            {unreadChatCount > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 100,
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
    right: 0
  },

  hero: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 35,
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
    marginRight: 5
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
    marginLeft: 20
  },

  timer: {
    color: '#FFFFFF',
    fontSize: 65,
    fontWeight: '600',
    marginTop: 28,
  },

  timerLabel: {
    color: '#A1A1AA',
    marginTop: 0,
    fontSize: 14,
    fontWeight: '600',
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
    justifyContent: 'space-around'
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
    fontSize: 25,
    fontWeight: '700',
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
    marginBottom: 15,
    marginTop: 15
  },

  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  bottomActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15
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

  rideInfo: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
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

  floatingRideButton: {
    position: 'absolute',
    right: 18,
    bottom: 100,
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
    bottom: 100,
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
  addPlatformChip: {
    height: 42,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginRight: 8,
    marginBottom: 16,
  },

  platformListItem: {
    minHeight: 76,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 10,
  },

  platformListItemSelected: {
    borderColor: '#22C55E',
    backgroundColor: '#052E16',
  },

  platformLogo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    marginRight: 12,
  },

  platformLogoFallback: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  platformLogoFallbackText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  platformListName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  platformListDescription: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'capitalize',
  },

  removePlatformButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },

  addPlatformButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformsContainer: {
    marginBottom: 14,
  },

  platformSelectCard: {
    minHeight: 70,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 10,
  },

  platformSelectCardActive: {
    backgroundColor: '#052E16',
    borderColor: '#22C55E',
  },

  platformSelectLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 12,
  },

  platformSelectLogoFallback: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  platformSelectLogoFallbackText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  platformSelectName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  platformSelectType: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'capitalize',
  },

  addPlatformCard: {
    height: 64,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },

  addPlatformCardText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  platformsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },

  platformGridCard: {
    width: 160,
    flexDirection: 'row',
    gap: 5,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    padding: 10,
  },

  platformGridCardActive: {
    backgroundColor: '#052E16',
    borderColor: '#22C55E',
  },

  platformGridLogo: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },

  platformGridLogoFallback: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  platformGridLogoFallbackText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  platformGridName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  addPlatformGridCard: {
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginVertical: 10,
    flexDirection: 'row'
  },

  addPlatformGridText: {
    color: '#FFFFFF',
    fontSize: 14,
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyPlatformsBox: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom:50,
  },

  emptyPlatformsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 14,
  },

  emptyPlatformsText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },

  emptyPlatformsButton: {
    marginTop: 18,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyPlatformsButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  platformLockedCard: {
    minHeight: 74,
    borderRadius: 16,
    backgroundColor: '#052E16',
    borderWidth: 1,
    borderColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
  },

  platformLockedLogo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    marginRight: 12,
  },

  platformLockedLogoFallback: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  platformLockedLogoFallbackText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  platformLockedName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  platformLockedDescription: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  finishInputLabel: {
    color: '#CCCCCC',
    margin: 10,
    marginBottom: 5,
    fontWeight: '700',
    fontSize: 12,
  },

  finishPlatformItem: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 12,
    marginBottom: 10,
  },

  finishPlatformHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  finishPlatformLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    marginRight: 10,
  },

  finishPlatformLogoFallback: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  finishPlatformLogoFallbackText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  finishPlatformName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  finishPlatformInput: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '800',
  },
  managePlatformsButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
  },

  managePlatformsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  rideCardActive: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    backgroundColor: '#031B12',
    borderWidth: 1.5,
    borderColor: '#00FF85',
    overflow: 'hidden',
  },

  rideActiveBadge: {
    alignSelf: 'flex-start',
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(0,255,133,0.12)',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },

  rideActiveBadgeText: {
    color: '#8BFFBF',
    fontSize: 12,
    fontWeight: '900',
  },

  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  ridePlatformRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  rideLogo: {
    width: 54,
    height: 54,
    borderRadius: 16,
    marginRight: 14,
  },

  rideLogoFallback: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  rideLogoFallbackText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },

  ridePlatform: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  rideValue: {
    color: '#00FF85',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },

  rideCircleIcon: {
    width: 76,
    height: 76,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#00FF85',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,255,133,0.08)',
  },

  rideStatsBox: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginBottom: 16,
  },

  rideStatsRow: {
    flexDirection: 'row',
  },

  rideStatItem: {
    flex: 1,
  },

  rideStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 14,
  },

  rideStatLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },

  rideStatValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  rideKmBox: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },

  rideActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  rideActionEdit: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#062B4F',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  rideActionDelete: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#3B0B12',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  rideActionFinish: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  rideActionTextBlue: {
    color: '#4DA3FF',
    fontSize: 14,
    fontWeight: '900',
  },

  rideActionTextRed: {
    color: '#FF5B5B',
    fontSize: 14,
    fontWeight: '900',
  },

  rideActionTextGreen: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  rideWaitingItem: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    backgroundColor: '#03142F',
    borderWidth: 1.5,
    borderColor: '#2563EB',
  },

  rideWaitingBadge: {
    alignSelf: 'flex-start',
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.12)',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },

  rideWaitingBadgeText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '900',
  },

  rideWaitingActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },

  startRideButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  startRideButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  rideLogoFallbackYellow: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  rideLogoFallbackYellowText: {
    color: '#000000',
    fontSize: 24,
    fontWeight: '900',
  },

  rideWaitingValue: {
    color: '#3B82F6',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },

  rideWaitingCircleIcon: {
    width: 76,
    height: 76,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.08)',
  },
  finishedRideCard: {
    backgroundColor: '#0B1220',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 16,
  },

  finishedRideTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  finishedRideLogo: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },

  finishedRideLogoFallback: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
  },

  finishedRideLogoFallbackText: {
    color: '#000000',
    fontSize: 22,
    fontWeight: '900',
  },

  finishedRideTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  finishedRideAmount: {
    color: '#4ADE80',
    fontSize: 28,
    fontWeight: '900',
  },

  finishedBadge: {
    backgroundColor: '#064E3B',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  finishedBadgeText: {
    color: '#BBF7D0',
    fontSize: 12,
    fontWeight: '900',
  },

  finishedDivider: {
    height: 1,
    backgroundColor: '#1F2937',
    marginVertical: 14,
  },

  finishedStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  finishedStatsRow1: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },

  finishedStatsRow2: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#1F2937',
    gap: 5,
    marginHorizontal: 10
  },

  finishedStatText: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '400',
  },

  finishedStatText1: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '400',
  },

  finishedStatText2: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
  },

  finishedActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },

  finishedEditButton: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1F2937',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  finishedEditText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  finishedDeleteButton: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#3B0B12',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  finishedDeleteText: {
    color: '#FF5B5B',
    fontWeight: '900',
  },

  cityBottomMenu: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    minHeight: 76,
    borderRadius: 24,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cityBottomTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  cityBottomSubtitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  cityChangeButton: {
    height: 42,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  cityChangeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  cityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },

  cityModalContent: {
    height: '70%',
    backgroundColor: '#09090B',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
  },

  cityModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  cityModalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },

  driverOnlineItem: {
    minHeight: 68,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
  },

  driverAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  driverName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  driverStatus: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  driverStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  citySearchInput: {
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

  cityOptionItem: {
    minHeight: 66,
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

  cityOptionName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  cityOptionRegion: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  cityChatButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  chatBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },

  chatBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  cityChatContent: {
    height: '82%',
    backgroundColor: '#09090B',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
  },

  chatMessageItem: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    width: '100%',
  },

  chatAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
  },

  chatAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  chatBubble: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '75%',
    minWidth: '40%',
    alignSelf: 'flex-start',
  },

  chatUserName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  chatText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 5,
  },

  chatHour: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '700',
    alignSelf: 'flex-end',
    marginTop: 6,
  },

  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
  },

  chatInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 100,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '700',
  },

  chatSendButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
});