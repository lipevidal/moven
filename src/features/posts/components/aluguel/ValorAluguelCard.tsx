import { memo } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type RentalPeriodicity = "day" | "week" | "month";

export type ValorAluguelCardProps = {
  periodicity: RentalPeriodicity;
  onChangePeriodicity: (value: RentalPeriodicity) => void;
  price: string;
  onChangePrice: (value: string) => void;
  color: string;
  disabled?: boolean;
};

const periods: Array<{ id: RentalPeriodicity; label: string }> = [
  { id: "day", label: "Diária" },
  { id: "week", label: "Semanal" },
  { id: "month", label: "Mensal" },
];

export const ValorAluguelCard = memo(function ValorAluguelCard({
  periodicity,
  onChangePeriodicity,
  price,
  onChangePrice,
  color,
  disabled = false,
}: ValorAluguelCardProps) {
  return (
    <View style={[styles.card, { borderColor: `${color}38` }]}>
      <View style={styles.header}>
        <Ionicons name="cash-outline" size={20} color={color} />

        <View style={styles.headerText}>
          <Text style={styles.title}>Valor do aluguel</Text>
          <Text style={styles.description}>
            Escolha o período de cobrança e informe o valor.
          </Text>
        </View>
      </View>

      <View style={styles.periods}>
        {periods.map((period) => {
          const selected = periodicity === period.id;

          return (
            <TouchableOpacity
              key={period.id}
              activeOpacity={0.86}
              disabled={disabled}
              style={[
                styles.period,
                {
                  borderColor: selected
                    ? color
                    : "rgba(245,240,230,0.08)",
                  backgroundColor: selected ? `${color}16` : "#0B0B0F",
                },
              ]}
              onPress={() => onChangePeriodicity(period.id)}
            >
              <Text
                style={[
                  styles.periodText,
                  selected && { color },
                ]}
              >
                {period.label}
              </Text>
            </TouchableOpacity>
          );
        })}
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
          value={price}
          onChangeText={onChangePrice}
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

export default ValorAluguelCard;

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
  periods: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 10,
  },
  period: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  periodText: {
    color: "#AAA4AC",
    fontSize: 10,
    fontWeight: "900",
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
