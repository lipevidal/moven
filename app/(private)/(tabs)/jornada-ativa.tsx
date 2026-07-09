import { useEffect, useMemo, useRef, useState } from 'react';
import { getOnlineDriversByMunicipality } from '../../../src/features/municipalities/services/getOnlineDriversByMunicipality';
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
  DeviceEventEmitter,
} from 'react-native';
import { getPrivateChatMessages } from '../../../src/features/privateChat/services/getPrivateChatMessages';
import { sendPrivateChatMessage } from '../../../src/features/privateChat/services/sendPrivateChatMessage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalLoading } from '../../../src/components/GlobalLoadingProvider';
import { searchMunicipalities } from '../../../src/features/municipalities/services/searchMunicipalities';
import { updateSessionMunicipality } from '../../../src/features/municipalities/services/updateSessionMunicipality';
import { getActiveSession } from '../../../src/features/workSessions/services/getActiveSession';
import { createEarning } from '../../../src/features/workSessions/services/createEarning';
import { updateEarning } from '../../../src/features/workSessions/services/updateEarning';
import { deleteEarning } from '../../../src/features/workSessions/services/deleteEarning';
import { updateSessionKm } from '../../../src/features/workSessions/services/updateSessionKm';
import { pauseWorkSession } from '../../../src/features/workSessions/services/pauseWorkSession';
import { resumeWorkSession } from '../../../src/features/workSessions/services/resumeWorkSession';
import { deleteWorkSession } from '../../../src/features/workSessions/services/deleteWorkSession';
import { finishWorkSession } from '../../../src/features/workSessions/services/finishWorkSession';
import { getCityChatMessages } from '../../../src/features/cityChat/services/getCityChatMessages';
import { sendCityChatMessage } from '../../../src/features/cityChat/services/sendCityChatMessage';
import { getUnreadCityChatCount } from '../../../src/features/cityChat/services/getUnreadCityChatCount';
import { markCityChatAsRead } from '../../../src/features/cityChat/services/markCityChatAsRead';
import { getSessionRides } from '../../../src/features/rides/services/getSessionRides';
import { createRide } from '../../../src/features/rides/services/createRide';
import { updateRide } from '../../../src/features/rides/services/updateRide';
import { deleteRide } from '../../../src/features/rides/services/deleteRide';
import { startWaitingRide } from '../../../src/features/rides/services/startWaitingRide';
import { finishRide } from '../../../src/features/rides/services/finishRide';
import { updateFinishedRide } from '../../../src/features/rides/services/updateFinishedRide';
import { deleteFinishedRide } from '../../../src/features/rides/services/deleteFinishedRide';

import { getPlatforms } from '../../../src/features/platforms/services/getPlatforms';
import { getUserPlatforms } from '../../../src/features/platforms/services/getUserPlatforms';
import { toggleUserPlatform } from '../../../src/features/platforms/services/toggleUserPlatform';
import { supabase } from '../../../src/database/supabase';


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
      return require('../../../assets/vehicles/motorcycle.png');

    case 'utility':
      return require('../../../assets/vehicles/utility.png');

    default:
      return require('../../../assets/vehicles/car.png');
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

