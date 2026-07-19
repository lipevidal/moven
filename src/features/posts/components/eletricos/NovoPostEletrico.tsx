import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { DescricaoPostCard } from "../shared/DescricaoPostCard";
import {
  FotosPostCard,
  FotosPostCardProps,
} from "../shared/FotosPostCard";

export type NovoPostEletricoProps = {
  color: string;
  description: string;
  onChangeDescription: (value: string) => void;
  images: FotosPostCardProps["images"];
  onAddImage: FotosPostCardProps["onAddImage"];
  onRemoveImage: FotosPostCardProps["onRemoveImage"];
  disabled?: boolean;
};

export const NovoPostEletrico = memo(function NovoPostEletrico({
  color,
  description,
  onChangeDescription,
  images,
  onAddImage,
  onRemoveImage,
  disabled = false,
}: NovoPostEletricoProps) {
  return (
    <View style={styles.container}>
      <DescricaoPostCard
        value={description}
        onChangeText={onChangeDescription}
        color={color}
        label="Conteúdo sobre elétricos e híbridos"
        helperText="Compartilhe consumo, autonomia, carregamento, custos, dúvidas ou experiências."
        placeholder="Conte sua experiência com veículos elétricos ou híbridos..."
        disabled={disabled}
      />

      <FotosPostCard
        images={images}
        color={color}
        description="Adicione fotos do veículo, carregamento, consumo ou detalhes técnicos."
        disabled={disabled}
        onAddImage={onAddImage}
        onRemoveImage={onRemoveImage}
      />
    </View>
  );
});

export default NovoPostEletrico;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 14,
  },
});
