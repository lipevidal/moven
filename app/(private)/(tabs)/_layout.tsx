/**
 * Arquivo: app/(private)/(tabs)/_layout.tsx
 *
 * Este arquivo controla a navegação principal por abas do app.
 *
 * Ele também concentra várias funcionalidades globais que precisam aparecer
 * por cima das telas, como:
 *
 * - Botão central de ações rápidas;
 * - Modal de ganho avulso;
 * - Modal para iniciar corrida;
 * - Modal para editar/finalizar corrida ativa;
 * - Modal para gerenciar plataformas;
 * - Modal para definir parâmetros de desempenho;
 * - Cards flutuantes de corrida em andamento ou aguardando;
 * - Realtime do Supabase para atualizar jornada, ganhos e corridas;
 * - Comunicação global via DeviceEventEmitter com dashboard e jornada ativa.
 *
 * A ideia deste arquivo é funcionar como uma "camada global" das tabs.
 * Por isso, além da navegação, ele também gerencia elementos que precisam
 * aparecer independentemente da tela aberta.
 *
 * Otimizações aplicadas nesta versão:
 * - refresh da jornada ativa com debounce;
 * - proteção contra consultas simultâneas ao Supabase;
 * - cache simples para plataformas e parâmetros de desempenho;
 * - timer de 1 segundo ativo somente quando existe corrida em andamento.
 */

// Hooks principais do React usados para estado, efeitos e callbacks memorizados.
import { useCallback, useEffect, useRef, useState } from 'react';
// Componentes nativos do React Native usados na interface da tab, modais e cards.
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
// Tabs cria a navegação inferior; router faz navegação programática;
// useFocusEffect executa carregamentos sempre que a tela/aba volta ao foco.
import { Tabs, router, useFocusEffect } from 'expo-router';
// Biblioteca de ícones usada em botões, tabs, cards e modais.
import { Ionicons } from '@expo/vector-icons';

// Cliente Supabase usado para autenticação, consultas e realtime.
import { supabase } from '../../../src/database/supabase';
// Serviços relacionados às plataformas do usuário.
import { getPlatforms } from '../../../src/features/platforms/services/getPlatforms';
import { getUserPlatforms } from '../../../src/features/platforms/services/getUserPlatforms';
import { toggleUserPlatform } from '../../../src/features/platforms/services/toggleUserPlatform';
import { createRide } from '../../../src/features/rides/services/createRide';
import { deleteRide } from '../../../src/features/rides/services/deleteRide';
import { finishRide } from '../../../src/features/rides/services/finishRide';
import { startWaitingRide } from '../../../src/features/rides/services/startWaitingRide';
import { updateRide } from '../../../src/features/rides/services/updateRide';

/**
 * Define os possíveis erros de validação do formulário de ganho avulso.
 * Cada campo é opcional porque só recebe mensagem quando houver erro.
 */
type StandaloneGainErrors = {
  platform?: string;
  description?: string;
  date?: string;
  amount?: string;
};

/**
 * Representa os parâmetros de desempenho salvos no banco.
 *
 * bad_gain_per_hour: valor abaixo do qual o ganho por hora é ruim.
 * good_gain_per_hour: valor a partir do qual o ganho por hora é bom.
 * bad_gain_per_km: valor abaixo do qual o ganho por KM é ruim.
 * good_gain_per_km: valor a partir do qual o ganho por KM é bom.
 */
type PerformanceTargets = {
  bad_gain_per_hour: number;
  good_gain_per_hour: number;
  bad_gain_per_km: number;
  good_gain_per_km: number;
};

/**
 * Versão usada no formulário antes de salvar no banco.
 * Usa nomes em camelCase porque fica mais confortável no front-end.
 */
type PerformanceTargetDraft = {
  badGainPerHour: number;
  goodGainPerHour: number;
  badGainPerKm: number;
  goodGainPerKm: number;
};

// Valores padrão exibidos quando o usuário ainda não configurou seus parâmetros.
const DEFAULT_PERFORMANCE_TARGETS: PerformanceTargetDraft = {
  badGainPerHour: 30,
  goodGainPerHour: 50,
  badGainPerKm: 1.5,
  goodGainPerKm: 2.5,
};

// Opções disponíveis nos seletores de parâmetros de desempenho.
const BAD_GAIN_PER_HOUR_OPTIONS = [20, 25, 30, 35, 40, 45, 50];
const GOOD_GAIN_PER_HOUR_OPTIONS = [40, 45, 50, 55, 60, 70, 80, 100];
const BAD_GAIN_PER_KM_OPTIONS = [0.8, 1, 1.2, 1.5, 1.8, 2];
const GOOD_GAIN_PER_KM_OPTIONS = [1.5, 1.8, 2, 2.2, 2.5, 3, 3.5, 4];

/**
 * Formata uma data no padrão brasileiro dd/mm/aaaa.
 * Usado para preencher o campo de data do ganho avulso.
 */
