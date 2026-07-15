/**
 * Arquivo: app/(private)/(tabs)/dashboard.tsx
 *
 * Tela principal do Dashboard do MovenApp.
 *
 * Esta versão foi comentada e otimizada para reduzir processamento:
 * - usa cache simples para listas que mudam pouco, como plataformas;
 * - evita várias chamadas simultâneas de loadDashboard;
 * - usa debounce nos eventos realtime do Supabase;
 * - evita chamadas extras ao auth.getUser quando o usuário já veio do dashboard;
 * - mantém a tela sincronizada sem recarregar tudo a cada evento isolado.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Calendar } from "react-native-calendars";
import { PieChart } from "react-native-gifted-charts";
import { NotificationBell } from "../../../src/features/notifications/components/NotificationBell";
import { DashboardGoalCard } from "../../../src/features/goals/components/DashboardGoalCard";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useGlobalLoading } from "../../../src/components/GlobalLoadingProvider";
import { supabase } from "../../../src/database/supabase";

import {
  getDashboardData,
  DashboardPeriod,
} from "../../../src/features/dashboard/services/getDashboardData";
import { getDayWorkSessions } from "../../../src/features/dashboard/services/getDayWorkSessions";
import { getEarningsPerformanceAnalysis } from "../../../src/features/performance/services/getEarningsPerformanceAnalysis";
import { getGoalForPeriod } from "../../../src/features/goals/services/getGoalForPeriod";
import { getGoalPeriodFromDashboard } from "../../../src/features/goals/utils/goalPeriodUtils";
import { getPlatforms } from "../../../src/features/platforms/services/getPlatforms";
import { getUserPlatforms } from "../../../src/features/platforms/services/getUserPlatforms";
import { toggleUserPlatform } from "../../../src/features/platforms/services/toggleUserPlatform";

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

/**
 * Delay usado para agrupar várias atualizações do Realtime em uma única
 * recarga do dashboard.
 *
 * Sem esse debounce, uma alteração em earnings, expenses e work_sessions
 * pode disparar várias chamadas ao Supabase quase ao mesmo tempo.
 */
const DASHBOARD_REFRESH_DEBOUNCE_MS = 450;

/**
 * Delay usado para agrupar atualizações da meta.
 */
const GOAL_REFRESH_DEBOUNCE_MS = 350;

/**
 * Intervalo de fallback enquanto o modal de meta está aberto.
 *
 * Foi aumentado para reduzir processamento. O Realtime continua sendo o
 * caminho principal; este intervalo é só uma segurança.
 */
const GOAL_MODAL_FALLBACK_REFRESH_MS = 2500;

type LoadDashboardOptions = {
  /**
   * Quando true, usa o loading global da tela.
   * Quando false, atualiza em silêncio, ideal para realtime.
   */
  useGlobalLoader?: boolean;

  /**
   * Quando true, força recarregar plataformas mesmo se já houver cache.
   */
  forcePlatformsRefresh?: boolean;
};

type PerformanceTargets = {
  bad_gain_per_hour: number | string | null;
  good_gain_per_hour: number | string | null;
  bad_gain_per_km: number | string | null;
  good_gain_per_km: number | string | null;
};

type DashboardSubscriptionAccess = {
  user_id?: string;
  status?: "trial" | "active" | "inactive" | "deleted" | string;
  can_create?: boolean;
  monthly_price?: number | string | null;
  current_period_end?: string | null;
  days_until_due?: number | null;
  days_inactive?: number | null;
  days_until_deletion?: number | null;
  show_payment_alert?: boolean;
  show_deletion_warning?: boolean;
  alert_title?: string | null;
  alert_message?: string | null;
};

type DashboardSubscriptionBannerInfo = {
  title: string;
  message: string;
  buttonText: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant: "warning" | "danger";
};

const expenseCategoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  "Manutenção": "build-outline",
  "Lavagem/Limpeza": "water-outline",
  "Borracharia": "disc-outline",
  "Alimentação": "restaurant-outline",
  "Combustível": "speedometer-outline",
  "Seguro": "shield-checkmark-outline",
  "Financiamento": "card-outline",
  "Carregamento": "battery-charging-outline",
  "Aluguel": "car-outline",
  "Imposto": "document-text-outline",
  "Multa": "alert-circle-outline",
  "Pedágio": "trail-sign-outline",
  "Plano de Internet": "wifi-outline",
  "Aplicativos": "phone-portrait-outline",
  "Estacionamento": "car-outline",
  "Estoque de Produtos": "cube-outline",
  "Aluguel de Garagem": "business-outline",
  "INSS": "cash-outline",
  "Imposto de Renda": "receipt-outline",
  "Outros": "ellipsis-horizontal-circle-outline",
};


const performanceColors = {
  good: "#22C55E",
  bad: "#EF4444",
  medium: "#FACC15",
  neutral: "#FFFFFF",
};


function getDashboardPerformanceMetricPoints(status?: string | null) {
  if (status === "above") return 100;
  if (status === "intermediate") return 50;
  if (status === "below") return 10;

  return 0;
}

function getDashboardPerformanceExpensesPoints(expensesPercent?: number | null) {
  const percent = Number(expensesPercent ?? 0);

  if (percent <= 20) return 100;
  if (percent <= 30) return 80;
  if (percent <= 40) return 50;
  if (percent <= 50) return 30;

  return 10;
}

function getDashboardPerformanceScoreInfo(summary: any) {
  const noDataInfo = {
    level: "no_data",
    icon: "analytics-outline" as keyof typeof Ionicons.glyphMap,
    color: "#A1A1AA",
    backgroundColor: "rgba(161,161,170,0.12)",
    borderColor: "rgba(161,161,170,0.28)",
  };

  if (!summary) {
    return noDataInfo;
  }

  const hasRevenue = Number(summary.revenue ?? 0) > 0;
  const hasExpenses = Number(summary.expenses ?? 0) > 0;
  const hasHours = Number(summary.totalHours ?? 0) > 0;
  const hasKm = Number(summary.totalKm ?? 0) > 0;
  const hasActiveDays = Number(summary.activeDays ?? 0) > 0;
  const hasSessions = Number(summary.sessionCount ?? 0) > 0;

  const hasHourStatus =
    summary.hourStatus === "above" ||
    summary.hourStatus === "intermediate" ||
    summary.hourStatus === "below";

  const hasKmStatus =
    summary.kmStatus === "above" ||
    summary.kmStatus === "intermediate" ||
    summary.kmStatus === "below";

  const hasExpensesPercent =
    hasRevenue && hasExpenses && Number.isFinite(Number(summary.expensesPercent));

  const hasAnyPerformanceData =
    hasRevenue ||
    hasExpenses ||
    hasHours ||
    hasKm ||
    hasActiveDays ||
    hasSessions ||
    hasHourStatus ||
    hasKmStatus;

  if (!hasAnyPerformanceData) {
    return noDataInfo;
  }

  const hasHourMetric = hasHourStatus && hasRevenue && hasHours;
  const hasKmMetric = hasKmStatus && hasRevenue && hasKm;
  const hasExpensesMetric = hasExpensesPercent;

  const availableMetrics = [
    hasHourMetric,
    hasKmMetric,
    hasExpensesMetric,
  ].filter(Boolean).length;

  if (availableMetrics === 0) {
    return noDataInfo;
  }

  const totalPoints =
    (hasHourMetric ? getDashboardPerformanceMetricPoints(summary.hourStatus) : 0) +
    (hasKmMetric ? getDashboardPerformanceMetricPoints(summary.kmStatus) : 0) +
    (hasExpensesMetric
      ? getDashboardPerformanceExpensesPoints(summary.expensesPercent)
      : 0);

  const progressPercent = Math.round((totalPoints / (availableMetrics * 100)) * 100);

  /*
    Mesma regra da tela de Desempenho:
    - <= 20%: Crítico
    - > 20% e <= 40%: Ruim
    - > 40% e <= 60%: Intermediário
    - > 60% e <= 80%: Bom
    - > 80%: Excelente
  */
  if (progressPercent <= 20) {
    return {
      level: "critical",
      icon: "warning-outline" as keyof typeof Ionicons.glyphMap,
      color: "#DC2626",
      backgroundColor: "rgba(220,38,38,0.12)",
      borderColor: "rgba(220,38,38,0.34)",
    };
  }

  if (progressPercent <= 40) {
    return {
      level: "bad",
      icon: "close-circle-outline" as keyof typeof Ionicons.glyphMap,
      color: "#EF4444",
      backgroundColor: "rgba(239,68,68,0.12)",
      borderColor: "rgba(239,68,68,0.32)",
    };
  }

  if (progressPercent <= 60) {
    return {
      level: "intermediate",
      icon: "alert-circle-outline" as keyof typeof Ionicons.glyphMap,
      color: "#FACC15",
      backgroundColor: "rgba(250,204,21,0.12)",
      borderColor: "rgba(250,204,21,0.32)",
    };
  }

  if (progressPercent <= 80) {
    return {
      level: "good",
      icon: "checkmark-circle-outline" as keyof typeof Ionicons.glyphMap,
      color: "#84CC16",
      backgroundColor: "rgba(132,204,22,0.12)",
      borderColor: "rgba(132,204,22,0.32)",
    };
  }

  return {
    level: "excellent",
    icon: "trophy-outline" as keyof typeof Ionicons.glyphMap,
    color: "#22C55E",
    backgroundColor: "rgba(34,197,94,0.12)",
    borderColor: "rgba(34,197,94,0.32)",
  };
}

function getDashboardSubscriptionBannerInfo(
  access?: DashboardSubscriptionAccess | null,
): DashboardSubscriptionBannerInfo | null {
  if (!access) return null;

  const status = String(access.status ?? "").toLowerCase();
  const daysUntilDeletion = Number(access.days_until_deletion ?? 0);
  const daysInactive = Number(access.days_inactive ?? 0);
  const daysUntilDue = Number(access.days_until_due ?? 0);
  const monthlyPrice = Number(access.monthly_price ?? 0);

  if (access.show_deletion_warning || status === "deleted") {
    return {
      title: access.alert_title || "Sua conta pode ser deletada",
      message:
        access.alert_message ||
        `Sua conta está inativa há ${daysInactive} dias. Ative sua assinatura em até ${daysUntilDeletion} dias para evitar exclusão automática.`,
      buttonText: "Ativar assinatura",
      icon: "warning-outline",
      variant: "danger",
    };
  }

  if (status === "inactive" || access.can_create === false) {
    return {
      title: access.alert_title || "Assinatura inativa",
      message:
        access.alert_message ||
        "Sua assinatura venceu. Você pode visualizar seus dados, mas não pode cadastrar novas jornadas, ganhos, despesas ou veículos até ativar sua assinatura.",
      buttonText: "Ativar assinatura",
      icon: "lock-closed-outline",
      variant: "danger",
    };
  }

  if (access.show_payment_alert) {
    return {
      title: access.alert_title || "Sua assinatura está perto do vencimento",
      message:
        access.alert_message ||
        `Sua assinatura vence em ${daysUntilDue} dia(s). Ative por R$ ${formatCurrency(monthlyPrice)} para continuar usando todos os recursos.`,
      buttonText: status === "trial" ? "Assinar agora" : "Renovar assinatura",
      icon: "notifications-outline",
      variant: "warning",
    };
  }

  return null;
}


const platformVisualConfig: Record<
  string,
  { color: string; icon?: keyof typeof Ionicons.glyphMap; forceIcon?: boolean }
> = {
  "99": { color: "#FACC15" },
  "99 food": { color: "#FACC15" },
  "99food": { color: "#FACC15" },
  ifood: { color: "#EF4444" },
  indrive: { color: "#86EFAC" },
  keeta: { color: "#166534" },
  lalamove: { color: "#F97316" },
  loggi: { color: "#3B82F6" },
  "mercado livre": { color: "#FACC15" },
  particular: {
    color: "#71717A",
    icon: "disc-outline",
    forceIcon: true,
  },
  produtos: { color: "#92400E" },
  rappi: { color: "#FB923C" },
  shopee: { color: "#EA580C" },
  shoppe: { color: "#EA580C" },
  uber: { color: "#000000" },
  "uber eats": { color: "#000000" },
  "ze delivery": { color: "#FDE047" },
  "zé delivery": { color: "#FDE047" },
};

function normalizePlatformName(platformName?: string | null) {
  return String(platformName ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function getPlatformVisual(platformName?: string | null) {
  const normalizedName = normalizePlatformName(platformName);

  return (
    platformVisualConfig[normalizedName] ?? {
      color: "#22C55E",
      icon: "cash-outline" as keyof typeof Ionicons.glyphMap,
      forceIcon: false,
    }
  );
}

function getPlatformChartColor(platformName?: string | null) {
  return getPlatformVisual(platformName).color;
}

function getPlatformFallbackIcon(platformName?: string | null) {
  return getPlatformVisual(platformName).icon ?? "cash-outline";
}

function shouldForcePlatformFallbackIcon(platformName?: string | null) {
  return Boolean(getPlatformVisual(platformName).forceIcon);
}

function getPlatformIconContrastColor(platformName?: string | null) {
  const normalizedName = normalizePlatformName(platformName);

  if (
    [
      "99",
      "99 food",
      "99food",
      "mercado livre",
      "ze delivery",
      "zé delivery",
      "indrive",
    ].includes(normalizedName)
  ) {
    return "#06130B";
  }

  return "#FFFFFF";
}

function getExpenseIcon(category?: string | null) {
  if (!category) return "receipt-outline" as const;

  return expenseCategoryIcons[category] ?? "receipt-outline";
}

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

function formatDate(value: string | Date) {
  if (!value) return "--/--/----";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--/--/----";
  }

  return date.toLocaleDateString("pt-BR");
}

function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, -1);
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

function getDayGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";

  return "Boa noite";
}

function getUserFirstName(user: any) {
  const name =
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")?.[0] ||
    "Motorista";

  return String(name).trim().split(" ")[0] || "Motorista";
}

function formatDecimal(value: number) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatPerformanceDecimal(value: number) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
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
  const weeks: {
    index: number;
    start: Date;
    end: Date;
    visibleStart: Date;
    visibleEnd: Date;
    label: string;
  }[] = [];
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
    const directDateMatch = String(item.date).match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (directDateMatch) {
      return Number(directDateMatch[3]);
    }

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

function getBarItemDateKey(item: any, referenceDate: Date) {
  if (item?.date) {
    const directDateMatch = String(item.date).match(/^(\d{4}-\d{2}-\d{2})/);

    if (directDateMatch) {
      return directDateMatch[1];
    }

    const parsedDate = new Date(item.date);

    if (!Number.isNaN(parsedDate.getTime())) {
      return toLocalDateKey(parsedDate);
    }
  }

  const day = getDayFromBarItem(item);

  if (!day) return null;

  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, "0");
  const normalizedDay = String(day).padStart(2, "0");

  return `${year}-${month}-${normalizedDay}`;
}

