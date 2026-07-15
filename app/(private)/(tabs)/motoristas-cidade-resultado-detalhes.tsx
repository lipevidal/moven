import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../../../src/database/supabase";

type IconName = keyof typeof Ionicons.glyphMap;
type DashboardPeriod = "turn" | "day" | "week" | "month" | "year";

type BreakdownItem = {
  id?: string;
  label?: string;
  description?: string;
  amount?: number | string | null;
  date?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  hours?: number | string | null;
  km?: number | string | null;
  revenue?: number | string | null;
};

const amountKeys = [
  "amount",
  "value",
  "total",
  "gross_amount",
  "revenue",
  "earning",
  "earnings",
  "total_earnings",
  "fare",
  "price",
];

const dateKeys = [
  "earning_date",
  "expense_date",
  "work_date",
  "session_date",
  "date",
  "created_at",
  "started_at",
  "finished_at",
  "ended_at",
  "received_at",
  "registered_at",
];

function parseSnapshot(rawValue: unknown) {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  if (!value || typeof value !== "string") return {};

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function getNumericCurrencyValue(value?: number | string | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const rawValue = String(value ?? "").trim();
  if (!rawValue) return 0;

  const normalizedValue = rawValue.includes(",")
    ? rawValue.replace(/\./g, "").replace(",", ".")
    : rawValue;

  const amount = Number(normalizedValue);
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(value?: number | string | null) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCompactNumber(value?: number | string | null) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
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

function formatDateTime(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPeriodLabel(period?: DashboardPeriod) {
  if (period === "turn") return "Turno";
  if (period === "day") return "Dia";
  if (period === "week") return "Semana";
  if (period === "month") return "Mês";
  if (period === "year") return "Ano";

  return "Período";
}

function getFirstValue(row: any, keys: string[]) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") {
      return row[key];
    }
  }

  return null;
}

function getRowAmount(row: any) {
  return getNumericCurrencyValue(getFirstValue(row, amountKeys));
}

function getRowDate(row: any) {
  const value = getFirstValue(row, dateKeys);
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getRangeStart(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) return new Date();

  date.setHours(0, 0, 0, 0);
  return date;
}

function getRangeEnd(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) return new Date();

  date.setHours(23, 59, 59, 999);
  return date;
}

function isDateInsideRange(date: Date | null, start?: string | Date, end?: string | Date) {
  if (!date) return false;

  const startDate = getRangeStart(start);
  const endDate = getRangeEnd(end);

  return date.getTime() >= startDate.getTime() && date.getTime() <= endDate.getTime();
}

function getPlatformName(row: any, platformNames: Record<string, string> = {}) {
  const platformObjectName =
    row?.platforms?.name ||
    row?.platforms?.title ||
    row?.platform_data?.name ||
    row?.platformData?.name ||
    row?.platform_info?.name;

  const platformId = String(row?.platform_id || row?.platformId || "").trim();
  const platformSlug = String(row?.platform_slug || row?.platform || "").trim();

  return String(
    platformObjectName ||
      row?.platform_name ||
      row?.platform_label ||
      row?.platform_title ||
      platformNames[platformId] ||
      platformNames[platformSlug] ||
      row?.platform ||
      row?.platform_slug ||
      row?.source ||
      row?.app_name ||
      "Sem plataforma",
  ).trim();
}

function buildPlatformBreakdown(
  rows: any[],
  platformNames: Record<string, string> = {},
  fallbackTotal = 0,
) {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    const amount = getRowAmount(row);
    if (amount <= 0) return;

    const name = getPlatformName(row, platformNames);
    map.set(name, (map.get(name) ?? 0) + amount);
  });

  const items = Array.from(map.entries())
    .map(([label, amount]) => ({ label, amount }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20);

  if (items.length === 0 && fallbackTotal > 0) {
    return [{ label: "Total do período", amount: fallbackTotal }];
  }

  return items;
}

function getRevenuePeriodBuckets(period: DashboardPeriod) {
  if (period === "week") {
    return ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  }

  if (period === "month") {
    return ["Semana 1", "Semana 2", "Semana 3", "Semana 4", "Semana 5"];
  }

  if (period === "year") {
    return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  }

  return [];
}

