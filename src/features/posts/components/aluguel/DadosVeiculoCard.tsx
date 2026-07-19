import { memo } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type DadosVeiculoValue = {
  brand: string;
  model: string;
  year: string;
};

export type DadosVeiculoCardProps = {
  value: DadosVeiculoValue;
  onChange: (value: DadosVeiculoValue) => void;
  color: string;
  disabled?: boolean;
};

export const DadosVeiculoCard = memo(function DadosVeiculoCard({
  value,
  onChange,
  color,
  disabled = false,
}: DadosVeiculoCardProps) {
  function update(key: keyof DadosVeiculoValue, nextValue: string) {
    onChange({
      ...value,
      [key]: nextValue,
    });
  }

  return (
    <View style={[styles.card, { borderColor: `${color}38` }]}>
      <View style={styles.header}>
        <Ionicons name="car-outline" size={20} color={color} />

        <View style={styles.headerText}>
          <Text style={styles.title}>Dados do veículo</Text>
          <Text style={styles.description}>
            Informe marca, modelo e ano do veículo anunciado.
          </Text>
        </View>
      </View>

      <Text style={styles.label}>Marca</Text>
      <TextInput
        value={value.brand}
        onChangeText={(text) => update("brand", text)}
        placeholder="Ex: Hyundai"
        placeholderTextColor="#77727A"
        editable={!disabled}
        style={[styles.input, { borderColor: `${color}30` }]}
      />

      <Text style={styles.label}>Modelo</Text>
      <TextInput
        value={value.model}
        onChangeText={(text) => update("model", text)}
        placeholder="Ex: HB20"
        placeholderTextColor="#77727A"
        editable={!disabled}
        style={[styles.input, { borderColor: `${color}30` }]}
      />

      <Text style={styles.label}>Ano</Text>
      <TextInput
        value={value.year}
        onChangeText={(text) =>
          update("year", text.replace(/\D/g, "").slice(0, 4))
        }
        placeholder="Ex: 2023"
        placeholderTextColor="#77727A"
        keyboardType="numeric"
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

export default DadosVeiculoCard;

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
    fontWeight: "700",
    lineHeight: 14,
    marginTop: 2,
  },
  label: {
    color: "#C7C1C9",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 9,
    marginBottom: 5,
  },
  input: {
    minHeight: 47,
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
