import { memo } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type ProdutoCardProps = {
  value: string;
  onChangeText: (value: string) => void;
  color: string;
  disabled?: boolean;
};

export const ProdutoCard = memo(function ProdutoCard({
  value,
  onChangeText,
  color,
  disabled = false,
}: ProdutoCardProps) {
  return (
    <View style={[styles.card, { borderColor: `${color}38` }]}>
      <View style={styles.header}>
        <View
          style={[
            styles.iconBox,
            {
              backgroundColor: `${color}16`,
              borderColor: `${color}35`,
            },
          ]}
        >
          <Ionicons name="cube-outline" size={19} color={color} />
        </View>

        <View style={styles.headerText}>
          <Text style={styles.title}>Produto</Text>
          <Text style={styles.description}>
            Informe um nome claro para o item anunciado.
          </Text>
        </View>
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Ex: Suporte para celular"
        placeholderTextColor="#77727A"
        editable={!disabled}
        style={[
          styles.input,
          { borderColor: `${color}30` },
          disabled && styles.disabled,
        ]}
      />
    </View>
  );
});

export default ProdutoCard;

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
    gap: 10,
    marginBottom: 11,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
  disabled: {
    opacity: 0.55,
  },
});
