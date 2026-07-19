import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import {
  DescricaoPostCard,
} from "../shared/DescricaoPostCard";
import {
  FotosPostCard,
  FotosPostCardProps,
} from "../shared/FotosPostCard";
import {
  WhatsAppCard,
} from "../shared/WhatsAppCard";
import {
  FormasPagamentoCard,
  PaymentMethodsValue,
} from "../venda/FormasPagamentoCard";
import {
  CaucaoCard,
  CaucaoValue,
} from "./CaucaoCard";
import {
  DadosVeiculoCard,
  DadosVeiculoValue,
} from "./DadosVeiculoCard";
import {
  RentalPeriodicity,
  ValorAluguelCard,
} from "./ValorAluguelCard";

export type NovoPostAluguelProps = {
  color: string;
  vehicle: DadosVeiculoValue;
  onChangeVehicle: (value: DadosVeiculoValue) => void;
  periodicity: RentalPeriodicity;
  onChangePeriodicity: (value: RentalPeriodicity) => void;
  price: string;
  onChangePrice: (value: string) => void;
  deposit: CaucaoValue;
  onChangeDeposit: (value: CaucaoValue) => void;
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

export const NovoPostAluguel = memo(function NovoPostAluguel({
  color,
  vehicle,
  onChangeVehicle,
  periodicity,
  onChangePeriodicity,
  price,
  onChangePrice,
  deposit,
  onChangeDeposit,
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
}: NovoPostAluguelProps) {
  const periodLabel = useMemo(() => {
    if (periodicity === "day") return "Diária";
    if (periodicity === "month") return "Mensal";
    return "Semanal";
  }, [periodicity]);

  return (
    <View style={styles.container}>
      <DadosVeiculoCard
        value={vehicle}
        onChange={onChangeVehicle}
        color={color}
        disabled={disabled}
      />

      <ValorAluguelCard
        periodicity={periodicity}
        onChangePeriodicity={onChangePeriodicity}
        price={price}
        onChangePrice={onChangePrice}
        color={color}
        disabled={disabled}
      />

      <CaucaoCard
        value={deposit}
        onChange={onChangeDeposit}
        color={color}
        periodLabel={periodLabel}
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
        title="WhatsApp para o aluguel"
        disabled={disabled}
      />

      <DescricaoPostCard
        value={description}
        onChangeText={onChangeDescription}
        color={color}
        label="Detalhes do aluguel"
        placeholder="Descreva documentação, seguro, quilometragem, retirada e demais condições..."
        disabled={disabled}
      />

      <FotosPostCard
        images={images}
        color={color}
        description="Mostre o veículo, o interior e detalhes importantes."
        disabled={disabled}
        onAddImage={onAddImage}
        onRemoveImage={onRemoveImage}
      />
    </View>
  );
});

export default NovoPostAluguel;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 14,
  },
});
