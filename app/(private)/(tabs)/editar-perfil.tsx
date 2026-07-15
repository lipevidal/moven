import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
} from "react-native";

import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { supabase } from "../../../src/database/supabase";
type Municipality = {
  id: string;
  name: string;
  uf: string;
  state_name: string;
  immediate_region: string;
  intermediate_region: string;
  ibge_code?: string;
};

type AccountErrors = {
  name?: string;
  username?: string;
  email?: string;
  city?: string;
  password?: string;
  confirmPassword?: string;
};

function formatUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 24);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

function getImageExtension(mimeType?: string | null) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";

  return "jpg";
}

/**
 * Converte base64 para ArrayBuffer sem instalar bibliotecas extras.
 * Isso evita o erro "Network request failed" que acontece em alguns projetos Expo
 * quando usamos fetch(uri).blob() para enviar imagem ao Supabase Storage.
 */
function base64ToArrayBuffer(base64: string) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  const cleanBase64 = base64.replace(/[^A-Za-z0-9+/=]/g, "");

  let bufferLength = cleanBase64.length * 0.75;

  if (cleanBase64.endsWith("==")) {
    bufferLength -= 2;
  } else if (cleanBase64.endsWith("=")) {
    bufferLength -= 1;
  }

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);

  let bytePosition = 0;

  for (let i = 0; i < cleanBase64.length; i += 4) {
    const encoded1 = chars.indexOf(cleanBase64[i]);
    const encoded2 = chars.indexOf(cleanBase64[i + 1]);
    const encoded3 =
      cleanBase64[i + 2] === "=" ? 64 : chars.indexOf(cleanBase64[i + 2]);
    const encoded4 =
      cleanBase64[i + 3] === "=" ? 64 : chars.indexOf(cleanBase64[i + 3]);

    const byte1 = (encoded1 << 2) | (encoded2 >> 4);
    const byte2 = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    const byte3 = ((encoded3 & 3) << 6) | encoded4;

    bytes[bytePosition] = byte1;
    bytePosition += 1;

    if (encoded3 !== 64 && bytePosition < bufferLength) {
      bytes[bytePosition] = byte2;
      bytePosition += 1;
    }

    if (encoded4 !== 64 && bytePosition < bufferLength) {
      bytes[bytePosition] = byte3;
      bytePosition += 1;
    }
  }

  return arrayBuffer;
}

function getFriendlySaveError(message?: string) {
  const text = String(message ?? "").toLowerCase();

  if (
    text.includes("user already registered") ||
    text.includes("already registered") ||
    text.includes("already exists") ||
    text.includes("duplicate")
  ) {
    return "Este e-mail já está cadastrado em outra conta.";
  }

  if (text.includes("email address is invalid") || text.includes("invalid email")) {
    return "Informe um e-mail válido.";
  }

  if (text.includes("password")) {
    return "A senha informada não atende aos requisitos. Use pelo menos 6 caracteres.";
  }

  return "Não foi possível salvar suas informações. Verifique os dados e tente novamente.";
}

function cleanText(value?: string | number | null) {
  return String(value ?? "").trim();
}

function isUuid(value?: string | null) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "").trim(),
  );
}

function getMunicipalityProfileId(municipality?: Municipality | null) {
  const id = cleanText(municipality?.id);

  return isUuid(id) ? id : null;
}

function getMunicipalityIbgeCode(municipality?: Municipality | null) {
  return (
    cleanText(municipality?.ibge_code) ||
    cleanText(municipality?.id) ||
    null
  );
}

function getFirstFilledValue(row: any, keys: string[]) {
  for (const key of keys) {
    const value = cleanText(row?.[key]);

    if (value) return value;
  }

  return "";
}

