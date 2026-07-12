import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  getSubscriptionAccess,
  SubscriptionAccess,
} from "../services/getSubscriptionAccess";

export function useSubscriptionAccess() {
  const [access, setAccess] = useState<SubscriptionAccess | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadSubscriptionAccess() {
    try {
      setLoading(true);
      const response = await getSubscriptionAccess();
      setAccess(response);
    } catch (error) {
      console.log("Erro ao buscar assinatura:", error);
      setAccess(null);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadSubscriptionAccess();
    }, []),
  );

  return {
    access,
    loading,
    reloadSubscriptionAccess: loadSubscriptionAccess,
    canCreate: access?.can_create ?? true,
    isInactive: access?.status === "inactive" || access?.status === "deleted",
  };
}
