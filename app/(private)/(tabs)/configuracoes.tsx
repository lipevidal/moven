import { useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  Switch,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";

import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type IconName = any;
import { supabase } from "../../../src/database/supabase";

type SettingsTab = "assinaturas" | "privacidade" | "ajuda" | "sobre";

type SubscriptionStatus = "trial" | "active" | "inactive" | "deleted";

type SubscriptionAccess = {
  user_id: string;
  status: SubscriptionStatus;
  can_create: boolean;
  monthly_price: number;
  current_period_end: string | null;
  days_until_due: number;
  days_inactive: number;
  days_until_deletion: number | null;
  show_payment_alert: boolean;
  show_deletion_warning: boolean;
  alert_title: string;
  alert_message: string;
};

type SubscriptionPlanType =
  | "standard"
  | "trial"
  | "free"
  | "admin_free"
  | "discount"
  | "inactive"
  | "deleted";

type SubscriptionPlanDetails = {
  user_id: string;
  plan_type: SubscriptionPlanType;
  plan_title: string;
  plan_description: string;
  is_free_plan: boolean;
  has_discount: boolean;
  discount_type: "amount" | "percentage" | null;
  discount_value: number | null;
  monthly_price: number;
  final_monthly_price: number;
  savings_amount: number;
  rule_label: string | null;
  rule_description: string | null;
};

type SubscriptionDiscountCardDetails = {
  has_discount: boolean;
  discount_type: "amount" | "percentage" | null;
  discount_value: number;
  monthly_price: number;
  discount_amount: number;
  amount_to_pay: number;
  discount_label: string | null;
  discount_description: string | null;
};

type SubscriptionRuleRecord = {
  id?: string;
  user_id?: string;
  rule_type?: string | null;
  label?: string | null;
  description?: string | null;
  discount_type?: "amount" | "percentage" | string | null;
  discount_value?: number | string | null;
  discount_percent?: number | string | null;
  discount_percentage?: number | string | null;
  is_free_plan?: boolean | null;
  is_active?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at?: string | null;
};

type SubscriptionPayment = {
  id: string;
  asaas_payment_id: string;
  asaas_subscription_id?: string | null;
  status: string;
  billing_type?: string | null;
  amount: number;
  due_date: string;
  invoice_url: string | null;
  bank_slip_url: string | null;
  paid_at: string | null;
  created_at: string;
};

type AsaasRecurringSubscription = {
  id: string;
  user_id: string;
  asaas_subscription_id: string;
  asaas_customer_id: string;
  status: string;
  billing_type: string;
  cycle: string;
  amount: number;
  next_due_date: string;
  created_at: string;
  updated_at?: string | null;
};

const tabs: {
  label: string;
  value: SettingsTab;
  icon: IconName;
}[] = [
  { label: "Assinaturas", value: "assinaturas", icon: "card-outline" },
  { label: "Privacidade", value: "privacidade", icon: "lock-closed-outline" },
  { label: "Ajuda", value: "ajuda", icon: "help-circle-outline" },
  { label: "Sobre", value: "sobre", icon: "information-circle-outline" },
];

function formatCurrency(value?: number | null) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "Não informado";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Não informado";

  return date.toLocaleDateString("pt-BR");
}


function maskCpfCnpj(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 14);

  if (numbers.length <= 11) {
    return numbers
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  return numbers
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function onlyDigits(value?: string | null) {
  return String(value ?? "").replace(/\D/g, "");
}


async function getCurrentAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? "";
}

function isValidCpfCnpjLength(value: string) {
  const numbers = onlyDigits(value);

  return numbers.length === 11 || numbers.length === 14;
}



function isCpfCnpjError(message?: string | null) {
  const text = String(message ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return (
    text.includes("cpf") ||
    text.includes("cnpj") ||
    text.includes("documento") ||
    text.includes("invalid_cpf_cnpj") ||
    text.includes("missing_cpf_cnpj")
  );
}

function normalizeStatus(status?: string | null) {
  return String(status ?? "").toLowerCase();
}

function getSubscriptionStatusInfo(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized === "trial") {
    return {
      label: "Novo usuário",
      title: "Período de carência",
      icon: "gift-outline" as IconName,
      color: "#D4A64A",
      backgroundColor: "rgba(212,166,74,0.12)",
      borderColor: "rgba(212,166,74,0.28)",
      description:
        "Você está no período de carência. Ative sua assinatura para manter o acesso após o vencimento.",
    };
  }

  if (normalized === "active") {
    return {
      label: "Ativo",
      title: "Assinatura ativa",
      icon: "checkmark-circle-outline" as IconName,
      color: "#22C55E",
      backgroundColor: "rgba(34,197,94,0.12)",
      borderColor: "rgba(34,197,94,0.28)",
      description:
        "Sua conta está liberada para cadastrar jornadas, ganhos, despesas e veículos.",
    };
  }

  if (normalized === "inactive") {
    return {
      label: "Inativo",
      title: "Assinatura inativa",
      icon: "alert-circle-outline" as IconName,
      color: "#EF4444",
      backgroundColor: "rgba(239,68,68,0.12)",
      borderColor: "rgba(239,68,68,0.28)",
      description:
        "Sua assinatura está inativa. Ative sua assinatura para voltar a cadastrar novos dados.",
    };
  }

  if (normalized === "deleted") {
    return {
      label: "Exclusão",
      title: "Conta marcada para exclusão",
      icon: "trash-outline" as IconName,
      color: "#EF4444",
      backgroundColor: "rgba(239,68,68,0.12)",
      borderColor: "rgba(239,68,68,0.28)",
      description:
        "Sua conta está marcada para exclusão por falta de ativação da assinatura.",
    };
  }

  return {
    label: "Indefinido",
    title: "Status indisponível",
    icon: "help-circle-outline" as IconName,
    color: "#9B969B",
    backgroundColor: "rgba(155,150,155,0.10)",
    borderColor: "rgba(155,150,155,0.22)",
    description:
      "Não foi possível identificar os detalhes do seu plano neste momento.",
  };
}


function getSubscriptionPlanVisualInfo(
  access?: SubscriptionAccess | null,
  plan?: SubscriptionPlanDetails | null,
) {
  if (plan?.plan_type === "admin_free") {
    return {
      label: "Admin",
      title: "Plano gratuito",
      icon: "shield-checkmark-outline" as IconName,
      color: "#60A5FA",
      backgroundColor: "rgba(96,165,250,0.12)",
      borderColor: "rgba(96,165,250,0.28)",
      description:
        plan.plan_description ||
        "Administradores possuem plano gratuito por padrão.",
    };
  }

  if (plan?.plan_type === "free" || plan?.is_free_plan) {
    return {
      label: "Gratuito",
      title: "Plano gratuito",
      icon: "gift-outline" as IconName,
      color: "#22C55E",
      backgroundColor: "rgba(34,197,94,0.12)",
      borderColor: "rgba(34,197,94,0.28)",
      description:
        plan.plan_description ||
        "Seu plano está liberado gratuitamente. Você não paga mensalidade.",
    };
  }

  if (plan?.plan_type === "discount" || plan?.has_discount) {
    return {
      label: "Com desconto",
      title: "Plano com desconto",
      icon: "pricetag-outline" as IconName,
      color: "#FACC15",
      backgroundColor: "rgba(250,204,21,0.12)",
      borderColor: "rgba(250,204,21,0.28)",
      description:
        plan.plan_description ||
        "Existe um desconto aplicado ao valor da sua assinatura.",
    };
  }

  return getSubscriptionStatusInfo(access?.status);
}

function getDiscountText(plan?: SubscriptionPlanDetails | null) {
  if (!plan?.has_discount) return "";

  const value = Number(plan.discount_value ?? 0);

  if (plan.discount_type === "amount") {
    return `Desconto aplicado: ${formatCurrency(value)}`;
  }

  return `Desconto aplicado: ${value}%`;
}

function getDiscountGrantedText(plan?: SubscriptionPlanDetails | null) {
  if (!plan?.has_discount) return formatCurrency(0);

  const savingsAmount = Number(plan.savings_amount ?? 0);
  const discountValue = Number(plan.discount_value ?? 0);

  if (plan.discount_type === "amount") {
    return formatCurrency(savingsAmount || discountValue);
  }

  return `${discountValue}% (${formatCurrency(savingsAmount)})`;
}

function getDiscountGrantedDisplayText({
  plan,
  monthlyPrice,
  discountAmount,
}: {
  plan?: SubscriptionPlanDetails | null;
  monthlyPrice: number;
  discountAmount: number;
}) {
  if (!plan?.has_discount) return formatCurrency(0);

  const discountValue = Number(plan.discount_value ?? 0);

  if (plan.discount_type === "amount") {
    return formatCurrency(discountAmount || discountValue);
  }

  if (monthlyPrice > 0 && discountAmount > 0) {
    return `${discountValue}% (${formatCurrency(discountAmount)})`;
  }

  return `${discountValue}%`;
}


function getAppliedDiscountLabel(plan?: SubscriptionPlanDetails | null) {
  if (!plan?.has_discount) return "Desconto aplicado";

  const discountValue = Number(plan.discount_value ?? 0);

  if (plan.discount_type === "amount") {
    return `Desconto aplicado: ${formatCurrency(discountValue)}`;
  }

  return `Desconto aplicado: ${discountValue}%`;
}


