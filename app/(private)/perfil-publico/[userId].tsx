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
      backgroundColor: "rgba(249,115,22,0.13)",
      borderColor: "rgba(249,115,22,0.32)",
      description:
        "Mantém uma rotina forte, com média diária de 8h ou mais.",
    };
  }

  if (type === "moderate") {
    return {
      title: "Jornada moderada",
      icon: "speedometer-outline" as const,
      color: "#FACC15",
      backgroundColor: "rgba(250,204,21,0.12)",
      borderColor: "rgba(250,204,21,0.28)",
      description:
        "Mantém uma rotina equilibrada, com média diária entre 5h e 8h.",
    };
  }

  if (type === "light") {
    return {
      title: "Jornada leve",
      icon: "leaf-outline" as const,
      color: "#22C55E",
      backgroundColor: "rgba(34,197,94,0.12)",
      borderColor: "rgba(34,197,94,0.28)",
      description:
        "Tem média diária abaixo de 5h nos dias analisados.",
    };
  }

  return {
    title: "Perfil de jornada",
    icon: "briefcase-outline" as const,
    color: "#A1A1AA",
    backgroundColor: "rgba(161,161,170,0.10)",
    borderColor: "rgba(161,161,170,0.22)",
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
          "id, name, full_name, username, city, avatar_url",
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

  async function loadProfileStats(targetUserId: string) {
    const { data, error } = await supabase
      .from("work_sessions")
      .select(
        "id, start_km, end_km, started_at, finished_at, total_paused_seconds",
      )
      .eq("user_id", targetUserId)
      .eq("status", "finished");

    if (error) {
      console.log("Erro ao carregar estatísticas públicas:", error);
      return;
    }

    const sessions = data ?? [];

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
    const oneHundredDaysAgo = startOfDay(new Date());
    oneHundredDaysAgo.setDate(today.getDate() - 99);

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
          firstSessionDate.getTime() > oneHundredDaysAgo.getTime()
            ? firstSessionDate
            : oneHundredDaysAgo,
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

    setStats({
      totalKm,
      totalHours,
      finishedSessions: sessions.length,
      workedDays,
      averageKmPerDay,
      averageHoursPerDay,
      journeyProfileAverageHours,
      journeyProfileDays,
      journeyProfileType,
    });
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
        <ActivityIndicator color="#22C55E" />
        <Text style={styles.loadingText}>Carregando perfil público...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.notFoundIcon}>
          <Ionicons name="person-circle-outline" size={42} color="#71717A" />
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
          <Ionicons name="chevron-back" size={18} color="#06130B" />
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
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
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
              <Ionicons name="person" size={42} color="#FFFFFF" />
            </View>
          )}

          <View style={styles.profileInfo}>
            <PublicProfileNameLine
              userId={profile.id}
              name={profile.full_name || profile.name || "Motorista"}
            />

            <View style={styles.cityRow}>
              <Ionicons name="location-outline" size={16} color="#22C55E" />
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
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#06130B" />
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
          <Ionicons name="calendar-outline" size={15} color="#A1A1AA" />
          <Text style={styles.journeyProfileFooterText}>
            Calculado com base em {stats.journeyProfileDays}{" "}
            {stats.journeyProfileDays === 1 ? "dia" : "dias"} de análise
            {stats.journeyProfileDays >= 100
              ? " dos últimos 100 dias."
              : " desde a primeira jornada registrada."}
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCardLarge}>
          <View style={styles.statHeaderRow}>
            <View style={styles.statIconGreen}>
              <Ionicons name="speedometer-outline" size={24} color="#22C55E" />
            </View>
            <Text style={styles.statLabel}>KM rodados</Text>
          </View>

          <Text style={styles.statValue}>{formatNumber(stats.totalKm)} km</Text>
          <Text style={styles.statHint}>Total em jornadas finalizadas</Text>
        </View>

        <View style={styles.statCardLarge}>
          <View style={styles.statHeaderRow}>
            <View style={styles.statIconBlue}>
              <Ionicons name="time-outline" size={24} color="#60A5FA" />
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
              <Ionicons name="analytics-outline" size={24} color="#A78BFA" />
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
  container: { flex: 1, backgroundColor: "#09090B" },
  content: { paddingHorizontal: 18, paddingTop: 54, paddingBottom: 140 },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#09090B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: "#A1A1AA",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 14,
  },
  notFoundIcon: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 14,
  },
  notFoundText: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 7,
  },
  backToSearchButton: {
    height: 46,
    borderRadius: 16,
    backgroundColor: "#22C55E",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
  },
  backToSearchText: {
    color: "#06130B",
    fontSize: 14,
    fontWeight: "900",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  headerEyebrow: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
  },
  profileHero: {
    backgroundColor: "#111827",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 18,
    marginBottom: 16,
  },
  profileTop: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 999,
    marginRight: 16,
    borderWidth: 3,
    borderColor: "#22C55E",
  },
  avatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 999,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  profileInfo: { flex: 1 },
  cityRow: { flexDirection: "row", alignItems: "center", marginTop: 7, gap: 5 },
  cityText: { color: "#A1A1AA", fontSize: 14, fontWeight: "700", flex: 1 },
  usernameBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.10)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.24)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginTop: 8,
  },
  usernameText: {
    color: "#22C55E",
    fontSize: 11,
    fontWeight: "900",
  },
  profileActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  messageButton: {
    flex: 1,
    height: 48,
    borderRadius: 17,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  messageButtonText: { color: "#06130B", fontSize: 14, fontWeight: "900" },
  journeyProfileCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  journeyProfileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  journeyProfileIconBox: {
    width: 54,
    height: 54,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyProfileEyebrow: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  journeyProfileTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 3,
  },
  journeyProfileAverageBox: {
    minWidth: 82,
    borderRadius: 18,
    backgroundColor: "rgba(9,9,11,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  journeyProfileAverageValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  journeyProfileAverageLabel: {
    color: "#A1A1AA",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  journeyProfileDescription: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 12,
  },
  journeyProfileFooter: {
    minHeight: 36,
    borderRadius: 14,
    backgroundColor: "rgba(9,9,11,0.32)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  journeyProfileFooterText: {
    flex: 1,
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
  },
  statsGrid: { flexDirection: "row", gap: 12, marginBottom: 14 },
  statCardLarge: {
    flex: 1,
    minHeight: 102,
    backgroundColor: "#18181B",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#27272A",
    padding: 10,
  },
  statHeaderRow: { flexDirection: "row", gap: 5, alignItems: "center" },
  statIconGreen: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(34,197,94,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  statIconBlue: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(96,165,250,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  statIconPurple: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(167,139,250,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  statIconOrange: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(245,158,11,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: { color: "#A1A1AA", fontSize: 12, fontWeight: "900" },
  statValue: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 8,
  },
  statHint: {
    color: "#71717A",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
    lineHeight: 16,
  },
  summaryCard: {
    minHeight: 78,
    borderRadius: 24,
    backgroundColor: "#1A1305",
    borderWidth: 1,
    borderColor: "#713F12",
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },
  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(245,158,11,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  summaryText: {
    color: "#FCD34D",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 17,
  },
});
