import { memo } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type ValorProdutoCardProps = {
  value: string;
  onChangeText: (value: string) => void;
  color: string;
  disabled?: boolean;
};

export const ValorProdutoCard = memo(function ValorProdutoCard({
  value,
  onChangeText,
  color,
  disabled = false,
}: ValorProdutoCardProps) {
  return (
    <View style={[styles.card, { borderColor: `${color}38` }]}>
      <View style={styles.header}>
        <Ionicons name="cash-outline" size={20} color={color} />

        <View style={styles.headerText}>
          <Text style={styles.title}>Valor do produto</Text>
          <Text style={styles.description}>
            Digite o valor que será exibido no anúncio.
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.priceBox,
          { borderColor: `${color}30` },
          disabled && styles.disabled,
        ]}
      >
        <Text style={[styles.currency, { color }]}>R$</Text>

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="0,00"
          placeholderTextColor="#77727A"
          keyboardType="numeric"
          editable={!disabled}
          style={styles.input}
        />
      </View>
    </View>
  );
});

export default ValorProdutoCard;

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
  priceBox: {
    minHeight: 52,
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
  input: {
    flex: 1,
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.55,
  },
});
