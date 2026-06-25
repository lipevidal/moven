import { useCallback, useState } from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";

import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getMyRecords } from "../../../src/features/records/services/getMyRecords";

type RecordTab = "journey" | "day" | "week" | "month" | "year" | "efficiency";

const tabs: { label: string; value: RecordTab }[] = [
  { label: "Jornada", value: "journey" },
  { label: "Dia", value: "day" },
  { label: "Semana", value: "week" },
  { label: "Mês", value: "month" },
  { label: "Ano", value: "year" },
  { label: "Eficiência", value: "efficiency" },
];

export default function MyRecordsScreen() {
  const [selectedTab, setSelectedTab] = useState<RecordTab>("journey");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, []),
  );

  async function loadRecords() {
    try {
      setLoading(true);
      const response = await getMyRecords();
      setRecords(response);
    } catch (error) {
      console.log(error);
      setRecords(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadRecords();
  }

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

  function formatHours(value: number) {
    const totalMinutes = Math.round((value ?? 0) * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function formatDate(value?: string | null) {
    if (!value) return "Data não informada";

    return new Date(value).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getSelectedPeriodRecord() {
    if (!records) return null;
    if (selectedTab === "day") return records.day;
    if (selectedTab === "week") return records.week;
    if (selectedTab === "month") return records.month;
    if (selectedTab === "year") return records.year;
    return null;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#22C55E"
        />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Meus recordes</Text>
          <Text style={styles.subtitle}>
            Seus melhores resultados.
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.value}
            style={[styles.tab, selectedTab === tab.value && styles.tabActive]}
            onPress={() => setSelectedTab(tab.value)}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === tab.value && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#22C55E" />
        </View>
      ) : selectedTab === "journey" ? (
        <JourneyRecordCard
          title="Jornada com maior faturamento"
          icon="rocket-outline"
          record={records?.journeyRevenue}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          formatHours={formatHours}
          formatNumber={formatNumber}
        />
      ) : selectedTab === "efficiency" ? (
        <View>
          <JourneyRecordCard
            title="Maior ganho por hora"
            icon="time-outline"
            record={records?.bestPerHour}
            valuePrefix="R$"
            value={records?.bestPerHour?.revenue_per_hour}
            valueSuffix="/h"
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            formatHours={formatHours}
            formatNumber={formatNumber}
          />

          <JourneyRecordCard
            title="Maior ganho por KM"
            icon="speedometer-outline"
            record={records?.bestPerKm}
            valuePrefix="R$"
            value={records?.bestPerKm?.revenue_per_km}
            valueSuffix="/km"
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            formatHours={formatHours}
            formatNumber={formatNumber}
          />
        </View>
      ) : (
        <PeriodRecordCard
          tab={selectedTab}
          record={getSelectedPeriodRecord()}
          formatCurrency={formatCurrency}
        />
      )}
    </ScrollView>
  );
}

function JourneyRecordCard({
  title,
  icon,
  record,
  valuePrefix,
  value,
  valueSuffix,
  formatCurrency,
  formatDate,
  formatHours,
  formatNumber,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  record: any;
  valuePrefix?: string;
  value?: number;
  valueSuffix?: string;
  formatCurrency: (value: number) => string;
  formatDate: (value?: string | null) => string;
  formatHours: (value: number) => string;
  formatNumber: (value: number) => string;
}) {
  if (!record) {
    return <EmptyRecord title={title} />;
  }

  const mainValue =
    value !== undefined
      ? `${valuePrefix ?? ""} ${formatCurrency(value)}${valueSuffix ?? ""}`
      : `R$ ${formatCurrency(record.amount)}`;

  return (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={styles.recordIconBox}>
          <Ionicons name={icon} size={28} color="#22C55E" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.recordTitle}>{title}</Text>
          <Text style={styles.recordSubtitle}>
            {formatDate(record.started_at)}
          </Text>
        </View>
      </View>

      <Text style={styles.recordMainValue}>{mainValue}</Text>

      <View style={styles.metricsGrid}>
        <Metric
          label="Faturamento"
          value={`R$ ${formatCurrency(record.amount)}`}
        />
        <Metric label="Tempo" value={`${formatHours(record.total_hours)}h`} />
        <Metric label="KM" value={`${formatNumber(record.total_km)} km`} />
        <Metric
          label="Ganho/h"
          value={`R$ ${formatCurrency(record.revenue_per_hour)}`}
        />
        <Metric
          label="Ganho/km"
          value={`R$ ${formatCurrency(record.revenue_per_km)}`}
        />
      </View>
    </View>
  );
}

function PeriodRecordCard({
  tab,
  record,
  formatCurrency,
}: {
  tab: RecordTab;
  record: any;
  formatCurrency: (value: number) => string;
}) {
  if (!record) {
    return <EmptyRecord title="Nenhum recorde encontrado" />;
  }

  const titleMap: Record<string, string> = {
    day: "Dia com maior faturamento",
    week: "Semana com maior faturamento",
    month: "Mês com maior faturamento",
    year: "Ano com maior faturamento",
  };

  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    day: "calendar-outline",
    week: "calendar-number-outline",
    month: "calendar-clear-outline",
    year: "trophy-outline",
  };

  return (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={styles.recordIconBox}>
          <Ionicons name={iconMap[tab]} size={28} color="#22C55E" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.recordTitle}>{titleMap[tab]}</Text>
          <Text style={styles.recordSubtitle}>{record.label}</Text>
        </View>
      </View>

      <Text style={styles.recordMainValue}>
        R$ {formatCurrency(record.amount)}
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>Período do recorde</Text>
        <Text style={styles.infoValue}>{record.label}</Text>
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function EmptyRecord({ title }: { title: string }) {
  return (
    <View style={styles.emptyBox}>
      <Ionicons name="podium-outline" size={48} color="#71717A" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>
        Assim que houver dados suficientes, seu recorde aparecerá aqui.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090B" },
  content: { padding: 18, paddingTop: 54, paddingBottom: 130 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" },
  subtitle: { color: "#A1A1AA", fontSize: 13, fontWeight: "600", marginTop: 3 },
  tabs: { gap: 8, paddingBottom: 16 },
  tab: {
    height: 40,
    borderRadius: 999,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  tabText: { color: "#A1A1AA", fontSize: 12, fontWeight: "900" },
  tabTextActive: { color: "#FFFFFF" },
  loadingBox: {
    minHeight: 260,
    borderRadius: 26,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },
  recordCard: {
    backgroundColor: "#111827",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 18,
    marginBottom: 14,
  },
  recordHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  recordIconBox: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "#052E16",
    borderWidth: 1,
    borderColor: "#166534",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  recordTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  recordSubtitle: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    textTransform: "capitalize",
  },
  recordMainValue: {
    color: "#22C55E",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 16,
  },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricBox: {
    width: "47.8%",
    minHeight: 66,
    borderRadius: 17,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    padding: 10,
    justifyContent: "center",
  },
  metricLabel: { color: "#A1A1AA", fontSize: 10, fontWeight: "800" },
  metricValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 5,
  },
  infoBox: {
    borderRadius: 18,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    padding: 14,
  },
  infoLabel: { color: "#A1A1AA", fontSize: 11, fontWeight: "800" },
  infoValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 5,
    textTransform: "capitalize",
  },
  emptyBox: {
    minHeight: 260,
    borderRadius: 26,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    marginVertical: 10
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 12,
    textAlign: "center",
  },
  emptyText: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
  },
});
