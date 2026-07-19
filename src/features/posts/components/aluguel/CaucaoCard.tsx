import { memo } from "react";
import {
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type CaucaoValue = {
  required: boolean;
  amount: string;
  installments: string;
  paidOnDelivery: boolean;
};

export type CaucaoCardProps = {
  value: CaucaoValue;
  onChange: (value: CaucaoValue) => void;
  color: string;
  periodLabel: string;
  disabled?: boolean;
};

export const CaucaoCard = memo(function CaucaoCard({
  value,
  onChange,
  color,
  periodLabel,
  disabled = false,
}: CaucaoCardProps) {
  function update<Key extends keyof CaucaoValue>(
    key: Key,
    nextValue: CaucaoValue[Key],
  ) {
    onChange({
      ...value,
      [key]: nextValue,
    });
  }

  return (
    <View style={[styles.card, { borderColor: `${color}38` }]}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark-outline" size={20} color={color} />

        <View style={styles.headerText}>
          <Text style={styles.title}>Caução e retirada</Text>
          <Text style={styles.description}>
            Defina a garantia e o pagamento no momento da retirada.
          </Text>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Exigir caução</Text>
        <Switch
          value={value.required}
          onValueChange={(next) => update("required", next)}
          disabled={disabled}
          trackColor={{
            false: "#302E35",
            true: `${color}70`,
          }}
          thumbColor={value.required ? color : "#AAA4AC"}
        />
      </View>

      {value.required ? (
        <>
          <Text style={styles.label}>Valor da caução</Text>
          <View style={[styles.priceBox, { borderColor: `${color}30` }]}>
            <Text style={[styles.currency, { color }]}>R$</Text>
            <TextInput
              value={value.amount}
              onChangeText={(text) => update("amount", text)}
              placeholder="0,00"
              placeholderTextColor="#77727A"
              keyboardType="numeric"
              editable={!disabled}
              style={styles.priceInput}
            />
          </View>

          <Text style={styles.label}>Parcelamento máximo da caução</Text>
          <TextInput
            value={value.installments}
            onChangeText={(text) =>
              update(
                "installments",
                text.replace(/\D/g, "").slice(0, 2),
              )
            }
            placeholder="Ex: 3"
            placeholderTextColor="#77727A"
            keyboardType="numeric"
            editable={!disabled}
            style={[styles.input, { borderColor: `${color}30` }]}
          />
        </>
      ) : null}

      <View style={[styles.toggleRow, styles.deliveryRow]}>
        <View style={styles.deliveryText}>
          <Text style={styles.toggleLabel}>
            Pagar {periodLabel.toLowerCase()} na retirada
          </Text>
          <Text style={styles.toggleDescription}>
            Inclui o primeiro período no valor cobrado ao retirar o veículo.
          </Text>
        </View>

        <Switch
          value={value.paidOnDelivery}
          onValueChange={(next) => update("paidOnDelivery", next)}
          disabled={disabled}
          trackColor={{
            false: "#302E35",
            true: `${color}70`,
          }}
          thumbColor={value.paidOnDelivery ? color : "#AAA4AC"}
        />
      </View>
    </View>
  );
});

export default CaucaoCard;

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
    marginBottom: 8,
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
  toggleRow: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: "#0B0B0F",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },
  toggleLabel: {
    color: "#F5F0E6",
    fontSize: 11,
    fontWeight: "900",
  },
  toggleDescription: {
    color: "#858087",
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  label: {
    color: "#C7C1C9",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 5,
  },
  priceBox: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: "#09090D",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currency: {
    fontSize: 14,
    fontWeight: "900",
  },
  priceInput: {
    flex: 1,
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  input: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: "#09090D",
    paddingHorizontal: 13,
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "800",
  },
  deliveryRow: {
    marginTop: 11,
  },
  deliveryText: {
    flex: 1,
  },
});