function formatDateInput(date: Date) {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTimeInput(date: Date) {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function maskDateInput(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 8);

  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  }

  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4)}`;
}

function maskTimeInput(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 4);

  if (numbers.length <= 2) return numbers;

  return `${numbers.slice(0, 2)}:${numbers.slice(2)}`;
}

function parseDateTimeInput(dateValue: string, timeValue: string) {
  const [day, month, year] = dateValue.split('/').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);

  if (!day || !month || !year || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  const date = new Date(year, month - 1, day, hour, minute, 0, 0);

  const validDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute;

  return validDate ? date : null;
}

function getUserAvatarUrl(user: any) {
  return (
    user?.avatar_url ||
    user?.photo_url ||
    user?.picture ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null
  );
}

function getUserDisplayName(user: any) {
  return (
    user?.full_name ||
    user?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    'Motorista'
  );
}

type JourneyProfileType = 'intensive' | 'moderate' | 'light' | 'empty';

function startOfDay(date: Date) {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);

  return normalizedDate;
}

function getDaysBetween(startDate: Date, endDate: Date) {
  const start = startOfDay(startDate).getTime();
  const end = startOfDay(endDate).getTime();

  return Math.max(Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1, 1);
}

function getSessionBaseDate(session: any) {
  const baseDate = session?.started_at || session?.finished_at;

  if (!baseDate) return null;

  const date = new Date(baseDate);

  return Number.isNaN(date.getTime()) ? null : date;
}

function calculateFinishedSessionHours(session: any) {
  if (!session?.started_at || !session?.finished_at) return 0;

  const startedAt = new Date(session.started_at).getTime();
  const finishedAt = new Date(session.finished_at).getTime();

  if (Number.isNaN(startedAt) || Number.isNaN(finishedAt)) return 0;

  const pausedSeconds = Number(session.total_paused_seconds ?? 0);

  return Math.max((finishedAt - startedAt) / 1000 - pausedSeconds, 0) / 3600;
}

function getJourneyProfileTypeFromSessions(sessions: any[]): JourneyProfileType {
  if (!sessions.length) return 'empty';

  const today = startOfDay(new Date());
  const oneHundredDaysAgo = startOfDay(new Date());
  oneHundredDaysAgo.setDate(today.getDate() - 99);

  const sessionDates = sessions
    .map((session) => getSessionBaseDate(session))
    .filter(Boolean) as Date[];

  const firstSessionDate =
    sessionDates.length > 0
      ? sessionDates.reduce((oldestDate, currentDate) =>
          currentDate.getTime() < oldestDate.getTime()
            ? currentDate
            : oldestDate,
        )
      : null;

  if (!firstSessionDate) return 'empty';

  const analysisStartDate = startOfDay(
    firstSessionDate.getTime() > oneHundredDaysAgo.getTime()
      ? firstSessionDate
      : oneHundredDaysAgo,
  );

  const journeyProfileDays = getDaysBetween(analysisStartDate, today);

  const totalHours = sessions.reduce((total, session) => {
    const sessionDate = getSessionBaseDate(session);

    if (!sessionDate) return total;

    const normalizedSessionDate = startOfDay(sessionDate);

    if (
      normalizedSessionDate.getTime() < analysisStartDate.getTime() ||
      normalizedSessionDate.getTime() > today.getTime()
    ) {
      return total;
    }

    return total + calculateFinishedSessionHours(session);
  }, 0);

  const averageHours = journeyProfileDays > 0 ? totalHours / journeyProfileDays : 0;

  if (averageHours >= 8) return 'intensive';
  if (averageHours >= 5) return 'moderate';

  return 'light';
}

function getJourneyProfileInfo(type: JourneyProfileType) {
  if (type === 'intensive') {
    return {
      label: 'Intensiva',
      icon: 'flame-outline' as const,
      color: '#F97316',
      backgroundColor: 'rgba(249,115,22,0.14)',
      borderColor: 'rgba(249,115,22,0.32)',
    };
  }

  if (type === 'moderate') {
    return {
      label: 'Moderada',
      icon: 'speedometer-outline' as const,
      color: '#FACC15',
      backgroundColor: 'rgba(250,204,21,0.13)',
      borderColor: 'rgba(250,204,21,0.30)',
    };
  }

  if (type === 'light') {
    return {
      label: 'Leve',
      icon: 'leaf-outline' as const,
      color: '#D4A64A',
      backgroundColor: 'rgba(212,166,74,0.13)',
      borderColor: 'rgba(212,166,74,0.30)',
    };
  }

  return {
    label: 'Sem perfil',
    icon: 'briefcase-outline' as const,
    color: '#9B969B',
    backgroundColor: 'rgba(161,161,170,0.10)',
    borderColor: 'rgba(161,161,170,0.22)',
  };
}

type PerformanceTargets = {
  bad_gain_per_hour: number | null;
  good_gain_per_hour: number | null;
  bad_gain_per_km: number | null;
  good_gain_per_km: number | null;
};

export default function ActiveSessionScreen() {
  const { withLoading } = useGlobalLoading();
  const [session, setSession] = useState<any>(null);
  const [rides, setRides] = useState<any[]>([]);
  const [cityChatVisible, setCityChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [currentUserId, setCurrentUserId] = useState('');
  const [performanceTargets, setPerformanceTargets] =
    useState<PerformanceTargets | null>(null);
  const [gainModalVisible, setGainModalVisible] = useState(false);
  const [kmModalVisible, setKmModalVisible] = useState(false);
  const [finishModalVisible, setFinishModalVisible] = useState(false);
  const [privateChatVisible, setPrivateChatVisible] = useState(false);
  const [privateChatUser, setPrivateChatUser] = useState<any>(null);
  const [privateMessages, setPrivateMessages] = useState<any[]>([]);
  const [privateMessageText, setPrivateMessageText] = useState('');

  const rideModalScrollRef = useRef<ScrollView | null>(null);
  const startWaitingRideScrollRef = useRef<ScrollView | null>(null);

  const [replyingCityMessage, setReplyingCityMessage] = useState<any>(null);
  const [replyingPrivateMessage, setReplyingPrivateMessage] = useState<any>(null);
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
  const [returnToRideModalAfterPlatforms, setReturnToRideModalAfterPlatforms] =
    useState(false);
  const [returnToFinishModalAfterPlatforms, setReturnToFinishModalAfterPlatforms] =
    useState(false);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);
  const [finishPlatformValues, setFinishPlatformValues] = useState<Record<string, string>>({});
  const [finishDateValue, setFinishDateValue] = useState('');
  const [finishTimeValue, setFinishTimeValue] = useState('');
  const [finishTimeEditModalVisible, setFinishTimeEditModalVisible] =
    useState(false);
  const [draftFinishDateValue, setDraftFinishDateValue] = useState('');
  const [draftFinishTimeValue, setDraftFinishTimeValue] = useState('');

  const [onlineDrivers, setOnlineDrivers] = useState<any[]>([]);
  const [driversModalVisible, setDriversModalVisible] = useState(false);
  const [driverActionModalVisible, setDriverActionModalVisible] = useState(false);
  const [selectedOnlineDriver, setSelectedOnlineDriver] = useState<any>(null);
  const [driverJourneyProfiles, setDriverJourneyProfiles] = useState<
    Record<string, JourneyProfileType>
  >({});
  const [municipalityModalVisible, setMunicipalityModalVisible] = useState(false);

  const [municipalitySearch, setMunicipalitySearch] = useState('');
  const [municipalities, setMunicipalities] = useState<any[]>([]);
  const [privateChatPreviews, setPrivateChatPreviews] = useState<
    Record<string, { lastMessage: string; unread: number; createdAt?: string }>
  >({});

  async function loadPrivateChatPreviews() {
    if (!currentUserId) return;

    type PrivatePreviewMessage = {
      id: any;
      sender_id: any;
      receiver_id: any;
      message: any;
      created_at: any;
      read_at: any | null;
    };

    let data: PrivatePreviewMessage[] | null = null;

    const response = await supabase
      .from('private_chat_messages')
      .select('id,sender_id,receiver_id,message,created_at,read_at')
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false });

    if (response.error) {
      // Fallback para projetos que ainda não rodaram o SQL do read_at.
      // Mapeamos read_at como null para não quebrar o TypeScript.
      const fallback = await supabase
        .from('private_chat_messages')
        .select('id,sender_id,receiver_id,message,created_at')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false });

      if (fallback.error) {
        console.log(fallback.error);
        return;
      }

      data = (fallback.data ?? []).map((message: any) => ({
        ...message,
        read_at: null,
      }));
    } else {
      data = response.data ?? [];
    }

    const previews: Record<
      string,
      { lastMessage: string; unread: number; createdAt?: string }
    > = {};

    (data ?? []).forEach((message: PrivatePreviewMessage) => {
      const otherUserId =
        message.sender_id === currentUserId
          ? message.receiver_id
          : message.sender_id;

      if (!otherUserId) return;

      if (!previews[otherUserId]) {
        previews[otherUserId] = {
          lastMessage: `${message.sender_id === currentUserId ? 'Você: ' : ''}${message.message ?? ''}`,
          unread: 0,
          createdAt: message.created_at,
        };
      }

      if (message.receiver_id === currentUserId && !message.read_at) {
        previews[otherUserId].unread += 1;
      }
    });

    setPrivateChatPreviews(previews);
  }

  async function markPrivateMessagesAsRead(senderId: string) {
    if (!currentUserId || !senderId) return;

    const { error } = await supabase
      .from('private_chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', senderId)
      .eq('receiver_id', currentUserId)
      .is('read_at', null);

    if (error) {
      console.log(error);
    }

    await loadPrivateChatPreviews();
  }

  async function handleSearchMunicipalities(text: string) {
    setMunicipalitySearch(text);

    if (text.trim().length < 2) {
      setMunicipalities([]);
      return;
    }

    const response = await searchMunicipalities(text);

    setMunicipalities(response);
  }

  async function openPrivateChat(user: any) {
    if (!user?.id) return;

    setPrivateChatUser(user);
    setPrivateChatVisible(true);

    const response = await getPrivateChatMessages(user.id);
    setPrivateMessages(response);

    await markPrivateMessagesAsRead(user.id);
  }

  function openDriverActions(user: any) {
    if (!user?.id) return;

    setSelectedOnlineDriver(user);
    setDriverActionModalVisible(true);
  }

  function closeDriverActions() {
    setDriverActionModalVisible(false);
    setSelectedOnlineDriver(null);
  }

  function handleViewSelectedDriverProfile() {
    if (!selectedOnlineDriver?.id) return;

    const userId = selectedOnlineDriver.id;

    setDriverActionModalVisible(false);
    setDriversModalVisible(false);
    setSelectedOnlineDriver(null);

    setTimeout(() => {
      router.push({
        pathname: '/perfil-publico/[userId]',
        params: { userId },
      } as never);
    }, 250);
  }

  function handleMessageSelectedDriver() {
    if (!selectedOnlineDriver?.id) return;

    const userId = selectedOnlineDriver.id;

    setDriverActionModalVisible(false);
    setDriversModalVisible(false);
    setSelectedOnlineDriver(null);

    setTimeout(() => {
      router.push({
        pathname: '/conversa-privada/[userId]',
        params: { userId },
      } as never);
    }, 250);
  }

  async function handleSendPrivateMessage() {
    if (!privateMessageText.trim() || !privateChatUser?.id) return;

    await sendPrivateChatMessage({
      receiverId: privateChatUser.id,
      message: privateMessageText,
      replyToMessageId: replyingPrivateMessage?.id ?? null,
    });

    setPrivateMessageText('');
    setReplyingPrivateMessage(null);

    const response = await getPrivateChatMessages(privateChatUser.id);
    setPrivateMessages(response);
    await loadPrivateChatPreviews();
  }

  async function loadCityChat(markAsRead = false) {
    if (!session?.municipality_id) return;

    const response = await getCityChatMessages(session.municipality_id);
    setChatMessages(response);

    if (markAsRead) {
      await markCityChatAsRead(session.municipality_id);
      setUnreadChatCount(0);
      return;
    }

    const unread = await getUnreadCityChatCount(session.municipality_id);
    setUnreadChatCount(unread);
  }

  async function openCityChat() {
    if (!session?.municipality_id) return;

    setCityChatVisible(true);
    await loadCityChat(true);
  }

  async function handleSendCityMessage() {
    if (!chatMessage.trim() || !session?.municipality_id) return;

    const messageToSend = chatMessage.trim();

    setChatMessage('');
    setReplyingCityMessage(null);

    await sendCityChatMessage({
      municipalityId: session.municipality_id,
      message: messageToSend,
      replyToMessageId: replyingCityMessage?.id ?? null,
    });

    await loadCityChat(true);
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

  function openPlatformDrawerFromRideModal() {
    // Evita travamento no Android/iOS por empilhar o modal de plataformas
    // por cima do modal de iniciar corrida/entrega.
    setReturnToRideModalAfterPlatforms(true);
    setRideModalVisible(false);

    setTimeout(() => {
      setPlatformDrawerVisible(true);
    }, 400);
  }

  function openPlatformDrawerFromFinishModal() {
    // Mesma regra para o modal de concluir jornada.
    setReturnToFinishModalAfterPlatforms(true);
    setFinishModalVisible(false);

    setTimeout(() => {
      setPlatformDrawerVisible(true);
    }, 400);
  }

  function closePlatformDrawerAndReturn() {
    const shouldReturnToGain = returnToGainModalAfterPlatforms;
    const shouldReturnToRide = returnToRideModalAfterPlatforms;
    const shouldReturnToFinish = returnToFinishModalAfterPlatforms;

    setPlatformDrawerVisible(false);

    setReturnToGainModalAfterPlatforms(false);
    setReturnToRideModalAfterPlatforms(false);
    setReturnToFinishModalAfterPlatforms(false);

    setTimeout(() => {
      if (shouldReturnToGain) {
        setGainModalVisible(true);
        return;
      }

      if (shouldReturnToRide) {
        setRideModalVisible(true);
        return;
      }

      if (shouldReturnToFinish) {
        setFinishModalVisible(true);
      }
    }, 400);
  }

  function openFinishSessionModal() {
    if (activeRide || waitingRides.length > 0) {
      Alert.alert(
        'Corrida pendente',
        'Finalize ou exclua a corrida em andamento e resolva as corridas aguardando início antes de concluir a jornada.',
      );
      return;
    }

    const now = new Date();

    setFinishDateValue(formatDateInput(now));
    setFinishTimeValue(formatTimeInput(now));
    setDraftFinishDateValue(formatDateInput(now));
    setDraftFinishTimeValue(formatTimeInput(now));

    const values: Record<string, string> = {};

    userPlatforms.forEach((item: any) => {
      const platform = item.platform;

      if (!platform) return;

      const earning = earningsForDisplay.find(
        (earning: any) => earning.platform === platform.name,
      );

      values[platform.name] = earning
        ? String(earning.amount).replace('.', ',')
        : '';
    });

    setFinishPlatformValues(values);
    setFinishModalVisible(true);
  }

  function validateFinishDateTime(dateValue: string, timeValue: string) {
    const finishDate = parseDateTimeInput(dateValue, timeValue);

    if (!finishDate) {
      Alert.alert(
        'Horário inválido',
        'Informe uma data e um horário de finalização válidos.',
      );
      return null;
    }

    const startDate = new Date(session.started_at);
    const now = new Date();

    if (finishDate.getTime() < startDate.getTime()) {
      Alert.alert(
        'Horário inválido',
        'O horário de finalização não pode ser antes do horário inicial da jornada.',
      );
      return null;
    }

    if (finishDate.getTime() > now.getTime()) {
      Alert.alert(
        'Horário inválido',
        'O horário de finalização não pode ser depois do horário atual.',
      );
      return null;
    }

    return finishDate;
  }

  function openFinishTimeEditModal() {
    setDraftFinishDateValue(finishDateValue);
    setDraftFinishTimeValue(finishTimeValue);
    setFinishTimeEditModalVisible(true);
  }

  function handleSaveFinishTimeEdit() {
    const finishDate = validateFinishDateTime(
      draftFinishDateValue,
      draftFinishTimeValue,
    );

    if (!finishDate) return;

    setFinishDateValue(formatDateInput(finishDate));
    setFinishTimeValue(formatTimeInput(finishDate));
    setFinishTimeEditModalVisible(false);
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

    closePlatformDrawerAndReturn();
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
    // Mantém o modal de corridas concluídas aberto por trás.
    // Assim, ao fechar ou salvar a edição, o usuário volta direto para a lista.
    setEditingFinishedRide(ride);

    setFinishedRideAmount(
      String(ride.amount).replace('.', ','),
    );

    setEditFinishedRideModalVisible(true);
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

    await syncSessionEarningsDateToSessionStart(session.id);
    await loadSession();
    notifyActiveSessionChanged();
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
            notifyActiveSessionChanged();
          },
        },
      ],
    );
  }

  async function loadSession() {
    await withLoading(async () => {
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
  
    });
  }

  function notifyActiveSessionChanged() {
    DeviceEventEmitter.emit('movenapp:active-session-refresh');
    DeviceEventEmitter.emit('movenapp:dashboard-refresh');
  }

  function getSessionStartEarningDate() {
    if (!session?.started_at) return null;

    const startedAt = new Date(session.started_at);

    if (Number.isNaN(startedAt.getTime())) return null;

    /*
      Regra do app:
      ganhos vinculados a uma jornada pertencem ao dia em que a jornada começou.

      Exemplo:
      início quinta 19:00 e conclusão sexta 01:00
      => os ganhos continuam na quinta.

      Usamos 12:00 do dia inicial para evitar deslocamento de data por fuso horário.
    */
    const earningDate = new Date(startedAt);
    earningDate.setHours(12, 0, 0, 0);

    return earningDate.toISOString();
  }

  async function syncSessionEarningsDateToSessionStart(sessionId?: string | null) {
    try {
      if (!sessionId) return;

      const earningDate = getSessionStartEarningDate();

      if (!earningDate) return;

      const { error } = await supabase
        .from('earnings')
        .update({
          earning_date: earningDate,
        })
        .eq('session_id', sessionId);

      if (error) throw error;
    } catch (error) {
      console.log('Erro ao sincronizar data dos ganhos com o início da jornada:', error);
    }
  }


  async function loadPerformanceTargets() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      setPerformanceTargets(null);
      return;
    }

    const { data, error } = await supabase
      .from('user_performance_targets')
      .select(
        'bad_gain_per_hour, good_gain_per_hour, bad_gain_per_km, good_gain_per_km',
      )
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.log('Erro ao carregar parâmetros de desempenho:', error);
      setPerformanceTargets(null);
      return;
    }

    setPerformanceTargets(data ?? null);
  }

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    const refreshFromExternalAction = async () => {
      await loadSession();
    };

    const activeSessionRefreshSubscription = DeviceEventEmitter.addListener(
      'movenapp:active-session-refresh',
      refreshFromExternalAction,
    );

    const dashboardRefreshSubscription = DeviceEventEmitter.addListener(
      'movenapp:dashboard-refresh',
      refreshFromExternalAction,
    );

    return () => {
      activeSessionRefreshSubscription.remove();
      dashboardRefreshSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!session?.id) return;

    const refreshSessionData = async () => {
      await loadSession();

      DeviceEventEmitter.emit('movenapp:dashboard-refresh');
    };

    const channel = supabase
      .channel(`active-session-page-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `session_id=eq.${session.id}`,
        },
        refreshSessionData,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'earnings',
          filter: `session_id=eq.${session.id}`,
        },
        refreshSessionData,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_sessions',
          filter: `id=eq.${session.id}`,
        },
        refreshSessionData,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

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
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id ?? '');
    }

    loadUser();
  }, []);


  useEffect(() => {
    loadPerformanceTargets();
  }, []);

  const earnings = session?.earnings ?? [];

  const activeRide = rides.find((ride) => ride.status === 'active');

  const waitingRides = rides.filter((ride) => ride.status === 'waiting');

  const finishedRides = rides.filter((ride) => ride.status === 'finished');

  const finishedRideTotalsByPlatform = finishedRides.reduce(
    (acc: Record<string, number>, ride: any) => {
      const platform = ride.platform;

      if (!platform) return acc;

      acc[platform] = (acc[platform] ?? 0) + Number(ride.amount ?? 0);

      return acc;
    },
    {},
  );

  const earningPlatforms = new Set(
    earnings.map((earning: any) => earning.platform),
  );

  const rideOnlyEarnings = Object.entries(finishedRideTotalsByPlatform)
    .filter(([platform]) => !earningPlatforms.has(platform))
    .map(([platform, amount]) => ({
      id: `rides-${platform}`,
      platform,
      amount,
      generated_from_rides: true,
    }));

  const earningsForDisplay = [...earnings, ...rideOnlyEarnings];

  const totalEarnings = earningsForDisplay.reduce(
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

  function scrollRideModalToEnd() {
    setTimeout(() => {
      rideModalScrollRef.current?.scrollToEnd({ animated: true });
    }, Platform.OS === 'ios' ? 260 : 340);
  }

  function scrollStartWaitingRideModalToEnd() {
    setTimeout(() => {
      startWaitingRideScrollRef.current?.scrollToEnd({ animated: true });
    }, Platform.OS === 'ios' ? 260 : 340);
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
      notifyActiveSessionChanged();
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
    notifyActiveSessionChanged();
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
            notifyActiveSessionChanged();
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
    notifyActiveSessionChanged();
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

    await syncSessionEarningsDateToSessionStart(session.id);
    await loadSession();
    notifyActiveSessionChanged();

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

    await syncSessionEarningsDateToSessionStart(session.id);

    setGainModalVisible(false);
    setSelectedPlatform('');
    setGainValue('');
    setEditingEarningId(null);
    setLockedGainPlatform(false);

    await loadSession();
    notifyActiveSessionChanged();

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
          notifyActiveSessionChanged();
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
    notifyActiveSessionChanged();
  }

  async function handleTogglePause() {
    if (activeRide || waitingRides.length > 0) {
      Alert.alert(
        'Corrida pendente',
        'Finalize ou exclua a corrida em andamento e resolva as corridas aguardando início antes de pausar a jornada.',
      );
      return;
    }

    if (session.status === 'paused') {
      await resumeWorkSession(session.id);
    } else {
      await pauseWorkSession(session.id);
    }

    await loadSession();
    notifyActiveSessionChanged();
  }

  function handleDeleteSession() {
    if (activeRide || waitingRides.length > 0) {
      Alert.alert(
        'Corrida pendente',
        'Finalize ou exclua a corrida em andamento e resolva as corridas aguardando início antes de excluir a jornada.',
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
          notifyActiveSessionChanged();
          router.replace('/(private)/(tabs)/dashboard');
        },
      },
    ]);
  }

  async function handleFinishSession() {
    if (activeRide || waitingRides.length > 0) {
      Alert.alert(
        'Corrida pendente',
        'Finalize ou exclua a corrida em andamento e resolva as corridas aguardando início antes de concluir a jornada.',
      );
      return;
    }

    const finishDate = validateFinishDateTime(
      finishDateValue,
      finishTimeValue,
    );

    if (!finishDate) return;

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

    await syncSessionEarningsDateToSessionStart(session.id);

    await finishWorkSession({
      session_id: session.id,
      end_km: parsedKm,
      finished_at: finishDate.toISOString(),
    });

    await syncSessionEarningsDateToSessionStart(session.id);

    notifyActiveSessionChanged();

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


  function getPerformanceMetricColor(params: {
    value: number;
    bad?: number | null;
    good?: number | null;
  }) {
    const value = Number(params.value ?? 0);
    const bad = Number(params.bad ?? 0);
    const good = Number(params.good ?? 0);

    if (value <= 0 || !bad || !good || bad >= good) {
      return '#F5F0E6';
    }

    if (value >= good) {
      return '#22C55E';
    }

    if (value < bad) {
      return '#EF4444';
    }

    return '#FACC15';
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

  useEffect(() => {
    if (!session?.municipality_id) return;

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
          await loadCityChat(cityChatVisible);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.municipality_id, cityChatVisible]);

  useEffect(() => {
    if (session?.municipality_id) {
      loadCityChat(cityChatVisible);
    }
  }, [session?.municipality_id, cityChatVisible]);

  useEffect(() => {
    if (!currentUserId) return;

    loadPrivateChatPreviews();

    const channel = supabase
      .channel(`private-chat-realtime-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'private_chat_messages',
        },
        async () => {
          await loadPrivateChatPreviews();

          if (privateChatVisible && privateChatUser?.id) {
            const response = await getPrivateChatMessages(privateChatUser.id);
            setPrivateMessages(response);
            await markPrivateMessagesAsRead(privateChatUser.id);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, privateChatVisible, privateChatUser?.id]);

  useEffect(() => {
    const userIds = onlineDrivers
      .map((item) => item.user?.id)
      .filter((userId) => userId && userId !== currentUserId);

    loadDriverJourneyProfiles(userIds);
  }, [onlineDrivers, currentUserId]);

  if (!session) return null;

  const activeRidePlatform = activeRide
    ? getPlatformByName(activeRide.platform)
    : null;

  const privateChatAvatarUrl = getUserAvatarUrl(privateChatUser);
  const privateChatDisplayName = getUserDisplayName(privateChatUser);

  async function loadOnlineDrivers(municipalityId: string) {
    const response = await getOnlineDriversByMunicipality(municipalityId);
    setOnlineDrivers(response);
  }

  async function loadDriverJourneyProfiles(userIds: string[]) {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

    if (uniqueUserIds.length === 0) {
      setDriverJourneyProfiles({});
      return;
    }

    const { data, error } = await supabase
      .from('work_sessions')
      .select('user_id, started_at, finished_at, total_paused_seconds')
      .in('user_id', uniqueUserIds)
      .eq('status', 'finished');

    if (error) {
      console.log('Erro ao carregar perfil de jornada dos motoristas:', error);
      return;
    }

    const nextProfiles: Record<string, JourneyProfileType> = {};

    uniqueUserIds.forEach((userId) => {
      const userSessions = (data ?? []).filter(
        (sessionItem: any) => sessionItem.user_id === userId,
      );

      nextProfiles[userId] = getJourneyProfileTypeFromSessions(userSessions);
    });

    setDriverJourneyProfiles(nextProfiles);
  }

  const visibleOnlineDrivers = onlineDrivers.filter(
    (item) => item.user?.id !== currentUserId,
  );


  return (
    <>
      <ScrollView
        style={[
          styles.activeModernContainer,
          session.status === 'paused' && styles.activeModernContainerPaused,
        ]}
        contentContainerStyle={styles.activeModernContent}
        showsVerticalScrollIndicator={false}
      >
        {/*<View style={styles.activeModernHeader}>
          <View style={styles.activeModernHeaderTitleBlock}>
            <Text style={styles.activeModernHeaderEyebrow}>
              {session.status === 'paused' ? 'Turno pausado' : 'Turno em andamento'}
            </Text>
            <Text style={styles.activeModernHeaderTitle}>
              Jornada ativa
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.activeModernHeaderCityButton}
            onPress={() => setMunicipalityModalVisible(true)}
          >
            <Ionicons name="location-outline" size={18} color="#D4A64A" />

            <Text style={styles.activeModernHeaderCityText} numberOfLines={1}>
              {session.municipality
                ? `${session.municipality.name} - ${session.municipality.uf}`
                : 'Definir cidade'}
            </Text>

            <Ionicons name="chevron-down" size={15} color="#9B969B" />
          </TouchableOpacity>
        </View>*/}

        <View
          style={[
            styles.activeModernHeroCard,
            session.status === 'paused' && styles.activeModernHeroCardPaused,
          ]}
        >
          <View style={styles.activeModernHeroTop}>
            <View
              style={[
                styles.activeModernStatusPill,
                session.status === 'paused' && styles.activeModernStatusPillPaused,
              ]}
            >
              <View
                style={[
                  styles.activeModernStatusDot,
                  session.status === 'paused' && styles.activeModernStatusDotPaused,
                ]}
              />
              <Text style={styles.activeModernStatusText}>
                {session.status === 'paused' ? 'PAUSADA' : 'ATIVA'}
              </Text>
            </View>

            <Text style={styles.activeModernStartedText}>
              Início {new Date(session.started_at).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          <View style={styles.activeModernHeroBody}>
            <View style={styles.activeModernTimerColumn}>
              <Text style={styles.activeModernTimerLabel}>Tempo de jornada</Text>
              <Text style={styles.activeModernTimerValue}>
                {formatTimer(elapsedSeconds)}
              </Text>

              <View style={styles.activeModernTimerHintRow}>
                <Ionicons
                  name={session.status === 'paused' ? 'pause-circle-outline' : 'time-outline'}
                  size={20}
                  color={session.status === 'paused' ? '#F59E0B' : '#D4A64A'}
                />
                <Text style={styles.activeModernTimerHintText}>
                  {session.status === 'paused' ? 'Cronômetro pausado' : 'Cronômetro rodando'}
                </Text>
              </View>
            </View>

            <View style={styles.activeModernHeroDivider} />

            {/*<View style={styles.activeModernInfoColumn}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.activeModernInfoRowCidade, session.status === 'paused' && styles.activeModernInfoRowCidadePaused,]}
                onPress={() => setMunicipalityModalVisible(true)}
              >
                <View style={styles.activeModernInfoIcon}>
                  <Ionicons name="location-outline" size={24} color="#D4A64A" />
                </View>
                <View style={{ flex: 1,}}>
                  <Text style={styles.activeModernInfoLabel}>Cidade base</Text>
                  <Text style={styles.activeModernInfoValue} numberOfLines={1}>
                    {session.municipality
                      ? `${session.municipality.name}, ${session.municipality.uf}`
                      : 'Definir cidade'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9B969B" />
              </TouchableOpacity>

              <View style={styles.activeModernInfoRow}>
                <View style={styles.activeModernInfoIcon}>
                  <Ionicons name="car-sport-outline" size={24} color="#9B969B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeModernInfoLabel}>Veículo</Text>
                  <Text style={styles.activeModernInfoValue} numberOfLines={1}>
                    {session.vehicle?.model ?? 'Veículo'}
                  </Text>
                </View>
                {!!session.vehicle?.plate && (
                    <View style={styles.activeModernPlateBadge}>
                      <Text style={styles.activeModernPlateText}>
                        {session.vehicle.plate}
                      </Text>
                    </View>
                )}
              </View>
            </View>*/}
          </View>
        </View>

        <View style={styles.activeModernMetricsGrid}>

          <View style={styles.activeModernMetricCard}>
            <View style={styles.activeModernMetricHeader}>
              <View style={styles.activeModernMetricIconGreen}>
                <Ionicons name="cash-outline" size={24} color="#D4A64A" />
              </View>
              <Text style={styles.activeModernMetricLabel}>Faturamento</Text>
            </View>
            <Text style={styles.activeModernMetricValueGreen}>
              R$ {formatCurrency(totalEarnings)}
            </Text>
          </View>

          <View style={styles.activeModernMetricCard}>
            <View style={styles.activeModernMetricHeader}>
              <View style={styles.activeModernMetricIconOrange}>
                <Ionicons name="speedometer-outline" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.activeModernMetricLabel}>KM rodado</Text>
            </View>
            <Text style={styles.activeModernMetricValueOrange}>
              {Math.max(kmDriven, 0).toLocaleString('pt-BR')} km
            </Text>
          </View>

          <View style={styles.activeModernMetricCard}>
            <View style={styles.activeModernMetricHeader}>
              <View style={styles.activeModernMetricIconBlue}>
                <Ionicons name="analytics-outline" size={24} color="#D4A64A" />
              </View>
              <Text style={styles.activeModernMetricLabel}>Ganho/h</Text>
            </View>
            <Text
              style={[
                styles.activeModernMetricValueBlue,
                {
                  color: getPerformanceMetricColor({
                    value: gainPerHour,
                    bad: performanceTargets?.bad_gain_per_hour,
                    good: performanceTargets?.good_gain_per_hour,
                  }),
                },
              ]}
            >
              R$ {Number(gainPerHour ?? 0).toFixed(2).replace('.', ',')}
            </Text>
          </View>

          <View style={styles.activeModernMetricCard}>
            <View style={styles.activeModernMetricHeader}>
              <View style={styles.activeModernMetricIconPurple}>
                <Ionicons name="navigate-outline" size={24} color="#D4A64A" />
              </View>
              <Text style={styles.activeModernMetricLabel}>Ganho/km</Text>
            </View>
            <Text
              style={[
                styles.activeModernMetricValuePurple,
                {
                  color: getPerformanceMetricColor({
                    value: gainPerKm,
                    bad: performanceTargets?.bad_gain_per_km,
                    good: performanceTargets?.good_gain_per_km,
                  }),
                },
              ]}
            >
              R$ {Number(gainPerKm ?? 0).toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </View>

        <View style={styles.activeModernSectionHeaderRow}>
          <Text style={styles.activeModernSectionTitle}>Ações rápidas</Text>
          <Text style={styles.activeModernSectionSubtitle}>Registre sem perder tempo</Text>
        </View>

        <View style={styles.activeModernQuickGrid}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.activeModernQuickButton, styles.activeModernQuickButtonGain]}
            onPress={openCreateGainModal}
          >
            <View style={styles.activeModernQuickIconGreen}>
              <Ionicons name="add" size={25} color="#080808" />
            </View>
            <Text style={styles.activeModernQuickText}>Novo ganho</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.activeModernQuickButton, styles.activeModernQuickButtonKm]}
            onPress={() => setKmModalVisible(true)}
          >
            <View style={styles.activeModernQuickIconBlue}>
              <Ionicons name="speedometer-outline" size={20} color="#F5F0E6" />
            </View>
            <Text style={styles.activeModernQuickText}>Atualizar KM</Text>
          </TouchableOpacity>

          {/*<TouchableOpacity
            activeOpacity={0.88}
            style={[styles.activeModernQuickButton, styles.activeModernQuickButtonRide]}
            onPress={openCreateRideModal}
          >
            <View style={styles.activeModernQuickIconPurple}>
              <Ionicons name="navigate-outline" size={24} color="#F5F0E6" />
            </View>
            <Text style={styles.activeModernQuickText}>Nova corrida</Text>
          </TouchableOpacity>*/}
        </View>

        {/*{finishedRides.length > 0 && (
          <View style={styles.activeModernFinishedCard}>
            <View style={styles.activeModernSectionHeaderRowCompact}>
              <View>
                <Text style={styles.activeModernSectionTitle}>Corridas concluídas</Text>
                <Text style={styles.activeModernSectionSubtitle}>Resumo das últimas finalizadas</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.activeModernSeeAllButton}
                onPress={() => setFinishedDrawerVisible(true)}
              >
                <Text style={styles.activeModernSeeAllText}>Ver todas</Text>
                <Ionicons name="chevron-forward" size={16} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            {[...finishedRides].slice(-3).reverse().map((ride) => {
              const platformData = getPlatformByName(ride.platform);

              return (
                <View key={ride.id} style={styles.activeModernFinishedItem}>
                  {platformData?.logo_url ? (
                    <Image
                      source={{ uri: platformData.logo_url }}
                      style={styles.activeModernFinishedLogo}
                    />
                  ) : (
                    <View style={styles.activeModernFinishedLogoFallback}>
                      <Text style={styles.activeModernFinishedLogoFallbackText}>
                        {ride.platform?.slice(0, 2) ?? '--'}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={styles.activeModernFinishedTitle}>
                      {formatRideHour(ride.started_at)} - {formatRideHour(ride.finished_at)} · {ride.platform}
                    </Text>
                    <Text style={styles.activeModernFinishedSubtitle}>Concluída</Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.activeModernFinishedMoney}>
                      R$ {formatCurrency(Number(ride.amount))}
                    </Text>
                    <Text style={styles.activeModernFinishedKm}>
                      {getFinishedRideKm(ride).toLocaleString('pt-BR')} km
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}*/}

        <View style={styles.activeModernEarningsCard}>
          <View style={styles.activeModernSectionHeaderRowCompact}>
            <View>
              <Text style={styles.activeModernSectionTitle}>Ganhos da jornada</Text>
              <Text style={styles.activeModernSectionSubtitle}>Plataformas lançadas no turno</Text>
            </View>
            <Text style={styles.activeModernEarningsTotal}>
              R$ {formatCurrency(totalEarnings)}
            </Text>
          </View>

          {earningsForDisplay.length === 0 ? (
            <View style={styles.activeModernEmptyState}>
              <Ionicons name="receipt-outline" size={28} color="#8F8A91" />
              <Text style={styles.activeModernEmptyText}>Nenhum ganho registrado ainda.</Text>
            </View>
          ) : (
            earningsForDisplay.map((earning: any) => {
              const earningPlatformData = getPlatformByName(earning.platform);

              return (
                <View key={earning.id ?? `earning-${earning.platform}`} style={styles.activeModernEarningItem}>
                  <View style={styles.activeModernEarningIcon}>
                    {earningPlatformData?.logo_url ? (
                      <Image
                        source={{ uri: earningPlatformData.logo_url }}
                        style={styles.activeModernEarningLogo}
                      />
                    ) : (
                      <Text style={styles.activeModernEarningLogoFallbackText}>
                        {earning.platform?.slice(0, 2) ?? 'R$'}
                      </Text>
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.activeModernEarningPlatform}>{earning.platform}</Text>
                    <Text style={styles.activeModernEarningAmount}>
                      R$ {formatCurrency(Number(earning.amount))}
                    </Text>
                    {earning.generated_from_rides ? (
                      <Text style={styles.activeModernEarningGeneratedHint}>
                        Gerado pelas corridas concluídas
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.activeModernEarningActions}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.activeModernEarningAction}
                      onPress={() => openEditGainModal(earning)}
                    >
                      <Ionicons name="create-outline" size={18} color="#D4A64A" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.activeModernEarningActionDanger}
                      onPress={() => handleDeleteGain(earning.id)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FF5B5B" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {finishedRides.length > 0 ? (
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.activeModernFinishedRidesSoftButton}
            onPress={() => setFinishedDrawerVisible(true)}
          >
            <View style={styles.activeModernFinishedRidesSoftIcon}>
              <Ionicons name="checkmark-done-outline" size={19} color="#D4A64A" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.activeModernFinishedRidesSoftTitle}>
                Ver corridas concluídas
              </Text>
              <Text style={styles.activeModernFinishedRidesSoftSubtitle}>
                {finishedRides.length} {finishedRides.length === 1 ? 'corrida registrada' : 'corridas registradas'} no turno
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={19} color="#D4A64A" />
          </TouchableOpacity>
        ) : null}

        <View style={styles.activeModernSessionActionsCard}>
          <View style={styles.activeModernSessionActionsHeader}>
            <View style={styles.activeModernSessionActionsIcon}>
              <Ionicons name="settings-outline" size={21} color="#D4A64A" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.activeModernSessionActionsTitle}>
                Controle da jornada
              </Text>
              <Text style={styles.activeModernSessionActionsSubtitle}>
                Pause, conclua ou exclua este turno de trabalho.
              </Text>
            </View>
          </View>

          <View style={styles.activeModernSecondaryActionsRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.activeModernPrimarySessionAction,
                session.status === 'paused' && styles.activeModernPrimarySessionActionResume,
              ]}
              onPress={handleTogglePause}
            >
              <View
                style={[
                  styles.activeModernPrimarySessionIcon,
                  session.status === 'paused' && styles.activeModernPrimarySessionIconResume,
                ]}
              >
                <Ionicons
                  name={
                    session.status === 'paused'
                      ? 'play-circle-outline'
                      : 'pause-circle-outline'
                  }
                  size={20}
                  color={session.status === 'paused' ? '#080808' : '#92400E'}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.activeModernPrimarySessionTitle,
                    session.status === 'paused' &&
                      styles.activeModernPrimarySessionTitleResume,
                  ]}
                >
                  {session.status === 'paused' ? 'Retomar' : 'Pausar'}
                </Text>
                
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color={session.status === 'paused' ? 'rgba(212,166,74,0.28)' : '#F59E0B'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.activeModernDeleteSessionAction}
              onPress={handleDeleteSession}
            >
              <View style={styles.activeModernDeleteSessionIcon}>
                <Ionicons name="trash-outline" size={20} color="#FCA5A5" />
              </View>

              <View>
                <Text style={styles.activeModernDeleteSessionTitle}>
                  Excluir
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
              activeOpacity={0.9}
              style={styles.activeModernFinishSessionAction}
              onPress={openFinishSessionModal}
            >
              <View style={styles.activeModernFinishSessionIcon}>
                <Ionicons name="checkmark-done-outline" size={20} color="#080808" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.activeModernFinishSessionActionTitle}>
                  Concluir jornada
                </Text>
                <Text style={styles.activeModernFinishSessionActionSubtitle}>
                  Encerrar e salvar resultados
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#E8C46D" />
            </TouchableOpacity>
        </View>

      </ScrollView>

      <Modal
        visible={rideModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 14 : 0}
          style={styles.rideModalKeyboardAvoiding}
        >
          <View style={styles.rideModalOverlayModern}>
            <View style={styles.rideModalSheetModern}>
              <View style={styles.rideModalHandle} />

              <View style={styles.rideModalHeaderModern}>
                <View style={styles.rideModalHeaderLeft}>
                  <View
                    style={[
                      styles.rideModalHeaderIcon,
                      editingRide && styles.rideModalHeaderIconBlue,
                      activeRide && !editingRide && styles.rideModalHeaderIconPurple,
                    ]}
                  >
                    <Ionicons
                      name={
                        editingRide
                          ? 'create-outline'
                          : activeRide
                            ? 'albums-outline'
                            : 'navigate-outline'
                      }
                      size={24}
                      color="#F5F0E6"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.rideModalEyebrowModern}>
                      {editingRide
                        ? 'Editar registro'
                        : activeRide
                          ? 'Adicionar à fila'
                          : 'Começar agora'}
                    </Text>

                    <Text style={styles.rideModalTitleModern}>
                      {editingRide
                        ? 'Editar corrida/entrega'
                        : activeRide
                          ? 'Registrar corrida/entrega'
                          : 'Iniciar corrida/entrega'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.rideModalCloseButton}
                  onPress={() => setRideModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#F5F0E6" />
                </TouchableOpacity>
              </View>

              <Text style={styles.rideModalDescription}>
                Escolha a plataforma, informe o valor e acompanhe o desempenho da corrida dentro da jornada.
              </Text>

              <ScrollView
                ref={rideModalScrollRef}
                style={styles.rideModalScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                contentContainerStyle={styles.rideModalScrollContent}
              >
                <View style={styles.rideModalSectionHeader}>
                  <View>
                    <Text style={styles.rideModalSectionTitle}>Plataforma</Text>
                    <Text style={styles.rideModalSectionSubtitle}>
                      Selecione onde a corrida foi chamada
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.rideModalManageButtonTop}
                    onPress={openPlatformDrawerFromRideModal}
                  >
                    <Ionicons name="apps-outline" size={16} color="#F5F0E6" />
                    <Text style={styles.rideModalManageButtonTopText}>Gerenciar</Text>
                  </TouchableOpacity>
                </View>

                {userPlatforms.length === 0 ? (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={styles.rideModalEmptyPlatforms}
                    onPress={openPlatformDrawerFromRideModal}
                  >
                    <View style={styles.rideModalEmptyIcon}>
                      <Ionicons name="apps-outline" size={30} color="#9B969B" />
                    </View>

                    <Text style={styles.rideModalEmptyTitle}>
                      Nenhuma plataforma definida
                    </Text>

                    <Text style={styles.rideModalEmptyText}>
                      Cadastre suas plataformas para lançar corridas mais rápido.
                    </Text>

                    <View style={styles.rideModalEmptyButton}>
                      <Text style={styles.rideModalEmptyButtonText}>
                        Gerenciar plataformas
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.rideModalPlatformsGridModern}>
                    {userPlatforms.map((item) => {
                      const platform = item.platform;
                      if (!platform) return null;

                      const selected = ridePlatform === platform.name;

                      return (
                        <TouchableOpacity
                          key={platform.id}
                          activeOpacity={0.88}
                          style={[
                            styles.rideModalPlatformCardModern,
                            selected && styles.rideModalPlatformCardModernActive,
                          ]}
                          onPress={() => setRidePlatform(platform.name)}
                        >
                          <View style={styles.rideModalPlatformLogoWrap}>
                            {platform.logo_url ? (
                              <Image
                                source={{ uri: platform.logo_url }}
                                style={styles.rideModalPlatformLogoModern}
                              />
                            ) : (
                              <Text style={styles.rideModalPlatformLogoFallbackText}>
                                {platform.name.slice(0, 1)}
                              </Text>
                            )}
                          </View>

                          <Text style={styles.rideModalPlatformNameModern} numberOfLines={1}>
                            {platform.name}
                          </Text>

                          {selected && (
                            <View style={styles.rideModalPlatformCheck}>
                              <Ionicons name="checkmark" size={13} color="#F5F0E6" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <View style={styles.rideModalInputsRow}>
                  <View style={styles.rideModalInputBlock}>
                    <Text style={styles.rideModalInputLabel}>Valor</Text>

                    <View style={styles.rideModalMoneyInputCard}>
                      <View style={styles.rideModalInputIconGreen}>
                        <Text style={styles.rideModalCurrencyText}>R$</Text>
                      </View>

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
                        placeholderTextColor="#4B5563"
                        keyboardType="numeric"
                        onFocus={scrollRideModalToEnd}
                        style={styles.rideModalInputModern}
                      />
                    </View>
                  </View>

                  {(!activeRide || editingRide?.start_km) && (
                    <View style={styles.rideModalInputBlock}>
                      <Text style={styles.rideModalInputLabel}>KM inicial</Text>

                      <View style={styles.rideModalMoneyInputCard}>
                        <View style={styles.rideModalInputIconBlue}>
                          <Ionicons name="speedometer-outline" size={18} color="#D4A64A" />
                        </View>

                        <TextInput
                          value={rideStartKm}
                          onChangeText={(text) => setRideStartKm(formatKm(text))}
                          placeholder="0"
                          placeholderTextColor="#4B5563"
                          keyboardType="numeric"
                          onFocus={scrollRideModalToEnd}
                          style={styles.rideModalInputModern}
                        />
                      </View>
                    </View>
                  )}
                </View>

                {activeRide && !editingRide && (
                  <View style={styles.rideModalInfoCard}>
                    <Ionicons name="information-circle-outline" size={22} color="#D4A64A" />
                    <Text style={styles.rideModalInfoText}>
                      Como já existe uma corrida em andamento, esta nova corrida ficará aguardando início.
                    </Text>
                  </View>
                )}
              </ScrollView>

              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.rideModalPrimaryButton}
                onPress={handleSaveRide}
              >
                <Ionicons
                  name={editingRide ? 'save-outline' : activeRide ? 'add-circle-outline' : 'play-circle-outline'}
                  size={22}
                  color="#F5F0E6"
                />

                <Text style={styles.rideModalPrimaryButtonText}>
                  {editingRide
                    ? 'Salvar alterações'
                    : activeRide
                      ? 'Registrar corrida/entrega'
                      : 'Iniciar corrida/entrega'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={startWaitingRideModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 14 : 0}
          style={styles.modalKeyboardAvoiding}
        >
          <View style={styles.modalOverlay}>
            <ScrollView
              ref={startWaitingRideScrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.startWaitingRideKeyboardContent}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Iniciar corrida</Text>

                  <TouchableOpacity onPress={() => setStartWaitingRideModalVisible(false)}>
                    <Ionicons name="close" size={26} color="#F5F0E6" />
                  </TouchableOpacity>
                </View>

                <TextInput
                  value={rideStartKm}
                  onChangeText={(text) => setRideStartKm(formatKm(text))}
                  placeholder="KM inicial"
                  placeholderTextColor="#8F8A91"
                  keyboardType="numeric"
                  onFocus={scrollStartWaitingRideModalToEnd}
                  style={styles.input}
                />

                <TouchableOpacity style={styles.modalSaveButton} onPress={handleStartWaitingRide}>
                  <Text style={styles.modalSaveButtonText}>Iniciar corrida</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={finishedDrawerVisible} transparent animationType="slide">
        <View style={styles.completedRidesOverlay}>
          <View style={styles.completedRidesSheetFullList}>
            <View style={styles.completedRidesHandle} />

            <View style={styles.completedRidesHeader}>
              <View style={styles.completedRidesHeaderIcon}>
                <Ionicons name="checkmark-done-outline" size={24} color="#D4A64A" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.completedRidesEyebrow}>Lista da jornada</Text>
                <Text style={styles.completedRidesTitle}>Corridas concluídas</Text>
                <Text style={styles.completedRidesSubtitle}>
                  Lista compacta com todos os detalhes da corrida.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.completedRidesCloseButton}
                onPress={() => setFinishedDrawerVisible(false)}
              >
                <Ionicons name="close" size={24} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.completedRidesListOnly}
              contentContainerStyle={styles.completedRidesListOnlyContent}
              showsVerticalScrollIndicator={false}
            >
              {finishedRides.length === 0 ? (
                <View style={styles.completedRidesEmptyBox}>
                  <Ionicons name="car-sport-outline" size={34} color="#8F8A91" />
                  <Text style={styles.completedRidesEmptyTitle}>Nenhuma corrida concluída</Text>
                  <Text style={styles.completedRidesEmptyText}>
                    As corridas finalizadas nesta jornada aparecerão aqui.
                  </Text>
                </View>
              ) : (
                finishedRides.map((ride) => {
                  const platformData = getPlatformByName(ride.platform);
                  const rideAmountValue = Number(ride.amount ?? 0);
                  const rideKm = getFinishedRideKm(ride);
                  const rideDuration = getFinishedRideDuration(ride);
                  const rideGainHour = Number(ride.gain_per_hour ?? 0);
                  const rideGainKm = Number(ride.gain_per_km ?? 0);

                  return (
                    <View key={ride.id} style={styles.completedRideListCard}>
                      <View style={styles.completedRideListTop}>
                        <View style={styles.completedRidePlatformRow}>
                          {platformData?.logo_url ? (
                            <Image
                              source={{ uri: platformData.logo_url }}
                              style={styles.completedRideLogo}
                            />
                          ) : (
                            <View style={styles.completedRideLogoFallback}>
                              <Text style={styles.completedRideLogoFallbackText}>
                                {ride.platform?.slice(0, 2) ?? '--'}
                              </Text>
                            </View>
                          )}

                          <View style={{ flex: 1 }}>
                            <Text style={styles.completedRidePlatform} numberOfLines={1}>
                              {ride.platform ?? 'Plataforma'}
                            </Text>

                            <View style={styles.completedRideStatusRow}>
                              <Ionicons name="checkmark-circle" size={14} color="#D4A64A" />
                              <Text style={styles.completedRideStatusText}>Status: concluída</Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.completedRideValuePill}>
                          <Text style={styles.completedRideValuePillLabel}>Valor ganho</Text>
                          <Text style={styles.completedRideValuePillText}>
                            R$ {formatCurrency(rideAmountValue)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.completedRideCompactDetails}>
                        <View style={styles.completedRideCompactLine}>
                          <Text style={styles.completedRideCompactLabel}>Horário</Text>
                          <Text style={styles.completedRideCompactValue}>
                            {formatRideHour(ride.started_at)} → {formatRideHour(ride.finished_at)}
                          </Text>
                        </View>

                        <View style={styles.completedRideCompactDivider} />

                        <View style={styles.completedRideCompactGrid}>
                          <View style={styles.completedRideCompactItem}>
                            <Text style={styles.completedRideCompactLabel}>Tempo total</Text>
                            <Text style={styles.completedRideCompactValue}>{rideDuration}</Text>
                          </View>

                          <View style={styles.completedRideCompactItem}>
                            <Text style={styles.completedRideCompactLabel}>KM rodados</Text>
                            <Text style={styles.completedRideCompactValue}>
                              {rideKm.toLocaleString('pt-BR')} km
                            </Text>
                          </View>

                          <View style={styles.completedRideCompactItem}>
                            <Text style={styles.completedRideCompactLabel}>Ganho por hora</Text>
                            <Text style={styles.completedRideCompactValueGreen}>
                              R$ {formatCurrency(rideGainHour)}
                            </Text>
                          </View>

                          <View style={styles.completedRideCompactItem}>
                            <Text style={styles.completedRideCompactLabel}>Ganho por km</Text>
                            <Text style={styles.completedRideCompactValuePurple}>
                              R$ {formatCurrency(rideGainKm)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.completedRideFooterActions}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          style={styles.completedRideEditButton}
                          onPress={() => openEditFinishedRideModal(ride)}
                        >
                          <Ionicons name="create-outline" size={18} color="#F5F0E6" />
                          <Text style={styles.completedRideEditText}>Editar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.85}
                          style={styles.completedRideDeleteButton}
                          onPress={() => handleDeleteFinishedRide(ride)}
                        >
                          <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
                          <Text style={styles.completedRideDeleteText}>Excluir</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={gainModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.gainModernOverlay}>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.gainModernBackdropTouch}
              onPress={() => setGainModalVisible(false)}
            />

            <View style={styles.gainModernSheet}>
              <View style={styles.gainModernHandle} />

              <View style={styles.gainModernHeader}>
                <View style={styles.gainModernHeaderLeft}>
                  <View style={styles.gainModernHeaderIcon}>
                    <Ionicons
                      name={editingEarningId ? 'create-outline' : 'cash-outline'}
                      size={24}
                      color="#D4A64A"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.gainModernEyebrow}>
                      {editingEarningId ? 'Editar lançamento' : 'Novo lançamento'}
                    </Text>

                    <Text style={styles.gainModernTitle}>
                      {editingEarningId ? 'Editar ganho' : 'Adicionar ganho'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.gainModernCloseButton}
                  onPress={() => setGainModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#F5F0E6" />
                </TouchableOpacity>
              </View>

              <Text style={styles.gainModernSubtitle}>
                {editingEarningId
                  ? 'Altere o valor recebido nesta plataforma.'
                  : 'Selecione a plataforma e informe o valor recebido nesta jornada.'}
              </Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.gainModernScrollContent}
              >
                {editingEarningId ? (
                  <View style={styles.gainModernLockedPlatformCard}>
                    {(() => {
                      const platformItem = userPlatforms.find(
                        (item) => item.platform?.name === selectedPlatform,
                      );

                      const platform = platformItem?.platform;

                      if (!platform) {
                        return (
                          <>
                            <View style={styles.gainModernLockedLogoFallback}>
                              <Ionicons name="apps-outline" size={22} color="#D4A64A" />
                            </View>

                            <View style={{ flex: 1 }}>
                              <Text style={styles.gainModernLockedLabel}>
                                Plataforma
                              </Text>
                              <Text style={styles.gainModernLockedName}>
                                {selectedPlatform || 'Plataforma selecionada'}
                              </Text>
                            </View>
                          </>
                        );
                      }

                      return (
                        <>
                          {platform.logo_url ? (
                            <Image
                              source={{ uri: platform.logo_url }}
                              style={styles.gainModernLockedLogo}
                            />
                          ) : (
                            <View style={styles.gainModernLockedLogoFallback}>
                              <Text style={styles.gainModernLockedLogoText}>
                                {platform.name.slice(0, 1)}
                              </Text>
                            </View>
                          )}

                          <View style={{ flex: 1 }}>
                            <Text style={styles.gainModernLockedLabel}>
                              Plataforma selecionada
                            </Text>

                            <Text style={styles.gainModernLockedName} numberOfLines={1}>
                              {platform.name}
                            </Text>
                          </View>

                          <View style={styles.gainModernLockedBadge}>
                            <Text style={styles.gainModernLockedBadgeText}>Fixado</Text>
                          </View>
                        </>
                      );
                    })()}
                  </View>
                ) : (
                  <View style={styles.gainModernSection}>
                    <View style={styles.gainModernSectionHeader}>
                      <View>
                        <Text style={styles.gainModernSectionTitle}>Plataforma</Text>
                        <Text style={styles.gainModernSectionHint}>
                          Escolha onde esse ganho entrou
                        </Text>
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.gainModernManageButton}
                        onPress={openPlatformDrawerFromGainModal}
                      >
                        <Ionicons name="options-outline" size={17} color="#F5F0E6" />
                        <Text style={styles.gainModernManageButtonText}>Gerenciar</Text>
                      </TouchableOpacity>
                    </View>

                    {userPlatforms.length === 0 ? (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        style={styles.gainModernEmptyPlatformsBox}
                        onPress={openPlatformDrawerFromGainModal}
                      >
                        <View style={styles.gainModernEmptyIconBox}>
                          <Ionicons name="apps-outline" size={30} color="#9B969B" />
                        </View>

                        <Text style={styles.gainModernEmptyTitle}>
                          Nenhuma plataforma definida
                        </Text>

                        <Text style={styles.gainModernEmptyText}>
                          Defina suas plataformas para conseguir lançar ganhos mais rápido.
                        </Text>

                        <View style={styles.gainModernEmptyButton}>
                          <Ionicons name="add" size={18} color="#F5F0E6" />
                          <Text style={styles.gainModernEmptyButtonText}>
                            Gerenciar plataformas
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.gainModernPlatformsGrid}>
                        {userPlatforms.map((item) => {
                          const platform = item.platform;

                          if (!platform) return null;

                          const selected = selectedPlatform === platform.name;

                          const alreadyHasGain = earnings.some(
                            (earning: any) => earning.platform === platform.name,
                          );

                          return (
                            <TouchableOpacity
                              key={platform.id}
                              activeOpacity={alreadyHasGain ? 1 : 0.88}
                              disabled={alreadyHasGain}
                              style={[
                                styles.gainModernPlatformCard,
                                selected && styles.gainModernPlatformCardActive,
                                alreadyHasGain && styles.gainModernPlatformCardDisabled,
                              ]}
                              onPress={() => {
                                if (alreadyHasGain) return;

                                setSelectedPlatform(platform.name);
                              }}
                            >
                              {platform.logo_url ? (
                                <Image
                                  source={{ uri: platform.logo_url }}
                                  style={styles.gainModernPlatformLogo}
                                />
                              ) : (
                                <View style={styles.gainModernPlatformLogoFallback}>
                                  <Text style={styles.gainModernPlatformLogoText}>
                                    {platform.name.slice(0, 1)}
                                  </Text>
                                </View>
                              )}

                              <View style={styles.gainModernPlatformInfo}>
                                <Text style={styles.gainModernPlatformName} numberOfLines={1}>
                                  {platform.name}
                                </Text>

                                {alreadyHasGain ? (
                                  <Text style={styles.gainModernPlatformHint} numberOfLines={1}>
                                    Já lançado
                                  </Text>
                                ) : selected ? (
                                  <Text style={styles.gainModernPlatformHintActive} numberOfLines={1}>
                                    Selecionada
                                  </Text>
                                ) : (
                                  <Text style={styles.gainModernPlatformHint} numberOfLines={1}>
                                    Tocar para usar
                                  </Text>
                                )}
                              </View>

                              {selected && !alreadyHasGain && (
                                <View style={styles.gainModernPlatformCheck}>
                                  <Ionicons name="checkmark" size={14} color="#211D16" />
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.gainModernAmountSection}>
                  <View style={styles.gainModernAmountHeader}>
                    <Text style={styles.gainModernSectionTitle}>Valor do ganho</Text>
                    <Text style={styles.gainModernSectionHint}>Use vírgula para centavos</Text>
                  </View>

                  <View style={styles.gainModernAmountInputCard}>
                    <View style={styles.gainModernCurrencyBox}>
                      <Text style={styles.gainModernCurrencyText}>R$</Text>
                    </View>

                    <TextInput
                      value={gainValue}
                      onChangeText={(text) => {
                        let sanitized = text.replace(/[^0-9,]/g, '');

                        const parts = sanitized.split(',');

                        if (parts.length > 2) {
                          sanitized = `${parts[0]},${parts[1]}`;
                        }

                        if (parts[1]?.length > 2) {
                          sanitized = `${parts[0]},${parts[1].slice(0, 2)}`;
                        }

                        setGainValue(sanitized);
                      }}
                      placeholder="0,00"
                      placeholderTextColor="#4B5563"
                      keyboardType="numeric"
                      style={styles.gainModernAmountInput}
                    />
                  </View>
                </View>
              </ScrollView>

              <View style={styles.gainModernFooter}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[
                    styles.gainModernSaveButton,
                    (!selectedPlatform || !gainValue) && styles.gainModernSaveButtonDisabled,
                  ]}
                  onPress={handleSaveGain}
                >
                  <Ionicons
                    name={editingEarningId ? 'checkmark-circle-outline' : 'add-circle-outline'}
                    size={22}
                    color="#F5F0E6"
                  />

                  <Text style={styles.gainModernSaveButtonText}>
                    {editingEarningId ? 'Salvar alteração' : 'Salvar ganho'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={kmModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.kmModernOverlay}>
            <View style={styles.kmModernSheet}>
              <View style={styles.kmModernHandle} />

              <View style={styles.kmModernHeader}>
                <View style={styles.kmModernHeaderLeft}>
                  <View style={styles.kmModernIconBox}>
                    <Ionicons name="speedometer-outline" size={24} color="#F59E0B" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.kmModernEyebrow}>Quilometragem da jornada</Text>
                    <Text style={styles.kmModernTitle}>Atualizar KM</Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.kmModernCloseButton}
                  onPress={() => setKmModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#F5F0E6" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.kmModernScrollContent}
              >
                <View style={styles.kmModernSummaryCard}>
                  <View style={styles.kmModernSummaryTop}>
                    <View>
                      <Text style={styles.kmModernSummaryLabel}>KM inicial</Text>
                      <Text style={styles.kmModernSummaryValue}>
                        {Number(session.start_km ?? 0).toLocaleString('pt-BR')} km
                      </Text>
                    </View>

                    <View style={styles.kmModernSummaryArrow}>
                      <Ionicons name="arrow-forward" size={18} color="#9B969B" />
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.kmModernSummaryLabel}>KM informado</Text>
                      <Text style={styles.kmModernSummaryValueHighlight}>
                        {onlyNumbers(kmValue).toLocaleString('pt-BR')} km
                      </Text>
                    </View>
                  </View>

                  <View style={styles.kmModernDrivenBox}>
                    <View style={styles.kmModernDrivenIcon}>
                      <Ionicons name="navigate-outline" size={19} color="#D4A64A" />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.kmModernDrivenLabel}>KM rodados nesta jornada</Text>
                      <Text style={styles.kmModernDrivenValue}>
                        {Math.max(onlyNumbers(kmValue) - Number(session.start_km ?? 0), 0).toLocaleString('pt-BR')} km
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.kmModernInputSection}>
                  <View style={styles.kmModernInputLabelRow}>
                    <Ionicons name="car-sport-outline" size={18} color="#F59E0B" />
                    <Text style={styles.kmModernInputLabel}>KM atual do veículo</Text>
                  </View>

                  <View style={styles.kmModernInputCard}>
                    <TextInput
                      value={kmValue}
                      onChangeText={(text) => setKmValue(formatKm(text))}
                      placeholder="0"
                      placeholderTextColor="#4B5563"
                      keyboardType="numeric"
                      style={styles.kmModernInput}
                    />

                    <View style={styles.kmModernUnitPill}>
                      <Text style={styles.kmModernUnitText}>km</Text>
                    </View>
                  </View>

                  <View style={styles.kmModernHintBox}>
                    <Ionicons name="information-circle-outline" size={19} color="#9B969B" />
                    <Text style={styles.kmModernHintText}>
                      O KM atual não pode ser menor que o KM inicial da jornada.
                    </Text>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.kmModernFooter}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.kmModernCancelButton}
                  onPress={() => setKmModalVisible(false)}
                >
                  <Text style={styles.kmModernCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.kmModernSaveButton}
                  onPress={handleUpdateKm}
                >
                  <Ionicons name="checkmark-circle-outline" size={22} color="#F5F0E6" />
                  <Text style={styles.kmModernSaveText}>Salvar KM</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={finishModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.finishModalContentFull}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Finalizar jornada</Text>

                <TouchableOpacity onPress={() => setFinishModalVisible(false)}>
                  <Ionicons name="close" size={26} color="#F5F0E6" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Confira o KM final, o horário de finalização e informe os ganhos das plataformas.
              </Text>

              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.finishTimePreviewCard}
                onPress={openFinishTimeEditModal}
              >
                <View style={styles.finishTimePreviewLeft}>
                  <View style={styles.finishTimePreviewDot} />

                  <Text style={styles.finishTimePreviewText}>
                    Jornada finalizará às {finishTimeValue || '--:--'}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.finishTimePreviewButton}
                  onPress={openFinishTimeEditModal}
                >
                  <Text style={styles.finishTimePreviewButtonText}>
                    Alterar
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>

              <ScrollView>

                <View style={styles.finishKmBlock}>
                  <Text style={styles.finishKmLabel}>KM final</Text>

                  <View style={styles.finishKmInputCard}>
                    <TextInput
                      value={kmValue}
                      onChangeText={(text) => setKmValue(formatKm(text))}
                      placeholder="0"
                      placeholderTextColor="#374151"
                      keyboardType="numeric"
                      style={styles.finishKmInput}
                    />

                    <Text style={styles.finishKmUnit}>km</Text>
                  </View>
                </View>

                {userPlatforms.length === 0 ? (
                  <TouchableOpacity
                    style={styles.emptyPlatformsBox}
                    onPress={openPlatformDrawerFromFinishModal}
                  >
                    <Ionicons name="apps-outline" size={34} color="#9B969B" />

                    <Text style={styles.emptyPlatformsTitle}>
                      Nenhuma plataforma definida
                    </Text>

                    <Text style={styles.emptyPlatformsText}>
                      Clique em gerenciar plataformas e defina ao menos uma plataforma para continuar.
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.finishPlatformsSection}>
                    <View style={styles.finishPlatformsHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.finishPlatformsTitle}>
                          Ganhos por plataforma
                        </Text>

                        <Text style={styles.finishPlatformsSubtitle}>
                          Informe o total recebido em cada app.
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.managePlatformsCompactButton}
                        onPress={openPlatformDrawerFromFinishModal}
                      >
                        <Ionicons name="apps-outline" size={17} color="#F5F0E6" />

                        <Text style={styles.managePlatformsCompactText}>
                          Gerenciar
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {userPlatforms.map((item: any) => {
                      const platform = item.platform;

                      if (!platform) return null;

                      return (
                        <View key={platform.id} style={styles.finishPlatformModernCard}>
                          <View style={styles.finishPlatformModernHeader}>
                            <View style={styles.finishPlatformLogoBox}>
                              {platform.logo_url ? (
                                <Image
                                  source={{ uri: platform.logo_url }}
                                  style={styles.finishPlatformModernLogo}
                                />
                              ) : (
                                <Text style={styles.finishPlatformModernLogoText}>
                                  {platform.name.slice(0, 1)}
                                </Text>
                              )}
                            </View>

                            <View style={{ flex: 1 }}>
                              <Text style={styles.finishPlatformModernName}>
                                {platform.name}
                              </Text>

                              <Text style={styles.finishPlatformModernHint}>
                                Valor recebido na jornada
                              </Text>
                            </View>
                          </View>

                          <View style={styles.finishPlatformAmountBox}>
                            <Text style={styles.finishPlatformCurrency}>R$</Text>

                            <TextInput
                              value={finishPlatformValues[platform.name] ?? ''}
                              onChangeText={(text) =>
                                setFinishPlatformValues((prev) => ({
                                  ...prev,
                                  [platform.name]: text,
                                }))
                              }
                              placeholder="0,00"
                              placeholderTextColor="#4B5563"
                              keyboardType="numeric"
                              style={styles.finishPlatformModernInput}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

              </ScrollView>

              <TouchableOpacity
                style={styles.modalFinishButton}
                onPress={handleFinishSession}
              >
                <Ionicons name="stop-circle-outline" size={22} color="#F5F0E6" />

                <Text style={styles.modalFinishButtonText}>Concluir jornada</Text>
              </TouchableOpacity>
              
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={finishTimeEditModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Alterar horário</Text>

                <TouchableOpacity onPress={() => setFinishTimeEditModalVisible(false)}>
                  <Ionicons name="close" size={26} color="#F5F0E6" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Escolha um horário entre o início da jornada e o horário atual.
              </Text>

              <View style={styles.finishTimeEditCard}>
                <View style={styles.finishTimeEditIconBox}>
                  <Ionicons name="time-outline" size={24} color="#D4A64A" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.finishTimeEditTitle}>
                    Jornada finalizará às {draftFinishTimeValue || '--:--'}
                  </Text>

                  <Text style={styles.finishTimeEditSubtitle}>
                    Iniciada às{' '}
                    {new Date(session.started_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>

              <Text style={styles.finishInputLabel}>Data de finalização</Text>

              <TextInput
                value={draftFinishDateValue}
                onChangeText={(text) => setDraftFinishDateValue(maskDateInput(text))}
                placeholder="dd/mm/aaaa"
                placeholderTextColor="#8F8A91"
                keyboardType="numeric"
                maxLength={10}
                style={styles.input}
              />

              <Text style={styles.finishInputLabel}>Hora de finalização</Text>

              <TextInput
                value={draftFinishTimeValue}
                onChangeText={(text) => setDraftFinishTimeValue(maskTimeInput(text))}
                placeholder="00:00"
                placeholderTextColor="#8F8A91"
                keyboardType="numeric"
                maxLength={5}
                style={styles.input}
              />

              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveFinishTimeEdit}
              >
                <Text style={styles.modalSaveButtonText}>Salvar horário</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={finishRideModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.finishRideModernOverlay}>
            <View style={styles.finishRideModernSheet}>
              <View style={styles.finishRideModernHandle} />

              <View style={styles.finishRideModernHeader}>
                <View style={styles.finishRideModernHeaderLeft}>
                  <View style={styles.finishRideModernHeaderIcon}>
                    <Ionicons name="flag-outline" size={24} color="#D4A64A" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.finishRideModernEyebrow}>
                      Corrida em andamento
                    </Text>
                    <Text style={styles.finishRideModernTitle}>
                      Finalizar corrida
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.finishRideModernCloseButton}
                  onPress={() => setFinishRideModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#F5F0E6" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.finishRideModernScroll}
                contentContainerStyle={styles.finishRideModernScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.finishRideModernSubtitle}>
                  Confira o valor recebido e informe o KM final para calcular o desempenho da corrida.
                </Text>

              {finishingRide && (
                <View style={styles.finishRideModernSummaryCard}>
                  <View style={styles.finishRideModernSummaryTop}>
                    <View style={styles.finishRideModernPlatformBox}>
                      {(() => {
                        const platformData = finishingRide?.platform
                          ? getPlatformByName(finishingRide.platform)
                          : null;

                        if (platformData?.logo_url) {
                          return (
                            <Image
                              source={{ uri: platformData.logo_url }}
                              style={styles.finishRideModernPlatformLogo}
                            />
                          );
                        }

                        return (
                          <Text style={styles.finishRideModernPlatformInitial}>
                            {finishingRide?.platform?.slice(0, 1) ?? '?'}
                          </Text>
                        );
                      })()}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.finishRideModernPlatformName} numberOfLines={1}>
                        {finishingRide.platform ?? 'Plataforma'}
                      </Text>
                      <Text style={styles.finishRideModernPlatformHint}>
                        Iniciada às {formatRideHour(finishingRide.started_at)}
                      </Text>
                    </View>

                    <View style={styles.finishRideModernLiveBadge}>
                      <View style={styles.finishRideModernLiveDot} />
                      <Text style={styles.finishRideModernLiveText}>AO VIVO</Text>
                    </View>
                  </View>

                  <View style={styles.finishRideModernStatsGrid}>
                    <View style={styles.finishRideModernStatBox}>
                      <Text style={styles.finishRideModernStatLabel}>Tempo</Text>
                      <Text style={styles.finishRideModernStatValue}>
                        {formatTimer(getRideElapsedSeconds(finishingRide))}
                      </Text>
                    </View>

                    <View style={styles.finishRideModernStatBox}>
                      <Text style={styles.finishRideModernStatLabel}>KM inicial</Text>
                      <Text style={styles.finishRideModernStatValue}>
                        {Number(finishingRide.start_km ?? 0).toLocaleString('pt-BR')} km
                      </Text>
                    </View>

                    <View style={styles.finishRideModernStatBoxWide}>
                      <Text style={styles.finishRideModernStatLabel}>Ganho/hora atual</Text>
                      <Text style={styles.finishRideModernStatValueGreen}>
                        R$ {Number(getRideGainPerHour(finishingRide) ?? 0).toFixed(2).replace('.', ',')}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.finishRideModernFieldsCard}>
                <Text style={styles.finishRideModernInputLabel}>Valor recebido</Text>

                <View style={styles.finishRideModernInputBox}>
                  <View style={styles.finishRideModernInputIcon}>
                    <Text style={styles.finishRideModernCurrencyText}>R$</Text>
                  </View>

                  <TextInput
                    value={rideAmount}
                    onChangeText={(text) => {
                      let sanitized = text.replace(/[^0-9,]/g, '');

                      const parts = sanitized.split(',');
                      if (parts.length > 2) {
                        sanitized = parts[0] + ',' + parts[1];
                      }
                      if (parts[1]?.length > 2) {
                        sanitized = parts[0] + ',' + parts[1].slice(0, 2);
                      }

                      setRideAmount(sanitized);
                    }}
                    placeholder="0,00"
                    placeholderTextColor="#4B5563"
                    keyboardType="numeric"
                    style={styles.finishRideModernMoneyInput}
                  />
                </View>

                <Text style={styles.finishRideModernInputLabel}>KM final</Text>

                <View style={styles.finishRideModernInputBox}>
                  <View style={styles.finishRideModernInputIconBlue}>
                    <Ionicons name="speedometer-outline" size={21} color="#D4A64A" />
                  </View>

                  <TextInput
                    value={rideEndKm}
                    onChangeText={(text) => setRideEndKm(formatKm(text))}
                    placeholder="KM final"
                    placeholderTextColor="#4B5563"
                    keyboardType="numeric"
                    style={styles.finishRideModernKmInput}
                  />

                  <Text style={styles.finishRideModernKmUnit}>km</Text>
                </View>

                {finishingRide && (
                  <View style={styles.finishRideModernHintCard}>
                    <Ionicons name="information-circle-outline" size={20} color="#9B969B" />
                    <Text style={styles.finishRideModernHintText}>
                      O KM final precisa ser maior ou igual ao KM inicial da corrida.
                    </Text>
                  </View>
                )}
              </View>
              </ScrollView>

              <View style={styles.finishRideModernFooter}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.finishRideModernButton}
                  onPress={handleFinishRide}
                >
                  <Ionicons name="checkmark-circle-outline" size={23} color="#F5F0E6" />
                  <Text style={styles.finishRideModernButtonText}>Concluir corrida</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={rideResultModalVisible} transparent animationType="fade">
        <View style={styles.rideResultModernOverlay}>
          <View style={styles.rideResultModernSheet}>
            <View style={styles.rideResultModernHandle} />

            <View style={styles.rideResultModernHeader}>
              <View style={styles.rideResultModernHeaderLeft}>
                <View style={styles.rideResultModernIconBox}>
                  <Ionicons name="checkmark-circle" size={30} color="#D4A64A" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.rideResultModernEyebrow}>Corrida/entrega concluída</Text>
                  <Text style={styles.rideResultModernTitle}>Resultado da corrida</Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.rideResultModernCloseButton}
                onPress={() => setRideResultModalVisible(false)}
              >
                <Ionicons name="close" size={25} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.rideResultModernScroll}
              contentContainerStyle={styles.rideResultModernScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.rideResultModernHeroCard}>
                <View style={styles.rideResultModernHeroTop}>
                  <View>
                    <Text style={styles.rideResultModernHeroLabel}>Valor recebido</Text>
                    <Text style={styles.rideResultModernHeroValue}>
                      R$ {formatCurrency(Number(rideResult?.amount ?? 0))}
                    </Text>
                  </View>

                  <View style={styles.rideResultModernSuccessBadge}>
                    <Ionicons name="sparkles-outline" size={16} color="#D4A64A" />
                    <Text style={styles.rideResultModernSuccessText}>Salva</Text>
                  </View>
                </View>

                <View style={styles.rideResultModernDivider} />

                <View style={styles.rideResultModernHeroHintRow}>
                  <Ionicons name="information-circle-outline" size={18} color="#9B969B" />
                  <Text style={styles.rideResultModernHeroHintText}>
                    Este valor foi somado aos ganhos da jornada e usado no cálculo do desempenho.
                  </Text>
                </View>
              </View>

              <View style={styles.rideResultModernStatsGrid}>
                <View style={styles.rideResultModernStatCard}>
                  <View style={styles.rideResultModernStatIconGreen}>
                    <Ionicons name="time-outline" size={21} color="#D4A64A" />
                  </View>

                  <Text style={styles.rideResultModernStatLabel}>Ganho por hora</Text>
                  <Text style={styles.rideResultModernStatValueGreen}>
                    R$ {formatCurrency(Number(rideResult?.gain_per_hour ?? 0))}
                  </Text>
                </View>

                <View style={styles.rideResultModernStatCard}>
                  <View style={styles.rideResultModernStatIconBlue}>
                    <Ionicons name="navigate-outline" size={21} color="#D4A64A" />
                  </View>

                  <Text style={styles.rideResultModernStatLabel}>Ganho por km</Text>
                  <Text style={styles.rideResultModernStatValueBlue}>
                    R$ {formatCurrency(Number(rideResult?.gain_per_km ?? 0))}
                  </Text>
                </View>

                <View style={styles.rideResultModernStatCardWide}>
                  <View style={styles.rideResultModernStatIconPurple}>
                    <Ionicons name="speedometer-outline" size={21} color="#D4A64A" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.rideResultModernStatLabel}>KM rodados</Text>
                    <Text style={styles.rideResultModernStatValue}>
                      {Number(rideResult?.km_driven ?? 0).toLocaleString('pt-BR')} km
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.rideResultModernFooter}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.rideResultModernSecondaryButton}
                onPress={() => {
                  setRideResultModalVisible(false);
                  setTimeout(() => {
                    setFinishedDrawerVisible(true);
                  }, 250);
                }}
              >
                <Ionicons name="list-outline" size={20} color="#F5F0E6" />
                <Text style={styles.rideResultModernSecondaryButtonText}>Ver concluídas</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.rideResultModernPrimaryButton}
                onPress={() => setRideResultModalVisible(false)}
              >
                <Ionicons name="checkmark-circle-outline" size={21} color="#F5F0E6" />
                <Text style={styles.rideResultModernPrimaryButtonText}>Entendi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editFinishedRideModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.editFinishedRideModernOverlay}>
            <View style={styles.editFinishedRideModernSheet}>
              <View style={styles.editFinishedRideModernHandle} />

              <View style={styles.editFinishedRideModernHeader}>
                <View style={styles.editFinishedRideModernHeaderLeft}>
                  <View style={styles.editFinishedRideModernHeaderIcon}>
                    <Ionicons name="create-outline" size={24} color="#D4A64A" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.editFinishedRideModernEyebrow}>
                      Corrida concluída
                    </Text>
                    <Text style={styles.editFinishedRideModernTitle}>
                      Editar valor
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.editFinishedRideModernCloseButton}
                  onPress={() => setEditFinishedRideModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#F5F0E6" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.editFinishedRideModernScrollContent}
              >
                <Text style={styles.editFinishedRideModernSubtitle}>
                  Altere apenas o valor recebido. O desempenho será recalculado na jornada.
                </Text>

                {editingFinishedRide && (
                  <View style={styles.editFinishedRideModernSummaryCard}>
                    <View style={styles.editFinishedRideModernPlatformRow}>
                      <View style={styles.editFinishedRideModernPlatformLogoBox}>
                        {(() => {
                          const platformData = editingFinishedRide?.platform
                            ? getPlatformByName(editingFinishedRide.platform)
                            : null;

                          if (platformData?.logo_url) {
                            return (
                              <Image
                                source={{ uri: platformData.logo_url }}
                                style={styles.editFinishedRideModernPlatformLogo}
                              />
                            );
                          }

                          return (
                            <Text style={styles.editFinishedRideModernPlatformInitial}>
                              {editingFinishedRide?.platform?.slice(0, 1) ?? '?'}
                            </Text>
                          );
                        })()}
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.editFinishedRideModernPlatformName}>
                          {editingFinishedRide.platform}
                        </Text>
                        <View style={styles.editFinishedRideModernStatusRow}>
                          <View style={styles.editFinishedRideModernStatusDot} />
                          <Text style={styles.editFinishedRideModernStatusText}>
                            Concluída
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.editFinishedRideModernInfoGrid}>
                      <View style={styles.editFinishedRideModernInfoCard}>
                        <View style={styles.editFinishedRideModernInfoTitleRow}>
                          <Ionicons name="time-outline" size={16} color="#9B969B" />
                          <Text style={styles.editFinishedRideModernInfoLabel}>Início</Text>
                        </View>
                        <Text style={styles.editFinishedRideModernInfoValue}>
                          {formatRideHour(editingFinishedRide.started_at)}
                        </Text>
                      </View>

                      <View style={styles.editFinishedRideModernInfoCard}>
                        <View style={styles.editFinishedRideModernInfoTitleRow}>
                          <Ionicons name="flag-outline" size={16} color="#9B969B" />
                          <Text style={styles.editFinishedRideModernInfoLabel}>Final</Text>
                        </View>
                        <Text style={styles.editFinishedRideModernInfoValue}>
                          {formatRideHour(editingFinishedRide.finished_at)}
                        </Text>
                      </View>

                      <View style={styles.editFinishedRideModernInfoCard}>
                        <View style={styles.editFinishedRideModernInfoTitleRow}>
                          <Ionicons name="stopwatch-outline" size={16} color="#9B969B" />
                          <Text style={styles.editFinishedRideModernInfoLabel}>Tempo</Text>
                        </View>
                        <Text style={styles.editFinishedRideModernInfoValue}>
                          {getFinishedRideDuration(editingFinishedRide)}
                        </Text>
                      </View>

                      <View style={styles.editFinishedRideModernInfoCard}>
                        <View style={styles.editFinishedRideModernInfoTitleRow}>
                          <Ionicons name="navigate-outline" size={16} color="#9B969B" />
                          <Text style={styles.editFinishedRideModernInfoLabel}>KM</Text>
                        </View>
                        <Text style={styles.editFinishedRideModernInfoValue}>
                          {getFinishedRideKm(editingFinishedRide).toLocaleString('pt-BR')} km
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.editFinishedRideModernAmountCard}>
                  <Text style={styles.editFinishedRideModernInputLabel}>
                    Valor recebido
                  </Text>

                  <View style={styles.editFinishedRideModernAmountInputBox}>
                    <View style={styles.editFinishedRideModernCurrencyBox}>
                      <Text style={styles.editFinishedRideModernCurrencyText}>R$</Text>
                    </View>

                    <TextInput
                      value={finishedRideAmount}
                      onChangeText={(text) => {
                        let sanitized = text.replace(/[^0-9,]/g, '');

                        const parts = sanitized.split(',');

                        if (parts.length > 2) {
                          sanitized = `${parts[0]},${parts[1]}`;
                        }

                        if (parts[1]?.length > 2) {
                          sanitized = `${parts[0]},${parts[1].slice(0, 2)}`;
                        }

                        setFinishedRideAmount(sanitized);
                      }}
                      placeholder="0,00"
                      placeholderTextColor="#4B5563"
                      keyboardType="numeric"
                      style={styles.editFinishedRideModernAmountInput}
                    />
                  </View>

                  <Text style={styles.editFinishedRideModernInputHint}>
                    Esse valor será atualizado nos ganhos da plataforma e no total da jornada.
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.editFinishedRideModernFooter}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.editFinishedRideModernCancelButton}
                  onPress={() => setEditFinishedRideModalVisible(false)}
                >
                  <Text style={styles.editFinishedRideModernCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.editFinishedRideModernSaveButton}
                  onPress={handleUpdateFinishedRide}
                >
                  <Ionicons name="checkmark-circle-outline" size={21} color="#F5F0E6" />
                  <Text style={styles.editFinishedRideModernSaveText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={platformDrawerVisible} transparent animationType="slide">
        <View style={styles.drawerOverlay}>
          <View style={styles.drawer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Minhas plataformas</Text>

              <TouchableOpacity onPress={closePlatformDrawerAndReturn}>
                <Ionicons name="close" size={26} color="#F5F0E6" />
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
                        <Ionicons name="close" size={18} color="#F5F0E6" />
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
        <View style={styles.driversNowOverlay}>
          <View style={styles.driversNowSheet}>
            <View style={styles.driversNowHandle} />

            <View style={styles.driversNowHeader}>
              <View style={styles.driversNowHeaderIcon}>
                <Ionicons name="radio-outline" size={24} color="#D4A64A" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.driversNowEyebrow}>Comunidade local</Text>

                <Text style={styles.driversNowTitle}>Rodando agora</Text>

                <Text style={styles.driversNowSubtitle} numberOfLines={1}>
                  {session?.municipality
                    ? `${session.municipality.name} - ${session.municipality.uf}`
                    : 'Motoristas próximos ao seu turno'}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.driversNowCloseButton}
                onPress={() => setDriversModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <View style={styles.driversNowHeroCard}>
              <View style={styles.driversNowHeroGlow} />

              <View style={styles.driversNowHeroLeft}>
                <View style={styles.driversNowHeroIcon}>
                  <Ionicons name="radio-outline" size={26} color="#D4A64A" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.driversNowHeroLabel}>Online agora</Text>
                  <Text style={styles.driversNowHeroText}>
                    Motoristas e entregadores em jornada nesta cidade
                  </Text>
                </View>
              </View>

              <View style={styles.driversNowHeroCountBox}>
                <Text style={styles.driversNowHeroCount}>
                  {visibleOnlineDrivers.length}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.driversNowPublicChatButton}
              onPress={() => {
                setDriversModalVisible(false);

                setTimeout(() => {
                  openCityChat();
                }, 250);
              }}
            >
              <View style={styles.driversNowPublicChatIcon}>
                <Ionicons name="chatbubbles-outline" size={22} color="#F5F0E6" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.driversNowPublicChatTitle}>Chat público da cidade</Text>
                <Text style={styles.driversNowPublicChatText}>
                  Converse com quem está rodando agora na mesma região.
                </Text>
              </View>

              {unreadChatCount > 0 ? (
                <View style={styles.driversNowPublicChatBadge}>
                  <Text style={styles.driversNowPublicChatBadgeText}>
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={20} color="#9B969B" />
              )}
            </TouchableOpacity>

            <ScrollView
              style={styles.driversNowList}
              contentContainerStyle={styles.driversNowListContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {visibleOnlineDrivers.length === 0 ? (
                <View style={styles.driversNowEmptyBox}>
                  <View style={styles.driversNowEmptyIcon}>
                    <Ionicons name="car-sport-outline" size={34} color="#8F8A91" />
                  </View>

                  <Text style={styles.driversNowEmptyTitle}>
                    Ninguém rodando agora
                  </Text>

                  <Text style={styles.driversNowEmptyText}>
                    Quando outros motoristas iniciarem uma jornada nesta cidade, eles aparecerão aqui.
                  </Text>
                </View>
              ) : (
                visibleOnlineDrivers.map((item) => {
                  const avatarUrl = getUserAvatarUrl(item.user);
                  const displayName = getUserDisplayName(item.user);
                  const journeyProfile = getJourneyProfileInfo(
                    driverJourneyProfiles[item.user?.id ?? ''] ?? 'empty',
                  );

                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.86}
                      style={styles.driversNowItem}
                      onPress={() => openDriverActions(item.user)}
                    >
                      <View style={styles.driversNowAvatarWrap}>
                        {avatarUrl ? (
                          <Image
                            source={{ uri: avatarUrl }}
                            style={styles.driversNowAvatar}
                          />
                        ) : (
                          <View style={styles.driversNowAvatarFallback}>
                            <Ionicons name="person" size={23} color="#F5F0E6" />
                          </View>
                        )}

                        <View style={styles.driversNowAvatarStatusOnline} />
                      </View>

                      <View style={styles.driversNowInfoCentered}>
                        <Text style={styles.driversNowNameCentered} numberOfLines={1}>
                          {displayName}
                        </Text>

                        <Text
                          style={[
                            styles.driversNowJourneyLabel,
                            { color: journeyProfile.color },
                          ]}
                          numberOfLines={1}
                        >
                          Jornada {journeyProfile.label.toLowerCase()}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.driversNowJourneyIconBox,
                          {
                            backgroundColor: journeyProfile.backgroundColor,
                            borderColor: journeyProfile.borderColor,
                          },
                        ]}
                      >
                        <Ionicons
                          name={journeyProfile.icon}
                          size={21}
                          color={journeyProfile.color}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>

          {driverActionModalVisible && selectedOnlineDriver ? (
            <View style={styles.driverActionsOverlay} pointerEvents="box-none">
              <TouchableOpacity
                activeOpacity={1}
                style={styles.driverActionsBackdrop}
                onPress={closeDriverActions}
              />

              <View style={styles.driverActionsCard}>
                <View style={styles.driverActionsHandle} />

                <View style={styles.driverActionsHeader}>
                  <View style={styles.driverActionsAvatarWrap}>
                    {getUserAvatarUrl(selectedOnlineDriver) ? (
                      <Image
                        source={{ uri: getUserAvatarUrl(selectedOnlineDriver) }}
                        style={styles.driverActionsAvatar}
                      />
                    ) : (
                      <View style={styles.driverActionsAvatarFallback}>
                        <Ionicons name="person" size={26} color="#F5F0E6" />
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverActionsEyebrow}>Escolha uma ação</Text>
                    <Text style={styles.driverActionsTitle} numberOfLines={1}>
                      {getUserDisplayName(selectedOnlineDriver)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.driverActionsCloseButton}
                    onPress={closeDriverActions}
                  >
                    <Ionicons name="close" size={22} color="#F5F0E6" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.driverActionsOption}
                  onPress={handleViewSelectedDriverProfile}
                >
                  <View style={styles.driverActionsOptionIconGreen}>
                    <Ionicons name="person-circle-outline" size={24} color="#D4A64A" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverActionsOptionTitle}>Ver perfil</Text>
                    <Text style={styles.driverActionsOptionText}>
                      Abrir o perfil público deste motorista.
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={20} color="#8F8A91" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.driverActionsOption}
                  onPress={handleMessageSelectedDriver}
                >
                  <View style={styles.driverActionsOptionIconBlue}>
                    <Ionicons name="chatbubble-ellipses-outline" size={23} color="#D4A64A" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverActionsOptionTitle}>Enviar mensagem</Text>
                    <Text style={styles.driverActionsOptionText}>
                      Abrir a conversa privada com esta pessoa.
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={20} color="#8F8A91" />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
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
                <Ionicons name="close" size={26} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={municipalitySearch}
              onChangeText={handleSearchMunicipalities}
              placeholder="Buscar cidade"
              placeholderTextColor="#8F8A91"
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
                      color="#D4A64A"
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

      <Modal
        visible={cityChatVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCityChatVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
          style={{ flex: 1 }}
        >
          <View style={styles.cityChatModernOverlay}>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.cityChatModernBackdrop}
              onPress={() => setCityChatVisible(false)}
            />

            <View style={styles.cityChatModernSheet}>
              <View style={styles.cityChatModernHandle} />

              <View style={styles.cityChatModernHeader}>
                <View style={styles.cityChatModernHeaderLeft}>
                  <View style={styles.cityChatModernHeaderIcon}>
                    <Ionicons name="chatbubbles-outline" size={24} color="#D4A64A" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.cityChatModernTitleRow}>
                      <Text style={styles.cityChatModernEyebrow}>Comunidade local</Text>

                      <View style={styles.cityChatModernBadge}>
                        <Ionicons name="people-outline" size={13} color="#D4A64A" />
                        <Text style={styles.cityChatModernBadgeText}>Cidade</Text>
                      </View>
                    </View>

                    <Text style={styles.cityChatModernTitle}>Chat da cidade</Text>

                    <Text style={styles.cityChatModernSubtitle} numberOfLines={1}>
                      {session?.municipality
                        ? `${session.municipality.name} - ${session.municipality.uf}`
                        : 'Motoristas próximos'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.cityChatModernCloseButton}
                  onPress={() => setCityChatVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#F5F0E6" />
                </TouchableOpacity>
              </View>

              <View style={styles.cityChatModernInfoCard}>
                <Ionicons name="radio-outline" size={19} color="#D4A64A" />
                <Text style={styles.cityChatModernInfoText}>
                  Mensagens em tempo real. Ao abrir este chat, as mensagens da cidade são marcadas como lidas.
                </Text>
              </View>

              <ScrollView
                style={styles.cityChatModernMessagesList}
                contentContainerStyle={styles.cityChatModernMessagesContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {chatMessages.length === 0 ? (
                  <View style={styles.cityChatModernEmptyBox}>
                    <View style={styles.cityChatModernEmptyIcon}>
                      <Ionicons name="chatbubble-ellipses-outline" size={32} color="#8F8A91" />
                    </View>

                    <Text style={styles.cityChatModernEmptyTitle}>
                      Nenhuma mensagem ainda
                    </Text>

                    <Text style={styles.cityChatModernEmptyText}>
                      Envie a primeira mensagem para os motoristas da sua cidade.
                    </Text>
                  </View>
                ) : (
                  chatMessages.map((item) => {
                    const isMe = item.user_id === currentUserId;
                    const avatarUrl = getUserAvatarUrl(item.user);
                    const displayName = getUserDisplayName(item.user);

                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.cityChatModernMessageRow,
                          isMe && styles.cityChatModernMessageRowMe,
                        ]}
                      >
                        {!isMe && (
                          avatarUrl ? (
                            <Image
                              source={{ uri: avatarUrl }}
                              style={styles.cityChatModernAvatar}
                            />
                          ) : (
                            <View style={styles.cityChatModernAvatarFallback}>
                              <Text style={styles.cityChatModernAvatarFallbackText}>
                                {displayName.slice(0, 1).toUpperCase()}
                              </Text>
                            </View>
                          )
                        )}

                        <TouchableOpacity
                          activeOpacity={0.88}
                          onPress={() => {
                            Alert.alert(
                              'Mensagem',
                              undefined,
                              [
                                {
                                  text: 'Responder',
                                  onPress: () => setReplyingCityMessage(item),
                                },

                                ...(item.user?.id !== currentUserId
                                  ? [
                                      {
                                        text: 'Enviar mensagem no privado',
                                        onPress: () => openPrivateChat(item.user),
                                      },
                                    ]
                                  : []),

                                {
                                  text: 'Cancelar',
                                  style: 'cancel',
                                },
                              ],
                            );
                          }}
                          style={[
                            styles.cityChatModernBubble,
                            isMe
                              ? styles.cityChatModernBubbleMe
                              : styles.cityChatModernBubbleOther,
                          ]}
                        >
                          {!isMe && (
                            <Text style={styles.cityChatModernUserName} numberOfLines={1}>
                              {displayName}
                            </Text>
                          )}

                          {item.repliedMessage && (
                            <View
                              style={[
                                styles.cityChatModernReplyPreview,
                                isMe && styles.cityChatModernReplyPreviewMe,
                              ]}
                            >
                              <Text
                                style={styles.cityChatModernReplyPreviewText}
                                numberOfLines={1}
                              >
                                {item.repliedMessage.message}
                              </Text>
                            </View>
                          )}

                          <Text
                            style={[
                              styles.cityChatModernMessageText,
                              isMe && styles.cityChatModernMessageTextMe,
                            ]}
                          >
                            {item.message}
                          </Text>

                          <View style={styles.cityChatModernHourRow}>
                            <Text
                              style={[
                                styles.cityChatModernHourText,
                                isMe && styles.cityChatModernHourTextMe,
                              ]}
                            >
                              {new Date(item.created_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>

                            {isMe && (
                              <Ionicons name="checkmark-done" size={14} color="#F5F0E6" />
                            )}
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {replyingCityMessage && (
                <View style={styles.cityChatModernReplyingBox}>
                  <View style={styles.cityChatModernReplyingIcon}>
                    <Ionicons name="return-up-forward-outline" size={18} color="#D4A64A" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.cityChatModernReplyingLabel}>Respondendo</Text>
                    <Text style={styles.cityChatModernReplyingText} numberOfLines={1}>
                      {replyingCityMessage.message}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setReplyingCityMessage(null)}
                  >
                    <Ionicons name="close" size={22} color="#F5F0E6" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.cityChatModernInputBar}>
                <View style={styles.cityChatModernInputWrapper}>
                  <Ionicons name="chatbubble-outline" size={19} color="#8F8A91" />

                  <TextInput
                    value={chatMessage}
                    onChangeText={setChatMessage}
                    placeholder="Mensagem para a cidade..."
                    placeholderTextColor="#8F8A91"
                    style={styles.cityChatModernInput}
                    multiline
                  />
                </View>

                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={!chatMessage.trim()}
                  style={[
                    styles.cityChatModernSendButton,
                    !chatMessage.trim() && styles.cityChatModernSendButtonDisabled,
                  ]}
                  onPress={handleSendCityMessage}
                >
                  <Ionicons name="send" size={20} color="#F5F0E6" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={privateChatVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPrivateChatVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
          style={{ flex: 1 }}
        >
          <View style={styles.privateChatOverlayModern}>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.privateChatBackdropModern}
              onPress={() => setPrivateChatVisible(false)}
            />

            <View style={styles.privateChatSheetModern}>
              <View style={styles.privateChatHandleModern} />

              <View style={styles.privateChatHeaderModern}>
                <View style={styles.privateChatHeaderLeftModern}>
                  {privateChatAvatarUrl ? (
                    <Image
                      source={{ uri: privateChatAvatarUrl }}
                      style={styles.privateChatHeaderAvatarModern}
                    />
                  ) : (
                    <View style={styles.privateChatHeaderAvatarFallbackModern}>
                      <Ionicons name="person" size={22} color="#F5F0E6" />
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <View style={styles.privateChatTitleRowModern}>
                      <Text style={styles.privateChatTitleModern} numberOfLines={1}>
                        {privateChatDisplayName}
                      </Text>

                      <View style={styles.privateChatPrivateBadgeModern}>
                        <Ionicons name="lock-closed" size={11} color="#D4A64A" />
                        <Text style={styles.privateChatPrivateBadgeTextModern}>
                          Privado
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.privateChatSubtitleModern} numberOfLines={1}>
                      {privateChatPreviews[privateChatUser?.id ?? '']?.lastMessage || 'Converse diretamente com este motorista'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.privateChatCloseButtonModern}
                  onPress={() => setPrivateChatVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#F5F0E6" />
                </TouchableOpacity>
              </View>

              <View style={styles.privateChatNoticeModern}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#D4A64A" />
                <Text style={styles.privateChatNoticeTextModern}>
                  Mensagens privadas aparecem somente para vocês dois.
                </Text>
              </View>

              <ScrollView
                style={styles.privateChatMessagesScrollModern}
                contentContainerStyle={styles.privateChatMessagesContentModern}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {privateMessages.length === 0 ? (
                  <View style={styles.privateChatEmptyBoxModern}>
                    <View style={styles.privateChatEmptyIconModern}>
                      <Ionicons name="chatbubble-outline" size={30} color="#8F8A91" />
                    </View>

                    <Text style={styles.privateChatEmptyTitleModern}>
                      Nenhuma mensagem ainda
                    </Text>

                    <Text style={styles.privateChatEmptyTextModern}>
                      Envie a primeira mensagem para iniciar a conversa.
                    </Text>
                  </View>
                ) : (
                  privateMessages.map((item) => {
                    const isMe = item.sender_id === currentUserId;
                    const messageTime = new Date(item.created_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.privateChatMessageRowModern,
                          isMe
                            ? styles.privateChatMessageRowMineModern
                            : styles.privateChatMessageRowOtherModern,
                        ]}
                      >
                        {!isMe && (
                          privateChatAvatarUrl ? (
                            <Image
                              source={{ uri: privateChatAvatarUrl }}
                              style={styles.privateChatMessageAvatarModern}
                            />
                          ) : (
                            <View style={styles.privateChatMessageAvatarFallbackModern}>
                              <Ionicons name="person" size={17} color="#F5F0E6" />
                            </View>
                          )
                        )}

                        <TouchableOpacity
                          activeOpacity={0.88}
                          onLongPress={() => {
                            Alert.alert(
                              'Mensagem',
                              'O que deseja fazer?',
                              [
                                {
                                  text: 'Responder',
                                  onPress: () => setReplyingPrivateMessage(item),
                                },
                                {
                                  text: 'Cancelar',
                                  style: 'cancel',
                                },
                              ],
                            );
                          }}
                          style={[
                            styles.privateChatBubbleModern,
                            isMe
                              ? styles.privateChatBubbleMineModern
                              : styles.privateChatBubbleOtherModern,
                          ]}
                        >
                          {!isMe && (
                            <Text style={styles.privateChatSenderNameModern} numberOfLines={1}>
                              {privateChatDisplayName}
                            </Text>
                          )}

                          {item.repliedMessage && (
                            <View
                              style={[
                                styles.privateChatReplyPreviewModern,
                                isMe && styles.privateChatReplyPreviewMineModern,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.privateChatReplyPreviewLabelModern,
                                  isMe && styles.privateChatReplyPreviewLabelMineModern,
                                ]}
                              >
                                Respondendo
                              </Text>

                              <Text
                                style={[
                                  styles.privateChatReplyPreviewTextModern,
                                  isMe && styles.privateChatReplyPreviewTextMineModern,
                                ]}
                                numberOfLines={1}
                              >
                                {item.repliedMessage.message}
                              </Text>
                            </View>
                          )}

                          <Text
                            style={[
                              styles.privateChatMessageTextModern,
                              isMe && styles.privateChatMessageTextMineModern,
                            ]}
                          >
                            {item.message}
                          </Text>

                          <View style={styles.privateChatBubbleFooterModern}>
                            <Text
                              style={[
                                styles.privateChatHourModern,
                                isMe && styles.privateChatHourMineModern,
                              ]}
                            >
                              {messageTime}
                            </Text>

                            {isMe && (
                              <Ionicons name="checkmark-done" size={15} color="rgba(212,166,74,0.28)" />
                            )}
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {replyingPrivateMessage && (
                <View style={styles.privateChatReplyingBoxModern}>
                  <View style={styles.privateChatReplyingIconModern}>
                    <Ionicons name="return-up-forward-outline" size={18} color="#D4A64A" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.privateChatReplyingLabelModern}>
                      Respondendo mensagem
                    </Text>

                    <Text style={styles.privateChatReplyingTextModern} numberOfLines={1}>
                      {replyingPrivateMessage.message}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.privateChatReplyingCloseModern}
                    onPress={() => setReplyingPrivateMessage(null)}
                  >
                    <Ionicons name="close" size={20} color="#F5F0E6" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.privateChatInputBarModern}>
                <TextInput
                  value={privateMessageText}
                  onChangeText={setPrivateMessageText}
                  placeholder="Digite uma mensagem..."
                  placeholderTextColor="#8F8A91"
                  multiline
                  style={styles.privateChatInputModern}
                />

                <TouchableOpacity
                  activeOpacity={0.88}
                  style={[
                    styles.privateChatSendButtonModern,
                    !privateMessageText.trim() && styles.privateChatSendButtonDisabledModern,
                  ]}
                  onPress={handleSendPrivateMessage}
                >
                  <Ionicons name="send" size={20} color="#F5F0E6" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </>
  );
}


const styles = StyleSheet.create({
  activeModernMetricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 38,
  },

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
    backgroundColor: '#D4A64A',
    marginRight: 5
  },

  statusTitle: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '600',
  },

  startedText: {
    color: '#9B969B',
    fontSize: 13,
    marginTop: 3,
    marginLeft: 20
  },

  timer: {
    color: '#F5F0E6',
    fontSize: 65,
    fontWeight: '600',
    marginTop: 28,
  },

  timerLabel: {
    color: '#9B969B',
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
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '600',
  },

  metricValue: {
    color: '#F5F0E6',
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
    color: '#F5F0E6',
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
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },

  emptyText: {
    color: '#8F8A91',
    fontWeight: '700',
  },

  earningItem: {
    backgroundColor: '#101014',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  earningPlatform: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  earningAmount: {
    color: '#D4A64A',
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
    backgroundColor: '#2A2830',
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
    color: '#F5F0E6',
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
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  rideInfo: {
    color: '#9B969B',
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
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
  },

  modalKeyboardAvoiding: {
    flex: 1,
  },

  startWaitingRideKeyboardContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: Platform.OS === 'ios' ? 24 : 40,
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
    maxHeight: '90%',
  },
  modalContentLarge: {
    backgroundColor: '#101014',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    borderTopColor: 'rgba(212,166,74,0.34)',
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
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
  modalSubtitle: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },

  platformChip: {
    height: 42,
    borderRadius: 999,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 16,
  },

  platformChipActive: {
    backgroundColor: '#D4A64A',
    borderColor: '#D4A64A',
  },

  platformChipText: {
    color: '#F5F0E6',
    fontWeight: '800',
  },
  input: {
    height: 55,
    borderRadius: 12,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    color: '#F5F0E6',
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 13,
  },
  modalSaveButton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modalSaveButtonText: {
    color: '#080808',
    fontSize: 15,
    fontWeight: '900',
  },


  gainModernOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },

  gainModernBackdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },

  gainModernSheet: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: '#050505',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -12 },
    elevation: 16,
  },

  gainModernHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3A3430',
    alignSelf: 'center',
    marginBottom: 18,
  },

  gainModernHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },

  gainModernHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  gainModernHeaderIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#211D16',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  gainModernEyebrow: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  gainModernTitle: {
    color: '#F5F0E6',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },

  gainModernCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  gainModernSubtitle: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 12,
    marginBottom: 16,
  },

  gainModernScrollContent: {
    paddingBottom: 18,
  },

  gainModernSection: {
    marginBottom: 18,
  },

  gainModernSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },

  gainModernSectionTitle: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  gainModernSectionHint: {
    color: '#8F8A91',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  gainModernManageButton: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },

  gainModernManageButtonText: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
  },

  gainModernPlatformsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  gainModernPlatformCard: {
    width: '48.4%',
    minHeight: 66,
    borderRadius: 13,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    position: 'relative',
  },

  gainModernPlatformCardActive: {
    backgroundColor: '#211D16',
    borderColor: '#D4A64A',
  },

  gainModernPlatformCardDisabled: {
    opacity: 0.38,
  },

  gainModernPlatformLogo: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#F5F0E6',
  },

  gainModernPlatformLogoFallback: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  gainModernPlatformLogoText: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
  },

  gainModernPlatformInfo: {
    flex: 1,
    minWidth: 0,
  },

  gainModernPlatformName: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
  },

  gainModernPlatformHint: {
    color: '#8F8A91',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },

  gainModernPlatformHintActive: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 3,
  },

  gainModernPlatformCheck: {
    position: 'absolute',
    right: -5,
    top: -5,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#D4A64A',
    borderWidth: 3,
    borderColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },

  gainModernLockedPlatformCard: {
    minHeight: 82,
    borderRadius: 14,
    backgroundColor: '#211D16',
    borderWidth: 1,
    borderColor: '#D4A64A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 18,
  },

  gainModernLockedLogo: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#F5F0E6',
  },

  gainModernLockedLogoFallback: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: 'rgba(212,166,74,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  gainModernLockedLogoText: {
    color: '#F5F0E6',
    fontSize: 20,
    fontWeight: '900',
  },

  gainModernLockedLabel: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
  },

  gainModernLockedName: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },

  gainModernLockedBadge: {
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  gainModernLockedBadgeText: {
    color: '#E8C46D',
    fontSize: 11,
    fontWeight: '900',
  },

  gainModernEmptyPlatformsBox: {
    borderRadius: 14,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 20,
    alignItems: 'center',
  },

  gainModernEmptyIconBox: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  gainModernEmptyTitle: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 12,
    textAlign: 'center',
  },

  gainModernEmptyText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },

  gainModernEmptyButton: {
    height: 44,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 16,
    marginTop: 16,
  },

  gainModernEmptyButtonText: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
  },

  gainModernAmountSection: {
    marginTop: 2,
  },

  gainModernAmountHeader: {
    marginBottom: 10,
  },

  gainModernAmountInputCard: {
    height: 64,
    borderRadius: 14,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  gainModernCurrencyBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#211D16',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  gainModernCurrencyText: {
    color: '#D4A64A',
    fontSize: 15,
    fontWeight: '900',
  },

  gainModernAmountInput: {
    flex: 1,
    height: '100%',
    color: '#F5F0E6',
    fontSize: 28,
    fontWeight: '900',
    padding: 0,
  },

  gainModernFooter: {
    borderTopWidth: 1,
    borderTopColor: '#18171D',
    paddingTop: 12,
  },

  gainModernSaveButton: {
    height: 58,
    borderRadius: 13,
    backgroundColor: '#D4A64A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: '#D4A64A',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  gainModernSaveButtonDisabled: {
    opacity: 0.55,
  },

  gainModernSaveButtonText: {
    color: '#F5F0E6',
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
    color: '#F5F0E6',
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
    flexDirection: 'row',
    gap: 10,
  },

  modalFinishButtonText: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.84)',
    justifyContent: 'flex-end',
  },
  drawer: {
    backgroundColor: '#101014',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    borderTopColor: 'rgba(212,166,74,0.34)',
    maxHeight: '86%',
  },

  finishedRideItem: {
    backgroundColor: '#18171D',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  resultCard: {
    backgroundColor: '#18171D',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2830',
    },

    resultLabel: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
    },

    resultValue: {
    color: '#D4A64A',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 6,
    },

    lockedPlatformBox: {
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },

  lockedPlatformLabel: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
  },

  lockedPlatformValue: {
    color: '#F5F0E6',
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
    backgroundColor: '#101014',
    borderRadius: 13,
    paddingHorizontal: 28,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: '#2A2830',
  },

  loadingText: {
    color: '#F5F0E6',
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
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 10,
  },

  platformListItemSelected: {
    borderColor: '#D4A64A',
    backgroundColor: '#211D16',
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
    backgroundColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  platformLogoFallbackText: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
  },

  platformListName: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  platformListDescription: {
    color: '#9B969B',
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
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformsContainer: {
    marginBottom: 14,
  },

  platformSelectCard: {
    minHeight: 70,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 10,
  },

  platformSelectCardActive: {
    backgroundColor: '#211D16',
    borderColor: '#D4A64A',
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
    backgroundColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  platformSelectLogoFallbackText: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
  },

  platformSelectName: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  platformSelectType: {
    color: '#9B969B',
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
    color: '#F5F0E6',
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
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    padding: 10,
  },

  platformGridCardActive: {
    backgroundColor: '#211D16',
    borderColor: '#D4A64A',
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
    backgroundColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  platformGridLogoFallbackText: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
  },

  platformGridName: {
    color: '#F5F0E6',
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
    color: '#F5F0E6',
    fontSize: 14,
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyPlatformsBox: {
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginBottom:50,
  },

  emptyPlatformsTitle: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 14,
  },

  emptyPlatformsText: {
    color: '#9B969B',
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
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
  },
  platformLockedCard: {
    minHeight: 74,
    borderRadius: 16,
    backgroundColor: '#211D16',
    borderWidth: 1,
    borderColor: '#D4A64A',
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
    backgroundColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  platformLockedLogoFallbackText: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
  },

  platformLockedName: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  platformLockedDescription: {
    color: '#9B969B',
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
    backgroundColor: '#18171D',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2830',
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
    backgroundColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  finishPlatformLogoFallbackText: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
  },

  finishPlatformName: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  finishPlatformInput: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    color: '#F5F0E6',
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
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },
  rideCardActive: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    backgroundColor: '#18171D',
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
    backgroundColor: '#18171D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  rideLogoFallbackText: {
    color: '#F5F0E6',
    fontSize: 24,
    fontWeight: '900',
  },

  ridePlatform: {
    color: '#F5F0E6',
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
    borderRadius: 13,
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
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },

  rideStatValue: {
    color: '#F5F0E6',
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
    backgroundColor: '#D4A64A',
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
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },
  rideWaitingItem: {
    borderRadius: 16,
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
    color: '#D4A64A',
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
    color: '#F5F0E6',
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
    color: '#D4A64A',
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
    backgroundColor: '#101014',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2830',
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
    color: '#F5F0E6',
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
    color: '#E8C46D',
    fontSize: 12,
    fontWeight: '900',
  },

  finishedDivider: {
    height: 1,
    backgroundColor: '#2A2830',
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
    backgroundColor: '#2A2830',
    gap: 5,
    marginHorizontal: 10
  },

  finishedStatText: {
    color: '#D9D3C7',
    fontSize: 15,
    fontWeight: '400',
  },

  finishedStatText1: {
    color: '#D9D3C7',
    fontSize: 12,
    fontWeight: '400',
  },

  finishedStatText2: {
    color: '#D9D3C7',
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
    backgroundColor: '#2A2830',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  finishedEditText: {
    color: '#F5F0E6',
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
    left: 0,
    right: 0,
    bottom: -5,
    minHeight: 62,
    backgroundColor: '#101014',
    borderTopWidth: 1,
    borderTopColor: '#2A2830',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 999,
    elevation: 999,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  cityBottomTitle: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
  },

  cityBottomSubtitle: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  cityChangeButton: {
    height: 42,
    borderRadius: 14,
    backgroundColor: '#D4A64A',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  cityChangeText: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
  },

  cityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },

  cityModalContent: {
    height: '90%',
    backgroundColor: '#050505',
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
    color: '#F5F0E6',
    fontSize: 22,
    fontWeight: '900',
  },

  driverOnlineItem: {
    minHeight: 68,
    borderRadius: 13,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
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
    backgroundColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  driverName: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  driverStatus: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  driverStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },

  driverLastMessage: {
    color: '#8F8A91',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  driverLastMessageUnread: {
    color: '#F5F0E6',
    fontWeight: '900',
  },

  privateChatUnreadBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#050505',
  },

  privateChatUnreadBadgeText: {
    color: '#F5F0E6',
    fontSize: 10,
    fontWeight: '900',
  },
  driversNowOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'flex-end',
  },

  driversNowSheet: {
    height: '90%',
    backgroundColor: '#050505',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 26 : 18,
    borderWidth: 1,
    borderColor: '#2A2830',
  },

  driversNowHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3A3430',
    alignSelf: 'center',
    marginBottom: 16,
  },

  driversNowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },

  driversNowHeaderIcon: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: '#211D16',
    borderWidth: 1,
    borderColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
  },

  driversNowEyebrow: {
    color: '#D4A64A',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  driversNowTitle: {
    color: '#F5F0E6',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 2,
  },

  driversNowSubtitle: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  driversNowCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  driversNowSummaryCard: {
    minHeight: 86,
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  driversNowSummaryItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  driversNowSummaryIconGreen: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: 'rgba(212,166,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },

  driversNowSummaryIconBlue: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: 'rgba(212,166,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },

  driversNowSummaryIconOrange: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },

  driversNowSummaryValue: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
  },

  driversNowSummaryLabel: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },

  driversNowSummaryDivider: {
    width: 1,
    height: 44,
    backgroundColor: '#2A2830',
  },

  driversNowHeroCard: {
    minHeight: 106,
    borderRadius: 16,
    backgroundColor: '#211D16',
    borderWidth: 1,
    borderColor: '#166534',
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    overflow: 'hidden',
  },

  driversNowHeroGlow: {
    position: 'absolute',
    right: -32,
    top: -34,
    width: 112,
    height: 112,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.18)',
  },

  driversNowHeroLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  driversNowHeroIcon: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: 'rgba(34,197,94,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(134,239,172,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  driversNowHeroLabel: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
  },

  driversNowHeroText: {
    color: '#E8C46D',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    lineHeight: 17,
  },

  driversNowHeroCountBox: {
    minWidth: 66,
    height: 66,
    borderRadius: 23,
    backgroundColor: 'rgba(9,9,11,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  driversNowHeroCount: {
    color: '#F5F0E6',
    fontSize: 31,
    fontWeight: '900',
  },

  driversNowPublicChatButton: {
    minHeight: 78,
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 13,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  driversNowPublicChatIcon: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  driversNowPublicChatTitle: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  driversNowPublicChatText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    lineHeight: 16,
  },

  driversNowPublicChatBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },

  driversNowPublicChatBadgeText: {
    color: '#F5F0E6',
    fontSize: 11,
    fontWeight: '900',
  },

  driversNowList: {
    flex: 1,
  },

  driversNowListContent: {
    paddingBottom: 20,
  },

  driversNowItem: {
    minHeight: 86,
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  driversNowAvatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 999,
    position: 'relative',
  },

  driversNowAvatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#2A2830',
  },

  driversNowAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: '#2A2830',
    borderWidth: 1,
    borderColor: '#3A3430',
    alignItems: 'center',
    justifyContent: 'center',
  },

  driversNowAvatarStatus: {
    position: 'absolute',
    right: -1,
    bottom: 1,
    width: 15,
    height: 15,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#101014',
  },

  driversNowAvatarStatusActive: {
    backgroundColor: '#D4A64A',
  },

  driversNowAvatarStatusPaused: {
    backgroundColor: '#F59E0B',
  },

  driversNowInfo: {
    flex: 1,
  },

  driversNowInfoCentered: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  driversNowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },

  driversNowName: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  driversNowNameCentered: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'left',
    maxWidth: '100%',
  },

  driversNowJourneyLabel: {
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'left',
    marginTop: 5,
  },

  driversNowStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },

  driversNowStatusPillActive: {
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderColor: 'rgba(34,197,94,0.32)',
  },

  driversNowStatusPillPaused: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.32)',
  },

  driversNowStatusText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  driversNowStatusTextActive: {
    color: '#D4A64A',
  },

  driversNowStatusTextPaused: {
    color: '#FCD34D',
  },

  driversNowLastMessage: {
    color: '#8F8A91',
    fontSize: 12,
    fontWeight: '700',
  },

  driversNowLastMessageUnread: {
    color: '#F5F0E6',
    fontWeight: '900',
  },

  driversNowChatButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  driversNowChatButtonUnread: {
    backgroundColor: '#D4A64A',
  },

  driversNowUnreadBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },

  driversNowUnreadText: {
    color: '#F5F0E6',
    fontSize: 10,
    fontWeight: '900',
  },

  driversNowEmptyBox: {
    minHeight: 230,
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },

  driversNowEmptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  driversNowEmptyTitle: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },

  driversNowEmptyText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },

  driversNowSummarySingleCard: {
    minHeight: 82,
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  driversNowSummarySingleLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  driversNowSummaryIconGreenLarge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  driversNowSummaryHint: {
    color: '#8F8A91',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
    lineHeight: 15,
  },

  driversNowSummaryValueLarge: {
    color: '#F5F0E6',
    fontSize: 30,
    fontWeight: '900',
  },

  driversNowAvatarStatusOnline: {
    position: 'absolute',
    right: -1,
    bottom: 1,
    width: 15,
    height: 15,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#101014',
    backgroundColor: '#D4A64A',
  },

  driversNowJourneyIconBox: {
    width: 48,
    height: 48,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  driverActionsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
    zIndex: 999,
    elevation: 999,
  },

  driverActionsBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  driverActionsCard: {
    backgroundColor: '#050505',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },

  driverActionsHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3A3430',
    alignSelf: 'center',
    marginBottom: 16,
  },

  driverActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },

  driverActionsAvatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 999,
  },

  driverActionsAvatar: {
    width: 54,
    height: 54,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#D4A64A',
  },

  driverActionsAvatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  driverActionsEyebrow: {
    color: '#D4A64A',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  driverActionsTitle: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 3,
  },

  driverActionsCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  driverActionsOption: {
    minHeight: 76,
    borderRadius: 14,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },

  driverActionsOptionIconGreen: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(212,166,74,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  driverActionsOptionIconBlue: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(96,165,250,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  driverActionsOptionTitle: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  driverActionsOptionText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 4,
  },

  citySearchInput: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    color: '#F5F0E6',
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },

  cityOptionItem: {
    minHeight: 66,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cityOptionName: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  cityOptionRegion: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  cityChatButton: {
    minWidth: 82,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 6,
    position: 'relative',
  },

  cityChatButtonText: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
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
    color: '#F5F0E6',
    fontSize: 10,
    fontWeight: '900',
  },

  cityChatContent: {
    height: '82%',
    backgroundColor: '#050505',
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
    backgroundColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  chatBubble: {
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '75%',
    minWidth: '40%',
    alignSelf: 'flex-start',
  },

  chatUserName: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
  },

  chatText: {
    color: '#F5F0E6',
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
    paddingBottom: Platform.OS === 'ios' ? 12 : 0,
  },

  chatInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 100,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    color: '#F5F0E6',
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '700',
  },

  chatSendButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privateChatIconButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    position: 'relative',
  },

  replyingBox: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  replyingLabel: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
  },

  replyingText: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },

  replyPreview: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderLeftWidth: 3,
    borderLeftColor: '#F5F0E6',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 6,
  },

  replyPreviewText: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '800',
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  finishTimeCard: {
    backgroundColor: '#101014',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 14,
    marginBottom: 14,
  },

  finishTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },

  finishTimeIconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#211D16',
    borderWidth: 1,
    borderColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
  },

  finishTimeTitle: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  finishTimeSubtitle: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 3,
  },

  finishTimeInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  finishTimeInput: {
    height: 52,
    backgroundColor: '#18171D',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 14,
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '800',
  },

  finishTimePreviewCard: {
    minHeight: 44,
    backgroundColor: '#001B12',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.28)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  finishTimePreviewLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  finishTimePreviewDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: '#D4A64A',
  },

  finishTimePreviewText: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  finishTimePreviewButton: {
    minWidth: 90,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },

  finishTimePreviewButtonText: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  finishTimeEditCard: {
    minHeight: 50,
    backgroundColor: '#001B12',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.28)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  finishTimeEditIconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#211D16',
    borderWidth: 1,
    borderColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
  },

  finishTimeEditTitle: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  finishTimeEditSubtitle: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  finishKmBlock: {
    marginBottom: 18,
  },

  finishKmLabel: {
    color: '#9B969B',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 10,
    marginLeft: 2,
    letterSpacing: 0.3,
  },

  finishKmInputCard: {
    height: 92,
    backgroundColor: '#101014',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },

  finishKmInput: {
    flex: 1,
    height: '100%',
    color: '#F5F0E6',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
  },

  finishKmUnit: {
    color: '#9B969B',
    fontSize: 20,
    fontWeight: '900',
    marginLeft: 12,
  },

  finishPlatformsSection: {
    marginTop: 2,
    marginBottom: 10,
  },

  finishPlatformsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },

  finishPlatformsTitle: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
  },

  finishPlatformsSubtitle: {
    color: '#8F8A91',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  managePlatformsCompactButton: {
    height: 40,
    borderRadius: 999,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  managePlatformsCompactText: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
  },

  finishPlatformModernCard: {
    backgroundColor: '#101014',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 14,
    marginBottom: 12,
  },

  finishPlatformModernHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },

  finishPlatformLogoBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  finishPlatformModernLogo: {
    width: 32,
    height: 32,
    borderRadius: 10,
  },

  finishPlatformModernLogoText: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
  },

  finishPlatformModernName: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  finishPlatformModernHint: {
    color: '#8F8A91',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  finishPlatformAmountBox: {
    height: 54,
    backgroundColor: '#101014',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  finishPlatformCurrency: {
    color: '#D4A64A',
    fontSize: 15,
    fontWeight: '900',
    marginRight: 8,
  },

  finishPlatformModernInput: {
    flex: 1,
    height: '100%',
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
  },

  finishModalContentFull: {
    width: '100%',
    height: '92%',
    backgroundColor: '#101014',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
  },
  activeModernContainer: {
    flex: 1,
    backgroundColor: '#050505',
  },
  activeModernContainerPaused: {
    backgroundColor: '#050505',
  },
  activeModernContent: {
    paddingTop: 48,
    paddingHorizontal: 18,
    paddingBottom: 158,
    backgroundColor: '#050505',
  },
  activeModernHeader: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  activeModernHeaderButton: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: 'rgba(24,24,27,0.92)',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernHeaderTitleBlock: {
    flex: 1,
    marginRight: 4,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  activeModernHeaderCenter: {
    alignItems: 'center',
  },

  activeModernHeaderCityButton: {
    maxWidth: 170,
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: 'rgba(24,24,27,0.92)',
    borderWidth: 1,
    borderColor: '#2A2830',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },

  activeModernHeaderCityText: {
    flexShrink: 1,
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
  },
  activeModernHeaderEyebrow: {
    color: '#8F8A91',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeModernHeaderTitle: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  activeModernHeroCard: {
    borderRadius: 20,
    backgroundColor: '#080808',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderLeftWidth: 1,
    //borderLeftColor: '#D4A64A',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#D4A64A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 12,
  },
  activeModernHeroCardPaused: {
    borderLeftColor: '#F59E0B',
    shadowColor: '#F59E0B',
  },
  activeModernHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  activeModernStatusPill: {
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  activeModernStatusPillPaused: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.24)',
  },
  activeModernStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#D4A64A',
  },
  activeModernStatusDotPaused: {
    backgroundColor: '#F59E0B',
  },
  activeModernStatusText: {
    color: '#D4A64A',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  activeModernStartedText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
  },
  activeModernHeroBody: {
    flexDirection: 'column',
    gap: 16,
  },
  activeModernTimerColumn: {
    flex: 1.1,
    alignItems: 'center'
  },
  activeModernTimerLabel: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  activeModernTimerValue: {
    color: '#F5F0E6',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginTop: 6,
  },
  activeModernTimerHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
  },
  activeModernTimerHintText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
  },
  activeModernHeroDivider: {
    width: 1,
    backgroundColor: '#2A2830',
    marginHorizontal: 12,
  },
  activeModernInfoColumn: {
    flex: 1,
    gap: 16,
  },
  activeModernInfoRowCidade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderColor: '#166534',
    borderBottomWidth: 1,
    borderTopWidth: 1,
  },
  activeModernInfoRowCidadePaused: {
    borderColor: '#92400E',
  },
  activeModernInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeModernInfoIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernInfoLabel: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
  },
  activeModernInfoValue: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  activeModernPlateBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeModernPlateText: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  activeModernMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  activeModernMetricCard: {
    width: '48.5%',
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(212,166,74,0.62)',
    padding: 12,
    justifyContent: 'center',
  },
  activeModernMetricIconGreen: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernMetricIconBlue: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernMetricIconPurple: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernMetricIconOrange: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernMetricLabel: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '900',
    flex: 1,
  },
  activeModernMetricValueGreen: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 5,
    marginBottom: 5,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  activeModernMetricValueBlue: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 5,
    marginBottom: 5,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  activeModernMetricValuePurple: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 5,
    marginBottom: 5,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  activeModernMetricValueOrange: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 5,
    marginBottom: 5,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  activeModernSectionHeaderRow: {
    marginBottom: 12,
  },
  activeModernSectionHeaderRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  activeModernSectionTitle: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  activeModernSectionSubtitle: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  activeModernQuickGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  activeModernQuickButton: {
    flex: 1,
    minHeight: 86,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  activeModernQuickButtonGain: {
    borderColor: 'rgba(212,166,74,0.32)',
    backgroundColor: 'rgba(212,166,74,0.08)',
  },
  activeModernQuickButtonKm: {
    borderColor: 'rgba(212,166,74,0.24)',
  },
  activeModernQuickButtonRide: {
    backgroundColor: 'rgba(168,85,247,0.10)',
    borderColor: 'rgba(212,166,74,0.22)',
  },
  activeModernQuickIconGreen: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernQuickIconBlue: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernQuickIconPurple: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  activeModernQuickText: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  activeModernRideCardActive: {
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 16,
    marginBottom: 18,
  },
  activeModernRideBadgeActive: {
    alignSelf: 'flex-start',
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  activeModernRideBadgeText: {
    color: '#8BFFBF',
    fontSize: 11,
    fontWeight: '900',
  },
  activeModernRideTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  activeModernRidePlatformRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeModernRideLogo: {
    width: 58,
    height: 58,
    borderRadius: 13,
    backgroundColor: '#000000',
  },
  activeModernRideLogoFallback: {
    width: 58,
    height: 58,
    borderRadius: 13,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernRideLogoFallbackText: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
  },
  activeModernRideTitle: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
  },
  activeModernRideSubtitle: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
  },
  activeModernRideFinishButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#D4A64A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
  },
  activeModernRideFinishText: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
  },
  activeModernRideStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  activeModernRideStatBox: {
    width: '48.3%',
    borderRadius: 13,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 12,
  },
  activeModernRideStatLabel: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
  },
  activeModernRideStatValue: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 5,
  },
  activeModernRideStatValueGreen: {
    color: '#4ADE80',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 5,
  },
  activeModernRideStatValueBlue: {
    color: '#D4A64A',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 5,
  },
  activeModernRideActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  activeModernRideActionButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activeModernRideActionTextBlue: {
    color: '#D4A64A',
    fontSize: 13,
    fontWeight: '900',
  },
  activeModernRideActionTextRed: {
    color: '#FF5B5B',
    fontSize: 13,
    fontWeight: '900',
  },
  activeModernSectionBlock: {
    marginBottom: 18,
  },
  activeModernCountBadgeBlue: {
    minWidth: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  activeModernCountBadgeText: {
    color: '#D4A64A',
    fontWeight: '900',
  },
  activeModernWaitingCard: {
    minHeight: 96,
    borderRadius: 14,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  activeModernWaitingLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeModernWaitingLogo: {
    width: 56,
    height: 56,
    borderRadius: 13,
    backgroundColor: '#020617',
  },
  activeModernWaitingLogoFallback: {
    width: 56,
    height: 56,
    borderRadius: 13,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernWaitingLogoFallbackText: {
    color: '#F5F0E6',
    fontWeight: '900',
  },
  activeModernWaitingTitle: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },
  activeModernWaitingSubtitle: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  activeModernWaitingValue: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  activeModernWaitingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  activeModernSmallActionGreen: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernSmallAction: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernSmallActionDanger: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernFinishedCard: {
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 16,
    marginBottom: 18,
  },
  activeModernSeeAllButton: {
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeModernSeeAllText: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
  },
  activeModernFinishedItem: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 10,
    marginTop: 10,
  },
  activeModernFinishedLogo: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#020617',
  },
  activeModernFinishedLogoFallback: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernFinishedLogoFallbackText: {
    color: '#F5F0E6',
    fontWeight: '900',
  },
  activeModernFinishedTitle: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
  },
  activeModernFinishedSubtitle: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  activeModernFinishedMoney: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '900',
  },
  activeModernFinishedKm: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },
  activeModernSessionActionsCard: {
    backgroundColor: '#18171D',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2830',
    marginTop: 4,
    marginBottom: 18,
  },
  activeModernSessionActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  activeModernSessionActionsIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernSessionActionsTitle: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },
  activeModernSessionActionsSubtitle: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
    lineHeight: 17,
  },
  activeModernPrimarySessionAction: {
    flex: 1,
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.24)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  activeModernPrimarySessionActionResume: {
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderColor: 'rgba(212,166,74,0.28)',
  },
  activeModernPrimarySessionIcon: {
    width: 32,
    height: 32,
    borderRadius: 13,
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernPrimarySessionIconResume: {
    backgroundColor: 'rgba(6,19,11,0.12)',
    borderColor: 'rgba(6,19,11,0.14)',
  },
  activeModernPrimarySessionTitle: {
    color: '#FBBF24',
    fontSize: 15,
    fontWeight: '900',
  },
  activeModernPrimarySessionTitleResume: {
    color: '#080808',
  },
  activeModernPrimarySessionSubtitle: {
    color: '#FED7AA',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 3,
  },
  activeModernPrimarySessionSubtitleResume: {
    color: 'rgba(6,19,11,0.72)',
  },
  activeModernSecondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  activeModernDeleteSessionAction: {
    minWidth: 102,
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.24)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  activeModernDeleteSessionIcon: {
    width: 32,
    height: 32,
    borderRadius: 15,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernDeleteSessionTitle: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '900',
  },
  activeModernDeleteSessionSubtitle: {
    color: '#9B969B',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  activeModernFinishSessionAction: {
    minHeight: 62,
    borderRadius: 14,
    backgroundColor: '#D4A64A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginTop: 12,
    shadowColor: '#D4A64A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.20,
    shadowRadius: 16,
    elevation: 8,
  },
  activeModernFinishSessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: 'rgba(8,8,8,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernFinishSessionActionTitle: {
    color: '#080808',
    fontSize: 15,
    fontWeight: '900',
  },
  activeModernFinishSessionActionSubtitle: {
    color: 'rgba(8,8,8,0.68)',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  activeModernEarningsCard: {
    backgroundColor: '#18171D',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2830',
    borderLeftWidth: 4,
    borderLeftColor: '#D4A64A',
    marginTop: 16,
    marginBottom: 14,
  },
  activeModernEarningsTotal: {
    color: '#D4A64A',
    fontSize: 15,
    fontWeight: '900',
  },
  activeModernEmptyState: {
    minHeight: 90,
    borderRadius: 14,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 12,
  },
  activeModernEmptyText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  },
  activeModernEarningItem: {
    minHeight: 72,
    borderRadius: 14,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 12,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeModernEarningIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  activeModernEarningLogo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    resizeMode: 'contain',
  },
  activeModernEarningLogoFallbackText: {
    color: '#D4A64A',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  activeModernEarningPlatform: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },
  activeModernEarningAmount: {
    color: '#D4A64A',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
  },
  activeModernEarningActions: {
    flexDirection: 'row',
    gap: 8,
  },
  activeModernEarningGeneratedHint: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
  activeModernFinishedRidesSoftButton: {
    minHeight: 68,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  activeModernFinishedRidesSoftIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernFinishedRidesSoftTitle: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },
  activeModernFinishedRidesSoftSubtitle: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  activeModernEarningAction: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeModernEarningActionDanger: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },


  rideModalKeyboardAvoiding: {
    flex: 1,
  },

  rideModalOverlayModern: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },

  rideModalSheetModern: {
    maxHeight: Platform.OS === 'ios' ? '90%' : '86%',
    backgroundColor: '#050505',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 18 : 12,
    borderWidth: 1,
    borderColor: '#2A2830',
  },

  rideModalHandle: {
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3A3430',
    alignSelf: 'center',
    marginBottom: 16,
  },

  rideModalHeaderModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  rideModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },

  rideModalHeaderIcon: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: '#211D16',
    borderWidth: 1,
    borderColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rideModalHeaderIconBlue: {
    backgroundColor: '#0B1E3A',
    borderColor: '#1D4ED8',
  },

  rideModalHeaderIconPurple: {
    backgroundColor: '#2E1065',
    borderColor: '#7E22CE',
  },

  rideModalEyebrowModern: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  rideModalTitleModern: {
    color: '#F5F0E6',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },

  rideModalCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rideModalDescription: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 16,
  },

  rideModalScroll: {
    flexShrink: 1,
  },

  rideModalScrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 96 : 116,
  },

  rideModalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },

  rideModalSectionTitle: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
  },

  rideModalSectionSubtitle: {
    color: '#8F8A91',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  rideModalManageButtonTop: {
    height: 38,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  rideModalManageButtonTopText: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
  },

  rideModalPlatformsGridModern: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },

  rideModalPlatformCardModern: {
    width: '48%',
    minHeight: 62,
    borderRadius: 13,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingRight: 34,
    gap: 9,
    position: 'relative',
  },

  rideModalPlatformCardModernActive: {
    backgroundColor: '#211D16',
    borderColor: '#D4A64A',
  },

  rideModalPlatformLogoWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  rideModalPlatformLogoModern: {
    width: 38,
    height: 38,
    resizeMode: 'cover',
  },

  rideModalPlatformLogoFallbackText: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
  },

  rideModalPlatformNameModern: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'left',
    flex: 1,
  },

  rideModalPlatformCheck: {
    position: 'absolute',
    right: 7,
    top: 7,
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rideModalInputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },

  rideModalInputBlock: {
    flex: 1,
  },

  rideModalInputLabel: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 7,
    marginLeft: 2,
  },

  rideModalMoneyInputCard: {
    minHeight: 60,
    borderRadius: 13,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  rideModalInputIconGreen: {
    minWidth: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(212,166,74,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rideModalInputIconBlue: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(59,130,246,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rideModalCurrencyText: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '900',
  },

  rideModalInputModern: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
    padding: 0,
  },

  rideModalInfoCard: {
    minHeight: 62,
    borderRadius: 13,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginBottom: 14,
  },

  rideModalInfoText: {
    flex: 1,
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  rideModalPrimaryButton: {
    height: 60,
    borderRadius: 14,
    backgroundColor: '#D4A64A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 6,
  },

  rideModalPrimaryButtonText: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
  },

  rideModalEmptyPlatforms: {
    minHeight: 190,
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginBottom: 18,
  },

  rideModalEmptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  rideModalEmptyTitle: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
  },

  rideModalEmptyText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },

  rideModalEmptyButton: {
    height: 42,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },

  rideModalEmptyButtonText: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
  },


  rideResultModernOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },

  rideResultModernSheet: {
    width: '100%',
    maxHeight: '82%',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
  },

  rideResultModernHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3A3430',
    alignSelf: 'center',
    marginBottom: 18,
  },

  rideResultModernHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 16,
  },

  rideResultModernHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  rideResultModernIconBox: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rideResultModernEyebrow: {
    color: '#D4A64A',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  rideResultModernTitle: {
    color: '#F5F0E6',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 2,
  },

  rideResultModernCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rideResultModernScroll: {
    maxHeight: 430,
  },

  rideResultModernScrollContent: {
    paddingBottom: 12,
  },

  rideResultModernHeroCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    marginBottom: 12,
  },

  rideResultModernHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },

  rideResultModernHeroLabel: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },

  rideResultModernHeroValue: {
    color: '#D4A64A',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },

  rideResultModernSuccessBadge: {
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  rideResultModernSuccessText: {
    color: '#D4A64A',
    fontSize: 11,
    fontWeight: '900',
  },

  rideResultModernDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 14,
  },

  rideResultModernHeroHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  rideResultModernHeroHintText: {
    flex: 1,
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  rideResultModernStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  rideResultModernStatCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 13,
  },

  rideResultModernStatCardWide: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  rideResultModernStatIconGreen: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(212,166,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  rideResultModernStatIconBlue: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(96,165,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  rideResultModernStatIconPurple: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: 'rgba(212,166,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rideResultModernStatLabel: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },

  rideResultModernStatValue: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
  },

  rideResultModernStatValueGreen: {
    color: '#D4A64A',
    fontSize: 19,
    fontWeight: '900',
  },

  rideResultModernStatValueBlue: {
    color: '#D4A64A',
    fontSize: 19,
    fontWeight: '900',
  },

  rideResultModernFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#050505',
  },

  rideResultModernSecondaryButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 13,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  rideResultModernSecondaryButtonText: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  rideResultModernPrimaryButton: {
    flex: 1.1,
    minHeight: 56,
    borderRadius: 13,
    backgroundColor: '#D4A64A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#D4A64A',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  rideResultModernPrimaryButtonText: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },


  finishRideModernOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
    paddingHorizontal: 0,
  },

  finishRideModernSheet: {
    width: '100%',
    height: '92%',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  finishRideModernHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3A3430',
    alignSelf: 'center',
    marginBottom: 18,
  },

  finishRideModernHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 10,
  },

  finishRideModernHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  finishRideModernHeaderIcon: {
    width: 50,
    height: 50,
    borderRadius: 13,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  finishRideModernEyebrow: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  finishRideModernTitle: {
    color: '#F5F0E6',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 2,
  },

  finishRideModernCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  finishRideModernScroll: {
    flex: 1,
  },

  finishRideModernScrollContent: {
    paddingBottom: 12,
  },

  finishRideModernFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#050505',
  },

  finishRideModernSubtitle: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginBottom: 14,
  },

  finishRideModernSummaryCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    marginBottom: 12,
  },

  finishRideModernSummaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },

  finishRideModernPlatformBox: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  finishRideModernPlatformLogo: {
    width: 52,
    height: 52,
    borderRadius: 13,
  },

  finishRideModernPlatformInitial: {
    color: '#F5F0E6',
    fontSize: 22,
    fontWeight: '900',
  },

  finishRideModernPlatformName: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
  },

  finishRideModernPlatformHint: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  finishRideModernLiveBadge: {
    height: 31,
    borderRadius: 999,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  finishRideModernLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#D4A64A',
  },

  finishRideModernLiveText: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
  },

  finishRideModernStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  finishRideModernStatBox: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
  },

  finishRideModernStatBoxWide: {
    width: '100%',
    borderRadius: 13,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.16)',
    padding: 12,
  },

  finishRideModernStatLabel: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },

  finishRideModernStatValue: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  finishRideModernStatValueGreen: {
    color: '#D4A64A',
    fontSize: 19,
    fontWeight: '900',
  },

  finishRideModernFieldsCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    marginBottom: 0,
  },

  finishRideModernInputLabel: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },

  finishRideModernInputBox: {
    minHeight: 58,
    borderRadius: 13,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#2A2830',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 14,
  },

  finishRideModernInputIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(212,166,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  finishRideModernInputIconBlue: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(96,165,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  finishRideModernCurrencyText: {
    color: '#D4A64A',
    fontSize: 14,
    fontWeight: '900',
  },

  finishRideModernMoneyInput: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 26,
    fontWeight: '900',
    paddingVertical: 8,
  },

  finishRideModernKmInput: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 21,
    fontWeight: '900',
    paddingVertical: 8,
  },

  finishRideModernKmUnit: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 8,
  },

  finishRideModernHintCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  finishRideModernHintText: {
    flex: 1,
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  finishRideModernButton: {
    minHeight: 58,
    borderRadius: 13,
    backgroundColor: '#D4A64A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: '#D4A64A',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  finishRideModernButtonText: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
  },


  finishedModernOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },

  finishedModernSheet: {
    width: '100%',
    maxHeight: '94%',
    backgroundColor: '#050505',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -10 },
    elevation: 18,
  },

  finishedModernHandle: {
    alignSelf: 'center',
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3A3430',
    marginBottom: 16,
  },

  finishedModernHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },

  finishedModernHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: 'rgba(212,166,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
  },

  finishedModernEyebrow: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 2,
  },

  finishedModernTitle: {
    color: '#F5F0E6',
    fontSize: 22,
    fontWeight: '900',
  },

  finishedModernCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  finishedModernSummaryCard: {
    borderRadius: 16,
    backgroundColor: '#101B14',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.18)',
    padding: 16,
    marginBottom: 14,
  },

  finishedModernSummaryMain: {
    marginBottom: 14,
  },

  finishedModernSummaryLabel: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },

  finishedModernSummaryValue: {
    color: '#F5F0E6',
    fontSize: 30,
    fontWeight: '900',
  },

  finishedModernSummaryGrid: {
    flexDirection: 'row',
    gap: 9,
  },

  finishedModernMiniStat: {
    flex: 1,
    minHeight: 78,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 11,
    justifyContent: 'space-between',
  },

  finishedModernMiniStatLabel: {
    color: '#9B969B',
    fontSize: 10,
    fontWeight: '800',
  },

  finishedModernMiniStatValue: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
  },

  finishedModernList: {
    flex: 1,
  },

  finishedModernListContent: {
    paddingBottom: 14,
    gap: 12,
  },

  finishedModernRideCard: {
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 14,
  },

  finishedModernRideHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },

  finishedModernRidePlatformRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },

  finishedModernRideLogo: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#F5F0E6',
  },

  finishedModernRideLogoFallback: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  finishedModernRideLogoFallbackText: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  finishedModernRidePlatform: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
  },

  finishedModernRideTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },

  finishedModernRideTimeText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
  },

  finishedModernStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.18)',
  },

  finishedModernStatusText: {
    color: '#E8C46D',
    fontSize: 11,
    fontWeight: '900',
  },

  finishedModernRideAmountBox: {
    borderRadius: 13,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.13)',
    padding: 13,
    marginBottom: 12,
  },

  finishedModernRideAmountLabel: {
    color: '#D4A64A',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 3,
  },

  finishedModernRideAmount: {
    color: '#F5F0E6',
    fontSize: 23,
    fontWeight: '900',
  },

  finishedModernStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },

  finishedModernStatPill: {
    width: '48.8%',
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  finishedModernStatLabel: {
    color: '#9B969B',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },

  finishedModernStatValue: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
  },

  finishedModernActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  finishedModernEditButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(96,165,250,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  finishedModernEditText: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
  },

  finishedModernDeleteButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  finishedModernDeleteText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '900',
  },


  completedRidesOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },

  completedRidesSheet: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#050505',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
  },

  completedRidesHandle: {
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3A3430',
    alignSelf: 'center',
    marginBottom: 16,
  },

  completedRidesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },

  completedRidesHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  completedRidesEyebrow: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  completedRidesTitle: {
    color: '#F5F0E6',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },

  completedRidesSubtitle: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
    lineHeight: 18,
  },

  completedRidesCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  completedRidesSummaryCard: {
    backgroundColor: '#101014',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 16,
    marginBottom: 14,
  },

  completedRidesSummaryMain: {
    marginBottom: 14,
  },

  completedRidesSummaryLabel: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '800',
  },

  completedRidesSummaryValue: {
    color: '#D4A64A',
    fontSize: 34,
    fontWeight: '900',
    marginTop: 2,
  },

  completedRidesSummaryGrid: {
    flexDirection: 'row',
    gap: 8,
  },

  completedRidesMiniStat: {
    flex: 1,
    minHeight: 82,
    borderRadius: 13,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 10,
    justifyContent: 'space-between',
  },

  completedRidesMiniStatLabel: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 6,
  },

  completedRidesMiniStatValue: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  completedRidesList: {
    flex: 1,
  },

  completedRidesListContent: {
    paddingBottom: 20,
  },

  completedRidesEmptyBox: {
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 24,
    alignItems: 'center',
  },

  completedRidesEmptyTitle: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 12,
  },

  completedRidesEmptyText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  completedRideCard: {
    backgroundColor: '#101014',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 16,
    marginBottom: 14,
  },

  completedRideTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },

  completedRidePlatformRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  completedRideLogo: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#F5F0E6',
  },

  completedRideLogoFallback: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
  },

  completedRideLogoFallbackText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '900',
  },

  completedRidePlatform: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
  },

  completedRideStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },

  completedRideStatusText: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
  },

  completedRideAmountBox: {
    alignItems: 'flex-end',
  },

  completedRideAmountLabel: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
  },

  completedRideAmountValue: {
    color: '#D4A64A',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },

  completedRideTimelineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101014',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 12,
    marginTop: 16,
  },

  completedRideTimelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  completedRideTimelineIconStart: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  completedRideTimelineIconEnd: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  completedRideTimelineLabel: {
    color: '#8F8A91',
    fontSize: 11,
    fontWeight: '800',
  },

  completedRideTimelineValue: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  completedRideTimelineLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2A2830',
    marginHorizontal: 10,
  },

  completedRideDurationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    marginLeft: 10,
  },

  completedRideDurationText: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
  },

  completedRideDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },

  completedRideDetailCard: {
    width: '48%',
    minHeight: 92,
    borderRadius: 14,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 12,
  },

  completedRideDetailIconGreen: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(212,166,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  completedRideDetailIconOrange: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  completedRideDetailIconBlue: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(96,165,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  completedRideDetailIconPurple: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(212,166,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  completedRideDetailLabel: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
  },

  completedRideDetailValue: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },

  completedRideDetailValueGreen: {
    color: '#D4A64A',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },

  completedRideDetailValueBlue: {
    color: '#D4A64A',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },

  completedRideDetailValuePurple: {
    color: '#C084FC',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },

  completedRideFooterActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },

  completedRideEditButton: {
    flex: 1,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },

  completedRideEditText: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  completedRideDeleteButton: {
    flex: 1,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(127,29,29,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },

  completedRideDeleteText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '900',
  },


  completedRidesSheetFullList: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#050505',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
  },

  completedRidesListOnly: {
    marginTop: 14,
  },

  completedRidesListOnlyContent: {
    paddingBottom: 28,
    gap: 10,
  },

  completedRideListCard: {
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 13,
    padding: 12,
    gap: 10,
  },

  completedRideListTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  completedRideValuePill: {
    minWidth: 102,
    backgroundColor: 'rgba(34, 197, 94, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.18)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'flex-end',
  },

  completedRideValuePillLabel: {
    color: '#D4A64A',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  completedRideValuePillText: {
    color: '#D4A64A',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 1,
  },

  completedRideTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },

  completedRideTimeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  completedRideTimeIconStart: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  completedRideTimeIconEnd: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  completedRideTimeLabel: {
    color: '#8F8A91',
    fontSize: 11,
    fontWeight: '700',
  },

  completedRideTimeValue: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },

  completedRideTimeDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#2A2830',
  },

  completedRideFullDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  completedRideFullDetailCard: {
    width: '48%',
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 13,
    padding: 12,
    minHeight: 88,
  },

  completedRideFullDetailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 22,
  },

  completedRideFullDetailLabel: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 1,
  },

  completedRideFullDetailValue: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },

  completedRideFullDetailValueGreen: {
    color: '#D4A64A',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },

  completedRideFullDetailValuePurple: {
    color: '#C084FC',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },


  completedRideCompactDetails: {
    backgroundColor: 'rgba(9, 9, 11, 0.66)',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 8,
  },

  completedRideCompactLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  completedRideCompactDivider: {
    height: 1,
    backgroundColor: '#2A2830',
  },

  completedRideCompactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },

  completedRideCompactItem: {
    width: '50%',
    paddingRight: 8,
  },

  completedRideCompactLabel: {
    color: '#8F8A91',
    fontSize: 11,
    fontWeight: '700',
  },

  completedRideCompactValue: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },

  completedRideCompactValueGreen: {
    color: '#D4A64A',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },

  completedRideCompactValuePurple: {
    color: '#C084FC',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },


  editFinishedRideModernOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },

  editFinishedRideModernSheet: {
    width: '100%',
    maxHeight: '88%',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },

  editFinishedRideModernHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3A3430',
    alignSelf: 'center',
    marginBottom: 18,
  },

  editFinishedRideModernHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 14,
  },

  editFinishedRideModernHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  editFinishedRideModernHeaderIcon: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editFinishedRideModernEyebrow: {
    color: '#D4A64A',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  editFinishedRideModernTitle: {
    color: '#F5F0E6',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },

  editFinishedRideModernCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editFinishedRideModernScrollContent: {
    paddingBottom: 18,
    gap: 14,
  },

  editFinishedRideModernSubtitle: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },

  editFinishedRideModernSummaryCard: {
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 16,
    padding: 14,
    gap: 14,
  },

  editFinishedRideModernPlatformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  editFinishedRideModernPlatformLogoBox: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  editFinishedRideModernPlatformLogo: {
    width: 34,
    height: 34,
    borderRadius: 12,
  },

  editFinishedRideModernPlatformInitial: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
  },

  editFinishedRideModernPlatformName: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
  },

  editFinishedRideModernStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },

  editFinishedRideModernStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#D4A64A',
  },

  editFinishedRideModernStatusText: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
  },

  editFinishedRideModernInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  editFinishedRideModernInfoCard: {
    width: '48%',
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 13,
    padding: 12,
    minHeight: 76,
  },

  editFinishedRideModernInfoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  editFinishedRideModernInfoLabel: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
  },

  editFinishedRideModernInfoValue: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 7,
  },

  editFinishedRideModernAmountCard: {
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 16,
    padding: 14,
  },

  editFinishedRideModernInputLabel: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },

  editFinishedRideModernAmountInputBox: {
    height: 58,
    borderRadius: 14,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#2A2830',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  editFinishedRideModernCurrencyBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  editFinishedRideModernCurrencyText: {
    color: '#D4A64A',
    fontSize: 14,
    fontWeight: '900',
  },

  editFinishedRideModernAmountInput: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 24,
    fontWeight: '900',
    paddingVertical: 0,
  },

  editFinishedRideModernInputHint: {
    color: '#8F8A91',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 10,
  },

  editFinishedRideModernFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#18171D',
  },

  editFinishedRideModernCancelButton: {
    flex: 1,
    height: 54,
    borderRadius: 13,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editFinishedRideModernCancelText: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  editFinishedRideModernSaveButton: {
    flex: 1.25,
    height: 54,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  editFinishedRideModernSaveText: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },


  kmModernOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.74)',
    justifyContent: 'flex-end',
  },

  kmModernSheet: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: '#050505',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    borderWidth: 1,
    borderColor: '#2A2830',
  },

  kmModernHandle: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#374151',
    marginBottom: 14,
  },

  kmModernHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },

  kmModernHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  kmModernIconBox: {
    width: 50,
    height: 50,
    borderRadius: 13,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  kmModernEyebrow: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
  },

  kmModernTitle: {
    color: '#F5F0E6',
    fontSize: 22,
    fontWeight: '900',
  },

  kmModernCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  kmModernScrollContent: {
    paddingBottom: 14,
    gap: 14,
  },

  kmModernSummaryCard: {
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 16,
    padding: 14,
    gap: 14,
  },

  kmModernSummaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  kmModernSummaryLabel: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 5,
  },

  kmModernSummaryValue: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
  },

  kmModernSummaryValueHighlight: {
    color: '#F59E0B',
    fontSize: 17,
    fontWeight: '900',
  },

  kmModernSummaryArrow: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  kmModernDrivenBox: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 13,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  kmModernDrivenIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  kmModernDrivenLabel: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
  },

  kmModernDrivenValue: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 3,
  },

  kmModernInputSection: {
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 16,
    padding: 14,
  },

  kmModernInputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 11,
  },

  kmModernInputLabel: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  kmModernInputCard: {
    height: 62,
    borderRadius: 14,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#2A2830',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  kmModernInput: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 28,
    fontWeight: '900',
    paddingVertical: 0,
  },

  kmModernUnitPill: {
    minWidth: 44,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  kmModernUnitText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '900',
  },

  kmModernHintBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#050505',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 11,
    marginTop: 12,
  },

  kmModernHintText: {
    flex: 1,
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  kmModernFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#18171D',
  },

  kmModernCancelButton: {
    flex: 1,
    height: 54,
    borderRadius: 13,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  kmModernCancelText: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  kmModernSaveButton: {
    flex: 1.35,
    height: 54,
    borderRadius: 13,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  kmModernSaveText: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },


  privateChatOverlayModern: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'flex-end',
  },

  privateChatBackdropModern: {
    ...StyleSheet.absoluteFillObject,
  },

  privateChatSheetModern: {
    height: '86%',
    width: '100%',
    backgroundColor: '#050505',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 22 : 14,
  },

  privateChatHandleModern: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3A3430',
    alignSelf: 'center',
    marginBottom: 14,
  },

  privateChatHeaderModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },

  privateChatHeaderLeftModern: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  privateChatHeaderAvatarModern: {
    width: 48,
    height: 48,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#D4A64A',
    backgroundColor: '#18171D',
  },

  privateChatHeaderAvatarFallbackModern: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  privateChatTitleRowModern: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  privateChatTitleModern: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
  },

  privateChatPrivateBadgeModern: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
  },

  privateChatPrivateBadgeTextModern: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
  },

  privateChatSubtitleModern: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  privateChatCloseButtonModern: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  privateChatNoticeModern: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E3A8A',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },

  privateChatNoticeTextModern: {
    flex: 1,
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  privateChatMessagesScrollModern: {
    flex: 1,
  },

  privateChatMessagesContentModern: {
    paddingTop: 4,
    paddingBottom: 14,
  },

  privateChatEmptyBoxModern: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },

  privateChatEmptyIconModern: {
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  privateChatEmptyTitleModern: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
  },

  privateChatEmptyTextModern: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  privateChatMessageRowModern: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '100%',
    marginBottom: 12,
  },

  privateChatMessageRowMineModern: {
    justifyContent: 'flex-end',
  },

  privateChatMessageRowOtherModern: {
    justifyContent: 'flex-start',
  },

  privateChatMessageAvatarModern: {
    width: 34,
    height: 34,
    borderRadius: 999,
    marginRight: 8,
    backgroundColor: '#18171D',
  },

  privateChatMessageAvatarFallbackModern: {
    width: 34,
    height: 34,
    borderRadius: 999,
    marginRight: 8,
    backgroundColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  privateChatBubbleModern: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '78%',
    minWidth: 96,
    borderWidth: 1,
  },

  privateChatBubbleMineModern: {
    backgroundColor: '#D4A64A',
    borderColor: '#D4A64A',
    borderBottomRightRadius: 6,
  },

  privateChatBubbleOtherModern: {
    backgroundColor: '#18171D',
    borderColor: '#2A2830',
    borderBottomLeftRadius: 6,
  },

  privateChatSenderNameModern: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },

  privateChatMessageTextModern: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },

  privateChatMessageTextMineModern: {
    color: '#211D16',
  },

  privateChatBubbleFooterModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 6,
  },

  privateChatHourModern: {
    color: '#9B969B',
    fontSize: 10,
    fontWeight: '800',
  },

  privateChatHourMineModern: {
    color: 'rgba(212,166,74,0.28)',
  },

  privateChatReplyPreviewModern: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderLeftWidth: 3,
    borderLeftColor: '#D4A64A',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 8,
  },

  privateChatReplyPreviewMineModern: {
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderLeftColor: 'rgba(212,166,74,0.28)',
  },

  privateChatReplyPreviewLabelModern: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 2,
  },

  privateChatReplyPreviewLabelMineModern: {
    color: 'rgba(212,166,74,0.28)',
  },

  privateChatReplyPreviewTextModern: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '700',
  },

  privateChatReplyPreviewTextMineModern: {
    color: '#064E3B',
  },

  privateChatReplyingBoxModern: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },

  privateChatReplyingIconModern: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  privateChatReplyingLabelModern: {
    color: '#D4A64A',
    fontSize: 11,
    fontWeight: '900',
  },

  privateChatReplyingTextModern: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },

  privateChatReplyingCloseModern: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  privateChatInputBarModern: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#18171D',
  },

  privateChatInputModern: {
    flex: 1,
    minHeight: 50,
    maxHeight: 108,
    borderRadius: 13,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    color: '#F5F0E6',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    fontSize: 14,
    fontWeight: '700',
  },

  privateChatSendButtonModern: {
    width: 50,
    height: 50,
    borderRadius: 13,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  privateChatSendButtonDisabledModern: {
    opacity: 0.45,
  },

  cityChatModernOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },

  cityChatModernBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  cityChatModernSheet: {
    height: '88%',
    width: '100%',
    backgroundColor: '#050505',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },

  cityChatModernHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#374151',
    alignSelf: 'center',
    marginBottom: 16,
  },

  cityChatModernHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  cityChatModernHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  cityChatModernHeaderIcon: {
    width: 50,
    height: 50,
    borderRadius: 13,
    backgroundColor: 'rgba(37,99,235,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cityChatModernTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },

  cityChatModernEyebrow: {
    color: '#D4A64A',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  cityChatModernBadge: {
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.35)',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  cityChatModernBadgeText: {
    color: '#D4A64A',
    fontSize: 11,
    fontWeight: '900',
  },

  cityChatModernTitle: {
    color: '#F5F0E6',
    fontSize: 21,
    fontWeight: '900',
  },

  cityChatModernSubtitle: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  cityChatModernCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cityChatModernInfoCard: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: 'rgba(37,99,235,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.24)',
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  cityChatModernInfoText: {
    flex: 1,
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  cityChatModernMessagesList: {
    flex: 1,
    marginTop: 14,
  },

  cityChatModernMessagesContent: {
    paddingBottom: 14,
  },

  cityChatModernEmptyBox: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  cityChatModernEmptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  cityChatModernEmptyTitle: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },

  cityChatModernEmptyText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },

  cityChatModernMessageRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },

  cityChatModernMessageRowMe: {
    justifyContent: 'flex-end',
  },

  cityChatModernAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#2A2830',
  },

  cityChatModernAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#2A2830',
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cityChatModernAvatarFallbackText: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  cityChatModernBubble: {
    maxWidth: '78%',
    minWidth: 90,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },

  cityChatModernBubbleOther: {
    backgroundColor: '#18171D',
    borderColor: '#2A2830',
    borderBottomLeftRadius: 7,
  },

  cityChatModernBubbleMe: {
    backgroundColor: '#D4A64A',
    borderColor: '#D4A64A',
    borderBottomRightRadius: 7,
  },

  cityChatModernUserName: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },

  cityChatModernReplyPreview: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderLeftWidth: 3,
    borderLeftColor: '#D4A64A',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 7,
  },

  cityChatModernReplyPreviewMe: {
    backgroundColor: 'rgba(0,0,0,0.16)',
    borderLeftColor: '#F5F0E6',
  },

  cityChatModernReplyPreviewText: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '800',
  },

  cityChatModernMessageText: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },

  cityChatModernMessageTextMe: {
    color: '#F5F0E6',
  },

  cityChatModernHourRow: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },

  cityChatModernHourText: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
  },

  cityChatModernHourTextMe: {
    color: '#F5F0E6',
  },

  cityChatModernReplyingBox: {
    minHeight: 58,
    borderRadius: 13,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  cityChatModernReplyingIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: 'rgba(37,99,235,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cityChatModernReplyingLabel: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
  },

  cityChatModernReplyingText: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },

  cityChatModernInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingTop: 10,
  },

  cityChatModernInputWrapper: {
    flex: 1,
    minHeight: 52,
    maxHeight: 110,
    borderRadius: 13,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },

  cityChatModernInput: {
    flex: 1,
    minHeight: 28,
    maxHeight: 82,
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '700',
    padding: 0,
  },

  cityChatModernSendButton: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cityChatModernSendButtonDisabled: {
    opacity: 0.45,
  },


});