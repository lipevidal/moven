import { memo } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type DescricaoPostCardProps = {
  value: string;
  onChangeText: (value: string) => void;
  color: string;
  label?: string;
  helperText?: string;
  placeholder?: string;
  maxLength?: number;
  minimumHeight?: number;
  disabled?: boolean;
};

export const DescricaoPostCard = memo(function DescricaoPostCard({
  value,
  onChangeText,
  color,
  label = "Descrição",
  helperText = "Explique com clareza o que deseja compartilhar.",
  placeholder = "Escreva os detalhes da publicação...",
  maxLength = 2000,
  minimumHeight = 150,
  disabled = false,
}: DescricaoPostCardProps) {
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
          <Ionicons name="create-outline" size={19} color={color} />
        </View>

        <View style={styles.headerTextBox}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.helperText}>{helperText}</Text>
        </View>

        <Text style={[styles.counter, { color }]}>
          {value.length}/{maxLength}
        </Text>
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#77727A"
        maxLength={maxLength}
        editable={!disabled}
        multiline
        blurOnSubmit={false}
        textAlignVertical="top"
        style={[
          styles.input,
          {
            minHeight: minimumHeight,
            borderColor: `${color}2E`,
          },
          disabled && styles.disabled,
        ]}
      />
    </View>
  );
});

export default DescricaoPostCard;

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
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
  headerTextBox: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
  },
  helperText: {
    color: "#979198",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 14,
    marginTop: 2,
  },
  counter: {
    fontSize: 10,
    fontWeight: "900",
  },
  input: {
    borderRadius: 18,
    backgroundColor: "#09090D",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 13,
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
  },
  disabled: {
    opacity: 0.6,
  },
});
