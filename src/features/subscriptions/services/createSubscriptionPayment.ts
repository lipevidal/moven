import { Linking } from "react-native";
import { supabase } from "../../../database/supabase";

type CreateSubscriptionPaymentResponse = {
  ok: boolean;
  paymentId?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  status?: string;
  value?: number;
  dueDate?: string;
  error?: string;
  message?: string;
};

export async function createSubscriptionPayment() {
  const { data, error } =
    await supabase.functions.invoke<CreateSubscriptionPaymentResponse>(
      "asaas-create-subscription-payment",
      {
        method: "POST",
      },
    );

  if (error) {
    console.log("Erro ao chamar Edge Function Asaas:", error);
    throw new Error(error.message);
  }

  if (!data?.ok) {
    throw new Error(data?.message ?? "Não foi possível gerar a cobrança.");
  }

  const paymentUrl = data.invoiceUrl || data.bankSlipUrl;

  if (!paymentUrl) {
    throw new Error("O Asaas não retornou o link de pagamento.");
  }

  const canOpen = await Linking.canOpenURL(paymentUrl);

  if (!canOpen) {
    throw new Error("Não foi possível abrir o link de pagamento.");
  }

  await Linking.openURL(paymentUrl);

  return data;
}