function getRevenuePeriodLabel(date: Date, period: DashboardPeriod) {
  if (period === "year") {
    return getRevenuePeriodBuckets("year")[date.getMonth()] ?? "";
  }

  if (period === "month") {
    return `Semana ${Math.min(Math.floor((date.getDate() - 1) / 7) + 1, 5)}`;
  }

  if (period === "week") {
    const day = date.getDay();
    const index = day === 0 ? 6 : day - 1;
    return getRevenuePeriodBuckets("week")[index] ?? "";
  }

  return "";
}

function buildRevenueByPeriod(
  rows: any[],
  period: DashboardPeriod,
  fallbackLabel: string,
  fallbackTotal: number,
) {
  const buckets = getRevenuePeriodBuckets(period);
  if (buckets.length === 0) return [];

  const map = new Map<string, number>();
  buckets.forEach((label) => map.set(label, 0));

  rows.forEach((row) => {
    const date = getRowDate(row);
    if (!date) return;

    const label = getRevenuePeriodLabel(date, period);
    if (!label) return;

    map.set(label, (map.get(label) ?? 0) + getRowAmount(row));
  });

  const items = buckets.map((label) => ({
    label,
    amount: map.get(label) ?? 0,
  }));

  const hasAnyRevenue = items.some((item) => item.amount > 0);

  if (!hasAnyRevenue && fallbackTotal > 0 && buckets.length > 0) {
    return items.map((item, index) =>
      index === 0 ? { ...item, amount: fallbackTotal } : item,
    );
  }

  return items;
}

function buildExpenseDetails(rows: any[], hiddenExpenseIds: string[]) {
  return rows
    .filter((expense) => !hiddenExpenseIds.includes(String(expense?.id)))
    .map((expense) => ({
      id: String(expense?.id ?? Math.random()),
      label: String(expense?.category || expense?.description || "Despesa"),
      description: String(expense?.description || ""),
      amount: getNumericCurrencyValue(expense?.amount),
      date: expense?.expense_date || expense?.date || expense?.created_at || null,
    }))
    .filter((item) => item.amount > 0)
    .slice(0, 80);
}

function getSessionStartDate(row: any) {
  const value = row?.started_at || row?.start_time || row?.created_at || row?.date;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getSessionEndDate(row: any) {
  const value = row?.finished_at || row?.ended_at || row?.end_time || row?.closed_at;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getSessionHours(row: any) {
  const storedHours = Number(
    row?.totalHours ??
      row?.total_hours ??
      row?.hours ??
      row?.worked_hours ??
      row?.duration_hours ??
      0,
  );

  if (Number.isFinite(storedHours) && storedHours > 0) return storedHours;

  const start = getSessionStartDate(row);
  const end = getSessionEndDate(row);

  if (!start || !end) return 0;

  return Math.max((end.getTime() - start.getTime()) / 1000 / 60 / 60, 0);
}

function getSessionKm(row: any) {
  const storedKm = Number(
    row?.totalKm ??
      row?.total_km ??
      row?.km ??
      row?.distance_km ??
      row?.distance ??
      0,
  );

  if (Number.isFinite(storedKm) && storedKm > 0) return storedKm;

  const startKm = Number(row?.start_km ?? row?.initial_km ?? 0);
  const endKm = Number(row?.end_km ?? row?.final_km ?? 0);

  if (Number.isFinite(startKm) && Number.isFinite(endKm) && endKm > startKm) {
    return endKm - startKm;
  }

  return 0;
}

function getSessionRevenue(session: any) {
  const value = Number(
    session?.total_earnings ??
      session?.totalEarnings ??
      session?.earnings ??
      session?.revenue ??
      session?.amount ??
      session?.gross_amount ??
      0,
  );

  return Number.isFinite(value) ? value : 0;
}

function buildDailySessions(rows: any[]) {
  return rows
    .map((session, index) => {
      const start = getSessionStartDate(session);
      const end = getSessionEndDate(session);

      return {
        id: String(session?.id ?? index),
        label:
          session?.platform ||
          session?.platform_name ||
          session?.platform_slug ||
          `Turno ${index + 1}`,
        startedAt: start?.toISOString() ?? null,
        endedAt: end?.toISOString() ?? null,
        hours: getSessionHours(session),
        km: getSessionKm(session),
        revenue: getSessionRevenue(session),
      };
    })
    .slice(0, 60);
}

function buildRevenueRowsFromSessions(rows: any[]) {
  return rows.map((session, index) => ({
    ...session,
    id: session?.id ?? `session-${index}`,
    amount: getSessionRevenue(session),
    created_at:
      session?.started_at ||
      session?.start_time ||
      session?.created_at ||
      session?.date ||
      null,
    platform_name:
      session?.platform_name ||
      session?.platform ||
      session?.platform_slug ||
      session?.vehicle_name ||
      `Turno ${index + 1}`,
  }));
}

function getTotalAmount(items: BreakdownItem[]) {
  return items.reduce((total, item) => total + Number(item.amount ?? 0), 0);
}

function MetricCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: IconName;
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <View style={styles.metricIconBox}>
          <Ionicons name={icon} size={15} color="#D4A64A" />
        </View>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      {helper ? <Text style={styles.metricHelper}>{helper}</Text> : null}
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyBox}>
      <Ionicons name="information-circle-outline" size={24} color="#8F8A91" />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: IconName;
  children: any;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconBox}>
          <Ionicons name={icon} size={17} color="#D4A64A" />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const chartPalette = [
  "#D4A64A",
  "#22C55E",
  "#60A5FA",
  "#A78BFA",
  "#F97316",
  "#EF4444",
  "#2DD4BF",
  "#FACC15",
];

