import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../../src/database/supabase";

type IconName = keyof typeof Ionicons.glyphMap;

type FilterOption = {
  label: string;
  value: string;
  helper?: string;
};

type IbgeLocalidade = {
  id: number | string;
  nome: string;
  municipio_id?: number | string | null;
  municipio_nome?: string | null;
  uf_nome?: string | null;
  uf_sigla?: string | null;
  regiao_nome?: string | null;
  regiao_sigla?: string | null;
  regiao_intermediaria_nome?: string | null;
  regiao_imediata_nome?: string | null;
  microrregiao_nome?: string | null;
  mesorregiao_nome?: string | null;
};

type DropdownState = {
  title: string;
  subtitle?: string;
  options: FilterOption[];
  emptyText: string;
  onSelect: (option: FilterOption) => void;
};

function normalizeText(value?: string | null) {
  return String(value ?? "").trim();
}

function uniqueOptions<T>(
  rows: T[],
  getLabel: (row: T) => string | null | undefined,
  getValue?: (row: T) => string | null | undefined,
  getHelper?: (row: T) => string | null | undefined,
) {
  const map = new Map<string, FilterOption>();

  rows.forEach((row) => {
    const label = normalizeText(getLabel(row));
    const value = normalizeText(getValue ? getValue(row) : label);

    if (!label || !value || map.has(value)) return;

    map.set(value, {
      label,
      value,
      helper: normalizeText(getHelper?.(row)) || undefined,
    });
  });

  return Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "pt-BR"),
  );
}

function getErrorMessage(error: any) {
  return (
    error?.message ||
    error?.details ||
    error?.hint ||
    "Não foi possível carregar os dados."
  );
}

function SelectionCard({
  icon,
  label,
  value,
  placeholder,
  disabled,
  loading,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  const filled = Boolean(value);

  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.86}
      style={[
        styles.selectionCard,
        disabled && styles.selectionCardDisabled,
        filled && styles.selectionCardFilled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <View style={[styles.selectionIconBox, filled && styles.selectionIconBoxFilled]}>
        <Ionicons
          name={icon}
          size={18}
          color={filled ? "#080808" : disabled ? "#5F5A62" : "#D4A64A"}
        />
      </View>

      <View style={styles.selectionTextBox}>
        <Text style={styles.selectionLabel}>{label}</Text>
        <Text
          style={[
            styles.selectionValue,
            !filled && styles.selectionPlaceholder,
            disabled && styles.selectionDisabledText,
          ]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#D4A64A" />
      ) : (
        <Ionicons
          name="chevron-down"
          size={18}
          color={disabled ? "#5F5A62" : "#8F8A91"}
        />
      )}
    </TouchableOpacity>
  );
}

function DetailLine({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  if (!value) return null;

  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLineLabel}>{label}</Text>
      <Text style={styles.detailLineValue}>{String(value)}</Text>
    </View>
  );
}

