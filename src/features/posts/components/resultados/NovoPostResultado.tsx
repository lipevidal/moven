import { memo, ReactNode } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { DescricaoPostCard } from "../shared/DescricaoPostCard";
import {
  FotosPostCard,
  FotosPostCardProps,
} from "../shared/FotosPostCard";

export type ResultPeriod = "turn" | "day" | "week" | "month" | "year";

export type NovoPostResultadoProps = {
  color: string;
  period: ResultPeriod;
  onChangePeriod: (value: ResultPeriod) => void;
  referenceLabel: string;
  onChangeReference?: () => void;
  loadingPreview?: boolean;
  onLoadPreview: () => void | Promise<void>;
  preview?: ReactNode;
  description: string;
  onChangeDescription: (value: string) => void;
  images: FotosPostCardProps["images"];
  onAddImage: FotosPostCardProps["onAddImage"];
  onRemoveImage: FotosPostCardProps["onRemoveImage"];
  disabled?: boolean;
};

const periods: Array<{ id: ResultPeriod; label: string }> = [
  { id: "turn", label: "Turno" },
  { id: "day", label: "Dia" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
  { id: "year", label: "Ano" },
];

export const NovoPostResultado = memo(function NovoPostResultado({
  color,
  period,
  onChangePeriod,
  referenceLabel,
  onChangeReference,
  loadingPreview = false,
  onLoadPreview,
  preview,
  description,
  onChangeDescription,
  images,
  onAddImage,
  onRemoveImage,
  disabled = false,
}: NovoPostResultadoProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.card, { borderColor: `${color}38` }]}>
        <View style={styles.header}>
          <Ionicons name="calendar-outline" size={20} color={color} />

          <View style={styles.headerText}>
            <Text style={styles.title}>Período e referência</Text>
            <Text style={styles.description}>
              Escolha qual resultado do app será compartilhado.
            </Text>
          </View>
        </View>

        <View style={styles.periods}>
          {periods.map((option) => {
            const selected = period === option.id;

            return (
              <TouchableOpacity
                key={option.id}
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
                onPress={() => onChangePeriod(option.id)}
              >
                <Text
                  style={[
                    styles.periodText,
                    selected && { color },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          activeOpacity={0.86}
          disabled={disabled || !onChangeReference}
          style={[
            styles.referenceButton,
            { borderColor: `${color}30` },
          ]}
          onPress={onChangeReference}
        >
          <View style={styles.referenceText}>
            <Text style={styles.referenceLabel}>Referência selecionada</Text>
            <Text style={styles.referenceValue}>{referenceLabel}</Text>
          </View>

          {onChangeReference ? (
            <Ionicons name="chevron-forward" size={18} color={color} />
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.88}
          disabled={disabled || loadingPreview}
          style={[
            styles.loadButton,
            { backgroundColor: color },
            (disabled || loadingPreview) && styles.disabled,
          ]}
          onPress={onLoadPreview}
        >
          {loadingPreview ? (
            <ActivityIndicator color="#080808" />
          ) : (
            <>
              <Ionicons name="analytics-outline" size={19} color="#080808" />
              <Text style={styles.loadButtonText}>Carregar resultado</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {preview ? (
        <View style={[styles.previewCard, { borderColor: `${color}38` }]}>
          {preview}
        </View>
      ) : null}

      <DescricaoPostCard
        value={description}
        onChangeText={onChangeDescription}
        color={color}
        label="Comentário sobre o resultado"
        placeholder="Comente estratégias, metas, dificuldades e aprendizados do período..."
        disabled={disabled}
      />

      <FotosPostCard
        images={images}
        color={color}
        description="Adicione comprovantes ou imagens relacionadas ao resultado."
        disabled={disabled}
        onAddImage={onAddImage}
        onRemoveImage={onRemoveImage}
      />
    </View>
  );
});

export default NovoPostResultado;

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
    flexWrap: "wrap",
    gap: 7,
  },
  period: {
    minWidth: "30%",
    flexGrow: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  periodText: {
    color: "#AAA4AC",
    fontSize: 10,
    fontWeight: "900",
  },
  referenceButton: {
    minHeight: 58,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: "#09090D",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 10,
  },
  referenceText: {
    flex: 1,
  },
  referenceLabel: {
    color: "#858087",
    fontSize: 9,
    fontWeight: "800",
  },
  referenceValue: {
    color: "#F5F0E6",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },
  loadButton: {
    minHeight: 49,
    borderRadius: 15,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadButtonText: {
    color: "#080808",
    fontSize: 12,
    fontWeight: "900",
  },
  previewCard: {
    width: "100%",
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: "#101014",
    padding: 12,
  },
  disabled: {
    opacity: 0.55,
  },
});
