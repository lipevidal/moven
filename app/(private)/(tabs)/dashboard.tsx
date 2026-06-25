import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Calendar } from "react-native-calendars";
import { PieChart } from "react-native-gifted-charts";
import { NotificationBell } from "../../../src/features/notifications/components/NotificationBell";
import { DashboardChallengeCard } from "../../../src/features/challenges/components/DashboardChallengeCard";
import { GoalCard } from "../../../src/features/goals/components/GoalCard";
import { DashboardGoalCard } from "../../../src/features/goals/components/DashboardGoalCard";
import { AchievementProgressCards } from "../../../src/features/achievements/components/AchievementProgressCards";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../src/database/supabase";

import {
  getDashboardData,
  DashboardPeriod,
} from "../../../src/features/dashboard/services/getDashboardData";
import { getDayWorkSessions } from "../../../src/features/dashboard/services/getDayWorkSessions";
import { getGoalForPeriod } from "../../../src/features/goals/services/getGoalForPeriod";
import { getGoalPeriodFromDashboard } from "../../../src/features/goals/utils/goalPeriodUtils";

import { LocaleConfig } from "react-native-calendars";

LocaleConfig.locales["pt-br"] = {
  monthNames: [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ],

  monthNamesShort: [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ],

  dayNames: [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ],

  dayNamesShort: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],

  today: "Hoje",
};

LocaleConfig.defaultLocale = "pt-br";

const periodOptions: { label: string; value: DashboardPeriod }[] = [
  { label: "Dia", value: "day" },
  { label: "Semana", value: "week" },
  { label: "Mês", value: "month" },
  { label: "Ano", value: "year" },
];

const months = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const shortMonths = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Maio",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatCurrency(value: number) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumber(value: number) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  });
}

function formatGoalCurrency(value: number) {
  return `R$ ${Number(value ?? 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  })}`;
}

function formatDecimal(value: number) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function getWeekRange(baseDate: Date) {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const start = new Date(date);
  start.setDate(date.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatWeekLabel(date: Date) {
  const { start, end } = getWeekRange(date);

  return `${weekDays[start.getDay()]}, ${start.getDate()} ${
    shortMonths[start.getMonth()]
  } - ${weekDays[end.getDay()]}, ${end.getDate()} ${
    shortMonths[end.getMonth()]
  }`;
}

function formatPeriodLabel(
  startDate: Date,
  endDate: Date,
  period: DashboardPeriod,
) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (period === "day") {
    return `${weekDays[start.getDay()]}, ${start.getDate()} ${
      months[start.getMonth()]
    } ${start.getFullYear()}`;
  }

  if (period === "week") {
    return `${weekDays[start.getDay()]}, ${start.getDate()} ${
      shortMonths[start.getMonth()]
    } - ${weekDays[end.getDay()]}, ${end.getDate()} ${
      shortMonths[end.getMonth()]
    }`;
  }

  if (period === "month") {
    return `${months[start.getMonth()]} de ${start.getFullYear()}`;
  }

  return String(start.getFullYear());
}

function toCalendarDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function isSameWeek(a: Date, b: Date) {
  const weekA = getWeekRange(a);
  const weekB = getWeekRange(b);

  return isSameDay(weekA.start, weekB.start);
}

function isSameMonth(a: Date, b: Date) {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function isSameYear(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear();
}

function generateWeeks(referenceDate: Date) {
  return Array.from({ length: 16 }).map((_, index) => {
    const date = new Date(referenceDate);
    date.setDate(referenceDate.getDate() - index * 7);

    return date;
  });
}

function generateMonths(referenceDate: Date) {
  return Array.from({ length: 18 }).map((_, index) => {
    const date = new Date(referenceDate);
    date.setDate(1);
    date.setMonth(referenceDate.getMonth() - index);

    return date;
  });
}

function generateYears(referenceDate: Date) {
  const currentYear = referenceDate.getFullYear();

  return Array.from({ length: 8 }).map((_, index) => currentYear - index);
}

function formatDayMonth(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  return `${day} ${shortMonths[date.getMonth()]}`;
}

function getMonthWeeks(referenceDate: Date) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const firstWeek = getWeekRange(monthStart);
  const weeks = [];
  let cursor = new Date(firstWeek.start);
  let index = 1;

  while (cursor <= monthEnd) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const visibleStart = weekStart < monthStart ? monthStart : weekStart;
    const visibleEnd = weekEnd > monthEnd ? monthEnd : weekEnd;

    weeks.push({
      index,
      start: weekStart,
      end: weekEnd,
      visibleStart,
      visibleEnd,
      label: `${formatDayMonth(weekStart)}\n${formatDayMonth(weekEnd)}`,
    });

    cursor.setDate(cursor.getDate() + 7);
    index += 1;
  }

  return weeks;
}

function getDayFromBarItem(item: any) {
  if (item?.date) {
    const parsedDate = new Date(item.date);

    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.getDate();
    }
  }

  if (item?.day) {
    return Number(item.day);
  }

  const label = String(item?.label ?? '');
  const match = label.match(/^(\d{1,2})(?:\D|$)/);

  if (!match) return null;

  return Number(match[1]);
}

function buildMonthWeeksBarChartData(items: any[], referenceDate: Date) {
  const weeks = getMonthWeeks(referenceDate);
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  return weeks.map((week) => {
    const value = items.reduce((total, item) => {
      const day = getDayFromBarItem(item);

      if (!day) return total;

      const itemDate = new Date(year, month, day, 12, 0, 0, 0);

      if (itemDate >= week.start && itemDate <= week.end) {
        return total + Number(item.value ?? 0);
      }

      return total;
    }, 0);

    return {
      label: week.label,
      value,
    };
  });
}

