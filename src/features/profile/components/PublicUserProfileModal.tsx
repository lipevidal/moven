import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../database/supabase';

type JourneyProfileType = 'empty' | 'light' | 'moderate' | 'intensive';

type PublicUserProfileModalProps = {
  visible: boolean;
  profile?: any | null;
  userId?: string | null;
  onClose: () => void;
};

type UserProfileStats = {
  averageHoursPerDay: number;
  averageKmPerDay: number;
  journeyProfileType: JourneyProfileType;
  hasWorkData: boolean;
};

type SocialLink = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  url: string;
};

const ONE_HUNDRED_DAYS = 100;

function normalizeText(value?: string | number | null) {
  return String(value ?? '').trim();
}

function normalizeComparableText(value?: string | number | null) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getFirstFilledValue(...values: any[]) {
  for (const value of values) {
    const text = normalizeText(value);

    if (text) return text;
  }

  return '';
}

function getNumberValue(...values: any[]) {
  for (const value of values) {
    const numberValue = Number(value);

    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  return 0;
}

function getFirstAndSecondName(value?: string | null) {
  const parts = normalizeText(value)
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 2) return parts.join(' ');

  return parts.slice(0, 2).join(' ');
}

function getProfileDisplayName(profile: any) {
  return (
    getFirstAndSecondName(
      profile?.full_name ||
        profile?.name ||
        profile?.user_metadata?.full_name ||
        profile?.user_metadata?.name,
    ) || 'Sem dados'
  );
}

function getUfFromStateName(value?: string | null) {
  const state = normalizeComparableText(value);

  const states: Record<string, string> = {
    acre: 'AC',
    alagoas: 'AL',
    amapa: 'AP',
    amazonas: 'AM',
    bahia: 'BA',
    ceara: 'CE',
    'distrito federal': 'DF',
    'espirito santo': 'ES',
    goias: 'GO',
    maranhao: 'MA',
    'mato grosso': 'MT',
    'mato grosso do sul': 'MS',
    'minas gerais': 'MG',
    para: 'PA',
    paraiba: 'PB',
    parana: 'PR',
    pernambuco: 'PE',
    piaui: 'PI',
    'rio de janeiro': 'RJ',
    'rio grande do norte': 'RN',
    'rio grande do sul': 'RS',
    rondonia: 'RO',
    roraima: 'RR',
    'santa catarina': 'SC',
    'sao paulo': 'SP',
    sergipe: 'SE',
    tocantins: 'TO',
  };

  return states[state] ?? '';
}

function getProfileStateUf(profile: any) {
  const directUf = normalizeText(
    profile?.estado_uf ||
      profile?.uf ||
      profile?.state_uf ||
      profile?.sigla_uf ||
      profile?.sigla_estado ||
      profile?.user_metadata?.estado_uf ||
      profile?.user_metadata?.uf ||
      profile?.user_metadata?.state_uf ||
      profile?.user_metadata?.sigla_uf ||
      profile?.user_metadata?.sigla_estado,
  ).toUpperCase();

  if (directUf.length === 2) return directUf;

  return getUfFromStateName(
    profile?.estado ||
      profile?.state_name ||
      profile?.nome_estado ||
      profile?.user_metadata?.estado ||
      profile?.user_metadata?.state_name ||
      profile?.user_metadata?.nome_estado,
  );
}

function getProfileCityDisplay(profile: any) {
  const city = normalizeText(
    profile?.city ||
      profile?.cidade ||
      profile?.user_metadata?.city ||
      profile?.user_metadata?.profile_city,
  );
  const uf = getProfileStateUf(profile);

  if (!city) return 'Sem dados';

  return uf ? `${city} ${uf}` : city;
}

function getProfileAvatarUrl(profile: any) {
  return (
    profile?.avatar_url ||
    profile?.photo_url ||
    profile?.picture ||
    profile?.user_metadata?.avatar_url ||
    profile?.user_metadata?.picture ||
    null
  );
}

function getProfileSocialValue(profile: any, key: string) {
  return normalizeText(profile?.[key] || profile?.user_metadata?.[key]);
}

function buildInstagramUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;

  const username = value.replace('@', '').trim();
  return `https://instagram.com/${username}`;
}

function buildTiktokUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;

  const username = value.replace('@', '').trim();
  return `https://www.tiktok.com/@${username}`;
}

function buildWhatsappUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;

  const digits = value.replace(/\D/g, '');
  const phone = digits.startsWith('55') ? digits : `55${digits}`;

  return `https://wa.me/${phone}`;
}

function buildYoutubeUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;

  const cleanValue = value.trim();

  if (cleanValue.startsWith('@')) return `https://www.youtube.com/${cleanValue}`;

  return `https://www.youtube.com/@${cleanValue}`;
}

function getPublicSocialLinks(profile: any): SocialLink[] {
  const instagram = getProfileSocialValue(profile, 'instagram');
  const tiktok = getProfileSocialValue(profile, 'tiktok');
  const whatsapp = getProfileSocialValue(profile, 'whatsapp');
  const youtube = getProfileSocialValue(profile, 'youtube');

  return [
    instagram
      ? {
          key: 'instagram',
          icon: 'logo-instagram' as const,
          color: '#E1306C',
          url: buildInstagramUrl(instagram),
        }
      : null,
    tiktok
      ? {
          key: 'tiktok',
          icon: 'logo-tiktok' as const,
          color: '#F5F0E6',
          url: buildTiktokUrl(tiktok),
        }
      : null,
    whatsapp
      ? {
          key: 'whatsapp',
          icon: 'logo-whatsapp' as const,
          color: '#22C55E',
          url: buildWhatsappUrl(whatsapp),
        }
      : null,
    youtube
      ? {
          key: 'youtube',
          icon: 'logo-youtube' as const,
          color: '#EF4444',
          url: buildYoutubeUrl(youtube),
        }
      : null,
  ].filter(Boolean) as SocialLink[];
}

