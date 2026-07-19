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
  PostScope,
  SeletorEscopoCard,
} from "../shared/SeletorEscopoCard";
import {
  WhatsAppCard,
} from "../shared/WhatsAppCard";
import {
  FormasPagamentoCard,
  PaymentMethodsValue,
} from "./FormasPagamentoCard";
import { ProdutoCard } from "./ProdutoCard";
import { ValorProdutoCard } from "./ValorProdutoCard";

export type NovoPostVendaProps = {
  color: string;
  scope: PostScope;
  onChangeScope: (value: PostScope) => void;
  productName: string;
  onChangeProductName: (value: string) => void;
  productPrice: string;
  onChangeProductPrice: (value: string) => void;
  paymentMethods: PaymentMethodsValue;
  onChangePaymentMethods: (value: PaymentMethodsValue) => void;
  whatsapp: string;
  onChangeWhatsapp: (value: string) => void;
  description: string;
  onChangeDescription: (value: string) => void;
  images: FotosPostCardProps["images"];
  onAddImage: FotosPostCardProps["onAddImage"];
  onRemoveImage: FotosPostCardProps["onRemoveImage"];
  disabled?: boolean;
};

export const NovoPostVenda = memo(function NovoPostVenda({
  color,
  scope,
  onChangeScope,
  productName,
  onChangeProductName,
  productPrice,
  onChangeProductPrice,
  paymentMethods,
  onChangePaymentMethods,
  whatsapp,
  onChangeWhatsapp,
  description,
  onChangeDescription,
  images,
  onAddImage,
  onRemoveImage,
  disabled = false,
}: NovoPostVendaProps) {
  return (
    <View style={styles.container}>
      <SeletorEscopoCard
        value={scope}
        onChange={onChangeScope}
        color={color}
        disabled={disabled}
      />

      <ProdutoCard
        value={productName}
        onChangeText={onChangeProductName}
        color={color}
        disabled={disabled}
      />

      <ValorProdutoCard
        value={productPrice}
        onChangeText={onChangeProductPrice}
        color={color}
        disabled={disabled}
      />

      <FormasPagamentoCard
        value={paymentMethods}
        onChange={onChangePaymentMethods}
        color={color}
        disabled={disabled}
      />

      <WhatsAppCard
        value={whatsapp}
        onChangeText={onChangeWhatsapp}
        color={color}
        title="WhatsApp do vendedor"
        disabled={disabled}
      />

      <DescricaoPostCard
        value={description}
        onChangeText={onChangeDescription}
        color={color}
        label="Descrição do produto"
        placeholder="Descreva o estado do produto, retirada, entrega, negociação e observações importantes..."
        disabled={disabled}
      />

      <FotosPostCard
        images={images}
        color={color}
        description="Boas fotos aumentam a chance de venda."
        disabled={disabled}
        onAddImage={onAddImage}
        onRemoveImage={onRemoveImage}
      />
    </View>
  );
});

export default NovoPostVenda;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 14,
  },
});