export default function DashboardScreen() {
  const [period, setPeriod] = useState<DashboardPeriod>("week");
  const [periodTab, setPeriodTab] = useState<DashboardPeriod>("week");
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [data, setData] = useState<any>(null);
  const [daySessions, setDaySessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [sessionDetailsModalVisible, setSessionDetailsModalVisible] =
    useState(false);
  const [user, setUser] = useState<any>(null);
  const [periodModalVisible, setPeriodModalVisible] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [currentGoal, setCurrentGoal] = useState<any>(null);
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");

  useEffect(() => {
    loadDashboard();
  }, [period, referenceDate]);

  useEffect(() => {
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
    let componentMounted = true;

    async function subscribeToGoalChanges() {
      const {
        data: { user: loggedUser },
      } = await supabase.auth.getUser();

      if (!loggedUser?.id || !componentMounted) return;

      // Atualiza a meta automaticamente quando ela for criada, alterada ou excluída.
      // Assim o usuário não precisa mudar o dia e voltar para ver a meta atualizada.
      realtimeChannel = supabase
        .channel(`dashboard-user-goals-${loggedUser.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_goals",
            filter: `user_id=eq.${loggedUser.id}`,
          },
          async () => {
            await refreshDashboardGoal();
          },
        )
        .subscribe();
    }

    subscribeToGoalChanges();

    return () => {
      componentMounted = false;

      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [period, referenceDate]);

  useEffect(() => {
    if (!goalModalVisible) return;

    // Fallback para ambientes onde o Realtime do Supabase não estiver habilitado.
    // Enquanto o modal estiver aberto, a meta é recarregada rapidamente após salvar, editar ou excluir.
    refreshDashboardGoal();

    const interval = setInterval(() => {
      refreshDashboardGoal();
    }, 900);

    return () => clearInterval(interval);
  }, [goalModalVisible, period, referenceDate]);

  async function refreshDashboardGoal() {
    try {
      const goalPeriod = getGoalPeriodFromDashboard(period, referenceDate);
      const goalResponse = await getGoalForPeriod(
        goalPeriod.periodType,
        goalPeriod.periodKey,
      );

      setCurrentGoal(goalResponse);
    } catch (error) {
      console.log(error);
    }
  }

  async function loadDashboard() {
    try {
      const response = await getDashboardData(period, referenceDate);

      setData(response);
      setUser(response?.user ?? null);

      if (period === "day") {
        const sessions = await getDayWorkSessions(referenceDate);
        setDaySessions(sessions);
      } else {
        setDaySessions([]);
      }

      await refreshDashboardGoal();
    } catch (error) {
      console.log(error);
    }
  }

  async function closeGoalModal() {
    setGoalModalVisible(false);

    // Garante que a tela principal fique sincronizada mesmo se o usuário fechar o modal logo após salvar.
    await refreshDashboardGoal();
  }

  function openPeriodModal() {
    setPeriodTab(period);
    setPeriodModalVisible(true);
  }

  function selectPeriod(type: DashboardPeriod, date: Date) {
    setPeriod(type);
    setReferenceDate(date);
    setPeriodModalVisible(false);
  }

  function goToCurrentPeriod() {
    selectPeriod(periodTab, new Date());
  }

  function shouldShowCurrentButton() {
    const today = new Date();

    if (periodTab === "day") return !isSameDay(referenceDate, today);
    if (periodTab === "week") return !isSameWeek(referenceDate, today);
    if (periodTab === "month") return !isSameMonth(referenceDate, today);
    if (periodTab === "year") return !isSameYear(referenceDate, today);

    return false;
  }

  function currentButtonLabel() {
    if (periodTab === "day") return "Mostrar hoje";
    if (periodTab === "week") return "Mostrar semana atual";
    if (periodTab === "month") return "Mostrar mês atual";
    return "Mostrar ano atual";
  }

  function changePeriod(direction: "prev" | "next") {
    const date = new Date(referenceDate);

    if (period === "day") {
      date.setDate(date.getDate() + (direction === "next" ? 1 : -1));
    }

    if (period === "week") {
      date.setDate(date.getDate() + (direction === "next" ? 7 : -7));
    }

    if (period === "month") {
      date.setMonth(date.getMonth() + (direction === "next" ? 1 : -1));
    }

    if (period === "year") {
      date.setFullYear(date.getFullYear() + (direction === "next" ? 1 : -1));
    }

    setReferenceDate(date);
  }

  const periodLabel = useMemo(() => {
    if (!data?.startDate || !data?.endDate) return "";

    return formatPeriodLabel(data.startDate, data.endDate, period);
  }, [data, period]);

  if (!data) {
    return null;
  }

  const profitVariationPositive = Number(data.revenueVariation ?? 0) >= 0;

  const expensesPercent =
    data.revenue > 0
      ? Math.round((Number(data.expenses) / Number(data.revenue)) * 100)
      : 0;

  const profitPercent =
    data.revenue > 0
      ? Math.round((Number(data.profit) / Number(data.revenue)) * 100)
      : 0;

  const avatarUrl =
    user?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture;

  function formatHours(value: number) {
    const totalMinutes = Math.round((value ?? 0) * 60);

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function formatSessionHour(value?: string | null) {
    if (!value) return "--:--";

    return new Date(value).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function openSessionDetails(session: any) {
    setSelectedSession(session);
    setSessionDetailsModalVisible(true);
  }

  const isLightMode = themeMode === "light";

  const theme = {
    background: isLightMode ? "#F8FAFC" : "#09090B",
    card: isLightMode ? "#FFFFFF" : "#18181B",
    cardStrong: isLightMode ? "#F1F5F9" : "#111827",
    border: isLightMode ? "#E2E8F0" : "#27272A",
    text: isLightMode ? "#0F172A" : "#FFFFFF",
    muted: isLightMode ? "#64748B" : "#A1A1AA",
  };

  const goalPeriodInfo = getGoalPeriodFromDashboard(period, referenceDate);
  const goalTargetAmount = Number(currentGoal?.target_amount ?? 0);
  const goalCurrentAmount = Number(data.revenue ?? 0);
  const goalStarted = new Date() >= new Date(goalPeriodInfo.periodStart);
  const goalExpired = new Date() > new Date(goalPeriodInfo.periodEnd);
  const goalAchieved = Boolean(currentGoal) && goalCurrentAmount >= goalTargetAmount;

  function getGoalFloatingContent() {
    if (!currentGoal?.target_amount) {
      if (goalExpired) {
        return {
          title: "",
          subtitle: "",
          icon: "add-circle-outline" as const,
          variant: "hidden",
        };
      }

      return {
        title: "Meta",
        subtitle: "Definir meta",
        icon: "add-circle-outline" as const,
        variant: "empty",
      };
    }

    if (goalAchieved) {
      return {
        title: "Meta batida",
        subtitle: `R$ ${formatCurrency(goalCurrentAmount)}`,
        icon: "checkmark-circle-outline" as const,
        variant: "success",
      };
    }

    if (goalExpired) {
      return {
        title: "Meta não atingida",
        subtitle: `${formatGoalCurrency(goalCurrentAmount)} / ${formatGoalCurrency(goalTargetAmount)}`,
        icon: "close-circle-outline" as const,
        variant: "danger",
      };
    }

    if (!goalStarted) {
      return {
        title: "Meta",
        subtitle: `R$ ${formatCurrency(goalTargetAmount)}`,
        icon: "flag-outline" as const,
        variant: "future",
      };
    }

    return {
      title: "Meta",
      subtitle: `${formatGoalCurrency(goalCurrentAmount)} / ${formatGoalCurrency(goalTargetAmount)}`,
      icon: "flag-outline" as const,
      variant: "active",
    };
  }

  const goalFloating = getGoalFloatingContent();
  const goalProgressPercent =
    goalTargetAmount > 0
      ? Math.min((goalCurrentAmount / goalTargetAmount) * 100, 100)
      : 0;

  function getGoalStatusLabel() {
    if (goalFloating.variant === "active") return "Em andamento";
    if (goalFloating.variant === "success") return "Concluída";
    if (goalFloating.variant === "danger") return "Não batida";

    return "";
  }

  const goalStatusLabel = getGoalStatusLabel();

  function getGoalPeriodLabel() {
    if (period === "day") return "Meta do dia";
    if (period === "week") return "Meta da semana";
    if (period === "month") return "Meta do mês";
    return "Meta do ano";
  }

  const goalPeriodLabel = getGoalPeriodLabel();

  const colors = [
    "#22C55E",
    "#3B82F6",
    "#F59E0B",
    "#8B5CF6",
    "#EF4444",
    "#14B8A6",
    "#EC4899",
  ];

  const pieData = Object.entries(data.platformTotals ?? {})
    .filter(([_, value]) => Number(value) > 0)
    .map(([platform, value]: any, index) => ({
      value: Number(value),
      text: `${((Number(value) / Number(data.revenue)) * 100).toFixed(0)}%`,
      color: colors[index % colors.length],
      label: platform,
    }));

  const rawBarChartData = data?.barChartData ?? [];
  const barChartData =
    period === "month"
      ? buildMonthWeeksBarChartData(rawBarChartData, referenceDate)
      : rawBarChartData;

  const maxBarValue = Math.max(
    ...barChartData.map((item: any) => item.value),
    1,
  );

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.modernContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.modernHeader}>
          <View style={styles.modernUserRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/(private)/(tabs)/perfil" as never)}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.modernAvatar}
                />
              ) : (
                <View style={styles.modernAvatarFallback}>
                  <Ionicons name="person" size={24} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            <View>
              <Text style={[styles.modernGreeting, { color: theme.muted }]}>
                Bom trabalho,
              </Text>
              <Text style={[styles.modernTitle, { color: theme.text }]}>
                Olá, {user?.user_metadata?.name?.split(" ")[0] ?? "Motorista"}{" "}
                👋
              </Text>
            </View>
          </View>

          <View style={styles.modernHeaderActions}>
            <NotificationBell />

            <TouchableOpacity
              style={[
                styles.modernHeaderIconButton,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => router.push("/(private)/rankings/xp" as never)}
            >
              <Ionicons name="trophy-outline" size={21} color="#FACC15" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modernHeaderIconButton,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => router.push("/(private)/conversas")}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={22}
                color={theme.text}
              />
            </TouchableOpacity>

            {/*<TouchableOpacity
              style={[
                styles.modernHeaderIconButton,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() =>
                setThemeMode((current) =>
                  current === "dark" ? "light" : "dark",
                )
              }
            >
              <Ionicons
                name={themeMode === "dark" ? "sunny-outline" : "moon-outline"}
                size={21}
                color={themeMode === "dark" ? "#FACC15" : "#0F172A"}
              />
            </TouchableOpacity>*/}
          </View>
        </View>

        <View
          style={[
            styles.modernPeriodTabs,
            { backgroundColor: theme.cardStrong, borderColor: theme.border },
          ]}
        >
          {periodOptions.map((item) => (
            <TouchableOpacity
              key={item.value}
              activeOpacity={0.85}
              style={[
                styles.modernPeriodTab,
                period === item.value && styles.modernPeriodTabActive,
              ]}
              onPress={() => {
                setPeriod(item.value);
                setPeriodTab(item.value);
              }}
            >
              <Text
                style={[
                  styles.modernPeriodTabText,
                  period === item.value && styles.modernPeriodTabTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View
          style={[
            styles.modernPeriodSelector,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <TouchableOpacity
            style={styles.modernPeriodArrow}
            onPress={() => changePeriod("prev")}
          >
            <Ionicons name="chevron-back" size={24} color="#22C55E" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modernPeriodCenter}
            activeOpacity={0.85}
            onPress={openPeriodModal}
          >
            <Text style={[styles.modernPeriodTitle, { color: theme.text }]}>
              {periodLabel}
            </Text>
            <Text style={[styles.modernPeriodSubtitle, { color: theme.muted }]}>
              Toque para selecionar outro período
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modernPeriodArrow}
            onPress={() => changePeriod("next")}
          >
            <Ionicons name="chevron-forward" size={24} color="#22C55E" />
          </TouchableOpacity>
        </View>

        <View style={styles.modernHeroCard}>
          <View style={{paddingTop: 10, paddingLeft: 10, paddingRight: 10}}>
            <View style={styles.modernHeroTopRow}>
              <View style={styles.modernHeroBadge}>
                <Ionicons name="trending-up-outline" size={16} color="#BBF7D0" />
                <Text style={styles.modernHeroBadgeText}>Lucro líquido</Text>
              </View>

              <View
                style={[
                  styles.modernVariationPill,
                  profitVariationPositive
                    ? styles.modernVariationPositive
                    : styles.modernVariationNegative,
                ]}
              >
                <Ionicons
                  name={profitVariationPositive ? "arrow-up" : "arrow-down"}
                  size={13}
                  color="#FFFFFF"
                />
                <Text style={styles.modernVariationText}>
                  {formatDecimal(Math.abs(Number(data.revenueVariation ?? 0)))}%
                </Text>
              </View>
            </View>

            <Text style={styles.modernHeroValue}>
              R$ {formatCurrency(data.profit)}
            </Text>
            <Text style={styles.modernHeroSub}>
              {formatDecimal(profitPercent)}% do faturamento virou lucro
            </Text>
          </View>

          <View style={styles.modernHeroMiniGrid}>
            <View style={styles.modernHeroMiniCard}>
              <View style={{flexDirection: 'row', gap: 5}}>
                <View style={styles.modernMiniIconBlue}>
                  <Ionicons name="cash-outline" size={18} color="#93C5FD" />
                </View>
                <Text style={styles.modernHeroMiniLabel}>Faturamento</Text>
              </View>
              <Text style={styles.modernHeroMiniValue}>
                R$ {formatCurrency(data.revenue)}
              </Text>
            </View>

            <View style={styles.modernHeroMiniCard}>
              <View style={{flexDirection: 'row', gap: 5}}>
                <View style={styles.modernMiniIconRed}>
                  <Ionicons name="wallet-outline" size={18} color="#FCA5A5" />
                </View>
                <Text style={styles.modernHeroMiniLabel}>Despesas</Text>
              </View>
              <Text style={styles.modernHeroMiniValueRed}>
                R$ {formatCurrency(data.expenses)}
              </Text>
              <Text style={styles.modernHeroMiniCaption}>
                {formatDecimal(expensesPercent)}% do faturamento
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.modernStatsGrid}>
          <View
            style={[
              styles.modernStatCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={{flexDirection: 'row', gap: 5}}>
              <View style={styles.modernStatIconBlue}>
                <Ionicons name="time-outline" size={20} color="#60A5FA" />
              </View>
              <Text style={[styles.modernStatLabel, { color: theme.muted }]}>
                Tempo
              </Text>
            </View>
            <Text style={[styles.modernStatValue, { color: theme.text }]}>
              {formatHours(data.totalHours)}
            </Text>
          </View>

          <View
            style={[
              styles.modernStatCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={{flexDirection: 'row', gap: 5}}>
              <View style={styles.modernStatIconOrange}>
                <Ionicons name="speedometer-outline" size={20} color="#F59E0B" />
              </View>
              <Text style={[styles.modernStatLabel, { color: theme.muted }]}>
                KM rodado
              </Text>
            </View>
            <Text style={[styles.modernStatValue, { color: theme.text }]}>
              {formatNumber(data.totalKm)} km
            </Text>
          </View>

          <View
            style={[
              styles.modernStatCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={{flexDirection: 'row', gap: 5}}>
              <View style={styles.modernStatIconGreen}>
                <Ionicons name="analytics-outline" size={20} color="#22C55E" />
              </View>
              <Text style={[styles.modernStatLabel, { color: theme.muted }]}>
                Ganho/h
              </Text>
            </View>
            <Text style={[styles.modernStatValue, { color: theme.text }]}>
              R$ {formatDecimal(data.revenuePerHour)}
            </Text>
          </View>

          <View
            style={[
              styles.modernStatCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={{flexDirection: 'row', gap: 5}}>
              <View style={styles.modernStatIconPurple}>
                <Ionicons name="navigate-outline" size={20} color="#A78BFA" />
              </View>
              <Text style={[styles.modernStatLabel, { color: theme.muted }]}>
                Ganho/km
              </Text>
            </View>
            <Text style={[styles.modernStatValue, { color: theme.text }]}>
              R$ {formatDecimal(data.revenuePerKm)}
            </Text>
          </View>
        </View>

        {goalFloating.variant !== "hidden" && (
          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.goalMiniCard,
              { backgroundColor: theme.card, borderColor: theme.border },
              goalFloating.variant === "empty" && styles.goalMiniCardEmpty,
              goalFloating.variant === "active" && styles.goalMiniCardActive,
              goalFloating.variant === "success" && styles.goalMiniCardSuccess,
              goalFloating.variant === "danger" && styles.goalMiniCardDanger,
              goalFloating.variant === "future" && styles.goalMiniCardFuture,
            ]}
            onPress={() => setGoalModalVisible(true)}
          >
            <View
              style={[
                styles.goalMiniIconBox,
                goalFloating.variant === "empty" && styles.goalMiniIconBoxEmpty,
              ]}
            >
              <Ionicons
                name={goalFloating.icon}
                size={18}
                color={goalFloating.variant === "empty" ? "#111827" : "#FFFFFF"}
              />
            </View>

            <View style={styles.goalMiniInfo}>
              <View style={styles.goalMiniTitleRow}>
                <Text
                  style={[
                    styles.goalMiniTitle,
                    goalFloating.variant === "empty" && styles.goalMiniTitleDark,
                  ]}
                >
                  {goalPeriodLabel}
                </Text>

                {goalStatusLabel ? (
                  <View
                    style={[
                      styles.goalMiniStatusBadge,
                      goalFloating.variant === "active" && styles.goalMiniStatusActive,
                      goalFloating.variant === "success" && styles.goalMiniStatusSuccess,
                      goalFloating.variant === "danger" && styles.goalMiniStatusDanger,
                    ]}
                  >
                    <Text style={styles.goalMiniStatusText}>
                      {goalStatusLabel}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text
                style={[
                  styles.goalMiniValue,
                  goalFloating.variant === "empty" && styles.goalMiniValueDark,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {goalFloating.subtitle}
              </Text>

              {currentGoal?.target_amount &&
                goalFloating.variant !== "future" &&
                goalFloating.variant !== "empty" && (
                  <View style={styles.goalMiniProgressTrack}>
                    <View
                      style={[
                        styles.goalMiniProgressFill,
                        goalFloating.variant === "active" && styles.goalMiniProgressFillActive,
                        goalFloating.variant === "success" && styles.goalMiniProgressFillSuccess,
                        goalFloating.variant === "danger" && styles.goalMiniProgressFillDanger,
                        { width: `${goalProgressPercent}%` },
                      ]}
                    />
                  </View>
                )}
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={goalFloating.variant === "empty" ? "#374151" : "rgba(255,255,255,0.72)"}
            />
          </TouchableOpacity>
        )}

        {period === "day" && (
          <View
            style={[
              styles.modernSessionsCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={styles.modernSectionHeader}>
              <View>
                <Text
                  style={[styles.modernSectionTitle, { color: theme.text }]}
                >
                  Jornadas do dia
                </Text>
                <Text
                  style={[styles.modernSectionSubtitle, { color: theme.muted }]}
                >
                  Turnos finalizados no período selecionado
                </Text>
              </View>

              <View style={styles.modernCountBadge}>
                <Text style={styles.modernCountText}>{daySessions.length}</Text>
              </View>
            </View>

            {daySessions.length === 0 ? (
              <Text style={styles.emptyText}>
                Nenhuma jornada finalizada neste dia.
              </Text>
            ) : (
              daySessions.map((session) => (
                <View key={session.id} style={styles.modernSessionItem}>
                  <View style={styles.modernSessionTop}>
                    <View style={styles.modernSessionIcon}>
                      <Ionicons
                        name="briefcase-outline"
                        size={18}
                        color="#22C55E"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modernSessionTitle}>
                        {formatSessionHour(session.started_at)} -{" "}
                        {formatSessionHour(session.finished_at)}
                      </Text>
                      <Text style={styles.modernSessionSubtitle}>
                        {session.vehicle?.model ?? "Veículo"}{" "}
                        {session.vehicle?.plate
                          ? `· ${session.vehicle.plate}`
                          : ""}
                      </Text>
                    </View>
                    <Text style={styles.modernSessionMoney}>
                      R$ {formatCurrency(session.totalEarnings)}
                    </Text>
                  </View>

                  <View style={styles.modernSessionStatsRow}>
                    <Text style={styles.modernSessionChip}>
                      ⏱ {formatHours(session.totalHours)}
                    </Text>
                    <Text style={styles.modernSessionChip}>
                      📍 {formatNumber(session.totalKm)} km
                    </Text>
                    <Text style={styles.modernSessionChip}>
                      R$ {formatDecimal(session.revenuePerHour)}/h
                    </Text>
                    <Text style={styles.modernSessionChip}>
                      R$ {formatDecimal(session.revenuePerKm)}/km
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.modernDetailsButton}
                    onPress={() => openSessionDetails(session)}
                  >
                    <Text style={styles.modernDetailsButtonText}>
                      Ver detalhes do turno
                    </Text>
                    <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        <View
          style={[
            styles.modernChartCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.modernSectionHeader}>
            <View>
              <Text style={[styles.modernSectionTitle, { color: theme.text }]}>
                Ganhos por plataforma
              </Text>
              <Text
                style={[styles.modernSectionSubtitle, { color: theme.muted }]}
              >
                Distribuição do faturamento
              </Text>
            </View>
            <Ionicons name="pie-chart-outline" size={24} color="#22C55E" />
          </View>

          {pieData.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum ganho neste período.</Text>
          ) : (
            <>
              <View style={styles.pieWrapper}>
                <PieChart
                  data={pieData}
                  donut
                  radius={92}
                  innerRadius={48}
                  innerCircleColor={"#111827"}
                  textColor="#FFFFFF"
                  fontWeight="900"
                  textSize={12}
                  labelsPosition="outward"
                  showText
                  centerLabelComponent={() => (
                    <View style={styles.pieCenter}>
                      <Text style={styles.pieCenterLabel}>Total</Text>
                      <Text style={styles.pieCenterValue}>
                        R$ {formatCurrency(data.revenue)}
                      </Text>
                    </View>
                  )}
                />
              </View>

              <View style={styles.pieLegend}>
                {pieData.map((item, index) => (
                  <View key={index} style={styles.pieLegendItem}>
                    <View
                      style={[
                        styles.pieLegendDot,
                        { backgroundColor: item.color },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pieLegendName}>{item.label}</Text>
                      <Text style={styles.pieLegendPercent}>{item.text}</Text>
                    </View>
                    <Text style={styles.pieLegendValue}>
                      R$ {formatCurrency(item.value)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {period !== "day" && (
          <View
            style={[
              styles.modernChartCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={styles.modernSectionHeader}>
              <View>
                <Text
                  style={[styles.modernSectionTitle, { color: theme.text }]}
                >
                  Faturamento por período
                </Text>
                <Text
                  style={[styles.modernSectionSubtitle, { color: theme.muted }]}
                >
                  {period === "month" ? "Semanas de segunda a domingo" : "Comparativo do período selecionado"}
                </Text>
              </View>
              <Ionicons name="bar-chart-outline" size={24} color="#22C55E" />
            </View>

            <View style={styles.barChartWrapper}>
              {barChartData.map((item: any) => {
                const height = Math.max((item.value / maxBarValue) * 150, 8);
                return (
                  <View key={item.label} style={styles.barItem}>
                    <Text style={styles.barValue}>
                      {formatCurrency(item.value)}
                    </Text>
                    <View style={[styles.barColumn, { height }]} />
                    <Text style={styles.barLabel}>{item.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/*}
        <TouchableOpacity
          style={styles.modernChallengeHub}
          activeOpacity={0.86}
          onPress={() => router.push("/(private)/desafios-area" as never)}
        >
          <View style={styles.modernChallengeIcon}>
            <Ionicons name="trophy-outline" size={26} color="#FACC15" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.modernChallengeTitle}>
              Desafios e conquistas
            </Text>
            <Text style={styles.modernChallengeText}>
              Acompanhe XP, metas e evolução em uma área própria.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#A1A1AA" />
        </TouchableOpacity>
        */}

        {/*{data.nextRevision && (
          <View style={styles.modernRevisionCard}>
            <View style={styles.alertIcon}>
              <Ionicons name="construct-outline" size={24} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>Próxima revisão</Text>
              <Text style={styles.alertText}>
                {data.nextRevision.model} em{" "}
                {formatNumber(Math.max(data.nextRevision.kmUntilRevision, 0))}{" "}
                km
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#A1A1AA" />
          </View>
        )}*/}
      </ScrollView>

      <Modal
        visible={goalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeGoalModal}
      >
        <View style={styles.goalModalOverlay}>
          <View style={styles.goalModalContent}>
            <View style={styles.goalModalHeader}>
              <Text style={styles.goalModalTitle}>Meta do período</Text>
              <TouchableOpacity onPress={closeGoalModal}>
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <DashboardGoalCard
              selectedPeriod={period}
              selectedDate={referenceDate}
              currentAmount={data.revenue}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={sessionDetailsModalVisible}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sessionDetailsModal}>
            <View style={styles.periodModalHeader}>
              <Text style={styles.periodModalTitle}>Detalhes do turno</Text>

              <TouchableOpacity
                onPress={() => setSessionDetailsModalVisible(false)}
              >
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {selectedSession && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.sessionDetailsSummary}>
                  <Text style={styles.sessionDetailsTime}>
                    {formatSessionHour(selectedSession.started_at)} -{" "}
                    {formatSessionHour(selectedSession.finished_at)}
                  </Text>

                  <Text style={styles.sessionDetailsRevenue}>
                    R$ {formatCurrency(selectedSession.totalEarnings)}
                  </Text>

                  <Text style={styles.sessionDetailsMuted}>
                    {formatHours(selectedSession.totalHours)} trabalhados ·{" "}
                    {formatNumber(selectedSession.totalKm)} km rodados
                  </Text>
                </View>

                <Text style={styles.sessionDetailsSectionTitle}>
                  Ganhos por plataforma
                </Text>

                {selectedSession.earnings?.length ? (
                  selectedSession.earnings.map((earning: any) => (
                    <View key={earning.id} style={styles.sessionDetailRow}>
                      <Text style={styles.sessionDetailName}>
                        {earning.platform}
                      </Text>
                      <Text style={styles.sessionDetailValue}>
                        R$ {formatCurrency(Number(earning.amount))}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>Nenhum ganho registrado.</Text>
                )}

                <Text style={styles.sessionDetailsSectionTitle}>
                  Corridas realizadas
                </Text>

                {selectedSession.rides?.length ? (
                  selectedSession.rides.map((ride: any) => (
                    <View key={ride.id} style={styles.sessionRideCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sessionRideTitle}>
                          {ride.platform ?? "Corrida"}
                        </Text>

                        <Text style={styles.sessionDetailsMuted}>
                          {formatSessionHour(ride.started_at)} -{" "}
                          {formatSessionHour(ride.finished_at)}
                        </Text>
                      </View>

                      <Text style={styles.sessionDetailValue}>
                        R$ {formatCurrency(Number(ride.amount ?? 0))}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>
                    Nenhuma corrida registrada neste turno.
                  </Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={periodModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.periodModal}>
            <View style={styles.periodModalHeader}>
              <Text style={styles.periodModalTitle}>Escolher período</Text>

              <TouchableOpacity onPress={() => setPeriodModalVisible(false)}>
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.periodModalTabs}>
              {periodOptions.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.periodModalTab,
                    periodTab === item.value && styles.periodModalTabActive,
                  ]}
                  onPress={() => setPeriodTab(item.value)}
                >
                  <Text
                    style={[
                      styles.periodModalTabText,
                      periodTab === item.value &&
                        styles.periodModalTabTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {shouldShowCurrentButton() && (
              <TouchableOpacity
                style={styles.currentPeriodButton}
                onPress={goToCurrentPeriod}
              >
                <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />

                <Text style={styles.currentPeriodButtonText}>
                  {currentButtonLabel()}
                </Text>
              </TouchableOpacity>
            )}

            {periodTab === "day" && (
              <View style={styles.calendarWrapper}>
                <Calendar
                  current={toCalendarDate(referenceDate)}
                  markedDates={{
                    [toCalendarDate(referenceDate)]: {
                      selected: true,
                      selectedColor: "#22C55E",
                    },
                  }}
                  onDayPress={(day) => {
                    const selectedDate = new Date(day.dateString + "T12:00:00");

                    selectPeriod("day", selectedDate);
                  }}
                  theme={{
                    calendarBackground: "#09090B",
                    dayTextColor: "#FFFFFF",
                    monthTextColor: "#FFFFFF",
                    todayTextColor: "#22C55E",
                    arrowColor: "#22C55E",
                    selectedDayTextColor: "#FFFFFF",
                    textDisabledColor: "#3F3F46",
                  }}
                />
              </View>
            )}

            {periodTab === "week" && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.periodList}
              >
                {generateWeeks(referenceDate).map((date) => {
                  const selected =
                    isSameWeek(date, referenceDate) && period === "week";

                  return (
                    <TouchableOpacity
                      key={date.toISOString()}
                      style={[
                        styles.periodListItem,
                        selected && styles.periodListItemActive,
                      ]}
                      onPress={() => selectPeriod("week", date)}
                    >
                      <Text style={styles.periodListItemTitle}>
                        {formatWeekLabel(date)}
                      </Text>

                      {selected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color="#22C55E"
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {periodTab === "month" && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.periodList}
              >
                {generateMonths(referenceDate).map((date) => {
                  const selected =
                    isSameMonth(date, referenceDate) && period === "month";

                  return (
                    <TouchableOpacity
                      key={date.toISOString()}
                      style={[
                        styles.periodListItem,
                        selected && styles.periodListItemActive,
                      ]}
                      onPress={() => selectPeriod("month", date)}
                    >
                      <Text style={styles.periodListItemTitle}>
                        {months[date.getMonth()]} de {date.getFullYear()}
                      </Text>

                      {selected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color="#22C55E"
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {periodTab === "year" && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.periodList}
              >
                {generateYears(referenceDate).map((year) => {
                  const selected =
                    year === referenceDate.getFullYear() && period === "year";

                  return (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.periodListItem,
                        selected && styles.periodListItemActive,
                      ]}
                      onPress={() => {
                        const selectedDate = new Date(referenceDate);
                        selectedDate.setFullYear(year);

                        selectPeriod("year", selectedDate);
                      }}
                    >
                      <Text style={styles.periodListItemTitle}>{year}</Text>

                      {selected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color="#22C55E"
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090B" },
  content: { paddingHorizontal: 18, paddingTop: 48, paddingBottom: 140 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greeting: { color: "#A1A1AA", fontSize: 14, fontWeight: "700" },
  title: { color: "#FFFFFF", fontSize: 25, fontWeight: "900" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 5 },
  notificationButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#18181B",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatar: { width: 52, height: 52, borderRadius: 999 },
  userAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: "#18181B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  periodSelectorCard: {
    minHeight: 76,
    borderRadius: 24,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  periodArrowButton: {
    width: 42,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  periodSelectorTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    textTransform: "capitalize",
    textAlign: "center",
  },
  periodSelectorSubtitle: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  profitCard: {
    borderRadius: 30,
    backgroundColor: "#031B12",
    borderWidth: 1,
    borderColor: "#14532D",
    padding: 22,
    marginBottom: 14,
  },
  profitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardLabel: { color: "#A7F3D0", fontSize: 13, fontWeight: "800" },
  profitValue: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "900",
    marginTop: 8,
  },
  variationBadge: {
    height: 32,
    borderRadius: 999,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  variationPositive: { backgroundColor: "#22C55E" },
  variationNegative: { backgroundColor: "#EF4444" },
  variationText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  fakeChart: {
    height: 90,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 20,
  },
  chartBar: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: "#22C55E",
    opacity: 0.85,
  },
  profitPercentText: {
    color: "#A7F3D0",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 14,
  },
  mainGrid: { flexDirection: "row", gap: 12, marginBottom: 12 },
  metricCard: {
    flex: 1,
    minHeight: 150,
    backgroundColor: "#18181B",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  metricCardFat: {
    flex: 1,
    backgroundColor: "rgba(96, 165, 250, 0.15)",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E3A8A",
  },
  metricCardDes: {
    flex: 1,
    backgroundColor: "rgba(248, 113, 113, 0.15)",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#991B1B",
  },
  metricIconGreen: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(96, 165, 250, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  metricIconRed: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#3B0B12",
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "800",
  },
  metricValue: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 8,
  },
  metricValueRed: {
    color: "#EF4444",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 8,
  },
  metricSubText: {
    color: "#71717A",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    width: "47.8%",
    backgroundColor: "#18181B",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  statLabel: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "800",
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 6,
  },
  alertCard: {
    minHeight: 82,
    borderRadius: 24,
    backgroundColor: "#2A1605",
    borderWidth: 1,
    borderColor: "#F59E0B",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  alertIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(245,158,11,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  alertTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  alertText: {
    color: "#FCD34D",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  platformCard: {
    backgroundColor: "#18181B",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 18,
  },
  emptyText: { color: "#71717A", fontSize: 13, fontWeight: "700" },
  platformItem: { marginBottom: 16 },
  platformRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  platformName: { color: "#FFFFFF", fontWeight: "800" },
  platformValue: { color: "#22C55E", fontWeight: "900" },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#27272A",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#22C55E",
    borderRadius: 999,
  },
  platformPercent: {
    color: "#71717A",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "right",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  periodModal: {
    backgroundColor: "#09090B",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 20,
    maxHeight: "82%",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  periodModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  periodModalTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  periodModalTabs: {
    flexDirection: "row",
    marginTop: 20,
    backgroundColor: "#18181B",
    borderRadius: 16,
    padding: 4,
  },
  periodModalTab: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  periodModalTabActive: { backgroundColor: "#22C55E" },
  periodModalTabText: { color: "#A1A1AA", fontSize: 13, fontWeight: "800" },
  periodModalTabTextActive: { color: "#FFFFFF" },
  currentPeriodButton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: "#22C55E",
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  currentPeriodButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  calendarWrapper: { marginTop: 18, borderRadius: 18, overflow: "hidden" },
  periodList: { paddingTop: 18, paddingBottom: 24 },
  periodListItem: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  periodListItemActive: { borderColor: "#22C55E", backgroundColor: "#052E16" },
  periodListItemTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  periodTabs: {
    flexDirection: "row",
    backgroundColor: "#18181B",
    borderRadius: 18,
    padding: 5,
    marginBottom: 12,
  },

  periodTab: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  periodTabActive: {
    backgroundColor: "#22C55E",
  },

  periodTabText: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "800",
  },

  periodTabTextActive: {
    color: "#FFFFFF",
  },
  pieCard: {
    backgroundColor: "#18181B",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#27272A",
    marginBottom: 14,
  },

  pieWrapper: {
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: "#27272A",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 20,
    overflow: "hidden",
  },

  pieSlice: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 999,
    borderWidth: 38,
    borderColor: "#22C55E",
    borderLeftColor: "#3B82F6",
    borderBottomColor: "#F59E0B",
    borderRightColor: "#8B5CF6",
  },

  pieCenter: {
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: "#18181B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#27272A",
  },

  pieCenterLabel: {
    color: "#A1A1AA",
    fontSize: 10,
    fontWeight: "800",
  },

  pieCenterValue: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
  },

  pieLegend: {
    gap: 12,
  },

  pieLegendItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  pieLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },

  pieLegendName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  pieLegendPercent: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
  },

  pieLegendValue: {
    color: "#22C55E",
    fontSize: 14,
    fontWeight: "900",
  },
  platformChartCard: {
    backgroundColor: "#18181B",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#27272A",
    marginBottom: 16,
  },

  platformLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  platformLegendColor: {
    width: 14,
    height: 14,
    borderRadius: 999,
    marginRight: 12,
  },

  platformLegendName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  platformLegendPercent: {
    color: "#A1A1AA",
    fontSize: 12,
  },

  platformLegendValue: {
    color: "#22C55E",
    fontWeight: "900",
    fontSize: 14,
  },
  barChartCard: {
    backgroundColor: "#18181B",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#27272A",
    marginBottom: 16,
  },

  barChartWrapper: {
    height: 245,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 20,
  },

  barItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },

  barValue: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 8,
  },

  barColumn: {
    width: 34,
    borderRadius: 10,
    backgroundColor: "#22C55E",
  },
  barLabel: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 10,
    textAlign: "center",
    lineHeight: 15,
    minWidth: 54,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },

  challengesShortcutCard: {
    minHeight: 86,
    borderRadius: 24,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  challengesShortcutIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#2A2205",
    borderWidth: 1,
    borderColor: "#713F12",
    alignItems: "center",
    justifyContent: "center",
  },

  challengesShortcutTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  challengesShortcutText: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 17,
  },

  daySessionsCard: {
    backgroundColor: "#18181B",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#27272A",
    marginBottom: 14,
  },

  daySessionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  daySessionsSubtitle: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: -12,
    marginBottom: 2,
  },

  daySessionsCountBadge: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#052E16",
    borderWidth: 1,
    borderColor: "#166534",
    alignItems: "center",
    justifyContent: "center",
  },

  daySessionsCountText: {
    color: "#22C55E",
    fontSize: 15,
    fontWeight: "900",
  },

  daySessionItem: {
    backgroundColor: "#0B1220",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1E293B",
    padding: 14,
    marginBottom: 12,
  },

  daySessionTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  daySessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#052E16",
    alignItems: "center",
    justifyContent: "center",
  },

  daySessionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  daySessionSubtitle: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  daySessionRevenue: {
    color: "#22C55E",
    fontSize: 14,
    fontWeight: "900",
  },

  daySessionStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },

  daySessionStatBox: {
    width: "48%",
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1F2937",
  },

  daySessionStatLabel: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "800",
  },

  daySessionStatValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },

  daySessionDetailsButton: {
    height: 44,
    borderRadius: 14,
    backgroundColor: "#22C55E",
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },

  daySessionDetailsText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  sessionDetailsModal: {
    backgroundColor: "#09090B",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 20,
    height: "86%",
    borderWidth: 1,
    borderColor: "#27272A",
  },

  sessionDetailsSummary: {
    backgroundColor: "#031B12",
    borderWidth: 1,
    borderColor: "#14532D",
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },

  sessionDetailsTime: {
    color: "#A7F3D0",
    fontSize: 13,
    fontWeight: "900",
  },

  sessionDetailsRevenue: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 8,
  },

  sessionDetailsMuted: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },

  sessionDetailsSectionTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
    marginTop: 10,
  },

  sessionDetailRow: {
    minHeight: 54,
    backgroundColor: "#18181B",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#27272A",
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sessionDetailName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  sessionDetailValue: {
    color: "#22C55E",
    fontSize: 14,
    fontWeight: "900",
  },

  sessionRideCard: {
    minHeight: 68,
    backgroundColor: "#18181B",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#27272A",
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  sessionRideTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  modernContent: {
    paddingHorizontal: 18,
    paddingTop: 52,
    paddingBottom: 170,
  },

  modernHeader: {
    marginBottom: 5,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },

  modernUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },

  modernAvatar: {
    width: 54,
    height: 54,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#22C55E",
  },

  modernAvatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },

  modernGreeting: {
    fontSize: 12,
    fontWeight: "800",
  },

  modernTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 2,
  },

  modernHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },

  modernHeaderIconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  modernPeriodTabs: {
    flexDirection: "row",
    borderRadius: 20,
    padding: 5,
    marginBottom: 12,
    borderWidth: 1,
  },

  modernPeriodTab: {
    flex: 1,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  modernPeriodTabActive: {
    backgroundColor: "#22C55E",
  },

  modernPeriodTabText: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "900",
  },

  modernPeriodTabTextActive: {
    color: "#FFFFFF",
  },

  modernPeriodSelector: {
    minHeight: 76,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    paddingHorizontal: 10,
  },

  modernPeriodArrow: {
    width: 44,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },

  modernPeriodCenter: {
    flex: 1,
    alignItems: "center",
  },

  modernPeriodTitle: {
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "capitalize",
  },

  modernPeriodSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },

  modernHeroCard: {
    borderRadius: 34,
    padding: 10,
    marginBottom: 14,
    backgroundColor: "#052E16",
    borderWidth: 1,
    borderColor: "#166534",
  },

  modernHeroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  modernHeroBadge: {
    height: 34,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.22)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  modernHeroBadgeText: {
    color: "#BBF7D0",
    fontSize: 12,
    fontWeight: "900",
  },

  modernVariationPill: {
    height: 34,
    borderRadius: 999,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  modernVariationPositive: {
    backgroundColor: "#22C55E",
  },

  modernVariationNegative: {
    backgroundColor: "#EF4444",
  },

  modernVariationText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  modernHeroValue: {
    color: "#FFFFFF",
    fontSize: 39,
    fontWeight: "900",
    marginTop: 16,
    letterSpacing: -1,
  },

  modernHeroSub: {
    color: "#A7F3D0",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 6,
  },

  modernHeroMiniGrid: {
    flexDirection: "row",
    gap: 5,
    marginTop: 18,
  },

  modernHeroMiniCard: {
    flex: 1,
    minHeight: 105,
    borderRadius: 24,
    padding: 14,
    backgroundColor: "rgba(2,6,23,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  modernMiniIconBlue: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(59,130,246,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },

  modernMiniIconRed: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  modernHeroMiniLabel: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 10,
  },

  modernHeroMiniValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },

  modernHeroMiniValueRed: {
    color: "#FCA5A5",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },

  modernHeroMiniCaption: {
    color: "#A1A1AA",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 4,
  },

  modernStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },

  modernStatCard: {
    width: "48.5%",
    minHeight: 94,
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
  },

  modernStatIconBlue: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(59,130,246,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  modernStatIconOrange: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(245,158,11,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  modernStatIconGreen: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(34,197,94,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  modernStatIconPurple: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(139,92,246,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  modernStatLabel: {
    fontSize: 12,
    fontWeight: "900",
    marginTop: 12,
  },

  modernStatValue: {
    fontSize: 19,
    fontWeight: "900",
    marginTop: 4,
  },

  modernSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  modernSectionTitle: {
    fontSize: 18,
    fontWeight: "900",
  },

  modernSectionSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },

  modernSessionsCard: {
    borderRadius: 28,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },

  modernCountBadge: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#052E16",
    borderWidth: 1,
    borderColor: "#166534",
    alignItems: "center",
    justifyContent: "center",
  },

  modernCountText: {
    color: "#22C55E",
    fontSize: 15,
    fontWeight: "900",
  },

  modernSessionItem: {
    backgroundColor: "#0B1220",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 24,
    padding: 14,
    marginBottom: 12,
  },

  modernSessionTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  modernSessionIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#052E16",
    alignItems: "center",
    justifyContent: "center",
  },
  modernSessionTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  modernSessionSubtitle: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  modernSessionMoney: { color: "#22C55E", fontSize: 18, fontWeight: "900" },
  modernSessionStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  modernSessionChip: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "800",
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  modernDetailsButton: {
    height: 44,
    borderRadius: 15,
    backgroundColor: "#22C55E",
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  modernDetailsButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  modernChartCard: {
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    marginBottom: 14,
  },

  modernChallengeHub: {
    minHeight: 90,
    borderRadius: 28,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  modernChallengeIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#2A2205",
    borderWidth: 1,
    borderColor: "#713F12",
    alignItems: "center",
    justifyContent: "center",
  },
  modernChallengeTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  modernChallengeText: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 4,
  },

  modernRevisionCard: {
    minHeight: 84,
    borderRadius: 26,
    backgroundColor: "#2A1605",
    borderWidth: 1,
    borderColor: "#F59E0B",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  modernFloatingGoal: {
    position: "absolute",
    right: 0,
    bottom: 82,
    minWidth: 166,
    maxWidth: "96%",
    minHeight: 64,
    borderBottomLeftRadius: 24,
    borderTopLeftRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },

  modernFloatingGoalEmpty: {
    backgroundColor: "#CCCCCC",
    shadowColor: "#94A3B8",
  },

  modernFloatingGoalFuture: {
    backgroundColor: "#1D4ED8",
    shadowColor: "#3B82F6",
  },

  modernFloatingGoalActive: {
    backgroundColor: "#14532D",
    shadowColor: "#22C55E",
  },

  modernFloatingGoalSuccess: {
    backgroundColor: "#16A34A",
    shadowColor: "#22C55E",
  },

  modernFloatingGoalDanger: {
    backgroundColor: "#DC2626",
    shadowColor: "#EF4444",
  },

  modernFloatingGoalIconBox: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },

  modernFloatingGoalTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  modernFloatingGoalSubtitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
    flexShrink: 1,
  },

  modernFloatingGoalTitleDark: {
    color: "#111827",
  },

  modernFloatingGoalSubtitleDark: {
    color: "#374151",
  },

  goalMiniCard: {
    minHeight: 64,
    borderRadius: 22,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.98,
  },

  goalMiniCardEmpty: {
    backgroundColor: "#CCCCCC",
    borderColor: "#CBD5E1",
  },

  goalMiniCardFuture: {
    backgroundColor: "#172554",
    borderColor: "#1D4ED8",
  },

  goalMiniCardActive: {
    backgroundColor: "#0F2418",
    borderColor: "#14532D",
  },

  goalMiniCardSuccess: {
    backgroundColor: "#052E16",
    borderColor: "#22C55E",
  },

  goalMiniCardDanger: {
    backgroundColor: "#450A0A",
    borderColor: "#EF4444",
  },

  goalMiniIconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  goalMiniIconBoxEmpty: {
    backgroundColor: "rgba(17,24,39,0.08)",
  },

  goalMiniInfo: {
    flex: 1,
  },

  goalMiniTitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "900",
  },

  goalMiniTitleDark: {
    color: "#374151",
  },

  goalMiniTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  goalMiniStatusBadge: {
    minHeight: 22,
    borderRadius: 999,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  goalMiniStatusActive: {
    backgroundColor: "rgba(34,197,94,0.18)",
  },

  goalMiniStatusSuccess: {
    backgroundColor: "rgba(34,197,94,0.24)",
  },

  goalMiniStatusDanger: {
    backgroundColor: "rgba(239,68,68,0.20)",
  },

  goalMiniStatusText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  goalMiniValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },

  goalMiniValueDark: {
    color: "#111827",
  },

  goalMiniProgressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
    marginTop: 7,
  },

  goalMiniProgressFill: {
    height: "100%",
    borderRadius: 999,
  },

  goalMiniProgressFillActive: {
    backgroundColor: "#22C55E",
  },

  goalMiniProgressFillSuccess: {
    backgroundColor: "#22C55E",
  },

  goalMiniProgressFillDanger: {
    backgroundColor: "#DC2626",
  },

  goalHeaderButton: {
    position: "relative",
    overflow: "visible",
  },

  goalHeaderButtonEmpty: {
    backgroundColor: "#E5E7EB",
    borderColor: "#CBD5E1",
  },

  goalHeaderButtonActive: {
    backgroundColor: "#14532D",
    borderColor: "#22C55E",
  },

  goalHeaderButtonSuccess: {
    backgroundColor: "#16A34A",
    borderColor: "#22C55E",
  },

  goalHeaderButtonDanger: {
    backgroundColor: "#DC2626",
    borderColor: "#EF4444",
  },

  goalHeaderProgressDot: {
    position: "absolute",
    right: -2,
    top: -2,
    width: 11,
    height: 11,
    borderRadius: 999,
    backgroundColor: "#FACC15",
    borderWidth: 2,
    borderColor: "#09090B",
  },

  goalInlineCard: {
    minHeight: 82,
    borderRadius: 26,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
  },

  goalInlineCardEmpty: {
    backgroundColor: "#CCCCCC",
    borderColor: "#CBD5E1",
  },

  goalInlineCardFuture: {
    backgroundColor: "#172554",
    borderColor: "#1D4ED8",
  },

  goalInlineCardActive: {
    backgroundColor: "#14532D",
    borderColor: "#22C55E",
  },

  goalInlineCardSuccess: {
    backgroundColor: "#052E16",
    borderColor: "#22C55E",
  },

  goalInlineCardDanger: {
    backgroundColor: "#450A0A",
    borderColor: "#EF4444",
  },

  goalInlineIconBox: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  goalInlineIconBoxEmpty: {
    backgroundColor: "rgba(17,24,39,0.08)",
  },

  goalInlineContent: {
    flex: 1,
  },

  goalInlineTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  goalInlineTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  goalInlineTitleDark: {
    color: "#111827",
  },

  goalInlineSubtitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },

  goalInlineSubtitleDark: {
    color: "#374151",
    fontSize: 15,
  },

  goalInlineProgressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
    marginTop: 10,
  },

  goalInlineProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },

  goalModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  goalModalContent: {
    backgroundColor: "#09090B",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: "#27272A",
    maxHeight: "82%",
  },
  goalModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  goalModalTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
});
