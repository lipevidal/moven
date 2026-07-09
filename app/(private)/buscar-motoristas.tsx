import { useEffect, useState } from "react";

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/database/supabase";

const VISITED_PROFILES_STORAGE_KEY = "@movenapp:visited-driver-profiles";
const MAX_VISITED_PROFILES = 8;

type DriverProfile = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  username?: string | null;
  city?: string | null;
  avatar_url?: string | null;
};

function getDriverName(driver: DriverProfile) {
  return driver.full_name || driver.name || "Motorista";
}

function getDriverMeta(driver: DriverProfile) {
  return `@${driver.username || "usuario"} · ${
    driver.city || "Cidade não informada"
  }`;
}

export default function SearchDriversScreen() {
  const [search, setSearch] = useState("");
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [visitedProfiles, setVisitedProfiles] = useState<DriverProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadVisitedProfiles();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      searchDrivers(search);
    }, 350);

    return () => clearTimeout(timeout);
  }, [search]);

  async function loadVisitedProfiles() {
    try {
      const storedProfiles = await AsyncStorage.getItem(
        VISITED_PROFILES_STORAGE_KEY,
      );

      if (!storedProfiles) return;

      const parsedProfiles = JSON.parse(storedProfiles);

      if (Array.isArray(parsedProfiles)) {
        setVisitedProfiles(
          parsedProfiles
            .filter((item) => item?.id)
            .slice(0, MAX_VISITED_PROFILES),
        );
      }
    } catch (error) {
      console.log("Erro ao carregar perfis visitados:", error);
    }
  }

  async function persistVisitedProfiles(nextProfiles: DriverProfile[]) {
    try {
      setVisitedProfiles(nextProfiles);

      await AsyncStorage.setItem(
        VISITED_PROFILES_STORAGE_KEY,
        JSON.stringify(nextProfiles),
      );
    } catch (error) {
      console.log("Erro ao salvar perfis visitados:", error);
    }
  }

  async function addVisitedProfile(driver: DriverProfile) {
    if (!driver?.id) return;

    const nextProfiles = [
      driver,
      ...visitedProfiles.filter((item) => item.id !== driver.id),
    ].slice(0, MAX_VISITED_PROFILES);

    await persistVisitedProfiles(nextProfiles);
  }

  async function removeVisitedProfile(userId: string) {
    const nextProfiles = visitedProfiles.filter((item) => item.id !== userId);

    await persistVisitedProfiles(nextProfiles);
  }

  async function clearVisitedProfiles() {
    await persistVisitedProfiles([]);
  }

  async function searchDrivers(text: string) {
    const normalizedText = text.trim();

    if (normalizedText.length < 2) {
      setDrivers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const query = normalizedText.replace(/[%_]/g, "");

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, name, username, city, avatar_url")
        .or(
          `full_name.ilike.%${query}%,name.ilike.%${query}%,username.ilike.%${query}%,city.ilike.%${query}%`,
        )
        .limit(30);

      if (error) throw error;

      setDrivers((data ?? []) as DriverProfile[]);
    } catch (error) {
      console.log("Erro ao buscar motoristas:", error);
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(text: string) {
    setSearch(text);
  }

  function clearSearch() {
    setSearch("");
    setDrivers([]);
  }

  async function openPublicProfile(driver: DriverProfile) {
    if (!driver?.id) return;

    await addVisitedProfile(driver);

    router.push({
      pathname: "/perfil-publico/[userId]",
      params: { userId: driver.id },
    } as never);
  }

  function renderVisitedProfilesSection() {
    if (search.trim().length >= 2 || visitedProfiles.length === 0) {
      return null;
    }

    return (
      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <View>
            <Text style={styles.historyTitle}>Últimos perfis visitados</Text>
            <Text style={styles.historySubtitle}>
              Toque para abrir novamente
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.clearHistoryButton}
            onPress={clearVisitedProfiles}
          >
            <Ionicons name="trash-outline" size={15} color="#FCA5A5" />
            <Text style={styles.clearHistoryText}>Limpar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.historyList}>
          {visitedProfiles.map((driver) => (
            <TouchableOpacity
              key={driver.id}
              activeOpacity={0.86}
              style={styles.visitedProfileCard}
              onPress={() => openPublicProfile(driver)}
            >
              {driver.avatar_url ? (
                <Image
                  source={{ uri: driver.avatar_url }}
                  style={styles.visitedProfileAvatar}
                />
              ) : (
                <View style={styles.visitedProfileAvatarFallback}>
                  <Ionicons name="person" size={19} color="#F5F0E6" />
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.visitedProfileName} numberOfLines={1}>
                  {getDriverName(driver)}
                </Text>

                <Text style={styles.visitedProfileMeta} numberOfLines={1}>
                  {getDriverMeta(driver)}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.removeHistoryButton}
                onPress={(event) => {
                  event.stopPropagation();
                  removeVisitedProfile(driver.id);
                }}
              >
                <Ionicons name="close" size={17} color="#9B969B" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  function renderEmptyState() {
    if (search.trim().length < 2) {
      return (
        <>
          {renderVisitedProfilesSection()}

          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={42} color="#8F8A91" />
            <Text style={styles.emptyTitle}>Busque outros motoristas</Text>
            <Text style={styles.emptyText}>
              Você poderá abrir o perfil público, ver cidade e iniciar conexões
              futuras.
            </Text>
          </View>
        </>
      );
    }

    if (loading) {
      return (
        <View style={styles.emptyBox}>
          <ActivityIndicator color="#D4A64A" />
          <Text style={styles.emptyTitle}>Buscando perfis...</Text>
          <Text style={styles.emptyText}>
            Aguarde enquanto encontramos motoristas relacionados à sua busca.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyBox}>
        <Ionicons name="alert-circle-outline" size={42} color="#8F8A91" />
        <Text style={styles.emptyTitle}>Nenhum perfil encontrado</Text>
        <Text style={styles.emptyText}>
          Tente buscar por outro nome, username ou cidade.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <View style={styles.container}>
        <View style={styles.contentTop}>
          <View style={styles.header}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.headerEyebrow}>Comunidade</Text>
              <Text style={styles.headerTitle}>Buscar motoristas</Text>
            </View>
          </View>

          <View style={styles.searchCard}>
            <View style={styles.searchIcon}>
              <Ionicons name="search-outline" size={24} color="#D4A64A" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.searchTitle}>Encontre perfis</Text>
              <Text style={styles.searchText}>
                Busque por nome, username ou cidade.
              </Text>
            </View>
          </View>

          <View style={styles.inputBox}>
            <Ionicons name="search-outline" size={20} color="#9B969B" />

            <TextInput
              value={search}
              onChangeText={handleSearch}
              placeholder="Digite pelo menos 2 letras"
              placeholderTextColor="#71717A"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={styles.input}
            />

            {loading ? (
              <ActivityIndicator color="#D4A64A" />
            ) : search.length > 0 ? (
              <TouchableOpacity activeOpacity={0.85} onPress={clearSearch}>
                <Ionicons name="close-circle" size={22} color="#8F8A91" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <FlatList
          data={drivers}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          renderItem={({ item: driver }) => (
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.driverCard}
              onPress={() => openPublicProfile(driver)}
            >
              {driver.avatar_url ? (
                <Image
                  source={{ uri: driver.avatar_url }}
                  style={styles.driverAvatar}
                />
              ) : (
                <View style={styles.driverAvatarFallback}>
                  <Ionicons name="person" size={23} color="#F5F0E6" />
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.driverName} numberOfLines={1}>
                  {getDriverName(driver)}
                </Text>

                <Text style={styles.driverMeta} numberOfLines={1}>
                  {getDriverMeta(driver)}
                </Text>
              </View>

              <View style={styles.openProfileIcon}>
                <Ionicons name="chevron-forward" size={20} color="#F5F0E6" />
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: "#050505",
  },
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
  contentTop: {
    paddingHorizontal: 18,
    paddingTop: 48,
    backgroundColor: "#050505",
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === "ios" ? 190 : 240,
    backgroundColor: "#050505",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: -18,
    marginTop: -48,
    marginBottom: 16,
    paddingTop: 48,
    paddingBottom: 18,
    paddingHorizontal: 18,
    backgroundColor: "#070707",
    borderBottomWidth: 1,
    borderBottomColor: "#211D16",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  headerEyebrow: {
    color: "#D4A64A",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: "#F5F0E6",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  searchCard: {
    minHeight: 96,
    borderRadius: 18,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    borderLeftWidth: 4,
    borderLeftColor: "#D4A64A",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 14,
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 10,
  },
  searchIcon: {
    width: 50,
    height: 50,
    borderRadius: 13,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchTitle: {
    color: "#F5F0E6",
    fontSize: 17,
    fontWeight: "900",
  },
  searchText: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5,
    lineHeight: 17,
  },
  inputBox: {
    height: 58,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: "100%",
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "800",
  },
  historySection: {
    marginBottom: 14,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  historyTitle: {
    color: "#F5F0E6",
    fontSize: 16,
    fontWeight: "900",
  },
  historySubtitle: {
    color: "#8F8A91",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  clearHistoryButton: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  clearHistoryText: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "900",
  },
  historyList: {
    gap: 9,
  },
  visitedProfileCard: {
    minHeight: 64,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  visitedProfileAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.30)",
  },
  visitedProfileAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  visitedProfileName: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  visitedProfileMeta: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  removeHistoryButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBox: {
    minHeight: 260,
    borderRadius: 18,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    color: "#F5F0E6",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 13,
    textAlign: "center",
  },
  emptyText: {
    color: "#9B969B",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 7,
    lineHeight: 19,
  },
  driverCard: {
    minHeight: 76,
    borderRadius: 16,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.30)",
  },
  driverAvatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 13,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  driverName: {
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "900",
  },
  driverMeta: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  openProfileIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
});