function buildMonthWeeksBarChartData(items: any[], referenceDate: Date) {
  const weeks = getMonthWeeks(referenceDate);

  return weeks.map((week) => {
    const weekStartKey = toLocalDateKey(week.visibleStart);
    const weekEndKey = toLocalDateKey(week.visibleEnd);

    const value = items.reduce((total, item) => {
      const itemDateKey = getBarItemDateKey(item, referenceDate);

      if (!itemDateKey) return total;

      if (itemDateKey >= weekStartKey && itemDateKey <= weekEndKey) {
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

function getEntryDate(entry: any) {
  const dateValue = entry?.session_id
    ? entry?.session?.started_at ||
      entry?.earning_date ||
      entry?.created_at ||
      entry?.session?.finished_at
    : entry?.earning_date ||
      entry?.created_at ||
      entry?.session?.started_at ||
      entry?.session?.finished_at;

  const parsed = new Date(dateValue);

  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateKeyFromValue(value?: string | Date | null) {
  if (!value) return null;

  if (value instanceof Date) {
    return toLocalDateKey(value);
  }

  const textValue = String(value);

  /*
    Corrige casos em que a data do banco vem com horário e o JavaScript
    acaba deslocando para outro dia por causa do fuso/UTC.
    Para gráfico financeiro por dia, usamos o dia gravado no banco.
  */
  const directDateMatch = textValue.match(/^(\d{4}-\d{2}-\d{2})/);

  if (directDateMatch) {
    return directDateMatch[1];
  }

  const parsedDate = new Date(textValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return toLocalDateKey(parsedDate);
}

function getEntryDateKey(entry: any) {
  /*
    Ganhos vinculados a uma jornada pertencem ao dia em que a jornada começou.
    Por isso, quando houver session_id, priorizamos session.started_at.
  */
  const dateValue = entry?.session_id
    ? entry?.session?.started_at ||
      entry?.earning_date ||
      entry?.created_at ||
      entry?.session?.finished_at
    : entry?.earning_date ||
      entry?.created_at ||
      entry?.session?.started_at ||
      entry?.session?.finished_at;

  return getDateKeyFromValue(dateValue);
}

function buildWeekEntriesBarChartData(entries: any[], referenceDate: Date) {
  const { start } = getWeekRange(referenceDate);

  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    const targetKey = toLocalDateKey(date);

    const value = entries.reduce((total, entry) => {
      const entryDateKey = getEntryDateKey(entry);

      return entryDateKey === targetKey
        ? total + Number(entry.amount ?? 0)
        : total;
    }, 0);

    return {
      label: weekDays[date.getDay()],
      date: toLocalDateKey(date),
      value,
    };
  });
}

function buildMonthEntriesBarChartData(entries: any[], referenceDate: Date) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: lastDay }).map((_, index) => {
    const day = index + 1;
    const date = new Date(year, month, day, 12, 0, 0, 0);
    const targetKey = toLocalDateKey(date);

    const value = entries.reduce((total, entry) => {
      const entryDateKey = getEntryDateKey(entry);

      return entryDateKey === targetKey
        ? total + Number(entry.amount ?? 0)
        : total;
    }, 0);

    return {
      label: String(day).padStart(2, "0"),
      date: targetKey,
      value,
    };
  });
}

function buildYearEntriesBarChartData(entries: any[], referenceDate: Date) {
  const year = referenceDate.getFullYear();

  return Array.from({ length: 12 }).map((_, monthIndex) => {
    const value = entries.reduce((total, entry) => {
      const entryDateKey = getEntryDateKey(entry);

      if (!entryDateKey) return total;

      const [entryYear, entryMonth] = entryDateKey.split("-").map(Number);
      const sameMonth = entryYear === year && entryMonth === monthIndex + 1;

      return sameMonth ? total + Number(entry.amount ?? 0) : total;
    }, 0);

    return {
      label: shortMonths[monthIndex],
      value,
    };
  });
}

export default function DashboardScreen() {
  const { withLoading } = useGlobalLoading();
  const [period, setPeriod] = useState<DashboardPeriod>("week");
  const [periodTab, setPeriodTab] = useState<DashboardPeriod>("week");
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [data, setData] = useState<any>(null);
  const [daySessions, setDaySessions] = useState<any[]>([]);
  const [periodExpenses, setPeriodExpenses] = useState<any[]>([]);
  const [periodEntries, setPeriodEntries] = useState<any[]>([]);
  const [periodEntriesReady, setPeriodEntriesReady] = useState(false);
  const [dashboardPlatforms, setDashboardPlatforms] = useState<any[]>([]);
  const [allDashboardPlatforms, setAllDashboardPlatforms] = useState<any[]>([]);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);
  const [platformDrawerVisible, setPlatformDrawerVisible] = useState(false);
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const [returnToEntryModalAfterPlatforms, setReturnToEntryModalAfterPlatforms] =
    useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [sessionDetailsModalVisible, setSessionDetailsModalVisible] =
    useState(false);
  const [user, setUser] = useState<any>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [periodModalVisible, setPeriodModalVisible] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [currentGoal, setCurrentGoal] = useState<any>(null);
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [subscriptionAccess, setSubscriptionAccess] =
    useState<DashboardSubscriptionAccess | null>(null);
  const [yearChartSemester, setYearChartSemester] = useState<"first" | "second">(
    new Date().getMonth() < 6 ? "first" : "second",
  );

  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [entryPlatform, setEntryPlatform] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryDate, setEntryDate] = useState(formatDate(new Date()));
  const [entryAmount, setEntryAmount] = useState('');
  const [entryErrors, setEntryErrors] = useState<Record<string, string>>({});
  const [savingEntry, setSavingEntry] = useState(false);

  const [expenseEditModalVisible, setExpenseEditModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseLocation, setExpenseLocation] = useState('');
  const [expenseDate, setExpenseDate] = useState(formatDate(new Date()));
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseErrors, setExpenseErrors] = useState<Record<string, string>>({});
  const [savingExpense, setSavingExpense] = useState(false);

  const [sessionEarningEditModalVisible, setSessionEarningEditModalVisible] =
    useState(false);
  const [editingSessionEarning, setEditingSessionEarning] = useState<any>(null);
  const [sessionEarningAmount, setSessionEarningAmount] = useState('');
  const [sessionEarningErrors, setSessionEarningErrors] = useState<
    Record<string, string>
  >({});
  const [savingSessionEarning, setSavingSessionEarning] = useState(false);
  const [returnToSessionDetailsAfterEarningEdit, setReturnToSessionDetailsAfterEarningEdit] =
    useState(false);

  const [sessionEditModalVisible, setSessionEditModalVisible] = useState(false);
  const [sessionEditStartTime, setSessionEditStartTime] = useState('');
  const [sessionEditEndTime, setSessionEditEndTime] = useState('');
  const [sessionEditStartKm, setSessionEditStartKm] = useState('');
  const [sessionEditEndKm, setSessionEditEndKm] = useState('');
  const [sessionEditErrors, setSessionEditErrors] = useState<Record<string, string>>({});
  const [savingSessionEdit, setSavingSessionEdit] = useState(false);

  const [performanceTargets, setPerformanceTargets] =
    useState<PerformanceTargets | null>(null);
  const [earningsPerformanceSummary, setEarningsPerformanceSummary] =
    useState<any>(null);

  /**
   * Evita atualizar estado quando a tela já saiu da navegação.
   */
  const mountedRef = useRef(true);

  /**
   * Impede chamadas simultâneas de loadDashboard.
   *
   * Se o realtime disparar várias vezes seguidas, uma chamada fica em andamento
   * e as próximas são agrupadas pelo debounce.
   */
  const dashboardLoadingRef = useRef(false);

  /**
   * Guarda o timeout do debounce do dashboard.
   */
  const dashboardRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Guarda o timeout do debounce da meta.
   */
  const goalRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Cache simples das plataformas do sistema.
   *
   * As plataformas mudam pouco, então não precisamos buscar todas a cada
   * recarregamento do dashboard.
   */
  const allDashboardPlatformsCacheRef = useRef<any[] | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (dashboardRefreshTimeoutRef.current) {
        clearTimeout(dashboardRefreshTimeoutRef.current);
      }

      if (goalRefreshTimeoutRef.current) {
        clearTimeout(goalRefreshTimeoutRef.current);
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard({
        useGlobalLoader: true,
      });
    }, [period, referenceDate]),
  );

  useEffect(() => {
    if (period !== "year") return;

    setYearChartSemester(referenceDate.getMonth() < 6 ? "first" : "second");
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
          () => {
            scheduleGoalRefresh();
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
      scheduleGoalRefresh();
    }, GOAL_MODAL_FALLBACK_REFRESH_MS);

    return () => clearInterval(interval);
  }, [goalModalVisible, period, referenceDate]);

  useEffect(() => {
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
    let componentMounted = true;

    async function subscribeToDashboardChanges() {
      const {
        data: { user: loggedUser },
      } = await supabase.auth.getUser();

      if (!loggedUser?.id || !componentMounted) return;

      // Mantém o dashboard sincronizado quando despesas, ganhos ou jornadas mudarem.
      // Assim, ao adicionar, editar ou excluir uma despesa, os cards do dashboard atualizam.
      realtimeChannel = supabase
        .channel(`dashboard-data-sync-${loggedUser.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "expenses",
            filter: `user_id=eq.${loggedUser.id}`,
          },
          () => {
            scheduleDashboardRefresh();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "earnings",
            filter: `user_id=eq.${loggedUser.id}`,
          },
          () => {
            scheduleDashboardRefresh();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "work_sessions",
            filter: `user_id=eq.${loggedUser.id}`,
          },
          () => {
            scheduleDashboardRefresh();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${loggedUser.id}`,
          },
          async () => {
            await Promise.all([
              loadProfileAvatar(loggedUser.id),
              loadAdminStatus(loggedUser.id),
            ]);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_performance_targets",
            filter: `user_id=eq.${loggedUser.id}`,
          },
          async () => {
            await loadPerformanceTargets(loggedUser.id);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_subscriptions",
            filter: `user_id=eq.${loggedUser.id}`,
          },
          async () => {
            await loadSubscriptionAccess();
          },
        )
        .subscribe();
    }

    subscribeToDashboardChanges();

    return () => {
      componentMounted = false;

      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [period, referenceDate]);


  async function loadSubscriptionAccess() {
    try {
      const { data: response, error } = await (supabase as any).rpc(
        "get_my_subscription_access",
      );

      if (error) throw error;

      const access = Array.isArray(response) ? response[0] : response;

      setSubscriptionAccess(access ?? null);
    } catch (error) {
      console.log("Erro ao carregar alerta de assinatura:", error);
      setSubscriptionAccess(null);
    }
  }

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

  async function loadProfileAvatar(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      setProfileAvatarUrl(data?.avatar_url ?? null);
    } catch (error) {
      console.log("Erro ao carregar foto do perfil:", error);
      setProfileAvatarUrl(null);
    }
  }

  async function loadAdminStatus(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      setIsSystemAdmin(Boolean(data?.is_admin));
    } catch (error) {
      console.log("Erro ao verificar admin:", error);
      setIsSystemAdmin(false);
    }
  }

  async function loadPerformanceTargets(userId: string) {
    try {
      const { data, error } = await supabase
        .from("user_performance_targets")
        .select(
          "bad_gain_per_hour, good_gain_per_hour, bad_gain_per_km, good_gain_per_km",
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      setPerformanceTargets(data ?? null);
    } catch (error) {
      console.log("Erro ao carregar parâmetros de desempenho:", error);
      setPerformanceTargets(null);
    }
  }

  async function loadEarningsPerformanceSummary() {
    try {
      const response = await getEarningsPerformanceAnalysis();
      setEarningsPerformanceSummary(response);
    } catch (error) {
      console.log("Erro ao carregar resumo de desempenho dos ganhos:", error);
      setEarningsPerformanceSummary(null);
    }
  }

  /**
   * Carrega plataformas do sistema e plataformas escolhidas pelo usuário.
   *
   * Otimização:
   * - as plataformas gerais são mantidas em cache;
   * - apenas as plataformas do usuário são recarregadas com frequência;
   * - isso reduz chamadas ao Supabase em recargas do dashboard e realtime.
   */
  async function loadDashboardPlatforms(options: { force?: boolean } = {}) {
    try {
      const allPlatformsPromise =
        !options.force && allDashboardPlatformsCacheRef.current
          ? Promise.resolve(allDashboardPlatformsCacheRef.current)
          : getPlatforms();

      const [allPlatforms, selectedPlatforms] = await Promise.all([
        allPlatformsPromise,
        getUserPlatforms(),
      ]);

      const normalizedAllPlatforms = allPlatforms ?? [];

      allDashboardPlatformsCacheRef.current = normalizedAllPlatforms;

      setAllDashboardPlatforms(normalizedAllPlatforms);
      setSelectedPlatformIds(
        (selectedPlatforms ?? []).map((item: any) => item.platform_id),
      );

      // No modal de editar entrada, mostramos somente as plataformas escolhidas pelo usuário.
      setDashboardPlatforms(
        (selectedPlatforms ?? [])
          .map((item: any) => item.platform)
          .filter(Boolean),
      );
    } catch (error) {
      console.log("Erro ao carregar plataformas do usuário no dashboard:", error);
      setDashboardPlatforms([]);
      setAllDashboardPlatforms([]);
      setSelectedPlatformIds([]);
    }
  }

  async function openPlatformDrawerFromEntryModal() {
    setReturnToEntryModalAfterPlatforms(true);
    setEntryModalVisible(false);

    await loadDashboardPlatforms();

    setTimeout(() => {
      setPlatformDrawerVisible(true);
    }, 350);
  }

  function closePlatformDrawerAndReturn() {
    const shouldReturn = returnToEntryModalAfterPlatforms;

    setPlatformDrawerVisible(false);
    setReturnToEntryModalAfterPlatforms(false);

    setTimeout(() => {
      if (shouldReturn && editingEntry?.id) {
        setEntryModalVisible(true);
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
      await Promise.all(
        allDashboardPlatforms.map((platform) => {
          const selected = selectedPlatformIds.includes(platform.id);

          return toggleUserPlatform(platform.id, selected);
        }),
      );

      await loadDashboardPlatforms({ force: true });
      closePlatformDrawerAndReturn();
    } catch (error) {
      console.log("Erro ao salvar plataformas do usuário:", error);
      Alert.alert("Erro", "Não foi possível salvar suas plataformas.");
    }
  }

  /**
   * Carrega os ganhos avulsos do período.
   *
   * Otimização:
   * - aceita userId opcional para evitar uma chamada extra ao auth.getUser
   *   quando o usuário já foi carregado pelo getDashboardData.
   */
  async function loadPeriodEntries(
    startDate?: string | Date,
    endDate?: string | Date,
    userId?: string,
  ) {
    try {
      if (!startDate || !endDate) {
        setPeriodEntries([]);
        setPeriodEntriesReady(true);
        return;
      }

      let loggedUserId = userId;

      if (!loggedUserId) {
        const {
          data: { user: loggedUser },
        } = await supabase.auth.getUser();

        loggedUserId = loggedUser?.id;
      }

      if (!loggedUserId) {
        setPeriodEntries([]);
        setPeriodEntriesReady(true);
        return;
      }

      const start = toLocalISOString(new Date(startDate));
      const end = toLocalISOString(new Date(endDate));

      /*
        Outros ganhos devem mostrar somente ganhos avulsos,
        ou seja, ganhos que não estão vinculados a nenhuma jornada.
        Os ganhos de jornadas ficam dentro de Jornadas do dia e no detalhe do turno.
      */
      const { data: entriesResponse, error } = await supabase
        .from("earnings")
        .select("id, user_id, session_id, platform, description, amount, earning_date, created_at")
        .eq("user_id", loggedUserId)
        .is("session_id", null)
        .gte("earning_date", start)
        .lte("earning_date", end)
        .order("earning_date", { ascending: false });

      if (error) throw error;

      setPeriodEntries(entriesResponse ?? []);
      setPeriodEntriesReady(true);
    } catch (error) {
      console.log("Erro ao carregar outros ganhos:", error);
      setPeriodEntries([]);
      setPeriodEntriesReady(false);
    }
  }

  /**
   * Carrega despesas do período.
   *
   * Otimização:
   * - aceita userId opcional para evitar auth.getUser duplicado durante
   *   a carga principal do dashboard.
   */
  async function loadPeriodExpenses(
    startDate?: string | Date,
    endDate?: string | Date,
    userId?: string,
  ) {
    try {
      if (!startDate || !endDate) {
        setPeriodExpenses([]);
        return;
      }

      let loggedUserId = userId;

      if (!loggedUserId) {
        const {
          data: { user: loggedUser },
        } = await supabase.auth.getUser();

        loggedUserId = loggedUser?.id;
      }

      if (!loggedUserId) {
        setPeriodExpenses([]);
        return;
      }

      const start = toLocalISOString(new Date(startDate));
      const end = toLocalISOString(new Date(endDate));

      const { data: expensesResponse, error } = await supabase
        .from("expenses")
        .select("id, description, amount, category, expense_date, location, vehicle_id")
        .eq("user_id", loggedUserId)
        .gte("expense_date", start)
        .lte("expense_date", end)
        .order("expense_date", { ascending: false });

      if (error) throw error;

      setPeriodExpenses(expensesResponse ?? []);
    } catch (error) {
      console.log("Erro ao carregar despesas do período:", error);
      setPeriodExpenses([]);
    }
  }

  /**
   * Agenda uma recarga silenciosa do dashboard.
   *
   * Usado principalmente pelo Realtime do Supabase.
   *
   * Vantagem:
   * - se earnings, expenses e work_sessions mudarem quase ao mesmo tempo,
   *   o app faz apenas uma recarga após o debounce.
   */
  function scheduleDashboardRefresh() {
    if (dashboardRefreshTimeoutRef.current) {
      clearTimeout(dashboardRefreshTimeoutRef.current);
    }

    dashboardRefreshTimeoutRef.current = setTimeout(() => {
      loadDashboard({
        useGlobalLoader: false,
      });
    }, DASHBOARD_REFRESH_DEBOUNCE_MS);
  }

  /**
   * Agenda uma recarga leve da meta.
   */
  function scheduleGoalRefresh() {
    if (goalRefreshTimeoutRef.current) {
      clearTimeout(goalRefreshTimeoutRef.current);
    }

    goalRefreshTimeoutRef.current = setTimeout(() => {
      refreshDashboardGoal();
    }, GOAL_REFRESH_DEBOUNCE_MS);
  }

  /**
   * Carrega os dados principais do dashboard.
   *
   * Otimizações:
   * - evita execução simultânea;
   * - permite recarga silenciosa para eventos realtime;
   * - reaproveita o usuário retornado pelo getDashboardData para evitar
   *   auth.getUser duplicado em despesas e ganhos;
   * - carrega dados independentes em Promise.all.
   */
  async function loadDashboard(options: LoadDashboardOptions = {}) {
    const useGlobalLoader = options.useGlobalLoader ?? true;

    if (dashboardLoadingRef.current) {
      scheduleDashboardRefresh();
      return;
    }

    dashboardLoadingRef.current = true;

    const runner = async () => {
      try {
        const response = await getDashboardData(period, referenceDate);

        if (!mountedRef.current) return;

        setData(response);

        const loggedUser = response?.user ?? null;
        const loggedUserId = loggedUser?.id;

        setUser(loggedUser);

        await Promise.all([
          loadPeriodExpenses(response?.startDate, response?.endDate, loggedUserId),
          loadPeriodEntries(response?.startDate, response?.endDate, loggedUserId),
          loadDashboardPlatforms({ force: options.forcePlatformsRefresh }),
          loadEarningsPerformanceSummary(),
          loadSubscriptionAccess(),
        ]);

        if (loggedUserId) {
          await Promise.all([
            loadProfileAvatar(loggedUserId),
            loadAdminStatus(loggedUserId),
            loadPerformanceTargets(loggedUserId),
          ]);
        } else {
          setProfileAvatarUrl(null);
          setIsSystemAdmin(false);
          setPerformanceTargets(null);
        }

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
    };

    try {
      if (useGlobalLoader) {
        await withLoading(runner);
      } else {
        await runner();
      }
    } finally {
      dashboardLoadingRef.current = false;
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

  const dashboardRevenue = Number(data.revenue ?? 0);

  const dashboardExpenses = Number(data.expenses ?? 0);
  const dashboardProfit = dashboardRevenue - dashboardExpenses;

  const dashboardRevenuePerHour = Number(data.totalHours ?? 0) > 0
    ? dashboardRevenue / Number(data.totalHours)
    : 0;

  const dashboardRevenuePerKm = Number(data.totalKm ?? 0) > 0
    ? dashboardRevenue / Number(data.totalKm)
    : 0;

  const dashboardRevenuePerHourColor = getPerformanceMetricColor(
    dashboardRevenuePerHour,
    "hour",
  );

  const dashboardRevenuePerKmColor = getPerformanceMetricColor(
    dashboardRevenuePerKm,
    "km",
  );

  const expensesPercent =
    dashboardRevenue > 0
      ? Math.round((dashboardExpenses / dashboardRevenue) * 100)
      : 0;

  const profitPercent =
    dashboardRevenue > 0
      ? Math.round((dashboardProfit / dashboardRevenue) * 100)
      : 0;

  const avatarUrl =
    profileAvatarUrl ||
    user?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture;

  const headerGreeting = getDayGreeting();
  const headerFirstName = getUserFirstName(user);

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

  function formatSessionEditTime(value?: string | null) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function maskTimeInput(value: string) {
    const numbers = value.replace(/\D/g, "").slice(0, 4);

    if (numbers.length <= 2) return numbers;

    return `${numbers.slice(0, 2)}:${numbers.slice(2)}`;
  }

  function parseTimeInput(value: string) {
    const [hour, minute] = value.split(":").map(Number);

    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }

    return { hour, minute };
  }

  function buildSessionDateTime(baseValue: string | Date | null | undefined, timeValue: string) {
    const parsedTime = parseTimeInput(timeValue);

    if (!parsedTime) return null;

    const baseDate = baseValue ? new Date(baseValue) : new Date(referenceDate);

    if (Number.isNaN(baseDate.getTime())) return null;

    const date = new Date(baseDate);
    date.setHours(parsedTime.hour, parsedTime.minute, 0, 0);

    return date;
  }

  function maskSessionKmInput(value: string) {
    const numbers = value.replace(/\D/g, "").slice(0, 7);

    return numbers ? Number(numbers).toLocaleString("pt-BR") : "";
  }

  function parseSessionKmInput(value: string) {
    const numbers = value.replace(/\D/g, "");

    if (!numbers) return null;

    const parsed = Number(numbers);

    return Number.isFinite(parsed) ? parsed : null;
  }

  function clearSessionEditError(field: string) {
    setSessionEditErrors((current) => ({
      ...current,
      [field]: "",
    }));
  }

  function openSessionDetails(session: any) {
    setSelectedSession(session);
    setSessionDetailsModalVisible(true);
  }


  function formatCurrencyInput(value: number) {
    return Number(value ?? 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function maskCurrencyInput(value: string) {
    const numbers = value.replace(/\D/g, "").slice(0, 12);

    if (!numbers) return "";

    return (Number(numbers) / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function parseCurrencyInput(value: string) {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const amount = Number(normalized);

    return Number.isFinite(amount) ? amount : 0;
  }

  function maskEntryDateInput(value: string) {
    const numbers = value.replace(/\D/g, "").slice(0, 8);

    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;

    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4)}`;
  }

  function parseEntryDateInput(value: string) {
    const [day, month, year] = value.split("/").map(Number);

    if (!day || !month || !year) return null;

    const date = new Date(year, month - 1, day, 12, 0, 0, 0);

    const valid =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;

    return valid ? date : null;
  }

  function clearEntryError(field: string) {
    setEntryErrors((current) => ({
      ...current,
      [field]: "",
    }));
  }

  function getEntrySessionLabel(entry: any) {
    if (!entry?.session_id) return "Ganho avulso";

    const session = entry.session;

    if (!session) return "Entrada do turno";

    return `Turno ${formatSessionHour(session.started_at)} - ${formatSessionHour(session.finished_at)}`;
  }

  function getPlatformByName(platformName?: string | null) {
    if (!platformName) return null;

    const normalizedName = String(platformName).trim().toLowerCase();

    return (
      allDashboardPlatforms.find(
        (platform) => String(platform?.name ?? '').trim().toLowerCase() === normalizedName,
      ) ||
      dashboardPlatforms.find(
        (platform) => String(platform?.name ?? '').trim().toLowerCase() === normalizedName,
      ) ||
      null
    );
  }

  function getPlatformInitial(platformName?: string | null) {
    return String(platformName || '?').trim().slice(0, 1).toUpperCase() || '?';
  }

  function getPerformanceMetricColor(
    value: number,
    metric: "hour" | "km",
  ) {
    const bad = Number(
      metric === "hour"
        ? performanceTargets?.bad_gain_per_hour
        : performanceTargets?.bad_gain_per_km,
    );

    const good = Number(
      metric === "hour"
        ? performanceTargets?.good_gain_per_hour
        : performanceTargets?.good_gain_per_km,
    );

    if (Number(value ?? 0) <= 0 || !bad || !good || bad >= good) {
      return performanceColors.neutral;
    }

    if (value >= good) return performanceColors.good;
    if (value < bad) return performanceColors.bad;

    return performanceColors.medium;
  }

  function openEditEntryModal(entry: any) {
    loadDashboardPlatforms();

    setEditingEntry(entry);
    setEntryPlatform(entry.platform ?? "");
    setEntryDescription(entry.description ?? "");
    setEntryDate(formatDate(getEntryDate(entry)));
    setEntryAmount(formatCurrencyInput(Number(entry.amount ?? 0)));
    setEntryErrors({});
    setEntryModalVisible(true);
  }

  function validateEntryForm() {
    const errors: Record<string, string> = {};
    const parsedDate = parseEntryDateInput(entryDate);
    const amount = parseCurrencyInput(entryAmount);

    if (!entryPlatform) {
      errors.platform = "Selecione uma plataforma.";
    } else {
      const platformBelongsToUser = dashboardPlatforms.some(
        (platform) => platform?.name === entryPlatform,
      );

      if (!platformBelongsToUser) {
        errors.platform =
          "Essa plataforma não est - nas suas plataformas. Toque em Gerenciar para adicionar.";
      }
    }

    if (!parsedDate) {
      errors.date = "Informe uma data válida.";
    } else {
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (parsedDate > today) {
        errors.date = "A data não pode ser futura.";
      }
    }

    if (!entryAmount.trim()) {
      errors.amount = "Informe o valor.";
    } else if (amount <= 0) {
      errors.amount = "O valor precisa ser maior que zero.";
    }

    setEntryErrors(errors);

    return Object.keys(errors).length === 0;
  }

  async function syncSessionTotalEarnings(sessionId?: string | null) {
    try {
      if (!sessionId) return;

      const { data: sessionEarnings, error: earningsError } = await supabase
        .from("earnings")
        .select("amount")
        .eq("session_id", sessionId);

      if (earningsError) throw earningsError;

      const totalEarnings = (sessionEarnings ?? []).reduce(
        (total: number, earning: any) => total + Number(earning.amount ?? 0),
        0,
      );

      const { error: sessionError } = await supabase
        .from("work_sessions")
        .update({ total_earnings: totalEarnings })
        .eq("id", sessionId);

      if (sessionError) throw sessionError;
    } catch (error) {
      console.log("Erro ao sincronizar total da jornada:", error);
    }
  }

  async function handleSaveEntryEdit() {
    try {
      if (!editingEntry?.id) return;

      const valid = validateEntryForm();

      if (!valid) return;

      const parsedDate = parseEntryDateInput(entryDate);

      if (!parsedDate) return;

      setSavingEntry(true);

      const { error } = await supabase
        .from("earnings")
        .update({
          platform: entryPlatform,
          description: entryDescription.trim() || null,
          amount: parseCurrencyInput(entryAmount),
          earning_date: toLocalISOString(parsedDate),
        })
        .eq("id", editingEntry.id);

      if (error) throw error;

      await syncSessionTotalEarnings(editingEntry.session_id);

      setEntryModalVisible(false);
      setEditingEntry(null);

      await loadDashboard();
    } catch (error) {
      console.log("Erro ao editar entrada:", error);
      Alert.alert("Erro", "Não foi possível editar esta entrada.");
    } finally {
      setSavingEntry(false);
    }
  }

  function handleDeleteEntry(entry: any) {
    Alert.alert(
      "Excluir entrada",
      "Deseja realmente excluir esta entrada? Essa ação atualizar - os totais do período e da jornada em tempo real.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("earnings")
                .delete()
                .eq("id", entry.id);

              if (error) throw error;

              await syncSessionTotalEarnings(entry.session_id);

              await loadDashboard();
            } catch (error) {
              console.log("Erro ao excluir entrada:", error);
              Alert.alert("Erro", "Não foi possível excluir esta entrada.");
            }
          },
        },
      ],
    );
  }

  function clearExpenseError(field: string) {
    setExpenseErrors((current) => ({
      ...current,
      [field]: "",
    }));
  }

  function openEditExpenseModal(expense: any) {
    setEditingExpense(expense);
    setExpenseDescription(expense.description ?? "");
    setExpenseCategory(expense.category ?? "");
    setExpenseLocation(expense.location ?? "");
    setExpenseDate(formatDate(expense.expense_date));
    setExpenseAmount(formatCurrencyInput(Number(expense.amount ?? 0)));
    setExpenseErrors({});
    setExpenseEditModalVisible(true);
  }

  function closeExpenseEditModal() {
    setExpenseEditModalVisible(false);
    setEditingExpense(null);
    setExpenseDescription('');
    setExpenseCategory('');
    setExpenseLocation('');
    setExpenseDate(formatDate(new Date()));
    setExpenseAmount('');
    setExpenseErrors({});
  }

  function validateExpenseForm() {
    const errors: Record<string, string> = {};
    const parsedDate = parseEntryDateInput(expenseDate);
    const amount = parseCurrencyInput(expenseAmount);

    if (!expenseCategory.trim()) {
      errors.category = "Informe a categoria.";
    }

    if (!parsedDate) {
      errors.date = "Informe uma data válida.";
    } else {
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (parsedDate > today) {
        errors.date = "A data não pode ser futura.";
      }
    }

    if (!expenseAmount.trim()) {
      errors.amount = "Informe o valor.";
    } else if (amount <= 0) {
      errors.amount = "O valor precisa ser maior que zero.";
    }

    setExpenseErrors(errors);

    return Object.keys(errors).length === 0;
  }

  async function handleSaveExpenseEdit() {
    try {
      if (!editingExpense?.id) return;

      const valid = validateExpenseForm();

      if (!valid) return;

      const parsedDate = parseEntryDateInput(expenseDate);

      if (!parsedDate) return;

      setSavingExpense(true);

      const {
        data: { user: loggedUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!loggedUser?.id) {
        throw new Error("Usuário não autenticado.");
      }

      const { error } = await supabase
        .from("expenses")
        .update({
          description: expenseDescription.trim() || null,
          category: expenseCategory.trim(),
          location: expenseLocation.trim() || null,
          amount: parseCurrencyInput(expenseAmount),
          expense_date: toLocalISOString(parsedDate),
        })
        .eq("id", editingExpense.id)
        .eq("user_id", loggedUser.id);

      if (error) throw error;

      closeExpenseEditModal();
      await loadDashboard();
    } catch (error) {
      console.log("Erro ao editar despesa:", error);
      Alert.alert("Erro", "Não foi possível editar esta despesa.");
    } finally {
      setSavingExpense(false);
    }
  }

  function handleDeleteExpense(expense: any) {
    Alert.alert(
      "Excluir despesa",
      "Deseja realmente excluir esta despesa? O dashboard, lucro, despesas e percentuais serão atualizados automaticamente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              const {
                data: { user: loggedUser },
                error: userError,
              } = await supabase.auth.getUser();

              if (userError) throw userError;

              if (!loggedUser?.id) {
                throw new Error("Usuário não autenticado.");
              }

              const { error } = await supabase
                .from("expenses")
                .delete()
                .eq("id", expense.id)
                .eq("user_id", loggedUser.id);

              if (error) throw error;

              await loadDashboard();
            } catch (error) {
              console.log("Erro ao excluir despesa:", error);
              Alert.alert("Erro", "Não foi possível excluir esta despesa.");
            }
          },
        },
      ],
    );
  }


  async function refreshSessionDetailsAfterEarningChange(sessionId?: string | null) {
    await loadDashboard();

    if (!sessionId) return;

    try {
      const sessions = await getDayWorkSessions(referenceDate);

      setDaySessions(sessions);

      const updatedSession = sessions.find(
        (sessionItem: any) => sessionItem.id === sessionId,
      );

      if (updatedSession) {
        setSelectedSession(updatedSession);
      } else {
        setSelectedSession(null);
        setSessionDetailsModalVisible(false);
      }
    } catch (error) {
      console.log("Erro ao atualizar detalhes do turno:", error);
    }
  }

  async function openSessionEditModal() {
    if (!selectedSession?.id) return;

    try {
      setSessionEditErrors({});
      setSavingSessionEdit(false);

      const { data: sessionResponse, error } = await supabase
        .from("work_sessions")
        .select("id, started_at, finished_at, start_km, end_km")
        .eq("id", selectedSession.id)
        .maybeSingle();

      if (error) throw error;

      const sessionData = sessionResponse ?? selectedSession;

      setSessionEditStartTime(formatSessionEditTime(sessionData.started_at));
      setSessionEditEndTime(formatSessionEditTime(sessionData.finished_at));
      setSessionEditStartKm(
        sessionData.start_km != null
          ? maskSessionKmInput(String(sessionData.start_km))
          : "",
      );
      setSessionEditEndKm(
        sessionData.end_km != null
          ? maskSessionKmInput(String(sessionData.end_km))
          : "",
      );

      setSessionDetailsModalVisible(false);

      setTimeout(() => {
        setSessionEditModalVisible(true);
      }, 260);
    } catch (error) {
      console.log("Erro ao carregar dados do turno para edição:", error);
      Alert.alert("Erro", "Não foi possível carregar os dados deste turno.");
    }
  }

  function closeSessionEditModal() {
    setSessionEditModalVisible(false);
    setSessionEditStartTime('');
    setSessionEditEndTime('');
    setSessionEditStartKm('');
    setSessionEditEndKm('');
    setSessionEditErrors({});
    setSavingSessionEdit(false);

    if (selectedSession?.id) {
      setTimeout(() => {
        setSessionDetailsModalVisible(true);
      }, 260);
    }
  }

  function validateSessionEditForm() {
    const errors: Record<string, string> = {};

    const startedAt = buildSessionDateTime(
      selectedSession?.started_at ?? referenceDate,
      sessionEditStartTime,
    );

    const finishedAt = buildSessionDateTime(
      selectedSession?.finished_at ?? selectedSession?.started_at ?? referenceDate,
      sessionEditEndTime,
    );

    const startKm = parseSessionKmInput(sessionEditStartKm);
    const endKm = parseSessionKmInput(sessionEditEndKm);

    if (!startedAt) {
      errors.startTime = "Informe uma hora inicial válida.";
    }

    if (!finishedAt) {
      errors.endTime = "Informe uma hora final válida.";
    }

    if (startedAt && finishedAt && finishedAt <= startedAt) {
      errors.endTime = "A hora final precisa ser maior que a hora inicial.";
    }

    if (startKm === null) {
      errors.startKm = "Informe o KM inicial.";
    }

    if (endKm === null) {
      errors.endKm = "Informe o KM final.";
    }

    if (startKm !== null && endKm !== null && endKm < startKm) {
      errors.endKm = "O KM final não pode ser menor que o KM inicial.";
    }

    setSessionEditErrors(errors);

    if (Object.keys(errors).length > 0 || !startedAt || !finishedAt || startKm === null || endKm === null) {
      return null;
    }

    return {
      startedAt,
      finishedAt,
      startKm,
      endKm,
    };
  }

  async function handleSaveSessionEdit() {
    try {
      if (!selectedSession?.id) return;

      const validated = validateSessionEditForm();

      if (!validated) return;

      const sessionId = selectedSession.id;

      setSavingSessionEdit(true);

      const { error } = await supabase
        .from("work_sessions")
        .update({
          started_at: toLocalISOString(validated.startedAt),
          finished_at: toLocalISOString(validated.finishedAt),
          start_km: validated.startKm,
          end_km: validated.endKm,
        })
        .eq("id", sessionId);

      if (error) throw error;

      setSessionEditModalVisible(false);
      setSessionEditStartTime('');
      setSessionEditEndTime('');
      setSessionEditStartKm('');
      setSessionEditEndKm('');
      setSessionEditErrors({});

      await refreshSessionDetailsAfterEarningChange(sessionId);

      setTimeout(() => {
        setSessionDetailsModalVisible(true);
      }, 260);
    } catch (error) {
      console.log("Erro ao editar turno:", error);
      Alert.alert("Erro", "Não foi possível editar este turno.");
    } finally {
      setSavingSessionEdit(false);
    }
  }

  function openSessionEarningEditModal(earning: any) {
    setEditingSessionEarning(earning);
    setSessionEarningAmount(formatCurrencyInput(Number(earning.amount ?? 0)));
    setSessionEarningErrors({});
    setReturnToSessionDetailsAfterEarningEdit(true);

    // Evita problema de toque/modal empilhado no Android/iOS.
    // Fechamos o detalhe do turno e abrimos o modal de edição logo em seguida.
    setSessionDetailsModalVisible(false);

    setTimeout(() => {
      setSessionEarningEditModalVisible(true);
    }, 320);
  }

  function closeSessionEarningEditModal() {
    setSessionEarningEditModalVisible(false);
    setEditingSessionEarning(null);
    setSessionEarningAmount('');
    setSessionEarningErrors({});

    if (returnToSessionDetailsAfterEarningEdit && selectedSession?.id) {
      setTimeout(() => {
        setSessionDetailsModalVisible(true);
      }, 260);
    }
  }

  function validateSessionEarningForm() {
    const errors: Record<string, string> = {};
    const amount = parseCurrencyInput(sessionEarningAmount);

    if (!sessionEarningAmount.trim()) {
      errors.amount = "Informe o valor.";
    } else if (amount <= 0) {
      errors.amount = "O valor precisa ser maior que zero.";
    }

    setSessionEarningErrors(errors);

    return Object.keys(errors).length === 0;
  }

  async function handleSaveSessionEarningEdit() {
    try {
      if (!editingSessionEarning?.id || !selectedSession?.id) return;

      const valid = validateSessionEarningForm();

      if (!valid) return;

      const sessionId = selectedSession.id;

      setSavingSessionEarning(true);

      const { error } = await supabase
        .from("earnings")
        .update({
          amount: parseCurrencyInput(sessionEarningAmount),
        })
        .eq("id", editingSessionEarning.id)
        .eq("session_id", sessionId);

      if (error) throw error;

      await syncSessionTotalEarnings(sessionId);

      setSessionEarningEditModalVisible(false);
      setEditingSessionEarning(null);
      setSessionEarningAmount('');
      setSessionEarningErrors({});
      setReturnToSessionDetailsAfterEarningEdit(false);

      await refreshSessionDetailsAfterEarningChange(sessionId);

      setTimeout(() => {
        setSessionDetailsModalVisible(true);
      }, 260);
    } catch (error) {
      console.log("Erro ao editar ganho do turno:", error);
      Alert.alert("Erro", "Não foi possível editar este ganho.");
    } finally {
      setSavingSessionEarning(false);
    }
  }

  function handleDeleteSessionEarning(earning: any) {
    Alert.alert(
      "Excluir ganho do turno",
      "Deseja realmente excluir este ganho? O dashboard, os detalhes do turno e os totais serão atualizados.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              const sessionId = selectedSession?.id;

              const { error } = await supabase
                .from("earnings")
                .delete()
                .eq("id", earning.id);

              if (error) throw error;

              await syncSessionTotalEarnings(sessionId);
              await refreshSessionDetailsAfterEarningChange(sessionId);
            } catch (error) {
              console.log("Erro ao excluir ganho do turno:", error);
              Alert.alert("Erro", "Não foi possível excluir este ganho.");
            }
          },
        },
      ],
    );
  }

  function handleDeleteDaySession(session: any) {
    Alert.alert(
      "Excluir turno",
      "Deseja realmente excluir este turno? Todos os ganhos e corridas vinculados a ele serão removidos e o dashboard será atualizado.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir turno",
          style: "destructive",
          onPress: async () => {
            try {
              if (!session?.id) return;

              const sessionId = session.id;

              // Removemos os dados vinculados primeiro para evitar erro de chave estrangeira.
              const { error: ridesError } = await supabase
                .from("rides")
                .delete()
                .eq("session_id", sessionId);

              if (ridesError) throw ridesError;

              const { error: earningsError } = await supabase
                .from("earnings")
                .delete()
                .eq("session_id", sessionId);

              if (earningsError) throw earningsError;

              const { error: sessionError } = await supabase
                .from("work_sessions")
                .delete()
                .eq("id", sessionId);

              if (sessionError) throw sessionError;

              setSessionDetailsModalVisible(false);
              setSelectedSession(null);

              await loadDashboard();
            } catch (error) {
              console.log("Erro ao excluir turno:", error);
              Alert.alert("Erro", "Não foi possível excluir este turno.");
            }
          },
        },
      ],
    );
  }

  const isLightMode = themeMode === "light";

  const theme = {
    background: isLightMode ? "#F8FAFC" : "#050505",
    card: isLightMode ? "#FFFFFF" : "#18171D",
    cardStrong: isLightMode ? "#F1F5F9" : "#101014",
    border: isLightMode ? "#E2E8F0" : "#2A2830",
    text: isLightMode ? "#0F172A" : "#F5F0E6",
    muted: isLightMode ? "#64748B" : "#9B969B",
  };

  const goalPeriodInfo = getGoalPeriodFromDashboard(period, referenceDate);
  const goalTargetAmount = Number(currentGoal?.target_amount ?? 0);
  const goalCurrentAmount = dashboardRevenue;
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

  function getExpenseSectionTitle() {
    if (period === "day") return "Despesas do dia";
    if (period === "week") return "Despesas da semana";
    if (period === "month") return "Despesas do mês";

    return "Despesas do ano";
  }

  function getExpenseSectionSubtitle() {
    if (period === "day") return "Gastos registrados no dia selecionado";
    if (period === "week") return "Gastos registrados na semana selecionada";
    if (period === "month") return "Gastos registrados no mês selecionado";

    return "Gastos registrados no ano selecionado";
  }

  const platformTotals = data.platformTotals ?? {};

  const pieData = Object.entries(platformTotals)
    .filter(([_, value]) => Number(value) > 0)
    .map(([platform, value]: any, index) => {
      const platformInfo = getPlatformByName(platform);

      return {
        value: Number(value),
        text: `${dashboardRevenue > 0 ? ((Number(value) / dashboardRevenue) * 100).toFixed(0) : 0}%`,
        color: getPlatformChartColor(platform),
        label: platform,
        logo_url: shouldForcePlatformFallbackIcon(platform)
          ? null
          : platformInfo?.logo_url ?? null,
        fallbackIcon: getPlatformFallbackIcon(platform),
        iconColor: getPlatformIconContrastColor(platform),
      };
    });

  const dashboardChartEntries = [
    ...(data?.sessionEarnings ?? []),
    ...(data?.standaloneEarnings ?? []),
  ];

  const rawBarChartData =
    dashboardChartEntries.length > 0
      ? period === "week"
        ? buildWeekEntriesBarChartData(dashboardChartEntries, referenceDate)
        : period === "month"
          ? buildMonthEntriesBarChartData(dashboardChartEntries, referenceDate)
          : period === "year"
            ? buildYearEntriesBarChartData(dashboardChartEntries, referenceDate)
            : data?.barChartData ?? []
      : data?.barChartData ?? [];

  const yearChartStartIndex = yearChartSemester === "first" ? 0 : 6;
  const yearChartEndIndex = yearChartSemester === "first" ? 6 : 12;
  const yearChartSemesterLabel =
    yearChartSemester === "first" ? "Jan a Jun" : "Jul a Dez";

  const barChartData =
    period === "month"
      ? buildMonthWeeksBarChartData(rawBarChartData, referenceDate)
      : period === "year"
        ? rawBarChartData.slice(yearChartStartIndex, yearChartEndIndex)
        : rawBarChartData;

  const entryPlatformOptions = dashboardPlatforms;

  const maxBarValue = Math.max(
    ...barChartData.map((item: any) => item.value),
    1,
  );

  /*
    No card Lucro x despesas, as barras devem representar a participação
    de cada valor em relação ao faturamento total do período.

    Exemplo:
    Faturamento: R$ 1.000,00
    Lucro: R$ 600,00 -> barra com 60%
    Despesas: R$ 400,00 -> barra com 40%

    Antes a base era o maior valor entre lucro e despesas, por isso o lucro
    podia ocupar 100% da barra mesmo representando menos que 100% do faturamento.
  */
  const profitExpenseComparisonBase = Number(dashboardRevenue ?? 0);

  const profitComparisonWidth =
    profitExpenseComparisonBase > 0
      ? Math.min(
          (Math.abs(dashboardProfit) / profitExpenseComparisonBase) * 100,
          100,
        )
      : 0;

  const expensesComparisonWidth =
    profitExpenseComparisonBase > 0
      ? Math.min(
          (dashboardExpenses / profitExpenseComparisonBase) * 100,
          100,
        )
      : 0;
  const profitComparisonLabel =
    dashboardProfit >= 0 ? "Lucro líquido" : "Prejuízo";

  const dashboardPerformanceScoreInfo =
    getDashboardPerformanceScoreInfo(earningsPerformanceSummary);

  const subscriptionBannerInfo =
    getDashboardSubscriptionBannerInfo(subscriptionAccess);

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.modernContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[2]}
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
              <Text style={[styles.modernGreeting,]}>
                PAINEL OPERACIONAL
              </Text>
              <Text style={[styles.modernTitle, { color: theme.text }]} numberOfLines={1}>
                {headerGreeting}, {headerFirstName}
              </Text>
            </View>
          </View>

          <View style={styles.modernHeaderActions}>
            <NotificationBell />

            <TouchableOpacity
              activeOpacity={0.86}
              style={[
                styles.modernHeaderIconButton,
                styles.modernHeaderMenuButton,
              ]}
              onPress={() => setHeaderMenuVisible(true)}
            >
              <Ionicons name="menu-outline" size={26} color="#D4A64A" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.subscriptionBannerSlot}>
          {subscriptionBannerInfo ? (
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.subscriptionBanner,
                subscriptionBannerInfo.variant === "danger"
                  ? styles.subscriptionBannerDanger
                  : styles.subscriptionBannerWarning,
              ]}
              onPress={() =>
                router.push("/(private)/(tabs)/configuracoes?aba=assinaturas" as never)
              }
            >
              <View
                style={[
                  styles.subscriptionBannerIcon,
                  subscriptionBannerInfo.variant === "danger"
                    ? styles.subscriptionBannerIconDanger
                    : styles.subscriptionBannerIconWarning,
                ]}
              >
                <Ionicons
                  name={subscriptionBannerInfo.icon}
                  size={23}
                  color={
                    subscriptionBannerInfo.variant === "danger"
                      ? "#FCA5A5"
                      : "#D4A64A"
                  }
                />
              </View>

              <View style={styles.subscriptionBannerContent}>
                <Text style={styles.subscriptionBannerTitle}>
                  {subscriptionBannerInfo.title}
                </Text>
                <Text style={styles.subscriptionBannerText}>
                  {subscriptionBannerInfo.message}
                </Text>

                <View style={styles.subscriptionBannerAction}>
                  <Text
                    style={[
                      styles.subscriptionBannerActionText,
                      subscriptionBannerInfo.variant === "danger"
                        ? styles.subscriptionBannerActionTextDanger
                        : styles.subscriptionBannerActionTextWarning,
                    ]}
                  >
                    {subscriptionBannerInfo.buttonText}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={
                      subscriptionBannerInfo.variant === "danger"
                        ? "#FCA5A5"
                        : "#D4A64A"
                    }
                  />
                </View>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.stickyPeriodHeader}>
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
            <Ionicons name="chevron-back" size={24} color="#D4A64A" />
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
              Toque para trocar o período
            </Text>
          </TouchableOpacity>

            <TouchableOpacity
              style={styles.modernPeriodArrow}
              onPress={() => changePeriod("next")}
            >
              <Ionicons name="chevron-forward" size={24} color="#D4A64A" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.modernHeroCard}>
          <View style={{paddingTop: 0, paddingLeft: 5, paddingRight: 5}}>
            <View style={styles.modernHeroTopRow}>
              <View style={styles.modernHeroBadge}>
                <Ionicons name="trending-up-outline" size={16} color="#D4A64A" />
                <Text style={styles.modernHeroBadgeText}>Resultado operacional</Text>
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
              R$ {formatCurrency(dashboardProfit)}
            </Text>
            <Text style={styles.modernHeroSub}>
              {formatDecimal(profitPercent)}% do faturamento ficou como lucro
            </Text>
          </View>

          <View style={styles.modernHeroMiniGrid}>
            <View style={styles.modernHeroMiniCard}>
              <View style={{flexDirection: 'row', gap: 5}}>
                <View style={styles.modernMiniIconBlue}>
                  <Ionicons name="cash-outline" size={18} color="#D4A64A" />
                </View>
                <Text style={styles.modernHeroMiniLabel}>Faturamento</Text>
              </View>
              <Text style={styles.modernHeroMiniValue}>
                R$ {formatCurrency(dashboardRevenue)}
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
                <Ionicons name="time-outline" size={20} color="#D4A64A" />
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
                <Ionicons name="speedometer-outline" size={20} color="#D4A64A" />
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
                <Ionicons name="analytics-outline" size={20} color="#D4A64A" />
              </View>
              <Text style={[styles.modernStatLabel, { color: theme.muted }]}>
                Ganho/h
              </Text>
            </View>
            <Text
              style={[
                styles.modernStatValue,
                { color: dashboardRevenuePerHourColor },
              ]}
            >
              R$ {formatPerformanceDecimal(dashboardRevenuePerHour)}
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
            <Text
              style={[
                styles.modernStatValue,
                { color: dashboardRevenuePerKmColor },
              ]}
            >
              R$ {formatPerformanceDecimal(dashboardRevenuePerKm)}
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
          <View style={styles.daySessionsCard}>
            <View style={styles.daySessionsHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modernSectionTitle, styles.daySessionsTitle]}>Jornadas do dia</Text>
                <Text style={styles.daySessionsSubtitle}>
                  Turnos finalizados no período selecionado
                </Text>
              </View>

              <View style={styles.daySessionsCountBadge}>
                <Text style={styles.daySessionsCountText}>{daySessions.length}</Text>
              </View>
            </View>

            {daySessions.length === 0 ? (
              <View style={styles.periodEntriesEmptyBox}>
                <Ionicons name="briefcase-outline" size={28} color="#71717A" />
                <Text style={styles.periodEntriesEmptyTitle}>
                  Nenhuma jornada neste dia
                </Text>
                <Text style={styles.periodEntriesEmptyText}>
                  As jornadas finalizadas aparecerão aqui com faturamento, tempo e KM.
                </Text>
              </View>
            ) : (
              daySessions.map((session) => (
                <View key={session.id} style={styles.daySessionItem}>
                  <View style={styles.daySessionTop}>
                    <View style={styles.daySessionIcon}>
                      <Ionicons
                        name="briefcase-outline"
                        size={20}
                        color="#D4A64A"
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.daySessionTitle}>
                        {formatSessionHour(session.started_at)} - {" "}
                        {formatSessionHour(session.finished_at)}
                      </Text>
                      <Text style={styles.daySessionSubtitle} numberOfLines={1}>
                        {session.vehicle?.model ?? "Veículo"}
                        {session.vehicle?.plate ? `  - ${session.vehicle.plate}` : ""}
                      </Text>
                    </View>

                    <View style={styles.daySessionRevenueBox}>
                      <Text style={styles.daySessionRevenueLabel}>Faturamento</Text>
                      <Text style={styles.daySessionRevenue}>
                        R$ {formatCurrency(session.totalEarnings)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.daySessionStatsGrid}>
                    <View style={styles.daySessionStatBox}>
                      <View style={styles.daySessionStatHeader}>
                        <Ionicons name="time-outline" size={15} color="#60A5FA" />
                        <Text style={styles.daySessionStatLabel}>Tempo</Text>
                      </View>
                      <Text style={styles.daySessionStatValue}>
                        {formatHours(session.totalHours)}
                      </Text>
                    </View>

                    <View style={styles.daySessionStatBox}>
                      <View style={styles.daySessionStatHeader}>
                        <Ionicons name="speedometer-outline" size={15} color="#F59E0B" />
                        <Text style={styles.daySessionStatLabel}>KM rodado</Text>
                      </View>
                      <Text style={styles.daySessionStatValue}>
                        {formatNumber(session.totalKm)} km
                      </Text>
                    </View>

                    <View style={styles.daySessionStatBox}>
                      <View style={styles.daySessionStatHeader}>
                        <Ionicons name="analytics-outline" size={15} color="#D4A64A" />
                        <Text style={styles.daySessionStatLabel}>Ganho/h</Text>
                      </View>
                      <Text
                        style={[
                          styles.daySessionStatValue,
                          {
                            color: getPerformanceMetricColor(
                              Number(session.revenuePerHour ?? 0),
                              "hour",
                            ),
                          },
                        ]}
                      >
                        R$ {formatPerformanceDecimal(session.revenuePerHour)}
                      </Text>
                    </View>

                    <View style={styles.daySessionStatBox}>
                      <View style={styles.daySessionStatHeader}>
                        <Ionicons name="navigate-outline" size={15} color="#A78BFA" />
                        <Text style={styles.daySessionStatLabel}>Ganho/km</Text>
                      </View>
                      <Text
                        style={[
                          styles.daySessionStatValue,
                          {
                            color: getPerformanceMetricColor(
                              Number(session.revenuePerKm ?? 0),
                              "km",
                            ),
                          },
                        ]}
                      >
                        R$ {formatPerformanceDecimal(session.revenuePerKm)}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={styles.daySessionDetailsButton}
                    onPress={() => openSessionDetails(session)}
                  >
                    <Text style={styles.daySessionDetailsText}>
                      Ver detalhes do turno
                    </Text>
                    <Ionicons name="arrow-forward" size={17} color="#06130B" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {period === "day" && (
          <View
            style={[
              styles.modernEntriesListCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={styles.modernSectionHeader}>
              <View>
                <Text style={[styles.modernSectionTitle, { color: theme.text }]}> 
                  Outros ganhos
                </Text>
                <Text
                  style={[styles.modernSectionSubtitle, { color: theme.muted }]}
                >
                  Ganhos avulsos sem vínculo com jornada
                </Text>
              </View>

              <View style={styles.modernEntryCountBadge}>
                <Text style={styles.modernEntryCountText}>
                  {periodEntries.length}
                </Text>
              </View>
            </View>

            {periodEntries.length === 0 ? (
              <View style={styles.periodEntriesEmptyBox}>
                <Ionicons name="cash-outline" size={28} color="#71717A" />
                <Text style={styles.periodEntriesEmptyTitle}>
                  Nenhum outro ganho neste dia
                </Text>
                <Text style={styles.periodEntriesEmptyText}>
                  Ganhos avulsos sem vínculo com jornada aparecerão aqui.
                </Text>
              </View>
            ) : (
              periodEntries.map((entry) => (
                <View key={String(entry.id)} style={styles.periodEntryItem}>
                  <View
                    style={[
                      styles.periodEntryIcon,
                      {
                        backgroundColor: getPlatformChartColor(entry.platform),
                        borderColor: getPlatformChartColor(entry.platform),
                      },
                    ]}
                  >
                    {getPlatformByName(entry.platform)?.logo_url &&
                    !shouldForcePlatformFallbackIcon(entry.platform) ? (
                      <Image
                        source={{ uri: getPlatformByName(entry.platform)?.logo_url }}
                        style={styles.periodEntryPlatformLogo}
                      />
                    ) : (
                      <Ionicons
                        name={getPlatformFallbackIcon(entry.platform)}
                        size={21}
                        color={getPlatformIconContrastColor(entry.platform)}
                      />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.periodEntryTitle} numberOfLines={1}>
                      {entry.platform || "Plataforma"}
                    </Text>

                    <Text style={styles.periodEntryMeta} numberOfLines={1}>
                      {entry.description || "Ganho sem jornada"}
                    </Text>

                    <Text style={styles.periodEntryDate} numberOfLines={1}>
                      {formatDate(getEntryDate(entry))}
                    </Text>
                  </View>

                  <View style={styles.periodEntryRight}>
                    <Text style={styles.periodEntryValue}>
                      R$ {formatCurrency(Number(entry.amount ?? 0))}
                    </Text>

                    <View style={styles.periodEntryActions}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.periodEntryActionButton}
                        onPress={() => openEditEntryModal(entry)}
                      >
                        <Ionicons name="create-outline" size={17} color="#60A5FA" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.periodEntryActionButtonDanger}
                        onPress={() => handleDeleteEntry(entry)}
                      >
                        <Ionicons name="trash-outline" size={17} color="#F87171" />
                      </TouchableOpacity>
                    </View>
                  </View>
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
            <Ionicons name="pie-chart-outline" size={24} color="#D4A64A" />
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
                        R$ {formatCurrency(dashboardRevenue)}
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

                    {item.logo_url ? (
                      <Image
                        source={{ uri: item.logo_url }}
                        style={styles.pieLegendLogo}
                      />
                    ) : (
                      <View
                        style={[
                          styles.pieLegendLogoFallback,
                          { backgroundColor: item.color },
                        ]}
                      >
                        <Ionicons
                          name={item.fallbackIcon}
                          size={20}
                          color={item.iconColor}
                        />
                      </View>
                    )}

                    <View style={styles.pieLegendInfo}>
                      <Text style={styles.pieLegendName} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <Text style={styles.pieLegendValue}>
                        R$ {formatCurrency(item.value)}
                      </Text>
                    </View>

                    <View style={styles.pieLegendPercentPill}>
                      <Text style={styles.pieLegendPercent}>{item.text}</Text>
                    </View>
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
                  {period === "month"
                    ? "Semanas de segunda a domingo"
                    : period === "year"
                      ? `${yearChartSemesterLabel} do ano selecionado`
                      : "Comparativo do período selecionado"}
                </Text>
              </View>
              <Ionicons name="bar-chart-outline" size={24} color="#D4A64A" />
            </View>

            {period === "year" && (
              <View style={styles.yearChartToggleRow}>
                {yearChartSemester === "second" ? (
                  <TouchableOpacity
                    activeOpacity={0.86}
                    style={styles.yearChartArrowButton}
                    onPress={() => setYearChartSemester("first")}
                  >
                    <Ionicons name="chevron-back" size={20} color="#D4A64A" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.yearChartArrowPlaceholder} />
                )}

                <Text style={styles.yearChartToggleText}>
                  {yearChartSemesterLabel}
                </Text>

                {yearChartSemester === "first" ? (
                  <TouchableOpacity
                    activeOpacity={0.86}
                    style={styles.yearChartArrowButton}
                    onPress={() => setYearChartSemester("second")}
                  >
                    <Ionicons name="chevron-forward" size={20} color="#D4A64A" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.yearChartArrowPlaceholder} />
                )}
              </View>
            )}

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

        <View
          style={[
            styles.modernExpensesListCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.modernSectionHeader}>
            <View>
              <Text style={[styles.modernSectionTitle, { color: theme.text }]}>
                {getExpenseSectionTitle()}
              </Text>
              <Text
                style={[styles.modernSectionSubtitle, { color: theme.muted }]}
              >
                {getExpenseSectionSubtitle()}
              </Text>
            </View>

            <View style={styles.modernExpenseCountBadge}>
              <Text style={styles.modernExpenseCountText}>
                {periodExpenses.length}
              </Text>
            </View>
          </View>

          {periodExpenses.length === 0 ? (
            <View style={styles.periodExpensesEmptyBox}>
              <Ionicons name="receipt-outline" size={28} color="#71717A" />
              <Text style={styles.periodExpensesEmptyTitle}>
                Nenhuma despesa neste período
              </Text>
              <Text style={styles.periodExpensesEmptyText}>
                As despesas adicionadas para este período aparecerão aqui.
              </Text>
            </View>
          ) : (
            periodExpenses.map((expense) => (
              <View key={String(expense.id)} style={styles.periodExpenseItem}>
                <View style={styles.periodExpenseIcon}>
                  <Ionicons
                    name={getExpenseIcon(expense.category)}
                    size={21}
                    color="#FCA5A5"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.periodExpenseTitle} numberOfLines={1}>
                    {expense.description || "Despesa"}
                  </Text>

                  <Text style={styles.periodExpenseMeta} numberOfLines={1}>
                    {expense.category || "Sem categoria"} - {" "}
                    {formatDate(expense.expense_date)}
                  </Text>

                  {expense.location ? (
                    <Text style={styles.periodExpenseLocation} numberOfLines={1}>
                      {expense.location}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.periodExpenseRight}>
                  <Text style={styles.periodExpenseValue}>
                    - R$ {formatCurrency(Number(expense.amount ?? 0))}
                  </Text>

                  <View style={styles.periodExpenseActions}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.periodExpenseActionButton}
                      onPress={() => openEditExpenseModal(expense)}
                    >
                      <Ionicons name="create-outline" size={17} color="#60A5FA" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.periodExpenseActionButtonDanger}
                      onPress={() => handleDeleteExpense(expense)}
                    >
                      <Ionicons name="trash-outline" size={17} color="#F87171" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.periodExpensesManageButton}
            onPress={() => router.push("/(private)/(tabs)/despesas" as never)}
          >
            <Text style={styles.periodExpensesManageButtonText}>
              Gerenciar despesas
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#06130B" />
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.modernChartCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.modernSectionHeader}>
            <View>
              <Text style={[styles.modernSectionTitle, { color: theme.text }]}>
                Lucro x despesas
              </Text>
              <Text style={[styles.modernSectionSubtitle, { color: theme.muted }]}>
                Comparação do resultado financeiro no período
              </Text>
            </View>
            <Ionicons name="stats-chart-outline" size={24} color="#D4A64A" />
          </View>

          <View style={styles.profitExpenseChart}>
            <View style={styles.profitExpenseRow}>
              <View style={styles.profitExpenseRowHeader}>
                <View style={styles.profitExpenseLabelBox}>
                  <Ionicons
                    name={dashboardProfit >= 0 ? "trending-up-outline" : "trending-down-outline"}
                    size={18}
                    color={dashboardProfit >= 0 ? "#22C55E" : "#F87171"}
                  />
                  <Text style={styles.profitExpenseLabel}>
                    {profitComparisonLabel}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.profitExpenseValue,
                    dashboardProfit < 0 && styles.profitExpenseValueNegative,
                  ]}
                >
                  R$ {formatCurrency(Math.abs(dashboardProfit))}
                </Text>
              </View>

              <View style={styles.profitExpenseTrack}>
                <View
                  style={[
                    styles.profitExpenseFill,
                    dashboardProfit >= 0
                      ? styles.profitExpenseFillProfit
                      : styles.profitExpenseFillLoss,
                    { width: `${profitComparisonWidth}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.profitExpenseRow}>
              <View style={styles.profitExpenseRowHeader}>
                <View style={styles.profitExpenseLabelBox}>
                  <Ionicons name="wallet-outline" size={18} color="#F87171" />
                  <Text style={styles.profitExpenseLabel}>Despesas</Text>
                </View>

                <Text style={styles.profitExpenseValueRed}>
                  R$ {formatCurrency(dashboardExpenses)}
                </Text>
              </View>

              <View style={styles.profitExpenseTrack}>
                <View
                  style={[
                    styles.profitExpenseFill,
                    styles.profitExpenseFillExpenses,
                    { width: `${expensesComparisonWidth}%` },
                  ]}
                />
              </View>
            </View>
          </View>

          <View style={styles.profitExpenseSummary}>
            <Text style={styles.profitExpenseSummaryText}>
              Lucro: {formatDecimal(profitPercent)}% do faturamento
            </Text>
            <Text style={styles.profitExpenseSummaryText}>
              Despesas: {formatDecimal(expensesPercent)}% do faturamento
            </Text>
          </View>
        </View>
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
              currentAmount={dashboardRevenue}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={entryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEntryModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.entryEditOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.entryEditModal}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <View style={styles.entryEditHeader}>
                <View>
                  <Text style={styles.entryEditEyebrow}>
                    {editingEntry?.session_id ? "Entrada do turno" : "Ganho avulso"}
                  </Text>
                  <Text style={styles.entryEditTitle}>Editar entrada</Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setEntryModalVisible(false)}
                >
                  <Ionicons name="close" size={27} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.entryEditDescription}>
                Alterar ou excluir uma entrada atualiza os totais do dashboard e da jornada em tempo real.
              </Text>

              <View style={styles.entryPlatformHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryEditLabel}>Plataforma</Text>
                  <Text style={styles.entryPlatformHeaderHint}>
                    Somente plataformas selecionadas por você aparecem aqui.
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.86}
                  style={styles.entryManagePlatformsButton}
                  onPress={openPlatformDrawerFromEntryModal}
                >
                  <Ionicons name="apps-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.entryManagePlatformsButtonText}>
                    Gerenciar
                  </Text>
                </TouchableOpacity>
              </View>

              {entryErrors.platform ? (
                <Text style={styles.entryEditError}>{entryErrors.platform}</Text>
              ) : null}

              {entryPlatformOptions.length === 0 ? (
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.entryEmptyPlatformsBox}
                  onPress={openPlatformDrawerFromEntryModal}
                >
                  <Ionicons name="apps-outline" size={30} color="#71717A" />
                  <Text style={styles.entryEmptyPlatformsTitle}>
                    Nenhuma plataforma selecionada
                  </Text>
                  <Text style={styles.entryEmptyPlatformsText}>
                    Toque em Gerenciar para escolher quais plataformas aparecem aqui.
                  </Text>
                </TouchableOpacity>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.entryPlatformList}
                >
                  {entryPlatformOptions.map((platform: any) => {
                    const selected = entryPlatform === platform.name;

                    return (
                      <TouchableOpacity
                        key={platform.id ?? platform.name}
                        activeOpacity={0.86}
                        style={[
                          styles.entryPlatformChip,
                          selected && styles.entryPlatformChipActive,
                        ]}
                        onPress={() => {
                          setEntryPlatform(platform.name);
                          clearEntryError("platform");
                        }}
                      >
                        {platform.logo_url ? (
                          <Image
                            source={{ uri: platform.logo_url }}
                            style={styles.entryPlatformLogo}
                          />
                        ) : (
                          <View style={styles.entryPlatformLogoFallback}>
                            <Text style={styles.entryPlatformLogoText}>
                              {platform.name?.slice(0, 1) ?? "?"}
                            </Text>
                          </View>
                        )}

                        <Text
                          style={[
                            styles.entryPlatformChipText,
                            selected && styles.entryPlatformChipTextActive,
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

              <Text style={styles.entryEditLabel}>Descrição</Text>
              <TextInput
                value={entryDescription}
                onChangeText={setEntryDescription}
                placeholder="Ex: Promoção, bônus, corrida, entrega..."
                placeholderTextColor="#71717A"
                style={styles.entryEditInput}
              />

              <View style={styles.entryEditRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryEditLabel}>Data</Text>
                  <TextInput
                    value={entryDate}
                    onChangeText={(text) => {
                      setEntryDate(maskEntryDateInput(text));
                      clearEntryError("date");
                    }}
                    placeholder="dd/mm/aaaa"
                    placeholderTextColor="#71717A"
                    keyboardType="numeric"
                    maxLength={10}
                    style={[
                      styles.entryEditInput,
                      entryErrors.date && styles.entryEditInputError,
                    ]}
                  />
                  {entryErrors.date ? (
                    <Text style={styles.entryEditError}>{entryErrors.date}</Text>
                  ) : null}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.entryEditLabel}>Valor</Text>
                  <TextInput
                    value={entryAmount}
                    onChangeText={(text) => {
                      setEntryAmount(maskCurrencyInput(text));
                      clearEntryError("amount");
                    }}
                    placeholder="0,00"
                    placeholderTextColor="#71717A"
                    keyboardType="numeric"
                    style={[
                      styles.entryEditInput,
                      entryErrors.amount && styles.entryEditInputError,
                    ]}
                  />
                  {entryErrors.amount ? (
                    <Text style={styles.entryEditError}>{entryErrors.amount}</Text>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  styles.entryEditSaveButton,
                  savingEntry && styles.entryEditSaveButtonDisabled,
                ]}
                disabled={savingEntry}
                onPress={handleSaveEntryEdit}
              >
                {savingEntry ? (
                  <ActivityIndicator color="#06130B" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={21} color="#06130B" />
                    <Text style={styles.entryEditSaveButtonText}>
                      Salvar alterações
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={headerMenuVisible} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          style={styles.headerMenuOverlay}
          onPress={() => setHeaderMenuVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.headerMenuCard}>
            <View style={styles.headerMenuHeader}>
              <View>
                <Text style={styles.headerMenuEyebrow}>Menu rápido</Text>
                <Text style={styles.headerMenuTitle}>Atalhos do painel</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.headerMenuCloseButton}
                onPress={() => setHeaderMenuVisible(false)}
              >
                <Ionicons name="close" size={22} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.headerMenuItem}
              onPress={() => {
                setHeaderMenuVisible(false);
                router.push("/(private)/financeiro-pessoal" as never);
              }}
            >
              <View style={[styles.headerMenuItemIcon, styles.headerMenuItemIconGold]}>
                <Ionicons name="wallet-outline" size={21} color="#D4A64A" />
              </View>

              <View style={styles.headerMenuItemTextBox}>
                <Text style={styles.headerMenuItemTitle}>Financeiro pessoal</Text>
                <Text style={styles.headerMenuItemSubtitle}>Receitas, dívidas e saldo</Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#8F8A91" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.headerMenuItem}
              onPress={() => {
                setHeaderMenuVisible(false);
                router.push("/(private)/earnings-performance" as never);
              }}
            >
              <View
                style={[
                  styles.headerMenuItemIcon,
                  {
                    backgroundColor:
                      dashboardPerformanceScoreInfo?.backgroundColor ??
                      "rgba(155,150,155,0.12)",
                    borderColor:
                      dashboardPerformanceScoreInfo?.borderColor ??
                      "rgba(155,150,155,0.24)",
                  },
                ]}
              >
                <Ionicons
                  name={dashboardPerformanceScoreInfo?.icon ?? "analytics-outline"}
                  size={21}
                  color={dashboardPerformanceScoreInfo?.color ?? "#9B969B"}
                />
              </View>

              <View style={styles.headerMenuItemTextBox}>
                <Text style={styles.headerMenuItemTitle}>Desempenho</Text>
                <Text style={styles.headerMenuItemSubtitle}>Ganhos, metas e eficiência</Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#8F8A91" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.headerMenuItem}
              onPress={() => {
                setHeaderMenuVisible(false);
                router.push("/(private)/(tabs)/ibge-localidades" as never);
              }}
            >
              <View style={[styles.headerMenuItemIcon, styles.headerMenuItemIconGold]}>
                <Ionicons name="map-outline" size={21} color="#D4A64A" />
              </View>

              <View style={styles.headerMenuItemTextBox}>
                <Text style={styles.headerMenuItemTitle}>Filtro IBGE</Text>
                <Text style={styles.headerMenuItemSubtitle}>UF, regiões e municípios</Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#8F8A91" />
            </TouchableOpacity>

            {isSystemAdmin ? (
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.headerMenuItem}
                onPress={() => {
                  setHeaderMenuVisible(false);
                  router.push("/(private)/admin" as never);
                }}
              >
                <View style={[styles.headerMenuItemIcon, styles.headerMenuItemIconBlue]}>
                  <Ionicons name="shield-checkmark-outline" size={21} color="#60A5FA" />
                </View>

                <View style={styles.headerMenuItemTextBox}>
                  <Text style={styles.headerMenuItemTitle}>Administração</Text>
                  <Text style={styles.headerMenuItemSubtitle}>Área administrativa</Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color="#8F8A91" />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={platformDrawerVisible} transparent animationType="slide">
        <View style={styles.platformDrawerOverlay}>
          <View style={styles.platformDrawerContent}>
            <View style={styles.platformDrawerHandle} />

            <View style={styles.platformDrawerHeader}>
              <View>
                <Text style={styles.platformDrawerEyebrow}>Configuração</Text>
                <Text style={styles.platformDrawerTitle}>Minhas plataformas</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={closePlatformDrawerAndReturn}
              >
                <Ionicons name="close" size={27} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.platformDrawerDescription}>
              Escolha quais plataformas devem aparecer ao editar uma entrada do período.
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.platformDrawerList}
            >
              {allDashboardPlatforms.map((platform: any) => {
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
                            {platform.name?.slice(0, 1) ?? "?"}
                          </Text>
                        </View>
                      )}

                      <Text
                        style={[
                          styles.platformDrawerName,
                          selected && styles.platformDrawerNameActive,
                        ]}
                        numberOfLines={1}
                      >
                        {platform.name}
                      </Text>
                    </View>

                    <Ionicons
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={24}
                      color={selected ? "#D4A64A" : "#71717A"}
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
              <Text style={styles.savePlatformsButtonText}>
                Salvar plataformas
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={expenseEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeExpenseEditModal}
      >
        <KeyboardAvoidingView
          style={styles.entryEditOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.expenseEditModal}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <View style={styles.entryEditHeader}>
                <View>
                  <Text style={styles.entryEditEyebrow}>Despesa</Text>
                  <Text style={styles.entryEditTitle}>Editar despesa</Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={closeExpenseEditModal}
                >
                  <Ionicons name="close" size={27} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.entryEditDescription}>
                Alterar ou excluir uma despesa atualiza o dashboard, lucro e percentuais em tempo real.
              </Text>

              <Text style={styles.entryEditLabel}>Categoria</Text>
              {expenseErrors.category ? (
                <Text style={styles.entryEditError}>{expenseErrors.category}</Text>
              ) : null}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.expenseCategoryList}
              >
                {Object.keys(expenseCategoryIcons).map((category) => {
                  const selected = expenseCategory === category;

                  return (
                    <TouchableOpacity
                      key={category}
                      activeOpacity={0.86}
                      style={[
                        styles.expenseCategoryChip,
                        selected && styles.expenseCategoryChipActive,
                      ]}
                      onPress={() => {
                        setExpenseCategory(category);
                        clearExpenseError("category");
                      }}
                    >
                      <Ionicons
                        name={getExpenseIcon(category)}
                        size={18}
                        color={selected ? "#06130B" : "#FCA5A5"}
                      />
                      <Text
                        style={[
                          styles.expenseCategoryChipText,
                          selected && styles.expenseCategoryChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.entryEditLabel}>Descrição</Text>
              <TextInput
                value={expenseDescription}
                onChangeText={setExpenseDescription}
                placeholder="Ex: Combustível, revisão, lavagem..."
                placeholderTextColor="#71717A"
                style={styles.entryEditInput}
              />

              <Text style={styles.entryEditLabel}>Local</Text>
              <TextInput
                value={expenseLocation}
                onChangeText={setExpenseLocation}
                placeholder="Ex: Posto, oficina, estacionamento..."
                placeholderTextColor="#71717A"
                style={styles.entryEditInput}
              />

              <View style={styles.entryEditRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryEditLabel}>Data</Text>
                  <TextInput
                    value={expenseDate}
                    onChangeText={(text) => {
                      setExpenseDate(maskEntryDateInput(text));
                      clearExpenseError("date");
                    }}
                    placeholder="dd/mm/aaaa"
                    placeholderTextColor="#71717A"
                    keyboardType="numeric"
                    maxLength={10}
                    style={[
                      styles.entryEditInput,
                      expenseErrors.date && styles.entryEditInputError,
                    ]}
                  />
                  {expenseErrors.date ? (
                    <Text style={styles.entryEditError}>{expenseErrors.date}</Text>
                  ) : null}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.entryEditLabel}>Valor</Text>
                  <TextInput
                    value={expenseAmount}
                    onChangeText={(text) => {
                      setExpenseAmount(maskCurrencyInput(text));
                      clearExpenseError("amount");
                    }}
                    placeholder="0,00"
                    placeholderTextColor="#71717A"
                    keyboardType="numeric"
                    style={[
                      styles.entryEditInput,
                      expenseErrors.amount && styles.entryEditInputError,
                    ]}
                  />
                  {expenseErrors.amount ? (
                    <Text style={styles.entryEditError}>{expenseErrors.amount}</Text>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  styles.entryEditSaveButton,
                  savingExpense && styles.entryEditSaveButtonDisabled,
                ]}
                disabled={savingExpense}
                onPress={handleSaveExpenseEdit}
              >
                {savingExpense ? (
                  <ActivityIndicator color="#06130B" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={21} color="#06130B" />
                    <Text style={styles.entryEditSaveButtonText}>
                      Salvar despesa
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={sessionDetailsModalVisible}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sessionDetailsModal}>
            <View style={[styles.periodModalHeader, styles.sessionDetailsHeader]}>
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
                    {formatHours(selectedSession.totalHours)} trabalhados - {" "}
                    {formatNumber(selectedSession.totalKm)} km rodados
                  </Text>

                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={styles.editSessionButton}
                    onPress={openSessionEditModal}
                  >
                    <Ionicons name="create-outline" size={18} color="#BFDBFE" />
                    <Text style={styles.editSessionButtonText}>Editar turno</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.sessionDetailsSectionTitle}>
                  Ganhos por plataforma
                </Text>

                {selectedSession.earnings?.length ? (
                  selectedSession.earnings.map((earning: any) => {
                    const platform = getPlatformByName(earning.platform);

                    return (
                      <View key={earning.id} style={styles.sessionDetailRowModern}>
                        <View style={styles.sessionDetailPlatformLeft}>
                          {platform?.logo_url ? (
                            <Image
                              source={{ uri: platform.logo_url }}
                              style={styles.sessionDetailPlatformLogo}
                            />
                          ) : (
                            <View style={styles.sessionDetailPlatformLogoFallback}>
                              <Text style={styles.sessionDetailPlatformLogoText}>
                                {getPlatformInitial(earning.platform)}
                              </Text>
                            </View>
                          )}

                          <View style={{ flex: 1 }}>
                            <Text style={styles.sessionDetailName} numberOfLines={1}>
                              {earning.platform || "Plataforma"}
                            </Text>
                            <Text style={styles.sessionDetailCaption}>
                              Ganho do turno
                            </Text>
                          </View>
                        </View>

                        <View style={styles.sessionDetailRight}>
                          <Text style={styles.sessionDetailValue}>
                            R$ {formatCurrency(Number(earning.amount))}
                          </Text>

                          <View style={styles.sessionDetailActions}>
                            <TouchableOpacity
                              activeOpacity={0.86}
                              style={styles.sessionDetailActionButton}
                              onPress={() => openSessionEarningEditModal(earning)}
                            >
                              <Ionicons name="create-outline" size={17} color="#60A5FA" />
                            </TouchableOpacity>

                            <TouchableOpacity
                              activeOpacity={0.86}
                              style={styles.sessionDetailActionButtonDanger}
                              onPress={() => handleDeleteSessionEarning(earning)}
                            >
                              <Ionicons name="trash-outline" size={17} color="#F87171" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })
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

                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.deleteSessionButton}
                  onPress={() => handleDeleteDaySession(selectedSession)}
                >
                  <Ionicons name="trash-outline" size={19} color="#FCA5A5" />
                  <Text style={styles.deleteSessionButtonText}>Excluir turno</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={sessionEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeSessionEditModal}
      >
        <KeyboardAvoidingView
          style={styles.entryEditOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.sessionEditModal}>
            <View style={styles.entryEditHeader}>
              <View>
                <Text style={styles.entryEditEyebrow}>Dados do turno</Text>
                <Text style={styles.entryEditTitle}>Editar turno</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={closeSessionEditModal}
              >
                <Ionicons name="close" size={27} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.entryEditDescription}>
              Ajuste os horários e a quilometragem. O dashboard, tempo, KM, ganho/h e ganho/km serão recalculados imediatamente.
            </Text>

            <View style={styles.sessionEditInfoCard}>
              <Ionicons name="information-circle-outline" size={20} color="#60A5FA" />
              <Text style={styles.sessionEditInfoText}>
                A edição altera os dados base do turno finalizado, sem mudar os ganhos lançados.
              </Text>
            </View>

            <View style={styles.sessionEditGrid}>
              <View style={styles.sessionEditField}>
                <Text style={styles.entryEditLabel}>Hora inicial</Text>
                <TextInput
                  value={sessionEditStartTime}
                  onChangeText={(value) => {
                    setSessionEditStartTime(maskTimeInput(value));
                    clearSessionEditError("startTime");
                  }}
                  placeholder="00:00"
                  placeholderTextColor="#71717A"
                  keyboardType="numeric"
                  maxLength={5}
                  style={[
                    styles.entryEditInput,
                    sessionEditErrors.startTime && styles.entryEditInputError,
                  ]}
                />
                {sessionEditErrors.startTime ? (
                  <Text style={styles.entryEditError}>{sessionEditErrors.startTime}</Text>
                ) : null}
              </View>

              <View style={styles.sessionEditField}>
                <Text style={styles.entryEditLabel}>Hora final</Text>
                <TextInput
                  value={sessionEditEndTime}
                  onChangeText={(value) => {
                    setSessionEditEndTime(maskTimeInput(value));
                    clearSessionEditError("endTime");
                  }}
                  placeholder="00:00"
                  placeholderTextColor="#71717A"
                  keyboardType="numeric"
                  maxLength={5}
                  style={[
                    styles.entryEditInput,
                    sessionEditErrors.endTime && styles.entryEditInputError,
                  ]}
                />
                {sessionEditErrors.endTime ? (
                  <Text style={styles.entryEditError}>{sessionEditErrors.endTime}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.sessionEditGrid}>
              <View style={styles.sessionEditField}>
                <Text style={styles.entryEditLabel}>KM inicial</Text>
                <TextInput
                  value={sessionEditStartKm}
                  onChangeText={(value) => {
                    setSessionEditStartKm(maskSessionKmInput(value));
                    clearSessionEditError("startKm");
                  }}
                  placeholder="0"
                  placeholderTextColor="#71717A"
                  keyboardType="numeric"
                  style={[
                    styles.entryEditInput,
                    sessionEditErrors.startKm && styles.entryEditInputError,
                  ]}
                />
                {sessionEditErrors.startKm ? (
                  <Text style={styles.entryEditError}>{sessionEditErrors.startKm}</Text>
                ) : null}
              </View>

              <View style={styles.sessionEditField}>
                <Text style={styles.entryEditLabel}>KM final</Text>
                <TextInput
                  value={sessionEditEndKm}
                  onChangeText={(value) => {
                    setSessionEditEndKm(maskSessionKmInput(value));
                    clearSessionEditError("endKm");
                  }}
                  placeholder="0"
                  placeholderTextColor="#71717A"
                  keyboardType="numeric"
                  style={[
                    styles.entryEditInput,
                    sessionEditErrors.endKm && styles.entryEditInputError,
                  ]}
                />
                {sessionEditErrors.endKm ? (
                  <Text style={styles.entryEditError}>{sessionEditErrors.endKm}</Text>
                ) : null}
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.entryEditSaveButton,
                savingSessionEdit && styles.entryEditSaveButtonDisabled,
              ]}
              disabled={savingSessionEdit}
              onPress={handleSaveSessionEdit}
            >
              {savingSessionEdit ? (
                <ActivityIndicator color="#06130B" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={21} color="#06130B" />
                  <Text style={styles.entryEditSaveButtonText}>
                    Salvar turno
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={sessionEarningEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeSessionEarningEditModal}
      >
        <KeyboardAvoidingView
          style={styles.entryEditOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.sessionEarningEditModal}>
            <View style={styles.entryEditHeader}>
              <View>
                <Text style={styles.entryEditEyebrow}>Ganho do turno</Text>
                <Text style={styles.entryEditTitle}>Editar valor</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={closeSessionEarningEditModal}
              >
                <Ionicons name="close" size={27} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.entryEditDescription}>
              Altere somente o valor deste ganho. O dashboard, a jornada e os detalhes do turno serão atualizados.
            </Text>

            <View style={styles.sessionEarningEditPlatformBox}>
              {getPlatformByName(editingSessionEarning?.platform)?.logo_url ? (
                <Image
                  source={{
                    uri: getPlatformByName(editingSessionEarning?.platform)?.logo_url,
                  }}
                  style={styles.sessionDetailPlatformLogo}
                />
              ) : (
                <View style={styles.sessionDetailPlatformLogoFallback}>
                  <Text style={styles.sessionDetailPlatformLogoText}>
                    {getPlatformInitial(editingSessionEarning?.platform)}
                  </Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.sessionDetailName} numberOfLines={1}>
                  {editingSessionEarning?.platform || "Plataforma"}
                </Text>
                <Text style={styles.sessionDetailCaption}>Valor atual do turno</Text>
              </View>
            </View>

            <Text style={styles.entryEditLabel}>Valor</Text>
            <TextInput
              value={sessionEarningAmount}
              onChangeText={(text) => {
                setSessionEarningAmount(maskCurrencyInput(text));
                setSessionEarningErrors((current) => ({
                  ...current,
                  amount: "",
                }));
              }}
              placeholder="0,00"
              placeholderTextColor="#71717A"
              keyboardType="numeric"
              style={[
                styles.entryEditInput,
                sessionEarningErrors.amount && styles.entryEditInputError,
              ]}
            />

            {sessionEarningErrors.amount ? (
              <Text style={styles.entryEditError}>
                {sessionEarningErrors.amount}
              </Text>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.entryEditSaveButton,
                savingSessionEarning && styles.entryEditSaveButtonDisabled,
              ]}
              disabled={savingSessionEarning}
              onPress={handleSaveSessionEarningEdit}
            >
              {savingSessionEarning ? (
                <ActivityIndicator color="#06130B" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={21} color="#06130B" />
                  <Text style={styles.entryEditSaveButtonText}>
                    Salvar valor
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
                      selectedColor: "#D4A64A",
                    },
                  }}
                  onDayPress={(day) => {
                    const selectedDate = new Date(day.dateString + "T12:00:00");

                    selectPeriod("day", selectedDate);
                  }}
                  theme={{
                    calendarBackground: "#101014",
                    dayTextColor: "#F5F0E6",
                    monthTextColor: "#F5F0E6",
                    todayTextColor: "#D4A64A",
                    arrowColor: "#D4A64A",
                    selectedDayTextColor: "#FFFFFF",
                    textDisabledColor: "#3A3430",
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
                          color="#D4A64A"
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
                          color="#D4A64A"
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
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
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
    borderRadius: 16,
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
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  metricCardFat: {
    flex: 1,
    backgroundColor: "rgba(96, 165, 250, 0.15)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E3A8A",
  },
  metricCardDes: {
    flex: 1,
    backgroundColor: "rgba(248, 113, 113, 0.15)",
    borderRadius: 16,
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
    borderRadius: 16,
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
    borderRadius: 16,
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
    backgroundColor: "#18171D",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#2A2830",
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
    backgroundColor: "rgba(0,0,0,0.84)",
    justifyContent: "flex-end",
  },
  periodModal: {
    backgroundColor: "#101014",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    maxHeight: "84%",
    borderWidth: 1,
    borderColor: "#2A2830",
    borderTopColor: "rgba(212,166,74,0.34)",
  },
  periodModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#211D16",
  },
  periodModalTitle: {
    color: "#F5F0E6",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  periodModalTabs: {
    flexDirection: "row",
    marginTop: 4,
    backgroundColor: "#18171D",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "#2A2830",
  },
  periodModalTab: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  periodModalTabActive: {
    backgroundColor: "#D4A64A",
  },
  periodModalTabText: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "900",
  },
  periodModalTabTextActive: {
    color: "#080808",
  },
  currentPeriodButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#D4A64A",
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  currentPeriodButtonText: {
    color: "#080808",
    fontSize: 14,
    fontWeight: "900",
  },
  calendarWrapper: {
    marginTop: 16,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2A2830",
    backgroundColor: "#18171D",
  },
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
    borderRadius: 16,
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
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(17,24,39,0.72)",
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  pieLegendDot: {
    width: 13,
    height: 13,
    borderRadius: 999,
  },

  pieLegendLogo: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },

  pieLegendLogoFallback: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },

  pieLegendLogoText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  pieLegendInfo: {
    flex: 1,
  },

  pieLegendName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  pieLegendPercent: {
    color: "#86EFAC",
    fontSize: 12,
    fontWeight: "900",
  },

  pieLegendPercentPill: {
    minWidth: 48,
    height: 30,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.10)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.22)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  pieLegendValue: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
  },
  platformChartCard: {
    backgroundColor: "#18181B",
    borderRadius: 16,
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
    borderRadius: 16,
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

  yearChartToggleRow: {
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#27272A",
    marginTop: 14,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  yearChartArrowButton: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: "rgba(34,197,94,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  yearChartArrowPlaceholder: {
    width: 34,
    height: 34,
  },

  yearChartToggleText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  profitExpenseChart: {
    gap: 18,
    marginTop: 16,
  },

  profitExpenseRow: {
    gap: 9,
  },

  profitExpenseRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  profitExpenseLabelBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  profitExpenseLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  profitExpenseValue: {
    color: "#22C55E",
    fontSize: 13,
    fontWeight: "900",
  },

  profitExpenseValueNegative: {
    color: "#F87171",
  },

  profitExpenseValueRed: {
    color: "#F87171",
    fontSize: 13,
    fontWeight: "900",
  },

  profitExpenseTrack: {
    height: 18,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#27272A",
    overflow: "hidden",
  },

  profitExpenseFill: {
    height: "100%",
    borderRadius: 999,
    minWidth: 6,
  },

  profitExpenseFillProfit: {
    backgroundColor: "#22C55E",
  },

  profitExpenseFillLoss: {
    backgroundColor: "#EF4444",
  },

  profitExpenseFillExpenses: {
    backgroundColor: "#F87171",
  },

  profitExpenseSummary: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#27272A",
    padding: 12,
    gap: 6,
  },

  profitExpenseSummaryText: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "800",
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

  modernEntriesListCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },

  modernEntryCountBadge: {
    minWidth: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.24)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  modernEntryCountText: {
    color: "#86EFAC",
    fontSize: 14,
    fontWeight: "900",
  },

  periodEntryItem: {
    minHeight: 78,
    borderRadius: 20,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  periodEntryPlatformLogo: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },

  periodEntryIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "rgba(59,130,246,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  periodEntryIconStandalone: {
    backgroundColor: "rgba(34,197,94,0.12)",
  },

  periodEntryTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  periodEntryMeta: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },

  periodEntryDate: {
    color: "#71717A",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },

  periodEntryRight: {
    alignItems: "flex-end",
    gap: 8,
  },

  periodEntryValue: {
    color: "#86EFAC",
    fontSize: 13,
    fontWeight: "900",
  },

  periodEntryActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  periodEntryActionButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "rgba(59,130,246,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  periodEntryActionButtonDanger: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  periodEntriesEmptyBox: {
    minHeight: 150,
    borderRadius: 16,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },

  periodEntriesEmptyTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 10,
  },

  periodEntriesEmptyText: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
  },
  entryEditOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.84)",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  entryEditModal: {
    backgroundColor: "#101014",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#2A2830",
    borderTopColor: "rgba(212,166,74,0.34)",
    maxHeight: "92%",
  },
  entryEditHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#211D16",
  },
  entryEditEyebrow: {
    color: "#D4A64A",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  entryEditTitle: {
    color: "#F5F0E6",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 3,
    letterSpacing: -0.3,
  },
  entryEditDescription: {
    color: "#9B969B",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginBottom: 18,
  },
  entryEditLabel: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.2,
  },

  entryPlatformHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },

  entryPlatformHeaderHint: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
    marginTop: -3,
    lineHeight: 16,
  },

  entryManagePlatformsButton: {
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  entryManagePlatformsButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  entryEmptyPlatformsBox: {
    minHeight: 132,
    borderRadius: 16,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    marginBottom: 14,
  },

  entryEmptyPlatformsTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 10,
  },

  entryEmptyPlatformsText: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },

  entryPlatformList: {
    gap: 8,
    paddingBottom: 14,
  },

  entryPlatformChip: {
    width: 102,
    minHeight: 82,
    borderRadius: 20,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
    padding: 9,
    gap: 7,
  },

  entryPlatformChipActive: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },

  entryPlatformLogo: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },

  entryPlatformLogoFallback: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },

  entryPlatformLogoText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  entryPlatformChipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },

  entryPlatformChipTextActive: {
    color: "#06130B",
  },
  entryEditInput: {
    height: 55,
    borderRadius: 12,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    color: "#F5F0E6",
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 13,
  },
  entryEditInputError: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239,68,68,0.08)",
  },

  entryEditError: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "800",
    marginTop: -3,
    marginBottom: 10,
    marginLeft: 4,
    lineHeight: 17,
  },

  entryEditRow: {
    flexDirection: "row",
    gap: 10,
  },
  entryEditSaveButton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },

  entryEditSaveButtonDisabled: {
    opacity: 0.65,
  },
  entryEditSaveButtonText: {
    color: "#080808",
    fontSize: 15,
    fontWeight: "900",
  },
  platformDrawerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.84)",
    justifyContent: "flex-end",
  },
  platformDrawerContent: {
    backgroundColor: "#101014",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#2A2830",
    borderTopColor: "rgba(212,166,74,0.34)",
    maxHeight: "86%",
  },
  platformDrawerHandle: {
    width: 46,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#D4A64A",
    opacity: 0.65,
    alignSelf: "center",
    marginBottom: 16,
  },
  platformDrawerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#211D16",
    gap: 12,
  },
  platformDrawerEyebrow: {
    color: "#D4A64A",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  platformDrawerTitle: {
    color: "#F5F0E6",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 3,
    letterSpacing: -0.3,
  },
  platformDrawerDescription: {
    color: "#9B969B",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginBottom: 18,
  },

  platformDrawerList: {
    gap: 10,
    paddingBottom: 18,
  },
  platformDrawerItem: {
    minHeight: 62,
    borderRadius: 13,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    gap: 12,
  },
  platformDrawerItemActive: {
    borderColor: "rgba(212,166,74,0.55)",
    backgroundColor: "rgba(212,166,74,0.10)",
  },

  platformDrawerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    flex: 1,
  },
  platformDrawerLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  platformDrawerLogoFallback: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },

  platformDrawerLogoText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  platformDrawerName: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
    flex: 1,
  },
  platformDrawerNameActive: {
    color: "#D4A64A",
  },

  savePlatformsButton: {
    height: 56,
    borderRadius: 19,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },

  savePlatformsButtonText: {
    color: "#06130B",
    fontSize: 15,
    fontWeight: "900",
  },

  modernExpensesListCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },

  modernExpenseCountBadge: {
    minWidth: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.24)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  modernExpenseCountText: {
    color: "#FCA5A5",
    fontSize: 14,
    fontWeight: "900",
  },

  periodExpenseItem: {
    minHeight: 72,
    borderRadius: 20,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  periodExpenseIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "rgba(239,68,68,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  periodExpenseTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  periodExpenseMeta: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },

  periodExpenseLocation: {
    color: "#71717A",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },

  periodExpenseValue: {
    color: "#FCA5A5",
    fontSize: 13,
    fontWeight: "900",
  },

  periodExpenseRight: {
    alignItems: "flex-end",
    gap: 8,
  },

  periodExpenseActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  periodExpenseActionButton: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: "rgba(59,130,246,0.12)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },

  periodExpenseActionButtonDanger: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  expenseEditModal: {
    width: "100%",
    maxHeight: "92%",
    borderRadius: 16,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    borderTopColor: "rgba(212,166,74,0.34)",
    padding: 18,
  },

  expenseCategoryList: {
    gap: 8,
    paddingBottom: 14,
  },

  expenseCategoryChip: {
    minWidth: 110,
    height: 48,
    borderRadius: 17,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  expenseCategoryChipActive: {
    backgroundColor: "#FCA5A5",
    borderColor: "#FCA5A5",
  },

  expenseCategoryChipText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  expenseCategoryChipTextActive: {
    color: "#06130B",
  },

  periodExpensesEmptyBox: {
    minHeight: 150,
    borderRadius: 16,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    marginBottom: 12,
  },

  periodExpensesEmptyTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 10,
  },

  periodExpensesEmptyText: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
  },

  periodExpensesManageButton: {
    height: 48,
    borderRadius: 17,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },

  periodExpensesManageButtonText: {
    color: "#06130B",
    fontSize: 14,
    fontWeight: "900",
  },

  challengesShortcutCard: {
    minHeight: 86,
    borderRadius: 16,
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
    backgroundColor: "#18171D",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#2A2830",
    borderLeftWidth: 1,
    //borderLeftColor: "#D4A64A",
    marginBottom: 16,
  },

  daySessionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  daySessionsTitle: {
    color: "#FFFFFF",
  },

  daySessionsSubtitle: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
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
    backgroundColor: "#101014",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2830",
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
    alignItems: "center",
    justifyContent: "center",
  },

  daySessionStatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  daySessionStatLabel: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },

  daySessionStatValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
    textAlign: "center",
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
    color: "#06130B",
    fontSize: 13,
    fontWeight: "900",
  },

  sessionDetailsHeader: {
    marginBottom: 18,
  },
  deleteSessionButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.28)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },

  deleteSessionButtonText: {
    color: "#FCA5A5",
    fontSize: 14,
    fontWeight: "900",
  },
  sessionDetailsModal: {
    backgroundColor: "#101014",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    height: "86%",
    borderWidth: 1,
    borderColor: "#2A2830",
    borderTopColor: "rgba(212,166,74,0.34)",
  },
  sessionDetailsSummary: {
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.28)",
    borderLeftWidth: 4,
    borderLeftColor: "#D4A64A",
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
  },
  sessionDetailsTime: {
    color: "#D4A64A",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  sessionDetailsRevenue: {
    color: "#F5F0E6",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 8,
  },
  sessionDetailsMuted: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  sessionDetailsSectionTitle: {
    color: "#F5F0E6",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
    marginTop: 10,
  },
  sessionDetailRow: {
    minHeight: 54,
    backgroundColor: "#18171D",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sessionDetailName: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  sessionDetailValue: {
    color: "#D4A64A",
    fontSize: 14,
    fontWeight: "900",
  },
  sessionRideCard: {
    minHeight: 68,
    backgroundColor: "#18171D",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#2A2830",
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
    paddingTop: 0,
    paddingBottom: 178,
    backgroundColor: "#050505",
  },
  modernHeader: {
    marginHorizontal: -18,
    marginBottom: 0,
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 18,
    backgroundColor: "#070707",
    borderBottomWidth: 1,
    borderBottomColor: "#211D16",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modernUserRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 0,
  },
  modernAvatar: {
    width: 54,
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.48)",
    backgroundColor: "#111111",
  },
  modernAvatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: "#141318",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.38)",
    alignItems: "center",
    justifyContent: "center",
  },
  modernGreeting: {
    color: "#D4A64A",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.7,
    textTransform: "uppercase",
  },
  modernTitle: {
    color: "#F5F0E6",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.1,
  },
  modernHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 7,
    marginLeft: 10,
  },
  modernHeaderIconButton: {
    width: 43,
    height: 43,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#2A2830",
    backgroundColor: "#16151A",
    alignItems: "center",
    justifyContent: "center",
  },
  modernHeaderMenuButton: {
    backgroundColor: "rgba(212,166,74,0.12)",
    borderColor: "rgba(212,166,74,0.30)",
  },
  headerMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.64)",
    paddingTop: 88,
    paddingHorizontal: 18,
    alignItems: "flex-end",
  },
  headerMenuCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 18,
  },
  headerMenuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#211D16",
  },
  headerMenuEyebrow: {
    color: "#D4A64A",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  headerMenuTitle: {
    color: "#F5F0E6",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },
  headerMenuCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  headerMenuItem: {
    minHeight: 68,
    borderRadius: 17,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  headerMenuItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerMenuItemIconGold: {
    backgroundColor: "rgba(212,166,74,0.12)",
    borderColor: "rgba(212,166,74,0.28)",
  },
  headerMenuItemIconBlue: {
    backgroundColor: "rgba(96,165,250,0.12)",
    borderColor: "rgba(96,165,250,0.28)",
  },
  headerMenuItemTextBox: {
    flex: 1,
  },
  headerMenuItemTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  headerMenuItemSubtitle: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  stickyPeriodHeader: {
    marginHorizontal: -18,
    paddingHorizontal: 18,
    paddingTop: 9,
    paddingBottom: 10,
    backgroundColor: "#050505",
    borderBottomWidth: 1,
    borderBottomColor: "#17140F",
    zIndex: 50,
    elevation: 50,
  },

  modernPeriodTabs: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
    marginBottom: 8,
    borderWidth: 1,
    backgroundColor: "#101014",
    borderColor: "#2A2830",
  },
  modernPeriodTab: {
    flex: 1,
    height: 39,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modernPeriodTabActive: {
    backgroundColor: "#D4A64A",
  },
  modernPeriodTabText: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  modernPeriodTabTextActive: {
    color: "#080808",
  },
  modernPeriodSelector: {
    minHeight: 68,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2830",
    backgroundColor: "#18171D",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 0,
    paddingHorizontal: 8,
  },
  modernPeriodArrow: {
    width: 40,
    height: 50,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,166,74,0.08)",
  },
  modernPeriodCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  modernPeriodTitle: {
    color: "#F5F0E6",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "capitalize",
  },
  modernPeriodSubtitle: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 5,
  },
  modernHeroCard: {
    borderRadius: 20,
    padding: 15,
    marginBottom: 18,
    marginTop: 10,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.32)",
    borderLeftWidth: 1,
  },
  modernHeroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modernHeroBadge: {
    minHeight: 35,
    borderRadius: 12,
    backgroundColor: "rgba(212,166,74,0.13)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  modernHeroBadgeText: {
    color: "#D4A64A",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  modernVariationPill: {
    height: 34,
    borderRadius: 12,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  modernVariationPositive: {
    backgroundColor: "rgba(34,197,94,0.20)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.32)",
  },
  modernVariationNegative: {
    backgroundColor: "rgba(239,68,68,0.20)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.34)",
  },
  modernVariationText: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "900",
  },
  modernHeroValue: {
    color: "#F5F0E6",
    fontSize: 42,
    fontWeight: "900",
    marginTop: 22,
    letterSpacing: -1.6,
    lineHeight: 48,
  },
  modernHeroSub: {
    color: "#B8B2B8",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 8,
    lineHeight: 20,
  },
  modernHeroMiniGrid: {
    flexDirection: "row",
    gap: 9,
    marginTop: 22,
  },
  modernHeroMiniCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
  },
  modernMiniIconBlue: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(212,166,74,0.13)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  modernMiniIconRed: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.13)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  modernHeroMiniLabel: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  modernHeroMiniValue: {
    color: "#F5F0E6",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 6,
  },
  modernHeroMiniValueRed: {
    color: "#FCA5A5",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 6,
  },
  modernHeroMiniCaption: {
    color: "#8F8A91",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 5,
  },
  modernStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  modernStatCard: {
    width: "48.5%",
    minHeight: 102,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2830",
    backgroundColor: "#18171D",
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: "rgba(212,166,74,0.62)",
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
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  modernStatValue: {
    color: "#F5F0E6",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 6,
    textAlign: "center",
  },

  modernSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modernSectionTitle: {
    color: "#F5F0E6",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },

  modernSectionSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },

  modernSessionsCard: {
    borderRadius: 18,
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
    borderRadius: 16,
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
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    marginBottom: 14,
  },


  modernRevisionCard: {
    minHeight: 84,
    borderRadius: 18,
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
    minHeight: 68,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderStyle: "solid",
    backgroundColor: "#18171D",
    borderColor: "#2A2830",
    opacity: 0.98,
  },
  goalMiniCardEmpty: {
    backgroundColor: "#D4A64A",
    borderColor: "#D4A64A",
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
    borderRadius: 18,
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
    backgroundColor: "rgba(0,0,0,0.84)",
    justifyContent: "flex-end",
  },
  goalModalContent: {
    backgroundColor: "#101014",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#2A2830",
    borderTopColor: "rgba(212,166,74,0.34)",
    maxHeight: "82%",
  },
  goalModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#211D16",
  },
  goalModalTitle: {
    color: "#F5F0E6",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  daySessionRevenueBox: {
    alignItems: "flex-end",
    backgroundColor: "rgba(34,197,94,0.10)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.18)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 126,
  },

  daySessionRevenueLabel: {
    color: "#86EFAC",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },

  daySessionStatValueGreen: {
    color: "#86EFAC",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
    textAlign: "center",
  },

  daySessionStatValuePurple: {
    color: "#C4B5FD",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
    textAlign: "center",
  },
  sessionDetailRowModern: {
    minHeight: 78,
    backgroundColor: "#18171D",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  sessionDetailPlatformLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sessionDetailPlatformLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  sessionDetailPlatformLogoFallback: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },

  sessionDetailPlatformLogoText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  sessionDetailCaption: {
    color: "#8F8A91",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },

  sessionDetailRight: {
    alignItems: "flex-end",
    gap: 8,
  },

  sessionDetailActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sessionDetailActionButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  sessionDetailActionButtonDanger: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  sessionEarningEditModal: {
    backgroundColor: "#101014",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#2A2830",
    borderTopColor: "rgba(212,166,74,0.34)",
  },
  sessionEarningEditPlatformBox: {
    minHeight: 64,
    borderRadius: 13,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginBottom: 16,
  },
  editSessionButton: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.28)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
  },
  editSessionButtonText: {
    color: "#D4A64A",
    fontSize: 13,
    fontWeight: "900",
  },
  sessionEditModal: {
    backgroundColor: "#101014",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#2A2830",
    borderTopColor: "rgba(212,166,74,0.34)",
  },
  sessionEditInfoCard: {
    minHeight: 54,
    borderRadius: 13,
    backgroundColor: "rgba(212,166,74,0.10)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.22)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginBottom: 14,
  },
  sessionEditInfoText: {
    flex: 1,
    color: "#E8C46D",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },

  sessionEditGrid: {
    flexDirection: "row",
    gap: 10,
  },

  sessionEditField: {
    flex: 1,
  },

  subscriptionBannerSlot: {
    marginTop: 5,
    marginBottom: 5,
  },
  subscriptionBanner: {
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  subscriptionBannerWarning: {
    backgroundColor: "rgba(212,166,74,0.11)",
    borderColor: "rgba(212,166,74,0.26)",
    borderLeftColor: "#D4A64A",
  },
  subscriptionBannerDanger: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderColor: "rgba(239,68,68,0.28)",
    borderLeftColor: "#EF4444",
  },
  subscriptionBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  subscriptionBannerIconWarning: {
    backgroundColor: "rgba(212,166,74,0.14)",
    borderColor: "rgba(212,166,74,0.25)",
  },
  subscriptionBannerIconDanger: {
    backgroundColor: "rgba(239,68,68,0.14)",
    borderColor: "rgba(239,68,68,0.25)",
  },
  subscriptionBannerContent: {
    flex: 1,
  },
  subscriptionBannerTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  subscriptionBannerText: {
    color: "#B8B1B8",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  subscriptionBannerAction: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  subscriptionBannerActionText: {
    fontSize: 12,
    fontWeight: "900",
  },
  subscriptionBannerActionTextWarning: {
    color: "#D4A64A",
  },
  subscriptionBannerActionTextDanger: {
    color: "#FCA5A5",
  },
});