function getProfileUserIdCandidates(profile: any, fallbackUserId?: string | null) {
  const candidates = [
    profile?.user_id,
    profile?.auth_user_id,
    profile?.owner_id,
    profile?.driver_id,
    profile?.profile_id,
    profile?.id,
    profile?.profile?.user_id,
    profile?.profile?.auth_user_id,
    profile?.profile?.owner_id,
    profile?.profile?.driver_id,
    profile?.profile?.profile_id,
    profile?.profile?.id,
    profile?.user?.user_id,
    profile?.user?.auth_user_id,
    profile?.user?.owner_id,
    profile?.user?.driver_id,
    profile?.user?.id,
    profile?.active_session?.user_id,
    profile?.active_session?.profile_id,
    profile?.active_session?.driver_id,
    profile?.session?.user_id,
    profile?.session?.profile_id,
    profile?.session?.driver_id,
    fallbackUserId,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  return Array.from(new Set(candidates));
}

function getProfileAuthUserId(profile: any, fallbackUserId?: string | null) {
  return getProfileUserIdCandidates(profile, fallbackUserId)[0] || '';
}

function pickBestProfileRow(rows: any[], candidates: string[]) {
  if (rows.length === 0) return null;

  return (
    rows.find((row) => candidates.includes(normalizeText(row?.user_id))) ||
    rows.find((row) => candidates.includes(normalizeText(row?.id))) ||
    rows[0]
  );
}

function isFinishedSession(session: any) {
  const status = normalizeComparableText(session?.status);

  return (
    status === 'finished' ||
    status === 'finalizada' ||
    status === 'completed' ||
    status === 'done' ||
    Boolean(session?.finished_at || session?.finishedAt || session?.end_time || session?.endTime)
  );
}

async function searchFinishedSessionsByUserIds(userIds: string[]) {
  const uniqueUserIds = Array.from(
    new Set(userIds.map((value) => normalizeText(value)).filter(Boolean)),
  );

  if (uniqueUserIds.length === 0) return [];

  const lookupColumns = ['user_id', 'profile_id', 'driver_id', 'owner_id'];
  const rowsById = new Map<string, any>();

  for (const column of lookupColumns) {
    try {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*')
        .in(column, uniqueUserIds)
        .limit(5000);

      if (error) {
        console.log(`Modal perfil: não foi possível buscar work_sessions por ${column}:`, error);
        continue;
      }

      const rows = (data ?? []).filter(isFinishedSession);

      console.log(`Modal perfil: ${rows.length} jornadas encontradas por ${column}`);

      rows.forEach((session: any, index: number) => {
        const key = normalizeText(session?.id) || `${column}-${index}-${JSON.stringify(session)}`;

        rowsById.set(key, session);
      });
    } catch (error) {
      console.log(`Modal perfil: erro inesperado ao buscar work_sessions por ${column}:`, error);
    }
  }

  return Array.from(rowsById.values());
}

async function loadPublicProfileStatsByRpc(userIds: string[]) {
  const uniqueUserIds = Array.from(
    new Set(userIds.map((value) => normalizeText(value)).filter(Boolean)),
  );

  for (const candidateUserId of uniqueUserIds) {
    try {
      const { data, error } = await supabase.rpc('get_public_profile_stats', {
        p_user_id: candidateUserId,
      });

      if (error) {
        console.log('Modal perfil: RPC get_public_profile_stats indisponível:', error);
        continue;
      }

      const row = Array.isArray(data) ? data[0] : data;

      if (!row) continue;

      console.log('Modal perfil: métricas carregadas via RPC:', row);

      return {
        userId: candidateUserId,
        averageHoursPerDay: Number(row.average_hours_per_day ?? 0),
        averageKmPerDay: Number(row.average_km_per_day ?? 0),
        hasWorkData: Boolean(row.has_work_data),
      };
    } catch (error) {
      console.log('Modal perfil: erro inesperado na RPC get_public_profile_stats:', error);
    }
  }

  return null;
}

function getSessionBaseDate(session: any) {
  const baseDate = getFirstFilledValue(
    session?.started_at,
    session?.startedAt,
    session?.start_time,
    session?.startTime,
    session?.created_at,
    session?.createdAt,
    session?.finished_at,
    session?.finishedAt,
    session?.end_time,
    session?.endTime,
  );

  if (!baseDate) return null;

  const date = new Date(baseDate);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getSessionDayKey(session: any) {
  const date = getSessionBaseDate(session);

  if (!date) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function calculateSessionHours(session: any) {
  const directHours = getNumberValue(
    session?.total_hours,
    session?.totalHours,
    session?.worked_hours,
    session?.workedHours,
    session?.duration_hours,
    session?.durationHours,
  );

  if (directHours > 0) return directHours;

  const directMinutes = getNumberValue(
    session?.total_minutes,
    session?.totalMinutes,
    session?.worked_minutes,
    session?.workedMinutes,
    session?.duration_minutes,
    session?.durationMinutes,
  );

  if (directMinutes > 0) return directMinutes / 60;

  const directSeconds = getNumberValue(
    session?.worked_seconds,
    session?.workedSeconds,
    session?.elapsed_seconds,
    session?.elapsedSeconds,
    session?.duration_seconds,
    session?.durationSeconds,
    session?.total_seconds,
    session?.totalSeconds,
  );

  if (directSeconds > 0) return directSeconds / 3600;

  const startedAtValue = getFirstFilledValue(
    session?.started_at,
    session?.startedAt,
    session?.start_time,
    session?.startTime,
  );
  const finishedAtValue = getFirstFilledValue(
    session?.finished_at,
    session?.finishedAt,
    session?.end_time,
    session?.endTime,
  );

  if (!startedAtValue || !finishedAtValue) return 0;

  const startedAt = new Date(startedAtValue).getTime();
  const finishedAt = new Date(finishedAtValue).getTime();

  if (Number.isNaN(startedAt) || Number.isNaN(finishedAt)) return 0;

  const pausedSeconds = getNumberValue(
    session?.total_paused_seconds,
    session?.totalPausedSeconds,
    session?.paused_seconds,
    session?.pausedSeconds,
  );
  const totalSeconds = Math.max(
    (finishedAt - startedAt) / 1000 - pausedSeconds,
    0,
  );

  return totalSeconds / 3600;
}

function calculateSessionKm(session: any) {
  const directKm = getNumberValue(
    session?.total_km,
    session?.totalKm,
    session?.distance_km,
    session?.distanceKm,
    session?.km_total,
    session?.kmTotal,
    session?.kilometers,
  );

  if (directKm > 0) return directKm;

  const startKm = getNumberValue(
    session?.start_km,
    session?.startKm,
    session?.initial_km,
    session?.initialKm,
    session?.km_start,
    session?.kmStart,
    session?.odometer_start,
    session?.odometerStart,
  );
  const endKm = getNumberValue(
    session?.end_km,
    session?.endKm,
    session?.final_km,
    session?.finalKm,
    session?.km_end,
    session?.kmEnd,
    session?.odometer_end,
    session?.odometerEnd,
  );

  return Math.max(endKm - startKm, 0);
}

function getLast100DaysStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - (ONE_HUNDRED_DAYS - 1));
  date.setHours(0, 0, 0, 0);

  return date;
}

function getAverageDivisorFromFirstDataDay(firstDataDate: Date | null) {
  if (!firstDataDate) return ONE_HUNDRED_DAYS;

  const start = new Date(firstDataDate);
  start.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysSinceFirstData =
    Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return Math.min(Math.max(daysSinceFirstData, 1), ONE_HUNDRED_DAYS);
}

function getJourneyProfileType(averageHoursPerDay: number): JourneyProfileType {
  if (averageHoursPerDay >= 8) return 'intensive';
  if (averageHoursPerDay >= 5) return 'moderate';

  return 'light';
}

function getJourneyProfileInfo(type: JourneyProfileType) {
  if (type === 'empty') {
    return {
      title: 'Sem dados',
      icon: 'help-circle-outline' as const,
      color: '#9B969B',
      backgroundColor: 'rgba(143,138,145,0.10)',
      borderColor: 'rgba(143,138,145,0.24)',
    };
  }

  if (type === 'intensive') {
    return {
      title: 'Jornada intensiva',
      icon: 'flame-outline' as const,
      color: '#F97316',
      backgroundColor: 'rgba(249,115,22,0.12)',
      borderColor: 'rgba(249,115,22,0.30)',
    };
  }

  if (type === 'moderate') {
    return {
      title: 'Jornada moderada',
      icon: 'speedometer-outline' as const,
      color: '#22C55E',
      backgroundColor: 'rgba(34,197,94,0.12)',
      borderColor: 'rgba(34,197,94,0.30)',
    };
  }

  return {
    title: 'Jornada leve',
    icon: 'leaf-outline' as const,
    color: '#D4A64A',
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderColor: 'rgba(212,166,74,0.30)',
  };
}

function formatAverageHours(value: number) {
  const totalMinutes = Math.round(Number(value ?? 0) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}h`;
}

function formatAverageKm(value: number) {
  return `${Number(value ?? 0).toLocaleString('pt-BR', {
    maximumFractionDigits: 0,
  })} km`;
}

export function PublicUserProfileModal({
  visible,
  profile,
  userId,
  onClose,
}: PublicUserProfileModalProps) {
  const [loadedProfile, setLoadedProfile] = useState<any>(profile ?? null);
  const [stats, setStats] = useState<UserProfileStats>({
    averageHoursPerDay: 0,
    averageKmPerDay: 0,
    journeyProfileType: 'empty',
    hasWorkData: false,
  });
  const [loading, setLoading] = useState(false);

  const displayProfile = loadedProfile || profile;
  const avatarUrl = getProfileAvatarUrl(displayProfile);
  const displayName = getProfileDisplayName(displayProfile);
  const cityDisplay = getProfileCityDisplay(displayProfile);
  const socialLinks = useMemo(() => getPublicSocialLinks(displayProfile), [displayProfile]);
  const journeyProfile = getJourneyProfileInfo(stats.journeyProfileType);

  const loadProfileDetails = useCallback(async () => {
    const initialCandidates = getProfileUserIdCandidates(profile, userId);

    if (!visible || initialCandidates.length === 0) return;

    try {
      setLoading(true);

      let nextProfile = profile ?? null;
      let loadedProfileRows: any[] = [];

      const { data: profilesById, error: profilesByIdError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', initialCandidates)
        .limit(5);

      if (!profilesByIdError && profilesById?.length) {
        loadedProfileRows = [...loadedProfileRows, ...profilesById];
      } else if (profilesByIdError) {
        console.log('Fallback profiles.id não disponível:', profilesByIdError);
      }

      const bestProfileRow = pickBestProfileRow(loadedProfileRows, initialCandidates);

      if (bestProfileRow) {
        nextProfile = {
          ...(profile ?? {}),
          ...bestProfileRow,
        };
      }

      setLoadedProfile(nextProfile ?? profile ?? null);

      const sessionUserIds = Array.from(
        new Set([
          ...initialCandidates,
          ...getProfileUserIdCandidates(nextProfile, userId),
        ]),
      ).filter(Boolean);

      const rpcStats = await loadPublicProfileStatsByRpc(sessionUserIds);

      if (rpcStats) {
        setStats({
          averageHoursPerDay: rpcStats.averageHoursPerDay,
          averageKmPerDay: rpcStats.averageKmPerDay,
          journeyProfileType: rpcStats.hasWorkData
            ? getJourneyProfileType(rpcStats.averageHoursPerDay)
            : 'empty',
          hasWorkData: rpcStats.hasWorkData,
        });
        return;
      }

      const startDate = getLast100DaysStartDate();

      console.log('Modal perfil: IDs usados para buscar jornadas:', sessionUserIds);

      const sessions = await searchFinishedSessionsByUserIds(sessionUserIds);

      const validSessions = sessions.filter((session: any) => {
        const sessionDate = getSessionBaseDate(session);

        return sessionDate ? sessionDate.getTime() >= startDate.getTime() : false;
      });

      console.log('Modal perfil: jornadas válidas nos últimos 100 dias:', validSessions.length);

      const workedDaysSet = new Set<string>();

      validSessions.forEach((session: any) => {
        const dayKey = getSessionDayKey(session);

        if (dayKey) {
          workedDaysSet.add(dayKey);
        }
      });

      const workedDaysCount = workedDaysSet.size;

      if (workedDaysCount === 0) {
        setStats({
          averageHoursPerDay: 0,
          averageKmPerDay: 0,
          journeyProfileType: 'empty',
          hasWorkData: false,
        });
        return;
      }

      let firstDataDate: Date | null = null;

      validSessions.forEach((session: any) => {
        const sessionDate = getSessionBaseDate(session);

        if (!sessionDate) return;

        if (!firstDataDate || sessionDate.getTime() < firstDataDate.getTime()) {
          firstDataDate = sessionDate;
        }
      });

      const averageDivisor = getAverageDivisorFromFirstDataDay(firstDataDate);

      const totalHours = validSessions.reduce((total: number, session: any) => {
        return total + calculateSessionHours(session);
      }, 0);

      const totalKm = validSessions.reduce((total: number, session: any) => {
        return total + calculateSessionKm(session);
      }, 0);

      const averageHoursPerDay = totalHours / averageDivisor;
      const averageKmPerDay = totalKm / averageDivisor;

      setStats({
        averageHoursPerDay,
        averageKmPerDay,
        journeyProfileType: getJourneyProfileType(averageHoursPerDay),
        hasWorkData: true,
      });
    } catch (error) {
      console.log('Erro ao carregar modal de perfil público:', error);
      setLoadedProfile(profile ?? null);
      setStats({
        averageHoursPerDay: 0,
        averageKmPerDay: 0,
        journeyProfileType: 'empty',
        hasWorkData: false,
      });
    } finally {
      setLoading(false);
    }
  }, [profile, userId, visible]);

  useEffect(() => {
    if (visible) {
      setLoadedProfile(profile ?? null);
      loadProfileDetails();
    }
  }, [loadProfileDetails, profile, visible]);

  async function openSocialUrl(url: string) {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log('Erro ao abrir rede social:', error);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          activeOpacity={1}
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
        />

        <View style={styles.modalCard}>
          <View style={styles.modalGlowOne} />
          <View style={styles.modalGlowTwo} />

          <TouchableOpacity activeOpacity={0.86} style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={21} color="#F5F0E6" />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalContent}
          >
            <View style={styles.profileHeader}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>
                    {displayName.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}

              <Text style={styles.nameText} numberOfLines={1}>
                {displayName}
              </Text>

              <View style={styles.cityRow}>
                <Ionicons name="location-outline" size={16} color="#D4A64A" />
                <Text style={styles.cityText} numberOfLines={1}>
                  {cityDisplay}
                </Text>
              </View>

              {socialLinks.length > 0 ? (
                <View style={styles.socialLinksRow}>
                  {socialLinks.map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      activeOpacity={0.86}
                      style={styles.socialLinkButton}
                      onPress={() => openSocialUrl(item.url)}
                    >
                      <Ionicons name={item.icon} size={19} color={item.color} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <View style={styles.metricIconBox}>
                  <Ionicons name="time-outline" size={22} color="#D4A64A" />
                </View>
                <Text style={styles.metricLabel}>Média horas/dia</Text>
                <Text style={styles.metricValue}>
                  {stats.hasWorkData ? formatAverageHours(stats.averageHoursPerDay) : 'Sem dados'}
                </Text>
              </View>

              <View style={styles.metricCard}>
                <View style={styles.metricIconBox}>
                  <Ionicons name="speedometer-outline" size={22} color="#D4A64A" />
                </View>
                <Text style={styles.metricLabel}>Média km/dia</Text>
                <Text style={styles.metricValue}>
                  {stats.hasWorkData ? formatAverageKm(stats.averageKmPerDay) : 'Sem dados'}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.journeyProfileCard,
                {
                  backgroundColor: journeyProfile.backgroundColor,
                  borderColor: journeyProfile.borderColor,
                },
              ]}
            >
              <View
                style={[
                  styles.journeyProfileIconBox,
                  { backgroundColor: `${journeyProfile.color}20` },
                ]}
              >
                <Ionicons
                  name={journeyProfile.icon}
                  size={25}
                  color={journeyProfile.color}
                />
              </View>

              <View style={styles.journeyProfileInfo}>
                <Text style={styles.journeyProfileEyebrow}>Perfil de jornada</Text>
                <Text style={[styles.journeyProfileTitle, { color: journeyProfile.color }]}>
                  {journeyProfile.title}
                </Text>
              </View>
            </View>

            {loading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color="#D4A64A" />
                <Text style={styles.loadingText}>Atualizando perfil...</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default PublicUserProfileModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.76)',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 34,
  },

  modalCard: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    maxHeight: '82%',
    borderRadius: 28,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.30)',
  },

  modalGlowOne: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(212,166,74,0.16)',
    right: -82,
    top: -82,
  },

  modalGlowTwo: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(34,197,94,0.08)',
    left: -72,
    bottom: -78,
  },

  closeButton: {
    position: 'absolute',
    top: 13,
    right: 13,
    zIndex: 5,
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(24,23,29,0.92)',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalContent: {
    padding: 18,
    paddingTop: 26,
    paddingBottom: 18,
  },

  profileHeader: {
    alignItems: 'center',
    paddingTop: 10,
  },

  avatar: {
    width: 94,
    height: 94,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#D4A64A',
    backgroundColor: '#18171D',
  },

  avatarFallback: {
    width: 94,
    height: 94,
    borderRadius: 28,
    backgroundColor: '#18171D',
    borderWidth: 2,
    borderColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarFallbackText: {
    color: '#D4A64A',
    fontSize: 34,
    fontWeight: '900',
  },

  nameText: {
    color: '#F5F0E6',
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 12,
    maxWidth: '92%',
  },

  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 7,
  },

  cityText: {
    color: '#BDB5A7',
    fontSize: 13,
    fontWeight: '800',
  },

  socialLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 13,
  },

  socialLinkButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(245,240,230,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,240,230,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },

  metricCard: {
    flex: 1,
    minHeight: 122,
    borderRadius: 18,
    backgroundColor: 'rgba(24,23,29,0.88)',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  metricIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },

  metricLabel: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },

  metricValue: {
    color: '#F5F0E6',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'center',
  },

  journeyProfileCard: {
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  journeyProfileIconBox: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  journeyProfileInfo: {
    flex: 1,
    minWidth: 0,
  },

  journeyProfileEyebrow: {
    color: '#9B969B',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },

  journeyProfileTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },

  loadingOverlay: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(5,5,5,0.30)',
    borderWidth: 1,
    borderColor: 'rgba(245,240,230,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  loadingText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
  },
});
