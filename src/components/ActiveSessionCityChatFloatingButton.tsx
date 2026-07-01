import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';


import { supabase } from '../database/supabase';
import { getActiveSession } from '../features/workSessions/services/getActiveSession';
import { getOnlineDriversByMunicipality } from '../features/municipalities/services/getOnlineDriversByMunicipality';
import { searchMunicipalities } from '../features/municipalities/services/searchMunicipalities';
import { updateSessionMunicipality } from '../features/municipalities/services/updateSessionMunicipality';
import { getCityChatMessages } from '../features/cityChat/services/getCityChatMessages';
import { sendCityChatMessage } from '../features/cityChat/services/sendCityChatMessage';
import { getUnreadCityChatCount } from '../features/cityChat/services/getUnreadCityChatCount';
import { markCityChatAsRead } from '../features/cityChat/services/markCityChatAsRead';

const BUTTON_SIZE = 64;

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

function getDriverProfile(driver: any) {
  return driver?.profile || driver?.user || driver?.profiles || null;
}

function getDriverUserId(driver: any) {
  return (
    driver?.user_id ||
    driver?.userId ||
    driver?.profile_id ||
    driver?.profileId ||
    driver?.driver_id ||
    driver?.driverId ||
    driver?.profile?.id ||
    driver?.profiles?.id ||
    driver?.user?.id ||
    null
  );
}

function getNumberValue(...values: any[]) {
  for (const value of values) {
    const numberValue = Number(value);

    if (Number.isFinite(numberValue) && numberValue >= 0) {
      return numberValue;
    }
  }

  return null;
}

function getDriverSession(driver: any) {
  return (
    driver?.active_session ||
    driver?.activeSession ||
    driver?.current_session ||
    driver?.currentSession ||
    driver?.work_session ||
    driver?.workSession ||
    driver?.session ||
    {}
  );
}

function getDriverStartedAt(driver: any) {
  const session = getDriverSession(driver);

  return (
    session?.started_at ||
    session?.startedAt ||
    session?.timer_started_at ||
    session?.timerStartedAt ||
    session?.chronometer_started_at ||
    session?.chronometerStartedAt ||
    driver?.started_at ||
    driver?.startedAt ||
    driver?.timer_started_at ||
    driver?.timerStartedAt ||
    driver?.chronometer_started_at ||
    driver?.chronometerStartedAt ||
    null
  );
}

function getDriverChronometerSeconds(driver: any, nowTimestamp: number) {
  const session = getDriverSession(driver);

  const directSeconds = getNumberValue(
    session?.chronometer_seconds,
    session?.chronometerSeconds,
    session?.timer_seconds,
    session?.timerSeconds,
    session?.elapsed_seconds,
    session?.elapsedSeconds,
    session?.current_elapsed_seconds,
    session?.currentElapsedSeconds,
    session?.active_seconds,
    session?.activeSeconds,
    session?.duration_seconds,
    session?.durationSeconds,
    session?.total_seconds,
    session?.totalSeconds,
    session?.worked_seconds,
    session?.workedSeconds,
    session?.worked_time_seconds,
    session?.workedTimeSeconds,
    driver?.chronometer_seconds,
    driver?.chronometerSeconds,
    driver?.timer_seconds,
    driver?.timerSeconds,
    driver?.elapsed_seconds,
    driver?.elapsedSeconds,
    driver?.current_elapsed_seconds,
    driver?.currentElapsedSeconds,
    driver?.active_seconds,
    driver?.activeSeconds,
    driver?.duration_seconds,
    driver?.durationSeconds,
    driver?.total_seconds,
    driver?.totalSeconds,
    driver?.worked_seconds,
    driver?.workedSeconds,
    driver?.worked_time_seconds,
    driver?.workedTimeSeconds,
  );

  if (directSeconds !== null) return directSeconds;

  const directMinutes = getNumberValue(
    session?.chronometer_minutes,
    session?.chronometerMinutes,
    session?.timer_minutes,
    session?.timerMinutes,
    session?.elapsed_minutes,
    session?.elapsedMinutes,
    session?.worked_minutes,
    session?.workedMinutes,
    driver?.chronometer_minutes,
    driver?.chronometerMinutes,
    driver?.timer_minutes,
    driver?.timerMinutes,
    driver?.elapsed_minutes,
    driver?.elapsedMinutes,
    driver?.worked_minutes,
    driver?.workedMinutes,
  );

  if (directMinutes !== null) return directMinutes * 60;

  const startedAtValue = getDriverStartedAt(driver);

  if (!startedAtValue) return 0;

  const startedAt = new Date(startedAtValue);

  if (Number.isNaN(startedAt.getTime())) return 0;

  const pausedSeconds =
    getNumberValue(
      session?.paused_seconds,
      session?.pausedSeconds,
      session?.total_paused_seconds,
      session?.totalPausedSeconds,
      session?.pause_seconds,
      session?.pauseSeconds,
      session?.paused_duration_seconds,
      session?.pausedDurationSeconds,
      driver?.paused_seconds,
      driver?.pausedSeconds,
      driver?.total_paused_seconds,
      driver?.totalPausedSeconds,
      driver?.pause_seconds,
      driver?.pauseSeconds,
      driver?.paused_duration_seconds,
      driver?.pausedDurationSeconds,
    ) ?? 0;

  const status = String(session?.status ?? driver?.status ?? '').toLowerCase();

  if (status === 'paused') {
    const pausedAtValue =
      session?.paused_at ||
      session?.pausedAt ||
      driver?.paused_at ||
      driver?.pausedAt ||
      null;

    if (pausedAtValue) {
      const pausedAt = new Date(pausedAtValue);

      if (!Number.isNaN(pausedAt.getTime())) {
        return Math.max(
          Math.floor((pausedAt.getTime() - startedAt.getTime()) / 1000) -
            pausedSeconds,
          0,
        );
      }
    }
  }

  return Math.max(
    Math.floor((nowTimestamp - startedAt.getTime()) / 1000) - pausedSeconds,
    0,
  );
}

function formatDriverRunningTime(driver: any, nowTimestamp: number) {
  const chronometerSeconds = getDriverChronometerSeconds(driver, nowTimestamp);
  const chronometerHours = Math.floor(chronometerSeconds / (60 * 60));

  if (chronometerHours < 1) return 'começou agora';

  return `rodando há ${chronometerHours}h`;
}

function getInitialPosition() {
  const { width, height } = Dimensions.get('window');

  return {
    x: Math.max(width - BUTTON_SIZE - 18, 18),
    y: Math.max(height - BUTTON_SIZE - 170, 120),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getJourneyChatStartDate(session: any) {
  if (!session?.started_at) return null;

  const startedAt = new Date(session.started_at);

  if (Number.isNaN(startedAt.getTime())) return null;

  startedAt.setHours(startedAt.getHours() - 1);

  return startedAt;
}

function filterMessagesFromJourneyChatStart(messages: any[], session: any) {
  const chatStartDate = getJourneyChatStartDate(session);

  if (!chatStartDate) return messages;

  return messages.filter((message) => {
    if (!message?.created_at) return false;

    const messageDate = new Date(message.created_at);

    if (Number.isNaN(messageDate.getTime())) return false;

    return messageDate.getTime() >= chatStartDate.getTime();
  });
}

function getJourneyChatStartIso(session: any) {
  const chatStartDate = getJourneyChatStartDate(session);

  return chatStartDate?.toISOString() ?? null;
}

function getUniqueValues(values: any[]) {
  return Array.from(
    new Set(values.filter((value) => Boolean(value)).map((value) => String(value))),
  );
}

function base64ToArrayBuffer(base64: string) {
  const cleanBase64 = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let bufferLength = cleanBase64.length * 0.75;

  if (cleanBase64.endsWith('==')) {
    bufferLength -= 2;
  } else if (cleanBase64.endsWith('=')) {
    bufferLength -= 1;
  }

  const bytes = new Uint8Array(bufferLength);
  let p = 0;

  for (let i = 0; i < cleanBase64.length; i += 4) {
    const encoded1 = chars.indexOf(cleanBase64[i]);
    const encoded2 = chars.indexOf(cleanBase64[i + 1]);
    const encoded3 = chars.indexOf(cleanBase64[i + 2]);
    const encoded4 = chars.indexOf(cleanBase64[i + 3]);

    const bitmap =
      (encoded1 << 18) | (encoded2 << 12) | (encoded3 << 6) | encoded4;

    if (encoded3 !== 64 && p < bytes.length) {
      bytes[p] = (bitmap >> 16) & 255;
      p += 1;
    }

    if (encoded4 !== 64 && p < bytes.length) {
      bytes[p] = (bitmap >> 8) & 255;
      p += 1;
    }

    if (encoded4 !== 64 && p < bytes.length) {
      bytes[p] = bitmap & 255;
      p += 1;
    }
  }

  return bytes.buffer;
}

async function getAudioArrayBufferFromUri(audioUri: string) {
  const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
    encoding: 'base64' as any,
  });

  return base64ToArrayBuffer(base64Audio);
}

