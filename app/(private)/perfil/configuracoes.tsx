import { useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  Switch,
} from "react-native";

import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../src/database/supabase";

type SettingsTab = "assinaturas" | "privacidade" | "ajuda" | "sobre";

const tabs: {
  label: string;
  value: SettingsTab;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { label: "Assinaturas", value: "assinaturas", icon: "card-outline" },
  { label: "Privacidade", value: "privacidade", icon: "lock-closed-outline" },
  { label: "Ajuda", value: "ajuda", icon: "help-circle-outline" },
  { label: "Sobre", value: "sobre", icon: "information-circle-outline" },
];

export default function ProfileSettingsScreen() {
  const params = useLocalSearchParams();
  const initialTab = String(params.aba ?? "assinaturas") as SettingsTab;

  const [activeTab, setActiveTab] = useState<SettingsTab>(
    tabs.some((tab) => tab.value === initialTab) ? initialTab : "assinaturas",
  );

  const [allowPrivateMessages, setAllowPrivateMessages] = useState(true);
  const [showPublicStats, setShowPublicStats] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) return;

    const { data } = await supabase
      .from("profiles")
      .select("id, allow_private_messages, show_public_stats")
      .eq("id", user.id)
      .single();

    setProfile(data);
    setAllowPrivateMessages(data?.allow_private_messages ?? true);
    setShowPublicStats(data?.show_public_stats ?? true);
  }

  async function updatePrivacy(nextValues: {
    allow_private_messages?: boolean;
    show_public_stats?: boolean;
  }) {
    if (!profile?.id) return;

    await supabase
      .from("profiles")
      .update({
        ...nextValues,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
  }

  function openSupport(type: string) {
    Alert.alert(
      type,
      "Aqui você pode integrar WhatsApp, e-mail, formulário ou chat de suporte do MovenApp.",
    );
  }

  function openUrl(url: string) {
    Linking.openURL(url).catch(() => {
      Alert.alert("Não foi possível abrir", "Verifique o link informado.");
    });
  }

  const tabDescription = useMemo(() => {
    if (activeTab === "assinaturas")
      return "Plano, cobrança e benefícios da assinatura.";
    if (activeTab === "privacidade")
      return "Controle suas informações públicas e mensagens.";
    if (activeTab === "ajuda")
      return "Suporte, sugestões, erros e documentos importantes.";

    return "Versão, redes sociais e informações do aplicativo.";
  }, [activeTab]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
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
          <Text style={styles.headerEyebrow}>Sistema</Text>
          <Text style={styles.headerTitle}>Configurações</Text>
        </View>
      </View>

      <View style={styles.introCard}>
        <Text style={styles.introTitle}>Gerencie sua experiência</Text>
        <Text style={styles.introText}>{tabDescription}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.value;

          return (
            <TouchableOpacity
              key={tab.value}
              activeOpacity={0.86}
              style={[styles.tabButton, active && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.value)}
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={active ? "#06130B" : "#A1A1AA"}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {activeTab === "assinaturas" && (
        <View style={styles.sectionCard}>
          <View style={styles.planHeader}>
            <View style={styles.planIcon}>
              <Ionicons name="sparkles-outline" size={26} color="#22C55E" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Assinatura</Text>
              <Text style={styles.sectionText}>
                Controle seu plano, benefícios e histórico de pagamento.
              </Text>
            </View>
          </View>

          <View style={styles.planBox}>
            <Text style={styles.planLabel}>Plano atual</Text>
            <Text style={styles.planName}>Gratuito</Text>
            <Text style={styles.planDescription}>
              Quando sua cobrança estiver ativa, você poderá exibir aqui o
              plano, validade e status do pagamento.
            </Text>
          </View>

          <ActionItem
            icon="receipt-outline"
            title="Histórico de pagamentos"
            description="Ver recibos e transações"
            onPress={() => openSupport("Histórico de pagamentos")}
          />
          <ActionItem
            icon="card-outline"
            title="Gerenciar forma de pagamento"
            description="Cartão, Pix ou cobrança recorrente"
            onPress={() => openSupport("Forma de pagamento")}
            last
          />
        </View>
      )}

      {activeTab === "privacidade" && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Privacidade</Text>
          <Text style={styles.sectionText}>
            Ajuste como outros motoristas veem seu perfil e interagem com você.
          </Text>

          <PrivacySwitch
            title="Permitir mensagens privadas"
            description="Outros motoristas podem iniciar conversas com você."
            value={allowPrivateMessages}
            onValueChange={async (value) => {
              setAllowPrivateMessages(value);
              await updatePrivacy({ allow_private_messages: value });
            }}
          />
          <PrivacySwitch
            title="Mostrar estatísticas públicas"
            description="KM rodados e horas trabalhadas podem aparecer no seu perfil público."
            value={showPublicStats}
            onValueChange={async (value) => {
              setShowPublicStats(value);
              await updatePrivacy({ show_public_stats: value });
            }}
          />
          <ActionItem
            icon="shield-checkmark-outline"
            title="Política de privacidade"
            description="Como seus dados são tratados no MovenApp"
            onPress={() => openSupport("Política de privacidade")}
            last
          />
        </View>
      )}

      {activeTab === "ajuda" && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Central de ajuda</Text>
          <Text style={styles.sectionText}>
            Envie dúvidas, erros e sugestões para melhorar o aplicativo.
          </Text>

          <ActionItem
            icon="chatbubble-ellipses-outline"
            title="Falar com suporte"
            description="Solicite ajuda sobre sua conta ou uso do app"
            onPress={() => openSupport("Falar com suporte")}
          />
          <ActionItem
            icon="bug-outline"
            title="Reportar erro"
            description="Informe falhas, telas travando ou comportamento incorreto"
            onPress={() => openSupport("Reportar erro")}
          />
          <ActionItem
            icon="bulb-outline"
            title="Enviar sugestões"
            description="Sugira melhorias para o MovenApp"
            onPress={() => openSupport("Sugestões")}
          />
          <ActionItem
            icon="document-text-outline"
            title="Termos de uso"
            description="Regras de uso da plataforma"
            onPress={() => openSupport("Termos de uso")}
            last
          />
        </View>
      )}

      {activeTab === "sobre" && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Sobre o MovenApp</Text>
          <Text style={styles.sectionText}>
            Aplicativo para controle financeiro, jornadas, corridas, metas e
            comunidade para motoristas e entregadores.
          </Text>

          <View style={styles.versionBox}>
            <Ionicons name="phone-portrait-outline" size={24} color="#22C55E" />
            <View>
              <Text style={styles.versionLabel}>Versão do aplicativo</Text>
              <Text style={styles.versionValue}>1.0.0</Text>
            </View>
          </View>

          <ActionItem
            icon="logo-instagram"
            title="Instagram"
            description="Acompanhe novidades e conteúdos"
            onPress={() => openUrl("https://instagram.com")}
          />
          <ActionItem
            icon="logo-tiktok"
            title="TikTok"
            description="Vídeos e dicas rápidas"
            onPress={() => openUrl("https://tiktok.com")}
          />
          <ActionItem
            icon="globe-outline"
            title="Site oficial"
            description="Conheça mais sobre o MovenApp"
            onPress={() => openUrl("https://movenapp.com.br")}
            last
          />
        </View>
      )}
    </ScrollView>
  );
}

