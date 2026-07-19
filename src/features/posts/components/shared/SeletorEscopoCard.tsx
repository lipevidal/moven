import { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type PostScope = "city" | "national";

export type SeletorEscopoCardProps = {
  value: PostScope;
  onChange: (value: PostScope) => void;
  color: string;
  disabled?: boolean;
  title?: string;
  description?: string;
  allowNational?: boolean;
};

export const SeletorEscopoCard = memo(function SeletorEscopoCard({
  value,
  onChange,
  color,
  disabled = false,
  title = "Onde publicar",
  description = "Escolha quem poderá visualizar esta publicação.",
  allowNational = true,
}: SeletorEscopoCardProps) {
  const options: Array<{
    id: PostScope;
    label: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    {
      id: "city",
      label: "Minha região",
      subtitle: "Motoristas da sua região imediata.",
      icon: "location-outline",
    },
    ...(allowNational
      ? [
          {
            id: "national" as const,
            label: "Brasil",
            subtitle: "Motoristas de todas as regiões.",
            icon: "earth-outline" as const,
          },
        ]
      : []),
  ];

  return (
    <View style={[styles.card, { borderColor: `${color}38` }]}>
      <View style={styles.header}>
        <Ionicons name="people-outline" size={20} color={color} />

        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>

      <View style={styles.options}>
        {options.map((option) => {
          const selected = value === option.id;

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
                  styles.optionIcon,
                  {
                    backgroundColor: selected
                      ? `${color}22`
                      : "rgba(245,240,230,0.04)",
                  },
                ]}
              >
                <Ionicons
                  name={option.icon}
                  size={18}
                  color={selected ? color : "#8F8990"}
                />
              </View>

              <View style={styles.optionTextBox}>
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
                size={20}
                color={selected ? color : "#5E5961"}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

export default SeletorEscopoCard;

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
    minHeight: 62,
    borderRadius: 17,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTextBox: {
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
    marginTop: 2,
  },
  disabled: {
    opacity: 0.55,
  },
});
