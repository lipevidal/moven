import { Alert } from "react-native";
import { getSubscriptionAccess } from "../services/getSubscriptionAccess";

export async function ensureCanCreateBySubscription() {
  const access = await getSubscriptionAccess();

  if (!access) return true;

  if (access.can_create) return true;

  Alert.alert(
    "Assinatura inativa",
    "Você ainda pode visualizar seus dados, mas precisa ativar sua assinatura para cadastrar novas jornadas, ganhos, despesas, veículos ou outros registros.",
  );

  return false;
}