function getFirstUnreadMessageId(messages: any[], unreadCount: number) {
  const safeUnreadCount = Math.min(
    Math.max(Number(unreadCount ?? 0), 0),
    messages.length,
  );

  if (safeUnreadCount <= 0) return '';

  return messages[messages.length - safeUnreadCount]?.id ?? '';
}

async function getUnreadCityChatCountSafe(municipalityId: string) {
  try {
    const unread = await getUnreadCityChatCount(municipalityId);

    return Number(unread ?? 0);
  } catch (error) {
    console.log('Erro ao buscar total de mensagens não visualizadas:', error);

    return 0;
  }
}

async function getCityChatMessagesFromJourneyWindow({
  municipalityId,
  activeSession,
}: {
  municipalityId: string;
  activeSession: any;
}) {
  const chatStartIso = getJourneyChatStartIso(activeSession);

  if (!municipalityId || !chatStartIso) return [];

  const { data: messagesData, error: messagesError } = await supabase
    .from('city_chat_messages')
    .select('*')
    .eq('municipality_id', municipalityId)
    .gte('created_at', chatStartIso)
    .order('created_at', { ascending: true });

  if (messagesError) {
    throw messagesError;
  }

  const messages = messagesData ?? [];

  const replyIds = getUniqueValues(
    messages.map((message) => message.reply_to_message_id),
  );

  let repliedMessages: any[] = [];

  if (replyIds.length > 0) {
    const { data: repliedData, error: repliedError } = await supabase
      .from('city_chat_messages')
      .select('*')
      .in('id', replyIds);

    if (repliedError) {
      console.log('Erro ao buscar mensagens respondidas:', repliedError);
    } else {
      repliedMessages = repliedData ?? [];
    }
  }

  const allUserIds = getUniqueValues([
    ...messages.map((message) => message.user_id),
    ...repliedMessages.map((message) => message.user_id),
  ]);

  let profilesById: Record<string, any> = {};

  if (allUserIds.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', allUserIds);

    if (profilesError) {
      console.log('Erro ao buscar perfis do chat da cidade:', profilesError);
    } else {
      profilesById = Object.fromEntries(
        (profilesData ?? []).map((profile) => [profile.id, profile]),
      );
    }
  }

  const repliedMessagesById = Object.fromEntries(
    repliedMessages.map((message) => [
      message.id,
      {
        ...message,
        user: profilesById[message.user_id] ?? message.user ?? null,
      },
    ]),
  );

  return messages.map((message) => ({
    ...message,
    user: profilesById[message.user_id] ?? message.user ?? null,
    reply_to_message:
      repliedMessagesById[message.reply_to_message_id] ??
      message.reply_to_message ??
      null,
  }));
}

