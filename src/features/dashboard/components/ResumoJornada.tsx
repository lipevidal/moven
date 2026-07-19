import { useMemo } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type IconName = keyof typeof Ionicons.glyphMap;

export type ResumoJornadaData = {
  id?: string | number | null;

  started_at?: string | Date | null;
  startedAt?: string | Date | null;
  start_time?: string | Date | null;
  startTime?: string | Date | null;

  finished_at?: string | Date | null;
  finishedAt?: string | Date | null;
  ended_at?: string | Date | null;
  endedAt?: string | Date | null;
  end_time?: string | Date | null;
  endTime?: string | Date | null;

  date?: string | Date | null;
  referenceDate?: string | Date | null;

  totalHours?: number | string | null;
  total_hours?: number | string | null;
  hours?: number | string | null;
  duration_hours?: number | string | null;

  totalKm?: number | string | null;
  total_km?: number | string | null;
  km?: number | string | null;
  distance_km?: number | string | null;

  revenue?: number | string | null;
  faturamento?: number | string | null;
  total_earnings?: number | string | null;
  totalEarnings?: number | string | null;
  earnings?: number | string | null;
  amount?: number | string | null;

  revenuePerHour?: number | string | null;
  gainPerHour?: number | string | null;
  earningsPerHour?: number | string | null;

  revenuePerKm?: number | string | null;
  gainPerKm?: number | string | null;
  earningsPerKm?: number | string | null;
};

