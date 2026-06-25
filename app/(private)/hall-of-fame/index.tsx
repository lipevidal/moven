import { useEffect, useState } from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";

import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getHallOfFameV2 } from "../../../src/features/rankings/services/getHallOfFameV2";

type ChallengeType = "day" | "week" | "month";
type VehicleType = "carro" | "moto";
type ScopeType = "regional" | "nacional";

export default function HallOfFameScreen() {
  const [challengeType, setChallengeType] = useState<ChallengeType>("day");
  const [vehicleType, setVehicleType] = useState<VehicleType>("carro");
  const [scope, setScope] = useState<ScopeType>("regional");
  const [region, setRegion] = useState("Belo Horizonte");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  const periods = [
    { label: "Dia", value: "day" },
    { label: "Semana", value: "week" },
    { label: "Mês", value: "month" },
  ] as const;

  const vehicles = [
    { label: "Carro", value: "carro" },
    { label: "Moto", value: "moto" },
  ] as const;

  const scopes = [
    { label: "Regional", value: "regional" },
    { label: "Nacional", value: "nacional" },
  ] as const;

  const regions = ["Belo Horizonte", "São Paulo", "Rio de Janeiro"];

  useEffect(() => {
    loadHallOfFame();
  }, [challengeType, vehicleType, scope, region]);

  async function loadHallOfFame() {
    try {
      setLoading(true);

      const response = await getHallOfFameV2({
        challengeType,
        vehicleType,
        scope,
        region: scope === "regional" ? region : undefined,
      });

      setItems(response);
    } catch (error) {
      console.log(error);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadHallOfFame();
  }

  function getPeriodLabel() {
    if (challengeType === "day") return "Diário";
    if (challengeType === "week") return "Semanal";
    return "Mensal";
  }

  function getTrophyIcon(index: number) {
    if (index === 0) return "🏆";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `${index + 1}º`;
  }

  function formatCurrency(value: number) {
    return Number(value ?? 0)
      .toFixed(2)
      .replace(".", ",");
  }

  function formatDate(value: string) {
    if (!value) return "";

    return new Date(value).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
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

        <View>
          <Text style={styles.title}>Hall da Fama</Text>
          <Text style={styles.subtitle}>
            Os maiores faturamentos já registrados.
          </Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroIconBox}>
          <Ionicons name="trophy-outline" size={34} color="#FACC15" />
        </View>

        <Text style={styles.heroTitle}>Recordistas RotaCash</Text>
        <Text style={styles.heroText}>
          Aqui ficam os motoristas e entregadores que atingiram os maiores
          faturamentos validados em cada categoria.
        </Text>
      </View>

      <View style={styles.filtersCard}>
        <Text style={styles.filterTitle}>Período</Text>
        <View style={styles.optionsRow}>
          {periods.map((item) => (
            <Option
              key={item.value}
              label={item.label}
              active={challengeType === item.value}
              onPress={() => setChallengeType(item.value)}
            />
          ))}
        </View>

        <Text style={styles.filterTitle}>Veículo</Text>
        <View style={styles.optionsRow}>
          {vehicles.map((item) => (
            <Option
              key={item.value}
              label={item.label}
              active={vehicleType === item.value}
              onPress={() => setVehicleType(item.value)}
            />
          ))}
        </View>

        <Text style={styles.filterTitle}>Tipo</Text>
        <View style={styles.optionsRow}>
          {scopes.map((item) => (
            <Option
              key={item.value}
              label={item.label}
              active={scope === item.value}
              onPress={() => setScope(item.value)}
            />
          ))}
        </View>

        {scope === "regional" && (
          <>
            <Text style={styles.filterTitle}>Região</Text>
            <View style={styles.regionList}>
              {regions.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.regionOption,
                    region === item && styles.regionOptionActive,
                  ]}
                  onPress={() => setRegion(item)}
                >
                  <Text
                    style={[
                      styles.regionOptionText,
                      region === item && styles.regionOptionTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Recordes {getPeriodLabel()}</Text>
          <Text style={styles.sectionSubtitle}>
            {vehicleType === "carro" ? "Carro" : "Moto"} •{" "}
            {scope === "regional" ? region : "Nacional"}
          </Text>
        </View>

        <Text style={styles.sectionCount}>{items.length}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#22C55E" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="trophy-outline" size={46} color="#71717A" />
          <Text style={styles.emptyTitle}>Nenhum recorde encontrado</Text>
          <Text style={styles.emptyText}>
            Ainda não existem resultados aprovados para estes filtros.
          </Text>
        </View>
      ) : (
        items.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.recordCard, index < 3 && styles.recordCardPodium]}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: "/(private)/perfil/[userId]",
                params: { userId: item.user_id },
              })
            }
          >
            <View
              style={[
                styles.positionBox,
                index === 0 && styles.positionGold,
                index === 1 && styles.positionSilver,
                index === 2 && styles.positionBronze,
              ]}
            >
              <Text style={styles.positionText}>{getTrophyIcon(index)}</Text>
            </View>

            {item.user?.avatar_url ? (
              <Image
                source={{ uri: item.user.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={22} color="#FFFFFF" />
              </View>
            )}

            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.user?.full_name || item.user?.name || "Motorista"}
              </Text>
              <Text style={styles.userMeta}>
                {formatDate(item.created_at)} • {item.region ?? "Brasil"}
              </Text>
            </View>

            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Recorde</Text>
              <Text style={styles.amountValue}>
                R$ {formatCurrency(item.approved_amount)}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

function Option({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.option, active && styles.optionActive]}
      onPress={onPress}
    >
      <Text style={[styles.optionText, active && styles.optionTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090B" },
  content: { padding: 18, paddingTop: 54, paddingBottom: 130 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 22,
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
  title: { color: "#FFFFFF", fontSize: 26, fontWeight: "900" },
  subtitle: { color: "#A1A1AA", fontSize: 13, fontWeight: "600", marginTop: 3 },
  heroCard: {
    backgroundColor: "#2A2408",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#713F12",
    padding: 18,
    marginBottom: 16,
  },
  heroIconBox: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: "#3F2E05",
    borderWidth: 1,
    borderColor: "#A16207",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
  heroText: {
    color: "#FDE68A",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: 8,
  },
  filtersCard: {
    backgroundColor: "#111827",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 16,
    marginBottom: 18,
  },
  filterTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 10,
    marginTop: 6,
  },
  optionsRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  option: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  optionActive: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  optionText: { color: "#A1A1AA", fontSize: 12, fontWeight: "900" },
  optionTextActive: { color: "#FFFFFF" },
  regionList: { gap: 8 },
  regionOption: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  regionOptionActive: { backgroundColor: "#14532D", borderColor: "#22C55E" },
  regionOptionText: { color: "#A1A1AA", fontSize: 13, fontWeight: "800" },
  regionOptionTextActive: { color: "#FFFFFF" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  sectionTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  sectionSubtitle: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  sectionCount: { color: "#22C55E", fontSize: 16, fontWeight: "900" },
  loadingBox: {
    minHeight: 220,
    borderRadius: 24,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBox: {
    minHeight: 260,
    borderRadius: 24,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 12,
  },
  emptyText: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
  },
  recordCard: {
    minHeight: 84,
    borderRadius: 22,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  recordCardPodium: { backgroundColor: "#14140A", borderColor: "#3F3F16" },
  positionBox: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  positionGold: { backgroundColor: "#2A2408", borderColor: "#FACC15" },
  positionSilver: { backgroundColor: "#1F2937", borderColor: "#CBD5E1" },
  positionBronze: { backgroundColor: "#2A1607", borderColor: "#F97316" },
  positionText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  avatar: { width: 48, height: 48, borderRadius: 999, marginRight: 12 },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#27272A",
    borderWidth: 1,
    borderColor: "#3F3F46",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  userInfo: { flex: 1 },
  userName: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  userMeta: { color: "#A1A1AA", fontSize: 11, fontWeight: "700", marginTop: 4 },
  amountBox: { alignItems: "flex-end", marginLeft: 8 },
  amountLabel: { color: "#71717A", fontSize: 10, fontWeight: "800" },
  amountValue: {
    color: "#FACC15",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 4,
  },
});
