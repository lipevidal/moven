import { useState } from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/database/supabase";

export default function SearchDriversScreen() {
  const [search, setSearch] = useState("");
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(text: string) {
    setSearch(text);

    if (text.trim().length < 2) {
      setDrivers([]);
      return;
    }

    try {
      setLoading(true);
      const query = text.trim();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, name, username, city, avatar_url")
        .or(
          `full_name.ilike.%${query}%,name.ilike.%${query}%,username.ilike.%${query}%,city.ilike.%${query}%`,
        )
        .limit(30);

      if (error) throw error;
      setDrivers(data ?? []);
    } catch (error) {
      console.log("Erro ao buscar motoristas:", error);
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  }

  function openPublicProfile(userId: string) {
    router.push({
      pathname: "/(private)/perfil-publico/[userId]",
      params: { userId },
    } as never);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>Comunidade</Text>
          <Text style={styles.headerTitle}>Buscar motoristas</Text>
        </View>
      </View>

      <View style={styles.searchCard}>
        <View style={styles.searchIcon}>
          <Ionicons name="search-outline" size={24} color="#22C55E" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.searchTitle}>Encontre perfis</Text>
          <Text style={styles.searchText}>
            Busque por nome, username ou cidade.
          </Text>
        </View>
      </View>

      <View style={styles.inputBox}>
        <Ionicons name="search-outline" size={20} color="#A1A1AA" />
        <TextInput
          value={search}
          onChangeText={handleSearch}
          placeholder="Digite pelo menos 2 letras"
          placeholderTextColor="#71717A"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        {loading && <ActivityIndicator color="#22C55E" />}
      </View>

      {search.trim().length < 2 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={42} color="#52525B" />
          <Text style={styles.emptyTitle}>Busque outros motoristas</Text>
          <Text style={styles.emptyText}>
            Você poderá abrir o perfil público, ver cidade e iniciar conexões
            futuras.
          </Text>
        </View>
      ) : drivers.length === 0 && !loading ? (
        <View style={styles.emptyBox}>
          <Ionicons name="alert-circle-outline" size={42} color="#52525B" />
          <Text style={styles.emptyTitle}>Nenhum perfil encontrado</Text>
          <Text style={styles.emptyText}>
            Tente buscar por outro nome, username ou cidade.
          </Text>
        </View>
      ) : (
        <View style={styles.resultsList}>
          {drivers.map((driver) => (
            <TouchableOpacity
              key={driver.id}
              activeOpacity={0.86}
              style={styles.driverCard}
              onPress={() => openPublicProfile(driver.id)}
            >
              {driver.avatar_url ? (
                <Image
                  source={{ uri: driver.avatar_url }}
                  style={styles.driverAvatar}
                />
              ) : (
                <View style={styles.driverAvatarFallback}>
                  <Ionicons name="person" size={23} color="#FFFFFF" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName} numberOfLines={1}>
                  {driver.full_name || driver.name || "Motorista"}
                </Text>
                <Text style={styles.driverMeta} numberOfLines={1}>
                  @{driver.username || "usuario"} ·{" "}
                  {driver.city || "Cidade não informada"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#71717A" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090B" },
  content: { paddingHorizontal: 18, paddingTop: 54, paddingBottom: 140 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  headerEyebrow: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  headerTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "900" },
  searchCard: {
    minHeight: 96,
    borderRadius: 28,
    backgroundColor: "#052E16",
    borderWidth: 1,
    borderColor: "#166534",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 14,
  },
  searchIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: "rgba(34,197,94,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  searchText: {
    color: "#BBF7D0",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5,
  },
  inputBox: {
    height: 58,
    borderRadius: 20,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: "100%",
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyBox: {
    minHeight: 260,
    borderRadius: 28,
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
    marginTop: 13,
  },
  emptyText: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 7,
    lineHeight: 19,
  },
  resultsList: { gap: 10 },
  driverCard: {
    minHeight: 76,
    borderRadius: 22,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverAvatar: { width: 50, height: 50, borderRadius: 999 },
  driverAvatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 999,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  driverName: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  driverMeta: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
});