function getEffectiveDiscountCardInfo({
  discountCard,
  plan,
  monthlyPrice,
}: {
  discountCard?: SubscriptionDiscountCardDetails | null;
  plan?: SubscriptionPlanDetails | null;
  monthlyPrice: number;
}) {
  if (discountCard?.has_discount) {
    const baseMonthlyPrice = Math.max(Number(discountCard.monthly_price ?? 0), 0);
    const discountType =
      discountCard.discount_type === "amount" ? "amount" : "percentage";
    const discountValue = Number(discountCard.discount_value ?? 0);
    const discountAmount = Math.max(Number(discountCard.discount_amount ?? 0), 0);
    const amountToPay = Math.max(Number(discountCard.amount_to_pay ?? 0), 0);

    const discountName =
      discountType === "amount"
        ? `Desconto de ${formatCurrency(discountValue)}`
        : `Desconto de ${discountValue}%`;

    const discountAmountText =
      discountType === "amount"
        ? formatCurrency(discountAmount || discountValue)
        : `${discountValue}%${
            discountAmount > 0 ? ` (${formatCurrency(discountAmount)})` : ""
          }`;

    return {
      discountName,
      monthlyPrice: baseMonthlyPrice,
      discountAmount,
      discountAmountText,
      amountToPay,
    };
  }

  if (!plan?.has_discount) return null;

  const baseMonthlyPrice = Math.max(Number(monthlyPrice ?? 0), 0);
  const discountValue = Number(plan.discount_value ?? 0);
  const discountType = plan.discount_type === "amount" ? "amount" : "percentage";

  const discountAmount =
    baseMonthlyPrice > 0
      ? discountType === "amount"
        ? Math.min(baseMonthlyPrice, Math.max(discountValue, 0))
        : baseMonthlyPrice * (Math.max(discountValue, 0) / 100)
      : Number(plan.savings_amount ?? 0);

  const amountToPay =
    baseMonthlyPrice > 0
      ? Math.max(baseMonthlyPrice - discountAmount, 0)
      : Math.max(Number(plan.final_monthly_price ?? 0), 0);

  const discountName =
    discountType === "amount"
      ? `Desconto de ${formatCurrency(discountValue)}`
      : `Desconto de ${discountValue}%`;

  const discountAmountText =
    discountType === "amount"
      ? formatCurrency(discountAmount || discountValue)
      : `${discountValue}%${
          discountAmount > 0 ? ` (${formatCurrency(discountAmount)})` : ""
        }`;

  return {
    discountName,
    monthlyPrice: baseMonthlyPrice,
    discountAmount,
    discountAmountText,
    amountToPay,
  };
}

function getActiveDiscountRule(rules: SubscriptionRuleRecord[]) {
  const activeRules = rules.filter(isCurrentSubscriptionRule);

  return (
    activeRules.find((rule) => {
      const ruleType = normalizePlanRuleType(rule.rule_type);

      return (
        ruleType === "discount" ||
        ruleType === "desconto" ||
        getNumericRuleValue(rule.discount_value) > 0 ||
        getNumericRuleValue(rule.discount_percent) > 0 ||
        getNumericRuleValue(rule.discount_percentage) > 0
      );
    }) ?? null
  );
}

function buildDiscountCardFromRules({
  monthlyPrice,
  rules,
}: {
  monthlyPrice: number;
  rules: SubscriptionRuleRecord[];
}): SubscriptionDiscountCardDetails | null {
  const discountRule = getActiveDiscountRule(rules);

  if (!discountRule) return null;

  const baseMonthlyPrice = Math.max(Number(monthlyPrice ?? 0), 0);
  const discountType =
    normalizePlanRuleType(discountRule.discount_type) === "amount"
      ? "amount"
      : "percentage";

  const discountValue = getNumericRuleValue(
    discountRule.discount_value ??
      discountRule.discount_percent ??
      discountRule.discount_percentage ??
      0,
  );

  const discountAmount =
    baseMonthlyPrice > 0
      ? discountType === "amount"
        ? Math.min(baseMonthlyPrice, Math.max(discountValue, 0))
        : baseMonthlyPrice * (Math.max(discountValue, 0) / 100)
      : 0;

  const amountToPay = Math.max(baseMonthlyPrice - discountAmount, 0);

  return {
    has_discount: true,
    discount_type: discountType,
    discount_value: discountValue,
    monthly_price: baseMonthlyPrice,
    discount_amount: Number(discountAmount.toFixed(2)),
    amount_to_pay: Number(amountToPay.toFixed(2)),
    discount_label: discountRule.label ?? null,
    discount_description: discountRule.description ?? null,
  };
}

function getFinalMonthlyPrice(plan?: SubscriptionPlanDetails | null, access?: SubscriptionAccess | null) {
  if (plan) return Number(plan.final_monthly_price ?? 0);

  return Number(access?.monthly_price ?? 0);
}

function getOriginalMonthlyPrice(plan?: SubscriptionPlanDetails | null, access?: SubscriptionAccess | null) {
  if (plan) return Number(plan.monthly_price ?? 0);

  return Number(access?.monthly_price ?? 0);
}



function normalizePlanRuleType(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function isCurrentSubscriptionRule(rule: SubscriptionRuleRecord) {
  if (rule.is_active === false) return false;

  const now = Date.now();

  if (rule.starts_at) {
    const startsAt = new Date(rule.starts_at).getTime();

    if (!Number.isNaN(startsAt) && startsAt > now) {
      return false;
    }
  }

  if (rule.ends_at) {
    const endsAt = new Date(rule.ends_at).getTime();

    if (!Number.isNaN(endsAt) && endsAt < now) {
      return false;
    }
  }

  return true;
}

function getNumericRuleValue(value?: number | string | null) {
  const normalized = String(value ?? "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) return 0;

  return parsed;
}

function buildSubscriptionPlanDetailsFromRules({
  userId,
  monthlyPrice,
  isAdmin,
  rules,
}: {
  userId: string;
  monthlyPrice: number;
  isAdmin: boolean;
  rules: SubscriptionRuleRecord[];
}): SubscriptionPlanDetails {
  const originalPrice = Number(monthlyPrice ?? 0);

  if (isAdmin) {
    return {
      user_id: userId,
      plan_type: "admin_free",
      plan_title: "Plano gratuito",
      plan_description:
        "Administradores possuem plano gratuito por padrão. Você não paga mensalidade.",
      is_free_plan: true,
      has_discount: false,
      discount_type: null,
      discount_value: null,
      monthly_price: originalPrice,
      final_monthly_price: 0,
      savings_amount: originalPrice,
      rule_label: "Administrador",
      rule_description: "Plano gratuito por padrão para administradores.",
    };
  }

  const activeRules = rules.filter(isCurrentSubscriptionRule);

  const discountRule = activeRules.find((rule) => {
    const ruleType = normalizePlanRuleType(rule.rule_type);

    return (
      ruleType === "discount" ||
      ruleType === "desconto" ||
      getNumericRuleValue(rule.discount_value) > 0 ||
      getNumericRuleValue(rule.discount_percent) > 0 ||
      getNumericRuleValue(rule.discount_percentage) > 0
    );
  });

  /*
    IMPORTANTE:
    Desconto tem prioridade sobre plano gratuito manual.
    Assim, se o admin aplicar desconto em um usuário que antes tinha uma regra gratuita
    antiga, a tela mostra o desconto aplicado.
    Admin continua gratuito por padrão porque o isAdmin já retornou acima.
  */
  if (discountRule) {
    const discountType =
      normalizePlanRuleType(discountRule.discount_type) === "amount"
        ? "amount"
        : "percentage";

    const discountValue = getNumericRuleValue(
      discountRule.discount_value ??
        discountRule.discount_percent ??
        discountRule.discount_percentage ??
        0,
    );

    const safeOriginalPrice = Math.max(originalPrice, 0);

    /*
      Regra importante:
      Se existe desconto aplicado, a tela deve mostrar PLANO COM DESCONTO.
      Não pode virar "plano gratuito" apenas porque a mensalidade veio zerada
      do banco/RPC/configuração.
    */
    const savings =
      safeOriginalPrice > 0
        ? discountType === "amount"
          ? Math.min(safeOriginalPrice, Math.max(discountValue, 0))
          : Math.max(safeOriginalPrice * (discountValue / 100), 0)
        : 0;

    const finalPrice =
      safeOriginalPrice > 0 ? Math.max(safeOriginalPrice - savings, 0) : 0;

    return {
      user_id: userId,
      plan_type: "discount",
      plan_title: "Plano com desconto",
      plan_description:
        discountRule.description ||
        "Desconto aplicado ao valor da assinatura.",
      is_free_plan: false,
      has_discount: true,
      discount_type: discountType,
      discount_value: discountValue,
      monthly_price: safeOriginalPrice,
      final_monthly_price: Number(finalPrice.toFixed(2)),
      savings_amount: Number(savings.toFixed(2)),
      rule_label: discountRule.label ?? null,
      rule_description: discountRule.description ?? null,
    };
  }

  const freeRule = activeRules.find((rule) => {
    const ruleType = normalizePlanRuleType(rule.rule_type);

    return (
      rule.is_free_plan === true ||
      ruleType === "free" ||
      ruleType === "admin_free" ||
      ruleType === "gratuito" ||
      ruleType === "plano_gratuito"
    );
  });

  if (freeRule) {
    return {
      user_id: userId,
      plan_type: "free",
      plan_title: freeRule.label || "Plano gratuito",
      plan_description:
        freeRule.description ||
        "Plano gratuito aplicado. Você não paga mensalidade.",
      is_free_plan: true,
      has_discount: false,
      discount_type: null,
      discount_value: null,
      monthly_price: originalPrice,
      final_monthly_price: 0,
      savings_amount: originalPrice,
      rule_label: freeRule.label ?? null,
      rule_description: freeRule.description ?? null,
    };
  }

  return {
    user_id: userId,
    plan_type: "standard",
    plan_title: "Plano mensal",
    plan_description: "Plano padrão com cobrança mensal.",
    is_free_plan: false,
    has_discount: false,
    discount_type: null,
    discount_value: null,
    monthly_price: originalPrice,
    final_monthly_price: originalPrice,
    savings_amount: 0,
    rule_label: null,
    rule_description: null,
  };
}

async function fetchMySubscriptionRules(userId: string) {
  const selectCandidates = [
    `
      id,
      user_id,
      rule_type,
      label,
      description,
      discount_type,
      discount_value,
      discount_percent,
      discount_percentage,
      is_free_plan,
      is_active,
      starts_at,
      ends_at,
      created_at
    `,
    `
      id,
      user_id,
      rule_type,
      label,
      description,
      discount_type,
      discount_value,
      discount_percent,
      is_free_plan,
      is_active,
      starts_at,
      ends_at,
      created_at
    `,
    `
      id,
      user_id,
      rule_type,
      label,
      description,
      discount_type,
      discount_value,
      is_free_plan,
      is_active,
      starts_at,
      ends_at,
      created_at
    `,
    `
      id,
      user_id,
      rule_type,
      label,
      description,
      discount_percent,
      is_free_plan,
      is_active,
      starts_at,
      ends_at,
      created_at
    `,
    `
      id,
      user_id,
      rule_type,
      label,
      description,
      is_free_plan,
      is_active,
      starts_at,
      ends_at,
      created_at
    `,
  ];

  for (const select of selectCandidates) {
    const { data, error } = await (supabase as any)
      .from("user_subscription_rules")
      .select(select)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error) {
      return (data ?? []) as SubscriptionRuleRecord[];
    }

    console.log("Tentativa de buscar regras da assinatura falhou:", error);
  }

  return [] as SubscriptionRuleRecord[];
}

async function fetchMySubscriptionSettingsPrice() {
  const selectCandidates = [
    "monthly_price",
    "monthly_price, updated_at",
    "monthly_price, created_at",
  ];

  for (const select of selectCandidates) {
    const query = (supabase as any)
      .from("subscription_settings")
      .select(select)
      .limit(1);

    const { data, error } = await query;

    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      const price = Number(row?.monthly_price ?? 0);

      if (Number.isFinite(price) && price > 0) {
        return price;
      }
    } else {
      console.log("Tentativa de buscar preço da mensalidade falhou:", error);
    }
  }

  return null;
}

