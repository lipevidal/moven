/**
 * Página: Membros da comunidade da região
 *
 * Caminho esperado no projeto:
 * app/(private)/(tabs)/motoristas-cidade-lista.tsx
 *
 * Objetivo:
 * Exibir todos os motoristas/entregadores que possuem profiles.regiao_imediata
 * igual à regiao_imediata do usuário logado.
 */

import { useCallback, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { supabase } from '../../../src/database/supabase';
import { PublicUserProfileModal } from '../../../src/features/profile/components/PublicUserProfileModal';

type IconName = keyof typeof Ionicons.glyphMap;

type DriverStatusInfo = {
  label: string;
  icon: IconName;
  color: string;
  backgroundColor: string;
  borderColor: string;
};

function normalizeText(value?: string | null) {
  return String(value ?? '').trim();
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
  const fullName = String(
    user?.full_name ||
      user?.name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      'Motorista',
  ).trim();

  const nameParts = fullName.split(/\s+/).filter(Boolean);

  if (nameParts.length <= 2) {
    return nameParts.join(' ') || 'Motorista';
  }

  return `${nameParts[0]} ${nameParts[1]}`;
}

function getDriverUserId(driver: any) {
  return driver?.user_id || driver?.id || driver?.profile?.user_id || driver?.profile?.id || null;
}

function getProfileAuthUserId(profile: any) {
  return profile?.user_id || profile?.id || null;
}

function getDriverSession(driver: any) {
  return driver?.active_session || driver?.session || null;
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

function getDriverStartedAt(driver: any) {
  const session = getDriverSession(driver);

  return session?.started_at || session?.startedAt || null;
}

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
          Math.floor((pausedAt.getTime() - startedAt.getTime()) / 1000) - pausedSeconds,
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

function formatRunningTime(driver: any) {
  const seconds = getDriverChronometerSeconds(driver);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours <= 0 && minutes <= 0) return 'começou agora';
  if (hours <= 0) return `rodando há ${minutes}min`;
  if (minutes <= 0) return `rodando há ${hours}h`;

  return `rodando há ${hours}h ${minutes}min`;
}

function isDriverRunning(driver: any) {
  const session = getDriverSession(driver);
  const status = String(session?.status ?? '').toLowerCase();

  return status === 'active';
}

function getDriverStatus(driver: any): DriverStatusInfo {
  const session = getDriverSession(driver);
  const status = String(session?.status ?? '').toLowerCase();

  if (status === 'active') {
    return {
      label: 'Rodando agora',
      icon: 'radio-outline',
      color: '#22C55E',
      backgroundColor: 'rgba(34,197,94,0.12)',
      borderColor: 'rgba(34,197,94,0.26)',
    };
  }

  if (status === 'paused') {
    return {
      label: 'Pausado',
      icon: 'pause-circle-outline',
      color: '#FACC15',
      backgroundColor: 'rgba(250,204,21,0.12)',
      borderColor: 'rgba(250,204,21,0.26)',
    };
  }

  return {
    label: 'Offline',
    icon: 'ellipse-outline',
    color: '#8F8A91',
    backgroundColor: 'rgba(143,138,145,0.10)',
    borderColor: 'rgba(143,138,145,0.22)',
  };
}

export default function CityDriversListScreen() {
  const [currentUserId, setCurrentUserId] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [profileImmediateRegion, setProfileImmediateRegion] = useState('');
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const totalMembersCount = drivers.length;

  const runningDriversCount = useMemo(
    () => drivers.filter((driver) => isDriverRunning(driver)).length,
    [drivers],
  );

  const offlineDriversCount = useMemo(
    () => Math.max(totalMembersCount - runningDriversCount, 0),
    [totalMembersCount, runningDriversCount],
  );

  async function getLoggedUserRegion() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    const userId = user?.id ?? '';

    setCurrentUserId(userId);

    if (!userId) {
      return {
        city: '',
        immediateRegion: '',
      };
    }

    const { data: profileById, error: profileByIdError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileByIdError) {
      console.log('Erro ao buscar profile por id:', profileByIdError);
    }

    if (profileById) {
      return {
        city: normalizeText(profileById.city),
        immediateRegion: normalizeText(profileById.regiao_imediata || profileById.region),
      };
    }

    const { data: profileByUserId, error: profileByUserIdError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileByUserIdError) {
      console.log('Fallback profiles.user_id não disponível:', profileByUserIdError);
    }

    if (profileByUserId) {
      return {
        city: normalizeText(profileByUserId.city),
        immediateRegion: normalizeText(profileByUserId.regiao_imediata || profileByUserId.region),
      };
    }

    return {
      city: normalizeText(
        user?.user_metadata?.city ||
          user?.user_metadata?.profile_city ||
          user?.user_metadata?.municipality,
      ),
      immediateRegion: normalizeText(
        user?.user_metadata?.regiao_imediata ||
          user?.user_metadata?.immediate_region ||
          user?.user_metadata?.region,
      ),
    };
  }

  async function getAllProfilesFromSameRegion(immediateRegion: string, fallbackCity: string) {
    const cleanRegion = normalizeText(immediateRegion);
    const cleanCity = normalizeText(fallbackCity);

    if (cleanRegion) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('regiao_imediata', cleanRegion)
        .order('full_name', { ascending: true });

      if (error) {
        console.log('Erro ao buscar profiles por regiao_imediata:', error);
        throw error;
      }

      return data ?? [];
    }

    if (cleanCity) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('city', cleanCity)
        .order('full_name', { ascending: true });

      if (error) {
        console.log('Erro ao buscar profiles por city:', error);
        throw error;
      }

      return data ?? [];
    }

    return [];
  }

  async function getActiveOrPausedSessionsByUserId(userIds: string[]) {
    if (userIds.length === 0) return {};

    const { data, error } = await supabase
      .from('work_sessions')
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

  async function loadDrivers(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { city, immediateRegion } = await getLoggedUserRegion();

      setProfileCity(city);
      setProfileImmediateRegion(immediateRegion);

      if (!immediateRegion && !city) {
        setDrivers([]);
        return;
      }

      const profilesFromSameRegion = await getAllProfilesFromSameRegion(immediateRegion, city);

      const userIds = Array.from(
        new Set(
          profilesFromSameRegion
            .map((profile) => String(getProfileAuthUserId(profile) ?? ''))
            .filter(Boolean),
        ),
      ) as string[];

      const sessionsByUserId = await getActiveOrPausedSessionsByUserId(userIds);

      const profilesWithSessionStatus = profilesFromSameRegion.map((profile) => {
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
      console.log('Erro ao carregar membros da região:', error);
      setDrivers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadDrivers();
    }, []),
  );

  function openDriverProfile(driver: any) {
    const userId = getDriverUserId(driver);

    if (!userId) return;

    setSelectedProfile(driver);
  }

  function closeDriverProfileModal() {
    setSelectedProfile(null);
  }

  function openCommunityAreas() {
    router.replace('/(private)/(tabs)/motoristas-cidade' as never);
  }

  function openMyAccount() {
    router.push('/(private)/(tabs)/minha-conta' as never);
  }

  const communityRegion = profileImmediateRegion || profileCity || 'sua região';

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
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.backButton}
              onPress={openCommunityAreas}
            >
              <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
            </TouchableOpacity>

            <View style={styles.headerTextContent}>
              <Text style={styles.headerEyebrow}>Comunidade</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Membros da região
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.feedButton}
              onPress={openCommunityAreas}
            >
              <Ionicons name="grid-outline" size={21} color="#D4A64A" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroIconBox}>
              <Ionicons name="people-circle-outline" size={30} color="#D4A64A" />
            </View>

            <View style={styles.heroTitleContent}>
              <Text style={styles.heroEyebrow}>Membros da regiao de</Text>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {communityRegion}
              </Text>
            </View>
          </View>

          <Text style={styles.heroDescription}>
            Motoristas e entregadores próximos da sua região imediata. Veja quem está rodando,
            acompanhe perfis públicos e encontre pessoas da comunidade.
          </Text>

          <View style={styles.statsPanel}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalMembersCount}</Text>
              <Text style={styles.statLabel}>membros</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.statValueGreen]}>{runningDriversCount}</Text>
              <Text style={styles.statLabel}>rodando</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={styles.statValueMuted}>{offlineDriversCount}</Text>
              <Text style={styles.statLabel}>offline</Text>
            </View>
          </View>
        </View>

        {!communityRegion || communityRegion === 'sua região' ? (
          !loading ? (
            <>
              <View style={styles.warningCard}>
                <View style={styles.warningIconBox}>
                  <Ionicons name="location-outline" size={22} color="#FACC15" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.warningTitle}>Região não definida</Text>
                  <Text style={styles.warningText}>
                    Atualize sua cidade onde mora para o app identificar sua região imediata.
                  </Text>
                </View>
              </View>

              <TouchableOpacity activeOpacity={0.88} style={styles.accountCard} onPress={openMyAccount}>
                <View style={styles.accountIconBox}>
                  <Ionicons name="person-outline" size={20} color="#D4A64A" />
                </View>

                <View style={styles.accountInfo}>
                  <Text style={styles.accountTitle}>Minha conta</Text>
                  <Text style={styles.accountText}>Conferir dados de cidade e região</Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color="#D4A64A" />
              </TouchableOpacity>
            </>
          ) : null
        ) : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Lista</Text>
            <Text style={styles.sectionTitle}>Membros da comunidade</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#D4A64A" />
            <Text style={styles.loadingText}>Carregando membros da região...</Text>
          </View>
        ) : visibleDrivers.length === 0 && communityRegion !== 'sua região' ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="people-outline" size={36} color="#8F8A91" />
            </View>

            <Text style={styles.emptyTitle}>Nenhum membro encontrado</Text>
            <Text style={styles.emptyText}>
              Ainda não encontrei outros perfis cadastrados na região de {communityRegion}.
            </Text>
          </View>
        ) : (
          <View style={styles.driverList}>
            {visibleDrivers.map((driver) => {
              const avatarUrl = getUserAvatarUrl(driver);
              const displayName = getUserDisplayName(driver);
              const userId = getDriverUserId(driver);
              const username = String(driver?.username ?? '').trim();
              const status = getDriverStatus(driver);
              const running = isDriverRunning(driver);
              const driverCity = normalizeText(driver?.city);

              return (
                <TouchableOpacity
                  key={String(userId)}
                  activeOpacity={0.88}
                  style={[
                    styles.driverCard,
                    running && styles.driverCardRunning,
                  ]}
                  onPress={() => openDriverProfile(driver)}
                >
                  <View style={styles.driverGlow} />

                  <View style={styles.driverMainRow}>
                    <View style={styles.avatarWrap}>
                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                      ) : (
                        <View style={styles.avatarFallback}>
                          <Text style={styles.avatarFallbackText}>
                            {displayName.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                      )}

                      {running ? <View style={styles.liveDot} /> : null}
                    </View>

                    <View style={styles.driverInfo}>
                      <Text style={styles.driverName} numberOfLines={1}>
                        {displayName}
                      </Text>

                      <Text style={styles.driverSubtitle} numberOfLines={1}>
                        {username ? `@${username}` : driverCity || 'Motorista da região'}
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

                  <View style={styles.driverMetaRow}>
                    {driverCity ? (
                      <View style={styles.metaPill}>
                        <Ionicons name="business-outline" size={14} color="#D4A64A" />
                        <Text style={styles.metaPillText} numberOfLines={1}>
                          {driverCity}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.metaPill}>
                        <Ionicons name="business-outline" size={14} color="#D4A64A" />
                        <Text style={styles.metaPillText} numberOfLines={1}>
                          Cidade não informada
                        </Text>
                      </View>
                    )}

                    <View style={running ? styles.runningTimePill : styles.offlineTimePill}>
                      <Ionicons
                        name={running ? 'time-outline' : 'moon-outline'}
                        size={14}
                        color={running ? '#D4A64A' : '#8F8A91'}
                      />

                      <Text
                        style={running ? styles.runningTimeText : styles.offlineTimeText}
                        numberOfLines={1}
                      >
                        {running ? formatRunningTime(driver) : 'não está rodando'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <PublicUserProfileModal
        visible={Boolean(selectedProfile)}
        profile={selectedProfile}
        userId={getDriverUserId(selectedProfile)}
        onClose={closeDriverProfileModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },

  container: {
    flex: 1,
    backgroundColor: '#050505',
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 116,
  },

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
    zIndex: 50,
    elevation: 50,
  },

  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  feedButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTextContent: {
    flex: 1,
    minWidth: 0,
  },

  headerEyebrow: {
    color: '#D4A64A',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  headerTitle: {
    color: '#F5F0E6',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },

  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.30)',
    backgroundColor: '#101014',
    padding: 18,
    marginBottom: 14,
  },

  heroGlowOne: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(212,166,74,0.17)',
    right: -75,
    top: -80,
  },

  heroGlowTwo: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(34,197,94,0.08)',
    left: -60,
    bottom: -70,
  },

  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },

  heroIconBox: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: 'rgba(212,166,74,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroTitleContent: {
    flex: 1,
    minWidth: 0,
  },

  heroEyebrow: {
    color: '#D4A64A',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  heroTitle: {
    color: '#F5F0E6',
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.55,
    marginTop: 3,
  },

  heroDescription: {
    color: '#BDB5A7',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 14,
  },

  statsPanel: {
    minHeight: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(5,5,5,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(245,240,230,0.08)',
    marginTop: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statValue: {
    color: '#F5F0E6',
    fontSize: 21,
    fontWeight: '900',
  },

  statValueGreen: {
    color: '#86EFAC',
  },

  statValueMuted: {
    color: '#D8D1C4',
    fontSize: 21,
    fontWeight: '900',
  },

  statLabel: {
    color: '#8F8A91',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },

  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(245,240,230,0.10)',
  },

  warningCard: {
    borderRadius: 18,
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
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  warningTitle: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  warningText: {
    color: '#D8D1C4',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },

  accountCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    backgroundColor: '#101014',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },

  accountIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  accountInfo: {
    flex: 1,
    minWidth: 0,
  },

  accountTitle: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  accountText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  sectionHeader: {
    marginTop: 4,
    marginBottom: 12,
  },

  sectionEyebrow: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },

  sectionTitle: {
    color: '#F5F0E6',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 2,
  },

  loadingBox: {
    minHeight: 220,
    borderRadius: 18,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  loadingText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 12,
  },

  emptyState: {
    minHeight: 260,
    borderRadius: 20,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  emptyIconBox: {
    width: 74,
    height: 74,
    borderRadius: 22,
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

  driverList: {
    gap: 12,
    width: '100%',
    alignSelf: 'center',
  },

  driverCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 14,
  },

  driverCardRunning: {
    borderColor: 'rgba(34,197,94,0.24)',
  },

  driverGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(212,166,74,0.06)',
    right: -65,
    top: -50,
  },

  driverMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },

  avatarWrap: {
    position: 'relative',
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.30)',
    backgroundColor: '#18171D',
  },

  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarFallbackText: {
    color: '#D4A64A',
    fontSize: 20,
    fontWeight: '900',
  },

  liveDot: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 999,
    right: -2,
    bottom: -2,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#101014',
  },

  driverInfo: {
    flex: 1,
    minWidth: 0,
  },

  driverName: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
  },

  driverSubtitle: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },

  statusBadge: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },

  driverMetaRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,240,230,0.07)',
    marginTop: 12,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  metaPill: {
    flex: 1,
    minWidth: 0,
    minHeight: 31,
    borderRadius: 999,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.18)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  metaPillText: {
    flex: 1,
    color: '#E8D49B',
    fontSize: 11,
    fontWeight: '900',
  },

  runningTimePill: {
    flexShrink: 0,
    maxWidth: '48%',
    minHeight: 31,
    borderRadius: 999,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.18)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  runningTimeText: {
    flexShrink: 1,
    color: '#E8D49B',
    fontSize: 11,
    fontWeight: '900',
  },

  offlineTimePill: {
    flexShrink: 0,
    maxWidth: '48%',
    minHeight: 31,
    borderRadius: 999,
    backgroundColor: 'rgba(143,138,145,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(143,138,145,0.18)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  offlineTimeText: {
    flexShrink: 1,
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '900',
  },

});
