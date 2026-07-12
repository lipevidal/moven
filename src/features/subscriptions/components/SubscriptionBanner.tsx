import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SubscriptionAccess } from "../services/getSubscriptionAccess";
import { createSubscriptionPayment } from "../services/createSubscriptionPayment";

type SubscriptionBannerProps = {
  access: SubscriptionAccess | null;
  onPaymentCreated?: () => void;
};

function formatCurrency(value: number) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function SubscriptionBanner({
  access,
  onPaymentCreated,
}: SubscriptionBannerProps) {
  const [loadingPayment, setLoadingPayment] = useState(false);

  if (!access?.show_payment_alert && !access?.show_deletion_warning) {
    return null;
  }

  const danger = access.status === "inactive" || access.show_deletion_warning;

  async function handleSubscribe() {
    try {
      setLoadingPayment(true);
      await createSubscriptionPayment();
      onPaymentCreated?.();
    } catch (error: any) {
      Alert.alert(
        "Não foi possível abrir o pagamento",
        error?.message ?? "Tente novamente.",
      );
    } finally {
      setLoadingPayment(false);
    }
  }

  return (
    <View style={[styles.card, danger && styles.cardDanger]}>
      <View style={styles.topRow}>
        <View style={[styles.iconBox, danger && styles.iconBoxDanger]}>
          <Ionicons
            name={danger ? "alert-circle-outline" : "time-outline"}
            size={22}
            color={danger ? "#FCA5A5" : "#D4A64A"}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{access.alert_title}</Text>
          <Text style={styles.message}>{access.alert_message}</Text>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.button}
        onPress={handleSubscribe}
        disabled={loadingPayment}
      >
        {loadingPayment ? (
          <ActivityIndicator color="#080808" />
        ) : (
          <>
            <Ionicons name="card-outline" size={18} color="#080808" />
            <Text style={styles.buttonText}>
              Assinar por R$ {formatCurrency(access.monthly_price)}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.30)",
    borderLeftWidth: 4,
    borderLeftColor: "#D4A64A",
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 18,
    marginBottom: 14,
  },
  cardDanger: {
    backgroundColor: "rgba(239,68,68,0.10)",
    borderColor: "rgba(239,68,68,0.26)",
    borderLeftColor: "#EF4444",
  },
  topRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxDanger: {
    backgroundColor: "rgba(239,68,68,0.14)",
    borderColor: "rgba(239,68,68,0.24)",
  },
  title: {
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "900",
  },
  message: {
    color: "#B8B1B8",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 4,
  },
  button: {
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 13,
  },
  buttonText: {
    color: "#080808",
    fontSize: 13,
    fontWeight: "900",
  },
});