function getPlatformIconName(label?: string | null): IconName {
  const value = String(label ?? "").toLowerCase();

  if (value.includes("uber")) return "car-sport-outline";
  if (value.includes("99")) return "car-outline";
  if (value.includes("ifood") || value.includes("rappi") || value.includes("zé") || value.includes("ze"))
    return "fast-food-outline";
  if (
    value.includes("mercado") ||
    value.includes("lalamove") ||
    value.includes("loggi") ||
    value.includes("shopee")
  )
    return "cube-outline";
  if (value.includes("particular") || value.includes("indrive"))
    return "person-outline";

  return "apps-outline";
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    x,
    y,
    "L",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    "Z",
  ].join(" ");
}

function PlatformPieChart({
  items,
  total,
}: {
  items: BreakdownItem[];
  total: number;
}) {
  const chartItems = items
    .map((item, index) => ({
      ...item,
      amount: Number(item.amount ?? 0),
      color: chartPalette[index % chartPalette.length],
    }))
    .filter((item) => item.amount > 0);

  let currentAngle = 0;

  return (
    <View style={styles.platformChartCard}>
      <View style={styles.platformPieWrap}>
        <Svg width={184} height={184} viewBox="0 0 184 184">
          <Circle cx={92} cy={92} r={82} fill="#18171D" />
          {chartItems.map((item, index) => {
            const slicePercent = total > 0 ? item.amount / total : 0;
            const sliceAngle = Math.max(slicePercent * 360, 3);
            const startAngle = currentAngle;
            const endAngle =
              index === chartItems.length - 1 ? 360 : currentAngle + sliceAngle;
            currentAngle = endAngle;

            return (
              <Path
                key={`${item.label}-${index}`}
                d={describeArc(92, 92, 82, startAngle, endAngle)}
                fill={item.color}
              />
            );
          })}
          <Circle cx={92} cy={92} r={44} fill="#101014" />
        </Svg>

        <View style={styles.platformPieCenter}>
          <Text style={styles.platformPieCenterLabel}>Total</Text>
          <Text style={styles.platformPieCenterValue}>
            R$ {formatCurrency(total)}
          </Text>
        </View>
      </View>

      <View style={styles.platformLegendList}>
        {chartItems.map((item, index) => {
          const amount = Number(item.amount ?? 0);
          const percent = total > 0 ? Math.round((amount / total) * 100) : 0;

          return (
            <View key={`${item.label}-${index}`} style={styles.platformLegendRow}>
              <View
                style={[
                  styles.platformLegendIcon,
                  { backgroundColor: item.color },
                ]}
              >
                <Ionicons
                  name={getPlatformIconName(item.label)}
                  size={15}
                  color="#080808"
                />
              </View>

              <View style={styles.platformLegendInfo}>
                <Text style={styles.platformLegendTitle} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.platformLegendSubtitle}>
                  {percent}% do faturamento
                </Text>
              </View>

              <Text style={styles.platformLegendValue}>
                R$ {formatCurrency(amount)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function VerticalRevenueChart({
  items,
  total,
}: {
  items: BreakdownItem[];
  total: number;
}) {
  const maxAmount = Math.max(
    ...items.map((item) => Number(item.amount ?? 0)),
    1,
  );

  return (
    <View style={styles.verticalChartCard}>
      <View style={styles.verticalChartBars}>
        {items.map((item, index) => {
          const amount = Number(item.amount ?? 0);
          const height = Math.max((amount / maxAmount) * 118, amount > 0 ? 12 : 4);

          return (
            <View key={`${item.label}-${index}`} style={styles.verticalBarItem}>
              <Text style={styles.verticalBarValue} numberOfLines={1}>
                {amount > 0 ? `R$ ${formatCompactNumber(amount)}` : "—"}
              </Text>
              <View style={styles.verticalBarTrack}>
                <View style={[styles.verticalBarFill, { height }]} />
              </View>
              <Text style={styles.verticalBarLabel} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.verticalChartFooter}>
        Total do período: R$ {formatCurrency(total)}
      </Text>
    </View>
  );
}

export default function CommunityResultDetailsScreen() {
  const params = useLocalSearchParams();
  const initialSnapshot = useMemo(
    () => parseSnapshot(params.snapshot),
    [params.snapshot],
  );
  const [snapshot, setSnapshot] = useState<any>(initialSnapshot);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const revenue = Number(snapshot?.revenue ?? 0);
  const expenses = Number(snapshot?.expenses ?? 0);
  const profit = Number(snapshot?.profit ?? revenue - expenses);
  const totalHours = Number(snapshot?.totalHours ?? 0);
  const totalKm = Number(snapshot?.totalKm ?? 0);
  const revenuePerHour = Number(snapshot?.revenuePerHour ?? 0);
  const revenuePerKm = Number(snapshot?.revenuePerKm ?? 0);
  const period = snapshot?.period as DashboardPeriod | undefined;
  const referenceLabel = String(snapshot?.referenceLabel || getPeriodLabel(period));
  const hiddenExpenseIds = Array.isArray(snapshot?.hiddenExpenseIds)
    ? snapshot.hiddenExpenseIds.map(String)
    : [];
  const platformBreakdown = Array.isArray(snapshot?.platformBreakdown)
    ? (snapshot.platformBreakdown as BreakdownItem[])
    : [];
  const revenueByPeriod = Array.isArray(snapshot?.revenueByPeriod)
    ? (snapshot.revenueByPeriod as BreakdownItem[])
    : [];
  const expenseDetails = Array.isArray(snapshot?.expenseDetails)
    ? (snapshot.expenseDetails as BreakdownItem[])
    : [];
  const dailySessions = Array.isArray(snapshot?.dailySessions)
    ? (snapshot.dailySessions as BreakdownItem[])
    : [];
  const platformTotal = getTotalAmount(platformBreakdown);
  const revenuePeriodTotal = getTotalAmount(revenueByPeriod);
  const showRevenueChart = period === "week" || period === "month" || period === "year";

  useEffect(() => {
    const needsDetails =
      platformBreakdown.length === 0 ||
      (showRevenueChart && revenueByPeriod.length === 0) ||
      expenseDetails.length === 0 ||
      ((period === "day" || period === "turn") && dailySessions.length === 0);

    if (needsDetails) {
      void loadMissingDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPlatformNames() {
    try {
      const { data, error } = await supabase.from("platforms").select("*");

      if (error) return {};

      return (data ?? []).reduce((acc: Record<string, string>, platform: any) => {
        const name = String(platform?.name || platform?.title || "").trim();
        if (!name) return acc;

        if (platform?.id) acc[String(platform.id)] = name;
        if (platform?.slug) acc[String(platform.slug)] = name;
        if (platform?.code) acc[String(platform.code)] = name;

        return acc;
      }, {});
    } catch {
      return {};
    }
  }

  async function loadEarningsForDetails(userId: string, startDate: string, endDate: string) {
    try {
      let response = await supabase
        .from("earnings")
        .select("*, platforms(*)")
        .eq("user_id", userId)
        .limit(3000);

      if (response.error) {
        response = await supabase
          .from("earnings")
          .select("*")
          .eq("user_id", userId)
          .limit(3000);
      }

      if (response.error) return [];

      return (response.data ?? []).filter((row: any) =>
        isDateInsideRange(getRowDate(row), startDate, endDate),
      );
    } catch {
      return [];
    }
  }

  async function loadExpensesForDetails(userId: string, startDate: string, endDate: string) {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", userId)
        .gte("expense_date", new Date(startDate).toISOString())
        .lte("expense_date", new Date(endDate).toISOString())
        .limit(1000);

      if (error) return [];

      return data ?? [];
    } catch {
      return [];
    }
  }

  async function loadSessionsForDetails(userId: string, startDate: string, endDate: string) {
    try {
      const { data, error } = await supabase
        .from("work_sessions")
        .select("*")
        .eq("user_id", userId)
        .limit(1000);

      if (error) return [];

      return (data ?? []).filter((row: any) =>
        isDateInsideRange(getRowDate(row) || getSessionStartDate(row), startDate, endDate),
      );
    } catch {
      return [];
    }
  }

  async function loadMissingDetails() {
    const userId = String(snapshot?.userId || "").trim();
    const startDate = snapshot?.startDate;
    const endDate = snapshot?.endDate;

    if (!userId || !startDate || !endDate) return;

    try {
      setLoadingDetails(true);

      const [earningsRows, expenseRows, sessionRows, platformNames] =
        await Promise.all([
          loadEarningsForDetails(userId, startDate, endDate),
          loadExpensesForDetails(userId, startDate, endDate),
          loadSessionsForDetails(userId, startDate, endDate),
          loadPlatformNames(),
        ]);

      const sessionRevenueRows = buildRevenueRowsFromSessions(sessionRows);
      const revenueRows = earningsRows.length > 0 ? earningsRows : sessionRevenueRows;

      setSnapshot((current: any) => ({
        ...current,
        platformBreakdown:
          current?.platformBreakdown?.length > 0
            ? current.platformBreakdown
            : buildPlatformBreakdown(revenueRows, platformNames, revenue),
        revenueByPeriod:
          current?.revenueByPeriod?.length > 0
            ? current.revenueByPeriod
            : buildRevenueByPeriod(
                revenueRows,
                period || "week",
                referenceLabel,
                revenue,
              ),
        expenseDetails: buildExpenseDetails(expenseRows, hiddenExpenseIds),
        dailySessions:
          period === "day" || period === "turn"
            ? current?.dailySessions?.length > 0
              ? current.dailySessions
              : buildDailySessions(sessionRows)
            : current?.dailySessions ?? [],
      }));
    } finally {
      setLoadingDetails(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color="#F5F0E6" />
        </TouchableOpacity>

        <View style={styles.headerTextContent}>
          <Text style={styles.headerEyebrow}>Resultados e Metas</Text>
          <Text style={styles.headerTitle}>Detalhes do resultado</Text>
          <Text style={styles.headerSubtitle}>
            {getPeriodLabel(period)} · {referenceLabel}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loadingDetails ? (
          <View style={styles.loadingDetailsBox}>
            <ActivityIndicator color="#D4A64A" />
            <Text style={styles.loadingDetailsText}>
              Buscando detalhes do período...
            </Text>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={styles.heroIconBox}>
            <Ionicons name="trending-up-outline" size={22} color="#BBF7D0" />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroLabel}>Lucro</Text>
            <Text style={styles.heroValue}>R$ {formatCurrency(profit)}</Text>
            <Text style={styles.heroHelper}>
              Resultado detalhado do período selecionado.
            </Text>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard
            icon="cash-outline"
            label="Faturamento"
            value={`R$ ${formatCurrency(revenue)}`}
          />
          <MetricCard
            icon="remove-circle-outline"
            label="Despesas"
            value={`R$ ${formatCurrency(expenses)}`}
          />
        </View>

        <View style={styles.metricGrid}>
          <MetricCard
            icon="time-outline"
            label="Horas"
            value={formatHoursToHHMM(totalHours)}
          />
          <MetricCard
            icon="speedometer-outline"
            label="KM"
            value={formatCompactNumber(totalKm)}
          />
        </View>

        <View style={styles.metricGrid}>
          <MetricCard
            icon="timer-outline"
            label="Ganhos/h"
            value={`R$ ${formatCurrency(revenuePerHour)}`}
          />
          <MetricCard
            icon="navigate-outline"
            label="Ganhos/km"
            value={`R$ ${formatCurrency(revenuePerKm)}`}
          />
        </View>

        <Section title="Ganhos por plataforma" icon="apps-outline">
          {platformBreakdown.length > 0 ? (
            <PlatformPieChart items={platformBreakdown} total={platformTotal} />
          ) : (
            <EmptyState text="Não foi possível detalhar os ganhos por plataforma nesse resultado." />
          )}
        </Section>

        {showRevenueChart ? (
          <Section title="Faturamento por período" icon="bar-chart-outline">
            {revenueByPeriod.length > 0 ? (
              <VerticalRevenueChart
                items={revenueByPeriod}
                total={revenuePeriodTotal}
              />
            ) : (
              <EmptyState text="Nenhum faturamento por período foi encontrado." />
            )}
          </Section>
        ) : null}

        <Section
          title={period === "week" ? "Despesas da semana" : "Despesas do período"}
          icon="receipt-outline"
        >
          {expenseDetails.length > 0 ? (
            expenseDetails.map((item, index) => (
              <View key={`${item.id}-${index}`} style={styles.detailRow}>
                <View style={styles.detailRowIcon}>
                  <Ionicons name="card-outline" size={16} color="#FCA5A5" />
                </View>
                <View style={styles.detailRowInfo}>
                  <Text style={styles.detailRowTitle}>{item.label}</Text>
                  {item.description ? (
                    <Text style={styles.detailRowSubtitle}>{item.description}</Text>
                  ) : null}
                </View>
                <Text style={styles.expenseValue}>
                  R$ {formatCurrency(item.amount)}
                </Text>
              </View>
            ))
          ) : (
            <EmptyState text="Nenhuma despesa foi encontrada para esse período ou todas foram ocultadas." />
          )}
        </Section>

        {period === "day" || period === "turn" ? (
          <Section
            title={period === "turn" ? "Turno compartilhado" : "Turnos do dia"}
            icon="briefcase-outline"
          >
            {dailySessions.length > 0 ? (
              dailySessions.map((item, index) => (
                <View key={`${item.id}-${index}`} style={styles.sessionCard}>
                  <View style={styles.sessionHeader}>
                    <Text style={styles.sessionTitle}>
                      {item.label || `Turno ${index + 1}`}
                    </Text>
                    <Text style={styles.sessionRevenue}>
                      R$ {formatCurrency(item.revenue)}
                    </Text>
                  </View>
                  <View style={styles.sessionGrid}>
                    <Text style={styles.sessionInfo}>
                      Início: {formatDateTime(item.startedAt) || "-"}
                    </Text>
                    <Text style={styles.sessionInfo}>
                      Fim: {formatDateTime(item.endedAt) || "-"}
                    </Text>
                    <Text style={styles.sessionInfo}>
                      Horas: {formatHoursToHHMM(item.hours)}
                    </Text>
                    <Text style={styles.sessionInfo}>
                      KM: {formatCompactNumber(item.km)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <EmptyState text="Nenhum turno foi encontrado para esse dia." />
            )}
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#050505" },
  container: { flex: 1, backgroundColor: "#050505" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 18,
    backgroundColor: "#070707",
    borderBottomWidth: 1,
    borderBottomColor: "#211D16",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContent: { flex: 1, minWidth: 0 },
  headerEyebrow: {
    color: "#D4A64A",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: "#F5F0E6",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 2,
  },
  headerSubtitle: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 120,
  },
  loadingDetailsBox: {
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  loadingDetailsText: {
    color: "#D4A64A",
    fontSize: 12,
    fontWeight: "800",
  },
  heroCard: {
    borderRadius: 18,
    backgroundColor: "#052E16",
    borderWidth: 1,
    borderColor: "#166534",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroIconBox: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "rgba(187,247,208,0.10)",
    borderWidth: 1,
    borderColor: "rgba(187,247,208,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: { flex: 1, minWidth: 0 },
  heroLabel: {
    color: "#BBF7D0",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 3,
  },
  heroHelper: {
    color: "#86EFAC",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  metricGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 10,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  metricIconBox: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: "rgba(212,166,74,0.09)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    flex: 1,
    color: "#9B969B",
    fontSize: 10,
    fontWeight: "800",
  },
  metricValue: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 7,
  },
  metricHelper: {
    color: "#FACC15",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  section: {
    borderRadius: 18,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 12,
    marginTop: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
  },
  sectionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "rgba(212,166,74,0.09)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  platformChartCard: {
    borderRadius: 18,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.18)",
    padding: 12,
  },
  platformPieWrap: {
    alignSelf: "center",
    width: 184,
    height: 184,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  platformPieCenter: {
    position: "absolute",
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  platformPieCenterLabel: {
    color: "#9B969B",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  platformPieCenterValue: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 3,
    textAlign: "center",
  },
  platformLegendList: {
    gap: 8,
  },
  platformLegendRow: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  platformLegendIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  platformLegendInfo: {
    flex: 1,
    minWidth: 0,
  },
  platformLegendTitle: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "900",
  },
  platformLegendSubtitle: {
    color: "#9B969B",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  platformLegendValue: {
    color: "#D4A64A",
    fontSize: 11,
    fontWeight: "900",
  },
  verticalChartCard: {
    borderRadius: 18,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.18)",
    padding: 12,
  },
  verticalChartBars: {
    minHeight: 174,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 6,
  },
  verticalBarItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: 0,
  },
  verticalBarValue: {
    color: "#D4A64A",
    fontSize: 9,
    fontWeight: "900",
    marginBottom: 5,
    maxWidth: 54,
  },
  verticalBarTrack: {
    width: "100%",
    maxWidth: 28,
    height: 122,
    borderRadius: 999,
    backgroundColor: "rgba(245,240,230,0.06)",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  verticalBarFill: {
    width: "100%",
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    backgroundColor: "#D4A64A",
  },
  verticalBarLabel: {
    color: "#9B969B",
    fontSize: 9,
    fontWeight: "900",
    marginTop: 7,
    maxWidth: 54,
    textAlign: "center",
  },
  verticalChartFooter: {
    color: "#F5F0E6",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 12,
    textAlign: "center",
  },
  detailRow: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 10,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  detailRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#101014",
    alignItems: "center",
    justifyContent: "center",
  },
  detailRowInfo: { flex: 1, minWidth: 0 },
  detailRowTitle: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "900",
  },
  detailRowSubtitle: {
    color: "#9B969B",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  detailRowValue: {
    color: "#86EFAC",
    fontSize: 12,
    fontWeight: "900",
  },
  expenseValue: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
  },
  periodRow: {
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 10,
    marginTop: 8,
  },
  periodRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  periodLabel: {
    flex: 1,
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "900",
  },
  periodValue: {
    color: "#86EFAC",
    fontSize: 12,
    fontWeight: "900",
  },
  periodTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "#0B0B0D",
    marginTop: 9,
    overflow: "hidden",
  },
  periodFill: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "#D4A64A",
  },
  sessionCard: {
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 10,
    marginTop: 8,
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sessionTitle: {
    flex: 1,
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
  },
  sessionRevenue: {
    color: "#86EFAC",
    fontSize: 12,
    fontWeight: "900",
  },
  sessionGrid: {
    marginTop: 8,
    gap: 4,
  },
  sessionInfo: {
    color: "#BDB6AA",
    fontSize: 11,
    fontWeight: "700",
  },
  emptyBox: {
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 14,
    alignItems: "center",
    gap: 7,
  },
  emptyText: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
  },
});
