import { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from "react-native";

import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../../../src/database/supabase";
import { getProfile } from "../../../src/features/profile/services/getProfile";
import { PublicProfileNameLine } from "../../../src/features/profile/components/PublicProfileNameLine";

type JourneyProfileType = "intensive" | "moderate" | "light" | "empty";

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
        "Você mantém uma rotina forte, com média diária de 8h ou mais.",
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
        "Sua rotina está em equilíbrio, com média diária entre 5h e 8h.",
    };
  }

  if (type === "light") {
    return {
      title: "Jornada leve",
      icon: "leaf-outline" as const,
      color: "#D4A64A",
      backgroundColor: "rgba(212,166,74,0.12)",
      borderColor: "rgba(212,166,74,0.28)",
      description:
        "Sua média diária está abaixo de 5h nos dias analisados.",
    };
  }

  return {
    title: "Perfil de jornada",
    icon: "briefcase-outline" as const,
    color: "#9B969B",
    backgroundColor: "rgba(161,161,170,0.10)",
    borderColor: "rgba(161,161,170,0.22)",
    description:
      "Finalize sua primeira jornada para calcular seu perfil de trabalho.",
  };
}

export default function SocialProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
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
      loadProfile();
    }, []),
  );

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`profile-work-sessions-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "work_sessions",
          filter: `user_id=eq.${profile.id}`,
        },
        async () => {
          await loadProfileStats(profile.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  async function loadProfile() {
    try {
      setLoading(true);

      const response = await getProfile();

      setProfile(response);

      if (response?.id) {
        await loadProfileStats(response.id);
      }
    } catch (error) {
      console.log("Erro ao carregar perfil:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadProfileStats(userId: string) {
    const { data, error } = await supabase
      .from("work_sessions")
      .select(
        "id, start_km, end_km, started_at, finished_at, total_paused_seconds",
      )
      .eq("user_id", userId)
      .eq("status", "finished");

    if (error) {
      console.log("Erro ao carregar estatísticas do perfil:", error);
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

  function handleSignOut() {
    Alert.alert(
      "Sair do aplicativo",
      "Deseja realmente sair da sua conta?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.auth.signOut();

              if (error) throw error;

              router.replace("/login" as never);
            } catch (error) {
              console.log("Erro ao sair do aplicativo:", error);
              Alert.alert(
                "Erro",
                "Não foi possível sair do aplicativo. Tente novamente.",
              );
            }
          },
        },
      ],
    );
  }

  const avatarUrl = useMemo(() => {
    return (
      profile?.avatar_url ||
      profile?.photo_url ||
      profile?.picture ||
      profile?.user_metadata?.avatar_url ||
      profile?.user_metadata?.picture ||
      null
    );
  }, [profile]);

  if (loading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons name="person-circle-outline" size={38} color="#D4A64A" />
        </View>
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </View>
    );
  }

  if (!profile) return null;

  const journeyProfile = getJourneyProfileInfo(stats.journeyProfileType);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>Minha conta</Text>
          <Text style={styles.headerTitle}>Perfil</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.headerIconButton}
          onPress={() =>
            router.push("/(private)/perfil/configuracoes" as never)
          }
        >
          <Ionicons name="settings-outline" size={22} color="#F5F0E6" />
        </TouchableOpacity>
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
                {profile.city || "Cidade não informada"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.profileActions}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.editButton}
            onPress={() =>
              router.push("/(private)/perfil/minha-conta" as never)
            }
          >
            <Ionicons name="create-outline" size={18} color="#080808" />
            <Text style={styles.editButtonText}>Editar perfil</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.searchButton}
            onPress={() => router.push("/(private)/buscar-motoristas" as never)}
          >
            <Ionicons name="search-outline" size={20} color="#F5F0E6" />
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
          <View style={{flexDirection: 'row', gap: 5, alignItems: 'center'}}>
            <View style={styles.statIconGreen}>
              <Ionicons name="speedometer-outline" size={24} color="#D4A64A" />
            </View>
            <Text style={styles.statLabel}>KM rodados</Text>
          </View>
          <Text style={styles.statValue}>{formatNumber(stats.totalKm)} km</Text>
          <Text style={styles.statHint}>Total em jornadas finalizadas</Text>
        </View>

        <View style={styles.statCardLarge}>
          <View style={{flexDirection: 'row', gap: 5, alignItems: 'center'}}>
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
          <View style={{flexDirection: 'row', gap: 5, alignItems: 'center'}}>
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
          <View style={{flexDirection: 'row', gap: 5, alignItems: 'center'}}>
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
            Calculada sobre {stats.workedDays} {stats.workedDays === 1 ? "dia trabalhado" : "dias trabalhados"}
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
            no seu histórico.
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Conta e preferências</Text>

      <View style={styles.menuCard}>
        <ProfileMenuItem
          icon="person-outline"
          title="Informações pessoais"
          description="Nome, cidade, foto, e-mail e senha"
          onPress={() => router.push("/(private)/perfil/minha-conta" as never)}
        />

        <ProfileMenuItem
          icon="card-outline"
          title="Assinaturas"
          description="Plano atual, pagamentos e cobrança"
          onPress={() =>
            router.push(
              "/(private)/perfil/configuracoes?aba=assinaturas" as never,
            )
          }
        />

        <ProfileMenuItem
          icon="lock-closed-outline"
          title="Privacidade"
          description="Controle quem pode ver e falar com você"
          onPress={() =>
            router.push(
              "/(private)/perfil/configuracoes?aba=privacidade" as never,
            )
          }
        />

        <ProfileMenuItem
          icon="help-circle-outline"
          title="Central de ajuda"
          description="Suporte, erros, sugestões e documentos"
          onPress={() =>
            router.push("/(private)/perfil/configuracoes?aba=ajuda" as never)
          }
        />

        <ProfileMenuItem
          icon="information-circle-outline"
          title="Sobre o MovenApp"
          description="Versão, redes sociais e informações do aplicativo"
          onPress={() =>
            router.push("/(private)/perfil/configuracoes?aba=sobre" as never)
          }
        />

        <ProfileMenuItem
          icon="log-out-outline"
          title="Sair do aplicativo"
          description="Encerrar sua sessão neste aparelho"
          onPress={handleSignOut}
          danger
          last
        />
      </View>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.findDriversCard}
        onPress={() => router.push("/(private)/buscar-motoristas" as never)}
      >
        <View style={styles.findDriversIcon}>
          <Ionicons name="people-outline" size={26} color="#F5F0E6" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.findDriversTitle}>Buscar motoristas</Text>
          <Text style={styles.findDriversText}>
            Encontre outros motoristas e entregadores pelo nome, username ou
            cidade.
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={22} color="#F5F0E6" />
      </TouchableOpacity>
    </ScrollView>
  );
}

function ProfileMenuItem({
  icon,
  title,
  description,
  onPress,
  last,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  last?: boolean;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      style={[styles.menuItem, last && styles.menuItemLast]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Ionicons
          name={icon}
          size={21}
          color={danger ? "#FCA5A5" : "#D4A64A"}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>
          {title}
        </Text>
        <Text
          style={[
            styles.menuDescription,
            danger && styles.menuDescriptionDanger,
          ]}
        >
          {description}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color={danger ? "#FCA5A5" : "#8F8A91"}
      />
    </TouchableOpacity>
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
  },
  loadingIcon: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#9B969B",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  headerEyebrow: {
    color: "#D4A64A",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.7,
  },
  headerTitle: {
    color: "#F5F0E6",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 3,
    letterSpacing: -0.6,
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
  profileActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  journeyProfileCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    backgroundColor: "#18171D",
    borderColor: "#2A2830",
    borderLeftWidth: 4,
    borderLeftColor: "#D4A64A",
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
  editButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  editButtonText: {
    color: "#080808",
    fontSize: 14,
    fontWeight: "900",
  },
  searchButton: {
    width: 52,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
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
  sectionTitle: {
    color: "#F5F0E6",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  menuCard: {
    backgroundColor: "#101014",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  menuItem: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2830",
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: "rgba(212,166,74,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconDanger: {
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  menuTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  menuTitleDanger: {
    color: "#FCA5A5",
  },
  menuDescription: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 17,
  },
  menuDescriptionDanger: {
    color: "#FECACA",
  },
  findDriversCard: {
    minHeight: 96,
    borderRadius: 18,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    borderLeftWidth: 4,
    borderLeftColor: "#D4A64A",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  findDriversIcon: {
    width: 50,
    height: 50,
    borderRadius: 13,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  findDriversTitle: {
    color: "#F5F0E6",
    fontSize: 16,
    fontWeight: "900",
  },
  findDriversText: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 17,
  },
});
