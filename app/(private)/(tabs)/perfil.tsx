import { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";

import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../../../src/database/supabase";
import { getProfile } from "../../../src/features/profile/services/getProfile";
import { PublicProfileNameLine } from "../../../src/features/profile/components/PublicProfileNameLine";

type ProfileStats = {
  totalKm: number;
  totalHours: number;
  finishedSessions: number;
  workedDays: number;
  averageKmPerDay: number;
  averageHoursPerDay: number;
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

export default function SocialProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<ProfileStats>({
    totalKm: 0,
    totalHours: 0,
    finishedSessions: 0,
    workedDays: 0,
    averageKmPerDay: 0,
    averageHoursPerDay: 0,
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

    setStats({
      totalKm,
      totalHours,
      finishedSessions: sessions.length,
      workedDays,
      averageKmPerDay,
      averageHoursPerDay,
    });
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
          <Ionicons name="person-circle-outline" size={38} color="#22C55E" />
        </View>
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </View>
    );
  }

  if (!profile) return null;

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
          <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
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
            <Ionicons name="create-outline" size={18} color="#06130B" />
            <Text style={styles.editButtonText}>Editar perfil</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.searchButton}
            onPress={() => router.push("/(private)/buscar-motoristas" as never)}
          >
            <Ionicons name="search-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCardLarge}>
          <View style={{flexDirection: 'row', gap: 5, alignItems: 'center'}}>
            <View style={styles.statIconGreen}>
              <Ionicons name="speedometer-outline" size={24} color="#22C55E" />
            </View>
            <Text style={styles.statLabel}>KM rodados</Text>
          </View>
          <Text style={styles.statValue}>{formatNumber(stats.totalKm)} km</Text>
          <Text style={styles.statHint}>Total em jornadas finalizadas</Text>
        </View>

        <View style={styles.statCardLarge}>
          <View style={{flexDirection: 'row', gap: 5, alignItems: 'center'}}>
            <View style={styles.statIconBlue}>
              <Ionicons name="time-outline" size={24} color="#60A5FA" />
            </View>
            <Text style={styles.statLabel}>Horas trabalhadas</Text>
          </View>
          <Text style={styles.statValue}>{formatHours(stats.totalHours)}h</Text>
          <Text style={styles.statHint}>Descontando pausas registradas</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCardLarge}>
          <View style={{flexDirection: 'row', gap: 5, alignItems: 'center'}}>
            <View style={styles.statIconPurple}>
              <Ionicons name="analytics-outline" size={24} color="#A78BFA" />
            </View>
            <Text style={styles.statLabel}>Média KM/dia</Text>
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
            <Text style={styles.statLabel}>Média horas/dia</Text>
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
          last
        />
      </View>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.findDriversCard}
        onPress={() => router.push("/(private)/buscar-motoristas" as never)}
      >
        <View style={styles.findDriversIcon}>
          <Ionicons name="people-outline" size={26} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.findDriversTitle}>Buscar motoristas</Text>
          <Text style={styles.findDriversText}>
            Encontre outros motoristas e entregadores pelo nome, username ou
            cidade.
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      style={[styles.menuItem, last && styles.menuItemLast]}
      onPress={onPress}
    >
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={21} color="#22C55E" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuDescription}>{description}</Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#71717A" />
    </TouchableOpacity>
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
  },
  loadingIcon: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#A1A1AA",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
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
  profileActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  editButton: {
    flex: 1,
    height: 48,
    borderRadius: 17,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  editButtonText: { color: "#06130B", fontSize: 14, fontWeight: "900" },
  searchButton: {
    width: 52,
    height: 48,
    borderRadius: 17,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
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
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  menuCard: {
    backgroundColor: "#111827",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#1F2937",
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  menuItem: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(34,197,94,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  menuDescription: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 17,
  },
  findDriversCard: {
    minHeight: 96,
    borderRadius: 26,
    backgroundColor: "#052E16",
    borderWidth: 1,
    borderColor: "#166534",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  findDriversIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: "rgba(34,197,94,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  findDriversTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  findDriversText: {
    color: "#BBF7D0",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 17,
  },
});