async function fetchMySubscriptionAccessSnapshot() {
  const { data, error } = await (supabase as any).rpc("get_my_subscription_access");

  if (error) {
    console.log("Não foi possível buscar snapshot da assinatura:", error);
    return null;
  }

  return (Array.isArray(data) ? data[0] : data) as SubscriptionAccess | null;
}

function getPaymentStatusInfo(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (
    normalized === "paid" ||
    normalized === "received" ||
    normalized === "confirmed" ||
    normalized === "payment_received" ||
    normalized === "payment_confirmed"
  ) {
    return {
      label: "Pago",
      color: "#22C55E",
      backgroundColor: "rgba(34,197,94,0.12)",
    };
  }

  if (
    normalized === "overdue" ||
    normalized === "payment_overdue" ||
    normalized === "vencida"
  ) {
    return {
      label: "Vencida",
      color: "#EF4444",
      backgroundColor: "rgba(239,68,68,0.12)",
    };
  }

  if (
    normalized === "pending" ||
    normalized === "created" ||
    normalized === "pending_payment"
  ) {
    return {
      label: "Pendente",
      color: "#D4A64A",
      backgroundColor: "rgba(212,166,74,0.12)",
    };
  }

  if (
    normalized === "refunded" ||
    normalized === "payment_refunded" ||
    normalized === "deleted" ||
    normalized === "payment_deleted"
  ) {
    return {
      label: "Cancelada",
      color: "#9B969B",
      backgroundColor: "rgba(155,150,155,0.10)",
    };
  }

  return {
    label: status || "Criada",
    color: "#D4A64A",
    backgroundColor: "rgba(212,166,74,0.12)",
  };
}


function isPaidPaymentStatus(status?: string | null) {
  const normalized = normalizeStatus(status);

  return (
    normalized === "paid" ||
    normalized === "received" ||
    normalized === "confirmed" ||
    normalized === "payment_received" ||
    normalized === "payment_confirmed"
  );
}

function isCanceledPaymentStatus(status?: string | null) {
  const normalized = normalizeStatus(status);

  return (
    normalized === "refunded" ||
    normalized === "payment_refunded" ||
    normalized === "deleted" ||
    normalized === "payment_deleted" ||
    normalized === "canceled" ||
    normalized === "cancelled"
  );
}

function getPaymentDueDateTime(payment?: SubscriptionPayment | null) {
  if (!payment?.due_date) return Number.MAX_SAFE_INTEGER;

  const parsed = new Date(payment.due_date);

  if (Number.isNaN(parsed.getTime())) return Number.MAX_SAFE_INTEGER;

  return parsed.getTime();
}


function getPaymentDisplayDueDate(
  payment?: SubscriptionPayment | null,
  subscriptionDueDate?: string | null,
) {
  if (!payment) return subscriptionDueDate ?? null;

  const isOpen =
    !isPaidPaymentStatus(payment.status) && !isCanceledPaymentStatus(payment.status);

  if (isOpen && subscriptionDueDate) {
    return subscriptionDueDate;
  }

  return payment.due_date || subscriptionDueDate || null;
}

function findNextOpenPayment(payments: SubscriptionPayment[]) {
  const openPayments = payments
    .filter((payment) => {
      if (isPaidPaymentStatus(payment.status)) return false;
      if (isCanceledPaymentStatus(payment.status)) return false;

      return true;
    })
    .sort((a, b) => getPaymentDueDateTime(a) - getPaymentDueDateTime(b));

  return openPayments[0] ?? null;
}

