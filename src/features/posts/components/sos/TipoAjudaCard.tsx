import { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type SupportType = "passenger_problem" | "vehicle_breakdown";

export type TipoAjudaCardProps = {
  value: SupportType;
  onChange: (value: SupportType) => void;
  color: string;
  disabled?: boolean;
};

const options: Array<{
  id: SupportType;
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    id: "passenger_problem",
    label: "Problema com passageiro",
    subtitle: "Situação de segurança, conflito ou apoio durante uma corrida.",
    icon: "people-outline",
  },
  {
    id: "vehicle_breakdown",
    label: "Pane no veículo",
    subtitle: "Problema mecânico, elétrico, pneu ou impossibilidade de seguir.",
    icon: "construct-outline",
  },
];

export const TipoAjudaCard = memo(function TipoAjudaCard({
  value,
  onChange,
  color,
  disabled = false,
}: TipoAjudaCardProps) {
  return (
    <View style={[styles.card, { borderColor: `${color}38` }]}>
      <Text style={styles.title}>Que tipo de ajuda você precisa?</Text>
      <Text style={styles.description}>
        Escolha a opção que melhor representa a situação.
      </Text>

      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.id === value;

          return (
            <TouchableOpacity
              key={option.id}
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
              onPress={() => onChange(option.id)}
            >
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: selected
                      ? `${color}22`
                      : "rgba(245,240,230,0.04)",
                  },
                ]}
              >
                <Ionicons
                  name={option.icon}
                  size={20}
                  color={selected ? color : "#A39DA5"}
                />
              </View>

              <View style={styles.optionText}>
                <Text
                  style={[
                    styles.optionLabel,
                    selected && { color },
                  ]}
                >
                  {option.label}
                </Text>
                <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
              </View>

              <Ionicons
                name={selected ? "checkmark-circle" : "ellipse-outline"}
                size={21}
                color={selected ? color : "#5E5961"}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

export default TipoAjudaCard;

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: "#101014",
    padding: 13,
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
    marginTop: 3,
    marginBottom: 11,
  },
  options: {
    gap: 8,
  },
  option: {
    minHeight: 70,
    borderRadius: 17,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "900",
  },
  optionSubtitle: {
    color: "#858087",
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "700",
    marginTop: 3,
  },
  disabled: {
    opacity: 0.55,
  },
});
