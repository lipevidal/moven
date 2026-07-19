import { memo } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type WhatsAppCardProps = {
  value: string;
  onChangeText: (value: string) => void;
  color: string;
  title?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
};

export const WhatsAppCard = memo(function WhatsAppCard({
  value,
  onChangeText,
  color,
  title = "WhatsApp para contato",
  description = "O app criará um link para a pessoa falar diretamente com você.",
  placeholder = "(31) 99999-9999 ou link do WhatsApp",
  disabled = false,
}: WhatsAppCardProps) {
  return (
    <View style={[styles.card, { borderColor: `${color}38` }]}>
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: `${color}18`,
            borderColor: `${color}45`,
          },
        ]}
      >
        <Ionicons name="logo-whatsapp" size={23} color={color} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#77727A"
          keyboardType="phone-pad"
          autoCapitalize="none"
          editable={!disabled}
          style={[
            styles.input,
            { borderColor: `${color}30` },
            disabled && styles.disabled,
          ]}
        />
      </View>
    </View>
  );
});

export default WhatsAppCard;

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    padding: 13,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    minWidth: 0,
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
    marginTop: 3,
    marginBottom: 10,
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
    opacity: 0.6,
  },
});
