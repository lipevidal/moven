import { useCallback, useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Text,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
  Pressable,
  DeviceEventEmitter,
} from 'react-native';
import { Tabs, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../src/database/supabase';
import { getPlatforms } from '../../../src/features/platforms/services/getPlatforms';
import { getUserPlatforms } from '../../../src/features/platforms/services/getUserPlatforms';
import { toggleUserPlatform } from '../../../src/features/platforms/services/toggleUserPlatform';
import { createRide } from '../../../src/features/rides/services/createRide';
import { deleteRide } from '../../../src/features/rides/services/deleteRide';
import { finishRide } from '../../../src/features/rides/services/finishRide';
import { startWaitingRide } from '../../../src/features/rides/services/startWaitingRide';
import { updateRide } from '../../../src/features/rides/services/updateRide';

type StandaloneGainErrors = {
  platform?: string;
  description?: string;
  date?: string;
  amount?: string;
};

function formatDateInput(date: Date) {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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

function parseDateInput(value: string) {
  const [day, month, year] = value.split('/').map(Number);

  if (!day || !month || !year) return null;

  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  const valid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return valid ? date : null;
}

function maskCurrency(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 12);

  if (!numbers) return '';

  return (Number(numbers) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrency(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : 0;
}

function formatKm(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 6);

  return numbers ? Number(numbers).toLocaleString('pt-BR') : '';
}

function onlyNumbers(value: string) {
  return Number(value.replace(/\./g, '')) || 0;
}

function cleanMoneyInput(value: string) {
  return value.replace(/[^0-9.,]/g, '');
}

function formatCurrency(value: number) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, -1);
}

