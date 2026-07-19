import { memo } from "react";
import { StyleSheet, View } from "react-native";

import {
  DescricaoPostCard,
} from "../shared/DescricaoPostCard";
import {
  FotosPostCard,
  FotosPostCardProps,
} from "../shared/FotosPostCard";
import {
  LocalizacaoCard,
  LocalizacaoCardProps,
} from "./LocalizacaoCard";
import {
  SupportType,
  TipoAjudaCard,
} from "./TipoAjudaCard";

export type NovoPostSosProps = {
  color: string;
  supportType: SupportType;
  onChangeSupportType: (value: SupportType) => void;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string;
  locationLoading?: boolean;
  onRequestLocation: LocalizacaoCardProps["onRequestLocation"];
  onSetManualLocation: LocalizacaoCardProps["onSetManualLocation"];
  onRemoveLocation: LocalizacaoCardProps["onRemoveLocation"];
  description: string;
  onChangeDescription: (value: string) => void;
  images: FotosPostCardProps["images"];
  onAddImage: FotosPostCardProps["onAddImage"];
  onRemoveImage: FotosPostCardProps["onRemoveImage"];
  disabled?: boolean;
};

export const NovoPostSos = memo(function NovoPostSos({
  color,
  supportType,
  onChangeSupportType,
  latitude,
  longitude,
  locationLabel,
  locationLoading = false,
  onRequestLocation,
  onSetManualLocation,
  onRemoveLocation,
  description,
  onChangeDescription,
  images,
  onAddImage,
  onRemoveImage,
  disabled = false,
}: NovoPostSosProps) {
  return (
    <View style={styles.container}>
      <TipoAjudaCard
        value={supportType}
        onChange={onChangeSupportType}
        color={color}
        disabled={disabled}
      />

      <LocalizacaoCard
        color={color}
        latitude={latitude}
        longitude={longitude}
        locationLabel={locationLabel}
        loading={locationLoading}
        disabled={disabled}
        onRequestLocation={onRequestLocation}
        onSetManualLocation={onSetManualLocation}
        onRemoveLocation={onRemoveLocation}
      />

      <DescricaoPostCard
        value={description}
        onChangeText={onChangeDescription}
        color={color}
        label="Explique o que está acontecendo"
        placeholder="Informe onde você está, o que aconteceu e qual apoio precisa..."
        helperText="Seja objetivo para que outros motoristas consigam ajudar rapidamente."
        disabled={disabled}
      />

      <FotosPostCard
        images={images}
        color={color}
        description="Uma foto pode ajudar a explicar o problema mais rápido."
        disabled={disabled}
        onAddImage={onAddImage}
        onRemoveImage={onRemoveImage}
      />
    </View>
  );
});

export default NovoPostSos;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 14,
  },
});
