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
      stickyHeaderIndices={[0]}
    >
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerEyebrow}>Sistema</Text>
            <Text style={styles.headerTitle}>Configurações</Text>
          </View>
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
                color={active ? "#080808" : "#9B969B"}
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
              <Ionicons name="sparkles-outline" size={26} color="#D4A64A" />
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
            <Ionicons name="phone-portrait-outline" size={24} color="#D4A64A" />
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
        trackColor={{ false: "#3F3F46", true: "rgba(212,166,74,0.45)" }}
        thumbColor={value ? "#D4A64A" : "#9B969B"}
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
        <Ionicons name={icon} size={20} color="#D4A64A" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color="#8F8A91" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 50,
    backgroundColor: "#050505",
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
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  introCard: {
    backgroundColor: "#101014",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 18,
    marginBottom: 14,
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.07,
    shadowRadius: 22,
    elevation: 8,
  },
  introTitle: {
    color: "#F5F0E6",
    fontSize: 18,
    fontWeight: "900",
  },
  introText: {
    color: "#9B969B",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 6,
  },
  tabsContent: {
    gap: 10,
    paddingBottom: 16,
  },
  tabButton: {
    height: 42,
    borderRadius: 999,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  tabButtonActive: {
    backgroundColor: "#D4A64A",
    borderColor: "#D4A64A",
  },
  tabText: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "900",
  },
  tabTextActive: {
    color: "#080808",
  },
  sectionCard: {
    backgroundColor: "#101014",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 16,
  },
  sectionTitle: {
    color: "#F5F0E6",
    fontSize: 18,
    fontWeight: "900",
  },
  sectionText: {
    color: "#9B969B",
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
    borderRadius: 13,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  planBox: {
    backgroundColor: "rgba(212,166,74,0.10)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.26)",
    padding: 15,
    marginBottom: 10,
  },
  planLabel: {
    color: "#D4A64A",
    fontSize: 12,
    fontWeight: "900",
  },
  planName: {
    color: "#F5F0E6",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 5,
  },
  planDescription: {
    color: "#B8A77C",
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
    borderBottomColor: "#2A2830",
  },
  actionItemLast: {
    borderBottomWidth: 0,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(212,166,74,0.10)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  actionDescription: {
    color: "#9B969B",
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
    borderBottomColor: "#2A2830",
  },
  versionBox: {
    minHeight: 72,
    backgroundColor: "#18171D",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  versionLabel: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "800",
  },
  versionValue: {
    color: "#F5F0E6",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },
});
