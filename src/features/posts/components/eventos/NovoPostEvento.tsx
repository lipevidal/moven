import { memo } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { DescricaoPostCard } from "../shared/DescricaoPostCard";
import {
  FotosPostCard,
  FotosPostCardProps,
} from "../shared/FotosPostCard";

export type NovoPostEventoProps = {
  color: string;
  startDate: string;
  onChangeStartDate: (value: string) => void;
  startTime: string;
  onChangeStartTime: (value: string) => void;
  endDate: string;
  onChangeEndDate: (value: string) => void;
  endTime: string;
  onChangeEndTime: (value: string) => void;
  address: string;
  onChangeAddress: (value: string) => void;
  description: string;
  onChangeDescription: (value: string) => void;
  images: FotosPostCardProps["images"];
  onAddImage: FotosPostCardProps["onAddImage"];
  onRemoveImage: FotosPostCardProps["onRemoveImage"];
  disabled?: boolean;
};

export const NovoPostEvento = memo(function NovoPostEvento({
  color,
  startDate,
  onChangeStartDate,
  startTime,
  onChangeStartTime,
  endDate,
  onChangeEndDate,
  endTime,
  onChangeEndTime,
  address,
  onChangeAddress,
  description,
  onChangeDescription,
  images,
  onAddImage,
  onRemoveImage,
  disabled = false,
}: NovoPostEventoProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.card, { borderColor: `${color}38` }]}>
        <View style={styles.header}>
          <Ionicons name="time-outline" size={20} color={color} />

          <View style={styles.headerText}>
            <Text style={styles.title}>Data e horário</Text>
            <Text style={styles.helper}>
              Informe quando o evento começa e termina.
            </Text>
          </View>
        </View>

        <Text style={styles.label}>Início</Text>
        <View style={styles.doubleRow}>
          <TextInput
            value={startDate}
            onChangeText={onChangeStartDate}
            placeholder="dd/mm/aaaa"
            placeholderTextColor="#77727A"
            keyboardType="numeric"
            editable={!disabled}
            style={[styles.input, { borderColor: `${color}30` }]}
          />
          <TextInput
            value={startTime}
            onChangeText={onChangeStartTime}
            placeholder="hh:mm"
            placeholderTextColor="#77727A"
            keyboardType="numeric"
            editable={!disabled}
            style={[styles.input, { borderColor: `${color}30` }]}
          />
        </View>

        <Text style={styles.label}>Fim</Text>
        <View style={styles.doubleRow}>
          <TextInput
            value={endDate}
            onChangeText={onChangeEndDate}
            placeholder="dd/mm/aaaa"
            placeholderTextColor="#77727A"
            keyboardType="numeric"
            editable={!disabled}
            style={[styles.input, { borderColor: `${color}30` }]}
          />
          <TextInput
            value={endTime}
            onChangeText={onChangeEndTime}
            placeholder="hh:mm"
            placeholderTextColor="#77727A"
            keyboardType="numeric"
            editable={!disabled}
            style={[styles.input, { borderColor: `${color}30` }]}
          />
        </View>
      </View>

      <View style={[styles.card, { borderColor: `${color}38` }]}>
        <View style={styles.header}>
          <Ionicons name="location-outline" size={20} color={color} />

          <View style={styles.headerText}>
            <Text style={styles.title}>Endereço do evento</Text>
            <Text style={styles.helper}>
              Informe o endereço completo ou um ponto de referência.
            </Text>
          </View>
        </View>

        <TextInput
          value={address}
          onChangeText={onChangeAddress}
          placeholder="Endereço completo do evento"
          placeholderTextColor="#77727A"
          editable={!disabled}
          style={[styles.addressInput, { borderColor: `${color}30` }]}
        />
      </View>

      <DescricaoPostCard
        value={description}
        onChangeText={onChangeDescription}
        color={color}
        label="Descrição do evento"
        placeholder="Descreva programação, público esperado, regras e informações importantes..."
        disabled={disabled}
      />

      <FotosPostCard
        images={images}
        color={color}
        description="Adicione cartazes, local, programação ou outras imagens do evento."
        disabled={disabled}
        onAddImage={onAddImage}
        onRemoveImage={onRemoveImage}
      />
    </View>
  );
});

export default NovoPostEvento;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 14,
  },
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
  helper: {
    color: "#979198",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  label: {
    color: "#C7C1C9",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 9,
    marginBottom: 5,
  },
  doubleRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 47,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: "#09090D",
    paddingHorizontal: 11,
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "800",
  },
  addressInput: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: "#09090D",
    paddingHorizontal: 13,
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "800",
  },
});
