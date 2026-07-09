/**
 * Página: Motoristas da cidade
 *
 * Caminho esperado no projeto:
 * app/(private)/(tabs)/motoristas-cidade.tsx
 *
 * Objetivo:
 * Exibir todos os motoristas/entregadores que possuem profiles.city igual
 * ao profiles.city do usuário logado.
 *
 * Regra importante:
 * A lista principal vem da tabela profiles.
 * O próprio usuário logado é removido apenas na renderização.
 * A tabela work_sessions é usada somente para descobrir o status:
 * active, paused ou offline.
 *
 * Ordem da lista:
 * 1. Quem está rodando agora aparece primeiro;
 * 2. Entre quem está rodando, aparece primeiro quem está rodando há mais tempo;
 * 3. Quem não está rodando fica no final, em ordem alfabética.
 */

// Hooks do React usados para estado, cálculo memorizado e callback estável.
import { useCallback, useMemo, useState } from 'react';

// Componentes visuais do React Native usados na tela.
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Ícones utilizados nos botões, cards, badges e mensagens da tela.
import { Ionicons } from '@expo/vector-icons';
// router faz navegação programática.
// useFocusEffect recarrega os dados sempre que a tela volta ao foco.
import { router, useFocusEffect } from 'expo-router';

// Cliente Supabase usado para autenticação e consultas no banco.
import { supabase } from '../../../src/database/supabase';

/**
 * Normaliza a cidade recebida.
 * Converte null/undefined para string vazia e remove espaços extras.
 */
function normalizeCity(value?: string | null) {
  return String(value ?? '').trim();
}

/**
 * Retorna a URL da imagem do usuário.
 * Como o app pode salvar foto em campos diferentes, esta função testa várias opções.
 */
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

/**
 * Retorna o nome que será exibido no card do motorista.
 * Se nenhum nome existir, usa "Motorista" como fallback.
 */
function getUserDisplayName(user: any) {
  return (
    user?.full_name ||
    user?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    'Motorista'
  );
}

/**
 * Retorna o ID do motorista.
 * O objeto pode vir como profile puro ou como objeto enriquecido com user_id/profile.
 */
function getDriverUserId(driver: any) {
  return driver?.user_id || driver?.id || driver?.profile?.user_id || driver?.profile?.id || null;
}

/**
 * Retorna o ID usado para relacionar profile com work_sessions.user_id.
 *
 * Em alguns bancos, profiles.id é igual ao auth.users.id.
 * Em outros, profiles possui uma coluna user_id.
 */
function getProfileAuthUserId(profile: any) {
  return profile?.user_id || profile?.id || null;
}

/**
 * Retorna a jornada ativa/pausada associada ao motorista.
 * Se não houver jornada, retorna null.
 */
function getDriverSession(driver: any) {
  return driver?.active_session || driver?.session || null;
}

/**
 * Retorna o primeiro número válido entre vários possíveis campos.
 * Isso deixa o cálculo compatível com nomes diferentes de colunas/propriedades.
 */
function getNumberValue(...values: any[]) {
  for (const value of values) {
    const numberValue = Number(value);

    if (Number.isFinite(numberValue) && numberValue >= 0) {
      return numberValue;
    }
  }

  return null;
}

/**
 * Retorna a data/hora em que a jornada começou.
 * Aceita tanto started_at quanto startedAt.
 */
function getDriverStartedAt(driver: any) {
  const session = getDriverSession(driver);

  return session?.started_at || session?.startedAt || null;
}

/**
 * Calcula o tempo de jornada em segundos.
 *
 * Fluxo:
 * - Se existir um campo pronto de segundos, usa esse valor;
 * - Caso contrário, calcula a diferença entre agora e started_at;
 * - Se a jornada estiver pausada, calcula até paused_at;
 * - Desconta segundos pausados quando esses campos existirem.
 */