type ResumoJornadaProps = {
  jornada?: ResumoJornadaData | null;
  title?: string;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
};

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const months = [
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

function parseDate(value?: string | Date | null) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getFirstDate(...values: (string | Date | null | undefined)[]) {
  for (const value of values) {
    const date = parseDate(value);

    if (date) return date;
  }

  return null;
}

function getNumber(value?: number | string | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const rawValue = String(value ?? "").trim();

  if (!rawValue) return 0;

  const normalizedValue = rawValue.includes(",")
    ? rawValue.replace(/\./g, "").replace(",", ".")
    : rawValue;

  const number = Number(normalizedValue);

  return Number.isFinite(number) ? number : 0;
}

function formatDateLabel(date?: Date | null) {
  if (!date) return "--";

  return `${weekDays[date.getDay()]}, ${String(date.getDate()).padStart(
    2,
    "0",
  )} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTime(date?: Date | null) {
  if (!date) return "--:--";

  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function formatHoursToHHMM(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "00:00";

  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatKm(value: number) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

function formatCurrency(value: number) {
  return `R$ ${Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getDurationHours(
  jornada: ResumoJornadaData,
  startedAt?: Date | null,
  finishedAt?: Date | null,
) {
  const storedHours =
    getNumber(jornada.totalHours) ||
    getNumber(jornada.total_hours) ||
    getNumber(jornada.hours) ||
    getNumber(jornada.duration_hours);

  if (storedHours > 0) return storedHours;

  if (startedAt && finishedAt) {
    return Math.max((finishedAt.getTime() - startedAt.getTime()) / 1000 / 60 / 60, 0);
  }

  return 0;
}

function hasJornadaData(jornada?: ResumoJornadaData | null) {
  if (!jornada) return false;

  return Boolean(
    jornada.started_at ||
      jornada.startedAt ||
      jornada.start_time ||
      jornada.startTime ||
      jornada.finished_at ||
      jornada.finishedAt ||
      jornada.ended_at ||
      jornada.endedAt ||
      jornada.end_time ||
      jornada.endTime ||
      jornada.date ||
      jornada.referenceDate ||
      getNumber(jornada.totalHours) > 0 ||
      getNumber(jornada.total_hours) > 0 ||
      getNumber(jornada.hours) > 0 ||
      getNumber(jornada.duration_hours) > 0 ||
      getNumber(jornada.totalKm) > 0 ||
      getNumber(jornada.total_km) > 0 ||
      getNumber(jornada.km) > 0 ||
      getNumber(jornada.distance_km) > 0 ||
      getNumber(jornada.revenue) > 0 ||
      getNumber(jornada.faturamento) > 0 ||
      getNumber(jornada.total_earnings) > 0 ||
      getNumber(jornada.totalEarnings) > 0 ||
      getNumber(jornada.earnings) > 0 ||
      getNumber(jornada.amount) > 0,
  );
}

export function ResumoJornada({
  jornada,
  title = "Jornada do dia",
  accentColor = "#22C55E",
  style,
}: ResumoJornadaProps) {
  const summary = useMemo(() => {
    if (!jornada || !hasJornadaData(jornada)) {
      return null;
    }

    const startedAt = getFirstDate(
      jornada.started_at,
      jornada.startedAt,
      jornada.start_time,
      jornada.startTime,
      jornada.date,
      jornada.referenceDate,
    );

    const finishedAt = getFirstDate(
      jornada.finished_at,
      jornada.finishedAt,
      jornada.ended_at,
      jornada.endedAt,
      jornada.end_time,
      jornada.endTime,
    );

    const referenceDate =
      startedAt || getFirstDate(jornada.date, jornada.referenceDate) || finishedAt;

    const hours = getDurationHours(jornada, startedAt, finishedAt);
    const km =
      getNumber(jornada.totalKm) ||
      getNumber(jornada.total_km) ||
      getNumber(jornada.km) ||
      getNumber(jornada.distance_km);

    const revenue =
      getNumber(jornada.revenue) ||
      getNumber(jornada.faturamento) ||
      getNumber(jornada.total_earnings) ||
      getNumber(jornada.totalEarnings) ||
      getNumber(jornada.earnings) ||
      getNumber(jornada.amount);

    const revenuePerHour =
      getNumber(jornada.revenuePerHour) ||
      getNumber(jornada.gainPerHour) ||
      getNumber(jornada.earningsPerHour) ||
      (hours > 0 ? revenue / hours : 0);

    const revenuePerKm =
      getNumber(jornada.revenuePerKm) ||
      getNumber(jornada.gainPerKm) ||
      getNumber(jornada.earningsPerKm) ||
      (km > 0 ? revenue / km : 0);

    return {
      startedAt,
      finishedAt,
      referenceDate,
      hours,
      km,
      revenue,
      revenuePerHour,
      revenuePerKm,
    };
  }, [jornada]);

  if (!summary) {
    return (
      <View style={[styles.card, style]}>
        <View style={styles.header}>
          <View style={[styles.headerIconBox, { backgroundColor: `${accentColor}1F` }]}>
            <Ionicons name="calendar-outline" size={18} color={accentColor} />
          </View>

          <View style={styles.headerTextBox}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.dateText}>Sem dados para exibir</Text>
          </View>
        </View>

        <View style={styles.emptyBox}>
          <Ionicons name="analytics-outline" size={22} color="#8F8A91" />
          <Text style={styles.emptyTitle}>Sem dados</Text>
          <Text style={styles.emptyText}>
            Nenhuma jornada foi encontrada para este período.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={[styles.headerIconBox, { backgroundColor: `${accentColor}1F` }]}>
          <Ionicons name="calendar-outline" size={18} color={accentColor} />
        </View>

        <View style={styles.headerTextBox}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.dateText}>{formatDateLabel(summary.referenceDate)}</Text>
        </View>
      </View>

      <View style={styles.topMetricsRow}>
        <CompactMetricCard
          icon="play-outline"
          label="Início"
          value={formatTime(summary.startedAt)}
          color="#60A5FA"
        />

        <CompactMetricCard
          icon="flag-outline"
          label="Final"
          value={summary.finishedAt ? formatTime(summary.finishedAt) : "Aberta"}
          color="#FACC15"
        />

        <CompactMetricCard
          icon="time-outline"
          label="Tempo"
          value={formatHoursToHHMM(summary.hours)}
          color="#A78BFA"
        />
      </View>

      <View style={styles.revenueCard}>
        <View style={[styles.revenueIconBox, { backgroundColor: `${accentColor}1F` }]}>
          <Ionicons name="cash-outline" size={18} color={accentColor} />
        </View>

        <View style={styles.revenueTextBox}>
          <Text style={styles.revenueLabel}>Faturamento</Text>
          <Text style={styles.revenueValue}>{formatCurrency(summary.revenue)}</Text>
        </View>
      </View>

      <View style={styles.bottomMetricsRow}>
        <SmallMetricCard
          icon="speedometer-outline"
          label="KM rodados"
          value={`${formatKm(summary.km)} km`}
          color="#2DD4BF"
        />

        <SmallMetricCard
          icon="map-outline"
          label="Ganhos/km"
          value={formatCurrency(summary.revenuePerKm)}
          color="#FB923C"
        />

        <SmallMetricCard
          icon="trending-up-outline"
          label="Ganhos/h"
          value={formatCurrency(summary.revenuePerHour)}
          color="#38BDF8"
        />
      </View>
    </View>
  );
}

function CompactMetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: IconName;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.compactMetricCard}>
      <View style={[styles.compactMetricIconBox, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>

      <Text style={styles.compactMetricLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.compactMetricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SmallMetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: IconName;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.smallMetricCard}>
      <View style={[styles.smallMetricIconBox, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>

      <Text style={styles.smallMetricLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.smallMetricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default ResumoJornada;

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#0B0B0F",
    borderWidth: 1,
    borderColor: "#25222A",
    padding: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.26,
    shadowRadius: 22,
    elevation: 8,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  headerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextBox: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#F5F0E6",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  dateText: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  topMetricsRow: {
    flexDirection: "row",
    gap: 7,
    marginTop: 13,
  },
  compactMetricCard: {
    flex: 1,
    minHeight: 74,
    borderRadius: 16,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#25222A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 9,
    position: "relative",
  },
  compactMetricIconBox: {
    position: "absolute",
    left: 8,
    top: "50%",
    marginTop: -14.5,
    width: 29,
    height: 29,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  compactMetricLabel: {
    color: "#8F8A91",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.25,
    textAlign: "center",
  },
  compactMetricValue: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 3,
    textAlign: "center",
  },
  revenueCard: {
    position: "relative",
    minHeight: 76,
    borderRadius: 18,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#25222A",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    paddingHorizontal: 56,
    paddingVertical: 12,
  },
  revenueIconBox: {
    position: "absolute",
    left: 12,
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  revenueTextBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  revenueLabel: {
    color: "#8F8A91",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.35,
    textAlign: "center",
  },
  revenueValue: {
    color: "#F5F0E6",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 3,
    textAlign: "center",
  },
  bottomMetricsRow: {
    flexDirection: "row",
    gap: 7,
    marginTop: 8,
  },
  smallMetricCard: {
    flex: 1,
    minHeight: 68,
    borderRadius: 16,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#25222A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    paddingVertical: 8,
  },
  smallMetricIconBox: {
    width: 27,
    height: 27,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  smallMetricLabel: {
    color: "#8F8A91",
    fontSize: 8.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  smallMetricValue: {
    color: "#F5F0E6",
    fontSize: 11.5,
    fontWeight: "900",
    marginTop: 3,
    textAlign: "center",
  },
  emptyBox: {
    minHeight: 112,
    borderRadius: 18,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#25222A",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    marginTop: 13,
  },
  emptyTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 8,
  },
  emptyText: {
    color: "#8F8A91",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "center",
    marginTop: 4,
  },
});