export default function IbgeLocalidadesScreen() {
  const [ufs, setUfs] = useState<FilterOption[]>([]);
  const [intermediarias, setIntermediarias] = useState<FilterOption[]>([]);
  const [imediatas, setImediatas] = useState<FilterOption[]>([]);
  const [municipios, setMunicipios] = useState<FilterOption[]>([]);
  const [localidades, setLocalidades] = useState<IbgeLocalidade[]>([]);

  const [selectedUf, setSelectedUf] = useState<FilterOption | null>(null);
  const [selectedIntermediaria, setSelectedIntermediaria] =
    useState<FilterOption | null>(null);
  const [selectedImediata, setSelectedImediata] =
    useState<FilterOption | null>(null);
  const [selectedMunicipio, setSelectedMunicipio] =
    useState<FilterOption | null>(null);

  const [loadingUfs, setLoadingUfs] = useState(false);
  const [loadingIntermediarias, setLoadingIntermediarias] = useState(false);
  const [loadingImediatas, setLoadingImediatas] = useState(false);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [loadingLocalidades, setLoadingLocalidades] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [dropdown, setDropdown] = useState<DropdownState | null>(null);

  const selectedSummary = useMemo(() => {
    return [
      selectedUf?.label,
      selectedIntermediaria?.label,
      selectedImediata?.label,
      selectedMunicipio?.label,
    ]
      .filter(Boolean)
      .join(" • ");
  }, [selectedUf, selectedIntermediaria, selectedImediata, selectedMunicipio]);

  useFocusEffect(
    useCallback(() => {
      void loadUfs();
    }, []),
  );

  useEffect(() => {
    if (selectedUf) void loadIntermediarias(selectedUf.value);
  }, [selectedUf]);

  useEffect(() => {
    if (selectedUf && selectedIntermediaria) {
      void loadImediatas(selectedUf.value, selectedIntermediaria.value);
    }
  }, [selectedUf, selectedIntermediaria]);

  useEffect(() => {
    if (selectedUf && selectedIntermediaria && selectedImediata) {
      void loadMunicipios(
        selectedUf.value,
        selectedIntermediaria.value,
        selectedImediata.value,
      );
    }
  }, [selectedUf, selectedIntermediaria, selectedImediata]);

  useEffect(() => {
    if (
      selectedUf &&
      selectedIntermediaria &&
      selectedImediata &&
      selectedMunicipio
    ) {
      void loadLocalidades(
        selectedUf.value,
        selectedIntermediaria.value,
        selectedImediata.value,
        selectedMunicipio.value,
      );
    } else {
      setLocalidades([]);
    }
  }, [selectedUf, selectedIntermediaria, selectedImediata, selectedMunicipio]);

  async function runRpcOrFallback<T>(
    rpcName: string,
    rpcParams: Record<string, any>,
    fallback: () => Promise<T[]>,
  ) {
    const { data, error } = await (supabase as any).rpc(rpcName, rpcParams);

    if (!error && Array.isArray(data)) {
      return data as unknown as T[];
    }

    return fallback();
  }

  async function loadUfs(showRefresh = false) {
    try {
      setErrorMessage("");
      if (showRefresh) setRefreshing(true);
      else setLoadingUfs(true);

      const rows = await runRpcOrFallback<any>("get_ibge_ufs", {}, async () => {
        const { data, error } = await supabase
          .from("ibge_localidades")
          .select("uf_nome, uf_sigla")
          .not("uf_nome", "is", null)
          .order("uf_nome", { ascending: true })
          .limit(20000);

        if (error) throw error;

        return (data ?? []) as unknown as any[];
      });

      setUfs(
        uniqueOptions(
          rows,
          (row) => row.uf_nome,
          (row) => row.uf_nome,
          (row) => row.uf_sigla,
        ),
      );
    } catch (error: any) {
      setErrorMessage(getErrorMessage(error));
      setUfs([]);
    } finally {
      setLoadingUfs(false);
      setRefreshing(false);
    }
  }

  async function loadIntermediarias(ufNome: string) {
    try {
      setLoadingIntermediarias(true);
      setErrorMessage("");

      const rows = await runRpcOrFallback<any>(
        "get_ibge_regioes_intermediarias",
        { p_uf_nome: ufNome },
        async () => {
          const { data, error } = await supabase
            .from("ibge_localidades")
            .select("regiao_intermediaria_nome")
            .eq("uf_nome", ufNome)
            .not("regiao_intermediaria_nome", "is", null)
            .order("regiao_intermediaria_nome", { ascending: true })
            .limit(20000);

          if (error) throw error;

          return (data ?? []) as unknown as any[];
        },
      );

      setIntermediarias(
        uniqueOptions(
          rows,
          (row) => row.regiao_intermediaria_nome,
          (row) => row.regiao_intermediaria_nome,
        ),
      );
    } catch (error: any) {
      setErrorMessage(getErrorMessage(error));
      setIntermediarias([]);
    } finally {
      setLoadingIntermediarias(false);
    }
  }

  async function loadImediatas(ufNome: string, intermediariaNome: string) {
    try {
      setLoadingImediatas(true);
      setErrorMessage("");

      const rows = await runRpcOrFallback<any>(
        "get_ibge_regioes_imediatas",
        {
          p_uf_nome: ufNome,
          p_regiao_intermediaria_nome: intermediariaNome,
        },
        async () => {
          const { data, error } = await supabase
            .from("ibge_localidades")
            .select("regiao_imediata_nome")
            .eq("uf_nome", ufNome)
            .eq("regiao_intermediaria_nome", intermediariaNome)
            .not("regiao_imediata_nome", "is", null)
            .order("regiao_imediata_nome", { ascending: true })
            .limit(20000);

          if (error) throw error;

          return (data ?? []) as unknown as any[];
        },
      );

      setImediatas(
        uniqueOptions(
          rows,
          (row) => row.regiao_imediata_nome,
          (row) => row.regiao_imediata_nome,
        ),
      );
    } catch (error: any) {
      setErrorMessage(getErrorMessage(error));
      setImediatas([]);
    } finally {
      setLoadingImediatas(false);
    }
  }

  async function loadMunicipios(
    ufNome: string,
    intermediariaNome: string,
    imediataNome: string,
  ) {
    try {
      setLoadingMunicipios(true);
      setErrorMessage("");

      const rows = await runRpcOrFallback<any>(
        "get_ibge_municipios",
        {
          p_uf_nome: ufNome,
          p_regiao_intermediaria_nome: intermediariaNome,
          p_regiao_imediata_nome: imediataNome,
        },
        async () => {
          const { data, error } = await supabase
            .from("ibge_localidades")
            .select("municipio_nome, municipio_id")
            .eq("uf_nome", ufNome)
            .eq("regiao_intermediaria_nome", intermediariaNome)
            .eq("regiao_imediata_nome", imediataNome)
            .not("municipio_nome", "is", null)
            .order("municipio_nome", { ascending: true })
            .limit(20000);

          if (error) throw error;

          return (data ?? []) as unknown as any[];
        },
      );

      setMunicipios(
        uniqueOptions(
          rows,
          (row) => row.municipio_nome,
          (row) => row.municipio_nome,
          (row) => (row.municipio_id ? `IBGE ${row.municipio_id}` : ""),
        ),
      );
    } catch (error: any) {
      setErrorMessage(getErrorMessage(error));
      setMunicipios([]);
    } finally {
      setLoadingMunicipios(false);
    }
  }

  async function loadLocalidades(
    ufNome: string,
    intermediariaNome: string,
    imediataNome: string,
    municipioNome: string,
  ) {
    try {
      setLoadingLocalidades(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("ibge_localidades")
        .select(
          [
            "id",
            "nome",
            "municipio_id",
            "municipio_nome",
            "uf_nome",
            "uf_sigla",
            "regiao_nome",
            "regiao_sigla",
            "regiao_intermediaria_nome",
            "regiao_imediata_nome",
            "microrregiao_nome",
            "mesorregiao_nome",
          ].join(", "),
        )
        .eq("uf_nome", ufNome)
        .eq("regiao_intermediaria_nome", intermediariaNome)
        .eq("regiao_imediata_nome", imediataNome)
        .eq("municipio_nome", municipioNome)
        .order("nome", { ascending: true })
        .limit(500);

      if (error) throw error;

      setLocalidades((data ?? []) as unknown as IbgeLocalidade[]);
    } catch (error: any) {
      setErrorMessage(getErrorMessage(error));
      setLocalidades([]);
    } finally {
      setLoadingLocalidades(false);
    }
  }

  function clearAfterUf() {
    setSelectedIntermediaria(null);
    setSelectedImediata(null);
    setSelectedMunicipio(null);
    setIntermediarias([]);
    setImediatas([]);
    setMunicipios([]);
    setLocalidades([]);
  }

  function clearAfterIntermediaria() {
    setSelectedImediata(null);
    setSelectedMunicipio(null);
    setImediatas([]);
    setMunicipios([]);
    setLocalidades([]);
  }

  function clearAfterImediata() {
    setSelectedMunicipio(null);
    setMunicipios([]);
    setLocalidades([]);
  }

  function handleSelectUf(option: FilterOption) {
    setSelectedUf(option);
    clearAfterUf();
    setDropdown(null);
  }

  function handleSelectIntermediaria(option: FilterOption) {
    setSelectedIntermediaria(option);
    clearAfterIntermediaria();
    setDropdown(null);
  }

  function handleSelectImediata(option: FilterOption) {
    setSelectedImediata(option);
    clearAfterImediata();
    setDropdown(null);
  }

  function handleSelectMunicipio(option: FilterOption) {
    setSelectedMunicipio(option);
    setLocalidades([]);
    setDropdown(null);
  }

  function clearFilters() {
    setSelectedUf(null);
    setSelectedIntermediaria(null);
    setSelectedImediata(null);
    setSelectedMunicipio(null);
    setIntermediarias([]);
    setImediatas([]);
    setMunicipios([]);
    setLocalidades([]);
    setErrorMessage("");
  }

  function openDropdown(config: DropdownState) {
    setDropdown(config);
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
          <Text style={styles.headerEyebrow}>IBGE</Text>
          <Text style={styles.headerTitle}>Filtro de localidades</Text>
          <Text style={styles.headerSubtitle}>
            UF, regiões e municípios da tabela ibge_localidades
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="#D4A64A"
            onRefresh={() => loadUfs(true)}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIconBox}>
            <Ionicons name="map-outline" size={24} color="#D4A64A" />
          </View>
          <View style={styles.heroTextBox}>
            <Text style={styles.heroTitle}>Consulta territorial</Text>
            <Text style={styles.heroDescription}>
              Escolha a UF, depois a região intermediária, região imediata e o
              município relacionado.
            </Text>
          </View>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={20} color="#FCA5A5" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <SelectionCard
          icon="flag-outline"
          label="UF"
          value={selectedUf?.label}
          placeholder="Escolha uma UF"
          loading={loadingUfs}
          onPress={() =>
            openDropdown({
              title: "Escolher UF",
              subtitle: "Estados disponíveis na tabela ibge_localidades",
              options: ufs,
              emptyText: "Nenhuma UF encontrada.",
              onSelect: handleSelectUf,
            })
          }
        />

        <SelectionCard
          icon="git-branch-outline"
          label="Região intermediária"
          value={selectedIntermediaria?.label}
          placeholder="Escolha a UF primeiro"
          disabled={!selectedUf}
          loading={loadingIntermediarias}
          onPress={() =>
            openDropdown({
              title: "Escolher região intermediária",
              subtitle: selectedUf?.label,
              options: intermediarias,
              emptyText: "Nenhuma região intermediária encontrada para essa UF.",
              onSelect: handleSelectIntermediaria,
            })
          }
        />

        <SelectionCard
          icon="trail-sign-outline"
          label="Região imediata"
          value={selectedImediata?.label}
          placeholder="Escolha a região intermediária primeiro"
          disabled={!selectedIntermediaria}
          loading={loadingImediatas}
          onPress={() =>
            openDropdown({
              title: "Escolher região imediata",
              subtitle: selectedIntermediaria?.label,
              options: imediatas,
              emptyText: "Nenhuma região imediata encontrada.",
              onSelect: handleSelectImediata,
            })
          }
        />

        <SelectionCard
          icon="business-outline"
          label="Município"
          value={selectedMunicipio?.label}
          placeholder="Escolha a região imediata primeiro"
          disabled={!selectedImediata}
          loading={loadingMunicipios}
          onPress={() =>
            openDropdown({
              title: "Escolher município",
              subtitle: selectedImediata?.label,
              options: municipios,
              emptyText: "Nenhum município encontrado.",
              onSelect: handleSelectMunicipio,
            })
          }
        />

        {selectedSummary ? (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#22C55E" />
              <Text style={styles.summaryTitle}>Filtro selecionado</Text>
            </View>
            <Text style={styles.summaryText}>{selectedSummary}</Text>

            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.clearButton}
              onPress={clearFilters}
            >
              <Ionicons name="refresh-outline" size={16} color="#D4A64A" />
              <Text style={styles.clearButtonText}>Limpar filtros</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.resultsCard}>
          <View style={styles.resultsHeader}>
            <View>
              <Text style={styles.resultsEyebrow}>Resultado</Text>
              <Text style={styles.resultsTitle}>
                {selectedMunicipio
                  ? `${localidades.length} localidade(s)`
                  : "Aguardando filtros"}
              </Text>
            </View>

            {loadingLocalidades ? <ActivityIndicator color="#D4A64A" /> : null}
          </View>

          {!selectedMunicipio ? (
            <View style={styles.emptyBox}>
              <Ionicons name="search-outline" size={30} color="#8F8A91" />
              <Text style={styles.emptyTitle}>Selecione os filtros</Text>
              <Text style={styles.emptyText}>
                Após escolher o município, as localidades relacionadas aparecem aqui.
              </Text>
            </View>
          ) : localidades.length === 0 && !loadingLocalidades ? (
            <View style={styles.emptyBox}>
              <Ionicons name="location-outline" size={30} color="#8F8A91" />
              <Text style={styles.emptyTitle}>Nenhuma localidade</Text>
              <Text style={styles.emptyText}>
                Não encontrei dados para o município selecionado.
              </Text>
            </View>
          ) : (
            localidades.map((item) => (
              <View key={String(item.id)} style={styles.localidadeCard}>
                <View style={styles.localidadeHeader}>
                  <View style={styles.localidadeIconBox}>
                    <Ionicons name="location-outline" size={18} color="#D4A64A" />
                  </View>
                  <View style={styles.localidadeTitleBox}>
                    <Text style={styles.localidadeTitle}>{item.nome}</Text>
                    <Text style={styles.localidadeSubtitle}>
                      Código IBGE: {item.id}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsBox}>
                  <DetailLine label="Município" value={item.municipio_nome} />
                  <DetailLine label="UF" value={item.uf_sigla || item.uf_nome} />
                  <DetailLine
                    label="Região intermediária"
                    value={item.regiao_intermediaria_nome}
                  />
                  <DetailLine
                    label="Região imediata"
                    value={item.regiao_imediata_nome}
                  />
                  <DetailLine label="Microrregião" value={item.microrregiao_nome} />
                  <DetailLine label="Mesorregião" value={item.mesorregiao_nome} />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(dropdown)}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdown(null)}
      >
        <View style={styles.dropdownOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.dropdownBackdrop}
            onPress={() => setDropdown(null)}
          />
          <View style={styles.dropdownCard}>
            <View style={styles.dropdownHeader}>
              <View style={styles.dropdownHeaderText}>
                <Text style={styles.dropdownEyebrow}>Selecionar</Text>
                <Text style={styles.dropdownTitle}>{dropdown?.title}</Text>
                {dropdown?.subtitle ? (
                  <Text style={styles.dropdownSubtitle}>{dropdown.subtitle}</Text>
                ) : null}
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.dropdownCloseButton}
                onPress={() => setDropdown(null)}
              >
                <Ionicons name="close" size={22} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.dropdownList}
            >
              {dropdown?.options?.length ? (
                dropdown.options.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    activeOpacity={0.86}
                    style={styles.dropdownItem}
                    onPress={() => dropdown.onSelect(option)}
                  >
                    <View style={styles.dropdownItemTextBox}>
                      <Text style={styles.dropdownItemLabel}>{option.label}</Text>
                      {option.helper ? (
                        <Text style={styles.dropdownItemHelper}>{option.helper}</Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#8F8A91"
                    />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.dropdownEmptyBox}>
                  <Ionicons
                    name="information-circle-outline"
                    size={28}
                    color="#8F8A91"
                  />
                  <Text style={styles.dropdownEmptyText}>
                    {dropdown?.emptyText || "Nenhum item encontrado."}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  heroCard: {
    borderRadius: 20,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(212,166,74,0.10)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextBox: { flex: 1, minWidth: 0 },
  heroTitle: {
    color: "#F5F0E6",
    fontSize: 16,
    fontWeight: "900",
  },
  heroDescription: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  errorBox: {
    borderRadius: 14,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.24)",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  selectionCard: {
    minHeight: 66,
    borderRadius: 18,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  selectionCardFilled: {
    borderColor: "rgba(212,166,74,0.34)",
    backgroundColor: "rgba(212,166,74,0.06)",
  },
  selectionCardDisabled: { opacity: 0.56 },
  selectionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "rgba(212,166,74,0.09)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionIconBoxFilled: {
    backgroundColor: "#D4A64A",
    borderColor: "#D4A64A",
  },
  selectionTextBox: { flex: 1, minWidth: 0 },
  selectionLabel: {
    color: "#9B969B",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  selectionValue: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },
  selectionPlaceholder: { color: "#7F7A82" },
  selectionDisabledText: { color: "#5F5A62" },
  summaryCard: {
    borderRadius: 18,
    backgroundColor: "rgba(34,197,94,0.08)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.22)",
    padding: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  summaryTitle: {
    color: "#BBF7D0",
    fontSize: 12,
    fontWeight: "900",
  },
  summaryText: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 7,
  },
  clearButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 12,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  clearButtonText: {
    color: "#D4A64A",
    fontSize: 12,
    fontWeight: "900",
  },
  resultsCard: {
    borderRadius: 20,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 14,
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  resultsEyebrow: {
    color: "#D4A64A",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  resultsTitle: {
    color: "#F5F0E6",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },
  emptyBox: {
    borderRadius: 16,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 8,
  },
  emptyText: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },
  localidadeCard: {
    borderRadius: 18,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 12,
    marginTop: 10,
  },
  localidadeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  localidadeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "rgba(212,166,74,0.09)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  localidadeTitleBox: { flex: 1, minWidth: 0 },
  localidadeTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  localidadeSubtitle: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  detailsBox: {
    borderTopWidth: 1,
    borderTopColor: "#2A2830",
    marginTop: 10,
    paddingTop: 8,
    gap: 7,
  },
  detailLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  detailLineLabel: {
    color: "#8F8A91",
    fontSize: 11,
    fontWeight: "800",
  },
  detailLineValue: {
    flex: 1,
    color: "#D8D1C4",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
  },
  dropdownOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  dropdownCard: {
    maxHeight: "78%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 22,
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  dropdownHeaderText: { flex: 1, minWidth: 0 },
  dropdownEyebrow: {
    color: "#D4A64A",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  dropdownTitle: {
    color: "#F5F0E6",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  dropdownSubtitle: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  dropdownCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownList: { paddingBottom: 10 },
  dropdownItem: {
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dropdownItemTextBox: { flex: 1, minWidth: 0 },
  dropdownItemLabel: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
  },
  dropdownItemHelper: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  dropdownEmptyBox: {
    borderRadius: 16,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 18,
    alignItems: "center",
    marginTop: 8,
  },
  dropdownEmptyText: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 7,
  },
});