function getDriverChronometerSeconds(driver: any) {
  const session = getDriverSession(driver);

  if (!session?.id) return 0;

  const directSeconds = getNumberValue(
    session?.chronometer_seconds,
    session?.chronometerSeconds,
    session?.timer_seconds,
    session?.timerSeconds,
    session?.elapsed_seconds,
    session?.elapsedSeconds,
    session?.worked_seconds,
    session?.workedSeconds,
  );

  if (directSeconds !== null) return directSeconds;

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
    ) ?? 0;

  const status = String(session?.status ?? '').toLowerCase();

  if (status === 'paused') {
    const pausedAtValue = session?.paused_at || session?.pausedAt || null;

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
    Math.floor((Date.now() - startedAt.getTime()) / 1000) - pausedSeconds,
    0,
  );
}

/**
 * Formata o tempo rodando em texto amigável.
 * Exemplos:
 * - começou agora
 * - rodando há 15min
 * - rodando há 2h
 * - rodando há 2h 30min
 */
function formatRunningTime(driver: any) {
  const seconds = getDriverChronometerSeconds(driver);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours <= 0 && minutes <= 0) return 'começou agora';
  if (hours <= 0) return `rodando há ${minutes}min`;
  if (minutes <= 0) return `rodando há ${hours}h`;

  return `rodando há ${hours}h ${minutes}min`;
}

/**
 * Define se o motorista está rodando agora.
 * Nesta tela, rodando significa status === "active".
 */
function isDriverRunning(driver: any) {
  const session = getDriverSession(driver);
  const status = String(session?.status ?? '').toLowerCase();

  return status === 'active';
}

/**
 * Monta as informações visuais do status do motorista.
 * Retorna label, ícone, cor, background e borda.
 */
function getDriverStatus(driver: any) {
  const session = getDriverSession(driver);
  const status = String(session?.status ?? '').toLowerCase();

  if (status === 'active') {
    return {
      label: 'Rodando agora',
      icon: 'radio-outline' as keyof typeof Ionicons.glyphMap,
      color: '#22C55E',
      backgroundColor: 'rgba(34,197,94,0.12)',
      borderColor: 'rgba(34,197,94,0.24)',
    };
  }

  if (status === 'paused') {
    return {
      label: 'Pausado',
      icon: 'pause-circle-outline' as keyof typeof Ionicons.glyphMap,
      color: '#FACC15',
      backgroundColor: 'rgba(250,204,21,0.12)',
      borderColor: 'rgba(250,204,21,0.24)',
    };
  }

  return {
    label: 'Offline',
    icon: 'ellipse-outline' as keyof typeof Ionicons.glyphMap,
    color: '#8F8A91',
    backgroundColor: 'rgba(143,138,145,0.10)',
    borderColor: 'rgba(143,138,145,0.22)',
  };
}

/**
 * Componente principal da página.
 *
 * Responsabilidades:
 * - Buscar cidade do usuário logado;
 * - Buscar todos os perfis da mesma cidade;
 * - Anexar status de jornada;
 * - Ordenar a lista;
 * - Renderizar loading, empty state e cards;
 * - Abrir perfil público do motorista.
 */
