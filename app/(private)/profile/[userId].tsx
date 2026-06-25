import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

import { useEffect, useState } from "react";

import { useLocalSearchParams } from "expo-router";

import { getPublicProfile } from "../../../src/features/profile/services/getPublicProfile";
import { getProfileStats } from "../../../src/features/profile/services/getProfileStats";
import { getUserMedals } from "../../../src/features/profile/services/getUserMedals";
import { getUserTrophies } from "../../../src/features/profile/services/getUserTrophies";
import { getChallengeHistory } from "../../../src/features/profile/services/getChallengeHistory";

export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams();

  const [profile, setProfile] = useState<any>();

  const [stats, setStats] = useState<any>();

  const [medals, setMedals] = useState<any[]>([]);

  const [trophies, setTrophies] = useState<any[]>([]);

  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const p = await getPublicProfile(String(userId));

    const s = await getProfileStats(String(userId));

    const m = await getUserMedals(String(userId));

    const t = await getUserTrophies(String(userId));

    const h = await getChallengeHistory(String(userId));

    setProfile(p);
    setStats(s);
    setMedals(m);
    setTrophies(t);
    setHistory(h);
  }

  if (!profile) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Image
          source={{
            uri: profile.avatar_url,
          }}
          style={styles.avatar}
        />

        <Text style={styles.name}>{profile.full_name}</Text>

        <Text style={styles.username}>@{profile.username}</Text>

        <Text style={styles.bio}>{profile.bio}</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.gold_medals ?? 0}</Text>

          <Text style={styles.statLabel}>🥇 Ouros</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.silver_medals ?? 0}</Text>

          <Text style={styles.statLabel}>🥈 Pratas</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.bronze_medals ?? 0}</Text>

          <Text style={styles.statLabel}>🥉 Bronzes</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.participations ?? 0}</Text>

          <Text style={styles.statLabel}>🎯 Participações</Text>
        </View>
      </View>

      <View style={styles.highlightCard}>
        <Text style={styles.highlightTitle}>🏆 Melhor Colocação</Text>

        <Text style={styles.highlightValue}>
          {stats?.best_position ?? "-"}º
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Recordes e Troféus</Text>

      {trophies.map((item) => (
        <View key={item.id} style={styles.trophyCard}>
          <Text style={styles.trophyText}>{item.title}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Timeline de Desafios</Text>

      {history.map((item) => (
        <TouchableOpacity key={item.id} style={styles.historyCard}>
          <Text style={styles.historyTitle}>{item.ranking_type}</Text>

          <Text style={styles.historyPosition}>{item.position}º Lugar</Text>

          <Text style={styles.historyAmount}>R$ {item.approved_amount}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090B",
  },

  content: {
    padding: 20,
    paddingBottom: 120,
  },

  header: {
    alignItems: "center",
    marginBottom: 24,
  },

  avatar: {
    width: 110,
    height: 110,
    borderRadius: 999,
  },

  name: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 12,
  },

  username: {
    color: "#22C55E",
    marginTop: 4,
  },

  bio: {
    color: "#A1A1AA",
    textAlign: "center",
    marginTop: 8,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  statCard: {
    width: "48%",
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },

  statValue: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "900",
  },

  statLabel: {
    color: "#A1A1AA",
    marginTop: 4,
  },

  highlightCard: {
    backgroundColor: "#111827",
    padding: 20,
    borderRadius: 18,
    marginTop: 12,
  },

  highlightTitle: {
    color: "#FFF",
    fontWeight: "800",
  },

  highlightValue: {
    color: "#22C55E",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 8,
  },

  sectionTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 24,
    marginBottom: 12,
  },

  trophyCard: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
  },

  trophyText: {
    color: "#FFF",
  },

  historyCard: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
  },

  historyTitle: {
    color: "#FFF",
    fontWeight: "800",
  },

  historyPosition: {
    color: "#22C55E",
    marginTop: 4,
  },

  historyAmount: {
    color: "#FFF",
    marginTop: 4,
  },
});
