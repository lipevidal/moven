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
  Platform,
} from "react-native";

import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { supabase } from "../../../src/database/supabase";
import {
  searchMunicipalities,
  Municipality,
} from "../../../src/features/municipalities/services/searchMunicipalities";

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

export default function MyAccountScreen() {
  const [userId, setUserId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
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
          "id, name, full_name, username, email, city, avatar_url, default_municipality_id",
        )
        .eq("id", user.id)
        .single();

      if (error) throw error;

      const profileUsername = profile?.username ?? "";

      setName(profile?.full_name || profile?.name || "");
      setUsername(profileUsername);
      setOriginalUsername(formatUsername(profileUsername));
      setAvatarUrl(profile?.avatar_url ?? null);

      if (profile?.default_municipality_id || profile?.city) {
        setSelectedMunicipality({
          id: profile.default_municipality_id ?? "",
          name: profile.city ?? "",
          uf: "",
          state_name: "",
          immediate_region: "",
        });
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

    const response = await searchMunicipalities(text);
    setMunicipalities(response);
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
      } = {};

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
            selectedMunicipality?.immediate_region ??
            selectedMunicipality?.name,
          default_municipality_id: selectedMunicipality?.id || null,
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
        <ActivityIndicator color="#22C55E" />
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
            <Text style={styles.headerEyebrow}>Perfil</Text>
            <Text style={styles.headerTitle}>Minha conta</Text>
          </View>
        </View>

        <View style={styles.avatarCard}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={42} color="#FFFFFF" />
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
                <Ionicons name="camera-outline" size={17} color="#06130B" />
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
          <Text style={styles.sectionTitle}>Informações pessoais</Text>

          <FieldLabel label="Nome completo" />
          <InputRow error={errors.name} icon="person-outline">
            <TextInput
              value={name}
              onChangeText={(text) => {
                setName(text);
                clearFieldError("name");
              }}
              placeholder="Seu nome"
              placeholderTextColor="#71717A"
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
              placeholderTextColor="#71717A"
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
              placeholderTextColor="#71717A"
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
            onPress={() => setCitySearchVisible((current) => !current)}
          >
            <Ionicons name="location-outline" size={20} color="#22C55E" />

            <Text style={styles.cityButtonText} numberOfLines={1}>
              {selectedMunicipality?.name
                ? `${selectedMunicipality.name}${
                    selectedMunicipality.uf
                      ? ` - ${selectedMunicipality.uf}`
                      : ""
                  }`
                : "Selecionar cidade"}
            </Text>

            <Ionicons
              name={citySearchVisible ? "chevron-up" : "chevron-down"}
              size={19}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          {errors.city ? (
            <Text style={styles.errorText}>{errors.city}</Text>
          ) : null}

          {citySearchVisible && (
            <View style={styles.citySearchBox}>
              <TextInput
                value={municipalitySearch}
                onChangeText={handleSearchMunicipalities}
                placeholder="Buscar cidade"
                placeholderTextColor="#71717A"
                style={styles.citySearchInput}
              />

              {municipalities.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.cityResultItem}
                  onPress={() => {
                    setSelectedMunicipality(item);
                    setCitySearchVisible(false);
                    setMunicipalitySearch("");
                    setMunicipalities([]);
                    clearFieldError("city");
                  }}
                >
                  <Text style={styles.cityResultText}>
                    {item.name} - {item.uf}
                  </Text>

                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color="#22C55E"
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Alterar senha</Text>

          <Text style={styles.sectionDescription}>
            Preencha apenas se quiser trocar sua senha atual.
          </Text>

          <FieldLabel label="Nova senha" />
          <InputRow error={errors.password} icon="lock-closed-outline">
            <TextInput
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                clearFieldError("password");
              }}
              placeholder="Nova senha"
              placeholderTextColor="#71717A"
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
                color="#A1A1AA"
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
              placeholderTextColor="#71717A"
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
            <ActivityIndicator color="#06130B" />
          ) : (
            <>
              <Ionicons name="save-outline" size={22} color="#06130B" />
              <Text style={styles.saveButtonText}>Salvar alterações</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
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
        <Ionicons name={icon} size={20} color="#A1A1AA" />
        {children}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1, backgroundColor: "#09090B" },
  container: { flex: 1, backgroundColor: "#09090B" },
  content: { paddingHorizontal: 18, paddingTop: 54, paddingBottom: 140 },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#09090B",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#A1A1AA",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 12,
  },

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

  avatarCard: {
    backgroundColor: "#111827",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },

  avatar: {
    width: 86,
    height: 86,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "#22C55E",
  },

  avatarFallback: {
    width: 86,
    height: 86,
    borderRadius: 999,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },

  avatarText: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 4,
  },

  avatarActions: { flexDirection: "row", gap: 8, marginTop: 12 },

  avatarButton: {
    height: 38,
    borderRadius: 14,
    backgroundColor: "#22C55E",
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },

  avatarButtonText: { color: "#06130B", fontSize: 13, fontWeight: "900" },

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
    backgroundColor: "#111827",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 16,
    marginBottom: 16,
  },

  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },

  sectionDescription: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginBottom: 8,
  },

  label: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 12,
    marginBottom: 8,
    marginLeft: 4,
  },

  inputRow: {
    minHeight: 58,
    backgroundColor: "#18181B",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#27272A",
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
    color: "#FFFFFF",
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
    backgroundColor: "#18181B",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#27272A",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  cityButtonText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  citySearchBox: {
    backgroundColor: "#0D1117",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 12,
    marginTop: 10,
  },

  citySearchInput: {
    height: 48,
    backgroundColor: "#18181B",
    borderRadius: 15,
    paddingHorizontal: 14,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },

  cityResultItem: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: "#18181B",
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  cityResultText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  saveButton: {
    height: 60,
    borderRadius: 20,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  saveButtonDisabled: { opacity: 0.65 },

  saveButtonText: { color: "#06130B", fontSize: 16, fontWeight: "900" },
});
