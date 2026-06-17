import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Calendar } from "react-native-calendars";
import { PieChart } from 'react-native-gifted-charts';

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

import {
  getDashboardData,
  DashboardPeriod,
} from "../../../src/features/dashboard/services/getDashboardData";

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

export default function DashboardScreen() {
  const [period, setPeriod] = useState<DashboardPeriod>("week");
  const [periodTab, setPeriodTab] = useState<DashboardPeriod>("week");
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [data, setData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [periodModalVisible, setPeriodModalVisible] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, [period, referenceDate]);

  async function loadDashboard() {
    try {
      const response = await getDashboardData(period, referenceDate);

      setData(response);
      setUser(response?.user ?? null);
    } catch (error) {
      console.log(error);
    }
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
    data.revenue > 0 ? Math.round((Number(data.expenses) / Number(data.revenue)) * 100) : 0;

  const profitPercent =
    data.revenue > 0 ? Math.round((Number(data.profit) / Number(data.revenue)) * 100) : 0;

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

  const colors = [
    '#22C55E',
    '#3B82F6',
    '#F59E0B',
    '#8B5CF6',
    '#EF4444',
    '#14B8A6',
    '#EC4899',
  ];

  const pieData = Object.entries(data.platformTotals ?? {})
    .filter(([_, value]) => Number(value) > 0)
    .map(([platform, value]: any, index) => ({
      value: Number(value),
      text: `${(
        (Number(value) / Number(data.revenue)) *
        100
      ).toFixed(0)}%`,
      color: colors[index % colors.length],
      label: platform,
    }));

  const barChartData = data?.barChartData ?? [];
  const maxBarValue = Math.max(...barChartData.map((item: any) => item.value), 1);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.header}>
          <View style={{flexDirection: 'row'}}>
            <TouchableOpacity
              onPress={() => router.push("/(private)/(tabs)/perfil" as never)}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.userAvatar}
                />
              ) : (
                <View style={styles.userAvatarFallback}>
                  <Ionicons name="person" size={24} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            <View style={{marginLeft: 10}}>
              <Text style={styles.greeting}>
                Olá, {user?.user_metadata?.name?.split(' ')[0] ?? 'Motorista'} 👋
              </Text>
              <Text style={styles.title}>Dashboard</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIconButton}>
              <Ionicons
                name="notifications-outline"
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => router.push('/(private)/timeline')}
            >
              <Ionicons
                name="newspaper-outline"
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() =>
                router.push('/(private)/conversas')
              }
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.periodTabs}>
          {periodOptions.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.periodTab,
                period === item.value && styles.periodTabActive,
              ]}
              onPress={() => {
                setPeriod(item.value);
                setPeriodTab(item.value);
              }}
            >
              <Text
                style={[
                  styles.periodTabText,
                  period === item.value && styles.periodTabTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.periodSelectorCard}
          onPress={openPeriodModal}
        >
          <TouchableOpacity
            style={styles.periodArrowButton}
            onPress={() => changePeriod("prev")}
          >
            <Ionicons name="chevron-back" size={28} color="#84CC16" />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.periodSelectorTitle}>{periodLabel}</Text>

            <Text style={styles.periodSelectorSubtitle}>
              Toque para filtros avançados
            </Text>
          </View>

          <TouchableOpacity
            style={styles.periodArrowButton}
            onPress={() => changePeriod("next")}
          >
            <Ionicons name="chevron-forward" size={28} color="#84CC16" />
          </TouchableOpacity>
        </TouchableOpacity>

        <View style={styles.profitCard}>
          <View style={styles.profitHeader}>
            <View>
              <View style={{flexDirection:'row', gap: '10', alignItems: 'center'}}>
                <Ionicons name="trending-up-outline" size={22} color="#22C55E" />
                <Text style={styles.cardLabel}>Lucro líquido</Text>
              </View>
              <Text style={styles.profitValue}>
                R$ {formatCurrency(data.profit)}
              </Text>
            </View>

            <View
              style={[
                styles.variationBadge,
                profitVariationPositive
                  ? styles.variationPositive
                  : styles.variationNegative,
              ]}
            >
              <Ionicons
                name={profitVariationPositive ? "arrow-up" : "arrow-down"}
                size={14}
                color="#FFFFFF"
              />

              <Text style={styles.variationText}>
                {formatDecimal(Math.abs(Number(data.revenueVariation ?? 0)))}%
              </Text>
            </View>
          </View>

          

          <Text style={styles.profitPercentText}>
            {formatDecimal(profitPercent)}% do faturamento virou lucro
          </Text>
        </View>

        <View style={styles.mainGrid}>
          <View style={styles.metricCardFat}>
            <View style={{flexDirection:'row', gap: '10', alignItems: 'center'}}>
              <Ionicons name="cash-outline" size={22} color="#1E3A8A" />
              <Text style={styles.metricLabel}>Faturamento</Text>
            </View>

            <Text style={styles.metricValue}>
              R$ {formatCurrency(data.revenue)}
            </Text>
          </View>

          <View style={styles.metricCardDes}>
            <View style={{flexDirection:'row', gap: '10', alignItems: 'center'}}>
              <Ionicons name="wallet-outline" size={22} color="#EF4444" />
              <Text style={styles.metricLabel}>Despesas</Text>
            </View>

            <Text style={styles.metricValueRed}>
              R$ {formatCurrency(data.expenses)}
            </Text>

            <Text style={styles.metricSubText}>
              {formatDecimal(expensesPercent)}% do faturamento
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={{flexDirection:'row', gap: '10', alignItems: 'center'}}>
              <Ionicons name="time-outline" size={22} color="#3B82F6" />
              <Text style={styles.statLabel}>Tempo</Text>
            </View>
            <Text style={styles.statValue}>
              {formatHours(data.totalHours)}
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={{flexDirection:'row', gap: '10', alignItems: 'center'}}>
              <Ionicons name="speedometer-outline" size={22} color="#F59E0B" />
              <Text style={styles.statLabel}>KM</Text>
            </View>
            <Text style={styles.statValue}>{formatNumber(data.totalKm)}</Text>
          </View>

          <View style={styles.statCard}>
            <View style={{flexDirection:'row', gap: '10', alignItems: 'center'}}>
              <Ionicons name="trending-up-outline" size={22} color="#22C55E" />
              <Text style={styles.statLabel}>Ganho/h</Text>
            </View>
            <Text style={styles.statValue}>
              R$ {formatDecimal(data.revenuePerHour)}
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={{flexDirection:'row', gap: '10', alignItems: 'center'}}>
              <Ionicons name="navigate-outline" size={22} color="#8B5CF6" />
              <Text style={styles.statLabel}>Ganho/km</Text>
            </View>
            <Text style={styles.statValue}>
              R$ {formatDecimal(data.revenuePerKm)}
            </Text>
          </View>
        </View>

        <View style={styles.pieCard}>
          <Text style={styles.sectionTitle}>
            Ganhos por plataforma
          </Text>

          {pieData.length === 0 ? (
            <Text style={styles.emptyText}>
              Nenhum ganho neste período.
            </Text>
          ) : (
            <>
              <View style={styles.pieWrapper}>
                <PieChart
                  data={pieData}
                  donut
                  radius={92}
                  innerRadius={48}
                  innerCircleColor={'#27272A'}
                  textColor="#FFFFFF"
                  fontWeight="900"
                  textSize={12}
                  labelsPosition="outward"
                  showText
                  centerLabelComponent={() => (
                    <View style={styles.pieCenter}>
                      <Text style={styles.pieCenterLabel}>
                        Total
                      </Text>

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
                        {
                          backgroundColor: item.color,
                        },
                      ]}
                    />

                    <View style={{ flex: 1 }}>
                      <Text style={styles.pieLegendName}>
                        {item.label}
                      </Text>

                      <Text style={styles.pieLegendPercent}>
                        {item.text}
                      </Text>
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

        {period !== 'day' && (
          <View style={styles.barChartCard}>
            <Text style={styles.sectionTitle}>
              Faturamento por período
            </Text>

            <View style={styles.barChartWrapper}>
              {barChartData.map((item: any) => {
                const height = Math.max((item.value / maxBarValue) * 150, 8);

                return (
                  <View key={item.label} style={styles.barItem}>
                    <Text style={styles.barValue}>
                      {formatCurrency(item.value)}
                    </Text>

                    <View
                      style={[
                        styles.barColumn,
                        {
                          height,
                        },
                      ]}
                    />

                    <Text style={styles.barLabel}>
                      {item.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {data.nextRevision && (
          <View style={styles.alertCard}>
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
        )}
      </ScrollView>

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
  title: { color: "#FFFFFF", fontSize: 30, fontWeight: "900" },
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
    backgroundColor: '#18181B',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 14,
  },

  pieWrapper: {
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: '#27272A',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
    overflow: 'hidden',
  },

  pieSlice: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 999,
    borderWidth: 38,
    borderColor: '#22C55E',
    borderLeftColor: '#3B82F6',
    borderBottomColor: '#F59E0B',
    borderRightColor: '#8B5CF6',
  },

  pieCenter: {
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },

  pieCenterLabel: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '800',
  },

  pieCenterValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
  },

  pieLegend: {
    gap: 12,
  },

  pieLegendItem: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  pieLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },

  pieLegendName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  pieLegendPercent: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
  },

  pieLegendValue: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '900',
  },
  platformChartCard: {
    backgroundColor: '#18181B',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 16,
  },

  platformLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  platformLegendColor: {
    width: 14,
    height: 14,
    borderRadius: 999,
    marginRight: 12,
  },

  platformLegendName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  platformLegendPercent: {
    color: '#A1A1AA',
    fontSize: 12,
  },

  platformLegendValue: {
    color: '#22C55E',
    fontWeight: '900',
    fontSize: 14,
  },
  barChartCard: {
    backgroundColor: '#18181B',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 16,
  },

  barChartWrapper: {
    height: 230,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 20,
  },

  barItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  barValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 8,
  },

  barColumn: {
    width: 34,
    borderRadius: 10,
    backgroundColor: '#22C55E',
  },
  barLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