function formatDateInput(date: Date) {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Aplica máscara de data enquanto o usuário digita.
 * Exemplo: 01072026 vira 01/07/2026.
 */
function maskDateInput(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 8);

  if (numbers.length <= 2) return numbers;

  if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  }

  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4)}`;
}

/**
 * Converte uma string dd/mm/aaaa em Date.
 * Também valida se a data realmente existe.
 */
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

/**
 * Aplica máscara monetária.
 * O usuário digita números e a função converte para formato 0,00.
 */
function maskCurrency(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 12);

  if (!numbers) return '';

  return (Number(numbers) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte texto monetário brasileiro para número.
 * Exemplo: "1.250,50" vira 1250.50.
 */
function parseCurrency(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : 0;
}

/**
 * Mantém apenas números no campo de KM e formata com separador pt-BR.
 */
function formatKm(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 6);

  return numbers ? Number(numbers).toLocaleString('pt-BR') : '';
}

/**
 * Remove pontuação e retorna apenas o valor numérico.
 * Usado principalmente para KM.
 */
function onlyNumbers(value: string) {
  return Number(value.replace(/\./g, '')) || 0;
}

/**
 * Permite que o campo de dinheiro aceite apenas números, ponto e vírgula.
 */
function cleanMoneyInput(value: string) {
  return value.replace(/[^0-9.,]/g, '');
}

/**
 * Formata número em moeda brasileira, sem colocar "R$" automaticamente.
 */
function formatCurrency(value: number) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


/**
 * Formata valores dos parâmetros de desempenho.
 * Se for inteiro, mostra sem casas decimais. Se tiver centavos, mostra com 2.
 */
function formatTargetMoney(value: number) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte os dados vindos do Supabase para o formato PerformanceTargets.
 * Retorna null quando os dados estão incompletos ou inválidos.
 */
function mapPerformanceTargetsFromDatabase(data: any): PerformanceTargets | null {
  if (!data) return null;

  const targets = {
    bad_gain_per_hour: Number(data.bad_gain_per_hour ?? 0),
    good_gain_per_hour: Number(data.good_gain_per_hour ?? 0),
    bad_gain_per_km: Number(data.bad_gain_per_km ?? 0),
    good_gain_per_km: Number(data.good_gain_per_km ?? 0),
  };

  return isPerformanceTargetsComplete(targets) ? targets : null;
}

/**
 * Verifica se os parâmetros de desempenho estão preenchidos e coerentes.
 * O valor "bom" precisa ser maior que o valor "ruim".
 */
function isPerformanceTargetsComplete(targets?: PerformanceTargets | null) {
  if (!targets) return false;

  return (
    Number(targets.bad_gain_per_hour) > 0 &&
    Number(targets.good_gain_per_hour) > 0 &&
    Number(targets.bad_gain_per_km) > 0 &&
    Number(targets.good_gain_per_km) > 0 &&
    Number(targets.bad_gain_per_hour) < Number(targets.good_gain_per_hour) &&
    Number(targets.bad_gain_per_km) < Number(targets.good_gain_per_km)
  );
}

/**
 * Monta o rascunho usado pelo modal de parâmetros.
 * Se não houver dados salvos, usa os valores padrão.
 */
function getPerformanceTargetDraft(
  targets?: PerformanceTargets | null,
): PerformanceTargetDraft {
  if (!targets) return DEFAULT_PERFORMANCE_TARGETS;

  return {
    badGainPerHour: Number(targets.bad_gain_per_hour),
    goodGainPerHour: Number(targets.good_gain_per_hour),
    badGainPerKm: Number(targets.bad_gain_per_km),
    goodGainPerKm: Number(targets.good_gain_per_km),
  };
}

/**
 * Converte segundos para o formato HH:mm:ss.
 * Usado nos cards de corrida ativa.
 */
function formatTimer(seconds: number) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');

  return `${h}:${m}:${s}`;
}

/**
 * Calcula há quantos segundos uma corrida começou.
 * Recebe o started_at vindo do banco.
 */
function calculateSecondsFromDate(date?: string | null) {
  if (!date) return 0;

  const start = new Date(date).getTime();
  const now = new Date().getTime();

  const seconds = Math.floor((now - start) / 1000);

  return seconds > 0 ? seconds : 0;
}

/**
 * Converte uma data local para ISO sem deslocar o dia por causa do timezone.
 * Isso evita salvar uma data escolhida pelo usuário no dia anterior/seguinte.
 */
function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, -1);
}

/**
 * Remove canais realtime antigos com o mesmo nome antes de criar um novo.
 *
 * Isso evita o erro:
 * "cannot add postgres_changes callbacks ... after subscribe()"
 *
 * Esse erro costuma acontecer no Expo/React Native em recarregamentos rápidos,
 * hot reload ou navegação, quando um canal antigo continua inscrito e o app
 * tenta reaproveitar/adicionar callbacks no mesmo tópico já inscrito.
 */
function removeExistingRealtimeChannels(channelName: string) {
  const realtimeTopic = `realtime:${channelName}`;

  supabase.getChannels().forEach((channel: any) => {
    if (channel?.topic === realtimeTopic || channel?.topic === channelName) {
      supabase.removeChannel(channel);
    }
  });
}

/**
 * Remove um canal realtime com segurança.
 */
function removeRealtimeChannel(channel?: ReturnType<typeof supabase.channel> | null) {
  if (!channel) return;

  supabase.removeChannel(channel);
}

/**
 * Componente principal das tabs.
 *
 * Além de renderizar a navegação inferior, ele gerencia:
 * - Estado da jornada ativa;
 * - Corridas em andamento ou aguardando;
 * - Formulários globais de ganho, corrida e parâmetros;
 * - Plataforma selecionadas pelo usuário;
 * - Botão central de ações rápidas;
 * - Cards flutuantes de corrida;
 * - Realtime com Supabase.
 */
export default function TabsLayout() {
  /**
   * Refs de performance.
   *
   * Esses refs não causam re-render quando mudam. Por isso são melhores para
   * controlar carregamentos, cache simples e debounce de eventos globais.
   */
  const loadingActiveSessionRef = useRef(false);
  const pendingActiveSessionRefreshRef = useRef(false);
  const activeSessionRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const platformsLoadedRef = useRef(false);
  const performanceTargetsLoadedRef = useRef(false);
  const performanceTargetsRef = useRef<PerformanceTargets | null>(null);

  // Indica se o usuário possui uma jornada ativa ou pausada.
  const [hasActiveSession, setHasActiveSession] = useState(false);
  // Guarda os dados da jornada ativa/pausada encontrada no banco.
  const [activeSession, setActiveSession] = useState<any>(null);
  // Lista de corridas vinculadas à jornada ativa atual.
  const [activeSessionRides, setActiveSessionRides] = useState<any[]>([]);
  // Controla se o card flutuante da corrida ativa está expandido.
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
  const [, setNowTick] = useState(Date.now());
  // Controla a abertura do menu de ações rápidas do botão central '+'.
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);

  // Modal de ganho avulso, usado para ganhos sem vínculo com jornada.
  const [standaloneGainModalVisible, setStandaloneGainModalVisible] =
    useState(false);
  // Modal usado para iniciar/adicionar uma corrida dentro da jornada atual.
  const [rideModalVisible, setRideModalVisible] = useState(false);
  const [ridePlatform, setRidePlatform] = useState('');
  const [rideAmount, setRideAmount] = useState('');
  const [rideStartKm, setRideStartKm] = useState('');
  const [savingRide, setSavingRide] = useState(false);
  // Drawer inferior para gerenciar quais plataformas o usuário usa.
  const [platformDrawerVisible, setPlatformDrawerVisible] = useState(false);
  const [
    returnToStandaloneGainAfterPlatforms,
    setReturnToStandaloneGainAfterPlatforms,
  ] = useState(false);
  const [returnToRideModalAfterPlatforms, setReturnToRideModalAfterPlatforms] =
    useState(false);

  // Todas as plataformas cadastradas no sistema.
  const [platformsList, setPlatformsList] = useState<any[]>([]);
  // Plataformas selecionadas pelo usuário.
  const [userPlatforms, setUserPlatforms] = useState<any[]>([]);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);

  // Campos do formulário de ganho avulso.
  const [gainPlatform, setGainPlatform] = useState('');
  const [gainDescription, setGainDescription] = useState('');
  const [gainDate, setGainDate] = useState(formatDateInput(new Date()));
  const [gainAmount, setGainAmount] = useState('');
  const [gainErrors, setGainErrors] = useState<StandaloneGainErrors>({});
  const [savingGain, setSavingGain] = useState(false);


  // Parâmetros de desempenho salvos para o usuário.
  const [performanceTargets, setPerformanceTargets] =
    useState<PerformanceTargets | null>(null);
  const [performanceTargetsModalVisible, setPerformanceTargetsModalVisible] =
    useState(false);
  const [performanceTargetDraft, setPerformanceTargetDraft] =
    useState<PerformanceTargetDraft>(DEFAULT_PERFORMANCE_TARGETS);
  const [savingPerformanceTargets, setSavingPerformanceTargets] =
    useState(false);
  const [openJourneyAfterPerformanceTargets, setOpenJourneyAfterPerformanceTargets] =
    useState(false);

  /**
   * Sempre que o layout das tabs ganha foco, recarrega o essencial.
   *
   * Otimização:
   * - jornada ativa sempre pode mudar, então é recarregada;
   * - plataformas e parâmetros usam cache simples por ref para evitar chamadas
   *   repetidas ao Supabase toda vez que o usuário alterna de aba.
   */
  useFocusEffect(
    useCallback(() => {
      scheduleActiveSessionRefresh(0);
      loadPlatforms();
      loadPerformanceTargets();
    }, []),
  );

  /**
   * Agenda o recarregamento da jornada ativa com debounce.
   *
   * Antes, vários eventos/realtime podiam chamar loadActiveSession ao mesmo tempo.
   * Agora as chamadas próximas são agrupadas em uma só, deixando a navegação
   * global mais leve.
   */
  function scheduleActiveSessionRefresh(delay = 120) {
    if (activeSessionRefreshTimeoutRef.current) {
      clearTimeout(activeSessionRefreshTimeoutRef.current);
    }

    activeSessionRefreshTimeoutRef.current = setTimeout(() => {
      activeSessionRefreshTimeoutRef.current = null;
      loadActiveSession();
    }, delay);
  }

  /**
   * Limpa qualquer refresh agendado ao desmontar o layout.
   */
  useEffect(() => {
    return () => {
      if (activeSessionRefreshTimeoutRef.current) {
        clearTimeout(activeSessionRefreshTimeoutRef.current);
        activeSessionRefreshTimeoutRef.current = null;
      }
    };
  }, []);

  /**
   * Avisa outros componentes quando o menu de ações rápidas está aberto.
   * Isso permite, por exemplo, esconder/ajustar elementos flutuantes em outras telas.
   */
  useEffect(() => {
    DeviceEventEmitter.emit(
      'movenapp:quick-actions-visible',
      quickActionsVisible,
    );

    return () => {
      DeviceEventEmitter.emit('movenapp:quick-actions-visible', false);
    };
  }, [quickActionsVisible]);

  /**
   * Atualiza o timer somente quando existe corrida ativa.
   *
   * Antes este intervalo rodava a cada segundo sempre que o usuário estava logado,
   * mesmo sem corrida em andamento. Isso fazia o layout inteiro das tabs
   * re-renderizar sem necessidade.
   */
  useEffect(() => {
    const hasActiveRideTimer = activeSessionRides.some(
      (ride) => ride.status === 'active',
    );

    if (!hasActiveRideTimer) return;

    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSessionRides]);

  /**
   * Escuta eventos internos do app para recarregar a jornada ativa.
   * Outros arquivos podem emitir esses eventos quando criam/alteram ganhos,
   * despesas, corridas ou jornadas.
   */
  useEffect(() => {
    const refreshActiveSession = () => {
      scheduleActiveSessionRefresh();
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

  /**
   * Realtime da tabela work_sessions.
   * Sempre que a jornada do usuário muda no Supabase, este layout recarrega
   * a jornada ativa automaticamente.
   *
   * Correção importante:
   * - o canal é sempre montado com .on(...) antes do .subscribe();
   * - canais antigos com o mesmo nome são removidos antes de criar outro;
   * - se o componente desmontar antes do auth.getUser() terminar, o canal não é criado.
   */
  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function startRealtime() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted || !user?.id) return;

      const channelName = `tabs-active-session-${user.id}`;

      removeExistingRealtimeChannels(channelName);

      if (!isMounted) return;

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'work_sessions',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            scheduleActiveSessionRefresh();
          },
        )
        .subscribe();
    }

    startRealtime();

    return () => {
      isMounted = false;
      removeRealtimeChannel(channel);
      channel = null;
    };
  }, []);

  /**
   * Realtime da tabela rides para a jornada ativa.
   * Atualiza cards e dashboard quando uma corrida é criada, editada,
   * iniciada, finalizada ou excluída.
   *
   * Também remove canal antigo com o mesmo nome antes de assinar novamente.
   */
  useEffect(() => {
    if (!activeSession?.id) return;

    const channelName = `tabs-active-session-rides-${activeSession.id}`;

    removeExistingRealtimeChannels(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `session_id=eq.${activeSession.id}`,
        },
        () => {
          scheduleActiveSessionRefresh();
          DeviceEventEmitter.emit('movenapp:dashboard-refresh');
        },
      )
      .subscribe();

    return () => {
      removeRealtimeChannel(channel);
    };
  }, [activeSession?.id]);

  /**
   * Realtime da tabela earnings para a jornada ativa.
   * Quando ganhos vinculados à jornada mudam, a jornada e o dashboard são atualizados.
   *
   * Também remove canal antigo com o mesmo nome antes de assinar novamente.
   */
  useEffect(() => {
    if (!activeSession?.id) return;

    const channelName = `tabs-active-session-earnings-${activeSession.id}`;

    removeExistingRealtimeChannels(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'earnings',
          filter: `session_id=eq.${activeSession.id}`,
        },
        () => {
          scheduleActiveSessionRefresh();
          DeviceEventEmitter.emit('movenapp:active-session-refresh');
          DeviceEventEmitter.emit('movenapp:dashboard-refresh');
        },
      )
      .subscribe();

    return () => {
      removeRealtimeChannel(channel);
    };
  }, [activeSession?.id]);

  /**
   * Busca no Supabase a jornada ativa ou pausada do usuário logado.
   * Também carrega as corridas vinculadas a essa jornada.
   */
  async function loadActiveSession() {
    /**
     * Evita várias consultas simultâneas quando realtime, dashboard e eventos
     * internos disparam ao mesmo tempo.
     */
    if (loadingActiveSessionRef.current) {
      pendingActiveSessionRefreshRef.current = true;
      return;
    }

    loadingActiveSessionRef.current = true;

    try {
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
    } finally {
      loadingActiveSessionRef.current = false;

      /**
       * Se algum evento pediu refresh enquanto a consulta estava rodando,
       * executa mais uma vez depois, também com debounce.
       */
      if (pendingActiveSessionRefreshRef.current) {
        pendingActiveSessionRefreshRef.current = false;
        scheduleActiveSessionRefresh(80);
      }
    }
  }

  /**
   * Carrega todas as plataformas do sistema e as plataformas selecionadas pelo usuário.
   */
  async function loadPlatforms(force = false) {
    /**
     * Evita recarregar plataformas em toda troca de aba.
     *
     * Quando o usuário salva alterações no drawer, usamos force=true para
     * buscar os dados atualizados.
     */
    if (platformsLoadedRef.current && !force) return;

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
      platformsLoadedRef.current = true;
    } catch (error) {
      console.log('Erro ao carregar plataformas:', error);
    }
  }

  /**
   * Renderiza os ícones das tabs.
   * Quando a tab está ativa, o ícone fica dourado e levemente maior.
   */
  function renderTabIcon(
    iconName: keyof typeof Ionicons.glyphMap,
    focused: boolean,
    color: string,
  ) {
    return (
      <View style={styles.iconBox}>
        <Ionicons
          name={iconName}
          size={focused ? 25 : 22}
          color={focused ? '#D4A64A' : color}
        />
      </View>
    );
  }

  /**
   * Limpa todos os campos e erros do formulário de ganho avulso.
   */
  function resetStandaloneGainForm() {
    setGainPlatform('');
    setGainDescription('');
    setGainDate(formatDateInput(new Date()));
    setGainAmount('');
    setGainErrors({});
  }

  /**
   * Abre o modal de ganho avulso e recarrega plataformas antes de exibir.
   */
  async function openStandaloneGainModal() {
    setQuickActionsVisible(false);
    resetStandaloneGainForm();
    await loadPlatforms();
    setStandaloneGainModalVisible(true);
  }

  /**
   * Navega para a aba de despesas já pedindo para abrir o formulário de nova despesa.
   */
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


  /**
   * Busca os parâmetros de desempenho do usuário no Supabase.
   */
  async function loadPerformanceTargets(force = false) {
    /**
     * Evita buscar parâmetros repetidamente no Supabase.
     *
     * Eles só mudam quando o próprio usuário salva o modal de parâmetros,
     * então podemos reaproveitar o valor em memória durante a sessão atual.
     */
    if (performanceTargetsLoadedRef.current && !force) {
      return performanceTargetsRef.current;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      performanceTargetsRef.current = null;
      setPerformanceTargets(null);
      return null;
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
      performanceTargetsRef.current = null;
      setPerformanceTargets(null);
      return null;
    }

    const targets = mapPerformanceTargetsFromDatabase(data);

    performanceTargetsRef.current = targets;
    performanceTargetsLoadedRef.current = true;
    setPerformanceTargets(targets);

    if (targets) {
      setPerformanceTargetDraft(getPerformanceTargetDraft(targets));
    }

    return targets;
  }

  /**
   * Abre o modal de parâmetros.
   * Também pode ser usado antes de iniciar jornada, obrigando o usuário a configurar metas.
   */
  function openPerformanceTargetsModal({
    openJourneyAfterSave = false,
  }: { openJourneyAfterSave?: boolean } = {}) {
    setQuickActionsVisible(false);
    setPerformanceTargetDraft(
      getPerformanceTargetDraft(performanceTargets),
    );
    setOpenJourneyAfterPerformanceTargets(openJourneyAfterSave);
    setPerformanceTargetsModalVisible(true);
  }

  /**
   * Fecha o modal de parâmetros e limpa estados auxiliares.
   */
  function closePerformanceTargetsModal() {
    setPerformanceTargetsModalVisible(false);
    setOpenJourneyAfterPerformanceTargets(false);
    setSavingPerformanceTargets(false);
  }

  /**
   * Valida e salva os parâmetros de desempenho do usuário no Supabase.
   */
  async function handleSavePerformanceTargets() {
    if (performanceTargetDraft.badGainPerHour >= performanceTargetDraft.goodGainPerHour) {
      Alert.alert(
        'Ajuste o ganho por hora',
        'O ganho por hora bom precisa ser maior que o ganho por hora ruim.',
      );
      return;
    }

    if (performanceTargetDraft.badGainPerKm >= performanceTargetDraft.goodGainPerKm) {
      Alert.alert(
        'Ajuste o ganho por KM',
        'O ganho por KM bom precisa ser maior que o ganho por KM ruim.',
      );
      return;
    }

    try {
      setSavingPerformanceTargets(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user?.id) {
        Alert.alert('Sessão expirada', 'Entre novamente para salvar os parâmetros.');
        return;
      }

      const payload = {
        user_id: user.id,
        bad_gain_per_hour: performanceTargetDraft.badGainPerHour,
        good_gain_per_hour: performanceTargetDraft.goodGainPerHour,
        bad_gain_per_km: performanceTargetDraft.badGainPerKm,
        good_gain_per_km: performanceTargetDraft.goodGainPerKm,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('user_performance_targets')
        .upsert(payload, { onConflict: 'user_id' })
        .select(
          'bad_gain_per_hour, good_gain_per_hour, bad_gain_per_km, good_gain_per_km',
        )
        .single();

      if (error) throw error;

      const targets = mapPerformanceTargetsFromDatabase(data);

      performanceTargetsRef.current = targets;
      performanceTargetsLoadedRef.current = true;
      setPerformanceTargets(targets);
      setPerformanceTargetsModalVisible(false);

      if (openJourneyAfterPerformanceTargets) {
        setOpenJourneyAfterPerformanceTargets(false);
        router.push('/(private)/(tabs)/nova-jornada' as never);
      }
    } catch (error: any) {
      console.log('Erro ao salvar parâmetros de desempenho:', error);

      const message = String(error?.message ?? '').toLowerCase();

      Alert.alert(
        'Erro ao salvar parâmetros',
        message.includes('user_performance_targets') ||
          message.includes('relation') ||
          message.includes('schema cache')
          ? 'Rode o SQL da tabela user_performance_targets no Supabase e tente novamente.'
          : 'Não foi possível salvar seus parâmetros. Tente novamente.',
      );
    } finally {
      setSavingPerformanceTargets(false);
    }
  }

  /**
   * Abre a tela de nova jornada.
   * Antes disso, valida se já existe jornada ativa e se os parâmetros estão configurados.
   */
  async function openNewJourney() {
    setQuickActionsVisible(false);

    if (hasActiveSession) {
      Alert.alert(
        'Jornada em andamento',
        'Finalize ou exclua a jornada atual antes de iniciar uma nova.',
      );
      return;
    }

    const targets = performanceTargets ?? (await loadPerformanceTargets());

    if (!isPerformanceTargetsComplete(targets)) {
      setPerformanceTargetDraft(getPerformanceTargetDraft(targets));
      openPerformanceTargetsModal({ openJourneyAfterSave: true });
      return;
    }

    router.push('/(private)/(tabs)/nova-jornada' as never);
  }

  /**
   * Abre o modal de corrida a partir das ações rápidas.
   * Só permite registrar corrida quando existe jornada ativa e não pausada.
   */
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

  /**
   * Fecha e limpa o modal de corrida.
   */
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

  /**
   * Cria uma nova corrida na jornada atual.
   *
   * Se já existe uma corrida ativa, a nova entra como "waiting".
   * Se não existe corrida ativa, a nova já começa como "active".
   */
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

  /**
   * Abre o modal de ações para uma corrida aguardando início.
   */
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

  /**
   * Salva alterações em uma corrida que ainda está aguardando início.
   */
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

  /**
   * Exclui uma corrida que está aguardando início, após confirmação.
   */
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

  /**
   * Transforma uma corrida aguardando em corrida ativa.
   * Antes de iniciar, valida se não existe outra corrida em andamento.
   */
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

  /**
   * Edita dados da corrida ativa, como plataforma, valor e KM inicial.
   */
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

  /**
   * Exclui a corrida ativa após confirmação do usuário.
   */
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

  /**
   * Finaliza a corrida ativa.
   * Envia para o serviço finishRide os dados necessários para calcular
   * distância, tempo, ganho por hora e ganho por KM.
   */
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

  /**
   * Valida campos do ganho avulso antes de salvar.
   * Retorna true quando não há erros.
   */
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

  /**
   * Salva um ganho avulso no Supabase.
   * Ganho avulso não tem session_id, ou seja, não pertence a uma jornada.
   */
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

  /**
   * Marca ou desmarca uma plataforma no drawer de plataformas.
   */
  function togglePlatformSelection(platformId: string) {
    setSelectedPlatformIds((current) => {
      if (current.includes(platformId)) {
        return current.filter((id) => id !== platformId);
      }

      return [...current, platformId];
    });
  }

  /**
   * Salva no Supabase quais plataformas o usuário deseja usar no app.
   */
  async function handleSaveUserPlatforms() {
    try {
      for (const platform of platformsList) {
        const selected = selectedPlatformIds.includes(platform.id);

        await toggleUserPlatform(platform.id, selected);
      }

      /**
       * Recarrega forçando, porque o usuário acabou de alterar suas plataformas.
       */
      await loadPlatforms(true);
      closePlatformDrawerAndReturn();
    } catch (error) {
      console.log('Erro ao salvar plataformas:', error);
      Alert.alert('Erro', 'Não foi possível salvar suas plataformas.');
    }
  }

  // Plataforma selecionada no formulário de ganho avulso, usada para exibir preview.
  const selectedPlatformData = userPlatforms.find(
    (item: any) => item.platform?.name === gainPlatform,
  )?.platform;

  // Indica se já existe uma corrida ativa na jornada atual.
  const hasActiveRideInCurrentSession = activeSessionRides.some(
    (ride) => ride.status === 'active',
  );

  // Corrida ativa exibida no card flutuante global.
  const globalActiveRide = activeSessionRides.find(
    (ride) => ride.status === 'active',
  );

  // Corridas aguardando início exibidas abaixo do card flutuante.
  const globalWaitingRides = activeSessionRides.filter(
    (ride) => ride.status === 'waiting',
  );

  // Tempo decorrido da corrida ativa em segundos.
  const globalActiveRideElapsedSeconds = calculateSecondsFromDate(
    globalActiveRide?.started_at,
  );

  // Cálculo em tempo real do ganho por hora da corrida ativa.
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

  // Define quando os cards flutuantes de corrida devem aparecer.
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

  // Calcula altura ocupada pelos cards flutuantes para posicionar outros elementos.
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

  // Offset usado para empurrar o cronômetro flutuante acima dos cards de corrida.
  const activeSessionFloatingTimerBottomOffset =
    globalRideCardsStackHeight > 0 ? globalRideCardsStackHeight + 12 : 0;

  const quickActionsBottomOffset =
    quickActionsVisible && globalRideCardsStackHeight > 0
      ? globalRideCardsStackHeight + 190
      : 0;

  /**
   * Envia para o cronômetro flutuante o espaço que ele precisa respeitar
   * quando há cards de corrida aparecendo na parte inferior da tela.
   */
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
    // Container raiz que envolve as tabs e todos os overlays globais.
    <View style={styles.root}>
      {/* Navegação inferior principal do app. */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,

          tabBarStyle: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: -14,
            height: 90,
            backgroundColor: '#070707',
            borderTopWidth: 1,
            borderTopColor: '#2A2830',
            borderLeftWidth: 0,
            borderRightWidth: 0,
            borderBottomWidth: 0,
            borderRadius: 0,
            paddingTop: 9,
            paddingBottom: Platform.OS === 'ios' ? 28 : 20,
            paddingHorizontal: 12,
            shadowColor: '#D4A64A',
            shadowOffset: {
              width: 0,
              height: -8,
            },
            shadowOpacity: 0.08,
            shadowRadius: 18,
            elevation: 18,
          },

          tabBarItemStyle: {
            height: 54,
            alignItems: 'center',
            justifyContent: 'center',
          },

          tabBarActiveTintColor: '#D4A64A',
          tabBarInactiveTintColor: '#8F8A91',
        }}
      >
        {/* Aba principal com resumo financeiro e desempenho. */}
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

        {/* Aba especial do botão central "+", usada para abrir ações rápidas. */}
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
                  scheduleActiveSessionRefresh(0);
                  setQuickActionsVisible((current) => !current);
                }}
              >
                <Ionicons
                  name={quickActionsVisible ? 'close-sharp' : 'add-sharp'}
                  size={35}
                  color="#080808"
                  style={styles.centerButtonIcon}
                />
              </TouchableOpacity>
            ),
          }}
        />

        <Tabs.Screen
          name="motoristas-cidade"
          options={{
            title: 'Motoristas',
            tabBarIcon: ({ color, focused }) =>
              renderTabIcon('people-outline', focused, color),
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
      

        <Tabs.Screen
          name="perfil-publico"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="editar-perfil"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="configuracoes"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="buscar-motoristas"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="earnings-performance"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="motoristas-cidade-lista"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="motoristas-cidade-feed"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="motoristas-cidade-meus-posts"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="ibge-localidades"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="motoristas-cidade-resultado-detalhes"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {/* Menu radial/central de ações rápidas aberto pelo botão "+". */}
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

            <QuickActionButton
              icon="options-outline"
              label="Parâmetros"
              style={styles.quickActionTargets}
              iconBoxStyle={styles.quickActionIconCyan}
              onPress={() => openPerformanceTargetsModal()}
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

      {/* Cards flutuantes de corrida ativa ou corridas aguardando início. */}
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
                  <Ionicons name="navigate-outline" size={22} color="#080808" />
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

                <Ionicons name="chevron-forward" size={18} color="#9B969B" />
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {/* Card expandido com detalhes e ações da corrida ativa. */}
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
                    <Ionicons name="navigate-outline" size={24} color="#080808" />
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
                <Ionicons name="chevron-down" size={23} color="#F5F0E6" />
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
                <Ionicons name="flag-outline" size={20} color="#080808" />
                <Text style={styles.globalRideFinishButtonText}>Concluir</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      ) : null}

      {/* Modal para lançar ganho avulso, sem vínculo com jornada. */}
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
                  <Ionicons name="close" size={27} color="#F5F0E6" />
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
                  <Ionicons name="apps-outline" size={16} color="#F5F0E6" />
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
                  <Ionicons name="apps-outline" size={30} color="#8F8A91" />
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
                    <Ionicons name="checkmark-circle" size={22} color="#D4A64A" />
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
                placeholderTextColor="#8F8A91"
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
                    placeholderTextColor="#8F8A91"
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
                    placeholderTextColor="#8F8A91"
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
                  <ActivityIndicator color="#080808" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={22}
                      color="#080808"
                    />
                    <Text style={styles.saveGainButtonText}>Salvar ganho</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal para iniciar uma corrida ou adicionar corrida na fila. */}
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
                      color="#080808"
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
                  <Ionicons name="close" size={24} color="#F5F0E6" />
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
                    <Ionicons name="apps-outline" size={18} color="#D4A64A" />
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
                  <Ionicons name="settings-outline" size={15} color="#F5F0E6" />
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
                  <Ionicons name="apps-outline" size={30} color="#8F8A91" />
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
                            color="#080808"
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
                    <Ionicons name="cash-outline" size={19} color="#D4A64A" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.rideInputLabel}>Valor da corrida</Text>
                    <TextInput
                      value={rideAmount}
                      onChangeText={(text) => setRideAmount(cleanMoneyInput(text))}
                      placeholder="0,00"
                      placeholderTextColor="#8F8A91"
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
                        placeholderTextColor="#8F8A91"
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
                  <ActivityIndicator color="#080808" />
                ) : (
                  <>
                    <Ionicons
                      name={
                        hasActiveRideInCurrentSession
                          ? 'add-circle-outline'
                          : 'play-circle-outline'
                      }
                      size={22}
                      color="#080808"
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
                <Ionicons name="close" size={22} color="#F5F0E6" />
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
                  <Ionicons name="play-circle-outline" size={20} color="#080808" />
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
                    <Ionicons name="create-outline" size={23} color="#F5F0E6" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalEyebrow}>Corrida aguardando</Text>
                    <Text style={styles.modalTitle}>Editar corrida</Text>
                  </View>
                </View>

                <TouchableOpacity onPress={closeEditWaitingRideModal}>
                  <Ionicons name="close" size={27} color="#F5F0E6" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDescription}>
                Altere a plataforma ou o valor da corrida aguardando início.
              </Text>

              <View style={styles.rideSectionHeader}>
                <View style={styles.rideSectionHeaderLeft}>
                  <View style={styles.rideSectionIcon}>
                    <Ionicons name="apps-outline" size={18} color="#D4A64A" />
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
                        <Ionicons name="checkmark-circle" size={20} color="#080808" />
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
                    <Ionicons name="cash-outline" size={19} color="#D4A64A" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.rideInputLabel}>Valor da corrida</Text>
                    <TextInput
                      value={waitingEditAmount}
                      onChangeText={(text) => setWaitingEditAmount(cleanMoneyInput(text))}
                      placeholder="0,00"
                      placeholderTextColor="#8F8A91"
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
                  <ActivityIndicator color="#F5F0E6" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={21} color="#F5F0E6" />
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
                <Ionicons name="close" size={27} color="#F5F0E6" />
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
                  placeholderTextColor="#8F8A91"
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
                <ActivityIndicator color="#080808" />
              ) : (
                <>
                  <Ionicons name="play-circle-outline" size={22} color="#080808" />
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
                    <Ionicons name="create-outline" size={23} color="#F5F0E6" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalEyebrow}>Corrida em andamento</Text>
                    <Text style={styles.modalTitle}>Editar corrida</Text>
                  </View>
                </View>

                <TouchableOpacity onPress={closeGlobalRideEditModal}>
                  <Ionicons name="close" size={27} color="#F5F0E6" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDescription}>
                Altere a plataforma, o valor ou o KM inicial desta corrida em andamento.
              </Text>

              <View style={styles.rideSectionHeader}>
                <View style={styles.rideSectionHeaderLeft}>
                  <View style={styles.rideSectionIcon}>
                    <Ionicons name="apps-outline" size={18} color="#D4A64A" />
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
                        <Ionicons name="checkmark-circle" size={20} color="#080808" />
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
                    <Ionicons name="cash-outline" size={19} color="#D4A64A" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.rideInputLabel}>Valor da corrida</Text>
                    <TextInput
                      value={globalEditRideAmount}
                      onChangeText={(text) => setGlobalEditRideAmount(cleanMoneyInput(text))}
                      placeholder="0,00"
                      placeholderTextColor="#8F8A91"
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
                      placeholderTextColor="#8F8A91"
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
                  <ActivityIndicator color="#F5F0E6" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={21} color="#F5F0E6" />
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
                <Ionicons name="close" size={27} color="#F5F0E6" />
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
                  placeholderTextColor="#8F8A91"
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
                  placeholderTextColor="#8F8A91"
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
                <ActivityIndicator color="#080808" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#080808" />
                  <Text style={styles.globalRideFinishModalButtonText}>
                    Concluir corrida
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={performanceTargetsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePerformanceTargetsModal}
      >
        <KeyboardAvoidingView
          style={styles.performanceTargetsOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.performanceTargetsContent}>
            <View style={styles.performanceTargetsHeader}>
              <View style={styles.performanceTargetsHeaderIcon}>
                <Ionicons name="speedometer-outline" size={25} color="#080808" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.performanceTargetsEyebrow}>
                  Parâmetros de desempenho
                </Text>
                <Text style={styles.performanceTargetsTitle}>
                  Definir metas de ganho
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.performanceTargetsCloseButton}
                onPress={closePerformanceTargetsModal}
              >
                <Ionicons name="close" size={24} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <Text style={styles.performanceTargetsDescription}>
              Defina quando uma jornada deve ser considerada ruim ou boa com base no ganho por hora e no ganho por KM.
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.performanceTargetsScrollContent}
            >
              <View style={styles.performanceTargetsPreviewCard}>
                <View style={styles.performanceTargetsPreviewRow}>
                  <View style={styles.performanceTargetsPreviewIconRed}>
                    <Ionicons name="trending-down-outline" size={18} color="#FCA5A5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.performanceTargetsPreviewLabel}>Ruim</Text>
                    <Text style={styles.performanceTargetsPreviewText}>
                      Abaixo dos valores ruins, o app poderá indicar que a jornada não está compensando.
                    </Text>
                  </View>
                </View>

                <View style={styles.performanceTargetsPreviewDivider} />

                <View style={styles.performanceTargetsPreviewRow}>
                  <View style={styles.performanceTargetsPreviewIconGreen}>
                    <Ionicons name="trending-up-outline" size={18} color="#BBF7D0" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.performanceTargetsPreviewLabel}>Bom</Text>
                    <Text style={styles.performanceTargetsPreviewText}>
                      Acima dos valores bons, o app poderá destacar que a jornada está valendo a pena.
                    </Text>
                  </View>
                </View>
              </View>

              <PerformanceRangeSelector
                title="Ganho por hora ruim"
                description="Valor mínimo aceitável por hora trabalhada"
                value={performanceTargetDraft.badGainPerHour}
                options={BAD_GAIN_PER_HOUR_OPTIONS}
                suffix="/h"
                onChange={(value) => {
                  setPerformanceTargetDraft((current) => ({
                    ...current,
                    badGainPerHour: value,
                    goodGainPerHour:
                      value >= current.goodGainPerHour
                        ? GOOD_GAIN_PER_HOUR_OPTIONS.find((option) => option > value) ?? current.goodGainPerHour
                        : current.goodGainPerHour,
                  }));
                }}
              />

              <PerformanceRangeSelector
                title="Ganho por hora bom"
                description="Meta ideal para considerar a jornada boa"
                value={performanceTargetDraft.goodGainPerHour}
                options={GOOD_GAIN_PER_HOUR_OPTIONS}
                suffix="/h"
                onChange={(value) => {
                  setPerformanceTargetDraft((current) => ({
                    ...current,
                    goodGainPerHour: value,
                    badGainPerHour:
                      value <= current.badGainPerHour
                        ? BAD_GAIN_PER_HOUR_OPTIONS.filter((option) => option < value).slice(-1)[0] ?? current.badGainPerHour
                        : current.badGainPerHour,
                  }));
                }}
              />

              <PerformanceRangeSelector
                title="Ganho por KM ruim"
                description="Valor mínimo aceitável por quilômetro rodado"
                value={performanceTargetDraft.badGainPerKm}
                options={BAD_GAIN_PER_KM_OPTIONS}
                suffix="/km"
                onChange={(value) => {
                  setPerformanceTargetDraft((current) => ({
                    ...current,
                    badGainPerKm: value,
                    goodGainPerKm:
                      value >= current.goodGainPerKm
                        ? GOOD_GAIN_PER_KM_OPTIONS.find((option) => option > value) ?? current.goodGainPerKm
                        : current.goodGainPerKm,
                  }));
                }}
              />

              <PerformanceRangeSelector
                title="Ganho por KM bom"
                description="Meta ideal para considerar a corrida ou jornada boa"
                value={performanceTargetDraft.goodGainPerKm}
                options={GOOD_GAIN_PER_KM_OPTIONS}
                suffix="/km"
                onChange={(value) => {
                  setPerformanceTargetDraft((current) => ({
                    ...current,
                    goodGainPerKm: value,
                    badGainPerKm:
                      value <= current.badGainPerKm
                        ? BAD_GAIN_PER_KM_OPTIONS.filter((option) => option < value).slice(-1)[0] ?? current.badGainPerKm
                        : current.badGainPerKm,
                  }));
                }}
              />
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.performanceTargetsSaveButton,
                savingPerformanceTargets && styles.saveGainButtonDisabled,
              ]}
              disabled={savingPerformanceTargets}
              onPress={handleSavePerformanceTargets}
            >
              {savingPerformanceTargets ? (
                <ActivityIndicator color="#080808" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#080808" />
                  <Text style={styles.performanceTargetsSaveButtonText}>
                    Salvar parâmetros
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Drawer inferior para escolher/gerenciar plataformas do usuário. */}
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
                <Ionicons name="close" size={27} color="#F5F0E6" />
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
                      color={selected ? '#D4A64A' : '#8F8A91'}
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

/**
 * Botão individual do menu de ações rápidas.
 * Recebe ícone, texto, posição e ação de clique.
 */
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
        <Ionicons name={icon} size={24} color="#F5F0E6" />
      </View>

      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}


/**
 * Componente reutilizável para selecionar valores dos parâmetros de desempenho.
 * Mostra título, descrição, valor atual, barra de progresso e opções horizontais.
 */
function PerformanceRangeSelector({
  title,
  description,
  value,
  options,
  suffix,
  onChange,
}: {
  title: string;
  description: string;
  value: number;
  options: number[];
  suffix: string;
  onChange: (value: number) => void;
}) {
  const selectedIndex = Math.max(
    options.findIndex((option) => option === value),
    0,
  );

  const progress =
    options.length > 1 ? (selectedIndex / (options.length - 1)) * 100 : 0;

  return (
    <View style={styles.performanceRangeCard}>
      <View style={styles.performanceRangeHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.performanceRangeTitle}>{title}</Text>
          <Text style={styles.performanceRangeDescription}>{description}</Text>
        </View>

        <View style={styles.performanceRangeValueBadge}>
          <Text style={styles.performanceRangeValueText}>
            R$ {formatTargetMoney(value)}{suffix}
          </Text>
        </View>
      </View>

      <View style={styles.performanceRangeTrack}>
        <View
          style={[
            styles.performanceRangeTrackFill,
            { width: `${progress}%` },
          ]}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.performanceRangeOptions}
      >
        {options.map((option) => {
          const selected = option === value;

          return (
            <TouchableOpacity
              key={`${title}-${option}`}
              activeOpacity={0.86}
              style={[
                styles.performanceRangeOption,
                selected && styles.performanceRangeOptionActive,
              ]}
              onPress={() => onChange(option)}
            >
              <Text
                style={[
                  styles.performanceRangeOptionText,
                  selected && styles.performanceRangeOptionTextActive,
                ]}
              >
                R$ {formatTargetMoney(option)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * Estilos de toda a camada de tabs, overlays, modais, botões e cards flutuantes.
 *
 * O padrão visual do app usa:
 * - fundo escuro;
 * - cards em tons de preto/cinza;
 * - dourado como cor principal;
 * - verde para ações positivas;
 * - vermelho para exclusão/erro;
 * - azul/roxo para estados auxiliares.
 */
const styles = StyleSheet.create({
  // Container raiz da tela de tabs.
  root: {
    flex: 1,
    backgroundColor: '#050505',
    overflow: 'visible',
  },
  // Caixa invisível que centraliza os ícones das abas.
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconBoxActive: {
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  // Botão central de ações rápidas. Ele fica sobre a tab bar.
  centerButton: {
    position: 'absolute',
    left: '50%',
    marginLeft: -31,
    top: -30,

    width: 62,
    height: 62,
    borderRadius: 16,

    backgroundColor: '#D4A64A',
    borderWidth: 5,
    borderColor: '#050505',

    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#D4A64A',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 14,
    transform: [{ rotate: '45deg' }],
  },
  // Estado visual do botão central quando o menu de ações está aberto.
  centerButtonOpen: {
    backgroundColor: '#52525B',
    borderColor: '#050505',
    shadowColor: '#52525B',
    transform: [{ rotate: '45deg' }],
  },
  // Gira o ícone ao contrário para ele ficar reto dentro do botão em losango.
  centerButtonIcon: {
    transform: [{ rotate: '-45deg' }],
  },
  // Fundo escuro que aparece atrás das ações rápidas.
  quickBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.86)',
    zIndex: 60,
  },

  // Área que posiciona os botões de ação rápida em volta do botão central.
  quickActionsWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'ios' ? 60 : 60,
    height: 230,
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
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.18)',
    shadowColor: '#D4A64A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 10,
  },
  quickActionIconGreen: {
    backgroundColor: '#D4A64A',
  },
  quickActionIconRed: {
    backgroundColor: '#EF4444',
  },
  quickActionIconBlue: {
    backgroundColor: '#D4A64A',
  },
  quickActionIconPurple: {
    backgroundColor: '#7C3AED',
  },
  quickActionLabel: {
    color: '#F5F0E6',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 6,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },

  // Pilha de cards flutuantes de corrida perto da parte inferior da tela.
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
    borderRadius: 12,
    backgroundColor: 'rgba(5,5,5,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.08)',
  },
  globalRideMiniCard: {
    minHeight: 70,
    borderRadius: 12,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.35)',
    borderLeftWidth: 4,
    borderLeftColor: '#D4A64A',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    shadowColor: '#D4A64A',
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 24,
  },
  globalRideMiniIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  globalRideMiniLogo: {
    width: 46,
    height: 46,
    backgroundColor: '#F5F0E6',
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
    backgroundColor: '#D4A64A',
  },

  globalRideMiniStatusText: {
    color: '#BBF7D0',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },

  globalRideMiniTimer: {
    color: '#F5F0E6',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },

  globalRideMiniRight: {
    alignItems: 'flex-end',
  },

  globalRideMiniAmount: {
    color: '#F5F0E6',
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
    borderRadius: 12,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
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
    borderRadius: 11,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  globalWaitingRideMiniLogo: {
    width: 38,
    height: 38,
    backgroundColor: '#F5F0E6',
  },

  globalWaitingRidePlatform: {
    color: '#F5F0E6',
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
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
  },
  globalWaitingRideExpandedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'ios' ? 104 : 100,
    zIndex: 100,
  },
  globalWaitingRideExpandedCard: {
    borderRadius: 12,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderTopColor: 'rgba(212,166,74,0.34)',
    padding: 16,
    shadowColor: '#D4A64A',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.09,
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
    borderRadius: 13,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  globalWaitingRideExpandedLogo: {
    width: 50,
    height: 50,
    backgroundColor: '#F5F0E6',
  },

  globalWaitingRideExpandedEyebrow: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  globalWaitingRideExpandedTitle: {
    color: '#F5F0E6',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },

  globalWaitingRideExpandedValueBox: {
    borderRadius: 14,
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
    color: '#F5F0E6',
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
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'ios' ? 104 : 100,
    zIndex: 100,
  },
  globalRideExpandedCard: {
    borderRadius: 12,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    borderTopColor: 'rgba(212,166,74,0.34)',
    padding: 16,
    shadowColor: '#D4A64A',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.09,
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
    borderRadius: 13,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  globalRideExpandedLogo: {
    width: 50,
    height: 50,
    backgroundColor: '#F5F0E6',
  },

  globalRideExpandedEyebrow: {
    color: '#D4A64A',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  globalRideExpandedTitle: {
    color: '#F5F0E6',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  globalRideMinimizeButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },
  globalRideExpandedTimerBox: {
    borderRadius: 14,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    padding: 16,
    marginBottom: 12,
  },

  globalRideExpandedTimerLabel: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '800',
  },

  globalRideExpandedTimerValue: {
    color: '#F5F0E6',
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
    borderRadius: 13,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 12,
    justifyContent: 'center',
  },

  globalRideExpandedStatLabel: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 5,
  },

  globalRideExpandedStatValue: {
    color: '#F5F0E6',
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
    borderRadius: 12,
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
    borderRadius: 12,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  globalRideEditButtonText: {
    color: '#D4A64A',
    fontSize: 13,
    fontWeight: '900',
  },
  globalRideFinishButton: {
    flex: 1.25,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#D4A64A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  globalRideFinishButtonText: {
    color: '#080808',
    fontSize: 14,
    fontWeight: '900',
  },
  globalStartWaitingRideModalContent: {
    backgroundColor: '#101014',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    borderTopColor: 'rgba(212,166,74,0.34)',
  },

  globalStartWaitingRideButton: {
    height: 58,
    borderRadius: 12,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },

  globalStartWaitingRideButtonText: {
    color: '#080808',
    fontSize: 15,
    fontWeight: '900',
  },
  globalRideEditModalContent: {
    backgroundColor: '#101014',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2830',
    borderTopColor: 'rgba(212,166,74,0.34)',
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
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  globalRideEditModalButton: {
    height: 58,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },

  globalRideEditModalButtonText: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },
  globalRideFinishModalContent: {
    backgroundColor: '#101014',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    borderTopColor: 'rgba(212,166,74,0.34)',
  },

  globalRideFinishModalButton: {
    height: 58,
    borderRadius: 12,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },

  globalRideFinishModalButtonText: {
    color: '#080808',
    fontSize: 15,
    fontWeight: '900',
  },
  // Overlay usado pela maioria dos modais centralizados.
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.84)',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  // Conteúdo visual do modal de ganho avulso.
  gainModalContent: {
    backgroundColor: '#101014',
    borderRadius: 12,
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
  modalEyebrow: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  modalTitle: {
    color: '#F5F0E6',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 3,
    letterSpacing: -0.3,
  },
  modalDescription: {
    color: '#9B969B',
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
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.2,
  },
  managePlatformsButton: {
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  managePlatformsButtonText: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
  },
  emptyPlatformsBox: {
    minHeight: 118,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginBottom: 16,
  },

  emptyPlatformsTitle: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 10,
  },

  emptyPlatformsText: {
    color: '#9B969B',
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
    minWidth: 92,
    height: 86,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  platformChipActive: {
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderColor: 'rgba(212,166,74,0.45)',
  },

  platformChipLogo: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#F5F0E6',
  },

  platformChipLogoFallback: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  platformChipLogoText: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
  },

  platformChipText: {
    color: '#F5F0E6',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },

  platformChipTextActive: {
    color: '#080808',
  },

  selectedPlatformPreview: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(212,166,74,0.10)',
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
    backgroundColor: '#F5F0E6',
  },

  selectedPlatformPreviewText: {
    flex: 1,
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: '900',
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
    height: 56,
    borderRadius: 12,
    backgroundColor: '#D4A64A',
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
    color: '#080808',
    fontSize: 15,
    fontWeight: '900',
  },
  rideModalContent: {
    backgroundColor: '#101014',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2830',
    borderTopColor: 'rgba(212,166,74,0.34)',
    maxHeight: '92%',
    shadowColor: '#D4A64A',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.09,
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
    borderRadius: 13,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4A64A',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.20,
    shadowRadius: 14,
    elevation: 8,
  },
  rideCreateHeaderIconQueue: {
    backgroundColor: '#D4A64A',
  },
  rideCreateEyebrow: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  rideCreateTitle: {
    color: '#F5F0E6',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: -0.4,
  },
  rideCreateCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rideCreateDescription: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 16,
  },
  rideInfoCard: {
    minHeight: 56,
    borderRadius: 13,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginBottom: 16,
  },
  rideInfoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(212,166,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideInfoText: {
    flex: 1,
    color: '#E8C46D',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
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
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rideSectionTitle: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  rideSectionSubtitle: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  rideManagePlatformsButton: {
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rideManagePlatformsButtonText: {
    color: '#D4A64A',
    fontSize: 12,
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
    borderRadius: 13,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  ridePlatformCardActive: {
    backgroundColor: '#D4A64A',
    borderColor: '#D4A64A',
  },

  ridePlatformLogo: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#F5F0E6',
  },

  ridePlatformLogoFallback: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  ridePlatformLogoText: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  ridePlatformName: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
  },

  ridePlatformNameActive: {
    color: '#080808',
  },

  rideInputsRow: {
    gap: 10,
    marginBottom: 6,
  },
  rideInputCard: {
    flex: 1,
    minHeight: 72,
    borderRadius: 13,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rideInputIconGreen: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(212,166,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideInputIconBlue: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(212,166,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rideInputLabel: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },

  rideInput: {
    minHeight: 32,
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
    padding: 0,
  },
  saveRideButton: {
    height: 58,
    borderRadius: 12,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    shadowColor: '#D4A64A',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.20,
    shadowRadius: 16,
    elevation: 10,
  },
  saveRideButtonText: {
    color: '#080808',
    fontSize: 15,
    fontWeight: '900',
  },
  // Overlay do drawer de plataformas, que sobe de baixo para cima.
  platformDrawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.84)',
    justifyContent: 'flex-end',
  },
  platformDrawerContent: {
    backgroundColor: '#101014',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    borderTopColor: 'rgba(212,166,74,0.34)',
    maxHeight: '86%',
  },
  drawerHandle: {
    width: 46,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D4A64A',
    opacity: 0.65,
    alignSelf: 'center',
    marginBottom: 16,
  },

  platformDrawerList: {
    gap: 10,
    paddingBottom: 18,
  },
  platformDrawerItem: {
    minHeight: 62,
    borderRadius: 13,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    gap: 12,
  },
  platformDrawerItemActive: {
    borderColor: 'rgba(212,166,74,0.55)',
    backgroundColor: 'rgba(212,166,74,0.10)',
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
    backgroundColor: '#F5F0E6',
  },

  platformDrawerLogoFallback: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  platformDrawerLogoText: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  platformDrawerName: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  platformDrawerNameActive: {
    color: '#86EFAC',
  },
  savePlatformsButton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  savePlatformsButtonText: {
    color: '#080808',
    fontSize: 15,
    fontWeight: '900',
  },
  
  quickActionTargets: {
    transform: [{ translateY: -162 }],
  },
  quickActionIconCyan: {
    backgroundColor: '#D4A64A',
  },
  performanceTargetsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.84)',
    justifyContent: 'flex-end',
  },
  performanceTargetsContent: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#101014',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    borderTopColor: 'rgba(212,166,74,0.34)',
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  performanceTargetsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 12,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#211D16',
  },
  performanceTargetsHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4A64A',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.20,
    shadowRadius: 14,
    elevation: 8,
  },
  performanceTargetsEyebrow: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  performanceTargetsTitle: {
    color: '#F5F0E6',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 3,
  },
  performanceTargetsCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },

  performanceTargetsDescription: {
    color: '#9B969B',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    marginBottom: 14,
  },

  performanceTargetsScrollContent: {
    paddingBottom: 18,
  },
  performanceTargetsPreviewCard: {
    backgroundColor: '#18171D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 14,
    marginBottom: 14,
  },

  performanceTargetsPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  performanceTargetsPreviewIconRed: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  performanceTargetsPreviewIconGreen: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  performanceTargetsPreviewLabel: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  performanceTargetsPreviewText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 2,
  },

  performanceTargetsPreviewDivider: {
    height: 1,
    backgroundColor: '#2A2830',
    marginVertical: 12,
  },
  performanceRangeCard: {
    backgroundColor: '#18171D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 14,
    marginBottom: 12,
  },

  performanceRangeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },

  performanceRangeTitle: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  performanceRangeDescription: {
    color: '#8F8A91',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 3,
  },
  performanceRangeValueBadge: {
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  performanceRangeValueText: {
    color: '#86EFAC',
    fontSize: 15,
    fontWeight: '900',
  },
  performanceRangeTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#2A2830',
    marginTop: 14,
    overflow: 'hidden',
  },
  performanceRangeTrackFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#D4A64A',
  },

  performanceRangeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  performanceRangeOption: {
    minWidth: 54,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  performanceRangeOptionActive: {
    backgroundColor: '#D4A64A',
    borderColor: '#D4A64A',
  },

  performanceRangeOptionText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '900',
  },

  performanceRangeOptionTextActive: {
    color: '#080808',
  },
  performanceTargetsSaveButton: {
    height: 58,
    borderRadius: 12,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    shadowColor: '#D4A64A',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.20,
    shadowRadius: 16,
    elevation: 10,
  },
  performanceTargetsSaveButtonText: {
    color: '#080808',
    fontSize: 15,
    fontWeight: '900',
  },
});
