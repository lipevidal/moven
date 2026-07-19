import { Linking } from "react-native";

export type PostPaymentMethods = {
  credit?: boolean;
  creditInstallments?: string | number | null;
  debit?: boolean;
  pix?: boolean;
  other?: boolean;
  otherDescription?: string | null;
};

export function normalizePostContentType(value?: string | null) {
  const contentType = String(value ?? "").trim().toLowerCase();

  if (
    contentType === "general" ||
    contentType === "sos" ||
    contentType === "sale" ||
    contentType === "rental" ||
    contentType === "results" ||
    contentType === "events" ||
    contentType === "electric"
  ) {
    return contentType;
  }

  return "general";
}

export function getPostAreaColor(contentType?: string | null) {
  const normalizedType = normalizePostContentType(contentType);

  const colors: Record<string, string> = {
    general: "#D4A64A",
    sos: "#EF4444",
    sale: "#22C55E",
    rental: "#60A5FA",
    results: "#FACC15",
    events: "#A78BFA",
    electric: "#2DD4BF",
  };

  return colors[normalizedType] ?? colors.general;
}

export function formatPostCurrency(value?: number | string | null) {
  const amount =
    typeof value === "string"
      ? Number(value.replace(/\./g, "").replace(",", "."))
      : Number(value ?? 0);

  if (!Number.isFinite(amount)) return "0,00";

  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPostDate(value?: string | null) {
  if (!value) return "Não informado";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Não informado";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatPostTime(value?: string | null) {
  if (!value) return "--:--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "--:--";

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPostDateTime(value?: string | null) {
  if (!value) return "Não informado";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Não informado";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getRentalPeriodLabel(value?: string | null) {
  if (value === "day") return "diária";
  if (value === "week") return "semana";
  if (value === "month") return "mês";

  return "período";
}

export function getSupportTypeData(value?: string | null) {
  if (value === "vehicle_breakdown") {
    return {
      label: "Pane no veículo",
      description: "Apoio relacionado a falha, defeito ou imobilização do veículo.",
      icon: "car-outline" as const,
    };
  }

  return {
    label: "Problema com passageiro",
    description: "Ajuda ou orientação para uma situação envolvendo passageiro.",
    icon: "person-outline" as const,
  };
}

export function getPaymentMethodLabels(
  paymentMethods?: PostPaymentMethods | null,
) {
  if (!paymentMethods) return [];

  const labels: string[] = [];

  if (paymentMethods.pix) labels.push("Pix");
  if (paymentMethods.debit) labels.push("Débito");

  if (paymentMethods.credit) {
    const installments = String(
      paymentMethods.creditInstallments ?? "",
    ).trim();

    labels.push(
      installments
        ? `Crédito até ${installments}x`
        : "Crédito",
    );
  }

  if (paymentMethods.other) {
    labels.push(
      String(paymentMethods.otherDescription ?? "").trim() ||
        "Outra forma",
    );
  }

  return labels;
}

export function buildWhatsAppUrl(rawValue?: string | null) {
  const value = String(rawValue ?? "").trim();

  if (!value) return "";

  if (
    value.startsWith("https://") ||
    value.startsWith("http://")
  ) {
    return value;
  }

  const numbers = value.replace(/\D/g, "");

  if (!numbers) return "";

  const phone = numbers.startsWith("55")
    ? numbers
    : `55${numbers}`;

  return `https://wa.me/${phone}`;
}

export async function openPostWhatsApp(
  rawValue?: string | null,
) {
  const url = buildWhatsAppUrl(rawValue);

  if (!url) return;

  const supported = await Linking.canOpenURL(url);

  if (supported) {
    await Linking.openURL(url);
  }
}
