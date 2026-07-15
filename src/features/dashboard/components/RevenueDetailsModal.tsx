import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  DashboardPeriod,
  getDashboardData,
} from "../services/getDashboardData";
import { supabase } from "../../../database/supabase";

type IconName = keyof typeof Ionicons.glyphMap;

export type RevenueDetailsSummary = {
  revenue: number;
  operationalExpenses: number;
  operationalFuelExpenses: number;
  operationalChargingExpenses: number;
  balance: number;
  totalHours: number;
  totalKm: number;
  revenuePerHour: number;
  revenuePerKm: number;
  operationalExpensesPercent: number;
  balancePercent: number;
  startDate: Date;
  endDate: Date;
};

type OperationalExpenseBreakdown = {
  total: number;
  fuel: number;
  charging: number;
};

type RevenueDetailsModalProps = {
  visible: boolean;
  onClose: () => void;
  period: DashboardPeriod;
  referenceDate: Date | string;
  title?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  summaryOverride?: Partial<
    Omit<RevenueDetailsSummary, "startDate" | "endDate">
  > & {
    startDate?: Date | string | null;
    endDate?: Date | string | null;
  };
  onLoaded?: (summary: RevenueDetailsSummary) => void;
};

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
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function normalizeDate(value: Date | string) {
  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}

function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, -1);
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

function getPeriodRange(period: DashboardPeriod, referenceDate: Date) {
  const date = new Date(referenceDate);

  if (period === "day") {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  if (period === "week") {
    return getWeekRange(date);
  }

  if (period === "month") {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    return { start, end };
  }

  const start = new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);

  return { start, end };
}

function formatShortDate(value: Date) {
  return `${String(value.getDate()).padStart(2, "0")} ${shortMonths[value.getMonth()]}`;
}

function getPeriodTitleParts(period: DashboardPeriod, startDate: Date, endDate: Date) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (period === "day") {
    return {
      eyebrow: "Detalhes do dia",
      value: `${weekDays[start.getDay()]}, ${formatShortDate(start)}`,
    };
  }

  if (period === "week") {
    return {
      eyebrow: "Detalhes da semana",
      value: `${formatShortDate(start)} a ${formatShortDate(end)}`,
    };
  }

  if (period === "month") {
    return {
      eyebrow: "Detalhes do mês",
      value: `${months[start.getMonth()]} de ${start.getFullYear()}`,
    };
  }

  return {
    eyebrow: "Detalhes do ano",
    value: String(start.getFullYear()),
  };
}

