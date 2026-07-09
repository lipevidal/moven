
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../../../src/database/supabase";
import { PublicProfileNameLine } from "../../../src/features/profile/components/PublicProfileNameLine";

type JourneyProfileType = "intensive" | "moderate" | "light" | "empty";

type PublicProfile = {
  id: string;
  name?: string | null;
  full_name?: string | null;
  username?: string | null;
  city?: string | null;
  region?: string | null;
  avatar_url?: string | null;
};

type ProfileStats = {
  totalKm: number;
  totalHours: number;
  finishedSessions: number;
  workedDays: number;
  averageKmPerDay: number;
  averageHoursPerDay: number;
  journeyProfileAverageHours: number;
  journeyProfileDays: number;
  journeyProfileType: JourneyProfileType;
};

function formatNumber(value: number) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  });
}

function formatHours(value: number) {
  const totalMinutes = Math.round(Number(value ?? 0) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function calculateSessionHours(session: any) {
  if (!session?.started_at || !session?.finished_at) return 0;

  const startedAt = new Date(session.started_at).getTime();
  const finishedAt = new Date(session.finished_at).getTime();

  if (Number.isNaN(startedAt) || Number.isNaN(finishedAt)) return 0;

  const pausedSeconds = Number(session.total_paused_seconds ?? 0);
  const totalSeconds = Math.max(
    (finishedAt - startedAt) / 1000 - pausedSeconds,
    0,
  );

  return totalSeconds / 3600;
}

function getSessionDayKey(session: any) {
  const baseDate = session?.started_at || session?.finished_at;

  if (!baseDate) return null;

  const date = new Date(baseDate);

  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date) {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);

  return normalizedDate;
}

function getDaysBetween(startDate: Date, endDate: Date) {
  const start = startOfDay(startDate).getTime();
  const end = startOfDay(endDate).getTime();

  return Math.max(
    Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1,
    1,
  );
}

function getSessionBaseDate(session: any) {
  const baseDate = session?.started_at || session?.finished_at;

  if (!baseDate) return null;

  const date = new Date(baseDate);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getJourneyProfileType(
  averageHours: number,
  sessionsCount: number,
): JourneyProfileType {
  if (sessionsCount <= 0) return "empty";
  if (averageHours >= 8) return "intensive";
  if (averageHours >= 5) return "moderate";

  return "light";
}

function getJourneyProfileInfo(type: JourneyProfileType) {
  if (type === "intensive") {
    return {
      title: "Jornada intensiva",
      icon: "flame-outline" as const,
      color: "#F97316",
      backgroundColor: "#18171D",
      borderColor: "#2A2830",
      description:
        "Mantém uma rotina forte, com média diária de 8h ou mais.",
    };
  }

  if (type === "moderate") {
    return {
      title: "Jornada moderada",
      icon: "speedometer-outline" as const,
      color: "#FACC15",
      backgroundColor: "#18171D",
      borderColor: "#2A2830",
      description:
        "Mantém uma rotina equilibrada, com média diária entre 5h e 8h.",
    };
  }

  if (type === "light") {
    return {
      title: "Jornada leve",
      icon: "leaf-outline" as const,
      color: "#22C55E",
      backgroundColor: "#18171D",
      borderColor: "#2A2830",
      description:
        "Tem média diária abaixo de 5h nos dias analisados.",
    };
  }

  return {
    title: "Perfil de jornada",
    icon: "briefcase-outline" as const,
    color: "#9B969B",
    backgroundColor: "#18171D",
    borderColor: "#2A2830",
    description:
      "Este usuário ainda não possui jornadas finalizadas para análise.",
  };
}

function getDisplayCity(profile: PublicProfile) {
  if (profile.city && profile.region) {
    return `${profile.city} - ${profile.region}`;
  }

  if (profile.city) {
    return profile.city;
  }

  return "Cidade não informada";
}

export default function PublicProfileScreen() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats>({
    totalKm: 0,
    totalHours: 0,
    finishedSessions: 0,
    workedDays: 0,
    averageKmPerDay: 0,
    averageHoursPerDay: 0,
    journeyProfileAverageHours: 0,
    journeyProfileDays: 0,
    journeyProfileType: "empty",
  });
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadPublicProfile();
    }, [userId]),
  );

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`public-profile-work-sessions-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "work_sessions",
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          await loadProfileStats(userId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function loadPublicProfile() {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, name, full_name, username, city, region, avatar_url",
        )
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      setProfile(data as PublicProfile | null);

      await loadProfileStats(userId);
    } catch (error) {
      console.log("Erro ao carregar perfil público:", error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  function buildStatsFromSessions(sessions: any[]): ProfileStats {
    const totalKm = sessions.reduce((total: number, session: any) => {
      const startKm = Number(session.start_km ?? 0);
      const endKm = Number(session.end_km ?? 0);

      return total + Math.max(endKm - startKm, 0);
    }, 0);

    const totalHours = sessions.reduce((total: number, session: any) => {
      return total + calculateSessionHours(session);
    }, 0);

    const workedDaysSet = new Set<string>();

    sessions.forEach((session: any) => {
      const dayKey = getSessionDayKey(session);

      if (dayKey) {
        workedDaysSet.add(dayKey);
      }
    });

    const workedDays = workedDaysSet.size;
    const averageKmPerDay = workedDays > 0 ? totalKm / workedDays : 0;
    const averageHoursPerDay = workedDays > 0 ? totalHours / workedDays : 0;

    const today = startOfDay(new Date());
    const thirtyDaysAgo = startOfDay(new Date());
    thirtyDaysAgo.setDate(today.getDate() - 29);

    const sessionDates = sessions
      .map((session: any) => getSessionBaseDate(session))
      .filter(Boolean) as Date[];

    const firstSessionDate =
      sessionDates.length > 0
        ? sessionDates.reduce((oldestDate, currentDate) =>
            currentDate.getTime() < oldestDate.getTime()
              ? currentDate
              : oldestDate,
          )
        : null;

    const analysisStartDate = firstSessionDate
      ? startOfDay(
          firstSessionDate.getTime() > thirtyDaysAgo.getTime()
            ? firstSessionDate
            : thirtyDaysAgo,
        )
      : today;

    const journeyProfileDays = firstSessionDate
      ? getDaysBetween(analysisStartDate, today)
      : 0;

    const journeyProfileTotalHours = sessions.reduce(
      (total: number, session: any) => {
        const sessionDate = getSessionBaseDate(session);

        if (!sessionDate) return total;

        const normalizedSessionDate = startOfDay(sessionDate);

        if (
          normalizedSessionDate.getTime() < analysisStartDate.getTime() ||
          normalizedSessionDate.getTime() > today.getTime()
        ) {
          return total;
        }

        return total + calculateSessionHours(session);
      },
      0,
    );

    const journeyProfileAverageHours =
      journeyProfileDays > 0 ? journeyProfileTotalHours / journeyProfileDays : 0;

    const journeyProfileType = getJourneyProfileType(
      journeyProfileAverageHours,
      sessions.length,
    );

    return {
      totalKm,
      totalHours,
      finishedSessions: sessions.length,
      workedDays,
      averageKmPerDay,
      averageHoursPerDay,
      journeyProfileAverageHours,
      journeyProfileDays,
      journeyProfileType,
    };
  }

  async function loadProfileStatsDirectly(targetUserId: string) {
    const { data, error } = await supabase
      .from("work_sessions")
      .select(
        "id, start_km, end_km, started_at, finished_at, total_paused_seconds",
      )
      .eq("user_id", targetUserId)
      .eq("status", "finished");

    if (error) {
      console.log("Erro ao carregar estatísticas públicas direto:", error);
      return;
    }

    setStats(buildStatsFromSessions(data ?? []));
  }

  async function loadProfileStats(targetUserId: string) {
    /*
      Para perfil público, buscar work_sessions direto pelo app pode ser
      bloqueado pelo RLS quando o perfil  - de outro usuário.

      A função get_public_profile_journey_stats roda no banco e retorna
      somente estatísticas agregadas, respeitando show_public_stats e
      share_statistics do perfil.
    */
    const { data: rpcStats, error: rpcError } = await supabase
      .rpc("get_public_profile_journey_stats", {
        target_user_id: targetUserId,
      })
      .maybeSingle();

    if (!rpcError && rpcStats) {
      const totalKm = Number((rpcStats as any).total_km ?? 0);
      const totalHours = Number((rpcStats as any).total_hours ?? 0);
      const finishedSessions = Number((rpcStats as any).finished_sessions ?? 0);
      const workedDays = Number((rpcStats as any).worked_days ?? 0);
      const averageKmPerDay = Number((rpcStats as any).average_km_per_day ?? 0);
      const averageHoursPerDay = Number(
        (rpcStats as any).average_hours_per_day ?? 0,
      );
      const journeyProfileAverageHours = Number(
        (rpcStats as any).journey_profile_average_hours ?? 0,
      );
      const journeyProfileDays = Number(
        (rpcStats as any).journey_profile_days ?? 0,
      );

      setStats({
        totalKm,
        totalHours,
        finishedSessions,
        workedDays,
        averageKmPerDay,
        averageHoursPerDay,
        journeyProfileAverageHours,
        journeyProfileDays,
        journeyProfileType: getJourneyProfileType(
          journeyProfileAverageHours,
          finishedSessions,
        ),
      });

      return;
    }

    if (rpcError) {
      console.log(
        "Erro ao carregar estatísticas públicas via RPC. Usando fallback direto:",
        rpcError,
      );
    }

    await loadProfileStatsDirectly(targetUserId);
  }

  function handleSendMessage() {
    if (!profile?.id) return;

    router.push({
      pathname: "/conversa-privada/[userId]",
      params: {
        userId: profile.id,
      },
    } as never);
  }

  const avatarUrl = useMemo(() => {
    return profile?.avatar_url || null;
  }, [profile]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#D4A64A" />
        <Text style={styles.loadingText}>Carregando perfil público...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.notFoundIcon}>
          <Ionicons name="person-circle-outline" size={42} color="#8F8A91" />
        </View>
        <Text style={styles.notFoundTitle}>Perfil não encontrado</Text>
        <Text style={styles.notFoundText}>
          Não foi possível encontrar esse usuário.
        </Text>

        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.backToSearchButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={18} color="#080808" />
          <Text style={styles.backToSearchText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const journeyProfile = getJourneyProfileInfo(stats.journeyProfileType);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.headerIconButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>Perfil público</Text>
          <Text style={styles.headerTitle}>Motorista</Text>
        </View>
      </View>

      <View style={styles.profileHero}>
        <View style={styles.profileTop}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={42} color="#F5F0E6" />
            </View>
          )}

          <View style={styles.profileInfo}>
            <PublicProfileNameLine
              userId={profile.id}
              name={profile.full_name || profile.name || "Motorista"}
            />

            <View style={styles.cityRow}>
              <Ionicons name="location-outline" size={16} color="#D4A64A" />
              <Text style={styles.cityText} numberOfLines={1}>
                {getDisplayCity(profile)}
              </Text>
            </View>

            {!!profile.username && (
              <View style={styles.usernameBadge}>
                <Text style={styles.usernameText}>@{profile.username}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.profileActions}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.messageButton}
            onPress={handleSendMessage}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#080808" />
            <Text style={styles.messageButtonText}>Enviar mensagem</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={[
          styles.journeyProfileCard,
          {
            backgroundColor: journeyProfile.backgroundColor,
            borderColor: journeyProfile.borderColor,
            borderLeftColor: journeyProfile.color,
          },
        ]}
      >
        <View style={styles.journeyProfileTop}>
          <View
            style={[
              styles.journeyProfileIconBox,
              { backgroundColor: `${journeyProfile.color}20` },
            ]}
          >
            <Ionicons
              name={journeyProfile.icon}
              size={28}
              color={journeyProfile.color}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.journeyProfileEyebrow}>
              Perfil de jornada
            </Text>
            <Text
              style={[
                styles.journeyProfileTitle,
                { color: journeyProfile.color },
              ]}
            >
              {journeyProfile.title}
            </Text>
          </View>

          <View style={styles.journeyProfileAverageBox}>
            <Text style={styles.journeyProfileAverageValue}>
              {formatHours(stats.journeyProfileAverageHours)}h
            </Text>
            <Text style={styles.journeyProfileAverageLabel}>média/dia</Text>
          </View>
        </View>

        <Text style={styles.journeyProfileDescription}>
          {journeyProfile.description}
        </Text>

        <View style={styles.journeyProfileFooter}>
          <Ionicons name="calendar-outline" size={15} color="#9B969B" />
          <Text style={styles.journeyProfileFooterText}>
            Calculado com base em {stats.journeyProfileDays}{" "}
            {stats.journeyProfileDays === 1 ? "dia" : "dias"} de análise
            {stats.journeyProfileDays >= 30
              ? " dos últimos 30 dias."
              : " desde a primeira jornada registrada."}
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCardLarge}>
          <View style={styles.statHeaderRow}>
            <View style={styles.statIconGreen}>
              <Ionicons name="speedometer-outline" size={24} color="#D4A64A" />
            </View>
            <Text style={styles.statLabel}>KM rodados</Text>
          </View>

          <Text style={styles.statValue}>{formatNumber(stats.totalKm)} km</Text>
          <Text style={styles.statHint}>Total em jornadas finalizadas</Text>
        </View>

        <View style={styles.statCardLarge}>
          <View style={styles.statHeaderRow}>
            <View style={styles.statIconBlue}>
              <Ionicons name="time-outline" size={24} color="#D4A64A" />
            </View>
            <View>
              <Text style={styles.statLabel}>Horas</Text>
              <Text style={styles.statLabel}>trabalhadas</Text>
            </View>
          </View>

          <Text style={styles.statValue}>{formatHours(stats.totalHours)}h</Text>
          <Text style={styles.statHint}>Descontando pausas registradas</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCardLarge}>
          <View style={styles.statHeaderRow}>
            <View style={styles.statIconPurple}>
              <Ionicons name="analytics-outline" size={24} color="#D4A64A" />
            </View>
            <View>
              <Text style={styles.statLabel}>Média km</Text>
              <Text style={styles.statLabel}>rodados p/dia</Text>
            </View>
          </View>

          <Text style={styles.statValue}>
            {formatNumber(stats.averageKmPerDay)} km
          </Text>
          <Text style={styles.statHint}>
            Média baseada nos dias com jornada finalizada
          </Text>
        </View>

        <View style={styles.statCardLarge}>
          <View style={styles.statHeaderRow}>
            <View style={styles.statIconOrange}>
              <Ionicons name="calendar-outline" size={24} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.statLabel}>Média horas</Text>
              <Text style={styles.statLabel}>trabalhadas p/dia</Text>
            </View>
          </View>

          <Text style={styles.statValue}>
            {formatHours(stats.averageHoursPerDay)}h
          </Text>
          <Text style={styles.statHint}>
            Calculada sobre {stats.workedDays}{" "}
            {stats.workedDays === 1 ? "dia trabalhado" : "dias trabalhados"}
          </Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <Ionicons name="briefcase-outline" size={24} color="#F59E0B" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.summaryTitle}>Jornadas finalizadas</Text>
          <Text style={styles.summaryText}>
            {stats.finishedSessions}{" "}
            {stats.finishedSessions === 1
              ? "turno registrado"
              : "turnos registrados"}{" "}
            no histórico público.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 150,
    backgroundColor: "#050505",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#050505",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: "#9B969B",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 14,
  },
  notFoundIcon: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundTitle: {
    color: "#F5F0E6",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 14,
  },
  notFoundText: {
    color: "#9B969B",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 7,
  },
  backToSearchButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#D4A64A",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
  },
  backToSearchText: {
    color: "#080808",
    fontSize: 14,
    fontWeight: "900",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: -18,
    marginTop: -48,
    marginBottom: 16,
    paddingTop: 48,
    paddingBottom: 18,
    paddingHorizontal: 18,
    backgroundColor: "#070707",
    borderBottomWidth: 1,
    borderBottomColor: "#211D16",
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  headerEyebrow: {
    color: "#D4A64A",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: "#F5F0E6",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 3,
    letterSpacing: -0.6,
  },
  profileHero: {
    backgroundColor: "#101014",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 18,
    marginBottom: 16,
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 10,
  },
  profileTop: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 13,
    marginRight: 16,
    borderWidth: 2,
    borderColor: "#D4A64A",
  },
  avatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 13,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  profileInfo: { flex: 1 },
  cityRow: { flexDirection: "row", alignItems: "center", marginTop: 7, gap: 5 },
  cityText: {
    color: "#9B969B",
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  usernameBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(212,166,74,0.10)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginTop: 8,
  },
  usernameText: {
    color: "#D4A64A",
    fontSize: 11,
    fontWeight: "900",
  },
  profileActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  messageButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  messageButtonText: {
    color: "#080808",
    fontSize: 14,
    fontWeight: "900",
  },
  journeyProfileCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  journeyProfileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  journeyProfileIconBox: {
    width: 54,
    height: 54,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyProfileEyebrow: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  journeyProfileTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 3,
  },
  journeyProfileAverageBox: {
    minWidth: 82,
    borderRadius: 13,
    backgroundColor: "rgba(5,5,5,0.34)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  journeyProfileAverageValue: {
    color: "#F5F0E6",
    fontSize: 18,
    fontWeight: "900",
  },
  journeyProfileAverageLabel: {
    color: "#9B969B",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  journeyProfileDescription: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 12,
  },
  journeyProfileFooter: {
    minHeight: 36,
    borderRadius: 12,
    backgroundColor: "rgba(5,5,5,0.26)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  journeyProfileFooterText: {
    flex: 1,
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
  },
  statsGrid: { flexDirection: "row", gap: 12, marginBottom: 14 },
  statCardLarge: {
    flex: 1,
    minHeight: 112,
    backgroundColor: "#18171D",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 12,
  },
  statHeaderRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    minHeight: 42,
  },
  statIconGreen: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  statIconBlue: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  statIconPurple: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  statIconOrange: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: "rgba(245,158,11,0.12)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "900",
  },
  statValue: {
    color: "#F5F0E6",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
    alignSelf: "stretch",
  },
  statHint: {
    color: "#8F8A91",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
    lineHeight: 16,
  },
  summaryCard: {
    minHeight: 78,
    borderRadius: 16,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },
  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "rgba(245,158,11,0.14)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTitle: {
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "900",
  },
  summaryText: {
    color: "#E8C46D",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 17,
  },
});