export default function CityDriversScreen() {
  // ID do usuário logado. Usado para remover o próprio usuário da lista.
  const [currentUserId, setCurrentUserId] = useState('');
  // Cidade do usuário logado, carregada de profiles.city.
  const [profileCity, setProfileCity] = useState('');
  // Lista de profiles da mesma cidade, enriquecida com status de jornada.
  const [drivers, setDrivers] = useState<any[]>([]);
  // Loading inicial da tela.
  const [loading, setLoading] = useState(true);
  // Loading do pull-to-refresh.
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Lista que realmente será exibida.
   *
   * Regras:
   * - Remove apenas o perfil do usuário logado;
   * - Mantém todos os outros perfis da mesma cidade;
   * - Coloca motoristas ativos primeiro;
   * - Entre os ativos, ordena por maior tempo rodando;
   * - Quem não está rodando fica no final em ordem alfabética.
   */
  const visibleDrivers = useMemo(
    () =>
      drivers
        .filter((driver) => {
          const driverAuthUserId = getProfileAuthUserId(driver) || getDriverUserId(driver);

          return driverAuthUserId && String(driverAuthUserId) !== String(currentUserId);
        })
        .sort((a, b) => {
          const aIsRunning = isDriverRunning(a);
          const bIsRunning = isDriverRunning(b);

          if (aIsRunning && !bIsRunning) return -1;
          if (!aIsRunning && bIsRunning) return 1;

          if (aIsRunning && bIsRunning) {
            return getDriverChronometerSeconds(b) - getDriverChronometerSeconds(a);
          }

          const aName = getUserDisplayName(a);
          const bName = getUserDisplayName(b);

          return aName.localeCompare(bName, 'pt-BR');
        }),
    [drivers, currentUserId],
  );

  /**
   * Quantidade de motoristas com status active.
   * Exibido no card superior.
   */
  const runningDriversCount = useMemo(
    () => visibleDrivers.filter((driver) => isDriverRunning(driver)).length,
    [visibleDrivers],
  );

  /**
   * Busca o usuário autenticado e consulta a cidade dele na tabela profiles.
   * Retorna a cidade normalizada.
   */
  async function getLoggedUserCity() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;

  const userId = user?.id ?? '';

  setCurrentUserId(userId);

  if (!userId) return '';

  /**
   * Primeiro tenta o padrão:
   * profiles.id = auth.users.id
   */
  const { data: profileById, error: profileByIdError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileByIdError) {
    console.log('Erro ao buscar profile por id:', profileByIdError);
  }

  if (profileById?.city) {
    return normalizeCity(profileById.city);
  }

  /**
   * Fallback:
   * profiles.user_id = auth.users.id
   *
   * Se a coluna user_id não existir, o erro será mostrado no console,
   * mas a tela continuará tentando os próximos fallbacks.
   */
  const { data: profileByUserId, error: profileByUserIdError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileByUserIdError) {
    console.log('Fallback profiles.user_id não disponível:', profileByUserIdError);
  }

  if (profileByUserId?.city) {
    return normalizeCity(profileByUserId.city);
  }

  /**
   * Último fallback:
   * cidade salva no metadata do usuário autenticado.
   */
  return normalizeCity(
    user?.user_metadata?.city ||
      user?.user_metadata?.profile_city ||
      user?.user_metadata?.municipality,
  );
}

  /**
   * Busca todos os profiles com city igual à cidade do usuário logado.
   *
   * Esta função é a base da tela.
   * Ela não consulta work_sessions e não filtra por quem está rodando.
   */
  async function getAllProfilesFromSameCity(city: string) {
  const cleanCity = normalizeCity(city);

  if (!cleanCity) return [];

  /**
   * Busca principal:
   * profiles.city igual ao city do usuário logado.
   */
  const { data: exactData, error: exactError } = await supabase
    .from('profiles')
    .select('*')
    .ilike('city', cleanCity)
    .order('full_name', { ascending: true });

  if (exactError) {
    console.log('Erro ao buscar profiles por city exata:', exactError);
    throw exactError;
  }

  if ((exactData ?? []).length > 0) {
    return exactData ?? [];
  }

  /**
   * Fallback para casos em que city esteja salvo com espaço/complemento:
   * "Belo Horizonte ", "Belo Horizonte/MG", "Belo Horizonte - MG".
   */
  const { data: partialData, error: partialError } = await supabase
    .from('profiles')
    .select('*')
    .ilike('city', `%${cleanCity}%`)
    .order('full_name', { ascending: true });

  if (partialError) {
    console.log('Erro ao buscar profiles por city parcial:', partialError);
    throw partialError;
  }

  return partialData ?? [];
}

  /**
   * Busca jornadas active/paused dos usuários encontrados.
   *
   * Importante:
   * Esta função serve apenas para marcar status.
   * Usuários sem jornada continuam aparecendo como offline.
   */
  async function getActiveOrPausedSessionsByUserId(userIds: string[]) {
    if (userIds.length === 0) return {};

    const { data, error } = await supabase
      .from('work_sessions')
      // Busca sessões apenas para descobrir quem está active/paused.
      .select('*')
      .in('user_id', userIds)
      .in('status', ['active', 'paused'])
      .order('started_at', { ascending: false });

    if (error) {
      console.log('Erro ao buscar status de jornada dos motoristas:', error);
      return {};
    }

    const sessionsByUserId: Record<string, any> = {};

    (data ?? []).forEach((session) => {
      if (session?.user_id && !sessionsByUserId[session.user_id]) {
        sessionsByUserId[session.user_id] = session;
      }
    });

    return sessionsByUserId;
  }

  /**
   * Carrega a lista completa.
   *
   * Passo a passo:
   * 1. Busca profiles.city do usuário logado;
   * 2. Busca todos os profiles da mesma cidade;
   * 3. Busca jornadas active/paused desses usuários;
   * 4. Junta cada profile com sua jornada, se existir;
   * 5. Atualiza o estado drivers.
   */
  async function loadDrivers(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const city = await getLoggedUserCity();

      setProfileCity(city);

      if (!city) {
        setDrivers([]);
        return;
      }

      const profilesFromSameCity = await getAllProfilesFromSameCity(city);
      const userIds = Array.from(
        new Set(
          profilesFromSameCity
            .map((profile) => getProfileAuthUserId(profile))
            .filter(Boolean),
        ),
      );

      const sessionsByUserId = await getActiveOrPausedSessionsByUserId(userIds);

      const profilesWithSessionStatus = profilesFromSameCity.map((profile) => {
        const profileAuthUserId = getProfileAuthUserId(profile);
        const session = profileAuthUserId ? sessionsByUserId[profileAuthUserId] ?? null : null;

        return {
          ...profile,
          user_id: profileAuthUserId,
          profile,
          user: profile,
          active_session: session,
          session,
          status: session?.status ?? 'offline',
        };
      });

      setDrivers(profilesWithSessionStatus);
    } catch (error) {
      console.log('Erro ao carregar todos os motoristas da mesma cidade:', error);
      setDrivers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /**
   * Recarrega a lista sempre que esta página volta ao foco.
   */
  useFocusEffect(
    useCallback(() => {
      loadDrivers();
    }, []),
  );

  /**
   * Abre o perfil público do motorista selecionado.
   */
  function openDriverProfile(driver: any) {
    const userId = getDriverUserId(driver);

    if (!userId) return;

    router.push({
      pathname: '/perfil-publico/[userId]',
      params: { userId },
    } as never);
  }

  /**
   * Abre a tela Minha conta.
   * Usada quando o usuário precisa preencher ou conferir a cidade do perfil.
   */
  function openMyAccount() {
    router.push('/(private)/(tabs)/minha-conta' as never);
  }

  /**
   * Renderização da tela:
   * - Header fixo;
   * - Card de resumo da cidade;
   * - Aviso se não houver cidade definida;
   * - Loading;
   * - Empty state;
   * - Lista de motoristas.
   */
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDrivers(true)}
            tintColor="#D4A64A"
          />
        }
        stickyHeaderIndices={[0]}
      >
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
            </TouchableOpacity>

            <View style={styles.headerTextContent}>
              <Text style={styles.headerEyebrow}>Comunidade local</Text>
              <Text style={styles.headerTitle}>Motoristas da cidade</Text>
            </View>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconBox}>
              <Ionicons name="people-outline" size={28} color="#D4A64A" />
            </View>

            {/*<View style={styles.heroBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.heroBadgeText}>
                {visibleDrivers.length}{' '}
                {visibleDrivers.length === 1 ? 'usuário' : 'usuários'}
              </Text>
            </View>*/}
          </View>

          <Text style={styles.heroTitle}>
            {profileCity || 'Cidade do usuário'}
          </Text>
          <Text style={styles.heroText}>
            Veja todos os perfis da sua cidade
          </Text>

          {visibleDrivers.length > 0 ? (
            <View style={styles.countRow}>
              <View style={styles.countPill}>
                <Ionicons name="people-outline" size={14} color="#D4A64A" />
                <Text style={styles.countPillText}>
                  {visibleDrivers.length} na cidade
                </Text>
              </View>

              <View style={styles.countPillGreen}>
                <Ionicons name="radio-outline" size={14} color="#22C55E" />
                <Text style={styles.countPillGreenText}>
                  {runningDriversCount} rodando
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {!profileCity && !loading ? (
          <View style={styles.warningCard}>
            <View style={styles.warningIconBox}>
              <Ionicons name="location-outline" size={22} color="#FACC15" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Cidade não definida</Text>
              <Text style={styles.warningText}>
                Preencha o campo city do seu perfil para encontrar motoristas e entregadores da sua cidade.
              </Text>
            </View>
          </View>
        ) : null}

        {!profileCity && !loading ? (
          <View style={styles.actionGrid}>
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.actionCard}
              onPress={openMyAccount}
            >
              <View style={styles.actionIconBox}>
                <Ionicons name="person-outline" size={20} color="#D4A64A" />
              </View>
              <Text style={styles.actionTitle}>Minha conta</Text>
              <Text style={styles.actionText}>Conferir cidade do perfil</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#D4A64A" />
            <Text style={styles.loadingText}>Carregando todos da cidade...</Text>
          </View>
        ) : visibleDrivers.length === 0 && profileCity ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="people-outline" size={36} color="#8F8A91" />
            </View>
            <Text style={styles.emptyTitle}>Nenhum perfil encontrado</Text>
            <Text style={styles.emptyText}>
              Não encontrei outros perfis com profile.city igual a {profileCity}.
            </Text>
          </View>
        ) : (
          <View style={styles.driverList}>
            {visibleDrivers.map((driver) => {
              // Prepara os dados necessários para renderizar o card do motorista.
              const avatarUrl = getUserAvatarUrl(driver);
              const displayName = getUserDisplayName(driver);
              const userId = getDriverUserId(driver);
              const username = String(driver?.username ?? '').trim();
              const status = getDriverStatus(driver);
              const running = isDriverRunning(driver);

              return (
                <TouchableOpacity
                  key={String(userId)}
                  activeOpacity={0.88}
                  style={styles.driverCard}
                  onPress={() => openDriverProfile(driver)}
                >
                  <View style={styles.driverMainRow}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarFallbackText}>
                          {displayName.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.driverInfo}>
                      <Text style={styles.driverName} numberOfLines={1}>
                        {displayName}
                      </Text>

                      <Text style={styles.driverSubtitle} numberOfLines={1}>
                        {username ? `@${username}` : driver.city || 'Motorista da cidade'}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: status.backgroundColor,
                          borderColor: status.borderColor,
                        },
                      ]}
                    >
                      <Ionicons name={status.icon} size={14} color={status.color} />
                      <Text style={[styles.statusBadgeText, { color: status.color }]}>
                        {status.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.driverFooter}>
                    <View style={running ? styles.runningTimePill : styles.offlineTimePill}>
                      <Ionicons
                        name={running ? 'time-outline' : 'moon-outline'}
                        size={14}
                        color={running ? '#D4A64A' : '#8F8A91'}
                      />
                      <Text
                        style={
                          running
                            ? styles.runningTimeText
                            : styles.offlineTimeText
                        }
                      >
                        {running
                          ? formatRunningTime(driver)
                          : 'não está rodando agora'}
                      </Text>
                    </View>

                    <View style={styles.openProfileRow}>
                      <Text style={styles.openProfileText}>Ver perfil</Text>
                      <Ionicons name="chevron-forward" size={17} color="#D4A64A" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * Estilos da página.
 *
 * Paleta:
 * - Fundo escuro;
 * - Cards escuros;
 * - Dourado como cor principal;
 * - Verde para rodando;
 * - Amarelo para pausado;
 * - Cinza para offline.
 */
const styles = StyleSheet.create({
  // Fundo principal da página.
  screen: { flex: 1, backgroundColor: '#050505' },
  // Container do ScrollView.
  container: { flex: 1, backgroundColor: '#050505' },
  // Espaçamento interno do conteúdo.
  content: { paddingHorizontal: 18, paddingTop: 48, paddingBottom: 150 },
  // Header fixo no topo da lista.
  header: {
    marginHorizontal: -18,
    marginTop: -48,
    marginBottom: 16,
    paddingTop: 48,
    paddingBottom: 18,
    paddingHorizontal: 18,
    backgroundColor: '#070707',
    borderBottomWidth: 1,
    borderBottomColor: '#211D16',
    zIndex: 20,
    elevation: 20,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Botão de voltar.
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContent: { flex: 1, minWidth: 0 },
  headerEyebrow: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: '#F5F0E6',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  // Card de resumo com cidade e contadores.
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    backgroundColor: '#101014',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#D4A64A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.07,
    shadowRadius: 22,
    elevation: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroIconBox: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Badge com total de usuários encontrados.
  heroBadge: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.24)',
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: '#22C55E' },
  heroBadgeText: { color: '#86EFAC', fontSize: 12, fontWeight: '900' },
  heroTitle: {
    color: '#F5F0E6',
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
  },
  countRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  countPill: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.20)',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countPillText: { color: '#E8D49B', fontSize: 11, fontWeight: '900' },
  countPillGreen: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.20)',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countPillGreenText: { color: '#86EFAC', fontSize: 11, fontWeight: '900' },
  // Aviso quando profile.city não está preenchido.
  warningCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.24)',
    backgroundColor: 'rgba(250,204,21,0.08)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  warningIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningTitle: { color: '#F5F0E6', fontSize: 14, fontWeight: '900' },
  warningText: {
    color: '#D8D1C4',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  actionGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2830',
    backgroundColor: '#101014',
    padding: 13,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionTitle: { color: '#F5F0E6', fontSize: 13, fontWeight: '900' },
  actionText: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
    marginTop: 4,
  },
  // Caixa de carregamento.
  loadingBox: {
    minHeight: 220,
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: { color: '#9B969B', fontSize: 13, fontWeight: '800', marginTop: 12 },
  // Estado vazio quando não há outros perfis na cidade.
  emptyState: {
    minHeight: 250,
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyIconBox: {
    width: 70,
    height: 70,
    borderRadius: 18,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'center',
  },
  driverList: { gap: 10 },
  // Card individual do motorista.
  driverCard: {
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 14,
  },
  driverMainRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  // Foto do motorista.
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.30)',
    backgroundColor: '#18171D',
  },
  // Avatar com inicial quando não existe foto.
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: '#D4A64A', fontSize: 19, fontWeight: '900' },
  driverInfo: { flex: 1, minWidth: 0 },
  driverName: { color: '#F5F0E6', fontSize: 15, fontWeight: '900' },
  driverSubtitle: { color: '#9B969B', fontSize: 12, fontWeight: '800', marginTop: 3 },
  // Badge de status: Rodando agora, Pausado ou Offline.
  statusBadge: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '900' },
  driverFooter: {
    borderTopWidth: 1,
    borderTopColor: '#2A2830',
    marginTop: 12,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  // Pílula com tempo rodando.
  runningTimePill: {
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.18)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  runningTimeText: { color: '#E8D49B', fontSize: 11, fontWeight: '900' },
  // Pílula exibida quando o motorista não está rodando.
  offlineTimePill: {
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(143,138,145,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(143,138,145,0.18)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  offlineTimeText: { color: '#9B969B', fontSize: 11, fontWeight: '900' },
  openProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  openProfileText: { color: '#D4A64A', fontSize: 12, fontWeight: '900' },
});