function normalizeCategory(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseMoney(value?: number | string | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const rawValue = String(value ?? "").trim();

  if (!rawValue) return 0;

  const normalizedValue = rawValue.includes(",")
    ? rawValue.replace(/\./g, "").replace(",", ".")
    : rawValue;

  const amount = Number(normalizedValue);

  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(value: number) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCompactCurrency(value: number) {
  return `R$ ${formatCurrency(value)}`;
}

function formatDecimal(value: number, maximumFractionDigits = 1) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

function formatHoursToHHMM(value?: number | string | null) {
  const decimalHours = Number(value ?? 0);

  if (!Number.isFinite(decimalHours) || decimalHours <= 0) {
    return "00:00";
  }

  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";

  return `${Math.round(value)}%`;
}

function getRevenuePercent(value: number, revenue: number) {
  if (!Number.isFinite(value) || !Number.isFinite(revenue) || revenue <= 0) {
    return 0;
  }

  return (value / revenue) * 100;
}

async function getLoggedUserId(fallbackUserId?: string | null) {
  if (fallbackUserId) return fallbackUserId;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? "";
}

async function loadOperationalExpenses(params: {
  userId?: string | null;
  startDate: Date;
  endDate: Date;
}) {
  const expenseSummary: OperationalExpenseBreakdown = {
    total: 0,
    fuel: 0,
    charging: 0,
  };

  const loggedUserId = await getLoggedUserId(params.userId);

  if (!loggedUserId) return expenseSummary;

  const start = toLocalISOString(params.startDate);
  const end = toLocalISOString(params.endDate);

  const { data, error } = await supabase
    .from("expenses")
    .select("id, amount, category, expense_date")
    .eq("user_id", loggedUserId)
    .gte("expense_date", start)
    .lte("expense_date", end);

  if (error) {
    console.log("Erro ao carregar despesas operacionais:", error);
    return expenseSummary;
  }

  (data ?? []).forEach((expense: any) => {
    const normalizedCategory = normalizeCategory(expense?.category);
    const amount = parseMoney(expense?.amount);

    if (normalizedCategory === "combustivel") {
      expenseSummary.fuel += amount;
      expenseSummary.total += amount;
      return;
    }

    if (normalizedCategory === "carregamento") {
      expenseSummary.charging += amount;
      expenseSummary.total += amount;
    }
  });

  return expenseSummary;
}

function getOperationalExpenseVisual(summary?: RevenueDetailsSummary | null): {
  label: string;
  icon: IconName;
} {
  const fuel = Number(summary?.operationalFuelExpenses ?? 0);
  const charging = Number(summary?.operationalChargingExpenses ?? 0);
  const hasFuel = fuel > 0;
  const hasCharging = charging > 0;

  if (hasFuel && !hasCharging) {
    return {
      label: "Combustível",
      icon: "flame-outline",
    };
  }

  if (hasCharging && !hasFuel) {
    return {
      label: "Carregamento",
      icon: "battery-charging-outline",
    };
  }

  return {
    label: "Comb./carreg.",
    icon: "flash-outline",
  };
}


function normalizeRevenueDetailsOverride(
  summaryOverride: RevenueDetailsModalProps["summaryOverride"] | null | undefined,
  period: DashboardPeriod,
  referenceDate: Date,
): RevenueDetailsSummary | null {
  if (!summaryOverride) return null;

  const fallbackRange = getPeriodRange(period, referenceDate);
  const revenue = Number(summaryOverride.revenue ?? 0);
  const operationalExpenses = Number(summaryOverride.operationalExpenses ?? 0);
  const balance = Number(summaryOverride.balance ?? revenue - operationalExpenses);
  const totalHours = Number(summaryOverride.totalHours ?? 0);
  const totalKm = Number(summaryOverride.totalKm ?? 0);
  const revenuePerHour = Number(
    summaryOverride.revenuePerHour ??
      (totalHours > 0 ? revenue / totalHours : 0),
  );
  const revenuePerKm = Number(
    summaryOverride.revenuePerKm ?? (totalKm > 0 ? revenue / totalKm : 0),
  );
  const startDate = summaryOverride.startDate
    ? new Date(summaryOverride.startDate)
    : fallbackRange.start;
  const endDate = summaryOverride.endDate
    ? new Date(summaryOverride.endDate)
    : fallbackRange.end;

  return {
    revenue,
    operationalExpenses,
    operationalFuelExpenses: Number(summaryOverride.operationalFuelExpenses ?? 0),
    operationalChargingExpenses: Number(
      summaryOverride.operationalChargingExpenses ?? 0,
    ),
    balance,
    totalHours,
    totalKm,
    revenuePerHour,
    revenuePerKm,
    operationalExpensesPercent: getRevenuePercent(operationalExpenses, revenue),
    balancePercent: getRevenuePercent(balance, revenue),
    startDate: Number.isNaN(startDate.getTime()) ? fallbackRange.start : startDate,
    endDate: Number.isNaN(endDate.getTime()) ? fallbackRange.end : endDate,
  };
}

function MainMetricCard({
  label,
  value,
  subtitle,
  icon,
  color,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: IconName;
  color: string;
}) {
  return (
    <View style={[styles.mainMetricCard, { borderColor: `${color}42` }]}>
      <View style={[styles.mainMetricIconBox, { backgroundColor: `${color}18`, borderColor: `${color}38` }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>

      <View style={styles.mainMetricContent}>
        <Text style={styles.mainMetricLabel} numberOfLines={1}>
          {label}
        </Text>

        <Text style={styles.mainMetricValue} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>

        {subtitle ? (
          <Text style={styles.mainMetricSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function DetailMetricCard({
  label,
  value,
  subtitle,
  icon,
  color,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: IconName;
  color: string;
}) {
  return (
    <View style={styles.detailMetricCard}>
      <View style={[styles.detailMetricIconBox, { backgroundColor: `${color}16`, borderColor: `${color}34` }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>

      <View style={styles.detailMetricContent}>
        <View style={styles.detailMetricHeaderRow}>
          <Text style={styles.detailMetricLabel} numberOfLines={1}>
            {label}
          </Text>

          {subtitle ? (
            <Text style={[styles.detailMetricSubtitle, { color }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <Text style={styles.detailMetricValue} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function RevenueDetailsModal({
  visible,
  onClose,
  period,
  referenceDate,
  title = "Detalhes do faturamento",
  style,
  contentStyle,
  summaryOverride,
  onLoaded,
}: RevenueDetailsModalProps) {
  const [summary, setSummary] = useState<RevenueDetailsSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const referenceDateKey = useMemo(() => {
    return normalizeDate(referenceDate).toISOString();
  }, [referenceDate]);

  const parsedReferenceDate = useMemo(() => {
    return new Date(referenceDateKey);
  }, [referenceDateKey]);

  const normalizedSummaryOverride = useMemo(
    () => normalizeRevenueDetailsOverride(summaryOverride, period, parsedReferenceDate),
    [parsedReferenceDate, period, summaryOverride],
  );

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);

      const dashboardResponse = await getDashboardData(period, parsedReferenceDate);
      const fallbackRange = getPeriodRange(period, parsedReferenceDate);

      const startDate = dashboardResponse?.startDate
        ? new Date(dashboardResponse.startDate)
        : fallbackRange.start;
      const endDate = dashboardResponse?.endDate
        ? new Date(dashboardResponse.endDate)
        : fallbackRange.end;

      const revenue = Number(dashboardResponse?.revenue ?? 0);
      const totalHours = Number(dashboardResponse?.totalHours ?? 0);
      const totalKm = Number(dashboardResponse?.totalKm ?? 0);
      const userId = dashboardResponse?.user?.id ?? null;

      const operationalExpenses = await loadOperationalExpenses({
        userId,
        startDate,
        endDate,
      });

      const balance = revenue - operationalExpenses.total;
      const nextSummary: RevenueDetailsSummary = {
        revenue,
        operationalExpenses: operationalExpenses.total,
        operationalFuelExpenses: operationalExpenses.fuel,
        operationalChargingExpenses: operationalExpenses.charging,
        balance,
        totalHours,
        totalKm,
        revenuePerHour: totalHours > 0 ? revenue / totalHours : 0,
        revenuePerKm: totalKm > 0 ? revenue / totalKm : 0,
        operationalExpensesPercent: getRevenuePercent(operationalExpenses.total, revenue),
        balancePercent: getRevenuePercent(balance, revenue),
        startDate,
        endDate,
      };

      setSummary(nextSummary);
      onLoaded?.(nextSummary);
    } catch (error) {
      console.log("Erro ao carregar detalhes do faturamento:", error);
      const fallbackRange = getPeriodRange(period, parsedReferenceDate);
      const emptySummary: RevenueDetailsSummary = {
        revenue: 0,
        operationalExpenses: 0,
        operationalFuelExpenses: 0,
        operationalChargingExpenses: 0,
        balance: 0,
        totalHours: 0,
        totalKm: 0,
        revenuePerHour: 0,
        revenuePerKm: 0,
        operationalExpensesPercent: 0,
        balancePercent: 0,
        startDate: fallbackRange.start,
        endDate: fallbackRange.end,
      };

      setSummary(emptySummary);
      onLoaded?.(emptySummary);
    } finally {
      setLoading(false);
    }
  }, [onLoaded, parsedReferenceDate, period]);

  useEffect(() => {
    if (!visible) return;

    if (normalizedSummaryOverride) {
      setSummary(normalizedSummaryOverride);
      setLoading(false);
      onLoaded?.(normalizedSummaryOverride);
      return;
    }

    loadSummary();
  }, [loadSummary, normalizedSummaryOverride, onLoaded, visible]);

  const fallbackRange = getPeriodRange(period, parsedReferenceDate);
  const periodTitleParts = summary
    ? getPeriodTitleParts(period, summary.startDate, summary.endDate)
    : getPeriodTitleParts(period, fallbackRange.start, fallbackRange.end);

  const operationalExpenseVisual = getOperationalExpenseVisual(summary);
  const balance = Number(summary?.balance ?? 0);
  const balancePositive = balance >= 0;
  const balanceColor = balancePositive ? "#22C55E" : "#EF4444";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.overlayTouch}
          onPress={onClose}
        />

        <View style={[styles.modalBox, style]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderIconBox}>
              <Ionicons name="stats-chart-outline" size={19} color="#D4A64A" />
            </View>

            <View style={styles.modalHeaderTextBox}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.modalSubtitle} numberOfLines={1}>
                {periodTitleParts.eyebrow}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={19} color="#F5F0E6" />
            </TouchableOpacity>
          </View>

          <Text style={styles.periodDate} numberOfLines={2}>
            {periodTitleParts.value}
          </Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, contentStyle]}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#D4A64A" />
                <Text style={styles.loadingText}>Carregando detalhes...</Text>
              </View>
            ) : (
              <>
                <MainMetricCard
                  label="Faturamento"
                  value={formatCompactCurrency(summary?.revenue ?? 0)}
                  subtitle="Total recebido no período"
                  icon="trending-up-outline"
                  color="#3B82F6"
                />

                <View style={styles.metricGrid}>
                  <DetailMetricCard
                    label={operationalExpenseVisual.label}
                    value={formatCompactCurrency(summary?.operationalExpenses ?? 0)}
                    subtitle={formatPercent(summary?.operationalExpensesPercent ?? 0)}
                    icon={operationalExpenseVisual.icon}
                    color="#EF4444"
                  />

                  <DetailMetricCard
                    label="Saldo"
                    value={formatCompactCurrency(balance)}
                    subtitle={formatPercent(summary?.balancePercent ?? 0)}
                    icon={balancePositive ? "checkmark-circle-outline" : "warning-outline"}
                    color={balanceColor}
                  />

                  <DetailMetricCard
                    label="Horas"
                    value={`${formatHoursToHHMM(summary?.totalHours ?? 0)}h`}
                    icon="time-outline"
                    color="#A78BFA"
                  />

                  <DetailMetricCard
                    label="Km rodados"
                    value={`${formatDecimal(summary?.totalKm ?? 0, 0)} km`}
                    icon="speedometer-outline"
                    color="#FACC15"
                  />

                  <DetailMetricCard
                    label="Ganho/h"
                    value={formatCompactCurrency(summary?.revenuePerHour ?? 0)}
                    icon="hourglass-outline"
                    color="#22C55E"
                  />

                  <DetailMetricCard
                    label="Ganho/km"
                    value={formatCompactCurrency(summary?.revenuePerKm ?? 0)}
                    icon="map-outline"
                    color="#38BDF8"
                  />
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default RevenueDetailsModal;

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  overlayTouch: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  modalBox: {
    backgroundColor: "#09090B",
    borderColor: "rgba(212,166,74,0.24)",
    borderRadius: 28,
    borderWidth: 1,
    maxHeight: "88%",
    overflow: "hidden",
    paddingTop: 14,
    width: "100%",
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
  },
  modalHeaderIconBox: {
    alignItems: "center",
    backgroundColor: "rgba(212,166,74,0.13)",
    borderColor: "rgba(212,166,74,0.32)",
    borderRadius: 15,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  modalHeaderTextBox: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "900",
  },
  modalSubtitle: {
    color: "#B9AA7A",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    textTransform: "uppercase",
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#18171B",
    borderColor: "#2A2830",
    borderRadius: 14,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  periodDate: {
    color: "#FDE68A",
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 24,
    marginTop: 14,
    paddingHorizontal: 20,
    textAlign: "center",
  },
  scroll: {
    marginTop: 12,
  },
  scrollContent: {
    gap: 10,
    paddingBottom: 16,
    paddingHorizontal: 12,
  },
  loadingBox: {
    alignItems: "center",
    gap: 9,
    minHeight: 260,
    justifyContent: "center",
  },
  loadingText: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "800",
  },
  mainMetricCard: {
    alignItems: "center",
    backgroundColor: "rgba(59,130,246,0.13)",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mainMetricIconBox: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  mainMetricContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
    paddingRight: 40,
  },
  mainMetricLabel: {
    color: "#BFDBFE",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginBottom: 3,
    textAlign: "center",
    textTransform: "uppercase",
  },
  mainMetricValue: {
    color: "#F8FAFC",
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  mainMetricSubtitle: {
    color: "#BFDBFE",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 3,
    textAlign: "center",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  detailMetricCard: {
    alignItems: "center",
    backgroundColor: "#101014",
    borderColor: "#25222A",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 64,
    paddingHorizontal: 9,
    paddingVertical: 8,
    width: "48.5%",
  },
  detailMetricIconBox: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  detailMetricContent: {
    flex: 1,
    minWidth: 0,
  },
  detailMetricHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    justifyContent: "space-between",
    marginBottom: 4,
  },
  detailMetricLabel: {
    color: "#9B969B",
    flex: 1,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.25,
    textAlign: "left",
    textTransform: "uppercase",
  },
  detailMetricSubtitle: {
    fontSize: 10,
    fontWeight: "900",
    textAlign: "right",
  },
  detailMetricValue: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "left",
  },
});
