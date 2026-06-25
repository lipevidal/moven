import { useEffect, useState } from "react";

import { View, Text, StyleSheet, ActivityIndicator } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import {
  getAchievementChallengesProgress,
  getDefaultAchievementProgress,
  AchievementChallengeProgress,
} from "../services/getAchievementChallengesProgress";

type AchievementProgressCardsProps = {
  title?: string;
};

export function AchievementProgressCards({
  title = "Desafios",
}: AchievementProgressCardsProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AchievementChallengeProgress[]>(
    getDefaultAchievementProgress(),
  );

  useEffect(() => {
    loadProgress();
  }, []);

  async function loadProgress() {
    try {
      setLoading(true);
      const response = await getAchievementChallengesProgress();
      setItems(
        response.length > 0 ? response : getDefaultAchievementProgress(),
      );
    } catch (error) {
      console.log(error);
      setItems(getDefaultAchievementProgress());
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{alignItems: 'center'}}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            Acompanhe o progresso dos seus desafios.
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#22C55E" />
        </View>
      ) : null}

      <View style={styles.list}>
        {items.map((item) => (
          <ProgressCard key={item.key} item={item} />
        ))}
      </View>
    </View>
  );
}

function ProgressCard({ item }: { item: AchievementChallengeProgress }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconBox}>
          <Text style={styles.rewardIcon}>{item.rewardIcon}</Text>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDescription}>{item.description}</Text>
        </View>
      </View>

      <View style={styles.rewardLine}>
        <View style={styles.rewardPill}>
          <Text style={styles.rewardPillText}>
            {item.rewardIcon} {item.rewardLabel}
          </Text>
        </View>

        <View style={styles.xpPill}>
          <Ionicons name="flash" size={12} color="#FACC15" />
          <Text style={styles.xpPillText}>{item.rewardXp} XP</Text>
        </View>
      </View>

      <View style={styles.progressInfo}>
        <Text style={styles.progressLabel}>{item.progressLabel}</Text>
        <Text style={styles.remainingText}>{item.remainingText}</Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${item.progressPercent}%` as `${number}%` },
          ]}
        />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.percentText}>
          {Math.round(item.progressPercent)}%
        </Text>
        <Text style={styles.statusText}>{item.statusText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 14 },
  header: { marginBottom: 12, alignItems: 'center', marginTop: 20 },
  title: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" },
  subtitle: { color: "#A1A1AA", fontSize: 12, fontWeight: "700", marginTop: 4, },
  loadingBox: {
    minHeight: 80,
    borderRadius: 24,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  list: { gap: 12 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  rewardIcon: { fontSize: 28 },
  cardInfo: { flex: 1 },
  cardTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  cardDescription: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
    marginTop: 3,
  },
  rewardLine: { flexDirection: "row", gap: 8, marginBottom: 12 },
  rewardPill: {
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardPillText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  xpPill: {
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: "#2A2408",
    borderWidth: 1,
    borderColor: "#713F12",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  xpPillText: { color: "#FACC15", fontSize: 11, fontWeight: "900" },
  progressInfo: { marginBottom: 8 },
  progressLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  remainingText: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#18181B",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#22C55E",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  percentText: { color: "#22C55E", fontSize: 12, fontWeight: "900" },
  statusText: { color: "#A1A1AA", fontSize: 12, fontWeight: "800" },
});