function mapIbgeLocalidade(row: any): Municipality {
  const name = getFirstFilledValue(row, [
    "nome",
    "municipio",
    "nome_municipio",
    "city",
    "cidade",
    "localidade",
  ]);
  const uf = getFirstFilledValue(row, [
    "uf",
    "estado_uf",
    "sigla_uf",
    "sigla_estado",
  ]).toUpperCase();
  const id = getFirstFilledValue(row, [
    "id",
    "municipio_id",
    "id_municipio",
    "codigo_municipio",
    "codigo_ibge",
    "ibge_code",
    "cod_municipio",
    "geocodigo",
  ]);
  const stateName = getFirstFilledValue(row, [
    "estado",
    "state_name",
    "nome_estado",
    "uf_nome",
  ]);
  const immediateRegion = getFirstFilledValue(row, [
    "regiao_imediata",
    "regiao_imediata_nome",
    "nome_regiao_imediata",
    "immediate_region",
    "immediate_region_name",
  ]);
  const intermediateRegion = getFirstFilledValue(row, [
    "regiao_intermediaria",
    "regiao_intermediaria_nome",
    "nome_regiao_intermediaria",
    "intermediate_region",
    "intermediate_region_name",
  ]);

  return {
    id: id || `${name}-${uf}`,
    name,
    uf,
    state_name: stateName,
    immediate_region: immediateRegion,
    intermediate_region: intermediateRegion,
    ibge_code: id || undefined,
  };
}

async function searchIbgeLocalidades(text: string) {
  const searchText = text.trim();
  const searchPattern = `%${searchText}%`;
  const searchColumns = ["nome", "municipio", "nome_municipio", "cidade"];

  for (const column of searchColumns) {
    const { data, error } = await supabase
      .from("ibge_localidades")
      .select("*")
      .ilike(column, searchPattern)
      .limit(25);

    if (!error) {
      return (data ?? [])
        .map(mapIbgeLocalidade)
        .filter((item) => Boolean(item.name))
        .sort((a, b) => {
          const byName = a.name.localeCompare(b.name, "pt-BR");
          if (byName !== 0) return byName;
          return a.uf.localeCompare(b.uf, "pt-BR");
        });
    }

    console.log(`Busca em ibge_localidades pela coluna ${column} falhou:`, error);
  }

  return [];
}

async function findIbgeLocalidadeById(id?: string | null) {
  const cleanId = cleanText(id);
  if (!cleanId) return null;

  const idColumns = [
    ...(isUuid(cleanId) ? ["id"] : []),
    "municipio_id",
    "id_municipio",
    "codigo_municipio",
    "codigo_ibge",
    "ibge_code",
    "cod_municipio",
    "geocodigo",
  ];

  for (const column of idColumns) {
    const { data, error } = await supabase
      .from("ibge_localidades")
      .select("*")
      .eq(column, cleanId)
      .maybeSingle();

    if (!error && data) {
      return mapIbgeLocalidade(data);
    }
  }

  return null;
}

function getMunicipalityDisplayName(municipality?: Municipality | null) {
  if (!municipality?.name) return "";

  const uf = cleanText(municipality.uf).toUpperCase();

  return uf ? `${municipality.name} ${uf}` : municipality.name;
}