export default function ProfileSettingsScreen() {
  const params = useLocalSearchParams();
  const initialTab = String(params.aba ?? "assinaturas") as SettingsTab;

  const [activeTab, setActiveTab] = useState<SettingsTab>(
    tabs.some((tab) => tab.value === initialTab) ? initialTab : "assinaturas",
  );

  const [allowPrivateMessages, setAllowPrivateMessages] = useState(true);
  const [showPublicStats, setShowPublicStats] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [cpfCnpjBeforeEdit, setCpfCnpjBeforeEdit] = useState("");
  const [cpfCnpjModalVisible, setCpfCnpjModalVisible] = useState(false);

  const [subscriptionAccess, setSubscriptionAccess] =
    useState<SubscriptionAccess | null>(null);
  const [subscriptionPlanDetails, setSubscriptionPlanDetails] =
    useState<SubscriptionPlanDetails | null>(null);
  const [subscriptionDiscountCardDetails, setSubscriptionDiscountCardDetails] =
    useState<SubscriptionDiscountCardDetails | null>(null);
  const [subscriptionPayments, setSubscriptionPayments] = useState<
    SubscriptionPayment[]
  >([]);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedActionMode, setSelectedActionMode] =
    useState<"activate" | "renew">("activate");

  useEffect(() => {
    loadScreenData();
  }, []);

  async function loadScreenData() {
    await Promise.all([loadSettings(), loadSubscriptionArea()]);
  }

  async function loadSettings() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) return;

    const { data } = await supabase
      .from("profiles")
      .select("id, allow_private_messages, show_public_stats, cpf_cnpj")
      .eq("id", user.id)
      .single();

    setProfile(data);
    setAllowPrivateMessages(data?.allow_private_messages ?? true);
    setShowPublicStats(data?.show_public_stats ?? true);
    setCpfCnpj(maskCpfCnpj(data?.cpf_cnpj ?? ""));
  }

  async function loadSubscriptionArea() {
    await Promise.all([
      loadSubscriptionAccess(),
      loadSubscriptionPlanDetails(),
      loadSubscriptionDiscountCardDetails(),
      loadSubscriptionPayments(),
    ]);
  }

  async function loadSubscriptionAccess() {
    try {
      setLoadingSubscription(true);

      const { data, error } = await (supabase as any).rpc("get_my_subscription_access");

      if (error) throw error;

      const access = (Array.isArray(data) ? data[0] : data) as
        | SubscriptionAccess
        | null;

      setSubscriptionAccess(access);
    } catch (error: any) {
      console.log("Erro ao carregar assinatura:", error);

      setSubscriptionAccess(null);

      Alert.alert(
        "Assinatura indisponível",
        String(error?.message ?? "").includes("get_my_subscription_access")
          ? "A função get_my_subscription_access ainda não foi criada no Supabase. Rode o SQL das assinaturas."
          : error?.message ?? "Não foi possível carregar sua assinatura.",
      );
    } finally {
      setLoadingSubscription(false);
    }
  }

  async function loadSubscriptionPlanDetails() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setSubscriptionPlanDetails(null);
        return;
      }

      const [
        { data: profileData },
        settingsPrice,
        directRules,
        accessSnapshot,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, is_admin")
          .eq("id", user.id)
          .maybeSingle(),
        fetchMySubscriptionSettingsPrice(),
        fetchMySubscriptionRules(user.id),
        fetchMySubscriptionAccessSnapshot(),
      ]);

      let rpcDetails: SubscriptionPlanDetails | null = null;

      const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
        "get_my_subscription_plan_details",
      );

      if (!rpcError) {
        rpcDetails = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as
          | SubscriptionPlanDetails
          | null;
      } else {
        console.log("RPC get_my_subscription_plan_details indisponível:", rpcError);
      }

      const monthlyPrice = Number(
        settingsPrice && settingsPrice > 0
          ? settingsPrice
          : accessSnapshot?.monthly_price && accessSnapshot.monthly_price > 0
            ? accessSnapshot.monthly_price
            : subscriptionAccess?.monthly_price && subscriptionAccess.monthly_price > 0
              ? subscriptionAccess.monthly_price
              : rpcDetails?.monthly_price && rpcDetails.monthly_price > 0
                ? rpcDetails.monthly_price
                : 0,
      );

      const directDetails = buildSubscriptionPlanDetailsFromRules({
        userId: user.id,
        monthlyPrice,
        isAdmin: Boolean((profileData as any)?.is_admin),
        rules: directRules,
      });

      if (directDetails.plan_type !== "standard") {
        setSubscriptionPlanDetails(directDetails);
        return;
      }

      if (rpcDetails && rpcDetails.plan_type !== "standard") {
        setSubscriptionPlanDetails(rpcDetails);
        return;
      }

      setSubscriptionPlanDetails(directDetails);
    } catch (error: any) {
      console.log("Erro ao carregar detalhes do plano:", error);
      setSubscriptionPlanDetails(null);
    }
  }

  async function loadSubscriptionDiscountCardDetails() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setSubscriptionDiscountCardDetails(null);
        return;
      }

      const [
        settingsPrice,
        directRules,
        accessSnapshot,
        { data: rpcData, error: rpcError },
      ] = await Promise.all([
        fetchMySubscriptionSettingsPrice(),
        fetchMySubscriptionRules(user.id),
        fetchMySubscriptionAccessSnapshot(),
        (supabase as any).rpc("get_my_subscription_discount_card"),
      ]);

      const rpcDiscount = !rpcError
        ? ((Array.isArray(rpcData) ? rpcData[0] : rpcData) as
            | SubscriptionDiscountCardDetails
            | null)
        : null;

      if (rpcError) {
        console.log("RPC get_my_subscription_discount_card indisponível:", rpcError);
      }

      const monthlyPrice = Number(
        settingsPrice && settingsPrice > 0
          ? settingsPrice
          : accessSnapshot?.monthly_price && accessSnapshot.monthly_price > 0
            ? accessSnapshot.monthly_price
            : subscriptionAccess?.monthly_price && subscriptionAccess.monthly_price > 0
              ? subscriptionAccess.monthly_price
              : rpcDiscount?.monthly_price && rpcDiscount.monthly_price > 0
                ? rpcDiscount.monthly_price
                : 0,
      );

      const directDiscount = buildDiscountCardFromRules({
        monthlyPrice,
        rules: directRules,
      });

      const finalDiscount =
        directDiscount ?? (rpcDiscount?.has_discount ? rpcDiscount : null);

      setSubscriptionDiscountCardDetails(finalDiscount);

      if (finalDiscount?.has_discount) {
        setSubscriptionPlanDetails((previous) => ({
          user_id: previous?.user_id ?? user.id,
          plan_type: "discount",
          plan_title: "Plano com desconto",
          plan_description:
            finalDiscount.discount_description ||
            "Existe um desconto aplicado ao valor da sua assinatura.",
          is_free_plan: false,
          has_discount: true,
          discount_type: finalDiscount.discount_type,
          discount_value: Number(finalDiscount.discount_value ?? 0),
          monthly_price: Number(finalDiscount.monthly_price ?? monthlyPrice),
          final_monthly_price: Number(finalDiscount.amount_to_pay ?? 0),
          savings_amount: Number(finalDiscount.discount_amount ?? 0),
          rule_label: finalDiscount.discount_label,
          rule_description: finalDiscount.discount_description,
        }));
      }
    } catch (error) {
      console.log("Erro ao carregar desconto direto do card:", error);
      setSubscriptionDiscountCardDetails(null);
    }
  }


  async function loadSubscriptionPayments() {
    try {
      setLoadingPayments(true);

      const { data, error } = await (supabase as any)
        .from("subscription_payments")
        .select(
          `
            id,
            asaas_payment_id,
            asaas_subscription_id,
            status,
            billing_type,
            amount,
            due_date,
            invoice_url,
            bank_slip_url,
            paid_at,
            created_at
          `,
        )
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      setSubscriptionPayments((data ?? []) as SubscriptionPayment[]);
    } catch (error: any) {
      console.log("Erro ao carregar histórico de pagamentos:", error);
      setSubscriptionPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  }

  async function refreshSubscriptionArea() {
    try {
      setRefreshing(true);
      await loadSubscriptionArea();
    } finally {
      setRefreshing(false);
    }
  }

  async function updatePrivacy(nextValues: {
    allow_private_messages?: boolean;
    show_public_stats?: boolean;
  }) {
    if (!profile?.id) return;

    await supabase
      .from("profiles")
      .update({
        ...nextValues,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
  }

  function openSupport(type: string) {
    Alert.alert(
      type,
      "Aqui você pode integrar WhatsApp, e-mail, formulário ou chat de suporte do MovenApp.",
    );
  }

  function openUrl(url: string) {
    Linking.openURL(url).catch(() => {
      Alert.alert("Não foi possível abrir", "Verifique o link informado.");
    });
  }

  async function openPaymentUrl(url?: string | null) {
    if (!url) {
      Alert.alert("Pagamento indisponível", "Essa cobrança não possui link.");
      return;
    }

    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      Alert.alert(
        "Não foi possível abrir",
        "Verifique se existe um navegador instalado no aparelho.",
      );
      return;
    }

    await Linking.openURL(url);
  }

  async function createSubscriptionPaymentWithDocument(documentValue: string) {
    const documentNumbers = onlyDigits(documentValue);

    const accessToken = await getCurrentAccessToken();

    if (!accessToken) {
      throw new Error("Sua sessão expirou. Saia do app e entre novamente.");
    }

    const { data, error } = await (supabase as any).functions.invoke(
      "asaas-create-subscription-payment",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          cpfCnpj: documentNumbers,
        },
      },
    );

    if (error || !data?.ok) {
      throw new Error(
        data?.message ||
          error?.message ||
          "Não foi possível gerar a cobrança. Verifique a Edge Function e os dados informados.",
      );
    }

    return data;
  }

  function openCpfCnpjModal(prefill?: string | null) {
    const currentDocument =
      profile?.cpf_cnpj ||
      cpfCnpjBeforeEdit ||
      cpfCnpj ||
      prefill ||
      "";

    setCpfCnpjBeforeEdit(maskCpfCnpj(currentDocument));
    setCpfCnpj(maskCpfCnpj(prefill ?? currentDocument));
    setCpfCnpjModalVisible(true);
  }

  function isOpenPayment(payment?: SubscriptionPayment | null) {
    if (!payment) return false;

    const status = normalizeStatus(payment.status);

    if (
      status === "paid" ||
      status === "received" ||
      status === "confirmed" ||
      status === "payment_received" ||
      status === "payment_confirmed" ||
      status === "deleted" ||
      status === "refunded" ||
      status === "canceled" ||
      status === "cancelled"
    ) {
      return false;
    }

    return Boolean(payment.invoice_url || payment.bank_slip_url);
  }

  function getExistingOpenPayment() {
    return (
      subscriptionPayments.find((payment) => isOpenPayment(payment)) ?? null
    );
  }

  function openExistingPaymentNotice(payment: SubscriptionPayment) {
    const paymentUrl = payment.invoice_url || payment.bank_slip_url;
    const displayDueDate = getPaymentDisplayDueDate(
      payment,
      subscriptionAccess?.current_period_end,
    );

    Alert.alert(
      "Cobrança já existente",
      `Já existe uma cobrança em aberto no valor de ${formatCurrency(
        Number(payment.amount ?? 0),
      )}, com vencimento em ${formatDate(displayDueDate)}.`,
      [
        {
          text: "Agora não",
          style: "cancel",
        },
        {
          text: "Abrir cobrança",
          onPress: () => openPaymentUrl(paymentUrl),
        },
      ],
    );
  }

  function getSubscriptionActionMode() {
    if (subscriptionPlanDetails?.is_free_plan) {
      return null;
    }

    const status = normalizeStatus(subscriptionAccess?.status);
    const daysUntilDue = Number(subscriptionAccess?.days_until_due ?? 9999);

    if (status === "inactive" || status === "deleted") {
      return "activate" as const;
    }

    if (status === "trial") {
      return "activate" as const;
    }

    if (status === "active" && daysUntilDue <= 10) {
      return "renew" as const;
    }

    return null;
  }

  function getSubscriptionActionLabel() {
    const mode = getSubscriptionActionMode();

    if (mode === "renew") return "Renovar assinatura";

    return "Ativar assinatura";
  }

  function getSubscriptionActiveMessage() {
    if (subscriptionPlanDetails?.plan_type === "admin_free") {
      return "Você possui plano gratuito por ser administrador. Não há mensalidade para pagar.";
    }

    if (subscriptionPlanDetails?.is_free_plan) {
      return "Seu plano gratuito está ativo. Você não paga mensalidade.";
    }

    if (subscriptionPlanDetails?.has_discount) {
      return "Sua assinatura está ativa com desconto aplicado.";
    }

    const daysUntilDue = Number(subscriptionAccess?.days_until_due ?? 9999);

    if (daysUntilDue > 10) {
      return `Sua assinatura está ativa. A renovação ficará disponível quando faltarem 10 dias para o vencimento.`;
    }

    return "Sua assinatura está ativa.";
  }

  async function handleCreateSubscriptionPayment() {
    const actionMode = getSubscriptionActionMode();

    if (!actionMode) {
      Alert.alert("Assinatura ativa", getSubscriptionActiveMessage());
      return;
    }

    setSelectedActionMode(actionMode);

    const existingPayment = getExistingOpenPayment();

    if (existingPayment) {
      try {
        setCreatingPayment(true);

        /*
          Mesmo quando já existe uma cobrança aberta, chamamos a Edge Function
          para garantir que o vencimento da cobrança no Asaas fique igual ao
          vencimento da assinatura no app.
        */
        const data = await createSubscriptionPaymentWithDocument(
          cpfCnpj || profile?.cpf_cnpj || "",
        );

        await loadSubscriptionArea();

        openExistingPaymentNotice({
          ...existingPayment,
          amount: Number(data?.value ?? existingPayment.amount),
          due_date:
            data?.dueDate ??
            getPaymentDisplayDueDate(
              existingPayment,
              subscriptionAccess?.current_period_end,
            ) ??
            existingPayment.due_date,
          invoice_url: data?.invoiceUrl ?? existingPayment.invoice_url,
          bank_slip_url: data?.bankSlipUrl ?? existingPayment.bank_slip_url,
          status: data?.status ?? existingPayment.status,
        });

        return;
      } catch (error: any) {
        console.log("Erro ao sincronizar cobrança existente:", error);

        Alert.alert(
          "Cobrança já existente",
          "Já existe uma cobrança em aberto, mas não foi possível sincronizar o vencimento com a assinatura agora.",
          [
            {
              text: "Agora não",
              style: "cancel",
            },
            {
              text: "Abrir cobrança",
              onPress: () =>
                openPaymentUrl(
                  existingPayment.invoice_url || existingPayment.bank_slip_url,
                ),
            },
          ],
        );

        return;
      } finally {
        setCreatingPayment(false);
      }
    }

    openCpfCnpjModal(cpfCnpj || profile?.cpf_cnpj);
  }

  async function handleConfirmCpfCnpjAndCreatePayment() {
    if (!isValidCpfCnpjLength(cpfCnpj)) {
      Alert.alert(
        "CPF/CNPJ inválido",
        "Informe um CPF com 11 dígitos ou um CNPJ com 14 dígitos.",
      );
      return;
    }

    try {
      setCpfCnpjModalVisible(false);
      setCreatingPayment(true);

      const data = await createSubscriptionPaymentWithDocument(cpfCnpj);

      const paymentUrl = data.invoiceUrl || data.bankSlipUrl;

      if (data?.freeAccess) {
        setCpfCnpjBeforeEdit(maskCpfCnpj(cpfCnpj));

        await loadSettings();
        await loadSubscriptionArea();

        Alert.alert(
          "Plano gratuito",
          data?.message ||
            "Seu plano está liberado gratuitamente. Nenhuma cobrança foi gerada.",
        );
        return;
      }

      setCpfCnpjBeforeEdit(maskCpfCnpj(cpfCnpj));

      await loadSettings();
      await loadSubscriptionArea();

      if (data?.alreadyExists) {
        Alert.alert(
          "Cobrança já existente",
          data?.message ||
            "Já existe uma cobrança em aberto para sua assinatura.",
          paymentUrl
            ? [
                {
                  text: "Agora não",
                  style: "cancel",
                },
                {
                  text: "Abrir cobrança",
                  onPress: () => openPaymentUrl(paymentUrl),
                },
              ]
            : [{ text: "OK" }],
        );
        return;
      }

      Alert.alert(
        selectedActionMode === "renew"
          ? "Cobrança de renovação gerada"
          : "Cobrança de ativação gerada",
        paymentUrl
          ? "Abra a cobrança do Asaas para concluir o pagamento. Após a confirmação, seu plano será atualizado automaticamente."
          : "A cobrança foi criada. Assim que o Asaas liberar o link, ela aparecerá no histórico.",
        paymentUrl
          ? [
              {
                text: "Agora não",
                style: "cancel",
              },
              {
                text: "Abrir cobrança",
                onPress: () => openPaymentUrl(paymentUrl),
              },
            ]
          : [{ text: "OK" }],
      );
    } catch (error: any) {
      console.log("Erro ao criar cobrança:", error);

      const message =
        error?.message ??
        "Verifique o CPF/CNPJ informado e tente novamente.";

      if (isCpfCnpjError(message)) {
        Alert.alert(
          "CPF/CNPJ inválido",
          "O CPF/CNPJ informado foi recusado pelo Asaas. Corrija o documento para tentar novamente.",
          [
            {
              text: "Corrigir",
              onPress: () => setCpfCnpjModalVisible(true),
            },
          ],
        );
        return;
      }

      Alert.alert("Não foi possível gerar a cobrança", message);
    } finally {
      setCreatingPayment(false);
    }
  }

  const tabDescription = useMemo(() => {
    if (activeTab === "assinaturas")
      return "Plano, vencimento, Asaas e histórico de pagamentos.";
    if (activeTab === "privacidade")
      return "Controle suas informações públicas e mensagens.";
    if (activeTab === "ajuda")
      return "Suporte, sugestões, erros e documentos importantes.";

    return "Versão, redes sociais e informações do aplicativo.";
  }, [activeTab]);

  const subscriptionStatusInfo = getSubscriptionPlanVisualInfo(
    subscriptionAccess,
    subscriptionPlanDetails,
  );

  const originalMonthlyPrice = getOriginalMonthlyPrice(
    subscriptionPlanDetails,
    subscriptionAccess,
  );

  const finalMonthlyPrice = getFinalMonthlyPrice(
    subscriptionPlanDetails,
    subscriptionAccess,
  );

  const discountText = getDiscountText(subscriptionPlanDetails);
  const hasDiscountedSubscriptionPlan = Boolean(
    subscriptionDiscountCardDetails?.has_discount ||
      subscriptionPlanDetails?.has_discount,
  );
  const isFreeSubscriptionPlan = Boolean(
    subscriptionPlanDetails?.is_free_plan && !hasDiscountedSubscriptionPlan,
  );

  const displayOriginalMonthlyPrice =
    hasDiscountedSubscriptionPlan
      ? Number(
          originalMonthlyPrice > 0
            ? originalMonthlyPrice
            : subscriptionAccess?.monthly_price && subscriptionAccess.monthly_price > 0
              ? subscriptionAccess.monthly_price
              : 0,
        )
      : originalMonthlyPrice;

  const displayDiscountAmount =
    hasDiscountedSubscriptionPlan && displayOriginalMonthlyPrice > 0
      ? subscriptionPlanDetails?.discount_type === "amount"
        ? Math.min(
            displayOriginalMonthlyPrice,
            Number(subscriptionPlanDetails?.discount_value ?? 0),
          )
        : displayOriginalMonthlyPrice *
          (Number(subscriptionPlanDetails?.discount_value ?? 0) / 100)
      : Number(subscriptionPlanDetails?.savings_amount ?? 0);

  const displayFinalMonthlyPrice =
    hasDiscountedSubscriptionPlan && displayOriginalMonthlyPrice > 0
      ? Math.max(displayOriginalMonthlyPrice - displayDiscountAmount, 0)
      : finalMonthlyPrice;

  const effectiveDiscountCardInfo = getEffectiveDiscountCardInfo({
    discountCard: subscriptionDiscountCardDetails,
    plan: subscriptionPlanDetails,
    monthlyPrice: displayOriginalMonthlyPrice,
  });

  const lastPaymentWithUrl = subscriptionPayments.find(
    (payment) => payment.invoice_url || payment.bank_slip_url,
  );

  const subscriptionActionMode = getSubscriptionActionMode();
  const shouldShowSubscriptionActionButton = Boolean(subscriptionActionMode);
  const existingOpenPayment = getExistingOpenPayment();


  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[0]}
    >
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.backButton}
            onPress={() => router.replace("/perfil" as never)}
          >
            <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerEyebrow}>Sistema</Text>
            <Text style={styles.headerTitle}>Configurações</Text>
          </View>
        </View>
      </View>

      <View style={styles.introCard}>
        <Text style={styles.introTitle}>Gerencie sua experiência</Text>
        <Text style={styles.introText}>{tabDescription}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.value;

          return (
            <TouchableOpacity
              key={tab.value}
              activeOpacity={0.86}
              style={[styles.tabButton, active && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.value)}
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={active ? "#080808" : "#9B969B"}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {activeTab === "assinaturas" && (
        <View style={styles.sectionCard}>
          <View style={styles.planHeader}>
            <View style={styles.planIcon}>
              <Ionicons name="sparkles-outline" size={26} color="#D4A64A" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Assinatura</Text>
              <Text style={styles.sectionText}>
                Acompanhe seu plano, ative ou renove pelo Asaas e veja seu
                histórico de cobranças.
              </Text>
            </View>
          </View>

          {loadingSubscription ? (
            <View style={styles.subscriptionLoadingBox}>
              <ActivityIndicator color="#D4A64A" />
              <Text style={styles.subscriptionLoadingText}>
                Carregando assinatura...
              </Text>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.planBox,
                  {
                    backgroundColor: subscriptionStatusInfo.backgroundColor,
                    borderColor: subscriptionStatusInfo.borderColor,
                  },
                ]}
              >
                <View style={styles.planBoxTop}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.planLabel,
                        { color: subscriptionStatusInfo.color },
                      ]}
                    >
                      Plano atual
                    </Text>
                    <Text style={styles.planName}>
                      {subscriptionStatusInfo.title}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: subscriptionStatusInfo.backgroundColor,
                        borderColor: subscriptionStatusInfo.borderColor,
                      },
                    ]}
                  >
                    <Ionicons
                      name={subscriptionStatusInfo.icon}
                      size={16}
                      color={subscriptionStatusInfo.color}
                    />
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: subscriptionStatusInfo.color },
                      ]}
                    >
                      {subscriptionStatusInfo.label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.planDescription}>
                  {subscriptionPlanDetails?.plan_description ||
                    ("description" in subscriptionStatusInfo
                      ? subscriptionStatusInfo.description
                      : "") ||
                    (subscriptionAccess?.can_create
                      ? "Sua conta está liberada para cadastrar jornadas, ganhos, despesas e veículos."
                      : "Sua conta está bloqueada para novos cadastros até a ativação da assinatura.")}
                </Text>

                {!isFreeSubscriptionPlan ? (
                  effectiveDiscountCardInfo ? (
                    <View style={styles.discountBreakdownBox}>
                      <View style={styles.discountHeaderRow}>
                        <View style={styles.discountHeaderIcon}>
                          <Ionicons name="pricetag-outline" size={18} color="#FACC15" />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.discountHeaderTitle}>
                            Desconto aplicado
                          </Text>
                          <Text style={styles.discountHeaderText}>
                            {effectiveDiscountCardInfo.discountName}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.discountBreakdownDivider} />

                      <View style={styles.discountBreakdownRow}>
                        <Text style={styles.discountBreakdownLabel}>
                          Mensalidade
                        </Text>
                        <Text style={styles.discountBreakdownValue}>
                          {formatCurrency(effectiveDiscountCardInfo.monthlyPrice)}
                        </Text>
                      </View>

                      <View style={styles.discountBreakdownRow}>
                        <Text style={styles.discountBreakdownLabel}>
                          Valor do desconto
                        </Text>
                        <Text style={styles.discountBreakdownDiscountValue}>
                          - {effectiveDiscountCardInfo.discountAmountText}
                        </Text>
                      </View>

                      <View style={styles.discountPayBox}>
                        <Text style={styles.discountPayLabel}>
                          Valor a pagar
                        </Text>
                        <Text style={styles.discountPayValue}>
                          {formatCurrency(effectiveDiscountCardInfo.amountToPay)}
                        </Text>
                      </View>

                      <View style={styles.discountDueDateBox}>
                        <Ionicons name="calendar-outline" size={15} color="#9B969B" />
                        <Text style={styles.discountDueDateText}>
                          Vencimento: {formatDate(subscriptionAccess?.current_period_end)}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.planMetricsRow}>
                      <View style={styles.planMetric}>
                        <Text style={styles.planMetricLabel}>Mensalidade</Text>
                        <Text style={styles.planMetricValue}>
                          {formatCurrency(finalMonthlyPrice)}
                        </Text>
                      </View>

                      <View style={styles.planMetricDivider} />

                      <View style={styles.planMetric}>
                        <Text style={styles.planMetricLabel}>Vencimento</Text>
                        <Text style={styles.planMetricValue}>
                          {formatDate(subscriptionAccess?.current_period_end)}
                        </Text>
                      </View>
                    </View>
                  )
                ) : null}

                {subscriptionPlanDetails?.is_free_plan ||
                subscriptionPlanDetails?.has_discount ? (
                  <View
                    style={[
                      styles.planRuleBox,
                      subscriptionPlanDetails?.is_free_plan
                        ? styles.planRuleBoxFree
                        : styles.planRuleBoxDiscount,
                    ]}
                  >
                    <Ionicons
                      name={
                        subscriptionPlanDetails?.is_free_plan
                          ? subscriptionPlanDetails.plan_type === "admin_free"
                            ? "shield-checkmark-outline"
                            : "gift-outline"
                          : "pricetag-outline"
                      }
                      size={20}
                      color={
                        subscriptionPlanDetails?.is_free_plan
                          ? "#22C55E"
                          : "#FACC15"
                      }
                    />

                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.planRuleTitle,
                          subscriptionPlanDetails?.is_free_plan
                            ? styles.planRuleTitleFree
                            : styles.planRuleTitleDiscount,
                        ]}
                      >
                        {subscriptionPlanDetails?.plan_title}
                      </Text>

                      <Text style={styles.planRuleText}>
                        {subscriptionPlanDetails?.is_free_plan
                          ? "Este plano não gera mensalidade."
                          : "O desconto já foi considerado no valor a pagar acima."}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {!isFreeSubscriptionPlan && subscriptionAccess?.status === "inactive" ? (
                  <Text style={styles.inactiveInfoText}>
                    Inativo há {subscriptionAccess.days_inactive ?? 0} dia(s).
                  </Text>
                ) : null}

                {!isFreeSubscriptionPlan &&
                subscriptionAccess?.days_until_due !== undefined &&
                subscriptionAccess?.status !== "inactive" &&
                subscriptionAccess?.status !== "deleted" ? (
                  <Text style={styles.inactiveInfoText}>
                    {subscriptionAccess.days_until_due >= 0
                      ? `Faltam ${subscriptionAccess.days_until_due} dia(s) para o vencimento.`
                      : "Sua assinatura venceu."}
                  </Text>
                ) : null}
              </View>

              {subscriptionAccess?.show_payment_alert ||
              subscriptionAccess?.show_deletion_warning ? (
                <View
                  style={[
                    styles.subscriptionAlert,
                    subscriptionAccess.show_deletion_warning &&
                      styles.subscriptionAlertDanger,
                  ]}
                >
                  <Ionicons
                    name={
                      subscriptionAccess.show_deletion_warning
                        ? "warning-outline"
                        : "notifications-outline"
                    }
                    size={22}
                    color={
                      subscriptionAccess.show_deletion_warning
                        ? "#FCA5A5"
                        : "#D4A64A"
                    }
                  />

                  <View style={{ flex: 1 }}>
                    <Text style={styles.subscriptionAlertTitle}>
                      {subscriptionAccess.alert_title}
                    </Text>
                    <Text style={styles.subscriptionAlertText}>
                      {subscriptionAccess.alert_message}
                    </Text>
                  </View>
                </View>
              ) : null}

              {shouldShowSubscriptionActionButton ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[
                    styles.subscribeButton,
                    creatingPayment && styles.subscribeButtonDisabled,
                  ]}
                  disabled={creatingPayment}
                  onPress={handleCreateSubscriptionPayment}
                >
                  {creatingPayment ? (
                    <ActivityIndicator color="#080808" />
                  ) : (
                    <>
                      <Ionicons
                        name={subscriptionActionMode === "renew" ? "reload-outline" : "card-outline"}
                        size={22}
                        color="#080808"
                      />
                      <Text style={styles.subscribeButtonText}>
                        {existingOpenPayment
                          ? "Ver cobrança existente"
                          : getSubscriptionActionLabel()}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.activeSubscriptionMessageBox}>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#22C55E" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activeSubscriptionMessageTitle}>
                      {isFreeSubscriptionPlan ? "Plano gratuito ativo" : "Assinatura ativa"}
                    </Text>
                    <Text style={styles.activeSubscriptionMessageText}>
                      {getSubscriptionActiveMessage()}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.subscriptionActionsRow}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={[
                    styles.secondaryButton,
                    refreshing && styles.secondaryButtonDisabled,
                  ]}
                  disabled={refreshing}
                  onPress={refreshSubscriptionArea}
                >
                  {refreshing ? (
                    <ActivityIndicator color="#D4A64A" size="small" />
                  ) : (
                    <Ionicons name="refresh-outline" size={19} color="#D4A64A" />
                  )}
                  <Text style={styles.secondaryButtonText}>Atualizar status</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.86}
                  style={[
                    styles.secondaryButton,
                    !lastPaymentWithUrl && styles.secondaryButtonDisabled,
                  ]}
                  disabled={!lastPaymentWithUrl}
                  onPress={() =>
                    openPaymentUrl(
                      lastPaymentWithUrl?.invoice_url ||
                        lastPaymentWithUrl?.bank_slip_url,
                    )
                  }
                >
                  <Ionicons name="open-outline" size={19} color="#D4A64A" />
                  <Text style={styles.secondaryButtonText}>Última fatura</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.benefitsBox}>
            <Text style={styles.benefitsTitle}>Com assinatura ativa você mantém</Text>

            <BenefitItem text="Cadastro de novas jornadas de trabalho" />
            <BenefitItem text="Lançamento de ganhos, despesas e veículos" />
            <BenefitItem text="Dashboard financeiro completo" />
            <BenefitItem text="Histórico, metas, desempenho e comunidade" />
          </View>

          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Histórico de pagamentos</Text>

            {loadingPayments ? (
              <ActivityIndicator color="#D4A64A" size="small" />
            ) : null}
          </View>

          {!loadingPayments && subscriptionPayments.length === 0 ? (
            <View style={styles.emptyHistoryBox}>
              <Ionicons name="receipt-outline" size={24} color="#D4A64A" />
              <Text style={styles.emptyHistoryTitle}>Nenhuma cobrança ainda</Text>
              <Text style={styles.emptyHistoryText}>
                Quando você ativar ou renovar sua assinatura, as cobranças aparecerão aqui.
              </Text>
            </View>
          ) : null}

          {subscriptionPayments.map((payment, index) => (
            <PaymentHistoryItem
              key={payment.id}
              payment={payment}
              subscriptionDueDate={subscriptionAccess?.current_period_end}
              last={index === subscriptionPayments.length - 1}
              onOpen={() =>
                openPaymentUrl(payment.invoice_url || payment.bank_slip_url)
              }
            />
          ))}
        </View>
      )}

      {activeTab === "privacidade" && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Privacidade</Text>
          <Text style={styles.sectionText}>
            Ajuste como outros motoristas veem seu perfil e interagem com você.
          </Text>

          <PrivacySwitch
            title="Permitir mensagens privadas"
            description="Outros motoristas podem iniciar conversas com você."
            value={allowPrivateMessages}
            onValueChange={async (value) => {
              setAllowPrivateMessages(value);
              await updatePrivacy({ allow_private_messages: value });
            }}
          />
          <PrivacySwitch
            title="Mostrar estatísticas públicas"
            description="KM rodados e horas trabalhadas podem aparecer no seu perfil público."
            value={showPublicStats}
            onValueChange={async (value) => {
              setShowPublicStats(value);
              await updatePrivacy({ show_public_stats: value });
            }}
          />
          <ActionItem
            icon="shield-checkmark-outline"
            title="Política de privacidade"
            description="Como seus dados são tratados no MovenApp"
            onPress={() => openSupport("Política de privacidade")}
            last
          />
        </View>
      )}

      {activeTab === "ajuda" && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Central de ajuda</Text>
          <Text style={styles.sectionText}>
            Envie dúvidas, erros e sugestões para melhorar o aplicativo.
          </Text>

          <ActionItem
            icon="chatbubble-ellipses-outline"
            title="Falar com suporte"
            description="Solicite ajuda sobre sua conta ou uso do app"
            onPress={() => openSupport("Falar com suporte")}
          />
          <ActionItem
            icon="bug-outline"
            title="Reportar erro"
            description="Informe falhas, telas travando ou comportamento incorreto"
            onPress={() => openSupport("Reportar erro")}
          />
          <ActionItem
            icon="bulb-outline"
            title="Enviar sugestões"
            description="Sugira melhorias para o MovenApp"
            onPress={() => openSupport("Sugestões")}
          />
          <ActionItem
            icon="document-text-outline"
            title="Termos de uso"
            description="Regras de uso da plataforma"
            onPress={() => openSupport("Termos de uso")}
            last
          />
        </View>
      )}

      {activeTab === "sobre" && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Sobre o MovenApp</Text>
          <Text style={styles.sectionText}>
            Aplicativo para controle financeiro, jornadas, corridas, metas e
            comunidade para motoristas e entregadores.
          </Text>

          <View style={styles.versionBox}>
            <Ionicons name="phone-portrait-outline" size={24} color="#D4A64A" />
            <View>
              <Text style={styles.versionLabel}>Versão do aplicativo</Text>
              <Text style={styles.versionValue}>1.0.0</Text>
            </View>
          </View>

          <ActionItem
            icon="logo-instagram"
            title="Instagram"
            description="Acompanhe novidades e conteúdos"
            onPress={() => openUrl("https://instagram.com")}
          />
          <ActionItem
            icon="logo-tiktok"
            title="TikTok"
            description="Vídeos e dicas rápidas"
            onPress={() => openUrl("https://tiktok.com")}
          />
          <ActionItem
            icon="globe-outline"
            title="Site oficial"
            description="Conheça mais sobre o MovenApp"
            onPress={() => openUrl("https://movenapp.com.br")}
            last
          />
        </View>
      )}
      <Modal
        visible={cpfCnpjModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCpfCnpjModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cpfModalCard}>
            <View style={styles.cpfModalIcon}>
              <Ionicons name="document-text-outline" size={26} color="#D4A64A" />
            </View>

            <Text style={styles.cpfModalTitle}>
              {selectedActionMode === "renew" ? "Renovar assinatura" : "Ativar assinatura"}
            </Text>

            <Text style={styles.cpfModalText}>
              Informe o CPF/CNPJ que será usado nesta cobrança.
            </Text>

            <Text style={styles.newDocumentLabel}>CPF/CNPJ</Text>

            <View style={styles.cpfInputBox}>
              <Ionicons name="person-outline" size={20} color="#D4A64A" />
              <TextInput
                value={cpfCnpj}
                onChangeText={(value: string) => setCpfCnpj(maskCpfCnpj(value))}
                placeholder="CPF ou CNPJ"
                placeholderTextColor="#8F8A91"
                keyboardType="numeric"
                style={styles.cpfInput}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.cpfPrimaryButton, creatingPayment && styles.subscribeButtonDisabled]}
              disabled={creatingPayment}
              onPress={handleConfirmCpfCnpjAndCreatePayment}
            >
              {creatingPayment ? (
                <ActivityIndicator color="#080808" />
              ) : (
                <>
                  <Ionicons name="card-outline" size={20} color="#080808" />
                  <Text style={styles.cpfPrimaryButtonText}>
                    {selectedActionMode === "renew"
                      ? "Gerar renovação"
                      : "Gerar pagamento"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.cpfSecondaryButton}
              disabled={creatingPayment}
              onPress={() => setCpfCnpjModalVisible(false)}
            >
              <Text style={styles.cpfSecondaryButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <View style={styles.benefitItem}>
      <Ionicons name="checkmark-circle-outline" size={18} color="#22C55E" />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

function PaymentHistoryItem({
  payment,
  subscriptionDueDate,
  onOpen,
  last,
}: {
  payment: SubscriptionPayment;
  subscriptionDueDate?: string | null;
  onOpen: () => void;
  last?: boolean;
}) {
  const statusInfo = getPaymentStatusInfo(payment.status);
  const hasUrl = Boolean(payment.invoice_url || payment.bank_slip_url);
  const displayDueDate = getPaymentDisplayDueDate(payment, subscriptionDueDate);

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      style={[styles.paymentItem, last && styles.paymentItemLast]}
      onPress={hasUrl ? onOpen : undefined}
      disabled={!hasUrl}
    >
      <View style={styles.paymentIcon}>
        <Ionicons name="receipt-outline" size={20} color="#D4A64A" />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.paymentTopRow}>
          <Text style={styles.paymentTitle}>
            {formatCurrency(payment.amount)}
          </Text>

          <View
            style={[
              styles.paymentStatusBadge,
              { backgroundColor: statusInfo.backgroundColor },
            ]}
          >
            <Text style={[styles.paymentStatusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        <Text style={styles.paymentDescription}>
          Vencimento: {formatDate(displayDueDate)}
        </Text>
        <Text style={styles.paymentDescription}>
          {payment.paid_at ? ` • Pago em ${formatDate(payment.paid_at)}` : ""}
        </Text>
      </View>

      {hasUrl ? (
        <Ionicons name="open-outline" size={19} color="#8F8A91" />
      ) : null}
    </TouchableOpacity>
  );
}

function PrivacySwitch({
  title,
  description,
  value,
  onValueChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.privacySwitch}>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#3F3F46", true: "rgba(212,166,74,0.45)" }}
        thumbColor={value ? "#D4A64A" : "#9B969B"}
      />
    </View>
  );
}

function ActionItem({
  icon,
  title,
  description,
  onPress,
  last,
}: {
  icon: IconName;
  title: string;
  description: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      style={[styles.actionItem, last && styles.actionItemLast]}
      onPress={onPress}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color="#D4A64A" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color="#8F8A91" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 110,
    backgroundColor: "#050505",
  },
  header: {
    marginHorizontal: -18,
    marginTop: -48,
    marginBottom: 16,
    paddingTop: 48,
    paddingBottom: 18,
    paddingHorizontal: 18,
    backgroundColor: "#070707",
    borderBottomWidth: 1,
    borderBottomColor: "#211D16",
    zIndex: 20,
    elevation: 20,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  headerEyebrow: {
    color: "#D4A64A",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.7,
  },
  headerTitle: {
    color: "#F5F0E6",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.1,
  },
  introCard: {
    backgroundColor: "#101014",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 18,
    marginBottom: 14,
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.07,
    shadowRadius: 22,
    elevation: 8,
  },
  introTitle: {
    color: "#F5F0E6",
    fontSize: 18,
    fontWeight: "900",
  },
  introText: {
    color: "#9B969B",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 6,
  },
  tabsContent: {
    gap: 10,
    paddingBottom: 16,
  },
  tabButton: {
    height: 42,
    borderRadius: 999,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  tabButtonActive: {
    backgroundColor: "#D4A64A",
    borderColor: "#D4A64A",
  },
  tabText: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "900",
  },
  tabTextActive: {
    color: "#080808",
  },
  sectionCard: {
    backgroundColor: "#101014",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 16,
  },
  sectionTitle: {
    color: "#F5F0E6",
    fontSize: 18,
    fontWeight: "900",
  },
  sectionText: {
    color: "#9B969B",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 14,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  planBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
    marginBottom: 10,
  },
  planBoxTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  planLabel: {
    fontSize: 12,
    fontWeight: "900",
  },
  planName: {
    color: "#F5F0E6",
    fontSize: 19,
    fontWeight: "900",
  },
  planDescription: {
    color: "#B8A77C",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 8,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  planMetricsRow: {
    backgroundColor: "rgba(5,5,5,0.28)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
    padding: 12,
    marginTop: 13,
    flexDirection: "row",
    alignItems: "center",
  },
  planMetric: {
    flex: 1,
  },
  planMetricLabel: {
    color: "#9B969B",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  planMetricValue: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 5,
  },
  planMetricDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(245,240,230,0.10)",
    marginHorizontal: 12,
  },
  inactiveInfoText: {
    color: "#B8B1B8",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 10,
  },

  discountHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  discountHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "rgba(250,204,21,0.12)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  discountHeaderTitle: {
    color: "#FACC15",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  discountHeaderText: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 2,
  },
  discountPayBox: {
    borderRadius: 14,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.26)",
    padding: 12,
    marginTop: 4,
  },
  discountPayLabel: {
    color: "#BBF7D0",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  discountPayValue: {
    color: "#22C55E",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 3,
  },

  discountBreakdownBox: {
    backgroundColor: "rgba(5,5,5,0.28)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.22)",
    padding: 12,
    marginTop: 13,
    gap: 9,
  },
  discountBreakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  discountBreakdownLabel: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "900",
  },
  discountBreakdownValue: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
  },
  discountBreakdownDiscountValue: {
    color: "#FACC15",
    fontSize: 13,
    fontWeight: "900",
  },
  discountBreakdownDivider: {
    height: 1,
    backgroundColor: "rgba(245,240,230,0.10)",
    marginVertical: 2,
  },
  discountBreakdownPayLabel: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
  },
  discountBreakdownPayValue: {
    color: "#22C55E",
    fontSize: 18,
    fontWeight: "900",
  },
  discountDueDateBox: {
    minHeight: 34,
    borderRadius: 11,
    backgroundColor: "rgba(245,240,230,0.06)",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  discountDueDateText: {
    color: "#B8B1B8",
    fontSize: 11,
    fontWeight: "800",
  },

  freePriceText: {
    color: "#22C55E",
  },
  originalPriceText: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 3,
    textDecorationLine: "line-through",
  },
  planRuleBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  planRuleBoxFree: {
    backgroundColor: "rgba(34,197,94,0.10)",
    borderColor: "rgba(34,197,94,0.25)",
  },
  planRuleBoxDiscount: {
    backgroundColor: "rgba(250,204,21,0.10)",
    borderColor: "rgba(250,204,21,0.25)",
  },
  planRuleTitle: {
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 3,
  },
  planRuleTitleFree: {
    color: "#22C55E",
  },
  planRuleTitleDiscount: {
    color: "#FACC15",
  },
  planRuleText: {
    color: "#B8B1B8",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },

  subscriptionLoadingBox: {
    minHeight: 126,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.20)",
    backgroundColor: "rgba(212,166,74,0.08)",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
  },
  subscriptionLoadingText: {
    color: "#B8B1B8",
    fontSize: 12,
    fontWeight: "800",
  },
  subscriptionAlert: {
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: "rgba(212,166,74,0.24)",
    borderLeftColor: "#D4A64A",
    backgroundColor: "rgba(212,166,74,0.10)",
    padding: 14,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  subscriptionAlertDanger: {
    borderColor: "rgba(239,68,68,0.24)",
    borderLeftColor: "#EF4444",
    backgroundColor: "rgba(239,68,68,0.10)",
  },
  subscriptionAlertTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  subscriptionAlertText: {
    color: "#B8B1B8",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  subscribeButton: {
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 9,
  },
  subscribeButtonDisabled: {
    opacity: 0.65,
  },
  subscribeButtonText: {
    color: "#080808",
    fontSize: 14,
    fontWeight: "900",
  },
  subscriptionActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  secondaryButtonDisabled: {
    opacity: 0.45,
  },
  secondaryButtonText: {
    color: "#D4A64A",
    fontSize: 12,
    fontWeight: "900",
  },


  nextChargeBox: {
    backgroundColor: "#D4A64A",
    borderRadius: 18,
    padding: 15,
    marginBottom: 14,
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  nextChargeTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nextChargeIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(8,8,8,0.13)",
    alignItems: "center",
    justifyContent: "center",
  },
  nextChargeEyebrow: {
    color: "rgba(8,8,8,0.72)",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  nextChargeTitle: {
    color: "#080808",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2,
  },
  nextChargeText: {
    color: "rgba(8,8,8,0.72)",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  nextChargeStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(8,8,8,0.12)",
  },
  nextChargeStatusText: {
    fontSize: 10,
    fontWeight: "900",
  },
  nextChargeDetails: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  nextChargeDetailItem: {
    flex: 1,
    borderRadius: 13,
    backgroundColor: "rgba(8,8,8,0.10)",
    padding: 10,
  },
  nextChargeDetailLabel: {
    color: "rgba(8,8,8,0.62)",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  nextChargeDetailValue: {
    color: "#080808",
    fontSize: 12,
    fontWeight: "900",
  },
  nextChargeButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#080808",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  nextChargeButtonText: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
  },
  nextChargeHint: {
    color: "rgba(8,8,8,0.64)",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
    marginTop: 10,
  },

  manageNextPaymentBox: {
    borderRadius: 16,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 13,
    marginBottom: 14,
  },
  manageNextPaymentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  manageNextPaymentIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  manageNextPaymentTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  manageNextPaymentSubtitle: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  managePaymentLinkBox: {
    borderRadius: 13,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.24)",
    padding: 11,
    marginBottom: 10,
  },
  managePaymentLinkLabel: {
    color: "#22C55E",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 5,
  },
  managePaymentLinkText: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  managePaymentUnavailableBox: {
    borderRadius: 13,
    backgroundColor: "rgba(250,204,21,0.10)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.24)",
    padding: 11,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  managePaymentUnavailableText: {
    flex: 1,
    color: "#FACC15",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  manageNextChargeButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  manageNextChargeButtonText: {
    color: "#080808",
    fontSize: 13,
    fontWeight: "900",
  },

  activeSubscriptionMessageBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.26)",
    backgroundColor: "rgba(34,197,94,0.10)",
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  activeSubscriptionMessageTitle: {
    color: "#22C55E",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 3,
  },
  activeSubscriptionMessageText: {
    color: "#BBF7D0",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  documentEditButton: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    backgroundColor: "rgba(212,166,74,0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    marginBottom: 14,
  },
  documentEditButtonText: {
    color: "#D4A64A",
    fontSize: 12,
    fontWeight: "900",
  },
  recurringBox: {
    backgroundColor: "#18171D",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 14,
    marginBottom: 14,
  },
  recurringHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  recurringTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  recurringText: {
    color: "#8F8A91",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  recurringGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  recurringGridItem: {
    width: "47%",
    borderRadius: 13,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 10,
  },
  recurringLabel: {
    color: "#8F8A91",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  recurringValue: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "900",
  },
  manageModalCard: {
    width: "100%",
    maxHeight: "92%",
    backgroundColor: "#101014",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 18,
  },
  manageModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  manageSubtitle: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 4,
  },
  manageActionButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  manageActionButtonText: {
    color: "#D4A64A",
    fontSize: 13,
    fontWeight: "900",
  },
  cancelSubscriptionButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  cancelSubscriptionButtonText: {
    color: "#FCA5A5",
    fontSize: 13,
    fontWeight: "900",
  },
  benefitsBox: {
    backgroundColor: "#18171D",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 14,
    marginBottom: 14,
  },
  benefitsTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 10,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 7,
  },
  benefitText: {
    color: "#B8B1B8",
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },
  historyHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyTitle: {
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "900",
  },
  emptyHistoryBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(212,166,74,0.25)",
    backgroundColor: "rgba(212,166,74,0.06)",
    padding: 16,
    alignItems: "center",
    marginTop: 10,
  },
  emptyHistoryTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 8,
  },
  emptyHistoryText: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },
  paymentItem: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2830",
  },
  paymentItemLast: {
    borderBottomWidth: 0,
  },
  paymentIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(212,166,74,0.10)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  paymentTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
    flex: 1,
  },
  paymentDescription: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  paymentStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  paymentStatusText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  actionItem: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2830",
  },
  actionItemLast: {
    borderBottomWidth: 0,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(212,166,74,0.10)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  actionDescription: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 17,
  },
  privacySwitch: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2830",
  },
  versionBox: {
    minHeight: 72,
    backgroundColor: "#18171D",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  versionLabel: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "800",
  },
  versionValue: {
    color: "#F5F0E6",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  cpfModalCard: {
    width: "100%",
    backgroundColor: "#101014",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 18,
    alignItems: "center",
  },
  cpfModalIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cpfModalTitle: {
    color: "#F5F0E6",
    fontSize: 20,
    fontWeight: "900",
  },
  cpfModalText: {
    color: "#9B969B",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },

  newDocumentLabel: {
    width: "100%",
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 7,
  },
  cpfInputBox: {
    width: "100%",
    minHeight: 56,
    borderRadius: 15,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  cpfInput: {
    flex: 1,
    color: "#F5F0E6",
    fontSize: 16,
    fontWeight: "800",
    minHeight: 50,
  },
  cpfPrimaryButton: {
    width: "100%",
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  cpfPrimaryButtonText: {
    color: "#080808",
    fontSize: 14,
    fontWeight: "900",
  },
  cpfSecondaryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  cpfSecondaryButtonText: {
    color: "#9B969B",
    fontSize: 13,
    fontWeight: "900",
  },
});
