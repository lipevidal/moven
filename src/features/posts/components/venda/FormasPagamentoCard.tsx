import { memo } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type PaymentMethodsValue = {
  credit: boolean;
  creditInstallments: string;
  debit: boolean;
  pix: boolean;
  other: boolean;
  otherDescription: string;
};

export type FormasPagamentoCardProps = {
  value: PaymentMethodsValue;
  onChange: (value: PaymentMethodsValue) => void;
  color: string;
  disabled?: boolean;
};

export const FormasPagamentoCard = memo(function FormasPagamentoCard({
  value,
  onChange,
  color,
  disabled = false,
}: FormasPagamentoCardProps) {
  function update<Key extends keyof PaymentMethodsValue>(
    key: Key,
    nextValue: PaymentMethodsValue[Key],
  ) {
    onChange({
      ...value,
      [key]: nextValue,
    });
  }

  const options: Array<{
    key: "credit" | "debit" | "pix" | "other";
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    { key: "credit", label: "Crédito", icon: "card-outline" },
    { key: "debit", label: "Débito", icon: "wallet-outline" },
    { key: "pix", label: "Pix", icon: "flash-outline" },
    { key: "other", label: "Outro", icon: "ellipsis-horizontal" },
  ];

  return (
    <View style={[styles.card, { borderColor: `${color}38` }]}>
      <View style={styles.header}>
        <Ionicons name="card-outline" size={20} color={color} />

        <View style={styles.headerText}>
          <Text style={styles.title}>Formas de pagamento</Text>
          <Text style={styles.description}>
            Marque todas as opções que você aceita.
          </Text>
        </View>
      </View>

      <View style={styles.options}>
        {options.map((option) => {
          const selected = Boolean(value[option.key]);

          return (
            <TouchableOpacity
              key={option.key}
              activeOpacity={0.86}
              disabled={disabled}
              style={[
                styles.option,
                {
                  borderColor: selected ? color : "rgba(245,240,230,0.08)",
                  backgroundColor: selected ? `${color}16` : "#0B0B0F",
                },
                disabled && styles.disabled,
              ]}
              onPress={() => update(option.key, !selected)}
            >
              <Ionicons
                name={option.icon}
                size={18}
                color={selected ? color : "#8C868E"}
              />
              <Text
                style={[
                  styles.optionText,
                  selected && { color },
                ]}
              >
                {option.label}
              </Text>
              <Ionicons
                name={selected ? "checkmark-circle" : "ellipse-outline"}
                size={19}
                color={selected ? color : "#5E5961"}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {value.credit ? (
        <TextInput
          value={value.creditInstallments}
          onChangeText={(text) =>
            update(
              "creditInstallments",
              text.replace(/\D/g, "").slice(0, 2),
            )
          }
          placeholder="Parcelamento máximo. Ex: 3"
          placeholderTextColor="#77727A"
          keyboardType="numeric"
          editable={!disabled}
          style={[
            styles.input,
            { borderColor: `${color}30` },
          ]}
        />
      ) : null}

      {value.other ? (
        <TextInput
          value={value.otherDescription}
          onChangeText={(text) => update("otherDescription", text)}
          placeholder="Descreva a outra forma de pagamento"
          placeholderTextColor="#77727A"
          editable={!disabled}
          style={[
            styles.input,
            { borderColor: `${color}30` },
          ]}
        />
      ) : null}
    </View>
  );
});

export default FormasPagamentoCard;

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: "#101014",
    padding: 13,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 11,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
  },
  description: {
    color: "#979198",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  options: {
    gap: 8,
  },
  option: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  optionText: {
    flex: 1,
    color: "#F5F0E6",
    fontSize: 11,
    fontWeight: "900",
  },
  input: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: "#09090D",
    paddingHorizontal: 13,
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 9,
  },
  disabled: {
    opacity: 0.55,
  },
});