export default function MyAccountScreen() {
  const [userId, setUserId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [youtube, setYoutube] = useState("");
  const [selectedMunicipality, setSelectedMunicipality] =
    useState<Municipality | null>(null);

  const [originalUsername, setOriginalUsername] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [municipalitySearch, setMunicipalitySearch] = useState("");
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [citySearchVisible, setCitySearchVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<AccountErrors>({});

  useEffect(() => {
    loadAccount();
  }, []);

  async function loadAccount() {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user?.id) return;

      const userEmail = user.email ?? "";

      setUserId(user.id);
      setEmail(userEmail);
      setOriginalEmail(userEmail.trim().toLowerCase());

      const { data: profile, error } = await supabase
        .from("profiles")
        .select(
          "id, name, full_name, username, email, city, avatar_url, default_municipality_id, region, regiao_imediata, regiao_intermediaria, estado, estado_uf, instagram, tiktok, whatsapp, youtube",
        )
        .eq("id", user.id)
        .single();

      if (error) throw error;

      const profileUsername = profile?.username ?? "";

      setName(profile?.full_name || profile?.name || "");
      setUsername(profileUsername);
      setOriginalUsername(formatUsername(profileUsername));
      setAvatarUrl(profile?.avatar_url ?? null);
      setInstagram(profile?.instagram ?? "");
      setTiktok(profile?.tiktok ?? "");
      setWhatsapp(profile?.whatsapp ?? "");
      setYoutube(profile?.youtube ?? "");

      if (profile?.default_municipality_id || profile?.city) {
        const ibgeMunicipality = await findIbgeLocalidadeById(
          profile.default_municipality_id,
        );

        setSelectedMunicipality(
          ibgeMunicipality ?? {
            id: profile.default_municipality_id ?? "",
            name: profile.city ?? "",
            uf: profile.estado_uf ?? "",
            state_name: profile.estado ?? "",
            immediate_region: profile.regiao_imediata || profile.region || "",
            intermediate_region: profile.regiao_intermediaria ?? "",
          },
        );
      }
    } catch (error) {
      console.log("Erro ao carregar conta:", error);
      Alert.alert("Erro", "Não foi possível carregar os dados da sua conta.");
    } finally {
      setLoading(false);
    }
  }

  function clearFieldError(field: keyof AccountErrors) {
    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  }

  function validateFields() {
    const nextErrors: AccountErrors = {};
    const cleanUsername = formatUsername(username);
    const cleanEmail = email.trim().toLowerCase();

    if (!name.trim()) {
      nextErrors.name = "Informe seu nome.";
    }

    if (!cleanUsername) {
      nextErrors.username = "Informe um nome de usuário.";
    } else if (cleanUsername.length < 3) {
      nextErrors.username =
        "Informe um nome de usuário com pelo menos 3 caracteres.";
    }

    if (!cleanEmail) {
      nextErrors.email = "Informe seu e-mail.";
    } else if (!isValidEmail(cleanEmail)) {
      nextErrors.email = "Informe um e-mail válido.";
    }

    if (!selectedMunicipality?.name) {
      nextErrors.city = "Selecione sua cidade.";
    }

    if (newPassword || confirmNewPassword) {
      if (newPassword.length < 6) {
        nextErrors.password =
          "A nova senha precisa ter pelo menos 6 caracteres.";
      }

      if (newPassword !== confirmNewPassword) {
        nextErrors.confirmPassword = "As senhas não conferem.";
      }
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function checkUsernameAvailable(cleanUsername: string) {
    if (cleanUsername === originalUsername) {
      return true;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", cleanUsername)
      .neq("id", userId)
      .maybeSingle();

    if (error) throw error;

    return !data;
  }

  async function checkEmailAvailable(cleanEmail: string) {
    if (cleanEmail === originalEmail) {
      return true;
    }

    /**
     * A tabela profiles é usada para validar antes de chamar o Auth.
     * Se existir outro perfil com o mesmo e-mail, bloqueamos já na tela.
     */
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", cleanEmail)
      .neq("id", userId)
      .maybeSingle();

    if (error) throw error;

    return !data;
  }

  async function handleSearchMunicipalities(text: string) {
    setMunicipalitySearch(text);

    if (text.trim().length < 2) {
      setMunicipalities([]);
      return;
    }

    try {
      const response = await searchIbgeLocalidades(text);
      setMunicipalities(response);
    } catch (error) {
      console.log("Erro ao buscar cidades do IBGE:", error);
      setMunicipalities([]);
    }
  }

  function openCitySearchModal() {
    setMunicipalitySearch("");
    setMunicipalities([]);
    setCitySearchVisible(true);
  }

  function closeCitySearchModal() {
    setCitySearchVisible(false);
    setMunicipalitySearch("");
    setMunicipalities([]);
  }

  function selectMunicipality(item: Municipality) {
    setSelectedMunicipality(item);
    closeCitySearchModal();
    clearFieldError("city");
  }

  function renderCitySearchModal() {
    return (
      <Modal
        visible={citySearchVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeCitySearchModal}
      >
        <View style={styles.cityModalOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            style={StyleSheet.absoluteFillObject}
            onPress={closeCitySearchModal}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.cityModalKeyboard}
          >
            <View style={styles.cityModalCard}>
              <View style={styles.cityModalHeader}>
                <View style={styles.cityModalIconBox}>
                  <Ionicons name="location-outline" size={22} color="#D4A64A" />
                </View>

                <View style={styles.cityModalTitleBox}>
                  <Text style={styles.cityModalEyebrow}>Buscar cidade</Text>
                  <Text style={styles.cityModalTitle}>IBGE Localidades</Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.86}
                  style={styles.cityModalCloseButton}
                  onPress={closeCitySearchModal}
                >
                  <Ionicons name="close" size={21} color="#F5F0E6" />
                </TouchableOpacity>
              </View>

              <Text style={styles.cityModalDescription}>
                Pesquise a cidade e selecione o resultado correto.
              </Text>

              <View style={styles.cityModalSearchRow}>
                <Ionicons name="search-outline" size={19} color="#8F8A91" />
                <TextInput
                  value={municipalitySearch}
                  onChangeText={handleSearchMunicipalities}
                  placeholder="Digite o nome da cidade"
                  placeholderTextColor="#8F8A91"
                  autoFocus
                  style={styles.cityModalSearchInput}
                />
              </View>

              <ScrollView
                style={styles.cityModalResultsScroll}
                contentContainerStyle={styles.cityModalResultsContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {municipalitySearch.trim().length < 2 ? (
                  <View style={styles.cityModalEmptyBox}>
                    <Ionicons name="search-outline" size={28} color="#8F8A91" />
                    <Text style={styles.cityModalEmptyTitle}>
                      Busque pelo nome da cidade
                    </Text>
                    <Text style={styles.cityModalEmptyText}>
                      Digite pelo menos 2 letras para buscar.
                    </Text>
                  </View>
                ) : municipalities.length === 0 ? (
                  <View style={styles.cityModalEmptyBox}>
                    <Ionicons name="location-outline" size={28} color="#8F8A91" />
                    <Text style={styles.cityModalEmptyTitle}>
                      Nenhuma cidade encontrada
                    </Text>
                    <Text style={styles.cityModalEmptyText}>
                      Confira a escrita da cidade e tente novamente.
                    </Text>
                  </View>
                ) : (
                  municipalities.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.86}
                      style={styles.cityResultItem}
                      onPress={() => selectMunicipality(item)}
                    >
                      <View style={styles.cityResultInfo}>
                        <Text style={styles.cityResultText} numberOfLines={1}>
                          {getMunicipalityDisplayName(item)}
                        </Text>

                        <Text style={styles.cityResultSubText} numberOfLines={1}>
                          {item.immediate_region
                            ? `Região: ${item.immediate_region}`
                            : "Região não informada"}
                        </Text>
                      </View>

                      <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color="#D4A64A"
                      />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permissão necessária",
        "Autorize o acesso à galeria para alterar sua foto.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      /**
       * Novo formato do Expo Image Picker.
       * Não usa mais ImagePicker.MediaTypeOptions, que está depreciado.
       */
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    await uploadAvatar(result.assets[0]);
  }

  async function uploadAvatar(asset: ImagePicker.ImagePickerAsset) {
    try {
      if (!userId) return;

      setSaving(true);

      if (!asset.base64) {
        Alert.alert(
          "Imagem inválida",
          "Não foi possível ler a imagem selecionada. Tente escolher outra foto.",
        );
        return;
      }

      const mimeType = asset.mimeType ?? "image/jpeg";
      const extension = getImageExtension(mimeType);
      const filePath = `${userId}/avatar-${Date.now()}.${extension}`;
      const fileBody = base64ToArrayBuffer(asset.base64);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, fileBody, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      const { error } = await supabase
        .from("profiles")
        .update({
          avatar_url: publicUrl,
        })
        .eq("id", userId);

      if (error) throw error;

      setAvatarUrl(publicUrl);

      Alert.alert("Foto atualizada", "Sua foto de perfil foi alterada.");
    } catch (error: any) {
      console.log("Erro ao enviar foto:", error);

      const message = String(error?.message ?? "").toLowerCase();

      Alert.alert(
        "Erro ao alterar foto",
        message.includes("bucket")
          ? "O bucket avatars não foi encontrado ou não está configurado corretamente no Supabase."
          : "Não foi possível alterar sua foto. Verifique sua internet e as permissões do Storage.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeAvatar() {
    Alert.alert("Excluir foto", "Deseja remover sua foto de perfil?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);

            const { error } = await supabase
              .from("profiles")
              .update({
                avatar_url: null,
              })
              .eq("id", userId);

            if (error) throw error;

            setAvatarUrl(null);
          } catch (error) {
            console.log(error);
            Alert.alert("Erro", "Não foi possível remover sua foto.");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }

  async function handleSave() {
    try {
      if (!validateFields()) return;

      setSaving(true);

      const cleanUsername = formatUsername(username);
      const cleanEmail = email.trim().toLowerCase();

      const usernameAvailable = await checkUsernameAvailable(cleanUsername);

      if (!usernameAvailable) {
        setErrors((current) => ({
          ...current,
          username: "Este nome de usuário já está em uso.",
        }));
        return;
      }

      const emailAvailable = await checkEmailAvailable(cleanEmail);

      if (!emailAvailable) {
        setErrors((current) => ({
          ...current,
          email: "Este e-mail já está cadastrado em outra conta.",
        }));
        return;
      }

      const authUpdate: {
        email?: string;
        password?: string;
        data?: Record<string, any>;
      } = {
        data: {
          name: name.trim(),
          full_name: name.trim(),
          username: cleanUsername,
          city: selectedMunicipality?.name,
          profile_city: selectedMunicipality?.name,
          default_municipality_id: getMunicipalityProfileId(selectedMunicipality),
          ibge_code: getMunicipalityIbgeCode(selectedMunicipality),
          codigo_ibge: getMunicipalityIbgeCode(selectedMunicipality),
          regiao_imediata: selectedMunicipality?.immediate_region || null,
          immediate_region: selectedMunicipality?.immediate_region || null,
          regiao_intermediaria:
            selectedMunicipality?.intermediate_region || null,
          intermediate_region:
            selectedMunicipality?.intermediate_region || null,
          estado: selectedMunicipality?.state_name || null,
          estado_uf: selectedMunicipality?.uf || null,
          instagram: instagram.trim() || null,
          tiktok: tiktok.trim() || null,
          whatsapp: whatsapp.trim() || null,
          youtube: youtube.trim() || null,
        },
      };

      if (cleanEmail !== originalEmail) {
        authUpdate.email = cleanEmail;
      }

      if (newPassword) {
        authUpdate.password = newPassword;
      }

      if (Object.keys(authUpdate).length > 0) {
        const { error: updateUserError } =
          await supabase.auth.updateUser(authUpdate);

        if (updateUserError) throw updateUserError;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          name: name.trim(),
          full_name: name.trim(),
          username: cleanUsername,
          email: cleanEmail,
          city: selectedMunicipality?.name,
          region:
            selectedMunicipality?.immediate_region ||
            selectedMunicipality?.name,
          regiao_imediata: selectedMunicipality?.immediate_region || null,
          regiao_intermediaria:
            selectedMunicipality?.intermediate_region || null,
          estado: selectedMunicipality?.state_name || null,
          estado_uf: selectedMunicipality?.uf || null,
          instagram: instagram.trim() || null,
          tiktok: tiktok.trim() || null,
          whatsapp: whatsapp.trim() || null,
          youtube: youtube.trim() || null,
          default_municipality_id: getMunicipalityProfileId(selectedMunicipality),
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      setUsername(cleanUsername);
      setOriginalUsername(cleanUsername);
      setEmail(cleanEmail);
      setOriginalEmail(cleanEmail);
      setNewPassword("");
      setConfirmNewPassword("");
      setErrors({});

      Alert.alert(
        "Dados atualizados",
        cleanEmail !== originalEmail
          ? "Suas informações foram salvas. Se a confirmação de e-mail estiver ativa no Supabase, confirme o novo e-mail para concluir a alteração."
          : "Suas informações foram salvas com sucesso.",
      );
    } catch (error: any) {
      console.log("Erro ao salvar conta:", error);

      const friendlyMessage = getFriendlySaveError(error?.message);

      if (friendlyMessage.includes("e-mail")) {
        setErrors((current) => ({
          ...current,
          email: friendlyMessage,
        }));
        return;
      }

      if (friendlyMessage.includes("senha")) {
        setErrors((current) => ({
          ...current,
          password: friendlyMessage,
        }));
        return;
      }

      Alert.alert("Erro", friendlyMessage);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#D4A64A" />
        <Text style={styles.loadingText}>Carregando sua conta...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <View style={styles.header}>

          <View style={styles.headerTitleRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.backButton}
              onPress={() => router.replace("/perfil" as never)}
            >
              <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerEyebrow}>Perfil</Text>
              <Text style={styles.headerTitle}>Editar Perfil</Text>
            </View>
          </View>
        </View>

        <View style={styles.avatarCard}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={42} color="#F5F0E6" />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={styles.avatarTitle}>Foto do perfil</Text>
            <Text style={styles.avatarText}>
              Altere ou remova sua foto pública no MovenApp.
            </Text>

            <View style={styles.avatarActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.avatarButton}
                onPress={pickAvatar}
                disabled={saving}
              >
                <Ionicons name="camera-outline" size={17} color="#080808" />
                <Text style={styles.avatarButtonText}>Alterar</Text>
              </TouchableOpacity>

              {avatarUrl && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.avatarRemoveButton}
                  onPress={removeAvatar}
                  disabled={saving}
                >
                  <Ionicons name="trash-outline" size={17} color="#FCA5A5" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formSectionHeader}>
            <View style={styles.formSectionIconBox}>
              <Ionicons name="person-outline" size={21} color="#D4A64A" />
            </View>

            <View style={styles.formSectionInfo}>
              <Text style={styles.sectionTitle}>Informações pessoais</Text>
              <Text style={styles.formSectionDescription}>
                Atualize seus dados principais, cidade e informações da conta.
              </Text>
            </View>
          </View>

          <FieldLabel label="Nome completo" />
          <InputRow error={errors.name} icon="person-outline">
            <TextInput
              value={name}
              onChangeText={(text) => {
                setName(text);
                clearFieldError("name");
              }}
              placeholder="Seu nome"
              placeholderTextColor="#8F8A91"
              style={styles.input}
            />
          </InputRow>

          <FieldLabel label="Nome de usuário" />
          <InputRow error={errors.username} icon="at-outline">
            <TextInput
              value={username}
              onChangeText={(text) => {
                setUsername(formatUsername(text));
                clearFieldError("username");
              }}
              placeholder="username"
              placeholderTextColor="#8F8A91"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </InputRow>

          <FieldLabel label="E-mail" />
          <InputRow error={errors.email} icon="mail-outline">
            <TextInput
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                clearFieldError("email");
              }}
              placeholder="seuemail@exemplo.com"
              placeholderTextColor="#8F8A91"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </InputRow>

          <FieldLabel label="Cidade" />
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.cityButton, errors.city && styles.inputError]}
            onPress={openCitySearchModal}
          >
            <Ionicons name="location-outline" size={20} color="#D4A64A" />

            <Text style={styles.cityButtonText} numberOfLines={1}>
              {selectedMunicipality?.name
                ? getMunicipalityDisplayName(selectedMunicipality)
                : "Selecionar cidade"}
            </Text>

            <Ionicons name="search-outline" size={19} color="#F5F0E6" />
          </TouchableOpacity>

          {errors.city ? (
            <Text style={styles.errorText}>{errors.city}</Text>
          ) : null}


        </View>

        <View style={styles.formCard}>
          <View style={styles.publicSocialHeader}>
            <View style={styles.publicSocialIconBox}>
              <Ionicons name="share-social-outline" size={21} color="#D4A64A" />
            </View>

            <View style={styles.publicSocialInfo}>
              <Text style={styles.sectionTitle}>Redes sociais</Text>
              <Text style={styles.publicSocialDescription}>
                Preencha somente se quiser que essas informações apareçam publicamente no seu perfil.
              </Text>
            </View>
          </View>

          <FieldLabel label="Instagram" />
          <InputRow icon="logo-instagram">
            <TextInput
              value={instagram}
              onChangeText={setInstagram}
              placeholder="@seuinstagram ou link"
              placeholderTextColor="#8F8A91"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </InputRow>

          <FieldLabel label="TikTok" />
          <InputRow icon="musical-notes-outline">
            <TextInput
              value={tiktok}
              onChangeText={setTiktok}
              placeholder="@seutiktok ou link"
              placeholderTextColor="#8F8A91"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </InputRow>

          <FieldLabel label="WhatsApp" />
          <InputRow icon="logo-whatsapp">
            <TextInput
              value={whatsapp}
              onChangeText={setWhatsapp}
              placeholder="(31) 99999-9999 ou link"
              placeholderTextColor="#8F8A91"
              keyboardType="phone-pad"
              style={styles.input}
            />
          </InputRow>

          <FieldLabel label="YouTube" />
          <InputRow icon="logo-youtube">
            <TextInput
              value={youtube}
              onChangeText={setYoutube}
              placeholder="@canal ou link do YouTube"
              placeholderTextColor="#8F8A91"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </InputRow>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formSectionHeader}>
            <View style={styles.formSectionIconBox}>
              <Ionicons name="lock-closed-outline" size={21} color="#D4A64A" />
            </View>

            <View style={styles.formSectionInfo}>
              <Text style={styles.sectionTitle}>Alterar senha</Text>
              <Text style={styles.formSectionDescription}>
                Preencha apenas se quiser trocar sua senha atual.
              </Text>
            </View>
          </View>

          <FieldLabel label="Nova senha" />
          <InputRow error={errors.password} icon="lock-closed-outline">
            <TextInput
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                clearFieldError("password");
              }}
              placeholder="Nova senha"
              placeholderTextColor="#8F8A91"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="oneTimeCode"
              autoComplete="off"
              style={styles.input}
            />

            <TouchableOpacity
              onPress={() => setShowPassword((current) => !current)}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color="#9B969B"
              />
            </TouchableOpacity>
          </InputRow>

          <FieldLabel label="Confirmar nova senha" />
          <InputRow
            error={errors.confirmPassword}
            icon="shield-checkmark-outline"
          >
            <TextInput
              value={confirmNewPassword}
              onChangeText={(text) => {
                setConfirmNewPassword(text);
                clearFieldError("confirmPassword");
              }}
              placeholder="Confirme a nova senha"
              placeholderTextColor="#8F8A91"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="oneTimeCode"
              autoComplete="off"
              style={styles.input}
            />
          </InputRow>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#080808" />
          ) : (
            <>
              <Ionicons name="save-outline" size={22} color="#080808" />
              <Text style={styles.saveButtonText}>Salvar alterações</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {renderCitySearchModal()}
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.label}>{label}</Text>;
}

function InputRow({
  icon,
  error,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  error?: string;
  children: ReactNode;
}) {
  return (
    <>
      <View style={[styles.inputRow, error && styles.inputError]}>
        <Ionicons name={icon} size={20} color="#9B969B" />
        {children}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: "#050505",
  },
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 110,
    backgroundColor: "#050505",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#050505",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#9B969B",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 12,
  },
  header: {
    marginHorizontal: -18,
    marginTop: -48,
    marginBottom: 16,
    paddingTop: 48,
    paddingBottom: 18,
    paddingHorizontal: 18,
    backgroundColor: "#070707",
    borderBottomWidth: 1,
    borderBottomColor: "#211D16",
    zIndex: 20,
    elevation: 20,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
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
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  avatarCard: {
    backgroundColor: "#101014",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.07,
    shadowRadius: 22,
    elevation: 8,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#D4A64A",
  },
  avatarFallback: {
    width: 86,
    height: 86,
    borderRadius: 18,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarTitle: { color: "#F5F0E6", fontSize: 16, fontWeight: "900" },

  avatarText: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 4,
  },

  avatarActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  avatarButton: {
    height: 38,
    borderRadius: 12,
    backgroundColor: "#D4A64A",
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  avatarButtonText: {
    color: "#080808",
    fontSize: 13,
    fontWeight: "900",
  },

  avatarRemoveButton: {
    width: 40,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  formCard: {
    backgroundColor: "#101014",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 16,
    marginBottom: 16,
  },

  sectionTitle: {
    color: "#F5F0E6",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },

  formSectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 4,
  },

  formSectionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  formSectionInfo: {
    flex: 1,
    minWidth: 0,
  },

  formSectionDescription: {
    color: "#BDB5A7",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 8,
  },

  publicSocialHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 4,
  },

  publicSocialIconBox: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  publicSocialInfo: {
    flex: 1,
    minWidth: 0,
  },

  publicSocialDescription: {
    color: "#BDB5A7",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 8,
  },

  sectionDescription: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginBottom: 8,
  },

  label: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 12,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputRow: {
    minHeight: 58,
    backgroundColor: "#18171D",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingLeft: 15,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  inputError: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  input: {
    flex: 1,
    height: 56,
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "700",
    paddingVertical: 0,
  },

  errorText: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 7,
    marginLeft: 4,
    lineHeight: 17,
  },
  cityButton: {
    minHeight: 58,
    backgroundColor: "#18171D",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  cityButtonText: {
    flex: 1,
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "800",
  },
  cityModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.74)",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 34,
  },
  cityModalKeyboard: {
    width: "100%",
    alignSelf: "center",
  },
  cityModalCard: {
    width: "100%",
    maxHeight: "74%",
    minHeight: 360,
    borderRadius: 24,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.28)",
    padding: 15,
    overflow: "hidden",
  },
  cityModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cityModalIconBox: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  cityModalTitleBox: {
    flex: 1,
    minWidth: 0,
  },
  cityModalEyebrow: {
    color: "#D4A64A",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  cityModalTitle: {
    color: "#F5F0E6",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },
  cityModalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  cityModalDescription: {
    color: "#A8A1A8",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 10,
  },
  cityModalSearchRow: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 14,
  },
  cityModalSearchInput: {
    flex: 1,
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "800",
    paddingVertical: 0,
  },
  cityModalResultsScroll: {
    marginTop: 12,
  },
  cityModalResultsContent: {
    gap: 8,
    paddingBottom: 2,
  },
  cityModalEmptyBox: {
    minHeight: 180,
    borderRadius: 18,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  cityModalEmptyTitle: {
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
  },
  cityModalEmptyText: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 6,
    textAlign: "center",
  },
  cityResultItem: {
    minHeight: 58,
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

  cityResultInfo: {
    flex: 1,
    minWidth: 0,
  },

  cityResultText: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },

  cityResultSubText: {
    color: "#8F8A91",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  saveButton: {
    height: 60,
    borderRadius: 14,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  saveButtonDisabled: { opacity: 0.65 },
  saveButtonText: {
    color: "#080808",
    fontSize: 16,
    fontWeight: "900",
  },
});