function PrivacySwitch({
  title,
  description,
  value,
  onValueChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.privacySwitch}>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#3F3F46", true: "#14532D" }}
        thumbColor={value ? "#22C55E" : "#A1A1AA"}
      />
    </View>
  );
}

function ActionItem({
  icon,
  title,
  description,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      style={[styles.actionItem, last && styles.actionItemLast]}
      onPress={onPress}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color="#22C55E" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color="#71717A" />
    </TouchableOpacity>
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
  introCard: {
    backgroundColor: "#111827",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 18,
    marginBottom: 14,
  },
  introTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  introText: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 6,
  },
  tabsContent: { gap: 10, paddingBottom: 16 },
  tabButton: {
    height: 42,
    borderRadius: 999,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  tabButtonActive: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  tabText: { color: "#A1A1AA", fontSize: 12, fontWeight: "900" },
  tabTextActive: { color: "#06130B" },
  sectionCard: {
    backgroundColor: "#111827",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 16,
  },
  sectionTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  sectionText: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 14,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "rgba(34,197,94,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  planBox: {
    backgroundColor: "#052E16",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#166534",
    padding: 15,
    marginBottom: 10,
  },
  planLabel: { color: "#BBF7D0", fontSize: 12, fontWeight: "900" },
  planName: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", marginTop: 5 },
  planDescription: {
    color: "#BBF7D0",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 6,
  },
  actionItem: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  actionItemLast: { borderBottomWidth: 0 },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(34,197,94,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  actionDescription: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 17,
  },
  privacySwitch: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  versionBox: {
    minHeight: 72,
    backgroundColor: "#18181B",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#27272A",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  versionLabel: { color: "#A1A1AA", fontSize: 12, fontWeight: "800" },
  versionValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },
});
