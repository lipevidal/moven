import { memo } from "react";
import { StyleSheet, View } from "react-native";

import {
  DescricaoPostCard,
  DescricaoPostCardProps,
} from "../shared/DescricaoPostCard";
import {
  FotosPostCard,
  FotosPostCardProps,
} from "../shared/FotosPostCard";

export type NovoPostGeralProps = {
  color: string;
  description: string;
  onChangeDescription: (value: string) => void;
  images: FotosPostCardProps["images"];
  onAddImage: FotosPostCardProps["onAddImage"];
  onRemoveImage: FotosPostCardProps["onRemoveImage"];
  disabled?: boolean;
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
  photosDescription?: string;
};

export const NovoPostGeral = memo(function NovoPostGeral({
  color,
  description,
  onChangeDescription,
  images,
  onAddImage,
  onRemoveImage,
  disabled = false,
  descriptionLabel = "O que você quer compartilhar?",
  descriptionPlaceholder = "Conte uma dica, faça uma pergunta ou compartilhe algo que ajude outros motoristas...",
  photosDescription = "Adicione imagens que ajudem a complementar a publicação.",
}: NovoPostGeralProps) {
  return (
    <View style={styles.container}>
      <DescricaoPostCard
        value={description}
        onChangeText={onChangeDescription}
        color={color}
        label={descriptionLabel}
        placeholder={descriptionPlaceholder}
        disabled={disabled}
      />

      <FotosPostCard
        images={images}
        color={color}
        description={photosDescription}
        disabled={disabled}
        onAddImage={onAddImage}
        onRemoveImage={onRemoveImage}
      />
    </View>
  );
});

export default NovoPostGeral;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 14,
  },
});