export default function TabsLayout() {
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [activeSessionRides, setActiveSessionRides] = useState<any[]>([]);
  const [globalRideCardExpanded, setGlobalRideCardExpanded] = useState(false);
  const [finishGlobalRideModalVisible, setFinishGlobalRideModalVisible] =
    useState(false);
  const [editGlobalRideModalVisible, setEditGlobalRideModalVisible] =
    useState(false);
  const [globalRideEndKm, setGlobalRideEndKm] = useState('');
  const [globalRideAmount, setGlobalRideAmount] = useState('');
  const [globalEditRidePlatform, setGlobalEditRidePlatform] = useState('');
  const [globalEditRideAmount, setGlobalEditRideAmount] = useState('');
  const [globalEditRideStartKm, setGlobalEditRideStartKm] = useState('');
  const [waitingRideActionsModalVisible, setWaitingRideActionsModalVisible] =
    useState(false);
  const [selectedWaitingRide, setSelectedWaitingRide] = useState<any>(null);
  const [editWaitingRideModalVisible, setEditWaitingRideModalVisible] =
    useState(false);
  const [waitingEditPlatform, setWaitingEditPlatform] = useState('');
  const [waitingEditAmount, setWaitingEditAmount] = useState('');
  const [startWaitingRideModalVisible, setStartWaitingRideModalVisible] =
    useState(false);
  const [waitingStartKm, setWaitingStartKm] = useState('');
  const [savingWaitingRideEdit, setSavingWaitingRideEdit] = useState(false);
  const [savingStartWaitingRide, setSavingStartWaitingRide] = useState(false);
  const [savingGlobalRideEdit, setSavingGlobalRideEdit] = useState(false);
  const [savingGlobalRideFinish, setSavingGlobalRideFinish] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);

  const [standaloneGainModalVisible, setStandaloneGainModalVisible] =
    useState(false);
  const [rideModalVisible, setRideModalVisible] = useState(false);
  const [ridePlatform, setRidePlatform] = useState('');
  const [rideAmount, setRideAmount] = useState('');
  const [rideStartKm, setRideStartKm] = useState('');
  const [savingRide, setSavingRide] = useState(false);
  const [platformDrawerVisible, setPlatformDrawerVisible] = useState(false);
  const [
    returnToStandaloneGainAfterPlatforms,
    setReturnToStandaloneGainAfterPlatforms,
  ] = useState(false);
  const [returnToRideModalAfterPlatforms, setReturnToRideModalAfterPlatforms] =
    useState(false);

  const [platformsList, setPlatformsList] = useState<any[]>([]);
  const [userPlatforms, setUserPlatforms] = useState<any[]>([]);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);

  const [gainPlatform, setGainPlatform] = useState('');
  const [gainDescription, setGainDescription] = useState('');
  const [gainDate, setGainDate] = useState(formatDateInput(new Date()));
  const [gainAmount, setGainAmount] = useState('');
  const [gainErrors, setGainErrors] = useState<StandaloneGainErrors>({});
  const [savingGain, setSavingGain] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadActiveSession();
      loadPlatforms();
    }, []),
  );

  useEffect(() => {
    DeviceEventEmitter.emit(
      'movenapp:quick-actions-visible',
      quickActionsVisible,
    );

    return () => {
      DeviceEventEmitter.emit('movenapp:quick-actions-visible', false);
    };
  }, [quickActionsVisible]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const refreshActiveSession = () => {
      loadActiveSession();
    };

    const activeSessionRefreshSubscription = DeviceEventEmitter.addListener(
      'movenapp:active-session-refresh',
      refreshActiveSession,
    );

    const dashboardRefreshSubscription = DeviceEventEmitter.addListener(
      'movenapp:dashboard-refresh',
      refreshActiveSession,
    );

    return () => {
      activeSessionRefreshSubscription.remove();
      dashboardRefreshSubscription.remove();
    };
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function startRealtime() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      channel = supabase
        .channel(`tabs-active-session-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'work_sessions',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadActiveSession();
          },
        )
        .subscribe();
    }

    startRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeSession?.id) return;

    const channel = supabase
      .channel(`tabs-active-session-rides-${activeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `session_id=eq.${activeSession.id}`,
        },
        () => {
          loadActiveSession();
          DeviceEventEmitter.emit('movenapp:dashboard-refresh');
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSession?.id]);

  useEffect(() => {
    if (!activeSession?.id) return;

    const channel = supabase
      .channel(`tabs-active-session-earnings-${activeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'earnings',
          filter: `session_id=eq.${activeSession.id}`,
        },
        () => {
          loadActiveSession();
          DeviceEventEmitter.emit('movenapp:active-session-refresh');
          DeviceEventEmitter.emit('movenapp:dashboard-refresh');
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSession?.id]);

  async function loadActiveSession() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setHasActiveSession(false);
      setActiveSession(null);
      setActiveSessionRides([]);
      return;
    }

    const { data, error } = await supabase
      .from('work_sessions')
      .select('id, status, vehicle_id, start_km, end_km, started_at')
      .eq('user_id', user.id)
      .in('status', ['active', 'paused'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log('Erro ao carregar jornada ativa nas tabs:', error);
      setHasActiveSession(false);
      setActiveSession(null);
      setActiveSessionRides([]);
      return;
    }

    setHasActiveSession(!!data);
    setActiveSession(data ?? null);

    if (!data?.id) {
      setActiveSessionRides([]);
      return;
    }

    const { data: ridesData, error: ridesError } = await supabase
      .from('rides')
      .select('id, status, platform, amount, start_km, started_at')
      .eq('session_id', data.id);

    if (ridesError) {
      console.log('Erro ao carregar corridas da jornada nas tabs:', ridesError);
      setActiveSessionRides([]);
      return;
    }

    setActiveSessionRides(ridesData ?? []);
  }

  async function loadPlatforms() {
    try {
      const [allPlatforms, selectedPlatforms] = await Promise.all([
        getPlatforms(),
        getUserPlatforms(),
      ]);

      setPlatformsList(allPlatforms ?? []);
      setUserPlatforms(selectedPlatforms ?? []);
      setSelectedPlatformIds(
        (selectedPlatforms ?? []).map((item: any) => item.platform_id),
      );
    } catch (error) {
      console.log('Erro ao carregar plataformas:', error);
    }
  }

  function renderTabIcon(
    iconName: keyof typeof Ionicons.glyphMap,
    focused: boolean,
    color: string,
  ) {
    return (
      <View style={[styles.iconBox, focused && styles.iconBoxActive]}>
        <Ionicons
          name={iconName}
          size={22}
          color={focused ? '#06130B' : color}
        />
      </View>
    );
  }

  function resetStandaloneGainForm() {
    setGainPlatform('');
    setGainDescription('');
    setGainDate(formatDateInput(new Date()));
    setGainAmount('');
    setGainErrors({});
  }

  async function openStandaloneGainModal() {
    setQuickActionsVisible(false);
    resetStandaloneGainForm();
    await loadPlatforms();
    setStandaloneGainModalVisible(true);
  }

  function openExpenseForm() {
    setQuickActionsVisible(false);

    router.push({
      pathname: '/(private)/(tabs)/despesas',
      params: {
        openExpense: '1',
        t: String(Date.now()),
      },
    } as never);
  }

  function openNewJourney() {
    setQuickActionsVisible(false);

    if (hasActiveSession) {
      Alert.alert(
        'Jornada em andamento',
        'Finalize ou exclua a jornada atual antes de iniciar uma nova.',
      );
      return;
    }

    router.push('/(private)/(tabs)/nova-jornada' as never);
  }

  async function openRideFromQuickActions() {
    setQuickActionsVisible(false);

    if (!hasActiveSession || !activeSession?.id) {
      Alert.alert(
        'Nenhuma jornada em andamento',
        'Inicie uma jornada antes de registrar uma corrida.',
      );
      return;
    }

    if (activeSession.status === 'paused') {
      Alert.alert(
        'Jornada pausada',
        'Não é possível adicionar corridas com a jornada pausada. Retome a jornada para iniciar uma corrida.',
      );
      return;
    }

    await loadPlatforms();

    const hasActiveRide = activeSessionRides.some(
      (ride) => ride.status === 'active',
    );

    setRidePlatform('');
    setRideAmount('');
    setRideStartKm(
      hasActiveRide
        ? ''
        : Number(activeSession.end_km ?? activeSession.start_km ?? 0)
            .toLocaleString('pt-BR'),
    );

    setRideModalVisible(true);
  }

  function closeRideModal() {
    setRideModalVisible(false);
    setRidePlatform('');
    setRideAmount('');
    setRideStartKm('');
    setSavingRide(false);
  }

  function openPlatformDrawerFromRideModal() {
    setReturnToRideModalAfterPlatforms(true);
    setRideModalVisible(false);

    setTimeout(() => {
      setPlatformDrawerVisible(true);
    }, 350);
  }

  async function handleSaveRideFromTabs() {
    try {
      if (!activeSession?.id) {
        Alert.alert(
          'Nenhuma jornada em andamento',
          'Inicie uma jornada antes de registrar uma corrida.',
        );
        return;
      }

      if (activeSession.status === 'paused') {
        Alert.alert(
          'Jornada pausada',
          'Não é possível adicionar corridas com a jornada pausada. Retome a jornada para iniciar uma corrida.',
        );
        closeRideModal();
        return;
      }

      const amount = parseCurrency(rideAmount);
      const hasActiveRide = activeSessionRides.some(
        (ride) => ride.status === 'active',
      );

      if (!ridePlatform) {
        Alert.alert('Atenção', 'Selecione uma plataforma.');
        return;
      }

      if (!rideAmount.trim() || amount <= 0) {
        Alert.alert('Atenção', 'Informe o valor da corrida.');
        return;
      }

      let parsedStartKm: number | undefined;

      if (!hasActiveRide) {
        parsedStartKm = onlyNumbers(rideStartKm);

        if (!parsedStartKm) {
          Alert.alert('Atenção', 'Informe o KM inicial.');
          return;
        }
      }

      setSavingRide(true);

      if (hasActiveRide) {
        await createRide({
          session_id: activeSession.id,
          vehicle_id: activeSession.vehicle_id,
          platform: ridePlatform,
          amount,
          status: 'waiting',
        });
      } else {
        await createRide({
          session_id: activeSession.id,
          vehicle_id: activeSession.vehicle_id,
          platform: ridePlatform,
          amount,
          start_km: parsedStartKm,
          status: 'active',
        });
      }

      DeviceEventEmitter.emit('movenapp:dashboard-refresh');
      DeviceEventEmitter.emit('movenapp:active-session-refresh');

      closeRideModal();
      await loadActiveSession();

      Alert.alert(
        hasActiveRide ? 'Corrida adicionada' : 'Corrida iniciada',
        hasActiveRide
          ? 'A corrida foi adicionada na fila de aguardando início.'
          : 'A corrida foi iniciada dentro da jornada atual.',
      );
    } catch (error: any) {
      console.log('Erro ao iniciar corrida pelas tabs:', error);
      Alert.alert(
        'Erro',
        error?.message ?? 'Não foi possível registrar a corrida.',
      );
    } finally {
      setSavingRide(false);
    }
  }

  function openWaitingRideActionsModal(waitingRide: any) {
    setSelectedWaitingRide(waitingRide);
    setWaitingRideActionsModalVisible(true);
  }

  function closeWaitingRideActionsModal() {
    setWaitingRideActionsModalVisible(false);
    setSelectedWaitingRide(null);
  }

  function openEditWaitingRideModal() {
    if (!selectedWaitingRide) return;

    setWaitingEditPlatform(selectedWaitingRide.platform ?? '');
    setWaitingEditAmount(String(selectedWaitingRide.amount ?? '').replace('.', ','));
    setWaitingRideActionsModalVisible(false);

    setTimeout(() => {
      setEditWaitingRideModalVisible(true);
    }, 180);
  }

  function closeEditWaitingRideModal() {
    setEditWaitingRideModalVisible(false);
    setWaitingEditPlatform('');
    setWaitingEditAmount('');
    setSavingWaitingRideEdit(false);
  }

  async function handleUpdateWaitingRide() {
    try {
      if (!selectedWaitingRide?.id) return;

      const amount = parseCurrency(waitingEditAmount);

      if (!waitingEditPlatform) {
        Alert.alert('Atenção', 'Selecione uma plataforma.');
        return;
      }

      if (!amount || amount <= 0) {
        Alert.alert('Atenção', 'Informe o valor da corrida.');
        return;
      }

      setSavingWaitingRideEdit(true);

      await updateRide({
        ride_id: selectedWaitingRide.id,
        platform: waitingEditPlatform,
        amount,
      });

      closeEditWaitingRideModal();
      setSelectedWaitingRide(null);

      await loadActiveSession();

      DeviceEventEmitter.emit('movenapp:active-session-refresh');
      DeviceEventEmitter.emit('movenapp:dashboard-refresh');
    } catch (error: any) {
      console.log('Erro ao editar corrida aguardando:', error);
      Alert.alert(
        'Erro',
        error?.message ?? 'Não foi possível editar a corrida.',
      );
    } finally {
      setSavingWaitingRideEdit(false);
    }
  }

  async function handleDeleteWaitingRide() {
    if (!selectedWaitingRide?.id) return;

    Alert.alert(
      'Excluir corrida',
      'Deseja realmente excluir esta corrida aguardando início?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRide(selectedWaitingRide.id);

              closeWaitingRideActionsModal();
              await loadActiveSession();

              DeviceEventEmitter.emit('movenapp:active-session-refresh');
              DeviceEventEmitter.emit('movenapp:dashboard-refresh');
            } catch (error: any) {
              console.log('Erro ao excluir corrida aguardando:', error);
              Alert.alert(
                'Erro',
                error?.message ?? 'Não foi possível excluir a corrida.',
              );
            }
          },
        },
      ],
    );
  }

  function openStartWaitingRideFromGlobalCard() {
    if (!selectedWaitingRide) return;

    setWaitingStartKm(
      Number(activeSession?.end_km ?? activeSession?.start_km ?? 0)
        .toLocaleString('pt-BR'),
    );

    setWaitingRideActionsModalVisible(false);

    setTimeout(() => {
      setStartWaitingRideModalVisible(true);
    }, 180);
  }

  function closeStartWaitingRideModal() {
    setStartWaitingRideModalVisible(false);
    setWaitingStartKm('');
    setSavingStartWaitingRide(false);
  }

  async function handleStartWaitingRideFromGlobalCard() {
    try {
      if (!selectedWaitingRide?.id) return;

      if (globalActiveRide) {
        Alert.alert(
          'Corrida em andamento',
          'Finalize a corrida atual antes de iniciar a próxima.',
        );
        return;
      }

      const parsedStartKm = onlyNumbers(waitingStartKm);

      if (!parsedStartKm) {
        Alert.alert('Atenção', 'Informe o KM inicial.');
        return;
      }

      setSavingStartWaitingRide(true);

      await startWaitingRide({
        ride_id: selectedWaitingRide.id,
        start_km: parsedStartKm,
      });

      closeStartWaitingRideModal();
      setSelectedWaitingRide(null);

      await loadActiveSession();

      DeviceEventEmitter.emit('movenapp:active-session-refresh');
      DeviceEventEmitter.emit('movenapp:dashboard-refresh');
    } catch (error: any) {
      console.log('Erro ao iniciar corrida aguardando:', error);
      Alert.alert(
        'Erro',
        error?.message ?? 'Não foi possível iniciar a corrida.',
      );
    } finally {
      setSavingStartWaitingRide(false);
    }
  }

  function openGlobalRideEditModal() {
    if (!globalActiveRide) return;

    setGlobalRideCardExpanded(false);
    setGlobalEditRidePlatform(globalActiveRide.platform ?? '');
    setGlobalEditRideAmount(String(globalActiveRide.amount ?? '').replace('.', ','));
    setGlobalEditRideStartKm(
      globalActiveRide.start_km
        ? Number(globalActiveRide.start_km).toLocaleString('pt-BR')
        : '',
    );
    setEditGlobalRideModalVisible(true);
  }

  function closeGlobalRideEditModal() {
    setEditGlobalRideModalVisible(false);
    setGlobalEditRidePlatform('');
    setGlobalEditRideAmount('');
    setGlobalEditRideStartKm('');
    setSavingGlobalRideEdit(false);
  }

  async function handleUpdateGlobalActiveRide() {
    try {
      if (!globalActiveRide?.id) return;

      const amount = parseCurrency(globalEditRideAmount);
      const startKm = onlyNumbers(globalEditRideStartKm);

      if (!globalEditRidePlatform) {
        Alert.alert('Atenção', 'Selecione uma plataforma.');
        return;
      }

      if (!amount || amount <= 0) {
        Alert.alert('Atenção', 'Informe o valor da corrida.');
        return;
      }

      if (!startKm) {
        Alert.alert('Atenção', 'Informe o KM inicial.');
        return;
      }

      setSavingGlobalRideEdit(true);

      await updateRide({
        ride_id: globalActiveRide.id,
        platform: globalEditRidePlatform,
        amount,
        start_km: startKm,
      });

      closeGlobalRideEditModal();

      await loadActiveSession();

      DeviceEventEmitter.emit('movenapp:active-session-refresh');
      DeviceEventEmitter.emit('movenapp:dashboard-refresh');
    } catch (error: any) {
      console.log('Erro ao editar corrida ativa:', error);
      Alert.alert(
        'Erro',
        error?.message ?? 'Não foi possível editar a corrida.',
      );
    } finally {
      setSavingGlobalRideEdit(false);
    }
  }

  function openGlobalRideFinishModal() {
    if (!globalActiveRide || !activeSession?.id) return;

    setGlobalRideCardExpanded(false);
    setGlobalRideEndKm(
      Number(activeSession.end_km ?? globalActiveRide.start_km ?? activeSession.start_km ?? 0)
        .toLocaleString('pt-BR'),
    );
    setGlobalRideAmount(String(globalActiveRide.amount ?? '').replace('.', ','));
    setFinishGlobalRideModalVisible(true);
  }

  function closeGlobalRideFinishModal() {
    setFinishGlobalRideModalVisible(false);
    setGlobalRideEndKm('');
    setGlobalRideAmount('');
    setSavingGlobalRideFinish(false);
  }

  async function handleDeleteGlobalActiveRide() {
    if (!globalActiveRide?.id) return;

    Alert.alert(
      'Excluir corrida',
      'Deseja realmente excluir a corrida em andamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRide(globalActiveRide.id);

              setGlobalRideCardExpanded(false);
              await loadActiveSession();

              DeviceEventEmitter.emit('movenapp:active-session-refresh');
              DeviceEventEmitter.emit('movenapp:dashboard-refresh');
            } catch (error: any) {
              console.log('Erro ao excluir corrida ativa:', error);
              Alert.alert(
                'Erro',
                error?.message ?? 'Não foi possível excluir a corrida.',
              );
            }
          },
        },
      ],
    );
  }

  async function handleFinishGlobalActiveRide() {
    try {
      if (!globalActiveRide || !activeSession?.id) return;

      const parsedEndKm = onlyNumbers(globalRideEndKm);
      const startKm = Number(globalActiveRide.start_km ?? 0);
      const amount = parseCurrency(globalRideAmount);

      if (!amount || amount <= 0) {
        Alert.alert('Atenção', 'Informe o valor da corrida.');
        return;
      }

      if (!parsedEndKm || parsedEndKm < startKm) {
        Alert.alert(
          'KM inválido',
          'O KM final não pode ser menor que o KM inicial da corrida.',
        );
        return;
      }

      setSavingGlobalRideFinish(true);

      await finishRide({
        ride_id: globalActiveRide.id,
        session_id: activeSession.id,
        vehicle_id: activeSession.vehicle_id,
        platform: globalActiveRide.platform,
        amount,
        start_km: startKm,
        end_km: parsedEndKm,
        started_at: globalActiveRide.started_at,
      });

      closeGlobalRideFinishModal();

      await loadActiveSession();

      DeviceEventEmitter.emit('movenapp:active-session-refresh');
      DeviceEventEmitter.emit('movenapp:dashboard-refresh');
    } catch (error: any) {
      console.log('Erro ao concluir corrida ativa:', error);
      Alert.alert(
        'Erro',
        error?.message ?? 'Não foi possível concluir a corrida.',
      );
    } finally {
      setSavingGlobalRideFinish(false);
    }
  }

  function clearGainError(field: keyof StandaloneGainErrors) {
    setGainErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  }

  function validateStandaloneGainForm() {
    const errors: StandaloneGainErrors = {};
    const parsedDate = parseDateInput(gainDate);
    const amount = parseCurrency(gainAmount);

    if (!gainPlatform) {
      errors.platform = 'Selecione uma plataforma.';
    }

    if (!gainDescription.trim()) {
      errors.description = 'Informe uma descrição.';
    } else if (gainDescription.trim().length < 3) {
      errors.description = 'A descrição precisa ter pelo menos 3 caracteres.';
    }

    if (!parsedDate) {
      errors.date = 'Informe uma data válida.';
    } else {
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (parsedDate > today) {
        errors.date = 'A data do ganho não pode ser futura.';
      }
    }

    if (!gainAmount.trim()) {
      errors.amount = 'Informe o valor.';
    } else if (amount <= 0) {
      errors.amount = 'O valor precisa ser maior que zero.';
    }

    setGainErrors(errors);

    return Object.keys(errors).length === 0;
  }

  async function handleSaveStandaloneGain() {
    try {
      const valid = validateStandaloneGainForm();

      if (!valid) return;

      setSavingGain(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user?.id) {
        Alert.alert('Sessão expirada', 'Entre novamente para lançar o ganho.');
        return;
      }

      const parsedDate = parseDateInput(gainDate);

      if (!parsedDate) return;

      const { error } = await supabase.from('earnings').insert({
        user_id: user.id,
        session_id: null,
        platform: gainPlatform,
        description: gainDescription.trim(),
        amount: parseCurrency(gainAmount),
        earning_date: toLocalISOString(parsedDate),
      });

      if (error) throw error;

      DeviceEventEmitter.emit('movenapp:dashboard-refresh');

      setStandaloneGainModalVisible(false);
      resetStandaloneGainForm();

      Alert.alert(
        'Ganho lançado',
        'O ganho avulso foi registrado sem vínculo com uma jornada.',
      );
    } catch (error: any) {
      console.log('Erro ao salvar ganho avulso:', error);

      const message = String(error?.message ?? '').toLowerCase();

      Alert.alert(
        'Erro ao salvar ganho',
        message.includes('session_id')
          ? 'A coluna session_id precisa aceitar vazio para permitir ganho avulso.'
          : message.includes('user_id') ||
              message.includes('description') ||
              message.includes('earning_date')
            ? 'Rode o SQL de ganhos avulsos no Supabase para preparar a tabela earnings.'
            : 'Não foi possível salvar o ganho. Confira os dados e tente novamente.',
      );
    } finally {
      setSavingGain(false);
    }
  }

  function openPlatformDrawerFromStandaloneGain() {
    setReturnToStandaloneGainAfterPlatforms(true);
    setStandaloneGainModalVisible(false);

    setTimeout(() => {
      setPlatformDrawerVisible(true);
    }, 350);
  }

  function closePlatformDrawerAndReturn() {
    const shouldReturnToStandaloneGain = returnToStandaloneGainAfterPlatforms;
    const shouldReturnToRide = returnToRideModalAfterPlatforms;

    setPlatformDrawerVisible(false);
    setReturnToStandaloneGainAfterPlatforms(false);
    setReturnToRideModalAfterPlatforms(false);

    setTimeout(() => {
      if (shouldReturnToStandaloneGain) {
        setStandaloneGainModalVisible(true);
        return;
      }

      if (shouldReturnToRide) {
        setRideModalVisible(true);
      }
    }, 350);
  }

  function togglePlatformSelection(platformId: string) {
    setSelectedPlatformIds((current) => {
      if (current.includes(platformId)) {
        return current.filter((id) => id !== platformId);
      }

      return [...current, platformId];
    });
  }

  async function handleSaveUserPlatforms() {
    try {
      for (const platform of platformsList) {
        const selected = selectedPlatformIds.includes(platform.id);

        await toggleUserPlatform(platform.id, selected);
      }

      await loadPlatforms();
      closePlatformDrawerAndReturn();
    } catch (error) {
      console.log('Erro ao salvar plataformas:', error);
      Alert.alert('Erro', 'Não foi possível salvar suas plataformas.');
    }
  }

  const selectedPlatformData = userPlatforms.find(
    (item: any) => item.platform?.name === gainPlatform,
  )?.platform;

  const hasActiveRideInCurrentSession = activeSessionRides.some(
    (ride) => ride.status === 'active',
  );

  const globalActiveRide = activeSessionRides.find(
    (ride) => ride.status === 'active',
  );

  const globalWaitingRides = activeSessionRides.filter(
    (ride) => ride.status === 'waiting',
  );

  const globalActiveRideElapsedSeconds = calculateSecondsFromDate(
    globalActiveRide?.started_at,
  );

  const globalActiveRideGainPerHour =
    globalActiveRideElapsedSeconds > 0
      ? Number(globalActiveRide?.amount ?? 0) /
        (globalActiveRideElapsedSeconds / 3600)
      : 0;

  const globalActiveRidePlatformData = platformsList.find(
    (platform: any) => platform.name === globalActiveRide?.platform,
  );

  const selectedWaitingRidePlatformData = platformsList.find(
    (platform: any) => platform.name === selectedWaitingRide?.platform,
  );

  const hasVisibleGlobalRideCards =
    (!!globalActiveRide || globalWaitingRides.length > 0) &&
    !globalRideCardExpanded &&
    !rideModalVisible &&
    !standaloneGainModalVisible &&
    !platformDrawerVisible &&
    !finishGlobalRideModalVisible &&
    !waitingRideActionsModalVisible &&
    !editWaitingRideModalVisible &&
    !startWaitingRideModalVisible;

  const shouldShowGlobalRideMiniCard = hasVisibleGlobalRideCards;

  const globalRideCardsStackHeight = (() => {
    if (!hasVisibleGlobalRideCards) return 0;

    const activeRideCardHeight = globalActiveRide ? 78 : 0;
    const waitingRideCardsHeight =
      globalWaitingRides.length > 0
        ? globalWaitingRides.length * 66
        : 0;

    const cardsGap =
      globalActiveRide && globalWaitingRides.length > 0 ? 8 : 0;

    return activeRideCardHeight + waitingRideCardsHeight + cardsGap;
  })();

  const activeSessionFloatingTimerBottomOffset =
    globalRideCardsStackHeight > 0 ? globalRideCardsStackHeight + 12 : 0;

  const quickActionsBottomOffset =
    quickActionsVisible && globalRideCardsStackHeight > 0
      ? globalRideCardsStackHeight + 190
      : 0;

  useEffect(() => {
    DeviceEventEmitter.emit(
      'movenapp:active-session-floating-timer-offset',
      activeSessionFloatingTimerBottomOffset,
    );

    return () => {
      DeviceEventEmitter.emit(
        'movenapp:active-session-floating-timer-offset',
        0,
      );
    };
  }, [activeSessionFloatingTimerBottomOffset]);

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,

          tabBarStyle: {
            position: 'absolute',
            left: 10,
            right: 10,
            bottom: 0,
            height: 74,
            backgroundColor: '#0B0B0F',
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: '#18181B',
            borderRadius: 0,
            paddingTop: 10,
            paddingBottom: 10,
            paddingHorizontal: 6,
            shadowColor: '#000000',
            shadowOffset: {
              width: 0,
              height: 12,
            },
            shadowOpacity: 0.35,
            shadowRadius: 20,
            elevation: 18,
          },

          tabBarItemStyle: {
            height: 54,
            alignItems: 'center',
            justifyContent: 'center',
          },

          tabBarActiveTintColor: '#22C55E',
          tabBarInactiveTintColor: '#71717A',
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, focused }) =>
              renderTabIcon('grid-outline', focused, color),
          }}
        />

        <Tabs.Screen
          name="despesas"
          options={{
            title: 'Despesas',
            tabBarIcon: ({ color, focused }) =>
              renderTabIcon('card-outline', focused, color),
          }}
        />

        <Tabs.Screen
          name="jornadas"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="veiculos"
          options={{
            title: 'Veículos',
            tabBarIcon: ({ color, focused }) =>
              renderTabIcon('car-sport-outline', focused, color),
          }}
        />

        <Tabs.Screen
          name="nova-jornada"
          options={{
            title: '',
            tabBarButton: () => (
              <TouchableOpacity
                activeOpacity={0.86}
                style={[
                  styles.centerButton,
                  quickActionsVisible && styles.centerButtonOpen,
                ]}
                onPress={() => {
                  loadActiveSession();
                  setQuickActionsVisible((current) => !current);
                }}
              >
                <Ionicons
                  name={quickActionsVisible ? 'close' : 'add'}
                  size={31}
                  color="#06130B"
                />
              </TouchableOpacity>
            ),
          }}
        />

        <Tabs.Screen
          name="recordes"
          options={{
            title: 'Meus recordes',
            tabBarIcon: ({ color, focused }) =>
              renderTabIcon('podium-outline', focused, color),
          }}
        />

        <Tabs.Screen
          name="conversas"
          options={{
            title: 'Conversas',
            tabBarIcon: ({ color, focused }) =>
              renderTabIcon('chatbubble-ellipses-outline', focused, color),
          }}
        />

        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, focused }) =>
              renderTabIcon('person-circle-outline', focused, color),
          }}
        />

        <Tabs.Screen
          name="jornada-ativa"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {quickActionsVisible ? (
        <>
          <Pressable
            style={styles.quickBackdrop}
            onPress={() => setQuickActionsVisible(false)}
          />

          <View
            style={[
              styles.quickActionsWrapper,
              quickActionsBottomOffset > 0 && {
                bottom: (Platform.OS === 'ios' ? 60 : 60) + quickActionsBottomOffset,
              },
            ]}
            pointerEvents="box-none"
          >
            <QuickActionButton
              icon="cash-outline"
              label="Ganho"
              style={styles.quickActionGain}
              iconBoxStyle={styles.quickActionIconGreen}
              onPress={openStandaloneGainModal}
            />

            <QuickActionButton
              icon="receipt-outline"
              label="Despesa"
              style={styles.quickActionExpense}
              iconBoxStyle={styles.quickActionIconRed}
              onPress={openExpenseForm}
            />

            {hasActiveSession ? (
              <QuickActionButton
                icon="navigate-outline"
                label="+ Corridas"
                style={styles.quickActionRide}
                iconBoxStyle={styles.quickActionIconPurple}
                onPress={openRideFromQuickActions}
              />
            ) : null}

            {!hasActiveSession ? (
              <QuickActionButton
                icon="play-circle-outline"
                label="Nova jornada"
                style={styles.quickActionJourney}
                iconBoxStyle={styles.quickActionIconBlue}
                onPress={openNewJourney}
              />
            ) : null}
          </View>
        </>
      ) : null}

      {shouldShowGlobalRideMiniCard ? (
        <View style={styles.globalRideMiniStack} pointerEvents="box-none">
          <View pointerEvents="none" style={styles.globalRideMiniBackdrop} />

          {globalActiveRide ? (
            <TouchableOpacity
              activeOpacity={0.92}
              style={styles.globalRideMiniCard}
              onPress={() => setGlobalRideCardExpanded(true)}
            >
              <View style={styles.globalRideMiniIcon}>
                {globalActiveRidePlatformData?.logo_url ? (
                  <Image
                    source={{ uri: globalActiveRidePlatformData.logo_url }}
                    style={styles.globalRideMiniLogo}
                  />
                ) : (
                  <Ionicons name="navigate-outline" size={22} color="#06130B" />
                )}
              </View>

              <View style={styles.globalRideMiniCenter}>
                <View style={styles.globalRideMiniStatusRow}>
                  <View style={styles.globalRideMiniLiveDot} />
                  <Text style={styles.globalRideMiniStatusText}>
                    Corrida em andamento
                  </Text>
                </View>

                <Text style={styles.globalRideMiniTimer}>
                  {formatTimer(globalActiveRideElapsedSeconds)}
                </Text>
              </View>

              <View style={styles.globalRideMiniRight}>
                <Text style={styles.globalRideMiniAmount}>
                  R$ {formatCurrency(Number(globalActiveRide?.amount ?? 0))}
                </Text>
                <Text style={styles.globalRideMiniPerHour}>
                  R$ {formatCurrency(globalActiveRideGainPerHour)}/h
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {globalWaitingRides.map((waitingRide: any) => {
            const waitingRidePlatformData = platformsList.find(
              (platform: any) => platform.name === waitingRide.platform,
            );

            return (
              <TouchableOpacity
                key={waitingRide.id}
                activeOpacity={0.9}
                style={styles.globalWaitingRideMiniCard}
                onPress={() => openWaitingRideActionsModal(waitingRide)}
              >
                <View style={styles.globalWaitingRideMiniIcon}>
                  {waitingRidePlatformData?.logo_url ? (
                    <Image
                      source={{ uri: waitingRidePlatformData.logo_url }}
                      style={styles.globalWaitingRideMiniLogo}
                    />
                  ) : (
                    <Ionicons name="time-outline" size={19} color="#BFDBFE" />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={styles.globalWaitingRidePlatform}
                    numberOfLines={1}
                  >
                    {waitingRide.platform ?? 'Plataforma'}
                  </Text>

                  <View style={styles.globalWaitingRideStatusRow}>
                    <View style={styles.globalWaitingRideStatusDot} />
                    <Text style={styles.globalWaitingRideStatusText}>
                      Corrida aguardando início
                    </Text>
                  </View>
                </View>

                <Text style={styles.globalWaitingRideAmount}>
                  R$ {formatCurrency(Number(waitingRide.amount ?? 0))}
                </Text>

                <Ionicons name="chevron-forward" size={18} color="#A1A1AA" />
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {globalRideCardExpanded && globalActiveRide ? (
        <Pressable
          style={styles.globalRideExpandedOverlay}
          onPress={() => setGlobalRideCardExpanded(false)}
        >
          <Pressable
            style={styles.globalRideExpandedCard}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.globalRideExpandedHeader}>
              <View style={styles.globalRideExpandedTitleRow}>
                <View style={styles.globalRideExpandedIcon}>
                  {globalActiveRidePlatformData?.logo_url ? (
                    <Image
                      source={{ uri: globalActiveRidePlatformData.logo_url }}
                      style={styles.globalRideExpandedLogo}
                    />
                  ) : (
                    <Ionicons name="navigate-outline" size={24} color="#06130B" />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.globalRideExpandedEyebrow}>
                    Corrida em andamento
                  </Text>
                  <Text style={styles.globalRideExpandedTitle} numberOfLines={1}>
                    {globalActiveRide.platform ?? 'Plataforma'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.globalRideMinimizeButton}
                onPress={() => setGlobalRideCardExpanded(false)}
              >
                <Ionicons name="chevron-down" size={23} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.globalRideExpandedTimerBox}>
              <Text style={styles.globalRideExpandedTimerLabel}>
                Tempo da corrida
              </Text>
              <Text style={styles.globalRideExpandedTimerValue}>
                {formatTimer(globalActiveRideElapsedSeconds)}
              </Text>
            </View>

            <View style={styles.globalRideExpandedStatsGrid}>
              <View style={styles.globalRideExpandedStatBox}>
                <Text style={styles.globalRideExpandedStatLabel}>Valor</Text>
                <Text style={styles.globalRideExpandedStatValueGreen}>
                  R$ {formatCurrency(Number(globalActiveRide.amount ?? 0))}
                </Text>
              </View>

              <View style={styles.globalRideExpandedStatBox}>
                <Text style={styles.globalRideExpandedStatLabel}>Ganho/h</Text>
                <Text style={styles.globalRideExpandedStatValueBlue}>
                  R$ {formatCurrency(globalActiveRideGainPerHour)}
                </Text>
              </View>

              <View style={styles.globalRideExpandedStatBox}>
                <Text style={styles.globalRideExpandedStatLabel}>KM inicial</Text>
                <Text style={styles.globalRideExpandedStatValue}>
                  {Number(globalActiveRide.start_km ?? 0).toLocaleString('pt-BR')} km
                </Text>
              </View>

              <View style={styles.globalRideExpandedStatBox}>
                <Text style={styles.globalRideExpandedStatLabel}>Status</Text>
                <Text style={styles.globalRideExpandedStatValue}>
                  Rodando
                </Text>
              </View>
            </View>

            <View style={styles.globalRideExpandedActionsRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.globalRideDeleteButton}
                onPress={handleDeleteGlobalActiveRide}
              >
                <Ionicons name="trash-outline" size={20} color="#FCA5A5" />
                <Text style={styles.globalRideDeleteButtonText}>Excluir</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.globalRideEditButton}
                onPress={openGlobalRideEditModal}
              >
                <Ionicons name="create-outline" size={20} color="#BFDBFE" />
                <Text style={styles.globalRideEditButtonText}>Editar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.globalRideFinishButton}
                onPress={openGlobalRideFinishModal}
              >
                <Ionicons name="flag-outline" size={20} color="#06130B" />
                <Text style={styles.globalRideFinishButtonText}>Concluir</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      ) : null}

      <Modal visible={standaloneGainModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.gainModalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 18 }}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>Ganho avulso</Text>
                  <Text style={styles.modalTitle}>Novo ganho</Text>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setStandaloneGainModalVisible(false);
                    resetStandaloneGainForm();
                  }}
                >
                  <Ionicons name="close" size={27} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDescription}>
                Ideal para lançar promoção, bônus ou recompensa da plataforma sem vincular a uma jornada.
              </Text>

              <View style={styles.fieldHeader}>
                <Text style={styles.fieldLabel}>Plataforma</Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.managePlatformsButton}
                  onPress={openPlatformDrawerFromStandaloneGain}
                >
                  <Ionicons name="apps-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.managePlatformsButtonText}>Gerenciar</Text>
                </TouchableOpacity>
              </View>

              {gainErrors.platform ? (
                <Text style={styles.errorText}>{gainErrors.platform}</Text>
              ) : null}

              {userPlatforms.length === 0 ? (
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.emptyPlatformsBox}
                  onPress={openPlatformDrawerFromStandaloneGain}
                >
                  <Ionicons name="apps-outline" size={30} color="#71717A" />
                  <Text style={styles.emptyPlatformsTitle}>
                    Nenhuma plataforma selecionada
                  </Text>
                  <Text style={styles.emptyPlatformsText}>
                    Toque para escolher as plataformas que você usa.
                  </Text>
                </TouchableOpacity>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.platformsHorizontalList}
                >
                  {userPlatforms.map((item: any) => {
                    const platform = item.platform;

                    if (!platform) return null;

                    const selected = gainPlatform === platform.name;

                    return (
                      <TouchableOpacity
                        key={platform.id}
                        activeOpacity={0.86}
                        style={[
                          styles.platformChip,
                          selected && styles.platformChipActive,
                        ]}
                        onPress={() => {
                          setGainPlatform(platform.name);
                          clearGainError('platform');
                        }}
                      >
                        {platform.logo_url ? (
                          <Image
                            source={{ uri: platform.logo_url }}
                            style={styles.platformChipLogo}
                          />
                        ) : (
                          <View style={styles.platformChipLogoFallback}>
                            <Text style={styles.platformChipLogoText}>
                              {platform.name?.slice(0, 1) ?? '?'}
                            </Text>
                          </View>
                        )}

                        <Text
                          style={[
                            styles.platformChipText,
                            selected && styles.platformChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {platform.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {selectedPlatformData ? (
                <View style={styles.selectedPlatformPreview}>
                  {selectedPlatformData.logo_url ? (
                    <Image
                      source={{ uri: selectedPlatformData.logo_url }}
                      style={styles.selectedPlatformLogo}
                    />
                  ) : (
                    <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
                  )}

                  <Text style={styles.selectedPlatformPreviewText}>
                    Plataforma selecionada: {selectedPlatformData.name}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>Descrição</Text>
              <TextInput
                value={gainDescription}
                onChangeText={(text) => {
                  setGainDescription(text);
                  clearGainError('description');
                }}
                placeholder="Ex: Promoção, bônus, recompensa..."
                placeholderTextColor="#71717A"
                style={[
                  styles.input,
                  gainErrors.description && styles.inputError,
                ]}
              />
              {gainErrors.description ? (
                <Text style={styles.errorText}>{gainErrors.description}</Text>
              ) : null}

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Data</Text>
                  <TextInput
                    value={gainDate}
                    onChangeText={(text) => {
                      setGainDate(maskDateInput(text));
                      clearGainError('date');
                    }}
                    placeholder="dd/mm/aaaa"
                    placeholderTextColor="#71717A"
                    keyboardType="numeric"
                    maxLength={10}
                    style={[styles.input, gainErrors.date && styles.inputError]}
                  />
                  {gainErrors.date ? (
                    <Text style={styles.errorText}>{gainErrors.date}</Text>
                  ) : null}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Valor</Text>
                  <TextInput
                    value={gainAmount}
                    onChangeText={(text) => {
                      setGainAmount(maskCurrency(text));
                      clearGainError('amount');
                    }}
                    placeholder="0,00"
                    placeholderTextColor="#71717A"
                    keyboardType="numeric"
                    style={[styles.input, gainErrors.amount && styles.inputError]}
                  />
                  {gainErrors.amount ? (
                    <Text style={styles.errorText}>{gainErrors.amount}</Text>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  styles.saveGainButton,
                  savingGain && styles.saveGainButtonDisabled,
                ]}
                disabled={savingGain}
                onPress={handleSaveStandaloneGain}
              >
                {savingGain ? (
                  <ActivityIndicator color="#06130B" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={22}
                      color="#06130B"
                    />
                    <Text style={styles.saveGainButtonText}>Salvar ganho</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={rideModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.rideModalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.rideModalScrollContent}
            >
              <View style={styles.rideCreateHeader}>
                <View style={styles.rideCreateHeaderLeft}>
                  <View
                    style={[
                      styles.rideCreateHeaderIcon,
                      hasActiveRideInCurrentSession &&
                        styles.rideCreateHeaderIconQueue,
                    ]}
                  >
                    <Ionicons
                      name={
                        hasActiveRideInCurrentSession
                          ? 'albums-outline'
                          : 'navigate-outline'
                      }
                      size={25}
                      color="#06130B"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.rideCreateEyebrow}>
                      {hasActiveRideInCurrentSession
                        ? 'Adicionar à fila'
                        : 'Começar agora'}
                    </Text>
                    <Text style={styles.rideCreateTitle}>
                      Iniciar corrida
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.rideCreateCloseButton}
                  onPress={closeRideModal}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.rideCreateDescription}>
                Selecione a plataforma, informe o valor e registre a corrida na jornada atual.
              </Text>

              {hasActiveRideInCurrentSession ? (
                <View style={styles.rideInfoCard}>
                  <View style={styles.rideInfoIcon}>
                    <Ionicons name="information-circle-outline" size={20} color="#60A5FA" />
                  </View>
                  <Text style={styles.rideInfoText}>
                    Já existe uma corrida em andamento. Esta nova corrida ficará aguardando início.
                  </Text>
                </View>
              ) : null}

              <View style={styles.rideSectionHeader}>
                <View style={styles.rideSectionHeaderLeft}>
                  <View style={styles.rideSectionIcon}>
                    <Ionicons name="apps-outline" size={18} color="#22C55E" />
                  </View>

                  <View>
                    <Text style={styles.rideSectionTitle}>Plataforma</Text>
                    <Text style={styles.rideSectionSubtitle}>
                      Escolha onde a corrida foi chamada
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.rideManagePlatformsButton}
                  onPress={openPlatformDrawerFromRideModal}
                >
                  <Ionicons name="settings-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.rideManagePlatformsButtonText}>
                    Gerenciar
                  </Text>
                </TouchableOpacity>
              </View>

              {userPlatforms.length === 0 ? (
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.emptyPlatformsBox}
                  onPress={openPlatformDrawerFromRideModal}
                >
                  <Ionicons name="apps-outline" size={30} color="#71717A" />
                  <Text style={styles.emptyPlatformsTitle}>
                    Nenhuma plataforma selecionada
                  </Text>
                  <Text style={styles.emptyPlatformsText}>
                    Toque para escolher as plataformas que você usa.
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.ridePlatformsGrid}>
                  {userPlatforms.map((item: any) => {
                    const platform = item.platform;

                    if (!platform) return null;

                    const selected = ridePlatform === platform.name;

                    return (
                      <TouchableOpacity
                        key={platform.id}
                        activeOpacity={0.86}
                        style={[
                          styles.ridePlatformCard,
                          selected && styles.ridePlatformCardActive,
                        ]}
                        onPress={() => setRidePlatform(platform.name)}
                      >
                        {platform.logo_url ? (
                          <Image
                            source={{ uri: platform.logo_url }}
                            style={styles.ridePlatformLogo}
                          />
                        ) : (
                          <View style={styles.ridePlatformLogoFallback}>
                            <Text style={styles.ridePlatformLogoText}>
                              {platform.name?.slice(0, 1) ?? '?'}
                            </Text>
                          </View>
                        )}

                        <Text
                          style={[
                            styles.ridePlatformName,
                            selected && styles.ridePlatformNameActive,
                          ]}
                          numberOfLines={1}
                        >
                          {platform.name}
                        </Text>

                        {selected ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color="#06130B"
                          />
                        ) : (
                          <Ionicons
                            name="ellipse-outline"
                            size={19}
                            color="#52525B"
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={styles.rideInputsRow}>
                <View style={styles.rideInputCard}>
                  <View style={styles.rideInputIconGreen}>
                    <Ionicons name="cash-outline" size={19} color="#22C55E" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.rideInputLabel}>Valor da corrida</Text>
                    <TextInput
                      value={rideAmount}
                      onChangeText={(text) => setRideAmount(cleanMoneyInput(text))}
                      placeholder="0,00"
                      placeholderTextColor="#71717A"
                      keyboardType="numeric"
                      style={styles.rideInput}
                    />
                  </View>
                </View>

                {!hasActiveRideInCurrentSession ? (
                  <View style={styles.rideInputCard}>
                    <View style={styles.rideInputIconBlue}>
                      <Ionicons name="speedometer-outline" size={19} color="#60A5FA" />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.rideInputLabel}>KM inicial</Text>
                      <TextInput
                        value={rideStartKm}
                        onChangeText={(text) => setRideStartKm(formatKm(text))}
                        placeholder="0"
                        placeholderTextColor="#71717A"
                        keyboardType="numeric"
                        style={styles.rideInput}
                      />
                    </View>
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  styles.saveRideButton,
                  savingRide && styles.saveGainButtonDisabled,
                ]}
                disabled={savingRide}
                onPress={handleSaveRideFromTabs}
              >
                {savingRide ? (
                  <ActivityIndicator color="#06130B" />
                ) : (
                  <>
                    <Ionicons
                      name={
                        hasActiveRideInCurrentSession
                          ? 'add-circle-outline'
                          : 'play-circle-outline'
                      }
                      size={22}
                      color="#06130B"
                    />
                    <Text style={styles.saveRideButtonText}>
                      {hasActiveRideInCurrentSession
                        ? 'Adicionar corrida'
                        : 'Iniciar corrida'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={waitingRideActionsModalVisible} transparent animationType="fade">
        <Pressable
          style={styles.globalWaitingRideExpandedOverlay}
          onPress={closeWaitingRideActionsModal}
        >
          <Pressable
            style={styles.globalWaitingRideExpandedCard}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.globalWaitingRideExpandedHeader}>
              <View style={styles.globalWaitingRideExpandedTitleRow}>
                <View style={styles.globalWaitingRideExpandedIcon}>
                  {selectedWaitingRidePlatformData?.logo_url ? (
                    <Image
                      source={{ uri: selectedWaitingRidePlatformData.logo_url }}
                      style={styles.globalWaitingRideExpandedLogo}
                    />
                  ) : (
                    <Ionicons name="time-outline" size={24} color="#BFDBFE" />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.globalWaitingRideExpandedEyebrow}>
                    Corrida aguardando início
                  </Text>
                  <Text style={styles.globalWaitingRideExpandedTitle} numberOfLines={1}>
                    {selectedWaitingRide?.platform ?? 'Plataforma'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.globalRideMinimizeButton}
                onPress={closeWaitingRideActionsModal}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.globalWaitingRideExpandedValueBox}>
              <Text style={styles.globalWaitingRideExpandedValueLabel}>
                Valor previsto
              </Text>
              <Text style={styles.globalWaitingRideExpandedValue}>
                R$ {formatCurrency(Number(selectedWaitingRide?.amount ?? 0))}
              </Text>
            </View>

            <View style={styles.globalWaitingRideExpandedActionsRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.globalRideDeleteButton}
                onPress={handleDeleteWaitingRide}
              >
                <Ionicons name="trash-outline" size={20} color="#FCA5A5" />
                <Text style={styles.globalRideDeleteButtonText}>Excluir</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.globalRideEditButton}
                onPress={openEditWaitingRideModal}
              >
                <Ionicons name="create-outline" size={20} color="#BFDBFE" />
                <Text style={styles.globalRideEditButtonText}>Editar</Text>
              </TouchableOpacity>

              {!globalActiveRide ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.globalRideFinishButton}
                  onPress={openStartWaitingRideFromGlobalCard}
                >
                  <Ionicons name="play-circle-outline" size={20} color="#06130B" />
                  <Text style={styles.globalRideFinishButtonText}>Iniciar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={editWaitingRideModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.globalRideEditModalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              <View style={styles.globalRideEditModalHeader}>
                <View style={styles.globalRideEditModalHeaderLeft}>
                  <View style={styles.globalRideEditModalIcon}>
                    <Ionicons name="create-outline" size={23} color="#FFFFFF" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalEyebrow}>Corrida aguardando</Text>
                    <Text style={styles.modalTitle}>Editar corrida</Text>
                  </View>
                </View>

                <TouchableOpacity onPress={closeEditWaitingRideModal}>
                  <Ionicons name="close" size={27} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDescription}>
                Altere a plataforma ou o valor da corrida aguardando início.
              </Text>

              <View style={styles.rideSectionHeader}>
                <View style={styles.rideSectionHeaderLeft}>
                  <View style={styles.rideSectionIcon}>
                    <Ionicons name="apps-outline" size={18} color="#22C55E" />
                  </View>

                  <View>
                    <Text style={styles.rideSectionTitle}>Plataforma</Text>
                    <Text style={styles.rideSectionSubtitle}>
                      Plataforma usada nesta corrida
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.ridePlatformsGrid}>
                {userPlatforms.map((item: any) => {
                  const platform = item.platform;

                  if (!platform) return null;

                  const selected = waitingEditPlatform === platform.name;

                  return (
                    <TouchableOpacity
                      key={platform.id}
                      activeOpacity={0.86}
                      style={[
                        styles.ridePlatformCard,
                        selected && styles.ridePlatformCardActive,
                      ]}
                      onPress={() => setWaitingEditPlatform(platform.name)}
                    >
                      {platform.logo_url ? (
                        <Image
                          source={{ uri: platform.logo_url }}
                          style={styles.ridePlatformLogo}
                        />
                      ) : (
                        <View style={styles.ridePlatformLogoFallback}>
                          <Text style={styles.ridePlatformLogoText}>
                            {platform.name?.slice(0, 1) ?? '?'}
                          </Text>
                        </View>
                      )}

                      <Text
                        style={[
                          styles.ridePlatformName,
                          selected && styles.ridePlatformNameActive,
                        ]}
                        numberOfLines={1}
                      >
                        {platform.name}
                      </Text>

                      {selected ? (
                        <Ionicons name="checkmark-circle" size={20} color="#06130B" />
                      ) : (
                        <Ionicons name="ellipse-outline" size={19} color="#52525B" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.rideInputsRow}>
                <View style={styles.rideInputCard}>
                  <View style={styles.rideInputIconGreen}>
                    <Ionicons name="cash-outline" size={19} color="#22C55E" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.rideInputLabel}>Valor da corrida</Text>
                    <TextInput
                      value={waitingEditAmount}
                      onChangeText={(text) => setWaitingEditAmount(cleanMoneyInput(text))}
                      placeholder="0,00"
                      placeholderTextColor="#71717A"
                      keyboardType="numeric"
                      style={styles.rideInput}
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  styles.globalRideEditModalButton,
                  savingWaitingRideEdit && styles.saveGainButtonDisabled,
                ]}
                disabled={savingWaitingRideEdit}
                onPress={handleUpdateWaitingRide}
              >
                {savingWaitingRideEdit ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={21} color="#FFFFFF" />
                    <Text style={styles.globalRideEditModalButtonText}>
                      Salvar alterações
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={startWaitingRideModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.globalStartWaitingRideModalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Iniciar corrida</Text>
                <Text style={styles.modalTitle}>Informar KM inicial</Text>
              </View>

              <TouchableOpacity onPress={closeStartWaitingRideModal}>
                <Ionicons name="close" size={27} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Informe o KM atual do veículo para iniciar essa corrida aguardando.
            </Text>

            <View style={styles.rideInputCard}>
              <View style={styles.rideInputIconBlue}>
                <Ionicons name="speedometer-outline" size={19} color="#60A5FA" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.rideInputLabel}>KM inicial</Text>
                <TextInput
                  value={waitingStartKm}
                  onChangeText={(text) => setWaitingStartKm(formatKm(text))}
                  placeholder="0"
                  placeholderTextColor="#71717A"
                  keyboardType="numeric"
                  style={styles.rideInput}
                />
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.globalStartWaitingRideButton,
                savingStartWaitingRide && styles.saveGainButtonDisabled,
              ]}
              disabled={savingStartWaitingRide}
              onPress={handleStartWaitingRideFromGlobalCard}
            >
              {savingStartWaitingRide ? (
                <ActivityIndicator color="#06130B" />
              ) : (
                <>
                  <Ionicons name="play-circle-outline" size={22} color="#06130B" />
                  <Text style={styles.globalStartWaitingRideButtonText}>
                    Iniciar corrida
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={editGlobalRideModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.globalRideEditModalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              <View style={styles.globalRideEditModalHeader}>
                <View style={styles.globalRideEditModalHeaderLeft}>
                  <View style={styles.globalRideEditModalIcon}>
                    <Ionicons name="create-outline" size={23} color="#FFFFFF" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalEyebrow}>Corrida em andamento</Text>
                    <Text style={styles.modalTitle}>Editar corrida</Text>
                  </View>
                </View>

                <TouchableOpacity onPress={closeGlobalRideEditModal}>
                  <Ionicons name="close" size={27} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDescription}>
                Altere a plataforma, o valor ou o KM inicial desta corrida em andamento.
              </Text>

              <View style={styles.rideSectionHeader}>
                <View style={styles.rideSectionHeaderLeft}>
                  <View style={styles.rideSectionIcon}>
                    <Ionicons name="apps-outline" size={18} color="#22C55E" />
                  </View>

                  <View>
                    <Text style={styles.rideSectionTitle}>Plataforma</Text>
                    <Text style={styles.rideSectionSubtitle}>
                      Plataforma usada nesta corrida
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.ridePlatformsGrid}>
                {userPlatforms.map((item: any) => {
                  const platform = item.platform;

                  if (!platform) return null;

                  const selected = globalEditRidePlatform === platform.name;

                  return (
                    <TouchableOpacity
                      key={platform.id}
                      activeOpacity={0.86}
                      style={[
                        styles.ridePlatformCard,
                        selected && styles.ridePlatformCardActive,
                      ]}
                      onPress={() => setGlobalEditRidePlatform(platform.name)}
                    >
                      {platform.logo_url ? (
                        <Image
                          source={{ uri: platform.logo_url }}
                          style={styles.ridePlatformLogo}
                        />
                      ) : (
                        <View style={styles.ridePlatformLogoFallback}>
                          <Text style={styles.ridePlatformLogoText}>
                            {platform.name?.slice(0, 1) ?? '?'}
                          </Text>
                        </View>
                      )}

                      <Text
                        style={[
                          styles.ridePlatformName,
                          selected && styles.ridePlatformNameActive,
                        ]}
                        numberOfLines={1}
                      >
                        {platform.name}
                      </Text>

                      {selected ? (
                        <Ionicons name="checkmark-circle" size={20} color="#06130B" />
                      ) : (
                        <Ionicons name="ellipse-outline" size={19} color="#52525B" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.rideInputsRow}>
                <View style={styles.rideInputCard}>
                  <View style={styles.rideInputIconGreen}>
                    <Ionicons name="cash-outline" size={19} color="#22C55E" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.rideInputLabel}>Valor da corrida</Text>
                    <TextInput
                      value={globalEditRideAmount}
                      onChangeText={(text) => setGlobalEditRideAmount(cleanMoneyInput(text))}
                      placeholder="0,00"
                      placeholderTextColor="#71717A"
                      keyboardType="numeric"
                      style={styles.rideInput}
                    />
                  </View>
                </View>

                <View style={styles.rideInputCard}>
                  <View style={styles.rideInputIconBlue}>
                    <Ionicons name="speedometer-outline" size={19} color="#60A5FA" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.rideInputLabel}>KM inicial</Text>
                    <TextInput
                      value={globalEditRideStartKm}
                      onChangeText={(text) => setGlobalEditRideStartKm(formatKm(text))}
                      placeholder="0"
                      placeholderTextColor="#71717A"
                      keyboardType="numeric"
                      style={styles.rideInput}
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  styles.globalRideEditModalButton,
                  savingGlobalRideEdit && styles.saveGainButtonDisabled,
                ]}
                disabled={savingGlobalRideEdit}
                onPress={handleUpdateGlobalActiveRide}
              >
                {savingGlobalRideEdit ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={21} color="#FFFFFF" />
                    <Text style={styles.globalRideEditModalButtonText}>
                      Salvar alterações
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={finishGlobalRideModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.globalRideFinishModalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Concluir corrida</Text>
                <Text style={styles.modalTitle}>Finalizar corrida</Text>
              </View>

              <TouchableOpacity onPress={closeGlobalRideFinishModal}>
                <Ionicons name="close" size={27} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Informe o KM final para calcular o desempenho real desta corrida.
            </Text>

            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Valor</Text>
                <TextInput
                  value={globalRideAmount}
                  onChangeText={(text) => setGlobalRideAmount(maskCurrency(text))}
                  placeholder="0,00"
                  placeholderTextColor="#71717A"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>KM final</Text>
                <TextInput
                  value={globalRideEndKm}
                  onChangeText={(text) => setGlobalRideEndKm(formatKm(text))}
                  placeholder="0"
                  placeholderTextColor="#71717A"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.globalRideFinishModalButton,
                savingGlobalRideFinish && styles.saveGainButtonDisabled,
              ]}
              disabled={savingGlobalRideFinish}
              onPress={handleFinishGlobalActiveRide}
            >
              {savingGlobalRideFinish ? (
                <ActivityIndicator color="#06130B" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#06130B" />
                  <Text style={styles.globalRideFinishModalButtonText}>
                    Concluir corrida
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={platformDrawerVisible} transparent animationType="slide">
        <View style={styles.platformDrawerOverlay}>
          <View style={styles.platformDrawerContent}>
            <View style={styles.drawerHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Configuração</Text>
                <Text style={styles.modalTitle}>Minhas plataformas</Text>
              </View>

              <TouchableOpacity onPress={closePlatformDrawerAndReturn}>
                <Ionicons name="close" size={27} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Escolha quais plataformas devem aparecer nos formulários de ganhos e corridas.
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.platformDrawerList}
            >
              {platformsList.map((platform: any) => {
                const selected = selectedPlatformIds.includes(platform.id);

                return (
                  <TouchableOpacity
                    key={platform.id}
                    activeOpacity={0.86}
                    style={[
                      styles.platformDrawerItem,
                      selected && styles.platformDrawerItemActive,
                    ]}
                    onPress={() => togglePlatformSelection(platform.id)}
                  >
                    <View style={styles.platformDrawerLeft}>
                      {platform.logo_url ? (
                        <Image
                          source={{ uri: platform.logo_url }}
                          style={styles.platformDrawerLogo}
                        />
                      ) : (
                        <View style={styles.platformDrawerLogoFallback}>
                          <Text style={styles.platformDrawerLogoText}>
                            {platform.name?.slice(0, 1) ?? '?'}
                          </Text>
                        </View>
                      )}

                      <Text
                        style={[
                          styles.platformDrawerName,
                          selected && styles.platformDrawerNameActive,
                        ]}
                      >
                        {platform.name}
                      </Text>
                    </View>

                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={selected ? '#22C55E' : '#71717A'}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.savePlatformsButton}
              onPress={handleSaveUserPlatforms}
            >
              <Text style={styles.savePlatformsButtonText}>Salvar plataformas</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function QuickActionButton({
  icon,
  label,
  onPress,
  style,
  iconBoxStyle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  style: any;
  iconBoxStyle: any;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[styles.quickActionButton, style]}
      onPress={onPress}
    >
      <View style={[styles.quickActionIconBox, iconBoxStyle]}>
        <Ionicons name={icon} size={24} color="#FFFFFF" />
      </View>

      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  iconBox: {
    width: 39,
    height: 39,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconBoxActive: {
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },

  centerButton: {
    position: 'absolute',
    left: '50%',
    marginLeft: -33,
    top: -27,

    width: 66,
    height: 66,
    borderRadius: 999,

    backgroundColor: '#22C55E',
    borderWidth: 5,
    borderColor: '#09090B',

    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#22C55E',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.42,
    shadowRadius: 16,
    elevation: 14,
  },

  centerButtonOpen: {
    transform: [{ rotate: '45deg' }],
  },

  quickBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.80)',
    zIndex: 60,
  },

  quickActionsWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'ios' ? 60 : 60,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300,
    elevation: 300,
  },

  quickActionButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 310,
    elevation: 310,
  },

  quickActionGain: {
    transform: [{ translateX: -118 }, { translateY: 24 }],
  },

  quickActionExpense: {
    transform: [{ translateX: 0 }, { translateY: -54 }],
  },

  quickActionJourney: {
    transform: [{ translateX: 118 }, { translateY: 24 }],
  },

  quickActionRide: {
    transform: [{ translateX: 118 }, { translateY: 24 }],
  },

  quickActionIconBox: {
    width: 58,
    height: 58,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 10,
  },

  quickActionIconGreen: {
    backgroundColor: '#16A34A',
  },

  quickActionIconRed: {
    backgroundColor: '#EF4444',
  },

  quickActionIconBlue: {
    backgroundColor: '#3B82F6',
  },

  quickActionIconPurple: {
    backgroundColor: '#7C3AED',
  },

  quickActionLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 6,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#27272A',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },

  globalRideMiniStack: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: Platform.OS === 'ios' ? 94 : 90,
    gap: 8,
    zIndex: 80,
  },

  globalRideMiniBackdrop: {
    position: 'absolute',
    left: -10,
    right: -10,
    top: -10,
    bottom: -10,
    borderRadius: 32,
    backgroundColor: 'rgba(3,7,18,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },

  globalRideMiniCard: {
    minHeight: 70,
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 24,
  },

  globalRideMiniIcon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  globalRideMiniLogo: {
    width: 46,
    height: 46,
    backgroundColor: '#FFFFFF',
  },

  globalRideMiniCenter: {
    flex: 1,
  },

  globalRideMiniStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  globalRideMiniLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },

  globalRideMiniStatusText: {
    color: '#BBF7D0',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },

  globalRideMiniTimer: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },

  globalRideMiniRight: {
    alignItems: 'flex-end',
  },

  globalRideMiniAmount: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  globalRideMiniPerHour: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 3,
  },

  globalWaitingRideMiniCard: {
    minHeight: 58,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.28)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 18,
  },

  globalWaitingRideMiniIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  globalWaitingRideMiniLogo: {
    width: 38,
    height: 38,
    backgroundColor: '#FFFFFF',
  },

  globalWaitingRidePlatform: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  globalWaitingRideStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },

  globalWaitingRideStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#60A5FA',
  },

  globalWaitingRideStatusText: {
    color: '#BFDBFE',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  globalWaitingRideAmount: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  globalWaitingRideExpandedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'ios' ? 94 : 90,
    zIndex: 110,
  },

  globalWaitingRideExpandedCard: {
    borderRadius: 30,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 30,
  },

  globalWaitingRideExpandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },

  globalWaitingRideExpandedTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },

  globalWaitingRideExpandedIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  globalWaitingRideExpandedLogo: {
    width: 50,
    height: 50,
    backgroundColor: '#FFFFFF',
  },

  globalWaitingRideExpandedEyebrow: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  globalWaitingRideExpandedTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },

  globalWaitingRideExpandedValueBox: {
    borderRadius: 24,
    backgroundColor: 'rgba(96,165,250,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.24)',
    padding: 16,
    marginBottom: 14,
  },

  globalWaitingRideExpandedValueLabel: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '800',
  },

  globalWaitingRideExpandedValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },

  globalWaitingRideExpandedActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },

  globalRideExpandedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'ios' ? 94 : 90,
    zIndex: 100,
  },

  globalRideExpandedCard: {
    borderRadius: 30,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 30,
  },

  globalRideExpandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },

  globalRideExpandedTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },

  globalRideExpandedIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  globalRideExpandedLogo: {
    width: 50,
    height: 50,
    backgroundColor: '#FFFFFF',
  },

  globalRideExpandedEyebrow: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  globalRideExpandedTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },

  globalRideMinimizeButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  globalRideExpandedTimerBox: {
    borderRadius: 24,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.24)',
    padding: 16,
    marginBottom: 12,
  },

  globalRideExpandedTimerLabel: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '800',
  },

  globalRideExpandedTimerValue: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    marginTop: 3,
  },

  globalRideExpandedStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },

  globalRideExpandedStatBox: {
    width: '48%',
    minHeight: 74,
    borderRadius: 20,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 12,
    justifyContent: 'center',
  },

  globalRideExpandedStatLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 5,
  },

  globalRideExpandedStatValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  globalRideExpandedStatValueGreen: {
    color: '#4ADE80',
    fontSize: 15,
    fontWeight: '900',
  },

  globalRideExpandedStatValueBlue: {
    color: '#60A5FA',
    fontSize: 15,
    fontWeight: '900',
  },

  globalRideExpandedActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  globalRideDeleteButton: {
    flex: 1,
    height: 56,
    borderRadius: 19,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  globalRideDeleteButtonText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '900',
  },

  globalRideEditButton: {
    flex: 1,
    height: 56,
    borderRadius: 19,
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  globalRideEditButtonText: {
    color: '#BFDBFE',
    fontSize: 14,
    fontWeight: '900',
  },

  globalRideFinishButton: {
    flex: 1.25,
    height: 56,
    borderRadius: 19,
    backgroundColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  globalRideFinishButtonText: {
    color: '#06130B',
    fontSize: 14,
    fontWeight: '900',
  },

  globalStartWaitingRideModalContent: {
    backgroundColor: '#111827',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
  },

  globalStartWaitingRideButton: {
    height: 58,
    borderRadius: 19,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },

  globalStartWaitingRideButtonText: {
    color: '#06130B',
    fontSize: 15,
    fontWeight: '900',
  },

  globalRideEditModalContent: {
    backgroundColor: '#0B1220',
    borderRadius: 30,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    maxHeight: '92%',
  },

  globalRideEditModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },

  globalRideEditModalHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  globalRideEditModalIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  globalRideEditModalButton: {
    height: 58,
    borderRadius: 19,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },

  globalRideEditModalButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  globalRideFinishModalContent: {
    backgroundColor: '#111827',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
  },

  globalRideFinishModalButton: {
    height: 58,
    borderRadius: 19,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },

  globalRideFinishModalButtonText: {
    color: '#06130B',
    fontSize: 15,
    fontWeight: '900',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 18,
    justifyContent: 'center',
  },

  gainModalContent: {
    backgroundColor: '#111827',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
    maxHeight: '92%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },

  modalEyebrow: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 2,
  },

  modalDescription: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginBottom: 18,
  },

  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  fieldLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
    marginLeft: 4,
  },

  managePlatformsButton: {
    height: 34,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  managePlatformsButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  emptyPlatformsBox: {
    minHeight: 140,
    borderRadius: 22,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginBottom: 14,
  },

  emptyPlatformsTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 10,
  },

  emptyPlatformsText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },

  platformsHorizontalList: {
    gap: 8,
    paddingBottom: 14,
  },

  platformChip: {
    width: 102,
    minHeight: 82,
    borderRadius: 20,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 9,
    gap: 7,
  },

  platformChipActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  platformChipLogo: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },

  platformChipLogoFallback: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  platformChipLogoText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  platformChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },

  platformChipTextActive: {
    color: '#06130B',
  },

  selectedPlatformPreview: {
    minHeight: 42,
    borderRadius: 15,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },

  selectedPlatformLogo: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },

  selectedPlatformPreviewText: {
    flex: 1,
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: '900',
  },

  input: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#FFFFFF',
    paddingHorizontal: 15,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 13,
  },

  inputError: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },

  errorText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
    marginTop: -3,
    marginBottom: 10,
    marginLeft: 4,
    lineHeight: 17,
  },

  formRow: {
    flexDirection: 'row',
    gap: 10,
  },

  saveGainButton: {
    height: 58,
    borderRadius: 19,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },

  saveGainButtonDisabled: {
    opacity: 0.65,
  },

  saveGainButtonText: {
    color: '#06130B',
    fontSize: 15,
    fontWeight: '900',
  },

  rideModalContent: {
    backgroundColor: '#0B1220',
    borderRadius: 30,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    maxHeight: '92%',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.34,
    shadowRadius: 24,
    elevation: 18,
  },

  rideModalScrollContent: {
    paddingBottom: 18,
  },

  rideCreateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },

  rideCreateHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  rideCreateHeaderIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },

  rideCreateHeaderIconQueue: {
    backgroundColor: '#60A5FA',
    shadowColor: '#60A5FA',
  },

  rideCreateEyebrow: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  rideCreateTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },

  rideCreateCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rideCreateDescription: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 16,
  },

  rideInfoCard: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: 'rgba(96,165,250,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.22)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    marginBottom: 16,
  },

  rideInfoIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(96,165,250,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rideInfoText: {
    flex: 1,
    color: '#DBEAFE',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },

  rideSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },

  rideSectionHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  rideSectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rideSectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  rideSectionSubtitle: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },

  rideManagePlatformsButton: {
    height: 36,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  rideManagePlatformsButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  ridePlatformsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },

  ridePlatformCard: {
    width: '48%',
    minHeight: 62,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  ridePlatformCardActive: {
    backgroundColor: '#22C55E',
    borderColor: '#86EFAC',
  },

  ridePlatformLogo: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },

  ridePlatformLogoFallback: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  ridePlatformLogoText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  ridePlatformName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  ridePlatformNameActive: {
    color: '#06130B',
  },

  rideInputsRow: {
    gap: 10,
    marginBottom: 6,
  },

  rideInputCard: {
    minHeight: 64,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  rideInputIconGreen: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rideInputIconBlue: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(96,165,250,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rideInputLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },

  rideInput: {
    minHeight: 32,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    padding: 0,
  },

  saveRideButton: {
    height: 60,
    borderRadius: 20,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    shadowColor: '#22C55E',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 10,
  },

  saveRideButtonText: {
    color: '#06130B',
    fontSize: 15,
    fontWeight: '900',
  },

  platformDrawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },

  platformDrawerContent: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
    maxHeight: '86%',
  },

  drawerHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 16,
  },

  platformDrawerList: {
    gap: 10,
    paddingBottom: 18,
  },

  platformDrawerItem: {
    minHeight: 62,
    borderRadius: 20,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    gap: 12,
  },

  platformDrawerItemActive: {
    borderColor: 'rgba(34,197,94,0.55)',
    backgroundColor: 'rgba(34,197,94,0.10)',
  },

  platformDrawerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
  },

  platformDrawerLogo: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },

  platformDrawerLogoFallback: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  platformDrawerLogoText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  platformDrawerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  platformDrawerNameActive: {
    color: '#86EFAC',
  },

  savePlatformsButton: {
    height: 56,
    borderRadius: 19,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  savePlatformsButtonText: {
    color: '#06130B',
    fontSize: 15,
    fontWeight: '900',
  },
});
