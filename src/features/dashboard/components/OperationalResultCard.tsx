import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { RevenueDetailsModal } from "./RevenueDetailsModal";

type IconName = keyof typeof Ionicons.glyphMap;

type OperationalResultSummary = {
  revenue: number;
  operationalExpenses: number;
  operationalFuelExpenses: number;
  operationalChargingExpenses: number;
  operationalResult: number;
  totalHours: number;
  totalKm: number;
  revenuePerHour: number;
  revenuePerKm: number;
  startDate: Date;
  endDate: Date;
};

type OperationalResultSummaryOverride = Partial<
  Omit<OperationalResultSummary, "startDate" | "endDate">
> & {
  startDate?: Date | string | null;
  endDate?: Date | string | null;
};

type OperationalExpenseBreakdown = {
  total: number;
  fuel: number;
  charging: number;
};

type OperationalResultCardProps = {
  period: DashboardPeriod;
  referenceDate: Date | string;
  style?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
  showRefreshButton?: boolean;
  showDetailsButton?: boolean;
  detailsButtonLabel?: string;
  summaryOverride?: OperationalResultSummaryOverride | null;
  onDetailsPress?: () => void;
  onLoaded?: (summary: OperationalResultSummary) => void;
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
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

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
      eyebrow: "Resultado do dia",
      value: `${weekDays[start.getDay()]}, ${formatShortDate(start)}`,
    };
  }

  if (period === "week") {
    return {
      eyebrow: "Resultado da semana",
      value: `${formatShortDate(start)} a ${formatShortDate(end)}`,
    };
  }

  if (period === "month") {
    return {
      eyebrow: "Resultado do mês",
      value: `${months[start.getMonth()]} de ${start.getFullYear()}`,
    };
  }

  return {
    eyebrow: "Resultado do ano",
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

function isOperationalExpenseCategory(category?: string | null) {
  const normalized = normalizeCategory(category);

  return normalized === "combustivel" || normalized === "carregamento";
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

function hasRegisteredData(summary?: OperationalResultSummary | null) {
  if (!summary) return false;

  return (
    Number(summary.revenue ?? 0) > 0 ||
    Number(summary.operationalExpenses ?? 0) > 0 ||
    Number(summary.operationalFuelExpenses ?? 0) > 0 ||
    Number(summary.operationalChargingExpenses ?? 0) > 0 ||
    Number(summary.operationalResult ?? 0) !== 0 ||
    Number(summary.totalHours ?? 0) > 0 ||
    Number(summary.totalKm ?? 0) > 0 ||
    Number(summary.revenuePerHour ?? 0) > 0 ||
    Number(summary.revenuePerKm ?? 0) > 0
  );
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

function getOperationalExpenseVisual(summary?: OperationalResultSummary | null): {
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


function normalizeSummaryOverride(
  summaryOverride: OperationalResultSummaryOverride | null | undefined,
  period: DashboardPeriod,
  referenceDate: Date,
): OperationalResultSummary | null {
  if (!summaryOverride) return null;

  const fallbackRange = getPeriodRange(period, referenceDate);
  const revenue = Number(summaryOverride.revenue ?? 0);
  const operationalExpenses = Number(summaryOverride.operationalExpenses ?? 0);
  const totalHours = Number(summaryOverride.totalHours ?? 0);
  const totalKm = Number(summaryOverride.totalKm ?? 0);
  const operationalResult = Number(
    summaryOverride.operationalResult ?? revenue - operationalExpenses,
  );
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
    operationalResult,
    totalHours,
    totalKm,
    revenuePerHour,
    revenuePerKm,
    startDate: Number.isNaN(startDate.getTime()) ? fallbackRange.start : startDate,
    endDate: Number.isNaN(endDate.getTime()) ? fallbackRange.end : endDate,
  };
}


function MiniInfoCard({
  label,
  value,
  percent,
  icon,
  color,
}: {
  label: string;
  value: string;
  percent: string;
  icon: IconName;
  color: string;
}) {
  return (
    <View style={styles.miniCard}>
      <View style={[styles.miniIconBox, { backgroundColor: `${color}16`, borderColor: `${color}34` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>

      <View style={styles.miniContent}>
        <View style={styles.miniHeaderRow}>
          <Text style={styles.miniLabel} numberOfLines={1}>
            {label}
          </Text>

          <Text style={[styles.miniPercent, { color }]} numberOfLines={1}>
            {percent}
          </Text>
        </View>

        <Text style={styles.miniValue} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function OperationalResultCard({
  period,
  referenceDate,
  style,
  cardStyle,
  showRefreshButton = false,
  showDetailsButton = true,
  detailsButtonLabel = "Ver detalhes",
  summaryOverride,
  onDetailsPress,
  onLoaded,
}: OperationalResultCardProps) {
  const [summary, setSummary] = useState<OperationalResultSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const parsedReferenceDate = useMemo(
    () => normalizeDate(referenceDate),
    [referenceDate],
  );

  const normalizedSummaryOverride = useMemo(
    () => normalizeSummaryOverride(summaryOverride, period, parsedReferenceDate),
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

      const nextSummary = {
        revenue,
        operationalExpenses: operationalExpenses.total,
        operationalFuelExpenses: operationalExpenses.fuel,
        operationalChargingExpenses: operationalExpenses.charging,
        operationalResult: revenue - operationalExpenses.total,
        totalHours,
        totalKm,
        revenuePerHour: totalHours > 0 ? revenue / totalHours : 0,
        revenuePerKm: totalKm > 0 ? revenue / totalKm : 0,
        startDate,
        endDate,
      };

      setSummary(nextSummary);
      onLoaded?.(nextSummary);
    } catch (error) {
      console.log("Erro ao carregar resultado operacional:", error);
      const fallbackRange = getPeriodRange(period, parsedReferenceDate);

      setSummary({
        revenue: 0,
        operationalExpenses: 0,
        operationalFuelExpenses: 0,
        operationalChargingExpenses: 0,
        operationalResult: 0,
        totalHours: 0,
        totalKm: 0,
        revenuePerHour: 0,
        revenuePerKm: 0,
        startDate: fallbackRange.start,
        endDate: fallbackRange.end,
      });
    } finally {
      setLoading(false);
    }
  }, [onLoaded, parsedReferenceDate, period]);

  useEffect(() => {
    if (normalizedSummaryOverride) {
      setSummary(normalizedSummaryOverride);
      setLoading(false);
      return;
    }

    loadSummary();
  }, [loadSummary, normalizedSummaryOverride]);

  const periodTitleParts = summary
    ? getPeriodTitleParts(period, summary.startDate, summary.endDate)
    : getPeriodTitleParts(
        period,
        getPeriodRange(period, parsedReferenceDate).start,
        getPeriodRange(period, parsedReferenceDate).end,
      );

  const balance = Number(summary?.operationalResult ?? 0);
  const balancePositive = balance >= 0;
  const balanceColor = balancePositive ? "#22C55E" : "#EF4444";
  const operationalExpenseVisual = getOperationalExpenseVisual(summary);
  const revenue = Number(summary?.revenue ?? 0);
  const operationalExpensesPercent = formatPercent(
    getRevenuePercent(Number(summary?.operationalExpenses ?? 0), revenue),
  );
  const balancePercent = formatPercent(getRevenuePercent(balance, revenue));
  const hasData = hasRegisteredData(summary);
  const canShowDetailsButton = showDetailsButton;

  const handleOpenDetails = useCallback((event?: any) => {
    event?.stopPropagation?.();
    setDetailsVisible(true);
  }, []);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.headerSideBox} />

        <View style={styles.headerCenter}>
          <Text style={styles.headerEyebrow} numberOfLines={1}>
            {periodTitleParts.eyebrow}
          </Text>
          <Text style={styles.headerDate} numberOfLines={2}>
            {periodTitleParts.value}
          </Text>
        </View>

        {showRefreshButton ? (
          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.refreshButton}
            onPress={loadSummary}
            disabled={loading}
          >
            <Ionicons name="refresh-outline" size={16} color="#F5F0E6" />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSideBox} />
        )}
      </View>

      <View style={[styles.card, cardStyle]}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#D4A64A" />
            <Text style={styles.loadingText}>Carregando resultado...</Text>
          </View>
        ) : !hasData ? (
          <View style={styles.emptyDataBox}>
            <View style={styles.emptyDataIconBox}>
              <Ionicons name="analytics-outline" size={20} color="#93C5FD" />
            </View>

            <Text style={styles.emptyDataTitle}>Sem dados registrados</Text>
            <Text style={styles.emptyDataText}>
              Nenhuma jornada, faturamento ou despesa operacional foi encontrada neste período.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.revenueHighlight}>
              <View style={styles.revenueIconBox}>
                <Ionicons name="trending-up-outline" size={19} color="#BFDBFE" />
              </View>

              <View style={styles.revenueContent}>
                <Text style={styles.revenueLabel}>Faturamento</Text>
                <Text style={styles.revenueValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatCompactCurrency(summary?.revenue ?? 0)}
                </Text>
              </View>
            </View>

            <View style={styles.detailsRow}>
              <MiniInfoCard
                label={operationalExpenseVisual.label}
                value={formatCompactCurrency(summary?.operationalExpenses ?? 0)}
                percent={operationalExpensesPercent}
                icon={operationalExpenseVisual.icon}
                color="#EF4444"
              />

              <MiniInfoCard
                label="Saldo"
                value={formatCompactCurrency(balance)}
                percent={balancePercent}
                icon={balancePositive ? "checkmark-circle-outline" : "warning-outline"}
                color={balanceColor}
              />
            </View>

            {canShowDetailsButton ? (
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.detailsButton}
                onPress={handleOpenDetails}
              >
                <View style={styles.detailsButtonIconBox}>
                  <Ionicons name="list-outline" size={16} color="#FDE68A" />
                </View>

                <Text style={styles.detailsButtonText} numberOfLines={1}>
                  {detailsButtonLabel}
                </Text>

                <Ionicons name="chevron-forward" size={17} color="#FDE68A" />
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>

      <RevenueDetailsModal
        visible={detailsVisible}
        onClose={() => setDetailsVisible(false)}
        period={period}
        referenceDate={parsedReferenceDate}
        summaryOverride={
          normalizedSummaryOverride
            ? {
                revenue: normalizedSummaryOverride.revenue,
                operationalExpenses: normalizedSummaryOverride.operationalExpenses,
                operationalFuelExpenses:
                  normalizedSummaryOverride.operationalFuelExpenses,
                operationalChargingExpenses:
                  normalizedSummaryOverride.operationalChargingExpenses,
                balance: normalizedSummaryOverride.operationalResult,
                totalHours: normalizedSummaryOverride.totalHours,
                totalKm: normalizedSummaryOverride.totalKm,
                revenuePerHour: normalizedSummaryOverride.revenuePerHour,
                revenuePerKm: normalizedSummaryOverride.revenuePerKm,
                startDate: normalizedSummaryOverride.startDate,
                endDate: normalizedSummaryOverride.endDate,
              }
            : undefined
        }
      />
    </View>
  );
}

export default OperationalResultCard;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 9,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerSideBox: {
    height: 32,
    width: 32,
  },
  headerCenter: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  headerEyebrow: {
    color: "#B9AA7A",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 3,
    textAlign: "center",
    textTransform: "uppercase",
  },
  headerDate: {
    color: "#FDE68A",
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 21,
    textAlign: "center",
  },
  refreshButton: {
    alignItems: "center",
    backgroundColor: "#18171B",
    borderColor: "#2A2830",
    borderRadius: 12,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  card: {
    backgroundColor: "#0B0B0F",
    borderColor: "#25222A",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    padding: 12,
  },
  loadingBox: {
    alignItems: "center",
    gap: 8,
    minHeight: 136,
    justifyContent: "center",
  },
  loadingText: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyDataBox: {
    alignItems: "center",
    backgroundColor: "#101014",
    borderColor: "#25222A",
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 110,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyDataIconBox: {
    alignItems: "center",
    backgroundColor: "rgba(59,130,246,0.14)",
    borderColor: "rgba(96,165,250,0.28)",
    borderRadius: 15,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    marginBottom: 9,
    width: 38,
  },
  emptyDataTitle: {
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyDataText: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 5,
    textAlign: "center",
  },
  revenueHighlight: {
    alignItems: "center",
    backgroundColor: "rgba(59,130,246,0.13)",
    borderColor: "rgba(96,165,250,0.34)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 86,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  revenueIconBox: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(59,130,246,0.18)",
    borderColor: "rgba(191,219,254,0.28)",
    borderRadius: 15,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  revenueContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
    paddingRight: 38,
  },
  revenueLabel: {
    color: "#BFDBFE",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginBottom: 3,
    textAlign: "center",
    textTransform: "uppercase",
  },
  revenueValue: {
    color: "#F8FAFC",
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  detailsRow: {
    flexDirection: "row",
    gap: 9,
    marginTop: 10,
  },
  detailsButton: {
    alignItems: "center",
    backgroundColor: "rgba(212,166,74,0.10)",
    borderColor: "rgba(253,230,138,0.24)",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    marginTop: 10,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  detailsButtonIconBox: {
    alignItems: "center",
    backgroundColor: "rgba(250,204,21,0.12)",
    borderColor: "rgba(253,230,138,0.26)",
    borderRadius: 11,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  detailsButtonText: {
    color: "#FDE68A",
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  miniCard: {
    alignItems: "center",
    backgroundColor: "#101014",
    borderColor: "#25222A",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 64,
    justifyContent: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  miniIconBox: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  miniContent: {
    flex: 1,
    minWidth: 0,
  },
  miniHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "space-between",
    marginBottom: 4,
  },
  miniLabel: {
    color: "#9B969B",
    flex: 1,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.25,
    textAlign: "left",
    textTransform: "uppercase",
  },
  miniPercent: {
    fontSize: 10,
    fontWeight: "900",
    textAlign: "right",
  },
  miniValue: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "left",
  },
});