export function ActiveSessionCityChatFloatingButton() {
  const [session, setSession] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [cityChatVisible, setCityChatVisible] = useState(false);
  const [driversModalVisible, setDriversModalVisible] = useState(false);
  const [municipalityModalVisible, setMunicipalityModalVisible] = useState(false);
  const [municipalitySearch, setMunicipalitySearch] = useState('');
  const [municipalities, setMunicipalities] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [onlineDrivers, setOnlineDrivers] = useState<any[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [loadingContext, setLoadingContext] = useState(false);
  const [selectedCityMessage, setSelectedCityMessage] = useState<any>(null);
  const [replyingCityMessage, setReplyingCityMessage] = useState<any>(null);
  const [sendingAudio, setSendingAudio] = useState(false);
  const [playingAudioMessageId, setPlayingAudioMessageId] = useState('');

  const audioRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    directory: 'document',
  } as any);
  const recorderState = useAudioRecorderState(audioRecorder, 250);
  const audioPlayersRef = useRef<Record<string, any>>({});
  const audioPlaybackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const initialPosition = useMemo(() => getInitialPosition(), []);
  const position = useRef(new Animated.ValueXY(initialPosition)).current;
  const positionRef = useRef(initialPosition);
  const dragStartRef = useRef(initialPosition);
  const chatSheetTranslateY = useRef(new Animated.Value(0)).current;
  const chatScrollRef = useRef<ScrollView | null>(null);
  const cityMessageLayoutYRef = useRef<Record<string, number>>({});
  const pendingInitialChatScrollRef = useRef<{
    type: 'bottom' | 'unread';
    messageId?: string;
    attempts: number;
  } | null>(null);
  const [initialUnreadMessageCount, setInitialUnreadMessageCount] = useState(0);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState('');
  const [showUnreadMessagesBanner, setShowUnreadMessagesBanner] =
    useState(false);
  const [runningTimeNow, setRunningTimeNow] = useState(Date.now());

  const visibleOnlineDrivers = onlineDrivers.filter(
    (item) => getDriverUserId(item) !== currentUserId,
  );

  async function enrichOnlineDriversWithProfilesAndSessions(drivers: any[]) {
    const safeDrivers = drivers ?? [];
    const userIds = Array.from(
      new Set(safeDrivers.map((driver) => getDriverUserId(driver)).filter(Boolean)),
    );

    if (userIds.length === 0) return safeDrivers;

    let profilesById: Record<string, any> = {};
    let activeSessionsByUserId: Record<string, any> = {};

    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, name, avatar_url, photo_url, picture')
        .in('id', userIds);

      if (profilesError) {
        console.log('Erro ao buscar profiles:', profilesError);
      } else {
        profilesById = Object.fromEntries(
          (profilesData ?? []).map((profile) => [profile.id, profile]),
        );
      }
    } catch (error) {
      console.log('Erro inesperado ao buscar profiles:', error);
    }

    try {
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('work_sessions')
        .select('*')
        .in('user_id', userIds)
        .in('status', ['active', 'paused'])
        .order('started_at', { ascending: false });

      if (sessionsError) {
        console.log('Erro ao buscar cronômetro dos usuários:', sessionsError);
      } else {
        (sessionsData ?? []).forEach((workSession) => {
          if (
            workSession?.user_id &&
            !activeSessionsByUserId[workSession.user_id]
          ) {
            activeSessionsByUserId[workSession.user_id] = workSession;
          }
        });
      }
    } catch (error) {
      console.log('Erro inesperado ao buscar cronômetro dos usuários:', error);
    }

    return safeDrivers.map((driver) => {
      const userId = getDriverUserId(driver);
      const profileFromTable = userId ? profilesById[userId] : null;
      const currentProfile = getDriverProfile(driver);
      const sessionFromTable = userId ? activeSessionsByUserId[userId] : null;
      const currentSession = getDriverSession(driver);

      return {
        ...driver,
        user_id: userId ?? driver?.user_id,
        profile: {
          ...(currentProfile ?? {}),
          ...(profileFromTable ?? {}),
        },
        user: {
          ...(currentProfile ?? {}),
          ...(profileFromTable ?? {}),
        },
        active_session: {
          ...(currentSession ?? {}),
          ...(sessionFromTable ?? {}),
        },
        session: {
          ...(currentSession ?? {}),
          ...(sessionFromTable ?? {}),
        },
      };
    });
  }

  async function loadActiveSessionContext() {
    try {
      setLoadingContext(true);

      const response = await getActiveSession();

      setSession(response ?? null);

      if (!response?.municipality_id) {
        setOnlineDrivers([]);
        setUnreadChatCount(0);
        return;
      }

      const [driversResponse, unreadResponse] = await Promise.all([
        getOnlineDriversByMunicipality(response.municipality_id),
        getUnreadCityChatCount(response.municipality_id),
      ]);

      const enrichedDrivers = await enrichOnlineDriversWithProfilesAndSessions(
        driversResponse ?? [],
      );

      setOnlineDrivers(enrichedDrivers);
      setUnreadChatCount(Number(unreadResponse ?? 0));

      if (cityChatVisible) {
        await loadCityChatMessagesForSession(response, true);
      }
    } catch (error) {
      console.log('Erro ao carregar botão global do chat da cidade:', error);
    } finally {
      setLoadingContext(false);
    }
  }

  async function loadCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUserId(user?.id ?? '');
  }

  async function handleSearchMunicipalities(text: string) {
    setMunicipalitySearch(text);

    if (text.trim().length < 2) {
      setMunicipalities([]);
      return;
    }

    const response = await searchMunicipalities(text);

    setMunicipalities(response ?? []);
  }

  async function handleChangeMunicipality(municipality: any) {
    if (!session?.id || !municipality?.id) return;

    try {
      const updatedSession = await updateSessionMunicipality(
        session.id,
        municipality.id,
      );

      setSession(updatedSession);
      setMunicipalityModalVisible(false);
      setMunicipalitySearch('');
      setMunicipalities([]);
      setChatMessages([]);
      setUnreadChatCount(0);

      await loadActiveSessionContext();

      const driversResponse = await getOnlineDriversByMunicipality(municipality.id);
      const enrichedDrivers = await enrichOnlineDriversWithProfilesAndSessions(
        driversResponse ?? [],
      );

      setOnlineDrivers(enrichedDrivers);

      if (updatedSession?.municipality_id) {
        await loadCityChatMessagesForSession(updatedSession, true);
      }

      setTimeout(() => {
        setCityChatVisible(true);
      }, Platform.OS === 'ios' ? 420 : 220);
    } catch (error: any) {
      console.log('Erro ao alterar cidade do chat:', error);
      Alert.alert(
        'Erro',
        error?.message ?? 'Não foi possível alterar a cidade.',
      );
    }
  }

  async function loadOnlineDrivers() {
    if (!session?.municipality_id) return;

    const response = await getOnlineDriversByMunicipality(session.municipality_id);
    const enrichedDrivers = await enrichOnlineDriversWithProfilesAndSessions(
      response ?? [],
    );

    setOnlineDrivers(enrichedDrivers);
  }

  async function loadUnreadCityChat() {
    if (!session?.municipality_id) return;

    const unread = await getUnreadCityChatCount(session.municipality_id);

    setUnreadChatCount(Number(unread ?? 0));
  }

  function prepareInitialCityChatScroll(messages: any[], unreadCount: number) {
    const safeUnreadCount = Math.min(
      Math.max(Number(unreadCount ?? 0), 0),
      messages.length,
    );
    const firstUnreadId = getFirstUnreadMessageId(messages, safeUnreadCount);

    cityMessageLayoutYRef.current = {};
    setInitialUnreadMessageCount(safeUnreadCount);
    setFirstUnreadMessageId(firstUnreadId);
    setShowUnreadMessagesBanner(safeUnreadCount > 0);

    pendingInitialChatScrollRef.current = firstUnreadId
      ? {
          type: 'unread',
          messageId: String(firstUnreadId),
          attempts: 0,
        }
      : {
          type: 'bottom',
          attempts: 0,
        };
  }

  function executePendingInitialCityChatScroll() {
    const pendingScroll = pendingInitialChatScrollRef.current;

    if (!pendingScroll || !chatScrollRef.current) return;

    if (pendingScroll.type === 'bottom') {
      chatScrollRef.current.scrollToEnd({ animated: false });
      pendingInitialChatScrollRef.current = null;
      return;
    }

    const targetY =
      cityMessageLayoutYRef.current[String(pendingScroll.messageId ?? '')];

    if (typeof targetY === 'number') {
      chatScrollRef.current.scrollTo({
        y: Math.max(targetY - 12, 0),
        animated: false,
      });
      pendingInitialChatScrollRef.current = null;
      return;
    }

    if (pendingScroll.attempts >= 8) {
      chatScrollRef.current.scrollToEnd({ animated: false });
      pendingInitialChatScrollRef.current = null;
      return;
    }

    pendingInitialChatScrollRef.current = {
      ...pendingScroll,
      attempts: pendingScroll.attempts + 1,
    };

    setTimeout(executePendingInitialCityChatScroll, 80);
  }

  function handleCityMessageLayout(messageId: any, y: number) {
    if (!messageId) return;

    cityMessageLayoutYRef.current[String(messageId)] = y;

    const pendingScroll = pendingInitialChatScrollRef.current;

    if (
      pendingScroll?.type === 'unread' &&
      String(pendingScroll.messageId) === String(messageId)
    ) {
      setTimeout(executePendingInitialCityChatScroll, 60);
    }
  }

  function handleCityMessagesContentSizeChange() {
    setTimeout(executePendingInitialCityChatScroll, 80);
  }

  function scrollCityChatToBottom(animated = true) {
    chatScrollRef.current?.scrollToEnd({ animated });
    pendingInitialChatScrollRef.current = null;
    setShowUnreadMessagesBanner(false);
  }

  function handleCityChatScroll(event: any) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);

    if (distanceFromBottom <= 42) {
      setShowUnreadMessagesBanner(false);
    }
  }

  async function loadCityChatMessagesForSession(
    activeSession: any,
    markAsRead = false,
  ) {
    if (!activeSession?.municipality_id) return;

    const unreadBeforeMark = markAsRead
      ? await getUnreadCityChatCountSafe(activeSession.municipality_id)
      : 0;

    try {
      const messages = await getCityChatMessagesFromJourneyWindow({
        municipalityId: activeSession.municipality_id,
        activeSession,
      });

      setChatMessages(messages);

      if (markAsRead) {
        prepareInitialCityChatScroll(messages, unreadBeforeMark);
        await markCityChatAsRead(activeSession.municipality_id);
        setUnreadChatCount(0);
        return;
      }

      await loadUnreadCityChat();
    } catch (error) {
      console.log(
        'Erro ao buscar mensagens pela janela da jornada. Usando fallback:',
        error,
      );

      const response = await getCityChatMessages(activeSession.municipality_id);
      const filteredMessages = filterMessagesFromJourneyChatStart(
        response ?? [],
        activeSession,
      );

      setChatMessages(filteredMessages);

      if (markAsRead) {
        prepareInitialCityChatScroll(filteredMessages, unreadBeforeMark);
        await markCityChatAsRead(activeSession.municipality_id);
        setUnreadChatCount(0);
        return;
      }

      await loadUnreadCityChat();
    }
  }

  async function loadCityChat(markAsRead = false) {
    if (!session?.municipality_id) return;

    await loadCityChatMessagesForSession(session, markAsRead);
  }

  async function openCityChat() {
    if (!session) {
      return;
    }

    if (!session?.municipality_id) {
      Alert.alert(
        'Cidade não definida',
        'Defina uma cidade na jornada ativa para usar o chat da cidade.',
      );
      return;
    }

    const freshSession = await getActiveSession();

    if (freshSession) {
      setSession(freshSession);
      setCityChatVisible(true);

      if (freshSession?.municipality_id) {
        const driversResponse = await getOnlineDriversByMunicipality(
          freshSession.municipality_id,
        );

        const enrichedDrivers = await enrichOnlineDriversWithProfilesAndSessions(
          driversResponse ?? [],
        );

        setOnlineDrivers(enrichedDrivers);
      }

      await loadCityChatMessagesForSession(freshSession, true);
      return;
    }

    setCityChatVisible(true);
    await loadOnlineDrivers();
    await loadCityChat(true);
  }

  // iOS pode travar quando um Modal é aberto por cima de outro Modal.
  // Por isso fechamos o chat antes de abrir "Rodando agora" ou "Alterar cidade".
  function openDriversModalFromChat() {
    setCityChatVisible(false);

    setTimeout(() => {
      setDriversModalVisible(true);
    }, Platform.OS === 'ios' ? 420 : 220);
  }

  function openMunicipalityModalFromChat() {
    setCityChatVisible(false);

    setTimeout(() => {
      setMunicipalityModalVisible(true);
    }, Platform.OS === 'ios' ? 420 : 220);
  }

  function closeDriversModalAndReturnToChat() {
    setDriversModalVisible(false);

    setTimeout(() => {
      setCityChatVisible(true);
    }, Platform.OS === 'ios' ? 420 : 220);
  }

  function closeMunicipalityModalAndReturnToChat() {
    setMunicipalityModalVisible(false);

    setTimeout(() => {
      setCityChatVisible(true);
    }, Platform.OS === 'ios' ? 420 : 220);
  }

  function closeCityMessageActions() {
    setSelectedCityMessage(null);
  }

  function openCityMessageActions(message: any) {
    setSelectedCityMessage(message);
  }

  function getCityMessageAuthorName(message: any) {
    if (!message) return 'Mensagem';

    const isMe = message.user_id === currentUserId;

    if (isMe) return 'Você';

    return getUserDisplayName(message.user);
  }

  function getCityMessageReply(message: any) {
    if (!message) return null;

    const directReply =
      message.reply_to_message ||
      message.replyToMessage ||
      message.replied_message ||
      message.parent_message ||
      null;

    if (directReply) return directReply;

    const replyId =
      message.reply_to_message_id ||
      message.replyToMessageId ||
      message.reply_id ||
      null;

    if (!replyId) return null;

    return chatMessages.find((chatItem) => chatItem.id === replyId) ?? null;
  }

  function getCityMessageReplyAuthorName(message: any) {
    const repliedMessage = getCityMessageReply(message);

    if (!repliedMessage) return '';

    if (repliedMessage.user_id === currentUserId) return 'Você';

    return getUserDisplayName(repliedMessage.user);
  }

  function isAudioMessage(message: any) {
    return message?.type === 'audio' || Boolean(message?.audio_url);
  }

  function getMessageTextPreview(message: any) {
    if (!message) return '';

    if (isAudioMessage(message)) return 'Áudio';

    return message?.message ?? '';
  }

  function getCityMessageReplyText(message: any) {
    const repliedMessage = getCityMessageReply(message);

    return getMessageTextPreview(repliedMessage);
  }

  function formatAudioDuration(totalSeconds?: number | null) {
    const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds ?? 0)));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function getAudioDurationFromRecorder() {
    const durationFromState = Math.round(
      Number(recorderState?.durationMillis ?? 0) / 1000,
    );

    const durationFromRecorder = Math.round(Number(audioRecorder.currentTime ?? 0));

    return Math.max(1, durationFromState || durationFromRecorder || 1);
  }

  function handleReplyCityMessage(message: any) {
    setReplyingCityMessage(message);
    setSelectedCityMessage(null);
  }

  function handleOpenPrivateChatFromCityMessage(message: any) {
    const userId = message?.user_id ?? message?.user?.id;

    if (!userId || userId === currentUserId) return;

    setSelectedCityMessage(null);
    setCityChatVisible(false);

    setTimeout(() => {
      router.push({
        pathname: '/conversa-privada/[userId]',
        params: { userId },
      } as never);
    }, Platform.OS === 'ios' ? 420 : 220);
  }

  function handleOpenProfileFromCityMessage(message: any) {
    const userId = message?.user_id ?? message?.user?.id;

    if (!userId || userId === currentUserId) return;

    setSelectedCityMessage(null);
    setCityChatVisible(false);

    setTimeout(() => {
      router.push({
        pathname: '/perfil-publico/[userId]',
        params: { userId },
      } as never);
    }, Platform.OS === 'ios' ? 420 : 220);
  }

  function resetChatSheetPosition() {
    Animated.spring(chatSheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 70,
    }).start();
  }

  function closeCityChatByDrag() {
    const { height } = Dimensions.get('window');

    Animated.timing(chatSheetTranslateY, {
      toValue: height,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      chatSheetTranslateY.setValue(0);
      setSelectedCityMessage(null);
      setShowUnreadMessagesBanner(false);
      pendingInitialChatScrollRef.current = null;
      setCityChatVisible(false);
    });
  }

  async function ensureAudioPermission() {
    const status = await AudioModule.requestRecordingPermissionsAsync();

    if (!status.granted) {
      Alert.alert(
        'Permissão necessária',
        'Permita o acesso ao microfone para enviar mensagens de áudio.',
      );
      return false;
    }

    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
    });

    return true;
  }

  async function handleStartAudioRecording() {
    if (sendingAudio || recorderState?.isRecording) return;

    try {
      const canRecord = await ensureAudioPermission();

      if (!canRecord) return;

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (error: any) {
      console.log('Erro ao iniciar gravação de áudio:', error);
      Alert.alert(
        'Erro',
        error?.message ?? 'Não foi possível iniciar a gravação.',
      );
    }
  }

  async function handleCancelAudioRecording() {
    try {
      if (recorderState?.isRecording) {
        await audioRecorder.stop();
      }
    } catch (error) {
      console.log('Erro ao cancelar áudio:', error);
    } finally {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
    }
  }

  async function uploadCityAudioMessage({
    audioUri,
    durationSeconds,
  }: {
    audioUri: string;
    durationSeconds: number;
  }) {
    if (!session?.municipality_id) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id ?? currentUserId;

    if (!userId) {
      Alert.alert('Erro', 'Não foi possível identificar o usuário.');
      return;
    }

    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.m4a`;
    const filePath = `${session.municipality_id}/${userId}/${fileName}`;

    const audioArrayBuffer = await getAudioArrayBufferFromUri(audioUri);

    const { error: uploadError } = await supabase.storage
      .from('city-chat-audios')
      .upload(filePath, audioArrayBuffer, {
        contentType: 'audio/mp4',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicAudio } = supabase.storage
      .from('city-chat-audios')
      .getPublicUrl(filePath);

    const audioUrl = publicAudio?.publicUrl;

    if (!audioUrl) {
      throw new Error('Não foi possível gerar a URL pública do áudio.');
    }

    const { error: insertError } = await supabase
      .from('city_chat_messages')
      .insert({
        municipality_id: session.municipality_id,
        user_id: userId,
        message: '',
        type: 'audio',
        audio_url: audioUrl,
        audio_duration_seconds: durationSeconds,
        reply_to_message_id: replyingCityMessage?.id ?? null,
      });

    if (insertError) throw insertError;

    setReplyingCityMessage(null);
    await loadCityChat(true);
  }

  async function handleStopAudioRecordingAndSend() {
    if (!recorderState?.isRecording || sendingAudio) return;

    try {
      setSendingAudio(true);

      const durationSeconds = getAudioDurationFromRecorder();

      await audioRecorder.stop();

      const audioUri = audioRecorder.uri;

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });

      if (!audioUri) {
        Alert.alert('Erro', 'Não foi possível encontrar o áudio gravado.');
        return;
      }

      await uploadCityAudioMessage({
        audioUri,
        durationSeconds,
      });
    } catch (error: any) {
      console.log('Erro ao enviar áudio:', error);
      Alert.alert('Erro', error?.message ?? 'Não foi possível enviar o áudio.');
    } finally {
      setSendingAudio(false);
    }
  }

  function clearAudioPlaybackTimeout() {
    if (audioPlaybackTimeoutRef.current) {
      clearTimeout(audioPlaybackTimeoutRef.current);
      audioPlaybackTimeoutRef.current = null;
    }
  }

  function stopCurrentAudioPlayback() {
    clearAudioPlaybackTimeout();

    if (playingAudioMessageId) {
      const currentPlayer = audioPlayersRef.current[playingAudioMessageId];

      currentPlayer?.pause?.();
    }

    setPlayingAudioMessageId('');
  }

  async function handleToggleCityAudioMessage(message: any) {
    const audioUrl = message?.audio_url;

    if (!message?.id || !audioUrl) return;

    if (playingAudioMessageId === message.id) {
      stopCurrentAudioPlayback();
      return;
    }

    stopCurrentAudioPlayback();

    try {
      let player = audioPlayersRef.current[message.id];

      if (!player) {
        player = createAudioPlayer(audioUrl);
        audioPlayersRef.current[message.id] = player;
      } else {
        player.seekTo?.(0);
      }

      setPlayingAudioMessageId(message.id);
      player.play();

      const durationSeconds = Number(message.audio_duration_seconds ?? 0);

      if (durationSeconds > 0) {
        audioPlaybackTimeoutRef.current = setTimeout(() => {
          setPlayingAudioMessageId('');
        }, durationSeconds * 1000 + 600);
      }
    } catch (error: any) {
      console.log('Erro ao reproduzir áudio:', error);
      Alert.alert(
        'Erro',
        error?.message ?? 'Não foi possível reproduzir o áudio.',
      );
      setPlayingAudioMessageId('');
    }
  }

  async function handleSendCityMessage() {
    if (!chatMessage.trim() || !session?.municipality_id) return;

    const messageToSend = chatMessage.trim();

    setChatMessage('');

    await sendCityChatMessage({
      municipalityId: session.municipality_id,
      message: messageToSend,
      replyToMessageId: replyingCityMessage?.id ?? null,
    });

    setReplyingCityMessage(null);

    await loadCityChat(true);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,

      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,

      onPanResponderGrant: () => {
        dragStartRef.current = positionRef.current;
      },

      onPanResponderMove: (_, gestureState) => {
        const nextPosition = {
          x: dragStartRef.current.x + gestureState.dx,
          y: dragStartRef.current.y + gestureState.dy,
        };

        positionRef.current = nextPosition;
        position.setValue(nextPosition);
      },

      onPanResponderRelease: () => {
        const { width, height } = Dimensions.get('window');

        const clampedPosition = {
          x: clamp(positionRef.current.x, 10, width - BUTTON_SIZE - 10),
          y: clamp(positionRef.current.y, 72, height - BUTTON_SIZE - 90),
        };

        positionRef.current = clampedPosition;

        Animated.spring(position, {
          toValue: clampedPosition,
          useNativeDriver: false,
          friction: 7,
          tension: 55,
        }).start();
      },
    }),
  ).current;

  const chatSheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,

      onStartShouldSetPanResponderCapture: () => true,

      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 2 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx),

      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        gestureState.dy > 2 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx),

      onPanResponderMove: (_, gestureState) => {
        const nextTranslateY = Math.max(gestureState.dy, 0);

        chatSheetTranslateY.setValue(nextTranslateY);
      },

      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 75 || gestureState.vy > 0.75) {
          closeCityChatByDrag();
          return;
        }

        resetChatSheetPosition();
      },

      onPanResponderTerminate: resetChatSheetPosition,

      onShouldBlockNativeResponder: () => true,
    }),
  ).current;

  useEffect(() => {
    loadCurrentUser();
    loadActiveSessionContext();

    const interval = setInterval(loadActiveSessionContext, 8000);

    const activeSessionRefreshSubscription = supabase
      .channel('global-city-chat-active-session-refresh')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_sessions',
        },
        loadActiveSessionContext,
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(activeSessionRefreshSubscription);
    };
  }, []);

  useEffect(() => {
    if (!session?.municipality_id) return;

    const chatChannel = supabase
      .channel(`global-city-chat-${session.municipality_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'city_chat_messages',
          filter: `municipality_id=eq.${session.municipality_id}`,
        },
        async () => {
          if (cityChatVisible) {
            await loadCityChat(true);
          } else {
            await loadUnreadCityChat();
          }
        },
      )
      .subscribe();

    const driversChannel = supabase
      .channel(`global-city-drivers-${session.municipality_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_sessions',
        },
        loadOnlineDrivers,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(driversChannel);
    };
  }, [session?.municipality_id, session?.started_at, cityChatVisible]);

  useEffect(() => {
    if (session?.municipality_id) {
      loadOnlineDrivers();
      loadUnreadCityChat();
    }
  }, [session?.municipality_id, currentUserId]);

  useEffect(() => {
    if (!driversModalVisible) return;

    setRunningTimeNow(Date.now());

    const intervalId = setInterval(() => {
      setRunningTimeNow(Date.now());
    }, 60 * 1000);

    return () => clearInterval(intervalId);
  }, [driversModalVisible]);

  useEffect(() => {
    return () => {
      clearAudioPlaybackTimeout();

      Object.values(audioPlayersRef.current).forEach((player: any) => {
        player?.remove?.();
      });

      audioPlayersRef.current = {};
    };
  }, []);

  if (!session) return null;

  return (
    <>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.floatingButtonWrapper,
          {
            transform: position.getTranslateTransform(),
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={0.86}
          style={[
            styles.floatingButton,
            loadingContext && styles.floatingButtonLoading,
          ]}
          onPress={openCityChat}
        >
          <Ionicons name="chatbubbles-outline" size={28} color="#FFFFFF" />

          {unreadChatCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadChatCount > 99 ? '99+' : unreadChatCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </Animated.View>

      <Modal
        visible={cityChatVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCityChatVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'height' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.chatOverlay}>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.chatBackdrop}
              onPress={() => setCityChatVisible(false)}
            />

            <Animated.View
              style={[
                styles.chatSheet,
                {
                  transform: [{ translateY: chatSheetTranslateY }],
                },
              ]}
            >
              <View
                style={styles.dragCloseArea}
                {...chatSheetPanResponder.panHandlers}
              >
                <View style={styles.sheetHandle} />
              </View>

              <View style={styles.chatHeader}>
                <View style={styles.chatHeaderIcon}>
                  <Ionicons name="chatbubbles-outline" size={24} color="#60A5FA" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.chatEyebrow}>Comunidade local</Text>
                  <Text style={styles.chatTitle}>Chat da cidade</Text>
                  <Text style={styles.chatSubtitle} numberOfLines={1}>
                    {session?.municipality
                      ? `${session.municipality.name} - ${session.municipality.uf}`
                      : 'Cidade da jornada'}
                  </Text>
                  
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.closeButton}
                  onPress={() => setCityChatVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.chatQuickBar}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.runningMiniButton}
                  onPress={openDriversModalFromChat}
                >
                  <View style={styles.runningMiniDot} />
                  <Ionicons name="radio-outline" size={15} color="#86EFAC" />
                  <Text style={styles.runningMiniText}>
                    {visibleOnlineDrivers.length} rodando
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.changeCityMiniButton}
                  onPress={openMunicipalityModalFromChat}
                >
                  <Ionicons name="location-outline" size={15} color="#BBF7D0" />
                  <Text style={styles.changeCityMiniText}>Cidade</Text>
                </TouchableOpacity>
              </View>

              {showUnreadMessagesBanner && initialUnreadMessageCount > 0 ? (
                <View style={styles.unreadFloatingBanner}>
                  <View style={styles.unreadFloatingTextBox}>
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={15}
                      color="#BFDBFE"
                    />
                    <Text style={styles.unreadFloatingText}>
                      {initialUnreadMessageCount}{' '}
                      {initialUnreadMessageCount === 1
                        ? 'mensagem não visualizada'
                        : 'mensagens não visualizadas'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.86}
                    style={styles.unreadDownButton}
                    onPress={() => scrollCityChatToBottom(true)}
                  >
                    <Ionicons name="arrow-down" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : null}

              <ScrollView
                ref={chatScrollRef}
                style={styles.messagesList}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={16}
                onScroll={handleCityChatScroll}
                onContentSizeChange={handleCityMessagesContentSizeChange}
              >
                {chatMessages.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <View style={styles.emptyIcon}>
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={32}
                        color="#71717A"
                      />
                    </View>

                    <Text style={styles.emptyTitle}>Nenhuma mensagem ainda</Text>
                    <Text style={styles.emptyText}>
                      Envie a primeira mensagem para os motoristas da cidade.
                    </Text>
                  </View>
                ) : (
                  chatMessages.map((item) => {
                    const isMe = item.user_id === currentUserId;
                    const avatarUrl = getUserAvatarUrl(item.user);
                    const displayName = getUserDisplayName(item.user);
                    const isFirstUnreadMessage =
                      firstUnreadMessageId &&
                      String(item.id) === String(firstUnreadMessageId);

                    return (
                      <View
                        key={item.id}
                        onLayout={(event) =>
                          handleCityMessageLayout(
                            item.id,
                            event.nativeEvent.layout.y,
                          )
                        }
                      >
                        {isFirstUnreadMessage ? (
                          <View style={styles.unreadDivider}>
                            <View style={styles.unreadDividerLine} />
                            <View style={styles.unreadDividerPill}>
                              <Text style={styles.unreadDividerText}>
                                {initialUnreadMessageCount}{' '}
                                {initialUnreadMessageCount === 1
                                  ? 'mensagem não visualizada'
                                  : 'mensagens não visualizadas'}
                              </Text>
                            </View>
                            <View style={styles.unreadDividerLine} />
                          </View>
                        ) : null}

                        <View
                          style={[
                            styles.messageRow,
                            isMe && styles.messageRowMe,
                          ]}
                        >
                        {!isMe ? (
                          avatarUrl ? (
                            <Image
                              source={{ uri: avatarUrl }}
                              style={styles.avatar}
                            />
                          ) : (
                            <View style={styles.avatarFallback}>
                              <Text style={styles.avatarFallbackText}>
                                {displayName.slice(0, 1).toUpperCase()}
                              </Text>
                            </View>
                          )
                        ) : null}

                        <TouchableOpacity
                          activeOpacity={0.88}
                          style={[
                            styles.messageBubble,
                            isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
                          ]}
                          onLongPress={() => openCityMessageActions(item)}
                          delayLongPress={350}
                        >
                          {!isMe ? (
                            <Text style={styles.messageUserName} numberOfLines={1}>
                              {displayName}
                            </Text>
                          ) : null}

                          {getCityMessageReply(item) ? (
                            <View
                              style={[
                                styles.messageReplyBox,
                                isMe && styles.messageReplyBoxMe,
                              ]}
                            >
                              <View
                                style={[
                                  styles.messageReplyLine,
                                  isMe && styles.messageReplyLineMe,
                                ]}
                              />

                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text
                                  style={[
                                    styles.messageReplyAuthor,
                                    isMe && styles.messageReplyAuthorMe,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {getCityMessageReplyAuthorName(item)}
                                </Text>

                                <Text
                                  style={[
                                    styles.messageReplyText,
                                    isMe && styles.messageReplyTextMe,
                                  ]}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {getCityMessageReplyText(item)}
                                </Text>
                              </View>
                            </View>
                          ) : null}

                          {isAudioMessage(item) ? (
                            <View style={styles.audioMessageLine}>
                              <TouchableOpacity
                                activeOpacity={0.88}
                                style={[
                                  styles.audioPlayButton,
                                  isMe && styles.audioPlayButtonMe,
                                ]}
                                onPress={() => handleToggleCityAudioMessage(item)}
                              >
                                <Ionicons
                                  name={
                                    playingAudioMessageId === item.id
                                      ? 'pause'
                                      : 'play'
                                  }
                                  size={18}
                                  color="#FFFFFF"
                                />
                              </TouchableOpacity>

                              <View style={styles.audioWave}>
                                <View style={styles.audioWaveSmall} />
                                <View style={styles.audioWaveMedium} />
                                <View style={styles.audioWaveLarge} />
                                <View style={styles.audioWaveMedium} />
                                <View style={styles.audioWaveSmall} />
                              </View>

                              <Text
                                style={[
                                  styles.audioDuration,
                                  isMe && styles.audioDurationMe,
                                ]}
                              >
                                {formatAudioDuration(item.audio_duration_seconds)}
                              </Text>

                              <Text
                                style={[
                                  styles.messageRightHour,
                                  isMe && styles.messageRightHourMe,
                                ]}
                              >
                                {new Date(item.created_at).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.messageTextLine}>
                              <Text
                                style={[
                                  styles.messageText,
                                  isMe && styles.messageTextMe,
                                ]}
                              >
                                {item.message}
                              </Text>

                              <Text
                                style={[
                                  styles.messageRightHour,
                                  isMe && styles.messageRightHourMe,
                                ]}
                              >
                                {new Date(item.created_at).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {replyingCityMessage ? (
                <View style={styles.replyPreviewBox}>
                  <View style={styles.replyPreviewLine} />

                  <View style={{ flex: 1 }}>
                    <Text style={styles.replyPreviewLabel}>
                      Respondendo {getCityMessageAuthorName(replyingCityMessage)}
                    </Text>
                    <Text style={styles.replyPreviewText} numberOfLines={1}>
                      {getMessageTextPreview(replyingCityMessage)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.replyPreviewClose}
                    onPress={() => setReplyingCityMessage(null)}
                  >
                    <Ionicons name="close" size={18} color="#A1A1AA" />
                  </TouchableOpacity>
                </View>
              ) : null}

              {recorderState?.isRecording || sendingAudio ? (
                <View style={styles.recordingBar}>
                  <View style={styles.recordingPulse}>
                    <Ionicons name="mic" size={19} color="#FFFFFF" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordingTitle}>
                      {sendingAudio ? 'Enviando áudio...' : 'Gravando áudio'}
                    </Text>
                    <Text style={styles.recordingTimer}>
                      {formatAudioDuration(
                        sendingAudio
                          ? getAudioDurationFromRecorder()
                          : Number(recorderState?.durationMillis ?? 0) / 1000,
                      )}
                    </Text>
                  </View>

                  {!sendingAudio ? (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.cancelAudioButton}
                      onPress={handleCancelAudioRecording}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FCA5A5" />
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={sendingAudio}
                    style={[
                      styles.sendAudioButton,
                      sendingAudio && styles.sendAudioButtonDisabled,
                    ]}
                    onPress={handleStopAudioRecordingAndSend}
                  >
                    <Ionicons name="send" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.inputBar}>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="chatbubble-outline" size={19} color="#71717A" />

                    <TextInput
                      value={chatMessage}
                      onChangeText={setChatMessage}
                      placeholder="Mensagem para a cidade..."
                      placeholderTextColor="#71717A"
                      style={styles.input}
                      multiline
                    />
                  </View>

                  {chatMessage.trim() ? (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.sendButton}
                      onPress={handleSendCityMessage}
                    >
                      <Ionicons name="send" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.micButton}
                      onPress={handleStartAudioRecording}
                    >
                      <Ionicons name="mic-outline" size={23} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {selectedCityMessage ? (
                <View style={styles.messageActionsLayer}>
                  <Pressable
                    style={styles.messageActionsBackdrop}
                    onPress={closeCityMessageActions}
                  />

                  <View style={styles.messageActionsCard}>
                    <View style={styles.messageActionsHandle} />

                    <Text style={styles.messageActionsEyebrow}>
                      Mensagem selecionada
                    </Text>

                    <Text style={styles.messageActionsTitle} numberOfLines={1}>
                      {getCityMessageAuthorName(selectedCityMessage)}
                    </Text>

                    <Text style={styles.messageActionsPreview} numberOfLines={2}>
                      {selectedCityMessage.message}
                    </Text>

                    {selectedCityMessage.user_id !== currentUserId ? (
                      <TouchableOpacity
                        activeOpacity={0.88}
                        style={styles.messageActionOption}
                        onPress={() =>
                          handleOpenProfileFromCityMessage(selectedCityMessage)
                        }
                      >
                        <View style={styles.messageActionIconPurple}>
                          <Ionicons
                            name="person-circle-outline"
                            size={21}
                            color="#DDD6FE"
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.messageActionTitle}>
                            Ver perfil
                          </Text>
                          <Text style={styles.messageActionSubtitle}>
                            Abrir o perfil público deste motorista
                          </Text>
                        </View>

                        <Ionicons name="chevron-forward" size={19} color="#71717A" />
                      </TouchableOpacity>
                    ) : null}

                    {selectedCityMessage.user_id !== currentUserId ? (
                      <TouchableOpacity
                        activeOpacity={0.88}
                        style={styles.messageActionOption}
                        onPress={() =>
                          handleOpenPrivateChatFromCityMessage(selectedCityMessage)
                        }
                      >
                        <View style={styles.messageActionIconBlue}>
                          <Ionicons
                            name="chatbubble-ellipses-outline"
                            size={20}
                            color="#BFDBFE"
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.messageActionTitle}>
                            Enviar mensagem privada
                          </Text>
                          <Text style={styles.messageActionSubtitle}>
                            Abrir conversa particular com este motorista
                          </Text>
                        </View>

                        <Ionicons name="chevron-forward" size={19} color="#71717A" />
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      activeOpacity={0.88}
                      style={styles.messageActionOption}
                      onPress={() => handleReplyCityMessage(selectedCityMessage)}
                    >
                      <View style={styles.messageActionIconGreen}>
                        <Ionicons name="return-up-back-outline" size={20} color="#BBF7D0" />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.messageActionTitle}>
                          Responder
                        </Text>
                        <Text style={styles.messageActionSubtitle}>
                          Responder esta mensagem no chat da cidade
                        </Text>
                      </View>

                      <Ionicons name="chevron-forward" size={19} color="#71717A" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={municipalityModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeMunicipalityModalAndReturnToChat}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.municipalityOverlay}>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.driversBackdrop}
              onPress={closeMunicipalityModalAndReturnToChat}
            />

            <View style={styles.municipalitySheet}>
              <View style={styles.sheetHandle} />

              <View style={styles.driversHeader}>
                <View style={styles.municipalityHeaderIcon}>
                  <Ionicons name="location-outline" size={24} color="#22C55E" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.chatEyebrow}>Cidade da jornada</Text>
                  <Text style={styles.chatTitle}>Alterar cidade</Text>
                  <Text style={styles.chatSubtitle}>
                    Escolha onde você está rodando agora
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.closeButton}
                  onPress={closeMunicipalityModalAndReturnToChat}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.municipalitySearchBox}>
                <Ionicons name="search-outline" size={20} color="#71717A" />

                <TextInput
                  value={municipalitySearch}
                  onChangeText={handleSearchMunicipalities}
                  placeholder="Buscar cidade..."
                  placeholderTextColor="#71717A"
                  style={styles.municipalitySearchInput}
                  autoCapitalize="words"
                />
              </View>

              <ScrollView
                style={styles.municipalityList}
                contentContainerStyle={styles.municipalityListContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {municipalities.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="map-outline" size={32} color="#71717A" />
                    </View>

                    <Text style={styles.emptyTitle}>
                      Busque uma cidade
                    </Text>
                    <Text style={styles.emptyText}>
                      Digite pelo menos 2 letras para encontrar sua cidade.
                    </Text>
                  </View>
                ) : (
                  municipalities.map((municipality) => {
                    const selected =
                      municipality.id === session?.municipality_id;

                    return (
                      <TouchableOpacity
                        key={municipality.id}
                        activeOpacity={0.88}
                        style={[
                          styles.municipalityItem,
                          selected && styles.municipalityItemSelected,
                        ]}
                        onPress={() => handleChangeMunicipality(municipality)}
                      >
                        <View style={styles.municipalityItemIcon}>
                          <Ionicons
                            name={selected ? 'checkmark-circle' : 'location-outline'}
                            size={21}
                            color={selected ? '#22C55E' : '#A1A1AA'}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.municipalityItemName}>
                            {municipality.name}
                          </Text>
                          <Text style={styles.municipalityItemUf}>
                            {municipality.uf}
                          </Text>
                        </View>

                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color="#52525B"
                        />
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={driversModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeDriversModalAndReturnToChat}
      >
        <View style={styles.driversOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.driversBackdrop}
            onPress={closeDriversModalAndReturnToChat}
          />

          <View style={styles.driversSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.driversHeader}>
              <View style={styles.driversHeaderIcon}>
                <Ionicons name="radio-outline" size={24} color="#22C55E" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.chatEyebrow}>Comunidade local</Text>
                <Text style={styles.chatTitle}>Rodando agora</Text>
                <Text style={styles.chatSubtitle} numberOfLines={1}>
                  {visibleOnlineDrivers.length}{' '}
                  {visibleOnlineDrivers.length === 1
                    ? 'motorista encontrado'
                    : 'motoristas encontrados'}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.closeButton}
                onPress={closeDriversModalAndReturnToChat}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.driversList}
              contentContainerStyle={styles.driversListContent}
              showsVerticalScrollIndicator={false}
            >
              {visibleOnlineDrivers.length === 0 ? (
                <View style={styles.emptyBox}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="car-sport-outline" size={32} color="#71717A" />
                  </View>

                  <Text style={styles.emptyTitle}>Ninguém rodando agora</Text>
                  <Text style={styles.emptyText}>
                    Quando outros motoristas iniciarem uma jornada nesta cidade,
                    eles aparecerão aqui.
                  </Text>
                </View>
              ) : (
                visibleOnlineDrivers.map((item) => {
                  const user = getDriverProfile(item);
                  const avatarUrl = getUserAvatarUrl(user);
                  const displayName = getUserDisplayName(user);
                  const runningTimeText = formatDriverRunningTime(
                    item,
                    runningTimeNow,
                  );

                  return (
                    <View key={item.id ?? user?.id} style={styles.driverItem}>
                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.driverAvatar} />
                      ) : (
                        <View style={styles.driverAvatarFallback}>
                          <Text style={styles.driverAvatarFallbackText}>
                            {displayName.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <View style={styles.driverInfo}>
                        <Text style={styles.driverName} numberOfLines={1}>
                          {displayName}
                        </Text>

                      </View>

                      <View style={styles.driverTimeBadge}>
                        <Text style={styles.driverTimeText} numberOfLines={2}>
                          {runningTimeText}
                        </Text>
                      </View>
                    </View>
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
  floatingButtonWrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 9999,
    elevation: 9999,
  },

  floatingButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    borderWidth: 3,
    borderColor: '#0B1220',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 18,
  },

  floatingButtonLoading: {
    opacity: 0.85,
  },

  unreadBadge: {
    position: 'absolute',
    right: -5,
    top: -5,
    minWidth: 23,
    height: 23,
    borderRadius: 999,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },

  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  modalRoot: {
    flex: 1,
  },

  chatOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  chatBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },

  chatSheet: {
    height: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: '#09090B',
    borderWidth: 0,
    borderColor: '#18181B',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
    paddingBottom: Platform.OS === 'ios' ? 8 : 10,
  },

  dragCloseArea: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -15,
    marginTop: -8,
    marginBottom: 2,
  },

  sheetHandle: {
    width: 58,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 9,
  },

  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 8,
  },

  chatHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(37,99,235,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  chatEyebrow: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  chatTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 1,
  },

  chatSubtitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },

  chatWindowHint: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },


  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  chatQuickBar: {
    minHeight: 38,
    borderRadius: 17,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.16)',
    padding: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },

  runningMiniButton: {
    flex: 1,
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.18)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  runningMiniDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },

  runningMiniText: {
    color: '#DCFCE7',
    fontSize: 12,
    fontWeight: '900',
  },

  changeCityMiniButton: {
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.22)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  changeCityMiniText: {
    color: '#DBEAFE',
    fontSize: 12,
    fontWeight: '900',
  },

  unreadFloatingBanner: {
    minHeight: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(37,99,235,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.32)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  unreadFloatingTextBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  unreadFloatingText: {
    color: '#DBEAFE',
    fontSize: 12,
    fontWeight: '900',
  },

  unreadDownButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  unreadDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 2,
  },

  unreadDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(96,165,250,0.25)',
  },

  unreadDividerPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.28)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  unreadDividerText: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '900',
  },

  messagesList: {
    flex: 1,
  },

  messagesContent: {
    paddingTop: 4,
    paddingBottom: 16,
  },

  emptyBox: {
    minHeight: 210,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },

  emptyText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
  },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 10,
  },

  messageRowMe: {
    justifyContent: 'flex-end',
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
  },

  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  messageBubble: {
    minWidth: 100,
    maxWidth: Dimensions.get('window').width * 0.7,
    borderRadius: 19,
    paddingHorizontal: 13,
    paddingTop: 10,
    paddingBottom: 10,
    paddingRight: 50,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexShrink: 1,
    position: 'relative',
  },

  messageBubbleOther: {
    backgroundColor: '#18181B',
    borderColor: '#27272A',
    borderBottomLeftRadius: 7,
  },

  messageBubbleMe: {
    backgroundColor: '#2563EB',
    borderColor: '#60A5FA',
    borderBottomRightRadius: 7,
    alignSelf: 'flex-end',
  },

  messageUserName: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 4,
  },

  messageReplyBox: {
    minHeight: 42,
    minWidth: 150,
    width: '100%',
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: 'row',
    gap: 7,
    marginBottom: 7,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },

  messageReplyBoxMe: {
    backgroundColor: 'rgba(15,23,42,0.22)',
    borderColor: 'rgba(219,234,254,0.18)',
  },

  messageReplyLine: {
    width: 3,
    borderRadius: 999,
    backgroundColor: '#60A5FA',
  },

  messageReplyLineMe: {
    backgroundColor: '#DBEAFE',
  },

  messageReplyAuthor: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '900',
    flexShrink: 1,
  },

  messageReplyAuthorMe: {
    color: '#DBEAFE',
  },

  messageReplyText: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 2,
    flexShrink: 1,
  },

  messageReplyTextMe: {
    color: '#EFF6FF',
  },

  audioMessageLine: {
    minWidth: 170,
    maxWidth: '100%',
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  audioPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  audioPlayButtonMe: {
    backgroundColor: '#1D4ED8',
  },

  audioWave: {
    flex: 1,
    minWidth: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  audioWaveSmall: {
    width: 4,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#94A3B8',
  },

  audioWaveMedium: {
    width: 4,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
  },

  audioWaveLarge: {
    width: 4,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },

  audioDuration: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '900',
    marginRight: 4,
  },

  audioDurationMe: {
    color: '#EFF6FF',
  },

  messageTextLine: {
    maxWidth: '100%',
    justifyContent: 'center',
  },

  messageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    flexShrink: 1,
  },

  messageTextMe: {
    color: '#FFFFFF',
  },

  messageHour: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '800',
    alignSelf: 'flex-end',
    marginTop: 5,
  },

  messageHourMe: {
    color: '#DBEAFE',
  },

  messageRightHour: {
    position: 'absolute',
    right: -37,
    bottom: 1,
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
    width: 34,
  },

  messageRightHourMe: {
    color: '#DBEAFE',
  },

  replyPreviewBox: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 9,
  },

  replyPreviewLine: {
    width: 4,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#60A5FA',
  },

  replyPreviewLabel: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '900',
  },

  replyPreviewText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },

  replyPreviewClose: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 4 : 0,
    borderTopWidth: 1,
    borderTopColor: '#18181B',
  },

  inputWrapper: {
    flex: 1,
    minHeight: 48,
    maxHeight: 110,
    borderRadius: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    maxHeight: 90,
  },

  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sendButtonDisabled: {
    backgroundColor: '#27272A',
    opacity: 0.7,
  },

  micButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  recordingBar: {
    minHeight: 58,
    borderRadius: 21,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 7 : 9,
  },

  recordingPulse: {
    width: 39,
    height: 39,
    borderRadius: 999,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },

  recordingTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  recordingTimer: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },

  cancelAudioButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sendAudioButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sendAudioButtonDisabled: {
    backgroundColor: '#27272A',
    opacity: 0.75,
  },

  messageActionsLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 40,
    elevation: 40,
  },

  messageActionsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },

  messageActionsCard: {
    marginHorizontal: 0,
    marginBottom: Platform.OS === 'ios' ? 12 : 4,
    borderRadius: 26,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -8,
    },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 45,
  },

  messageActionsHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 12,
  },

  messageActionsEyebrow: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  messageActionsTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },

  messageActionsPreview: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 7,
    marginBottom: 12,
  },

  messageActionOption: {
    minHeight: 62,
    borderRadius: 19,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#243142',
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 8,
  },

  messageActionIconBlue: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(37,99,235,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  messageActionIconGreen: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(34,197,94,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  messageActionIconPurple: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  messageActionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  messageActionSubtitle: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },

  municipalityOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  municipalitySheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#18181B',
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },

  municipalityHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: 'rgba(34,197,94,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  municipalitySearchBox: {
    minHeight: 52,
    borderRadius: 19,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 12,
  },

  municipalitySearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  municipalityList: {
    maxHeight: 430,
  },

  municipalityListContent: {
    paddingBottom: 14,
  },

  municipalityItem: {
    minHeight: 62,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 9,
  },

  municipalityItemSelected: {
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderColor: 'rgba(34,197,94,0.26)',
  },

  municipalityItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  municipalityItemName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  municipalityItemUf: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },

  driversOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  driversBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },

  driversSheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#18181B',
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },

  driversHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 12,
  },

  driversHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: 'rgba(34,197,94,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  driversList: {
    maxHeight: 430,
  },

  driversListContent: {
    paddingBottom: 14,
  },

  driverItem: {
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 9,
  },

  driverAvatar: {
    width: 42,
    height: 42,
    borderRadius: 999,
  },

  driverAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  driverAvatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  driverInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },

  driverName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  driverTimeBadge: {
    maxWidth: 92,
    minHeight: 34,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.20)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  driverTimeText: {
    color: '#BBF7D0',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 13,
  },
});
