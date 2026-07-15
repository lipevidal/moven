import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  AudioModule,
  createAudioPlayer,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as Location from "expo-location";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from "../../../src/database/supabase";
import {
  DashboardPeriod,
  getDashboardData,
} from "../../../src/features/dashboard/services/getDashboardData";
import { PublicUserProfileModal } from "../../../src/features/profile/components/PublicUserProfileModal";
import { OperationalResultCard } from "../../../src/features/dashboard/components/OperationalResultCard";

type IconName = keyof typeof Ionicons.glyphMap;
type ContentType =
  | "general"
  | "sos"
  | "sale"
  | "rental"
  | "results"
  | "events"
  | "electric";
type FeedScope = "city" | "national";
type ResultPeriod = DashboardPeriod | "turn";

type ResultReferenceOption = {
  key: string;
  date: Date;
  label: string;
  subtitle: string;
};

type PaymentMethods = {
  credit?: boolean;
  creditInstallments?: string;
  debit?: boolean;
  pix?: boolean;
  other?: boolean;
  otherDescription?: string;
};

type CommunityPost = {
  id: string;
  user_id: string;
  city?: string | null;
  content_type?: string | null;
  category?: string | null;
  scope?: string | null;
  status?: string | null;
  content?: string | null;
  image_url?: string | null;
  images?: string[] | null;
  created_at: string;
  closed_at?: string | null;
  deleted_at?: string | null;
  expires_at?: string | null;
  support_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  product_name?: string | null;
  price?: number | string | null;
  payment_methods?: PaymentMethods | null;
  whatsapp_url?: string | null;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | string | null;
  rental_periodicity?: string | null;
  rental_price?: number | string | null;
  deposit_required?: boolean | null;
  deposit_amount?: number | string | null;
  deposit_installments?: number | string | null;
  deposit_paid_on_delivery?: boolean | null;
  event_at?: string | null;
  event_end_at?: string | null;
  event_address?: string | null;
  result_period_type?: string | null;
  result_snapshot?: any;
  hidden_expense_ids?: string[] | null;
  profile?: any;
  liked_by_me?: boolean;
  likes_count?: number;
  comments_count?: number;
};

type CommunityComment = {
  id: string;
  post_id: string;
  user_id: string;
  content?: string | null;
  created_at: string;
  image_url?: string | null;
  audio_url?: string | null;
  audio_duration_seconds?: number | null;
  reply_to_comment_id?: string | null;
  reply_to_author_name?: string | null;
  reply_to_content?: string | null;
  profile?: any;
};

type ContentConfig = {
  id: ContentType;
  title: string;
  description: string;
  icon: IconName;
  color: string;
  defaultScope: FeedScope;
  cityOnly?: boolean;
  nationalOnly?: boolean;
  canRenew: boolean;
  expirationHours: number | null;
};

const configs: ContentConfig[] = [
  {
    id: "general",
    title: "Geral",
    description: "Dúvidas, discussões e comentários da sua região.",
    icon: "chatbubbles-outline",
    color: "#D4A64A",
    defaultScope: "city",
    canRenew: false,
    expirationHours: 24 * 7,
  },
  {
    id: "sos",
    title: "Apoio / S.O.S",
    description: "Ajuda local para passageiro ou pane no veículo.",
    icon: "alert-circle-outline",
    color: "#EF4444",
    defaultScope: "city",
    cityOnly: true,
    canRenew: false,
    expirationHours: 24,
  },
  {
    id: "sale",
    title: "Venda de Itens",
    description: "Itens anunciados por motoristas da sua região.",
    icon: "pricetags-outline",
    color: "#22C55E",
    defaultScope: "national",
    canRenew: true,
    expirationHours: 24 * 7,
  },
  {
    id: "rental",
    title: "Aluguel de Veículos",
    description: "Veículos para alugar na sua cidade.",
    icon: "car-sport-outline",
    color: "#60A5FA",
    defaultScope: "city",
    cityOnly: true,
    canRenew: true,
    expirationHours: 24 * 7,
  },
  {
    id: "results",
    title: "Resultados e Metas",
    description: "Resultados do app compartilhados na sua região.",
    icon: "trophy-outline",
    color: "#FACC15",
    defaultScope: "city",
    canRenew: false,
    expirationHours: 24,
  },
  {
    id: "events",
    title: "Eventos",
    description: "Eventos locais com data, hora e endereço.",
    icon: "calendar-outline",
    color: "#A78BFA",
    defaultScope: "city",
    cityOnly: true,
    canRenew: false,
    expirationHours: null,
  },
  {
    id: "electric",
    title: "Elétricos e Híbridos",
    description: "Conteúdo sobre elétricos e híbridos na sua região.",
    icon: "flash-outline",
    color: "#2DD4BF",
    defaultScope: "city",
    canRenew: false,
    expirationHours: 24 * 7,
  },
];

const MY_PROFILE_ROUTE = "/(private)/(tabs)/perfil";
const supportTypes = [
  { id: "passenger_problem", label: "Problema com passageiro" },
  { id: "vehicle_breakdown", label: "Pane no veículo" },
];
const rentalPeriods = [
  { id: "day", label: "Diária" },
  { id: "week", label: "Semanal" },
  { id: "month", label: "Mensal" },
];
const resultPeriods: { id: ResultPeriod; label: string }[] = [
  { id: "turn", label: "Turno" },
  { id: "day", label: "Dia" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
  { id: "year", label: "Ano" },
];

const resultShortMonths = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const resultWeekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function normalizeCity(value?: string | null) {
  return String(value ?? "").trim();
}

function normalizeRegion(value?: string | null) {
  return String(value ?? "").trim();
}
function normalizeContentType(value?: string | string[]) {
  const firstValue = Array.isArray(value) ? value[0] : value;
  const contentType = String(firstValue || "general") as ContentType;
  return configs.some((item) => item.id === contentType)
    ? contentType
    : "general";
}
function getConfig(contentType: ContentType) {
  return configs.find((item) => item.id === contentType) ?? configs[0];
}
function getUserAvatarUrl(user: any) {
  return (
    user?.avatar_url ||
    user?.photo_url ||
    user?.picture ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null
  );
}
function getUserDisplayName(user: any) {
  return (
    user?.full_name ||
    user?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "Motorista"
  );
}
function getFirstAndLastName(user: any) {
  const fullName = String(getUserDisplayName(user)).trim();
  const parts = fullName.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) return parts[0] || "Motorista";

  return `${parts[0]} ${parts[1]}`;
}
function getAudioExtension(uri: string) {
  const extension = uri.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (extension === "mp3") return "mp3";
  if (extension === "wav") return "wav";
  if (extension === "aac") return "aac";
  if (extension === "caf") return "caf";
  return "m4a";
}
function getAudioContentType(extension: string) {
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "wav") return "audio/wav";
  if (extension === "aac") return "audio/aac";
  if (extension === "caf") return "audio/x-caf";
  return "audio/mp4";
}
function formatAudioDuration(seconds?: number | null) {
  const totalSeconds = Math.max(Number(seconds ?? 0), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = Math.floor(totalSeconds % 60);

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}
function getReplyPreviewText(comment: CommunityComment) {
  if (comment.content?.trim()) return comment.content.trim();
  if (comment.image_url) return "Imagem";
  if (comment.audio_url) return "Áudio";

  return "Mensagem";
}
function getUsername(user: any) {
  const username = String(user?.username ?? "").trim();
  return username ? `@${username}` : user?.email || "Membro da comunidade";
}
function getRentalPeriodicityLabel(value?: string | null) {
  if (value === "day") return "Diária";
  if (value === "week") return "Semanal";
  if (value === "month") return "Mensal";

  return "Diária";
}

function getRentalPeriodicityPriceLabel(value?: string | null) {
  return `Valor da ${getRentalPeriodicityLabel(value).toLowerCase()}`;
}

function getNumericCurrencyValue(value?: number | string | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const rawValue = String(value ?? "").trim();
  if (!rawValue) return 0;

  const normalizedValue = rawValue.includes(",")
    ? rawValue.replace(/\./g, "").replace(",", ".")
    : rawValue;

  const amount = Number(normalizedValue);
  return Number.isFinite(amount) ? amount : 0;
}

function getRentalPickupPayment(post: CommunityPost) {
  const rentalPrice = getNumericCurrencyValue(post.rental_price);
  const depositAmount = post.deposit_required
    ? getNumericCurrencyValue(post.deposit_amount)
    : 0;
  const periodAmount = post.deposit_paid_on_delivery ? rentalPrice : 0;
  const total = depositAmount + periodAmount;
  const periodLabel = getRentalPeriodicityLabel(
    post.rental_periodicity,
  ).toLowerCase();

  const parts: string[] = [];

  if (depositAmount > 0) {
    parts.push(`Caução: R$ ${formatCurrency(depositAmount)}`);
  }

  if (periodAmount > 0) {
    parts.push(`${periodLabel}: R$ ${formatCurrency(periodAmount)}`);
  }

  return {
    total,
    parts,
    periodLabel,
  };
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatCurrency(value?: number | string | null) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function formatHoursToHHMM(value?: number | string | null) {
  const decimalHours = Number(value ?? 0);

  if (!Number.isFinite(decimalHours) || decimalHours <= 0) {
    return "00:00";
  }

  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
function safeJsonStringify(value: any) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "{}";
  }
}

function maskCurrencyInput(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 12);
  if (!numbers) return "";
  return (Number(numbers) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function parseCurrencyInput(value: string) {
  const amount = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(amount) ? amount : 0;
}
function maskDateInput(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 8);
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4)}`;
}
function maskTimeInput(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 4);
  if (numbers.length <= 2) return numbers;
  return `${numbers.slice(0, 2)}:${numbers.slice(2)}`;
}
function parseDateTime(dateValue: string, timeValue: string) {
  const [day, month, year] = dateValue.split("/").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  if (
    !day ||
    !month ||
    !year ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  )
    return null;
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  const valid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute;
  return valid ? date : null;
}
function getCurrentDateInput() {
  const date = new Date();
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}
function getCurrentTimeInput() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function formatDateInputFromDate(date: Date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function parseResultReferenceDate(value: string) {
  return parseDateTime(value, "12:00");
}

function getSafeResultReferenceDate(value: string) {
  return parseResultReferenceDate(value) ?? new Date();
}

function getWeekStart(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  next.setDate(next.getDate() + diff);
  next.setHours(12, 0, 0, 0);

  return next;
}

function getWeekEnd(date: Date) {
  const next = getWeekStart(date);
  next.setDate(next.getDate() + 6);
  next.setHours(12, 0, 0, 0);

  return next;
}

function formatShortDate(value: Date) {
  return value.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMonthYear(value: Date) {
  return value.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function getResultReferenceTitle(period: ResultPeriod) {
  if (period === "turn") return "Dia dos turnos";
  if (period === "week") return "Semana de referência";
  if (period === "month") return "Mês de referência";
  if (period === "year") return "Ano de referência";

  return "Dia de referência";
}

function getResultReferenceDisplay(period: ResultPeriod, value: string) {
  const date = getSafeResultReferenceDate(value);

  if (period === "week") {
    return `${formatShortDate(getWeekStart(date))} a ${formatShortDate(getWeekEnd(date))}`;
  }

  if (period === "month") {
    return formatMonthYear(date);
  }

  if (period === "year") {
    return String(date.getFullYear());
  }

  return formatShortDate(date);
}

function getResultPeriodLabel(period?: string | null) {
  if (period === "turn") return "Turno";
  if (period === "day") return "Dia";
  if (period === "week") return "Semana";
  if (period === "month") return "Mês";
  if (period === "year") return "Ano";
  return "Período";
}

function getResultSnapshotReference(snapshot: any, fallbackPeriod?: ResultPeriod) {
  const period = String(snapshot?.period || fallbackPeriod || "day");
  const referenceLabel =
    snapshot?.referenceLabel ||
    snapshot?.reference ||
    snapshot?.referenceDate ||
    "";

  return `${getResultPeriodLabel(period)}${referenceLabel ? ` · ${referenceLabel}` : ""}`;
}


function getSnapshotDashboardPeriod(snapshot: any): DashboardPeriod | null {
  const period = String(snapshot?.period || snapshot?.result_period_type || "").trim();

  if (period === "day" || period === "week" || period === "month" || period === "year") {
    return period;
  }

  return null;
}

function getSnapshotReferenceDate(snapshot: any) {
  const rawValue =
    snapshot?.referenceDate ||
    snapshot?.startDate ||
    snapshot?.started_at ||
    snapshot?.created_at ||
    "";

  if (typeof rawValue === "string") {
    const parsedReference = parseResultReferenceDate(rawValue);
    if (parsedReference) return parsedReference;
  }

  const parsedDate = rawValue ? new Date(rawValue) : new Date();

  if (Number.isNaN(parsedDate.getTime())) {
    return new Date();
  }

  return parsedDate;
}

function buildOperationalResultSummaryFromSnapshot(snapshot: any) {
  const revenue = Number(snapshot?.revenue ?? 0);
  const operationalExpenses = Number(
    snapshot?.operationalExpenses ?? snapshot?.expenses ?? 0,
  );
  const operationalResult = Number(
    snapshot?.operationalResult ?? snapshot?.profit ?? revenue - operationalExpenses,
  );
  const totalHours = Number(snapshot?.totalHours ?? 0);
  const totalKm = Number(snapshot?.totalKm ?? 0);

  return {
    revenue,
    operationalExpenses,
    operationalFuelExpenses: Number(snapshot?.operationalFuelExpenses ?? 0),
    operationalChargingExpenses: Number(snapshot?.operationalChargingExpenses ?? 0),
    operationalResult,
    totalHours,
    totalKm,
    revenuePerHour:
      Number(snapshot?.revenuePerHour ?? 0) || (totalHours > 0 ? revenue / totalHours : 0),
    revenuePerKm:
      Number(snapshot?.revenuePerKm ?? 0) || (totalKm > 0 ? revenue / totalKm : 0),
    startDate: snapshot?.startDate ?? getSnapshotReferenceDate(snapshot),
    endDate: snapshot?.endDate ?? getSnapshotReferenceDate(snapshot),
  };
}

function shiftResultReferenceDate(value: string, period: ResultPeriod, direction: -1 | 1) {
  const date = getSafeResultReferenceDate(value);
  const next = new Date(date);

  if (period === "week") {
    next.setDate(next.getDate() + direction * 7);
  } else if (period === "month") {
    next.setMonth(next.getMonth() + direction);
  } else if (period === "year") {
    next.setFullYear(next.getFullYear() + direction);
  } else {
    next.setDate(next.getDate() + direction);
  }

  return next;
}

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}
function getImageExtension(uri: string) {
  const extension = uri.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (extension === "png") return "png";
  if (extension === "webp") return "webp";
  return "jpg";
}
function getImageContentType(extension: string) {
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}
function getPostImages(post: CommunityPost) {
  const images = Array.isArray(post.images) ? post.images.filter(Boolean) : [];
  return images.length > 0 ? images : post.image_url ? [post.image_url] : [];
}
function isPostClosed(post: CommunityPost) {
  if (post.status === "closed" || post.closed_at) return true;
  if (post.expires_at) {
    const expiresAt = new Date(post.expires_at);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt <= new Date())
      return true;
  }
  return false;
}
function getPostSortTime(post: CommunityPost) {
  return new Date(post.closed_at || post.created_at).getTime();
}
function buildWhatsAppUrl(rawValue: string, itemName: string) {
  const value = rawValue.trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const numbers = value.replace(/\D/g, "");
  const phone = numbers.startsWith("55") ? numbers : `55${numbers}`;
  const message = encodeURIComponent(
    `Olá! Vi o anúncio "${itemName}" na comunidade do MovenApp e tenho interesse.`,
  );
  return `https://wa.me/${phone}?text=${message}`;
}
function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function resultKey(period: ResultPeriod, date: Date) {
  if (period === "year") return String(date.getFullYear());
  if (period === "month")
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return dateKey(date);
}

function getResultReferenceOptionKey(period: ResultPeriod, date: Date) {
  if (period === "year") return `year-${date.getFullYear()}`;

  if (period === "month") {
    return `month-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  if (period === "week") {
    return `week-${dateKey(getWeekStart(date))}`;
  }

  return `day-${dateKey(date)}`;
}

function getResultReferenceOptionLabel(period: ResultPeriod, date: Date) {
  if (period === "year") {
    return String(date.getFullYear());
  }

  if (period === "month") {
    return `${resultShortMonths[date.getMonth()].toLowerCase()} ${String(date.getFullYear()).slice(-2)}`;
  }

  if (period === "week") {
    const start = getWeekStart(date);
    const startDay = String(start.getDate()).padStart(2, "0");

    return `${startDay} ${resultShortMonths[start.getMonth()]}`;
  }

  return resultWeekDays[date.getDay()];
}

function getResultReferenceOptionSubtitle(period: ResultPeriod, date: Date) {
  if (period === "year") return "";

  if (period === "month") {
    return "";
  }

  if (period === "week") {
    const end = getWeekEnd(date);
    const endDay = String(end.getDate()).padStart(2, "0");

    return `${endDay} ${resultShortMonths[end.getMonth()]}`;
  }

  return `${String(date.getDate()).padStart(2, "0")} ${resultShortMonths[date.getMonth()]}`;
}

function buildResultReferenceOptions(period: ResultPeriod, page: number) {
  /*
    Dia e turno mostram 4 opções.
    Semana, mês e ano mostram 3 opções.
  */
  const pageSize = period === "day" || period === "turn" ? 4 : 3;
  const normalizedPage = Math.max(Number(page ?? 0), 0);
  const startOffset = normalizedPage * pageSize;
  const today = new Date();

  today.setHours(12, 0, 0, 0);

  return Array.from({ length: pageSize }).map((_, index) => {
    /*
      Mostra as datas em ordem crescente dentro do bloco.
      Exemplo no bloco atual de dias:
      Seg, 12 Jul | Ter, 13 Jul | Qua, 14 Jul | Qui, 15 Jul
    */
    const offset = startOffset + (pageSize - 1 - index);
    const date = new Date(today);

    if (period === "day" || period === "turn") {
      date.setDate(today.getDate() - offset);
    } else if (period === "week") {
      const currentWeekStart = getWeekStart(today);
      date.setTime(currentWeekStart.getTime());
      date.setDate(currentWeekStart.getDate() - offset * 7);
    } else if (period === "month") {
      date.setDate(1);
      date.setMonth(today.getMonth() - offset);
    } else if (period === "year") {
      date.setMonth(0, 1);
      date.setFullYear(today.getFullYear() - offset);
    }

    date.setHours(12, 0, 0, 0);

    return {
      key: getResultReferenceOptionKey(period, date),
      date,
      label: getResultReferenceOptionLabel(period, date),
      subtitle: getResultReferenceOptionSubtitle(period, date),
    };
  });
}

const amountKeys = [
  "amount",
  "value",
  "total",
  "gross_amount",
  "revenue",
  "earning",
  "earnings",
  "total_earnings",
  "fare",
  "price",
];

const dateKeys = [
  "earning_date",
  "expense_date",
  "work_date",
  "session_date",
  "date",
  "created_at",
  "started_at",
  "finished_at",
  "ended_at",
  "received_at",
  "registered_at",
];

function getFirstValue(row: any, keys: string[]) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") {
      return row[key];
    }
  }

  return null;
}

function getRowAmount(row: any) {
  const value = getFirstValue(row, amountKeys);
  return getNumericCurrencyValue(value);
}

function getRowDate(row: any) {
  const value = getFirstValue(row, dateKeys);
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getRangeStart(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) return new Date();

  date.setHours(0, 0, 0, 0);
  return date;
}

function getRangeEnd(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) return new Date();

  date.setHours(23, 59, 59, 999);
  return date;
}

function isDateInsideRange(date: Date | null, start?: string | Date, end?: string | Date) {
  if (!date) return false;

  const startDate = getRangeStart(start);
  const endDate = getRangeEnd(end);

  return date.getTime() >= startDate.getTime() && date.getTime() <= endDate.getTime();
}

function getPlatformName(row: any, platformNames: Record<string, string> = {}) {
  const platformObjectName =
    row?.platforms?.name ||
    row?.platforms?.title ||
    row?.platform_data?.name ||
    row?.platformData?.name ||
    row?.platform_info?.name;

  const platformId = String(row?.platform_id || row?.platformId || "").trim();
  const platformSlug = String(row?.platform_slug || row?.platform || "").trim();

  return String(
    platformObjectName ||
      row?.platform_name ||
      row?.platform_label ||
      row?.platform_title ||
      platformNames[platformId] ||
      platformNames[platformSlug] ||
      row?.platform ||
      row?.platform_slug ||
      row?.source ||
      row?.app_name ||
      "Sem plataforma",
  ).trim();
}

function getTotalAmount(rows: any[]) {
  return rows.reduce((total, row) => total + getRowAmount(row), 0);
}

function buildPlatformBreakdown(
  rows: any[],
  platformNames: Record<string, string> = {},
  fallbackTotal = 0,
) {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    const amount = getRowAmount(row);
    if (amount <= 0) return;

    const name = getPlatformName(row, platformNames);
    map.set(name, (map.get(name) ?? 0) + amount);
  });

  const items = Array.from(map.entries())
    .map(([label, amount]) => ({ label, amount }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20);

  if (items.length === 0 && fallbackTotal > 0) {
    return [{ label: "Total do período", amount: fallbackTotal }];
  }

  return items;
}

function getRevenuePeriodBuckets(period: ResultPeriod) {
  if (period === "week") {
    return ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  }

  if (period === "month") {
    return ["Semana 1", "Semana 2", "Semana 3", "Semana 4", "Semana 5"];
  }

  if (period === "year") {
    return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  }

  return [];
}

function getRevenuePeriodLabel(date: Date, period: ResultPeriod) {
  if (period === "year") {
    return getRevenuePeriodBuckets("year")[date.getMonth()] ?? "";
  }

  if (period === "month") {
    return `Semana ${Math.min(Math.floor((date.getDate() - 1) / 7) + 1, 5)}`;
  }

  if (period === "week") {
    const day = date.getDay();
    const index = day === 0 ? 6 : day - 1;
    return getRevenuePeriodBuckets("week")[index] ?? "";
  }

  return "";
}

function buildRevenueByPeriod(
  rows: any[],
  period: ResultPeriod,
  fallbackLabel: string,
  fallbackTotal: number,
) {
  const buckets = getRevenuePeriodBuckets(period);
  if (buckets.length === 0) return [];

  const map = new Map<string, number>();
  buckets.forEach((label) => map.set(label, 0));

  rows.forEach((row) => {
    const date = getRowDate(row);
    if (!date) return;

    const label = getRevenuePeriodLabel(date, period);
    if (!label) return;

    map.set(label, (map.get(label) ?? 0) + getRowAmount(row));
  });

  const items = buckets.map((label) => ({
    label,
    amount: map.get(label) ?? 0,
  }));

  const hasAnyRevenue = items.some((item) => item.amount > 0);

  if (!hasAnyRevenue && fallbackTotal > 0 && buckets.length > 0) {
    return items.map((item, index) =>
      index === 0 ? { ...item, amount: fallbackTotal } : item,
    );
  }

  return items;
}

function buildExpenseDetails(rows: any[]) {
  return rows
    .map((expense) => ({
      id: String(expense?.id ?? Math.random()),
      label: String(expense?.category || expense?.description || "Despesa"),
      description: String(expense?.description || ""),
      amount: getNumericCurrencyValue(expense?.amount),
      date: expense?.expense_date || expense?.date || expense?.created_at || null,
    }))
    .filter((item) => item.amount > 0)
    .slice(0, 60);
}

function getSessionStartDate(row: any) {
  const value = row?.started_at || row?.start_time || row?.created_at || row?.date;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getSessionEndDate(row: any) {
  const value = row?.finished_at || row?.ended_at || row?.end_time || row?.closed_at;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getSessionHours(row: any) {
  const storedHours = Number(
    row?.totalHours ??
      row?.total_hours ??
      row?.hours ??
      row?.worked_hours ??
      row?.duration_hours ??
      0,
  );

  if (Number.isFinite(storedHours) && storedHours > 0) return storedHours;

  const start = getSessionStartDate(row);
  const end = getSessionEndDate(row);

  if (!start || !end) return 0;

  return Math.max((end.getTime() - start.getTime()) / 1000 / 60 / 60, 0);
}

function getSessionKm(row: any) {
  const storedKm = Number(
    row?.totalKm ??
      row?.total_km ??
      row?.km ??
      row?.distance_km ??
      row?.distance ??
      0,
  );

  if (Number.isFinite(storedKm) && storedKm > 0) return storedKm;

  const startKm = Number(row?.start_km ?? row?.initial_km ?? 0);
  const endKm = Number(row?.end_km ?? row?.final_km ?? 0);

  if (Number.isFinite(startKm) && Number.isFinite(endKm) && endKm > startKm) {
    return endKm - startKm;
  }

  return 0;
}

function buildDailySessions(rows: any[]) {
  return rows
    .map((session, index) => {
      const start = getSessionStartDate(session);
      const end = getSessionEndDate(session);
      const revenue = Number(
        session?.total_earnings ??
          session?.earnings ??
          session?.revenue ??
          session?.amount ??
          0,
      );

      return {
        id: String(session?.id ?? index),
        label: session?.platform || session?.platform_name || `Turno ${index + 1}`,
        startedAt: start?.toISOString() ?? null,
        endedAt: end?.toISOString() ?? null,
        hours: getSessionHours(session),
        km: getSessionKm(session),
        revenue: Number.isFinite(revenue) ? revenue : 0,
      };
    })
    .slice(0, 40);
}

function getSessionRevenue(session: any) {
  const value = Number(
    session?.total_earnings ??
      session?.totalEarnings ??
      session?.earnings ??
      session?.revenue ??
      session?.amount ??
      session?.gross_amount ??
      0,
  );

  return Number.isFinite(value) ? value : 0;
}

function buildRevenueRowsFromSessions(rows: any[]) {
  return rows.map((session, index) => ({
    ...session,
    id: session?.id ?? `session-${index}`,
    amount: getSessionRevenue(session),
    created_at:
      session?.started_at ||
      session?.start_time ||
      session?.created_at ||
      session?.date ||
      null,
    platform_name:
      session?.platform_name ||
      session?.platform ||
      session?.platform_slug ||
      session?.vehicle_name ||
      `Turno ${index + 1}`,
  }));
}

export default function CommunityContentFeedScreen() {
  const params = useLocalSearchParams();
  const contentType = normalizeContentType(params.contentType as any);
  const config = getConfig(contentType);
  const { width: windowWidth } = useWindowDimensions();
  const postImagesViewportWidth = Math.max(windowWidth - 66, 260);
  const postImagePairItemWidth = Math.max((postImagesViewportWidth - 8) / 2, 120);
  const postImageTripleItemWidth = Math.max((postImagesViewportWidth - 16) / 3, 82);
  const messageBubbleMinWidth = Math.max(windowWidth * 0.6, 220);
  const createImagesViewportWidth = Math.max(windowWidth - 72, 260);
  const createImagePairItemWidth = Math.max((createImagesViewportWidth - 10) / 2, 128);

  const [currentUserId, setCurrentUserId] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profileImmediateRegion, setProfileImmediateRegion] = useState("");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [selectedPublicProfile, setSelectedPublicProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [fullImages, setFullImages] = useState<string[]>([]);
  const [fullImageIndex, setFullImageIndex] = useState(0);
  const [feedScope, setFeedScope] = useState<FeedScope>(
    contentType === "sale" ? "national" : "city",
  );
  const [resultsScopeFilter, setResultsScopeFilter] =
    useState<FeedScope>("city");
  const [postContent, setPostContent] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [savingPost, setSavingPost] = useState(false);
  const [supportType, setSupportType] = useState("passenger_problem");
  const [supportLatitude, setSupportLatitude] = useState<number | null>(null);
  const [supportLongitude, setSupportLongitude] = useState<number | null>(null);
  const [supportLocationLabel, setSupportLocationLabel] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);
  const [updatingLocationPostId, setUpdatingLocationPostId] = useState("");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [saleScope, setSaleScope] = useState<FeedScope>("national");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [paymentCredit, setPaymentCredit] = useState(false);
  const [paymentInstallments, setPaymentInstallments] = useState("");
  const [paymentDebit, setPaymentDebit] = useState(false);
  const [paymentPix, setPaymentPix] = useState(true);
  const [paymentOther, setPaymentOther] = useState(false);
  const [paymentOtherDescription, setPaymentOtherDescription] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [rentalPeriodicity, setRentalPeriodicity] = useState("week");
  const [rentalPrice, setRentalPrice] = useState("");
  const [depositRequired, setDepositRequired] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositInstallments, setDepositInstallments] = useState("");
  const [depositPaidOnDelivery, setDepositPaidOnDelivery] = useState(true);
  const [eventDate, setEventDate] = useState(getCurrentDateInput());
  const [eventTime, setEventTime] = useState(getCurrentTimeInput());
  const [eventEndDate, setEventEndDate] = useState(getCurrentDateInput());
  const [eventEndTime, setEventEndTime] = useState(getCurrentTimeInput());
  const [eventAddress, setEventAddress] = useState("");
  const [resultPeriod, setResultPeriod] = useState<ResultPeriod>("day");
  const [resultDate, setResultDate] = useState(getCurrentDateInput());
  const [resultReferencePage, setResultReferencePage] = useState(0);
  const [resultScope, setResultScope] = useState<FeedScope>("city");
  const [resultSnapshot, setResultSnapshot] = useState<any>(null);
  const [periodExpenses, setPeriodExpenses] = useState<any[]>([]);
  const [hiddenExpenseIds, setHiddenExpenseIds] = useState<string[]>([]);
  const [resultTurnOptions, setResultTurnOptions] = useState<any[]>([]);
  const [selectedResultTurnId, setSelectedResultTurnId] = useState("");
  const [loadingResultTurnOptions, setLoadingResultTurnOptions] = useState(false);
  const [loadingResultPreview, setLoadingResultPreview] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [commentImageUri, setCommentImageUri] = useState("");
  const [commentAudioUri, setCommentAudioUri] = useState("");
  const [commentAudioDuration, setCommentAudioDuration] = useState(0);
  const [replyingToComment, setReplyingToComment] =
    useState<CommunityComment | null>(null);
  const [recordingCommentAudio, setRecordingCommentAudio] = useState(false);
  const [playingAudioUrl, setPlayingAudioUrl] = useState("");
  const [loadingAudioUrl, setLoadingAudioUrl] = useState("");
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [loadingComments, setLoadingComments] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const commentsScrollRef = useRef<any>(null);
  const [commentsScrollY, setCommentsScrollY] = useState(0);
  const [commentsContentHeight, setCommentsContentHeight] = useState(0);
  const [commentsLayoutHeight, setCommentsLayoutHeight] = useState(0);
  const commentRecordingStartTimeRef = useRef<number | null>(null);
  const commentPlayerRef = useRef<any>(null);
  const commentPlayerUrlRef = useRef("");
  const commentAudioPlayersRef = useRef<Record<string, any>>({});
  const commentAudioSubscriptionsRef = useRef<Record<string, any>>({});
  const commentAudioEndedRef = useRef<Record<string, boolean>>({});

  const visiblePosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      const aClosed = isPostClosed(a);
      const bClosed = isPostClosed(b);

      if (aClosed !== bClosed) return aClosed ? 1 : -1;

      return getPostSortTime(b) - getPostSortTime(a);
    });
  }, [posts]);

  const resultReferenceOptions = useMemo(
    () => buildResultReferenceOptions(resultPeriod, resultReferencePage),
    [resultPeriod, resultReferencePage],
  );

  const selectedResultReferenceDate = useMemo(
    () => getSafeResultReferenceDate(resultDate),
    [resultDate],
  );

  useFocusEffect(
    useCallback(() => {
      loadCommunity();
    }, [contentType]),
  );

  async function loadCommunity(showRefresh = false) {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      await closeExpiredPosts();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = user?.id ?? "";
      setCurrentUserId(userId);

      if (!userId) {
        setProfileCity("");
        setProfileImmediateRegion("");
        setPosts([]);
        return;
      }

      const profile = await getLoggedProfile(userId, user);

      const city = normalizeCity(
        profile?.city ||
          user?.user_metadata?.city ||
          user?.user_metadata?.profile_city ||
          user?.user_metadata?.municipality,
      );

      const immediateRegion = normalizeRegion(
        profile?.regiao_imediata ||
          profile?.immediate_region ||
          profile?.region ||
          user?.user_metadata?.regiao_imediata ||
          user?.user_metadata?.immediate_region ||
          user?.user_metadata?.region,
      );

      setProfileCity(city);
      setProfileImmediateRegion(immediateRegion);

      await loadPosts(immediateRegion, userId);
    } catch (error) {
      console.log("Erro ao carregar conteúdo da comunidade:", error);
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function closeExpiredPosts() {
    try {
      await (supabase as any).rpc("close_expired_community_posts");
    } catch (error) {
      console.log("close_expired_community_posts indisponível:", error);
    }
  }

  async function getLoggedProfile(userId: string, user: any) {
    const { data: profileById, error: profileByIdError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileByIdError) {
      console.log("Erro ao buscar profile do usuário logado:", profileByIdError);
    }

    return (
      profileById ?? {
        id: userId,
        full_name: user?.user_metadata?.full_name || user?.user_metadata?.name,
        username: user?.user_metadata?.username,
        avatar_url:
          user?.user_metadata?.avatar_url || user?.user_metadata?.picture,
        email: user?.email,
        city: user?.user_metadata?.city,
        regiao_imediata: user?.user_metadata?.regiao_imediata,
        region: user?.user_metadata?.region,
      }
    );
  }

  async function loadPosts(immediateRegion: string, userId: string) {
    const cleanImmediateRegion = normalizeRegion(immediateRegion);

    if (!cleanImmediateRegion) {
      setPosts([]);
      return;
    }

    const profilesByUserId = await getProfilesByImmediateRegion(cleanImmediateRegion);
    const regionalUserIds = Object.keys(profilesByUserId);

    if (regionalUserIds.length === 0) {
      setPosts([]);
      return;
    }

    const { data: postsResponse, error: postsError } = await supabase
      .from("community_posts")
      .select("*")
      .eq("content_type", contentType)
      .is("deleted_at", null)
      .in("user_id", regionalUserIds)
      .order("created_at", { ascending: false })
      .limit(180);

    if (postsError) throw postsError;

    const regionalPosts = (postsResponse ?? []).filter((post: any) => {
      return Boolean(profilesByUserId[String(post.user_id)]);
    });

    const postIds = regionalPosts.map((post: any) => post.id).filter(Boolean);

    const [likesByPostId, commentsByPostId, likedPostIds] = await Promise.all([
      getLikesCountByPostIds(postIds),
      getCommentsCountByPostIds(postIds),
      getLikedPostIdsByUser(postIds, userId),
    ]);

    setPosts(
      regionalPosts.map((post: any) => ({
        ...post,
        images: Array.isArray(post.images) ? post.images : [],
        profile: profilesByUserId[String(post.user_id)] ?? null,
        likes_count: likesByPostId[post.id] ?? 0,
        comments_count: commentsByPostId[post.id] ?? 0,
        liked_by_me: likedPostIds.includes(post.id),
      })),
    );
  }

  async function getProfilesByImmediateRegion(immediateRegion: string) {
    const cleanImmediateRegion = normalizeRegion(immediateRegion);

    if (!cleanImmediateRegion) return {};

    const profilesByUserId: Record<string, any> = {};
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("regiao_imediata", cleanImmediateRegion)
      .limit(5000);

    if (error) {
      console.log("Erro ao buscar perfis da mesma região imediata:", error);
      return {};
    }

    (data ?? []).forEach((profile: any) => {
      const profileId = String(profile?.id ?? "").trim();

      if (profileId) {
        profilesByUserId[profileId] = profile;
      }
    });

    return profilesByUserId;
  }

  async function getProfilesByUserIds(userIds: string[]) {
    if (userIds.length === 0) return {};

    const cleanUserIds = Array.from(
      new Set(userIds.map((item) => String(item ?? "").trim()).filter(Boolean)),
    );

    if (cleanUserIds.length === 0) return {};

    const profilesByUserId: Record<string, any> = {};
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("id", cleanUserIds);

    if (error) {
      console.log("Erro ao buscar profiles por id:", error);
      return {};
    }

    (data ?? []).forEach((profile: any) => {
      const profileId = String(profile?.id ?? "").trim();

      if (profileId) {
        profilesByUserId[profileId] = profile;
      }
    });

    return profilesByUserId;
  }

  async function getLikesCountByPostIds(postIds: string[]) {
    if (postIds.length === 0) return {};
    const { data, error } = await supabase
      .from("community_post_likes")
      .select("post_id")
      .in("post_id", postIds);
    if (error) return {};
    return (data ?? []).reduce((acc: Record<string, number>, like: any) => {
      acc[like.post_id] = (acc[like.post_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  async function getCommentsCountByPostIds(postIds: string[]) {
    if (postIds.length === 0) return {};
    const { data, error } = await supabase
      .from("community_post_comments")
      .select("post_id")
      .in("post_id", postIds)
      .is("deleted_at", null);
    if (error) return {};
    return (data ?? []).reduce((acc: Record<string, number>, comment: any) => {
      acc[comment.post_id] = (acc[comment.post_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  async function getLikedPostIdsByUser(postIds: string[], userId: string) {
    if (postIds.length === 0 || !userId) return [];
    const { data, error } = await supabase
      .from("community_post_likes")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds);
    if (error) return [];
    return (data ?? []).map((item: any) => item.post_id);
  }

  async function pickPostImages() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso às suas fotos para adicionar imagens ao post.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.82,
        allowsMultipleSelection: true,
        selectionLimit: 6,
      });
      if (!result.canceled && result.assets?.length) {
        setSelectedImages((current) =>
          Array.from(
            new Set([
              ...current,
              ...result.assets.map((asset: any) => asset.uri),
            ]),
          ).slice(0, 6),
        );
      }
    } catch (error) {
      Alert.alert("Erro", "Não foi possível selecionar as imagens.");
    }
  }

  async function uploadImage(uri: string) {
    const extension = getImageExtension(uri);
    const contentType = getImageContentType(extension);
    const path = `${currentUserId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`;
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const { error } = await supabase.storage
      .from("community-post-images")
      .upload(path, arrayBuffer, { contentType, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage
      .from("community-post-images")
      .getPublicUrl(path);
    return data.publicUrl;
  }

  async function uploadCommentAudio(uri: string) {
    const extension = getAudioExtension(uri);
    const contentType = getAudioContentType(extension);
    const path = `${currentUserId}/comment-audios/${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`;
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const { error } = await supabase.storage
      .from("community-post-images")
      .upload(path, arrayBuffer, { contentType, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage
      .from("community-post-images")
      .getPublicUrl(path);
    return data.publicUrl;
  }

  function formatCurrentLocationLabel(
    latitude: number,
    longitude: number,
    address?: any,
  ) {
    const street = String(address?.street || address?.name || "").trim();
    const district = String(
      address?.district || address?.subregion || "",
    ).trim();
    const cityName = String(address?.city || address?.subregion || "").trim();
    const region = String(address?.region || "").trim();

    const parts = [street, district, cityName, region].filter(Boolean);
    const uniqueParts = parts.filter(
      (part, index) => parts.indexOf(part) === index,
    );

    if (uniqueParts.length > 0) {
      return uniqueParts.join(" · ");
    }

    return `Lat: ${latitude.toFixed(5)} · Long: ${longitude.toFixed(5)}`;
  }

  function removeCurrentLocation() {
    setSupportLatitude(null);
    setSupportLongitude(null);
    setSupportLocationLabel("");
  }

  async function getReadableCurrentLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      throw new Error("Permissão de localização negada.");
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const latitude = location.coords.latitude;
    const longitude = location.coords.longitude;
    let locationLabel = `Lat: ${latitude.toFixed(5)} · Long: ${longitude.toFixed(5)}`;

    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      locationLabel = formatCurrentLocationLabel(
        latitude,
        longitude,
        addresses?.[0],
      );
    } catch (reverseError) {
      console.log(
        "Não foi possível converter a localização em endereço:",
        reverseError,
      );
    }

    return {
      latitude,
      longitude,
      locationLabel,
    };
  }

  async function getCurrentLocation() {
    try {
      setGettingLocation(true);

      const currentLocation = await getReadableCurrentLocation();

      setSupportLatitude(currentLocation.latitude);
      setSupportLongitude(currentLocation.longitude);
      setSupportLocationLabel(currentLocation.locationLabel);
    } catch (error: any) {
      if (String(error?.message ?? "").includes("Permissão")) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso à localização para enviar sua posição atual no S.O.S.",
        );
      } else {
        Alert.alert("Erro", "Não foi possível obter sua localização atual.");
      }
    } finally {
      setGettingLocation(false);
    }
  }

  function resetForm() {
    setPostContent("");
    setSelectedImages([]);
    setSupportType("passenger_problem");
    setSupportLatitude(null);
    setSupportLongitude(null);
    setSupportLocationLabel("");
    setProductName("");
    setProductPrice("");
    setSaleScope("national");
    setWhatsappUrl("");
    setPaymentCredit(false);
    setPaymentInstallments("");
    setPaymentDebit(false);
    setPaymentPix(true);
    setPaymentOther(false);
    setPaymentOtherDescription("");
    setVehicleBrand("");
    setVehicleModel("");
    setVehicleYear("");
    setRentalPeriodicity("week");
    setRentalPrice("");
    setDepositRequired(false);
    setDepositAmount("");
    setDepositInstallments("");
    setDepositPaidOnDelivery(true);
    setEventDate(getCurrentDateInput());
    setEventTime(getCurrentTimeInput());
    setEventEndDate(getCurrentDateInput());
    setEventEndTime(getCurrentTimeInput());
    setEventAddress("");
    setResultPeriod("day");
    setResultDate(getCurrentDateInput());
    setResultReferencePage(0);
    setResultScope("city");
    setResultSnapshot(null);
    setPeriodExpenses([]);
    setHiddenExpenseIds([]);
    setResultTurnOptions([]);
    setSelectedResultTurnId("");
  }

  function openCreatePostModal() {
    resetForm();
    setPostModalVisible(true);
  }

  function closeCreatePostModal() {
    if (savingPost) return;
    setPostModalVisible(false);
    resetForm();
  }

  function getScope() {
    return "city";
  }

  function getExpirationDate() {
    if (contentType === "events") {
      const endDate = parseDateTime(eventEndDate, eventEndTime);
      return endDate ? addHours(endDate, 12) : null;
    }
    return config.expirationHours
      ? addHours(new Date(), config.expirationHours)
      : null;
  }

  function validatePost() {
    const content = postContent.trim();
    if (!currentUserId) return "Usuário não encontrado.";
    if (!profileImmediateRegion)
      return "Atualize sua cidade onde mora para identificar sua região imediata antes de publicar.";
    if (contentType === "general" && !content && selectedImages.length === 0)
      return "Escreva uma descrição ou adicione uma imagem.";
    if (contentType === "sos" && !content && selectedImages.length === 0)
      return "Descreva o apoio que você precisa.";
    if (contentType === "sale") {
      if (!productName.trim()) return "Informe o nome do produto.";
      if (parseCurrencyInput(productPrice) <= 0)
        return "Informe o valor do produto.";
      if (!whatsappUrl.trim()) return "Informe o WhatsApp do vendedor.";
    }
    if (contentType === "rental") {
      const year = Number(vehicleYear);

      if (!vehicleBrand.trim()) return "Informe a marca do veículo.";
      if (!vehicleModel.trim()) return "Informe o modelo do veículo.";
      if (!vehicleYear.trim()) return "Informe o ano do veículo.";
      if (
        !Number.isInteger(year) ||
        year < 1980 ||
        year > new Date().getFullYear() + 1
      )
        return "Informe um ano válido para o veículo.";
      if (parseCurrencyInput(rentalPrice) <= 0)
        return `Informe o ${getRentalPeriodicityPriceLabel(rentalPeriodicity).toLowerCase()}.`;
      if (!whatsappUrl.trim()) return "Informe o WhatsApp para contato.";
    }
    if (
      contentType === "results" &&
      !resultSnapshot &&
      !content &&
      selectedImages.length === 0
    )
      return "Carregue um resultado, escreva um comentário ou adicione uma imagem.";
    if (contentType === "events") {
      const eventAt = parseDateTime(eventDate, eventTime);
      const eventEndAt = parseDateTime(eventEndDate, eventEndTime);
      if (!content) return "Informe a descrição do evento.";
      if (!eventAt) return "Informe a data e hora de início do evento.";
      if (!eventEndAt) return "Informe a data e hora de fim do evento.";
      if (eventEndAt <= eventAt)
        return "O fim do evento precisa ser depois do início.";
      if (!eventAddress.trim()) return "Informe o endereço do evento.";
    }
    if (contentType === "electric" && !content && selectedImages.length === 0)
      return "Escreva uma descrição ou adicione imagens.";
    return "";
  }

  async function handleCreatePost() {
    try {
      const validationMessage = validatePost();
      if (validationMessage) {
        Alert.alert("Atenção", validationMessage);
        return;
      }

      setSavingPost(true);
      const uploadedImages = selectedImages.length
        ? await Promise.all(selectedImages.map(uploadImage))
        : [];
      const scope = getScope();
      const expiresAt = getExpirationDate();
      const eventAt =
        contentType === "events" ? parseDateTime(eventDate, eventTime) : null;
      const eventEndAt =
        contentType === "events"
          ? parseDateTime(eventEndDate, eventEndTime)
          : null;
      const resultBaseDate = parseResultReferenceDate(resultDate);
      const paymentMethods: PaymentMethods = {
        credit: paymentCredit,
        creditInstallments: paymentInstallments,
        debit: paymentDebit,
        pix: paymentPix,
        other: paymentOther,
        otherDescription: paymentOtherDescription.trim(),
      };

      const payload: Record<string, any> = {
        user_id: currentUserId,
        city: profileCity || null,
        content_type: contentType,
        category:
          contentType === "general"
            ? "general"
            : contentType === "sos"
              ? supportType
              : contentType,
        scope,
        status: "open",
        content: postContent.trim() || null,
        image_url: uploadedImages[0] ?? null,
        images: uploadedImages,
        expires_at: expiresAt?.toISOString() ?? null,
        support_type: contentType === "sos" ? supportType : null,
        latitude: contentType === "sos" ? supportLatitude : null,
        longitude: contentType === "sos" ? supportLongitude : null,
        location_label:
          contentType === "sos" ? supportLocationLabel || null : null,
        product_name: contentType === "sale" ? productName.trim() : null,
        price: contentType === "sale" ? parseCurrencyInput(productPrice) : null,
        payment_methods:
          contentType === "sale" || contentType === "rental"
            ? paymentMethods
            : null,
        whatsapp_url:
          contentType === "sale"
            ? buildWhatsAppUrl(whatsappUrl, productName.trim())
            : contentType === "rental"
              ? buildWhatsAppUrl(
                  whatsappUrl,
                  `${vehicleBrand.trim()} ${vehicleModel.trim()} ${vehicleYear.trim()}`.trim(),
                )
              : null,
        vehicle_brand: contentType === "rental" ? vehicleBrand.trim() : null,
        vehicle_model: contentType === "rental" ? vehicleModel.trim() : null,
        vehicle_year: contentType === "rental" ? Number(vehicleYear) : null,
        rental_periodicity: contentType === "rental" ? rentalPeriodicity : null,
        rental_price:
          contentType === "rental" ? parseCurrencyInput(rentalPrice) : null,
        deposit_required: contentType === "rental" ? depositRequired : null,
        deposit_amount:
          contentType === "rental" && depositRequired
            ? parseCurrencyInput(depositAmount)
            : null,
        deposit_installments:
          contentType === "rental" && depositRequired
            ? Number(depositInstallments || 0)
            : null,
        deposit_paid_on_delivery:
          contentType === "rental" ? depositPaidOnDelivery : null,
        event_at: eventAt?.toISOString() ?? null,
        event_end_at: eventEndAt?.toISOString() ?? null,
        event_address: contentType === "events" ? eventAddress.trim() : null,
        result_period_type: contentType === "results" ? resultPeriod : null,
        result_period_key:
          contentType === "results" && resultBaseDate
            ? resultKey(resultPeriod, resultBaseDate)
            : null,
        result_period_start:
          contentType === "results"
            ? (resultSnapshot?.startDate ?? null)
            : null,
        result_period_end:
          contentType === "results" ? (resultSnapshot?.endDate ?? null) : null,
        result_snapshot:
          contentType === "results" ? buildResultPostSnapshot() : null,
        hidden_expense_ids: contentType === "results" ? hiddenExpenseIds : [],
      };

      const { error } = await supabase.from("community_posts").insert(payload);
      if (error) throw error;

      setPostModalVisible(false);
      resetForm();
      await loadCommunity(true);
    } catch (error: any) {
      console.log("Erro ao criar post:", error);
      Alert.alert(
        "Erro ao publicar",
        error?.message ?? "Não foi possível criar o post.",
      );
    } finally {
      setSavingPost(false);
    }
  }

  function handleSelectResultPeriod(value: string) {
    const nextPeriod = value as ResultPeriod;
    const currentReferenceDate = getSafeResultReferenceDate(resultDate);

    setResultPeriod(nextPeriod);
    setResultDate(formatDateInputFromDate(currentReferenceDate));
    setResultReferencePage(0);
    setResultSnapshot(null);
    setPeriodExpenses([]);
    setResultTurnOptions([]);
    setSelectedResultTurnId("");

    if (nextPeriod === "turn") {
      loadResultTurnOptionsForDateValue(currentReferenceDate);
    }
  }

  function handleShiftResultReference(direction: -1 | 1) {
    const nextDate = shiftResultReferenceDate(resultDate, resultPeriod, direction);

    setResultDate(formatDateInputFromDate(nextDate));
    setResultSnapshot(null);
    setPeriodExpenses([]);
    setResultTurnOptions([]);
    setSelectedResultTurnId("");

    if (resultPeriod === "turn") {
      loadResultTurnOptionsForDateValue(nextDate);
    }
  }

  async function loadEarningsForResult(
    startDate?: string | Date,
    endDate?: string | Date,
  ) {
    try {
      if (!currentUserId || !startDate || !endDate) return [];

      let response = await supabase
        .from("earnings")
        .select("*, platforms(*)")
        .eq("user_id", currentUserId)
        .limit(3000);

      if (response.error) {
        response = await supabase
          .from("earnings")
          .select("*")
          .eq("user_id", currentUserId)
          .limit(3000);
      }

      if (response.error) {
        console.log("Detalhes de ganhos indisponíveis:", response.error);
        return [];
      }

      return (response.data ?? []).filter((row: any) =>
        isDateInsideRange(getRowDate(row), startDate, endDate),
      );
    } catch (error) {
      console.log("Erro ao carregar detalhes de ganhos:", error);
      return [];
    }
  }

  async function loadSessionsForResult(
    startDate?: string | Date,
    endDate?: string | Date,
  ) {
    try {
      if (!currentUserId || !startDate || !endDate) return [];

      const { data, error } = await supabase
        .from("work_sessions")
        .select("*")
        .eq("user_id", currentUserId)
        .limit(1000);

      if (error) {
        console.log("Detalhes de turnos indisponíveis:", error);
        return [];
      }

      return (data ?? []).filter((row: any) =>
        isDateInsideRange(getRowDate(row) || getSessionStartDate(row), startDate, endDate),
      );
    } catch (error) {
      console.log("Erro ao carregar detalhes de turnos:", error);
      return [];
    }
  }

  async function loadPlatformNames() {
    try {
      const { data, error } = await supabase.from("platforms").select("*");

      if (error) return {};

      return (data ?? []).reduce((acc: Record<string, string>, platform: any) => {
        const name = String(platform?.name || platform?.title || "").trim();
        if (!name) return acc;

        if (platform?.id) acc[String(platform.id)] = name;
        if (platform?.slug) acc[String(platform.slug)] = name;
        if (platform?.code) acc[String(platform.code)] = name;

        return acc;
      }, {});
    } catch {
      return {};
    }
  }

  function buildResultPostSnapshot() {
    if (resultSnapshot) {
      return {
        ...resultSnapshot,
        period: resultPeriod,
        referenceDate: resultDate,
        referenceLabel:
          resultSnapshot.referenceLabel ||
          getResultReferenceDisplay(resultPeriod, resultDate),
        periodLabel: getResultPeriodLabel(resultPeriod),
        loadedFromApp: true,
      };
    }

    return {
      userId: currentUserId,
      period: resultPeriod,
      periodLabel: getResultPeriodLabel(resultPeriod),
      referenceDate: resultDate,
      referenceLabel: getResultReferenceDisplay(resultPeriod, resultDate),
      loadedFromApp: false,
      hasMetrics: false,
    };
  }

  function buildTurnOption(session: any, index: number) {
    const start = getSessionStartDate(session);
    const end = getSessionEndDate(session);
    const revenue = getSessionRevenue(session);
    const timeLabel =
      start && end
        ? `${start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} às ${end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
        : start
          ? start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : `Turno ${index + 1}`;

    return {
      ...session,
      id: String(session?.id ?? `turn-${index}`),
      label: `Turno ${index + 1}`,
      timeLabel,
      revenue,
      hours: getSessionHours(session),
      km: getSessionKm(session),
      start,
      end,
    };
  }

  async function loadResultTurnOptionsForDateValue(date: Date) {
    try {
      if (!date || Number.isNaN(date.getTime())) {
        Alert.alert("Data inválida", "Informe uma data válida.");
        return [];
      }

      setLoadingResultTurnOptions(true);
      setResultTurnOptions([]);
      setSelectedResultTurnId("");
      setResultSnapshot(null);
      setPeriodExpenses([]);

      const sessions = await loadSessionsForResult(
        getRangeStart(date),
        getRangeEnd(date),
      );
      const options = sessions.map(buildTurnOption);

      setResultTurnOptions(options);

      if (options.length === 1) {
        setSelectedResultTurnId(options[0].id);
      }

      return options;
    } finally {
      setLoadingResultTurnOptions(false);
    }
  }

  async function loadResultTurnOptionsForDate() {
    const parsedDate = parseResultReferenceDate(resultDate);
    if (!parsedDate) {
      Alert.alert("Data inválida", "Informe uma data válida.");
      return [];
    }

    return loadResultTurnOptionsForDateValue(parsedDate);
  }

  async function loadResultPreview() {
    try {
      const parsedDate = parseResultReferenceDate(resultDate);
      if (!parsedDate) {
        Alert.alert("Data inválida", "Informe uma data válida.");
        return;
      }

      setLoadingResultPreview(true);

      if (resultPeriod === "turn") {
        const options =
          resultTurnOptions.length > 0
            ? resultTurnOptions
            : await loadResultTurnOptionsForDate();
        const selectedTurn =
          options.find((item) => item.id === selectedResultTurnId) ??
          options[0] ??
          null;

        if (!selectedTurn) {
          Alert.alert(
            "Nenhum turno encontrado",
            "Não encontrei turnos finalizados para o dia selecionado.",
          );
          return;
        }

        setSelectedResultTurnId(selectedTurn.id);

        const turnStart =
          selectedTurn.start ?? getSessionStartDate(selectedTurn) ?? parsedDate;
        const turnEnd =
          selectedTurn.end ??
          getSessionEndDate(selectedTurn) ??
          getRangeEnd(turnStart);
        const periodStartDate = turnStart.toISOString();
        const periodEndDate = turnEnd.toISOString();
        const [earningsDetails, expenses, platformNames] = await Promise.all([
          loadEarningsForResult(periodStartDate, periodEndDate),
          loadExpensesForResult(periodStartDate, periodEndDate),
          loadPlatformNames(),
        ]);
        const visibleExpenseRows = expenses.filter(
          (expense: any) => !hiddenExpenseIds.includes(expense.id),
        );
        const hiddenTotal = expenses
          .filter((expense: any) => hiddenExpenseIds.includes(expense.id))
          .reduce(
            (total: number, expense: any) => total + Number(expense.amount ?? 0),
            0,
          );
        const sessionRevenueRows = buildRevenueRowsFromSessions([selectedTurn]);
        const filteredEarnings = earningsDetails.filter(
          (earning: any) =>
            String(earning?.session_id || earning?.work_session_id || "") ===
            String(selectedTurn.id),
        );
        const revenueRows =
          filteredEarnings.length > 0
            ? filteredEarnings
            : earningsDetails.length > 0
              ? earningsDetails
              : sessionRevenueRows;
        const rowsTotal = getTotalAmount(revenueRows);
        const revenue =
          rowsTotal > 0
            ? rowsTotal
            : Number(selectedTurn.revenue ?? getSessionRevenue(selectedTurn) ?? 0);
        const visibleExpenses = Math.max(
          getTotalAmount(expenses) - hiddenTotal,
          0,
        );
        const totalHours = Number(selectedTurn.hours ?? getSessionHours(selectedTurn));
        const totalKm = Number(selectedTurn.km ?? getSessionKm(selectedTurn));
        const referenceLabel = `${formatShortDate(parsedDate)} · ${selectedTurn.timeLabel}`;

        setResultSnapshot({
          userId: currentUserId,
          period: resultPeriod,
          periodLabel: getResultPeriodLabel(resultPeriod),
          referenceDate: resultDate,
          referenceLabel,
          turnId: selectedTurn.id,
          startDate: periodStartDate,
          endDate: periodEndDate,
          revenue,
          expenses: visibleExpenses,
          originalExpenses: getTotalAmount(expenses),
          profit: revenue - visibleExpenses,
          totalHours,
          totalKm,
          revenuePerHour: totalHours > 0 ? revenue / totalHours : 0,
          revenuePerKm: totalKm > 0 ? revenue / totalKm : 0,
          platformBreakdown: buildPlatformBreakdown(
            revenueRows,
            platformNames,
            revenue,
          ),
          revenueByPeriod: [],
          expenseDetails: buildExpenseDetails(visibleExpenseRows),
          dailySessions: buildDailySessions([selectedTurn]),
          hiddenExpenseIds,
          loadedFromApp: true,
        });
        return;
      }

      const dashboardPeriod = resultPeriod as DashboardPeriod;
      const response = await getDashboardData(dashboardPeriod, parsedDate);
      const expenses = await loadExpensesForResult(
        response?.startDate,
        response?.endDate,
      );
      const hiddenTotal = expenses
        .filter((expense: any) => hiddenExpenseIds.includes(expense.id))
        .reduce(
          (total: number, expense: any) => total + Number(expense.amount ?? 0),
          0,
        );
      const visibleExpenses = Math.max(
        Number(response?.expenses ?? 0) - hiddenTotal,
        0,
      );
      const revenue = Number(response?.revenue ?? 0);
      const profit = revenue - visibleExpenses;
      const periodStartDate = response?.startDate;
      const periodEndDate = response?.endDate;
      const visibleExpenseRows = expenses.filter(
        (expense: any) => !hiddenExpenseIds.includes(expense.id),
      );
      const [earningsDetails, sessionDetails, platformNames] = await Promise.all([
        loadEarningsForResult(periodStartDate, periodEndDate),
        loadSessionsForResult(periodStartDate, periodEndDate),
        loadPlatformNames(),
      ]);
      const sessionRevenueRows = buildRevenueRowsFromSessions(sessionDetails);
      const revenueRows =
        earningsDetails.length > 0 ? earningsDetails : sessionRevenueRows;
      const referenceLabel = getResultReferenceDisplay(resultPeriod, resultDate);

      setResultSnapshot({
        userId: currentUserId,
        period: resultPeriod,
        periodLabel: getResultPeriodLabel(resultPeriod),
        referenceDate: resultDate,
        referenceLabel,
        startDate: periodStartDate,
        endDate: periodEndDate,
        revenue,
        expenses: visibleExpenses,
        originalExpenses: Number(response?.expenses ?? 0),
        profit,
        totalHours: Number(response?.totalHours ?? 0),
        totalKm: Number(response?.totalKm ?? 0),
        revenuePerHour:
          Number(response?.totalHours ?? 0) > 0
            ? revenue / Number(response?.totalHours)
            : 0,
        revenuePerKm:
          Number(response?.totalKm ?? 0) > 0
            ? revenue / Number(response?.totalKm)
            : 0,
        platformBreakdown: buildPlatformBreakdown(
          revenueRows,
          platformNames,
          revenue,
        ),
        revenueByPeriod: buildRevenueByPeriod(
          revenueRows,
          resultPeriod,
          referenceLabel,
          revenue,
        ),
        expenseDetails: buildExpenseDetails(visibleExpenseRows),
        dailySessions:
          resultPeriod === "day" ? buildDailySessions(sessionDetails) : [],
        hiddenExpenseIds,
        loadedFromApp: true,
      });
    } catch (error: any) {
      console.log("Erro ao carregar resultado:", error);
      Alert.alert(
        "Erro",
        error?.message ?? "Não foi possível carregar o resultado do período.",
      );
    } finally {
      setLoadingResultPreview(false);
    }
  }

  async function loadExpensesForResult(
    startDate?: string | Date,
    endDate?: string | Date,
  ) {
    if (!startDate || !endDate) {
      setPeriodExpenses([]);
      return [];
    }
    const { data, error } = await supabase
      .from("expenses")
      .select("id, description, category, amount, expense_date")
      .eq("user_id", currentUserId)
      .gte("expense_date", new Date(startDate).toISOString())
      .lte("expense_date", new Date(endDate).toISOString())
      .order("expense_date", { ascending: false });
    if (error) throw error;
    setPeriodExpenses(data ?? []);
    return data ?? [];
  }

  function toggleHiddenExpense(expenseId: string) {
    setHiddenExpenseIds((current) =>
      current.includes(expenseId)
        ? current.filter((id) => id !== expenseId)
        : [...current, expenseId],
    );
    setResultSnapshot(null);
  }

  async function handleToggleLike(post: CommunityPost) {
    if (isPostClosed(post)) return;
    try {
      if (!currentUserId) return;
      const alreadyLiked = Boolean(post.liked_by_me);
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                liked_by_me: !alreadyLiked,
                likes_count: Math.max(
                  Number(item.likes_count ?? 0) + (alreadyLiked ? -1 : 1),
                  0,
                ),
              }
            : item,
        ),
      );
      if (alreadyLiked) {
        const { error } = await supabase
          .from("community_post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("community_post_likes")
          .insert({ post_id: post.id, user_id: currentUserId });
        if (error) throw error;
      }
    } catch (error) {
      console.log("Erro ao curtir feed:", error);
      await loadCommunity(true);
    }
  }

  async function openCommentsModal(post: CommunityPost) {
    setSelectedPost(post);
    resetCommentComposer();
    setCommentsModalVisible(true);
    await loadComments(post);
    scrollToCommentsEnd(350);
  }

  async function loadComments(post: CommunityPost) {
    try {
      setLoadingComments(true);
      const { data, error } = await supabase
        .from("community_post_comments")
        .select("*")
        .eq("post_id", post.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const loadedComments = data ?? [];
      const userIds = Array.from(
        new Set(
          loadedComments
            .map((comment: any) => String(comment.user_id))
            .filter(Boolean),
        ),
      ) as string[];
      const profilesByUserId = await getProfilesByUserIds(userIds);
      setComments(
        loadedComments.map((comment: any) => ({
          ...comment,
          profile: profilesByUserId[comment.user_id] ?? null,
        })),
      );
    } catch (error) {
      console.log("Erro ao carregar comentários:", error);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleCreateComment() {
    if (
      !selectedPost ||
      !currentUserId ||
      isPostClosed(selectedPost) ||
      savingComment
    )
      return;

    try {
      const content = commentContent.trim();

      if (!content && !commentImageUri && !commentAudioUri) {
        Alert.alert(
          "Atenção",
          "Escreva uma mensagem, envie uma imagem ou grave um áudio.",
        );
        return;
      }

      setSavingComment(true);

      const [uploadedImage, uploadedAudio] = await Promise.all([
        commentImageUri ? uploadImage(commentImageUri) : Promise.resolve(null),
        commentAudioUri
          ? uploadCommentAudio(commentAudioUri)
          : Promise.resolve(null),
      ]);

      const { error } = await supabase.from("community_post_comments").insert({
        post_id: selectedPost.id,
        user_id: currentUserId,
        content: content || null,
        image_url: uploadedImage,
        audio_url: uploadedAudio,
        audio_duration_seconds: uploadedAudio ? commentAudioDuration : null,
        reply_to_comment_id: replyingToComment?.id ?? null,
        reply_to_author_name: replyingToComment
          ? getFirstAndLastName(replyingToComment.profile ?? {})
          : null,
        reply_to_content: replyingToComment
          ? getReplyPreviewText(replyingToComment)
          : null,
      });

      if (error) throw error;

      resetCommentComposer();
      await Promise.all([loadComments(selectedPost), loadCommunity(true)]);
      scrollToCommentsEnd(300);
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error?.message ?? "Não foi possível enviar a mensagem.",
      );
    } finally {
      setSavingComment(false);
    }
  }

  function resetCommentComposer() {
    setCommentContent("");
    setCommentImageUri("");
    setCommentAudioUri("");
    setCommentAudioDuration(0);
    setReplyingToComment(null);
  }

  async function pickCommentImage() {
    if (savingComment || recordingCommentAudio) return;

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso às suas fotos para responder com imagem.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.82,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setCommentImageUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Erro", "Não foi possível selecionar a imagem.");
    }
  }

  function resetAudioPlayerToStart(player: any) {
    try {
      player?.seekTo?.(0);
    } catch {
      try {
        player?.setPositionAsync?.(0);
      } catch {
        // Alguns players não expõem método público de reposicionar.
      }
    }
  }

  function pauseOtherAudioPlayers(exceptUrl = "") {
    Object.entries(commentAudioPlayersRef.current).forEach(([audioUrl, player]) => {
      if (audioUrl === exceptUrl) return;

      try {
        player?.pause?.();
      } catch {
        // Ignora falhas de pausa para não travar a conversa.
      }
    });
  }

  function disableAudioLoop(player: any) {
    try {
      if ("loop" in player) {
        player.loop = false;
      }
    } catch {
      // Alguns players não expõem a propriedade loop.
    }

    try {
      player?.setIsLoopingAsync?.(false);
    } catch {
      // Compatibilidade com outros players.
    }
  }

  function releaseCachedAudioPlayer(audioUrl: string) {
    const subscription = commentAudioSubscriptionsRef.current[audioUrl];
    const player = commentAudioPlayersRef.current[audioUrl];

    try {
      subscription?.remove?.();
    } catch {
      // Ignora falhas de limpeza.
    }

    try {
      player?.pause?.();
      player?.remove?.();
    } catch {
      // Ignora falhas de limpeza.
    }

    delete commentAudioSubscriptionsRef.current[audioUrl];
    delete commentAudioPlayersRef.current[audioUrl];
    delete commentAudioEndedRef.current[audioUrl];

    if (commentPlayerUrlRef.current === audioUrl) {
      commentPlayerRef.current = null;
      commentPlayerUrlRef.current = "";
    }
  }

  function releaseCachedAudioPlayers() {
    Object.entries(commentAudioSubscriptionsRef.current).forEach(([, subscription]) => {
      try {
        subscription?.remove?.();
      } catch {
        // Ignora falhas de limpeza.
      }
    });

    Object.entries(commentAudioPlayersRef.current).forEach(([, player]) => {
      try {
        player?.pause?.();
        player?.remove?.();
      } catch {
        // Ignora falhas de limpeza.
      }
    });

    commentAudioPlayersRef.current = {};
    commentAudioSubscriptionsRef.current = {};
    commentAudioEndedRef.current = {};
    commentPlayerRef.current = null;
    commentPlayerUrlRef.current = "";
  }

  async function stopCurrentAudioPlayer() {
    try {
      releaseCachedAudioPlayers();
    } catch (error) {
      console.log("Erro ao parar áudio:", error);
    } finally {
      setPlayingAudioUrl("");
      setLoadingAudioUrl("");
    }
  }

  function getCachedAudioPlayer(audioUrl: string) {
    return commentAudioPlayersRef.current[audioUrl] ?? null;
  }

  function saveCachedAudioPlayer(audioUrl: string, player: any) {
    disableAudioLoop(player);
    commentAudioPlayersRef.current[audioUrl] = player;

    const oldSubscription = commentAudioSubscriptionsRef.current[audioUrl];
    oldSubscription?.remove?.();

    const subscription = player.addListener?.(
      "playbackStatusUpdate",
      (status: any) => {
        const finished =
          status?.didJustFinish ||
          status?.playbackState === "ended" ||
          status?.isLoaded === true && status?.didJustFinish === true;

        if (!finished) return;

        commentAudioEndedRef.current[audioUrl] = true;

        try {
          player?.pause?.();
        } catch {
          // Ignora falhas de pausa.
        }

        if (commentPlayerUrlRef.current === audioUrl) {
          setPlayingAudioUrl("");
          setLoadingAudioUrl("");
        }

        // Não reposiciona no fim, porque em alguns players isso reinicia o áudio.
        // Ao clicar novamente, o player será recriado e tocará do início.
        releaseCachedAudioPlayer(audioUrl);
      },
    );

    commentAudioSubscriptionsRef.current[audioUrl] = subscription;
  }

  async function prepareAudioPlayer(audioUrl: string) {
    const cachedPlayer = getCachedAudioPlayer(audioUrl);

    if (cachedPlayer) {
      return cachedPlayer;
    }

    await setAudioModeAsync({ playsInSilentMode: true });

    const player = createAudioPlayer({ uri: audioUrl });
    disableAudioLoop(player);
    saveCachedAudioPlayer(audioUrl, player);

    return player;
  }

  async function startCommentAudioRecording() {
    if (savingComment || commentAudioUri) return;

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso ao microfone para responder com áudio.",
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      commentRecordingStartTimeRef.current = Date.now();
      setRecordingCommentAudio(true);
    } catch (error) {
      console.log("Erro ao gravar áudio:", error);
      Alert.alert("Erro", "Não foi possível iniciar a gravação do áudio.");
      setRecordingCommentAudio(false);
      commentRecordingStartTimeRef.current = null;
    }
  }

  async function stopCommentAudioRecording() {
    if (!recordingCommentAudio) {
      setRecordingCommentAudio(false);
      return;
    }

    try {
      const startedAt = commentRecordingStartTimeRef.current;
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });

      const uri = audioRecorder.uri;
      const durationSeconds = startedAt
        ? Math.max(Math.round((Date.now() - startedAt) / 1000), 1)
        : 1;

      if (uri) {
        setCommentAudioUri(uri);
        setCommentAudioDuration(durationSeconds);
      }
    } catch (error) {
      Alert.alert("Erro", "Não foi possível finalizar a gravação do áudio.");
    } finally {
      setRecordingCommentAudio(false);
      commentRecordingStartTimeRef.current = null;
    }
  }

  async function cancelCommentAudioRecording() {
    try {
      if (recordingCommentAudio) {
        await audioRecorder.stop();
      }
      await setAudioModeAsync({ allowsRecording: false });
    } catch (error) {
      console.log("Erro ao cancelar áudio:", error);
    } finally {
      setRecordingCommentAudio(false);
      setCommentAudioUri("");
      setCommentAudioDuration(0);
      commentRecordingStartTimeRef.current = null;
    }
  }

  async function togglePlayAudio(audioUrl?: string | null) {
    const cleanAudioUrl = String(audioUrl ?? "").trim();
    if (!cleanAudioUrl || loadingAudioUrl === cleanAudioUrl) return;

    try {
      const cachedPlayer = getCachedAudioPlayer(cleanAudioUrl);

      if (playingAudioUrl === cleanAudioUrl && cachedPlayer) {
        cachedPlayer.pause?.();
        setPlayingAudioUrl("");
        return;
      }

      setLoadingAudioUrl(cleanAudioUrl);

      // Dá tempo para o botão trocar para loading antes de preparar o áudio.
      await new Promise((resolve) => setTimeout(resolve, 40));

      pauseOtherAudioPlayers(cleanAudioUrl);

      const player = await prepareAudioPlayer(cleanAudioUrl);

      commentPlayerRef.current = player;
      commentPlayerUrlRef.current = cleanAudioUrl;

      if (commentAudioEndedRef.current[cleanAudioUrl]) {
        releaseCachedAudioPlayer(cleanAudioUrl);
        const freshPlayer = await prepareAudioPlayer(cleanAudioUrl);
        commentPlayerRef.current = freshPlayer;
        commentPlayerUrlRef.current = cleanAudioUrl;
        await Promise.resolve(freshPlayer.play?.());
      } else {
        await Promise.resolve(player.play?.());
      }

      setPlayingAudioUrl(cleanAudioUrl);
    } catch (error) {
      console.log("Erro ao reproduzir áudio:", error);
      Alert.alert("Erro", "Não foi possível reproduzir o áudio.");
      setPlayingAudioUrl("");
    } finally {
      setLoadingAudioUrl("");
    }
  }

  function handleCommentLongPress(comment: CommunityComment) {
    if (!selectedPost || isPostClosed(selectedPost)) return;

    Alert.alert("Mensagem", "O que deseja fazer?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Responder", onPress: () => setReplyingToComment(comment) },
    ]);
  }

  function scrollToCommentsEnd(delay = 250) {
    setTimeout(
      () => commentsScrollRef.current?.scrollToEnd({ animated: true }),
      delay,
    );
  }

  function scrollToCommentsTop(delay = 0) {
    setTimeout(
      () => commentsScrollRef.current?.scrollTo({ y: 0, animated: true }),
      delay,
    );
  }

  function handleCommentsScroll(event: any) {
    setCommentsScrollY(Number(event?.nativeEvent?.contentOffset?.y ?? 0));
  }

  function openImageModal(images: string[], index = 0) {
    if (images.length === 0) return;
    setFullImages(images);
    setFullImageIndex(index);
    setImageModalVisible(true);
  }

  function closeImageModal() {
    setImageModalVisible(false);
    setFullImages([]);
    setFullImageIndex(0);
  }

  function showNextImage(direction: "prev" | "next") {
    setFullImageIndex((current) => {
      if (fullImages.length === 0) return 0;
      if (direction === "prev")
        return current === 0 ? fullImages.length - 1 : current - 1;
      return current === fullImages.length - 1 ? 0 : current + 1;
    });
  }

  async function handleClosePost(post: CommunityPost) {
    Alert.alert("Fechar post", "Deseja fechar este post agora?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Fechar",
        onPress: async () => {
          const { error } = await supabase
            .from("community_posts")
            .update({ status: "closed", closed_at: new Date().toISOString() })
            .eq("id", post.id)
            .eq("user_id", currentUserId);
          if (error) Alert.alert("Erro", error.message);
          else await loadCommunity(true);
        },
      },
    ]);
  }

  async function handleRenewPost(post: CommunityPost) {
    if (!config.canRenew) return;
    const { error } = await supabase
      .from("community_posts")
      .update({
        status: "open",
        closed_at: null,
        expires_at: addHours(new Date(), 24 * 7).toISOString(),
        renewed_at: new Date().toISOString(),
      })
      .eq("id", post.id)
      .eq("user_id", currentUserId);
    if (error) Alert.alert("Erro", error.message);
    else await loadCommunity(true);
  }

  async function handleDeletePost(post: CommunityPost) {
    Alert.alert(
      "Excluir post",
      "Deseja realmente excluir este post da comunidade?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("community_posts")
              .update({ deleted_at: new Date().toISOString() })
              .eq("id", post.id)
              .eq("user_id", currentUserId);
            if (error) Alert.alert("Erro", error.message);
            else await loadCommunity(true);
          },
        },
      ],
    );
  }

  async function handleUpdatePostLocation(post: CommunityPost) {
    try {
      if (!currentUserId) return;

      setUpdatingLocationPostId(post.id);

      const currentLocation = await getReadableCurrentLocation();

      const { error } = await supabase
        .from("community_posts")
        .update({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          location_label: currentLocation.locationLabel,
        })
        .eq("id", post.id)
        .eq("user_id", currentUserId);

      if (error) throw error;

      await loadCommunity(true);
    } catch (error: any) {
      if (String(error?.message ?? "").includes("Permissão")) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso à localização para atualizar a posição do S.O.S.",
        );
      } else {
        Alert.alert(
          "Erro",
          error?.message ?? "Não foi possível atualizar a localização.",
        );
      }
    } finally {
      setUpdatingLocationPostId("");
    }
  }

  async function handleRemovePostLocation(post: CommunityPost) {
    Alert.alert(
      "Remover localização",
      "Deseja remover a localização deste S.O.S?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              setUpdatingLocationPostId(post.id);

              const { error } = await supabase
                .from("community_posts")
                .update({
                  latitude: null,
                  longitude: null,
                  location_label: null,
                })
                .eq("id", post.id)
                .eq("user_id", currentUserId);

              if (error) throw error;

              await loadCommunity(true);
            } catch (error: any) {
              Alert.alert(
                "Erro",
                error?.message ?? "Não foi possível remover a localização.",
              );
            } finally {
              setUpdatingLocationPostId("");
            }
          },
        },
      ],
    );
  }

  function isCurrentUserProfile(userId?: string | null) {
    return Boolean(
      userId && currentUserId && String(userId) === String(currentUserId),
    );
  }

  function buildPublicProfileModalData(userId?: string | null, profile?: any | null) {
    const cleanUserId = String(userId ?? profile?.id ?? "").trim();

    if (!cleanUserId) return null;

    return {
      ...(profile ?? {}),
      id: String(profile?.id ?? cleanUserId),
    };
  }

  function closePublicProfileModal() {
    setSelectedPublicProfile(null);
  }

  function openDriverProfile(userId?: string | null, profile?: any | null) {
    if (!userId) return;

    const modalProfile = buildPublicProfileModalData(userId, profile);

    if (modalProfile) {
      setSelectedPublicProfile(modalProfile);
    }
  }

  function openDriverProfileFromModal(userId?: string | null, profile?: any | null) {
    if (!userId) return;

    const modalProfile = buildPublicProfileModalData(userId, profile);

    if (modalProfile) {
      setSelectedPublicProfile(modalProfile);
    }
  }

  function openMainCommunity() {
    router.replace("/(private)/(tabs)/motoristas-cidade" as never);
  }

  function renderScopeFilters() {
    return null;
  }

  function renderPostDetails(post: CommunityPost, postColor = config.color) {
    if (contentType === "sale") {
      return (
        <View style={[styles.detailSection, { borderColor: `${postColor}30` }]}>
          <Text style={styles.detailTitle}>{post.product_name}</Text>
          <Text style={styles.priceText}>R$ {formatCurrency(post.price)}</Text>
          <PaymentSummary paymentMethods={post.payment_methods} color={postColor} />
          {post.whatsapp_url ? (
            <WhatsappButton
              url={post.whatsapp_url}
              label="Falar com vendedor"
            />
          ) : null}
        </View>
      );
    }
    if (contentType === "rental") {
      const pickupPayment = getRentalPickupPayment(post);

      return (
        <View style={[styles.detailSection, { borderColor: `${postColor}30` }]}>
          <Text style={styles.detailTitle}>
            {post.vehicle_brand} {post.vehicle_model}
            {post.vehicle_year ? ` · ${post.vehicle_year}` : ""}
          </Text>
          <Text style={styles.priceText}>
            R$ {formatCurrency(post.rental_price)} /{" "}
            {getRentalPeriodicityLabel(post.rental_periodicity).toLowerCase()}
          </Text>

          

          <Text style={styles.smallDetailText}>
            {post.deposit_required
              ? `Caução: R$ ${formatCurrency(post.deposit_amount)}${post.deposit_installments ? ` · até ${post.deposit_installments}x` : ""}`
              : "Sem caução informado."}
          </Text>

          {post.deposit_paid_on_delivery ? (
            <Text style={styles.smallDetailText}>
              A primeira {pickupPayment.periodLabel} será paga na retirada.
            </Text>
          ) : (
            <Text style={styles.smallDetailText}>
              A primeira {pickupPayment.periodLabel} não foi marcada para pagamento na retirada.
            </Text>
          )}

          {/*<View style={styles.pickupPaymentBox}>
            <Text style={styles.pickupPaymentLabel}>Valor para retirar</Text>
            <Text style={styles.pickupPaymentValue}>
              R$ {formatCurrency(pickupPayment.total)}
            </Text>
            <Text style={styles.pickupPaymentDescription}>
              {pickupPayment.parts.length > 0
                ? pickupPayment.parts.join(" + ")
                : "Sem valor informado para retirada."}
            </Text>
          </View>*/}

          <PaymentSummary paymentMethods={post.payment_methods} color={postColor} />
          {post.whatsapp_url ? (
            <WhatsappButton
              url={post.whatsapp_url}
              label="Falar sobre aluguel"
            />
          ) : null}
        </View>
      );
    }
    if (contentType === "sos") {
      const isMine = String(post.user_id) === String(currentUserId);
      const hasLocation = post.latitude != null && post.longitude != null;
      const locationText =
        post.location_label ||
        (hasLocation
          ? `Lat: ${Number(post.latitude).toFixed(5)} · Long: ${Number(post.longitude).toFixed(5)}`
          : "");
      const updatingLocation = updatingLocationPostId === post.id;

      return (
        <View style={[styles.detailSection, { borderColor: `${postColor}30` }]}>
          <Text style={styles.smallDetailText}>
            Tipo:{" "}
            {post.support_type === "vehicle_breakdown"
              ? "Pane no veículo"
              : "Problema com passageiro"}
          </Text>

          {locationText ? (
            <View style={[styles.postLocationBox, { backgroundColor: `${postColor}14`, borderColor: `${postColor}30` }]}>
              <View style={[styles.postLocationIconBox, { backgroundColor: `${postColor}18`, borderColor: `${postColor}35` }]}>
                <Ionicons name="location-outline" size={18} color={postColor} />
              </View>

              <View style={styles.postLocationInfo}>
                <Text style={styles.postLocationLabel}>
                  Localização do S.O.S
                </Text>
                <Text style={styles.postLocationText}>{locationText}</Text>
              </View>
            </View>
          ) : null}

          {hasLocation ? (
            <MapButton
              latitude={Number(post.latitude)}
              longitude={Number(post.longitude)}
              color={postColor}
            />
          ) : null}

          {isMine ? (
            <View style={styles.locationActionsRow}>
              <TouchableOpacity
                activeOpacity={0.86}
                style={[styles.locationEditButton, { backgroundColor: postColor }]}
                disabled={updatingLocation}
                onPress={(event: any) => {
                  event.stopPropagation?.();
                  handleUpdatePostLocation(post);
                }}
              >
                {updatingLocation ? (
                  <ActivityIndicator color="#080808" />
                ) : (
                  <>
                    <Ionicons name="locate-outline" size={16} color="#080808" />
                    <Text style={styles.locationEditButtonText}>
                      {hasLocation
                        ? "Editar localização"
                        : "Adicionar localização"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {hasLocation ? (
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={styles.locationRemoveButton}
                  disabled={updatingLocation}
                  onPress={(event: any) => {
                    event.stopPropagation?.();
                    handleRemovePostLocation(post);
                  }}
                >
                  <Ionicons name="close" size={17} color="#F87171" />
                  <Text style={styles.locationRemoveButtonText}>Remover</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      );
    }
    if (contentType === "events") {
      return (
        <View style={[styles.detailSection, { borderColor: `${postColor}30` }]}>
          <Text style={styles.smallDetailText}>
            Início: {formatDate(post.event_at)}
          </Text>
          <Text style={styles.smallDetailText}>
            Fim: {formatDate(post.event_end_at)}
          </Text>
          <Text style={styles.smallDetailText}>
            Endereço: {post.event_address || "Não informado"}
          </Text>
        </View>
      );
    }
    if (contentType === "results" && post.result_snapshot) {
      const dashboardPeriod = getSnapshotDashboardPeriod(post.result_snapshot);

      if (dashboardPeriod) {
        return (
          <View style={styles.feedOperationalResultBox}>
            <OperationalResultCard
              period={dashboardPeriod}
              referenceDate={getSnapshotReferenceDate(post.result_snapshot)}
              summaryOverride={buildOperationalResultSummaryFromSnapshot(post.result_snapshot)}
              showDetailsButton
              detailsButtonLabel="Ver detalhes"
              cardStyle={styles.feedOperationalResultInnerCard}
            />
          </View>
        );
      }

      return <ResultSummary snapshot={post.result_snapshot} color={postColor} />;
    }

    return null;
  }


  function isModernCreateType() {
    return [
      "general",
      "sos",
      "sale",
      "rental",
      "results",
      "events",
      "electric",
    ].includes(contentType);
  }

  function getCreateModalHint() {
    if (contentType === "sos")
      return "Peça apoio rápido para motoristas próximos da sua região.";
    if (contentType === "sale")
      return "Anuncie itens para motoristas da sua região com fotos, preço e contato.";
    if (contentType === "rental")
      return "Divulgue veículos disponíveis para aluguel com regras, valor e contato.";
    if (contentType === "results")
      return "Compartilhe resultados do app com métricas e contexto do período.";
    if (contentType === "events")
      return "Cadastre eventos locais com data, horário, endereço e detalhes.";
    if (contentType === "electric")
      return "Compartilhe experiências e informações sobre elétricos e híbridos.";
    return "Compartilhe dúvidas, dicas e novidades com motoristas da sua região.";
  }

  function getCreatePublishLabel() {
    if (contentType === "sos") return "Publicar S.O.S";
    if (contentType === "sale") return "Publicar venda";
    if (contentType === "rental") return "Publicar aluguel";
    if (contentType === "results") return "Publicar resultado";
    if (contentType === "events") return "Publicar evento";
    if (contentType === "electric") return "Publicar conteúdo";
    return "Publicar";
  }

  function getCreatePublishIcon(): IconName {
    if (contentType === "sos") return "alert-circle-outline";
    if (contentType === "sale") return "pricetag-outline";
    if (contentType === "rental") return "car-sport-outline";
    if (contentType === "results") return "trophy-outline";
    if (contentType === "events") return "calendar-outline";
    if (contentType === "electric") return "flash-outline";
    return "send-outline";
  }

  function getCreatePublishTextColor() {
    return contentType === "sos" ? "#FFFFFF" : "#080808";
  }

  function getCreateImageSubtitle() {
    if (contentType === "sos")
      return "Uma foto pode ajudar a explicar o problema mais rápido.";
    if (contentType === "sale") return "Boas fotos aumentam a chance de venda.";
    if (contentType === "rental")
      return "Mostre o veículo, interior, documentos visíveis e detalhes importantes.";
    if (contentType === "results")
      return "Adicione prints ou imagens que ajudem a contextualizar o resultado.";
    if (contentType === "events")
      return "Use uma imagem do evento, local, convite ou divulgação.";
    if (contentType === "electric")
      return "Fotos de carregadores, consumo, painel ou veículo ajudam bastante.";
    return "Fotos ajudam a deixar o post mais claro e chamativo.";
  }

  function getCreateDescriptionLabel() {
    if (contentType === "sale") return "Descrição do produto";
    if (contentType === "general") return "O que você quer compartilhar?";
    if (contentType === "sos") return "Explique o que está acontecendo";
    if (contentType === "rental") return "Detalhes do aluguel";
    if (contentType === "results") return "Comentário sobre o resultado";
    if (contentType === "events") return "Descrição do evento";
    if (contentType === "electric") return "Conteúdo sobre elétricos e híbridos";
    return "Descrição";
  }

  function getCreateChevronColor() {
    if (contentType === "sos") return "#FCA5A5";
    if (contentType === "sale") return "#86EFAC";
    if (contentType === "rental") return "#93C5FD";
    if (contentType === "results") return "#FDE68A";
    if (contentType === "events") return "#DDD6FE";
    if (contentType === "electric") return "#99F6E4";
    return "#8F8A91";
  }

  function renderCreateForm() {
    return (
      <>
        {contentType === "sos" ? (
          <View style={styles.sosComposerBox}>
            <View style={styles.sosHeroCard}>
              <View style={styles.sosHeroIconBox}>
                <Ionicons name="alert-circle-outline" size={25} color="#FCA5A5" />
              </View>

              <View style={styles.sosHeroTextBox}>
                <Text style={styles.sosHeroTitle}>Pedido de apoio rápido</Text>
                <Text style={styles.sosHeroText}>
                  Use o S.O.S para situações que precisam de ajuda, orientação ou atenção de motoristas próximos.
                </Text>
              </View>
            </View>

            <View style={styles.sosSectionCard}>
              <View style={styles.sosSectionHeader}>
                <View style={styles.sosSectionIconBox}>
                  <Ionicons name="shield-checkmark-outline" size={19} color="#FCA5A5" />
                </View>

                <View style={styles.sosSectionHeaderText}>
                  <Text style={styles.sosSectionTitle}>Tipo de apoio</Text>
                  <Text style={styles.sosSectionSubtitle}>
                    Escolha a opção que melhor descreve o que está acontecendo.
                  </Text>
                </View>
              </View>

              <Options
                options={supportTypes}
                selectedId={supportType}
                onSelect={setSupportType}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.88}
              style={[
                styles.sosLocationButton,
                gettingLocation && styles.sosLocationButtonDisabled,
              ]}
              disabled={gettingLocation}
              onPress={getCurrentLocation}
            >
              <View style={styles.sosLocationButtonIcon}>
                {gettingLocation ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="locate-outline" size={20} color="#FFFFFF" />
                )}
              </View>

              <View style={styles.sosLocationButtonTextBox}>
                <Text style={styles.sosLocationButtonTitle}>
                  {supportLatitude && supportLongitude
                    ? "Atualizar localização"
                    : "Adicionar localização atual"}
                </Text>
                <Text style={styles.sosLocationButtonSubtitle}>
                  Ajuda outros motoristas a entenderem onde você precisa de apoio.
                </Text>
              </View>

              {!gettingLocation ? (
                <Ionicons name="chevron-forward" size={18} color="#FCA5A5" />
              ) : null}
            </TouchableOpacity>

            {supportLatitude && supportLongitude ? (
              <View style={styles.sosLocationCard}>
                <View style={styles.sosLocationIconBox}>
                  <Ionicons name="location-outline" size={20} color="#FCA5A5" />
                </View>

                <View style={styles.currentLocationInfo}>
                  <Text style={styles.sosLocationLabel}>Localização adicionada</Text>
                  <Text style={styles.sosLocationText}>
                    {supportLocationLabel ||
                      `Lat: ${supportLatitude.toFixed(5)} · Long: ${supportLongitude.toFixed(5)}`}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.86}
                  style={styles.sosRemoveLocationButton}
                  onPress={removeCurrentLocation}
                >
                  <Ionicons name="close" size={18} color="#FCA5A5" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}
        {contentType === "sale" ? renderSaleFields() : null}
        {contentType === "rental" ? renderRentalFields() : null}
        {contentType === "results" ? renderResultFields() : null}
        {contentType === "events" ? renderEventFields() : null}

        {contentType === "electric" ? (
          <View style={styles.electricComposerHero}>
            <View style={styles.electricComposerHeroIcon}>
              <Ionicons name="flash-outline" size={22} color="#99F6E4" />
            </View>

            <View style={styles.electricComposerHeroTextBox}>
              <Text style={styles.electricComposerHeroTitle}>
                Compartilhe sobre elétricos e híbridos
              </Text>
              <Text style={styles.electricComposerHeroText}>
                Publique consumo, carregamento, dúvidas, experiências e dicas para quem roda com esse tipo de veículo.
              </Text>
            </View>
          </View>
        ) : null}

        {contentType === "general" ? (
          <View style={styles.generalComposerHero}>
            <View style={styles.generalComposerHeroIcon}>
              <Ionicons name="chatbubbles-outline" size={22} color={config.color} />
            </View>

            <View style={styles.generalComposerHeroTextBox}>
              <Text style={styles.generalComposerHeroTitle}>
                Publique na conversa geral
              </Text>
              <Text style={styles.generalComposerHeroText}>
                Use este espaço para perguntas, alertas, experiências da rua e dicas úteis.
              </Text>
            </View>
          </View>
        ) : null}

        <View
          style={[
            isModernCreateType() && styles.generalInputCard,
            contentType === "sos" && styles.sosInputCard,
            contentType === "sale" && styles.saleDescriptionCard,
            contentType === "rental" && styles.rentalDescriptionCard,
            contentType === "results" && styles.resultsDescriptionCard,
            contentType === "events" && styles.eventsDescriptionCard,
            contentType === "electric" && styles.electricDescriptionCard,
          ]}
        >
          <View style={styles.generalInputHeaderRow}>
            <Text
              style={[
                styles.inputLabel,
                isModernCreateType() && styles.generalInputLabel,
                contentType === "sos" && styles.sosInputLabel,
                contentType === "sale" && styles.saleInputLabel,
                contentType === "rental" && styles.rentalInputLabel,
                contentType === "results" && styles.resultsInputLabel,
                contentType === "events" && styles.eventsInputLabel,
                contentType === "electric" && styles.electricInputLabel,
              ]}
            >
              {getCreateDescriptionLabel()}
            </Text>

            {isModernCreateType() ? (
              <Text
                style={[
                  styles.generalInputCounter,
                  contentType === "sos" && styles.sosInputCounter,
                  contentType === "sale" && styles.saleInputCounter,
                  contentType === "rental" && styles.rentalInputCounter,
                  contentType === "results" && styles.resultsInputCounter,
                  contentType === "events" && styles.eventsInputCounter,
                  contentType === "electric" && styles.electricInputCounter,
                ]}
              >
                {postContent.trim().length} caracteres
              </Text>
            ) : null}
          </View>

          <TextInput
            value={postContent}
            onChangeText={setPostContent}
            placeholder={getPostInputPlaceholder()}
            placeholderTextColor="#8F8A91"
            multiline
            blurOnSubmit={false}
            textAlignVertical="top"
            style={[
              styles.postInput,
              contentType === "general" && styles.generalPostInput,
              contentType === "sos" && styles.sosPostInput,
              contentType === "sale" && styles.salePostInput,
              contentType === "rental" && styles.rentalPostInput,
              contentType === "results" && styles.resultsPostInput,
              contentType === "events" && styles.eventsPostInput,
              contentType === "electric" && styles.electricPostInput,
            ]}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.86}
          style={[
            styles.imagePickerButton,
            isModernCreateType() && styles.generalImagePickerButton,
            contentType === "sos" && styles.sosImagePickerButton,
            contentType === "sale" && styles.saleImagePickerButton,
            contentType === "rental" && styles.rentalImagePickerButton,
            contentType === "results" && styles.resultsImagePickerButton,
            contentType === "events" && styles.eventsImagePickerButton,
            contentType === "electric" && styles.electricImagePickerButton,
          ]}
          onPress={pickPostImages}
        >
          <View
            style={[
              styles.generalImagePickerIconBox,
              contentType !== "general" && styles.generalImagePickerIconBoxCompact,
            ]}
          >
            <Ionicons name="images-outline" size={20} color="#D4A64A" />
          </View>

          <View style={styles.generalImagePickerTextBox}>
            <Text
              style={[
                styles.imagePickerButtonText,
                isModernCreateType() && styles.generalImagePickerTitle,
                contentType === "sos" && styles.sosImagePickerTitle,
                contentType === "sale" && styles.saleImagePickerTitle,
                contentType === "rental" && styles.rentalImagePickerTitle,
                contentType === "results" && styles.resultsImagePickerTitle,
                contentType === "events" && styles.eventsImagePickerTitle,
                contentType === "electric" && styles.electricImagePickerTitle,
              ]}
            >
              {selectedImages.length > 0
                ? `Adicionar imagem (${selectedImages.length}/6)`
                : "Adicionar imagem"}
            </Text>

            {isModernCreateType() ? (
              <Text
                style={[
                  styles.generalImagePickerSubtitle,
                  contentType === "sos" && styles.sosImagePickerSubtitle,
                  contentType === "sale" && styles.saleImagePickerSubtitle,
                  contentType === "rental" && styles.rentalImagePickerSubtitle,
                  contentType === "results" && styles.resultsImagePickerSubtitle,
                  contentType === "events" && styles.eventsImagePickerSubtitle,
                  contentType === "electric" && styles.electricImagePickerSubtitle,
                ]}
              >
                {getCreateImageSubtitle()}
              </Text>
            ) : null}
          </View>

          {isModernCreateType() ? (
            <Ionicons
              name="chevron-forward"
              size={18}
              color={getCreateChevronColor()}
            />
          ) : null}
        </TouchableOpacity>

        {selectedImages.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.selectedImagesList,
              isModernCreateType() && {
                minWidth: createImagesViewportWidth,
              },
            ]}
          >
            {selectedImages.map((uri, index) => {
              const useModernImagePreview = isModernCreateType();
              const imageWidth =
                useModernImagePreview && selectedImages.length === 1
                  ? createImagesViewportWidth
                  : useModernImagePreview
                    ? createImagePairItemWidth
                    : 140;

              return (
                <View
                  key={`${uri}-${index}`}
                  style={[
                    styles.selectedImageBox,
                    isModernCreateType() && {
                      width: imageWidth,
                    },
                  ]}
                >
                  <Image
                    source={{ uri }}
                    style={[
                      styles.selectedImage,
                      isModernCreateType() && styles.generalSelectedImage,
                    ]}
                    resizeMode="cover"
                  />

                  {isModernCreateType() ? (
                    <>
                      <View
                        style={[
                          styles.generalSelectedImageOverlay,
                          contentType === "sos" && styles.sosSelectedImageOverlay,
                          contentType === "sale" && styles.saleSelectedImageOverlay,
                          contentType === "rental" && styles.rentalSelectedImageOverlay,
                          contentType === "results" && styles.resultsSelectedImageOverlay,
                          contentType === "events" && styles.eventsSelectedImageOverlay,
                          contentType === "electric" && styles.electricSelectedImageOverlay,
                        ]}
                      />
                      <View
                        style={[
                          styles.generalSelectedImageIndexBadge,
                          contentType === "sos" && styles.sosSelectedImageIndexBadge,
                          contentType === "sale" && styles.saleSelectedImageIndexBadge,
                          contentType === "rental" && styles.rentalSelectedImageIndexBadge,
                          contentType === "results" && styles.resultsSelectedImageIndexBadge,
                          contentType === "events" && styles.eventsSelectedImageIndexBadge,
                          contentType === "electric" && styles.electricSelectedImageIndexBadge,
                        ]}
                      >
                        <Text style={styles.generalSelectedImageIndexText}>
                          {index + 1}
                        </Text>
                      </View>
                    </>
                  ) : null}

                  <TouchableOpacity
                    activeOpacity={0.86}
                    style={styles.removeImageButton}
                    onPress={() =>
                      setSelectedImages((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Ionicons name="close" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        ) : null}
      </>
    );
  }

  function renderSaleFields() {
    return (
      <View style={styles.saleComposerBox}>
        <View style={styles.saleHeroCard}>
          <View style={styles.saleHeroIconBox}>
            <Ionicons name="storefront-outline" size={24} color="#86EFAC" />
          </View>

          <View style={styles.saleHeroTextBox}>
            <Text style={styles.saleHeroTitle}>Anuncie seu item</Text>
            <Text style={styles.saleHeroText}>
              Cadastre nome, valor, formas de pagamento e contato para facilitar a negociação.
            </Text>
          </View>
        </View>

        <View style={styles.saleSectionCard}>
          <View style={styles.saleSectionHeader}>
            <View style={styles.saleSectionIconBox}>
              <Ionicons name="cube-outline" size={19} color="#86EFAC" />
            </View>

            <View style={styles.saleSectionHeaderText}>
              <Text style={styles.saleSectionTitle}>Informações do produto</Text>
              <Text style={styles.saleSectionSubtitle}>
                Use um nome claro e um preço fácil de entender.
              </Text>
            </View>
          </View>

          <Text style={styles.saleInputLabel}>Nome do produto</Text>
          <TextInput
            value={productName}
            onChangeText={setProductName}
            placeholder="Ex: Suporte para celular"
            placeholderTextColor="#7E8F85"
            style={styles.saleModernInput}
          />

          <Text style={styles.saleInputLabel}>Valor</Text>
          <View style={styles.salePriceInputBox}>
            <Text style={styles.salePriceCurrency}>R$</Text>
            <TextInput
              value={productPrice}
              onChangeText={(text) => setProductPrice(maskCurrencyInput(text))}
              placeholder="0,00"
              placeholderTextColor="#7E8F85"
              keyboardType="numeric"
              style={styles.salePriceInput}
            />
          </View>
        </View>

        <View style={styles.salePaymentCard}>
          <View style={styles.saleSectionHeader}>
            <View style={styles.saleSectionIconBox}>
              <Ionicons name="card-outline" size={19} color="#86EFAC" />
            </View>

            <View style={styles.saleSectionHeaderText}>
              <Text style={styles.saleSectionTitle}>Pagamento</Text>
              <Text style={styles.saleSectionSubtitle}>
                Marque como o comprador poderá pagar.
              </Text>
            </View>
          </View>

          <PaymentFields
            variant="sale"
            credit={paymentCredit}
            setCredit={setPaymentCredit}
            installments={paymentInstallments}
            setInstallments={setPaymentInstallments}
            debit={paymentDebit}
            setDebit={setPaymentDebit}
            pix={paymentPix}
            setPix={setPaymentPix}
            other={paymentOther}
            setOther={setPaymentOther}
            otherDescription={paymentOtherDescription}
            setOtherDescription={setPaymentOtherDescription}
          />
        </View>

        <View style={styles.saleWhatsappCard}>
          <View style={styles.saleWhatsappIconBox}>
            <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
          </View>

          <View style={styles.saleWhatsappContent}>
            <Text style={styles.saleWhatsappTitle}>WhatsApp do vendedor</Text>
            <Text style={styles.saleWhatsappSubtitle}>
              O app cria o link para o comprador chamar você direto.
            </Text>
            <TextInput
              value={whatsappUrl}
              onChangeText={setWhatsappUrl}
              placeholder="(31) 99999-9999 ou link"
              placeholderTextColor="#7E8F85"
              style={styles.saleWhatsappInput}
            />
          </View>
        </View>
      </View>
    );
  }

  function renderRentalFields() {
    return (
      <View style={styles.rentalComposerBox}>
        <View style={styles.rentalHeroCard}>
          <View style={styles.rentalHeroIconBox}>
            <Ionicons name="car-sport-outline" size={24} color="#93C5FD" />
          </View>

          <View style={styles.rentalHeroTextBox}>
            <Text style={styles.rentalHeroTitle}>Anuncie um veículo para aluguel</Text>
            <Text style={styles.rentalHeroText}>
              Informe veículo, preço, caução, forma de pagamento e contato para o interessado chamar você.
            </Text>
          </View>
        </View>

        <View style={styles.rentalSectionCard}>
          <View style={styles.rentalSectionHeader}>
            <View style={styles.rentalSectionIconBox}>
              <Ionicons name="car-outline" size={19} color="#93C5FD" />
            </View>

            <View style={styles.rentalSectionHeaderText}>
              <Text style={styles.rentalSectionTitle}>Dados do veículo</Text>
              <Text style={styles.rentalSectionSubtitle}>
                Use marca, modelo e ano para facilitar a busca.
              </Text>
            </View>
          </View>

          <Text style={styles.rentalInputLabel}>Marca</Text>
          <TextInput
            value={vehicleBrand}
            onChangeText={setVehicleBrand}
            placeholder="Ex: Hyundai"
            placeholderTextColor="#7E8DA8"
            style={styles.rentalModernInput}
          />

          <Text style={styles.rentalInputLabel}>Modelo</Text>
          <TextInput
            value={vehicleModel}
            onChangeText={setVehicleModel}
            placeholder="Ex: HB20"
            placeholderTextColor="#7E8DA8"
            style={styles.rentalModernInput}
          />

          <Text style={styles.rentalInputLabel}>Ano</Text>
          <TextInput
            value={vehicleYear}
            onChangeText={(text) =>
              setVehicleYear(text.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="Ex: 2023"
            placeholderTextColor="#7E8DA8"
            keyboardType="numeric"
            style={styles.rentalModernInput}
          />
        </View>

        <View style={styles.rentalSectionCard}>
          <View style={styles.rentalSectionHeader}>
            <View style={styles.rentalSectionIconBox}>
              <Ionicons name="cash-outline" size={19} color="#93C5FD" />
            </View>

            <View style={styles.rentalSectionHeaderText}>
              <Text style={styles.rentalSectionTitle}>Condições do aluguel</Text>
              <Text style={styles.rentalSectionSubtitle}>
                Defina período, valor, caução e regras de pagamento.
              </Text>
            </View>
          </View>

          <Text style={styles.rentalInputLabel}>
            {getRentalPeriodicityLabel(rentalPeriodicity)}
          </Text>
          <Options
            options={rentalPeriods}
            selectedId={rentalPeriodicity}
            onSelect={setRentalPeriodicity}
          />

          <Text style={styles.rentalInputLabel}>
            {getRentalPeriodicityPriceLabel(rentalPeriodicity)}
          </Text>
          <View style={styles.rentalPriceInputBox}>
            <Text style={styles.rentalPriceCurrency}>R$</Text>
            <TextInput
              value={rentalPrice}
              onChangeText={(text) => setRentalPrice(maskCurrencyInput(text))}
              placeholder="0,00"
              placeholderTextColor="#7E8DA8"
              keyboardType="numeric"
              style={styles.rentalPriceInput}
            />
          </View>

          <View style={styles.rentalToggleBox}>
            <ToggleRow
              label="Tem caução?"
              value={depositRequired}
              onValueChange={setDepositRequired}
            />

            {depositRequired ? (
              <View style={styles.rentalDepositBox}>
                <Text style={styles.rentalInputLabel}>Valor da caução</Text>
                <View style={styles.rentalPriceInputBox}>
                  <Text style={styles.rentalPriceCurrency}>R$</Text>
                  <TextInput
                    value={depositAmount}
                    onChangeText={(text) =>
                      setDepositAmount(maskCurrencyInput(text))
                    }
                    placeholder="0,00"
                    placeholderTextColor="#7E8DA8"
                    keyboardType="numeric"
                    style={styles.rentalPriceInput}
                  />
                </View>

                <Text style={styles.rentalInputLabel}>
                  Parcela a caução em até quantas vezes?
                </Text>
                <TextInput
                  value={depositInstallments}
                  onChangeText={(text) =>
                    setDepositInstallments(text.replace(/\D/g, "").slice(0, 2))
                  }
                  placeholder="Ex: 3"
                  placeholderTextColor="#7E8DA8"
                  keyboardType="numeric"
                  style={styles.rentalModernInput}
                />
              </View>
            ) : null}

            <ToggleRow
              label={`Já paga a ${getRentalPeriodicityLabel(rentalPeriodicity).toLowerCase()} na retirada?`}
              value={depositPaidOnDelivery}
              onValueChange={setDepositPaidOnDelivery}
            />
          </View>
        </View>

        <View style={styles.rentalPaymentCard}>
          <View style={styles.rentalSectionHeader}>
            <View style={styles.rentalSectionIconBox}>
              <Ionicons name="card-outline" size={19} color="#93C5FD" />
            </View>

            <View style={styles.rentalSectionHeaderText}>
              <Text style={styles.rentalSectionTitle}>Pagamento</Text>
              <Text style={styles.rentalSectionSubtitle}>
                Informe como o locatário poderá pagar.
              </Text>
            </View>
          </View>

          <PaymentFields
            variant="rental"
            credit={paymentCredit}
            setCredit={setPaymentCredit}
            installments={paymentInstallments}
            setInstallments={setPaymentInstallments}
            debit={paymentDebit}
            setDebit={setPaymentDebit}
            pix={paymentPix}
            setPix={setPaymentPix}
            other={paymentOther}
            setOther={setPaymentOther}
            otherDescription={paymentOtherDescription}
            setOtherDescription={setPaymentOtherDescription}
          />
        </View>

        <View style={styles.rentalWhatsappCard}>
          <View style={styles.rentalWhatsappIconBox}>
            <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
          </View>

          <View style={styles.rentalWhatsappContent}>
            <Text style={styles.rentalWhatsappTitle}>WhatsApp para contato</Text>
            <Text style={styles.rentalWhatsappSubtitle}>
              O interessado poderá chamar você diretamente pelo anúncio.
            </Text>
            <TextInput
              value={whatsappUrl}
              onChangeText={setWhatsappUrl}
              placeholder="(31) 99999-9999 ou link"
              placeholderTextColor="#7E8DA8"
              style={styles.rentalWhatsappInput}
            />
          </View>
        </View>
      </View>
    );
  }

  function handleSelectResultReferenceOption(option: ResultReferenceOption) {
    setResultDate(formatDateInputFromDate(option.date));
    setResultSnapshot(null);
    setPeriodExpenses([]);
    setHiddenExpenseIds([]);
    setResultTurnOptions([]);
    setSelectedResultTurnId("");

    if (resultPeriod === "turn") {
      loadResultTurnOptionsForDateValue(option.date);
    }
  }

  const handleOperationalResultLoaded = useCallback(
    (summary: any) => {
      if (resultPeriod === "turn") return;

      const referenceLabel = getResultReferenceDisplay(resultPeriod, resultDate);
      const nextSnapshot = {
        userId: currentUserId,
        period: resultPeriod,
        periodLabel: getResultPeriodLabel(resultPeriod),
        referenceDate: resultDate,
        referenceLabel,
        startDate: summary?.startDate?.toISOString?.() ?? summary?.startDate ?? null,
        endDate: summary?.endDate?.toISOString?.() ?? summary?.endDate ?? null,
        revenue: Number(summary?.revenue ?? 0),
        expenses: Number(summary?.operationalExpenses ?? 0),
        operationalExpenses: Number(summary?.operationalExpenses ?? 0),
        operationalFuelExpenses: Number(summary?.operationalFuelExpenses ?? 0),
        operationalChargingExpenses: Number(summary?.operationalChargingExpenses ?? 0),
        originalExpenses: Number(summary?.operationalExpenses ?? 0),
        profit: Number(summary?.operationalResult ?? 0),
        totalHours: Number(summary?.totalHours ?? 0),
        totalKm: Number(summary?.totalKm ?? 0),
        revenuePerHour: Number(summary?.revenuePerHour ?? 0),
        revenuePerKm: Number(summary?.revenuePerKm ?? 0),
        platformBreakdown: [],
        revenueByPeriod: [],
        expenseDetails: [],
        dailySessions: [],
        hiddenExpenseIds: [],
        loadedFromApp: true,
      };

      setResultSnapshot((currentSnapshot: any) => {
        if (
          currentSnapshot?.period === nextSnapshot.period &&
          currentSnapshot?.referenceDate === nextSnapshot.referenceDate &&
          Number(currentSnapshot?.revenue ?? 0) === nextSnapshot.revenue &&
          Number(currentSnapshot?.expenses ?? 0) === nextSnapshot.expenses &&
          Number(currentSnapshot?.profit ?? 0) === nextSnapshot.profit &&
          Number(currentSnapshot?.totalHours ?? 0) === nextSnapshot.totalHours &&
          Number(currentSnapshot?.totalKm ?? 0) === nextSnapshot.totalKm
        ) {
          return currentSnapshot;
        }

        return nextSnapshot;
      });
    },
    [currentUserId, resultDate, resultPeriod],
  );

  function renderResultReferencePicker() {
    const selectedKey = getResultReferenceOptionKey(
      resultPeriod,
      getSafeResultReferenceDate(resultDate),
    );

    return (
      <View style={styles.resultsReferenceListBox}>
        <View style={styles.resultsReferenceCarousel}>
          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.resultsReferenceArrowButton}
            onPress={() => setResultReferencePage((current) => current + 1)}
          >
            <Ionicons name="chevron-back" size={18} color="#FDE68A" />
          </TouchableOpacity>

          <View style={styles.resultsReferenceOptionsRow}>
            {resultReferenceOptions.map((option) => {
              const selected = option.key === selectedKey;

              return (
                <TouchableOpacity
                  key={option.key}
                  activeOpacity={0.88}
                  style={[
                    styles.resultsReferenceOptionCard,
                    selected && styles.resultsReferenceOptionCardActive,
                  ]}
                  onPress={() => handleSelectResultReferenceOption(option)}
                >
                  <Text
                    style={[
                      styles.resultsReferenceOptionLabel,
                      selected && styles.resultsReferenceOptionLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>

                  {option.subtitle ? (
                    <Text
                      style={[
                        styles.resultsReferenceOptionSubtitle,
                        selected && styles.resultsReferenceOptionSubtitleActive,
                      ]}
                      numberOfLines={1}
                    >
                      {option.subtitle}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            activeOpacity={0.86}
            style={[
              styles.resultsReferenceArrowButton,
              resultReferencePage === 0 && styles.resultsReferenceArrowButtonDisabled,
            ]}
            disabled={resultReferencePage === 0}
            onPress={() => setResultReferencePage((current) => Math.max(current - 1, 0))}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={resultReferencePage === 0 ? "#6B6470" : "#FDE68A"}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderSelectedOperationalResultCard() {
    if (resultPeriod === "turn") return null;

    return (
      <OperationalResultCard
        period={resultPeriod}
        referenceDate={selectedResultReferenceDate}
        onLoaded={handleOperationalResultLoaded}
      />
    );
  }

  function renderTurnResultReferenceControls(referenceTitle: string, referenceDisplay: string) {
    return (
      <>
        <Text style={styles.resultsInputLabel}>{referenceTitle}</Text>
        <View style={styles.resultsReferenceBox}>
          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.resultsReferenceButton}
            onPress={() => handleShiftResultReference(-1)}
          >
            <Ionicons name="chevron-back" size={18} color="#FDE68A" />
          </TouchableOpacity>

          <View style={styles.resultReferenceContent}>
            <Text style={styles.resultsReferenceEyebrow}>Dia selecionado</Text>
            <Text style={styles.resultsReferenceValue}>{referenceDisplay}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.resultsReferenceButton}
            onPress={() => handleShiftResultReference(1)}
          >
            <Ionicons name="chevron-forward" size={18} color="#FDE68A" />
          </TouchableOpacity>
        </View>

        <Text style={styles.resultsReferenceHint}>
          Use as setas para alterar a referência antes de carregar o resultado.
        </Text>

        <TouchableOpacity
          activeOpacity={0.88}
          style={[
            styles.resultsLoadButton,
            loadingResultPreview && styles.publishButtonDisabled,
          ]}
          disabled={loadingResultPreview}
          onPress={loadResultPreview}
        >
          {loadingResultPreview ? (
            <ActivityIndicator color="#080808" />
          ) : (
            <>
              <Ionicons name="analytics-outline" size={18} color="#080808" />
              <Text style={styles.resultsLoadButtonText}>
                Carregar resultado do aplicativo
              </Text>
            </>
          )}
        </TouchableOpacity>
      </>
    );
  }

  function renderResultsStepHeader(icon: IconName, title: string) {
    return (
      <View style={styles.resultsStepHeader}>
        <View style={styles.resultsStepIconBox}>
          <Ionicons name={icon} size={18} color="#FDE68A" />
        </View>

        <View style={styles.resultsStepHeaderText}>
          <Text style={styles.resultsStepTitle}>{title}</Text>
        </View>
      </View>
    );
  }

  function renderResultFields() {
    const isTurnResult = resultPeriod === "turn";

    return (
      <View style={styles.resultsComposerBox}>
        

        <View style={[styles.resultsSectionCard, styles.resultsStepCard]}>
          {renderResultsStepHeader("calendar-outline", "Período e referência")}

          <View style={styles.resultsPeriodTabsBox}>
            {resultPeriods.map((item) => {
              const selected = resultPeriod === item.id;

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.86}
                  style={[
                    styles.resultsPeriodOptionCard,
                    selected && styles.resultsPeriodOptionCardActive,
                  ]}
                  onPress={() => handleSelectResultPeriod(item.id)}
                >
                  <Text
                    style={[
                      styles.resultsPeriodOptionText,
                      selected && styles.resultsPeriodOptionTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.resultsReferenceArea}>
            {renderResultReferencePicker()}
          </View>

          {isTurnResult ? (
            <View style={styles.resultsTurnPickerBox}>
              <View style={styles.resultsTurnPickerHeader}>
                <View style={styles.resultsSectionIconBox}>
                  <Ionicons name="briefcase-outline" size={19} color="#FDE68A" />
                </View>

                <View style={styles.resultsSectionHeaderText}>
                  <Text style={styles.resultsSectionTitle}>Escolha o turno</Text>
                </View>
              </View>

              {loadingResultTurnOptions ? (
                <View style={styles.resultsTurnLoadingBox}>
                  <ActivityIndicator color="#FACC15" />
                  <Text style={styles.resultsTurnLoadingText}>
                    Carregando turnos do dia...
                  </Text>
                </View>
              ) : resultTurnOptions.length > 0 ? (
                <View style={styles.resultsTurnOptionsList}>
                  {resultTurnOptions.map((turn) => {
                    const selected = selectedResultTurnId === turn.id;

                    return (
                      <TouchableOpacity
                        key={turn.id}
                        activeOpacity={0.88}
                        style={[
                          styles.resultsTurnOptionCard,
                          selected && styles.resultsTurnOptionCardActive,
                        ]}
                        onPress={() => {
                          setSelectedResultTurnId(turn.id);
                          setResultSnapshot(null);
                        }}
                      >
                        <View
                          style={[
                            styles.resultsTurnOptionIcon,
                            selected && styles.resultsTurnOptionIconActive,
                          ]}
                        >
                          <Ionicons
                            name={selected ? "checkmark" : "time-outline"}
                            size={16}
                            color={selected ? "#080808" : "#FDE68A"}
                          />
                        </View>

                        <View style={styles.resultsTurnOptionInfo}>
                          <Text style={styles.resultsTurnOptionTitle}>
                            {turn.label}
                          </Text>
                          <Text style={styles.resultsTurnOptionMeta}>
                            {turn.timeLabel} · R$ {formatCurrency(turn.revenue)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.resultsTurnEmptyBox}>
                  <Ionicons name="calendar-clear-outline" size={19} color="#FDE68A" />
                  <Text style={styles.resultsTurnEmptyText}>
                    Nenhum turno encontrado no dia selecionado.
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </View>

        <View style={[styles.resultsSectionCard, styles.resultsStepCard]}>
          {renderResultsStepHeader("analytics-outline", "Resultado que será publicado")}

          {isTurnResult && periodExpenses.length > 0 ? (
            <View style={styles.resultsExpensesBox}>
              <View style={styles.resultsSectionHeader}>
                <View style={styles.resultsSectionIconBox}>
                  <Ionicons name="eye-off-outline" size={19} color="#FDE68A" />
                </View>

                <View style={styles.resultsSectionHeaderText}>
                  <Text style={styles.resultsSectionTitle}>Ocultar despesas</Text>
                  <Text style={styles.resultsSectionSubtitle}>
                    Marque despesas que não devem entrar no resultado público.
                  </Text>
                </View>
              </View>

              {periodExpenses.map((expense: any) => (
                <TouchableOpacity
                  key={expense.id}
                  activeOpacity={0.86}
                  style={styles.resultsExpenseOption}
                  onPress={() => toggleHiddenExpense(expense.id)}
                >
                  <Ionicons
                    name={
                      hiddenExpenseIds.includes(expense.id)
                        ? "checkbox"
                        : "square-outline"
                    }
                    size={20}
                    color={
                      hiddenExpenseIds.includes(expense.id)
                        ? "#FACC15"
                        : "#8F8A91"
                    }
                  />
                  <Text style={styles.expenseOptionText} numberOfLines={1}>
                    {expense.category || expense.description || "Despesa"} · R${" "}
                    {formatCurrency(expense.amount)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {isTurnResult ? (
            resultSnapshot ? (
              <View style={styles.resultsPreviewCard}>
                <ResultSummary snapshot={resultSnapshot} color="#FACC15" />
              </View>
            ) : (
              <View style={styles.resultsEmptyPreviewCard}>
                <View style={styles.resultsEmptyPreviewIcon}>
                  <Ionicons name="bar-chart-outline" size={22} color="#FDE68A" />
                </View>

                <Text style={styles.resultsEmptyPreviewTitle}>
                  Nenhum resultado carregado
                </Text>
                <Text style={styles.resultsEmptyPreviewText}>
                  Selecione um turno para carregar e conferir a prévia.
                </Text>
              </View>
            )
          ) : (
            renderSelectedOperationalResultCard()
          )}
        </View>


      </View>
    );
  }

  function renderEventFields() {
    return (
      <View style={styles.eventsComposerBox}>
        <View style={styles.eventsHeroCard}>
          <View style={styles.eventsHeroIconBox}>
            <Ionicons name="calendar-outline" size={24} color="#DDD6FE" />
          </View>

          <View style={styles.eventsHeroTextBox}>
            <Text style={styles.eventsHeroTitle}>Cadastre um evento</Text>
            <Text style={styles.eventsHeroText}>
              Informe início, fim e endereço para motoristas encontrarem o evento com facilidade.
            </Text>
          </View>
        </View>

        <View style={styles.eventsSectionCard}>
          <View style={styles.eventsSectionHeader}>
            <View style={styles.eventsSectionIconBox}>
              <Ionicons name="time-outline" size={19} color="#DDD6FE" />
            </View>

            <View style={styles.eventsSectionHeaderText}>
              <Text style={styles.eventsSectionTitle}>Data e horário</Text>
              <Text style={styles.eventsSectionSubtitle}>
                Preencha início e fim do evento.
              </Text>
            </View>
          </View>

          <Text style={styles.eventsInputLabel}>Início</Text>
          <View style={styles.eventsDoubleInputRow}>
            <TextInput
              value={eventDate}
              onChangeText={(text) => setEventDate(maskDateInput(text))}
              placeholder="dd/mm/aaaa"
              placeholderTextColor="#9586B8"
              keyboardType="numeric"
              style={[styles.eventsModernInput, styles.doubleInput]}
            />
            <TextInput
              value={eventTime}
              onChangeText={(text) => setEventTime(maskTimeInput(text))}
              placeholder="hh:mm"
              placeholderTextColor="#9586B8"
              keyboardType="numeric"
              style={[styles.eventsModernInput, styles.doubleInput]}
            />
          </View>

          <Text style={styles.eventsInputLabel}>Fim</Text>
          <View style={styles.eventsDoubleInputRow}>
            <TextInput
              value={eventEndDate}
              onChangeText={(text) => setEventEndDate(maskDateInput(text))}
              placeholder="dd/mm/aaaa"
              placeholderTextColor="#9586B8"
              keyboardType="numeric"
              style={[styles.eventsModernInput, styles.doubleInput]}
            />
            <TextInput
              value={eventEndTime}
              onChangeText={(text) => setEventEndTime(maskTimeInput(text))}
              placeholder="hh:mm"
              placeholderTextColor="#9586B8"
              keyboardType="numeric"
              style={[styles.eventsModernInput, styles.doubleInput]}
            />
          </View>
        </View>

        <View style={styles.eventsAddressCard}>
          <View style={styles.eventsAddressIconBox}>
            <Ionicons name="location-outline" size={22} color="#DDD6FE" />
          </View>

          <View style={styles.eventsAddressContent}>
            <Text style={styles.eventsAddressTitle}>Endereço do evento</Text>
            <Text style={styles.eventsAddressSubtitle}>
              Informe o local completo ou um ponto de referência.
            </Text>
            <TextInput
              value={eventAddress}
              onChangeText={setEventAddress}
              placeholder="Endereço completo do evento"
              placeholderTextColor="#9586B8"
              style={styles.eventsAddressInput}
            />
          </View>
        </View>
      </View>
    );
  }

  function getPostInputPlaceholder() {
    if (contentType === "general")
      return "Conte uma dica, faça uma pergunta ou compartilhe algo que ajude outros motoristas...";
    if (contentType === "sos")
      return "Descreva a situação com objetividade. Ex: onde você está, o que aconteceu e que tipo de apoio precisa...";
    if (contentType === "sale")
      return "Descreva o estado do produto, forma de entrega, retirada, negociação e observações importantes...";
    if (contentType === "rental")
      return "Descreva regras, documentação, caução, retirada, seguro, quilometragem e condições do aluguel...";
    if (contentType === "results")
      return "Comente o que influenciou esse resultado, estratégia usada, metas e aprendizados do período...";
    if (contentType === "events")
      return "Descreva o evento, público esperado, programação, regras e informações importantes...";
    return "Compartilhe consumo, autonomia, carregamento, custos, dúvidas ou experiências com elétricos e híbridos...";
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.86}
          onPress={() =>
            router.replace("/(private)/(tabs)/motoristas-cidade" as never)
          }
        >
          <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
        </TouchableOpacity>
        <View style={styles.headerTextContent}>
          <Text style={styles.headerEyebrow}>Área da comunidade</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {config.title}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.86}
          style={[
            styles.headerIconBox,
            {
              backgroundColor: 'rgba(212,166,74,0.12)',
              borderColor: 'rgba(212,166,74,0.28)',
            },
          ]}
          onPress={() =>
            router.replace('/(private)/(tabs)/motoristas-cidade' as never)
          }
        >
          <Ionicons name="grid-outline" size={21} color="#D4A64A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadCommunity(true)}
            tintColor="#D4A64A"
          />
        }
      >
        <View
          style={[
            styles.heroCard,
            {
              borderColor: `${config.color}45`,
            },
          ]}
        >
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />

          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.heroIconBox,
                {
                  backgroundColor: `${config.color}1F`,
                  borderColor: `${config.color}45`,
                },
              ]}
            >
              <Ionicons name={config.icon} size={24} color={config.color} />
            </View>

            <View style={styles.heroInfo}>
              <Text style={[styles.heroEyebrow, { color: config.color }]}>
                Área da comunidade
              </Text>
              <Text style={styles.heroTitle}>{config.title}</Text>
              <Text style={styles.heroText}>{config.description}</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#D4A64A" />
            <Text style={styles.loadingText}>Carregando posts...</Text>
          </View>
        ) : visiblePosts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name={config.icon} size={36} color="#8F8A91" />
            <Text style={styles.emptyTitle}>Nenhum post encontrado</Text>
            <Text style={styles.emptyText}>
              {profileImmediateRegion
                ? "Toque no botão + para criar o primeiro post da sua região."
                : "Atualize sua cidade onde mora para liberar os posts da sua região imediata."}
            </Text>
          </View>
        ) : (
          <View style={styles.postsList}>
            {visiblePosts.map((post) => renderPostCard(post))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.floatingButton}
        onPress={openCreatePostModal}
      >
        <Ionicons name="add" size={24} color="#080808" />
      </TouchableOpacity>
      {renderCreateModal()}
      {renderCommentsModal()}
      {renderImageModal()}
      <PublicUserProfileModal
        visible={Boolean(selectedPublicProfile)}
        profile={selectedPublicProfile}
        userId={String(selectedPublicProfile?.id ?? "")}
        onClose={closePublicProfileModal}
      />
    </View>
  );

  function renderPostCard(post: CommunityPost) {
    const profile = post.profile ?? {};
    const avatarUrl = getUserAvatarUrl(profile);
    const name = getUserDisplayName(profile);
    const shortName = getFirstAndLastName(profile);
    const isMine = String(post.user_id) === String(currentUserId);
    const closed = isPostClosed(post);
    const postColor = closed ? "#8F8A91" : config.color;
    const images = getPostImages(post);
    return (
      <TouchableOpacity
        key={post.id}
        activeOpacity={0.92}
        style={[
          styles.postCard,
          {
            borderColor: `${postColor}38`,
          },
          closed && styles.postCardClosed,
        ]}
        onPress={() => openCommentsModal(post)}
      >
        <View style={[styles.postCardGlow, { backgroundColor: `${postColor}14` }]} />
        <View style={[styles.postAccent, { backgroundColor: postColor }]} />

        <View style={styles.postHeader}>
          <View style={styles.postAuthorRow}>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={(event: any) => {
                event.stopPropagation?.();
                openDriverProfile(post.user_id, profile);
              }}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={[styles.avatar, { borderColor: `${postColor}55` }]}
                />
              ) : (
                <View style={[styles.avatarFallback, { borderColor: `${postColor}55` }]}>
                  <Text style={[styles.avatarFallbackText, { color: postColor }]}>
                    {name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.postAuthorInfo}
              onPress={(event: any) => {
                event.stopPropagation?.();
                openDriverProfile(post.user_id, profile);
              }}
            >
              <Text style={styles.postAuthorName} numberOfLines={1}>
                {shortName}
              </Text>
              <Text style={styles.postAuthorMeta} numberOfLines={1}>
                {getUsername(profile)} · {formatDate(post.created_at)}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={closed ? styles.closedBadge : styles.openBadge}>
            <Text
              style={closed ? styles.closedBadgeText : styles.openBadgeText}
            >
              {closed ? "Fechado" : "Aberto"}
            </Text>
          </View>
        </View>
        {post.content ? (
          <Text style={styles.postContent}>{post.content}</Text>
        ) : null}
        {renderPostDetails(post, postColor)}
        {images.length === 1 ? (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.postSingleImageWrap}
            onPress={(event: any) => {
              event.stopPropagation?.();
              openImageModal(images, 0);
            }}
          >
            <Image
              source={{ uri: images[0] }}
              style={styles.postSingleImage}
              resizeMode="cover"
            />
            <View style={styles.postImageDarkOverlay} />
          </TouchableOpacity>
        ) : images.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.postImagesList,
              { minWidth: postImagesViewportWidth },
            ]}
          >
            {images.map((imageUrl, index) => {
              const isFirstPair = index < 2;

              return (
                <TouchableOpacity
                  key={`${imageUrl}-${index}`}
                  activeOpacity={0.9}
                  style={[
                    styles.postImageWrap,
                    isFirstPair
                      ? { width: postImagePairItemWidth }
                      : styles.postImageExtraWrap,
                  ]}
                  onPress={(event: any) => {
                    event.stopPropagation?.();
                    openImageModal(images, index);
                  }}
                >
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                  <View style={styles.postImageDarkOverlay} />

                  <View style={styles.postImageIndexBadge}>
                    <Text style={styles.postImageIndexText}>{index + 1}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}
        <View style={styles.postActions}>
          <TouchableOpacity
            activeOpacity={0.86}
            style={[
              styles.postActionButton,
              {
                backgroundColor: `${postColor}14`,
                borderColor: `${postColor}2A`,
              },
              closed && styles.postActionButtonDisabled,
            ]}
            disabled={closed}
            onPress={(event: any) => {
              event.stopPropagation?.();
              handleToggleLike(post);
            }}
          >
            <Ionicons
              name={post.liked_by_me ? "heart" : "heart-outline"}
              size={20}
              color={closed ? postColor : post.liked_by_me ? "#F87171" : postColor}
            />
            <Text style={[styles.postActionText, { color: postColor }]}>
              {Number(post.likes_count ?? 0)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.86}
            style={[
              styles.postActionButton,
              {
                backgroundColor: `${postColor}14`,
                borderColor: `${postColor}2A`,
              },
            ]}
            onPress={(event: any) => {
              event.stopPropagation?.();
              openCommentsModal(post);
            }}
          >
            <Ionicons name="chatbubble-outline" size={19} color={postColor} />
            <Text style={[styles.postActionText, { color: postColor }]}>
              {Number(post.comments_count ?? 0)}
            </Text>
          </TouchableOpacity>
          {isMine ? (
            <View style={styles.ownerActions}>
              {!closed ? (
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={[styles.ownerActionButton, { borderColor: `${postColor}30` }]}
                  onPress={(event: any) => {
                    event.stopPropagation?.();
                    handleClosePost(post);
                  }}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={17}
                    color="#FACC15"
                  />
                </TouchableOpacity>
              ) : null}
              {closed && config.canRenew ? (
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={[styles.ownerActionButton, { borderColor: `${postColor}30` }]}
                  onPress={(event: any) => {
                    event.stopPropagation?.();
                    handleRenewPost(post);
                  }}
                >
                  <Ionicons name="refresh-outline" size={18} color="#22C55E" />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.ownerDeleteButton}
                onPress={(event: any) => {
                  event.stopPropagation?.();
                  handleDeletePost(post);
                }}
              >
                <Ionicons name="trash-outline" size={17} color="#F87171" />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }

  function renderCreateModal() {
    return (
      <Modal
        visible={postModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCreatePostModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.postModalCard} onTouchStart={Keyboard.dismiss}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeftModern}>
                <View
                  style={[
                    styles.createModalIconBox,
                    {
                      backgroundColor: `${config.color}18`,
                      borderColor: `${config.color}35`,
                    },
                  ]}
                >
                  <Ionicons name={config.icon} size={22} color={config.color} />
                </View>

                <View style={styles.modalHeaderText}>
                  <Text style={[styles.modalEyebrow, { color: config.color }]}>
                    Novo post
                  </Text>
                  <Text style={styles.modalTitle}>{config.title}</Text>
                  {getCreateModalHint() ? (
                    <Text style={styles.generalModalHeaderHint} numberOfLines={2}>
                      {getCreateModalHint()}
                    </Text>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.modalCloseButton}
                onPress={closeCreatePostModal}
              >
                <Ionicons name="close" size={22} color="#F5F0E6" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onTouchStart={Keyboard.dismiss}
            >
              {renderCreateForm()}
            </ScrollView>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.publishButton,
                isModernCreateType() && {
                  backgroundColor: config.color,
                  shadowColor: config.color,
                },
                savingPost && styles.publishButtonDisabled,
              ]}
              disabled={savingPost}
              onPress={handleCreatePost}
            >
              {savingPost ? (
                <ActivityIndicator color="#080808" />
              ) : (
                <>
                  <Ionicons
                    name={getCreatePublishIcon()}
                    size={20}
                    color={getCreatePublishTextColor()}
                  />
                  <Text
                    style={[
                      styles.publishButtonText,
                      contentType === "sos" && styles.publishButtonTextLight,
                    ]}
                  >
                    {getCreatePublishLabel()}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  function closeCommentsModal() {
    setCommentsModalVisible(false);
    setCommentsScrollY(0);
    setCommentsContentHeight(0);
    setCommentsLayoutHeight(0);
    resetCommentComposer();
    void stopCurrentAudioPlayer();
  }

  function renderCommentsModal() {
    const closed = selectedPost ? isPostClosed(selectedPost) : false;
    const postPreviewColor = closed ? "#8F8A91" : config.color;
    const postProfile = selectedPost?.profile ?? {};
    const postAuthorName = getFirstAndLastName(postProfile);
    const postAvatarUrl = getUserAvatarUrl(postProfile);
    const postPreviewImages = selectedPost ? getPostImages(selectedPost) : [];
    const canSendComment =
      Boolean(commentContent.trim() || commentImageUri || commentAudioUri) &&
      !savingComment &&
      !recordingCommentAudio;
    const commentsCanScroll = commentsContentHeight > commentsLayoutHeight + 24;
    const showScrollTopButton = commentsScrollY > 80;
    const showScrollBottomButton =
      commentsCanScroll &&
      commentsScrollY < commentsContentHeight - commentsLayoutHeight - 80;

    return (
      <Modal
        visible={commentsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCommentsModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={styles.commentsModalCard}
            onTouchStart={Keyboard.dismiss}
          >
            <View style={styles.chatHeader}>
              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.chatBackButton}
                onPress={closeCommentsModal}
              >
                <Ionicons name="chevron-back" size={20} color="#F5F0E6" />
                
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.chatHeaderLeft}
                onPress={() => openDriverProfileFromModal(selectedPost?.user_id, postProfile)}
              >
                {postAvatarUrl ? (
                  <Image
                    source={{ uri: postAvatarUrl }}
                    style={styles.chatHeaderAvatar}
                  />
                ) : (
                  <View style={styles.chatHeaderAvatarFallback}>
                    <Text style={styles.chatHeaderAvatarText}>
                      {postAuthorName.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={styles.chatHeaderInfo}>
                  <Text style={[styles.modalEyebrow, { color: postPreviewColor }]}>Conversa do post</Text>
                  <Text style={styles.chatHeaderName} numberOfLines={1}>
                    {postAuthorName}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.modalCloseButton}
                onPress={closeCommentsModal}
              >
                <Ionicons name="close" size={22} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={commentsScrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onTouchStart={Keyboard.dismiss}
              contentContainerStyle={styles.commentsList}
              onScroll={handleCommentsScroll}
              scrollEventThrottle={16}
              onLayout={(event: any) =>
                setCommentsLayoutHeight(Number(event?.nativeEvent?.layout?.height ?? 0))
              }
              onContentSizeChange={(_width, height) => {
                setCommentsContentHeight(Number(height ?? 0));
                scrollToCommentsEnd(80);
              }}
            >
              {selectedPost ? (
                <View style={[styles.commentPostPreview, { borderColor: `${postPreviewColor}28` }]}>
                  {closed ? (
                    <View style={styles.closedNotice}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={16}
                        color="#FACC15"
                      />
                      <Text style={styles.closedNoticeText}>
                        Este post está fechado. Você pode ver as mensagens, mas
                        não pode curtir nem responder.
                      </Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    activeOpacity={0.86}
                    style={styles.postPreviewAuthorRow}
                    onPress={() => openDriverProfileFromModal(selectedPost?.user_id, postProfile)}
                  >
                    {postAvatarUrl ? (
                      <Image
                        source={{ uri: postAvatarUrl }}
                        style={[styles.postPreviewAvatar, { borderColor: `${postPreviewColor}30` }]}
                      />
                    ) : (
                      <View style={[styles.postPreviewAvatarFallback, { borderColor: `${postPreviewColor}30` }]}>
                        <Text style={[styles.postPreviewAvatarText, { color: postPreviewColor }]}>
                          {postAuthorName.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.postPreviewAuthorInfo}>
                      <Text style={styles.postPreviewAuthorName}>
                        {postAuthorName}
                      </Text>
                      <Text style={styles.postPreviewDate}>
                        {formatDate(selectedPost.created_at)}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {selectedPost.content ? (
                    <Text style={styles.commentPostPreviewText}>
                      {selectedPost.content}
                    </Text>
                  ) : null}
                  {renderPostDetails(selectedPost)}
                  {postPreviewImages.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={[
                        styles.commentPostPreviewImagesList,
                        { minWidth: postImagesViewportWidth },
                      ]}
                    >
                      {postPreviewImages.map((imageUrl, index) => {
                        const visibleCount = Math.min(postPreviewImages.length, 3);
                        const visibleWidth =
                          visibleCount === 1
                            ? postImagesViewportWidth
                            : visibleCount === 2
                              ? postImagePairItemWidth
                              : postImageTripleItemWidth;
                        const isVisibleInCard = index < visibleCount;

                        return (
                          <TouchableOpacity
                            key={`${imageUrl}-${index}`}
                            activeOpacity={0.9}
                            style={[
                              styles.commentPostPreviewImageWrap,
                              isVisibleInCard
                                ? { width: visibleWidth }
                                : styles.commentPostPreviewImageExtraWrap,
                            ]}
                            onPress={() => openImageModal(postPreviewImages, index)}
                          >
                            <Image
                              source={{ uri: imageUrl }}
                              style={styles.commentPostPreviewImage}
                              resizeMode="cover"
                            />
                            <View style={styles.commentPostPreviewImageOverlay} />

                            {postPreviewImages.length > 1 ? (
                              <View style={styles.commentPostPreviewImageBadge}>
                                <Text style={styles.commentPostPreviewImageBadgeText}>
                                  {index + 1}
                                </Text>
                              </View>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : null}
                </View>
              ) : null}

              {loadingComments ? (
                <View style={styles.commentsLoadingBox}>
                  <ActivityIndicator color="#D4A64A" />
                  <Text style={styles.loadingText}>
                    Carregando mensagens...
                  </Text>
                </View>
              ) : comments.length === 0 ? (
                <View style={styles.commentsEmptyBox}>
                  <Ionicons
                    name="chatbubble-outline"
                    size={34}
                    color="#8F8A91"
                  />
                  <Text style={styles.emptyTitle}>Nenhuma mensagem</Text>
                  <Text style={styles.emptyText}>
                    {closed
                      ? "Este post foi fechado sem mensagens."
                      : "Seja o primeiro a responder."}
                  </Text>
                </View>
              ) : (
                comments.map((comment) => renderComment(comment))
              )}
            </ScrollView>

            {showScrollTopButton ? (
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.commentsScrollTopButton}
                onPress={() => scrollToCommentsTop()}
              >
                <Ionicons name="arrow-up" size={20} color="#080808" />
              </TouchableOpacity>
            ) : null}

            {showScrollBottomButton ? (
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.commentsScrollBottomButton}
                onPress={() => scrollToCommentsEnd(0)}
              >
                <Ionicons name="arrow-down" size={20} color="#080808" />
              </TouchableOpacity>
            ) : null}

            {closed ? (
              <View style={styles.commentClosedBox}>
                <Ionicons
                  name="lock-closed-outline"
                  size={17}
                  color="#FACC15"
                />
                <Text style={styles.commentClosedText}>
                  Post fechado para novas respostas.
                </Text>
              </View>
            ) : (
              <View style={styles.commentComposerBox}>
                {replyingToComment ? (
                  <View style={styles.replyComposerPreview}>
                    <View style={styles.replyComposerBar} />
                    <View style={styles.replyComposerInfo}>
                      <Text style={styles.replyComposerName}>
                        Respondendo{" "}
                        {getFirstAndLastName(replyingToComment.profile ?? {})}
                      </Text>
                      <Text style={styles.replyComposerText} numberOfLines={1}>
                        {getReplyPreviewText(replyingToComment)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.86}
                      onPress={() => setReplyingToComment(null)}
                    >
                      <Ionicons name="close" size={18} color="#8F8A91" />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {commentImageUri ? (
                  <View style={styles.commentMediaPreview}>
                    <Image
                      source={{ uri: commentImageUri }}
                      style={styles.commentMediaPreviewImage}
                      resizeMode="contain"
                    />
                    <View style={styles.commentMediaPreviewOverlay} />
                    <TouchableOpacity
                      activeOpacity={0.86}
                      style={styles.commentMediaRemoveButton}
                      onPress={() => setCommentImageUri("")}
                    >
                      <Ionicons name="close" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {commentAudioUri ? (
                  <View style={styles.audioComposerPreview}>
                    <Ionicons name="mic" size={18} color="#D4A64A" />
                    <Text style={styles.audioComposerText}>
                      Áudio gravado ·{" "}
                      {formatAudioDuration(commentAudioDuration)}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.86}
                      onPress={() => {
                        setCommentAudioUri("");
                        setCommentAudioDuration(0);
                      }}
                    >
                      <Ionicons name="close" size={18} color="#8F8A91" />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {recordingCommentAudio ? (
                  <View style={styles.recordingRow}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Gravando áudio...</Text>
                    <TouchableOpacity
                      activeOpacity={0.86}
                      style={styles.recordingCancelButton}
                      onPress={cancelCommentAudioRecording}
                    >
                      <Text style={styles.recordingCancelText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.86}
                      style={styles.recordingStopButton}
                      onPress={stopCommentAudioRecording}
                    >
                      <Ionicons name="stop" size={16} color="#080808" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.commentInputRow}>
                    <TouchableOpacity
                      activeOpacity={0.86}
                      style={styles.commentAttachButton}
                      disabled={savingComment}
                      onPress={pickCommentImage}
                    >
                      <Ionicons
                        name="image-outline"
                        size={21}
                        color="#D4A64A"
                      />
                    </TouchableOpacity>

                    <TextInput
                      value={commentContent}
                      onChangeText={setCommentContent}
                      placeholder="Mensagem"
                      placeholderTextColor="#8F8A91"
                      style={styles.commentInput}
                      multiline
                      blurOnSubmit={false}
                    />

                    <TouchableOpacity
                      activeOpacity={0.86}
                      style={styles.commentAttachButton}
                      disabled={savingComment || Boolean(commentAudioUri)}
                      onPress={startCommentAudioRecording}
                    >
                      <Ionicons name="mic-outline" size={21} color="#D4A64A" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.86}
                      style={[
                        styles.commentSendButton,
                        !canSendComment && styles.commentSendButtonDisabled,
                      ]}
                      disabled={!canSendComment}
                      onPress={handleCreateComment}
                    >
                      {savingComment ? (
                        <ActivityIndicator color="#080808" />
                      ) : (
                        <Ionicons name="send" size={18} color="#080808" />
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  function renderComment(comment: CommunityComment) {
    const profile = comment.profile ?? {};
    const name = getFirstAndLastName(profile);
    const avatarUrl = getUserAvatarUrl(profile);
    const isMine = comment.user_id === currentUserId;
    const audioUrl = String(comment.audio_url || "");
    const isAudioLoading = Boolean(audioUrl && loadingAudioUrl === audioUrl);
    const hasReply = Boolean(
      comment.reply_to_comment_id ||
      comment.reply_to_author_name ||
      comment.reply_to_content,
    );
    const isPlaying = Boolean(audioUrl && playingAudioUrl === audioUrl);

    return (
      <TouchableOpacity
        key={comment.id}
        activeOpacity={0.9}
        onLongPress={() => handleCommentLongPress(comment)}
        style={[styles.messageRow, isMine && styles.messageRowMine]}
      >
        {!isMine ? (
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => openDriverProfileFromModal(comment.user_id, profile)}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.messageAvatar} />
            ) : (
              <View style={styles.messageAvatarFallback}>
                <Text style={styles.messageAvatarText}>
                  {name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ) : null}

        <View
          style={[
            styles.messageBubble,
            { minWidth: messageBubbleMinWidth },
            isMine ? styles.messageBubbleMine : styles.messageBubbleOther,
          ]}
        >
          <View style={styles.messageHeaderRow}>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => openDriverProfileFromModal(comment.user_id, profile)}
            >
              <Text
                style={[
                  styles.messageAuthor,
                  isMine && styles.messageAuthorMine,
                ]}
                numberOfLines={1}
              >
                {isMine ? "Você" : name}
              </Text>
            </TouchableOpacity>
            <Text style={styles.messageDate}>
              {formatDate(comment.created_at)}
            </Text>
          </View>

          {hasReply ? (
            <View style={styles.messageReplyBox}>
              <Text style={styles.messageReplyAuthor} numberOfLines={1}>
                {comment.reply_to_author_name
                  ? getFirstAndLastName({
                      full_name: comment.reply_to_author_name,
                    })
                  : "Mensagem respondida"}
              </Text>
              <Text style={styles.messageReplyText} numberOfLines={2}>
                {comment.reply_to_content || "Mensagem"}
              </Text>
            </View>
          ) : null}

          {comment.image_url ? (
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.messageImageWrap}
              onPress={() => openImageModal([String(comment.image_url)], 0)}
            >
              <Image
                source={{ uri: comment.image_url }}
                style={styles.messageImage}
                resizeMode="cover"
              />
              <View style={styles.messageImageDarkOverlay} />
            </TouchableOpacity>
          ) : null}

          {comment.audio_url ? (
            <TouchableOpacity
              activeOpacity={0.86}
              style={[styles.messageAudioBox, isAudioLoading && styles.messageAudioBoxLoading]}
              disabled={isAudioLoading}
              onPress={() => togglePlayAudio(audioUrl)}
            >
              <View style={styles.messageAudioPlayButton}>
                {isAudioLoading ? (
                  <ActivityIndicator size="small" color="#080808" />
                ) : (
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={15}
                    color="#080808"
                  />
                )}
              </View>
              <View style={styles.messageAudioWave}>
                {Array.from({ length: 18 }).map((_, index) => (
                  <View
                    key={`audio-wave-${comment.id}-${index}`}
                    style={[
                      styles.messageAudioLine,
                      {
                        height: [12, 20, 15, 26, 18, 23][index % 6],
                        opacity: isPlaying || isAudioLoading ? 0.92 : 0.58,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.messageAudioDuration}>
                {formatAudioDuration(comment.audio_duration_seconds)}
              </Text>
            </TouchableOpacity>
          ) : null}

          {comment.content ? (
            <Text
              style={[styles.messageText, isMine && styles.messageTextMine]}
            >
              {comment.content}
            </Text>
          ) : null}
        </View>

        {isMine ? null : null}
      </TouchableOpacity>
    );
  }

  function renderImageModal() {
    return (
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.fullImageModalOverlay}>
          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.fullImageCloseButton}
            onPress={() => {
              setImageModalVisible(false);
              setFullImages([]);
              setFullImageIndex(0);
            }}
          >
            <Ionicons name="close" size={24} color="#F5F0E6" />
          </TouchableOpacity>
          {fullImages[fullImageIndex] ? (
            <Image
              source={{ uri: fullImages[fullImageIndex] }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : null}
          {fullImages.length > 1 ? (
            <View style={styles.fullImageControls}>
              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.fullImageControlButton}
                onPress={() => showNextImage("prev")}
              >
                <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
              </TouchableOpacity>
              <Text style={styles.fullImageCounter}>
                {fullImageIndex + 1}/{fullImages.length}
              </Text>
              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.fullImageControlButton}
                onPress={() => showNextImage("next")}
              >
                <Ionicons name="chevron-forward" size={24} color="#F5F0E6" />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>
    );
  }
}

function FilterButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      style={[styles.feedFilterButton, active && styles.feedFilterButtonActive]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={17} color={active ? "#080808" : "#9B969B"} />
      <Text
        style={[styles.feedFilterText, active && styles.feedFilterTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
function Options({
  options,
  selectedId,
  onSelect,
}: {
  options: { id: string; label: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryTabs}
    >
      {options.map((item) => {
        const selected = selectedId === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.86}
            style={[styles.categoryTab, selected && styles.categoryTabActive]}
            onPress={() => onSelect(item.id)}
          >
            <Text
              style={[
                styles.categoryTabText,
                selected && styles.categoryTabTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: any;
}) {
  return (
    <>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8F8A91"
        keyboardType={keyboardType}
        style={styles.input}
      />
    </>
  );
}
function MoneyInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <FormInput
      label={label}
      value={value}
      onChangeText={(text) => onChangeText(maskCurrencyInput(text))}
      placeholder="0,00"
      keyboardType="numeric"
    />
  );
}
function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? "#D4A64A" : "#71717A"}
        trackColor={{ false: "#2A2830", true: "rgba(212,166,74,0.35)" }}
      />
    </View>
  );
}
function PaymentFields(props: any) {
  const saleVariant = props.variant === "sale";
  const rentalVariant = props.variant === "rental";

  return (
    <View
      style={[
        styles.paymentBox,
        saleVariant && styles.salePaymentBoxInner,
        rentalVariant && styles.rentalPaymentBoxInner,
      ]}
    >
      <Text
        style={[
          styles.paymentTitle,
          saleVariant && styles.salePaymentTitle,
          rentalVariant && styles.rentalPaymentTitle,
        ]}
      >
        Formas de pagamento
      </Text>
      <ToggleRow
        label="Crédito"
        value={props.credit}
        onValueChange={props.setCredit}
      />
      {props.credit ? (
        <TextInput
          value={props.installments}
          onChangeText={(text) =>
            props.setInstallments(text.replace(/\D/g, "").slice(0, 2))
          }
          placeholder="Até quantas vezes?"
          placeholderTextColor="#8F8A91"
          keyboardType="numeric"
          style={styles.input}
        />
      ) : null}
      <ToggleRow
        label="Débito"
        value={props.debit}
        onValueChange={props.setDebit}
      />
      <ToggleRow label="Pix" value={props.pix} onValueChange={props.setPix} />
      <ToggleRow
        label="Outro"
        value={props.other}
        onValueChange={props.setOther}
      />
      {props.other ? (
        <TextInput
          value={props.otherDescription}
          onChangeText={props.setOtherDescription}
          placeholder="Descreva outra forma de pagamento"
          placeholderTextColor="#8F8A91"
          style={styles.input}
        />
      ) : null}
    </View>
  );
}
function PaymentSummary({
  paymentMethods,
  color = "#D4A64A",
}: {
  paymentMethods?: PaymentMethods | null;
  color?: string;
}) {
  if (!paymentMethods) return null;
  const labels = [];
  if (paymentMethods.credit)
    labels.push(
      paymentMethods.creditInstallments
        ? `Crédito até ${paymentMethods.creditInstallments}x`
        : "Crédito",
    );
  if (paymentMethods.debit) labels.push("Débito");
  if (paymentMethods.pix) labels.push("Pix");
  if (paymentMethods.other)
    labels.push(paymentMethods.otherDescription || "Outro");
  if (labels.length === 0) return null;
  return (
    <View style={styles.paymentSummary}>
      <Ionicons name="card-outline" size={15} color={color} />
      <Text style={styles.paymentSummaryText}>{labels.join(" · ")}</Text>
    </View>
  );
}
function WhatsappButton({ url, label }: { url: string; label: string }) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      style={styles.whatsappButton}
      onPress={(event: any) => {
        event.stopPropagation?.();
        Linking.openURL(url);
      }}
    >
      <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
      <Text style={styles.whatsappButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}
function MapButton({
  latitude,
  longitude,
  color = "#D4A64A",
}: {
  latitude: number;
  longitude: number;
  color?: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      style={[styles.mapButton, { backgroundColor: `${color}14`, borderColor: `${color}35` }]}
      onPress={(event: any) => {
        event.stopPropagation?.();
        Linking.openURL(
          `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
        );
      }}
    >
      <Ionicons name="location-outline" size={16} color={color} />
      <Text style={[styles.mapButtonText, { color }]}>Ver localização</Text>
    </TouchableOpacity>
  );
}
function ResultMetricCard({
  icon,
  label,
  value,
  helper,
  color = "#D4A64A",
}: {
  icon: IconName;
  label: string;
  value: string;
  helper?: string;
  color?: string;
}) {
  return (
    <View style={styles.resultSmallCard}>
      <View style={styles.resultSmallHeader}>
        <View style={styles.resultSmallIconBox}>
          <Ionicons name={icon} size={14} color={color} />
        </View>
        <Text style={styles.resultSmallLabel}>{label}</Text>
      </View>
      <Text style={styles.resultSmallValue}>{value}</Text>
      {helper ? <Text style={styles.resultSmallPercent}>{helper}</Text> : null}
    </View>
  );
}

function openResultDetails(snapshot: any) {
  router.push({
    pathname: "/(private)/(tabs)/motoristas-cidade-resultado-detalhes",
    params: {
      snapshot: safeJsonStringify(snapshot),
    },
  } as never);
}

function ResultSummary({ snapshot, color = "#D4A64A" }: { snapshot: any; color?: string }) {
  const revenue = Number(snapshot?.revenue ?? 0);
  const expenses = Number(snapshot?.expenses ?? 0);
  const profit = Number(snapshot?.profit ?? revenue - expenses);
  const totalHours = Number(snapshot?.totalHours ?? 0);
  const totalKm = Number(snapshot?.totalKm ?? 0);
  const revenuePerHour = Number(snapshot?.revenuePerHour ?? 0);
  const revenuePerKm = Number(snapshot?.revenuePerKm ?? 0);
  const hasMetrics =
    snapshot?.hasMetrics !== false &&
    (revenue > 0 || expenses > 0 || totalHours > 0 || totalKm > 0);
  const profitPercent = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
  const expensesPercent =
    revenue > 0 ? Math.round((expenses / revenue) * 100) : 0;

  return (
    <View style={styles.resultCard}>
      <View style={styles.resultTitleRow}>
        <View style={styles.resultTitleInfo}>
          <Text style={styles.resultTitle}>Resultado compartilhado</Text>
          <Text style={styles.resultReferenceText}>
            {getResultSnapshotReference(snapshot)}
          </Text>
        </View>

        <View style={styles.resultPeriodBadge}>
          <Text style={styles.resultPeriodBadgeText}>
            {getResultPeriodLabel(snapshot?.period)}
          </Text>
        </View>
      </View>

      {!hasMetrics ? (
        <View style={styles.resultNoMetricsBox}>
          <Ionicons name="image-outline" size={20} color="#FDE68A" />
          <Text style={styles.resultNoMetricsText}>
            Publicação com imagem ou comentário, sem resultado carregado do app.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.resultMainCard}>
            <View style={styles.resultMainHeader}>
              <View style={styles.resultMainIconBox}>
                <Ionicons name="trending-up-outline" size={18} color="#BBF7D0" />
              </View>
              <Text style={styles.resultMainLabel}>Lucro</Text>
            </View>
            <Text style={styles.resultMainValue}>R$ {formatCurrency(profit)}</Text>
            <Text style={styles.resultMainPercent}>
              {profitPercent}% do faturamento
            </Text>
          </View>

          <View style={styles.resultGrid}>
            <ResultMetricCard
              icon="cash-outline"
              label="Faturamento"
              value={`R$ ${formatCurrency(revenue)}`}
            />
            <ResultMetricCard
              icon="remove-circle-outline"
              label="Despesas"
              value={`R$ ${formatCurrency(expenses)}`}
              helper={`${expensesPercent}% do faturamento`}
            />
          </View>

          <View style={styles.resultGrid}>
            <ResultMetricCard
              icon="time-outline"
              label="Horas"
              value={formatHoursToHHMM(totalHours)}
            />
            <ResultMetricCard
              icon="speedometer-outline"
              label="KM"
              value={formatCurrency(totalKm).replace(",00", "")}
            />
          </View>

          <View style={styles.resultGrid}>
            <ResultMetricCard
              icon="timer-outline"
              label="Ganhos/h"
              value={`R$ ${formatCurrency(revenuePerHour)}`}
            />
            <ResultMetricCard
              icon="navigate-outline"
              label="Ganhos/km"
              value={`R$ ${formatCurrency(revenuePerKm)}`}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.resultDetailsButton}
            onPress={() => openResultDetails(snapshot)}
          >
            <Ionicons name="list-outline" size={17} color="#080808" />
            <Text style={styles.resultDetailsButtonText}>Ver detalhes</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#050505" },
  container: { flex: 1, backgroundColor: "#050505" },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 128 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 18,
    backgroundColor: "#070707",
    borderBottomWidth: 1,
    borderBottomColor: "#211D16",
    zIndex: 50,
    elevation: 50,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContent: { flex: 1, minWidth: 0 },
  headerEyebrow: {
    color: "#D4A64A",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: "#F5F0E6",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.30)",
    backgroundColor: "#101014",
    padding: 18,
    marginBottom: 14,
  },
  heroGlowOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(212,166,74,0.16)",
    right: -78,
    top: -88,
  },
  heroGlowTwo: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(34,197,94,0.08)",
    left: -70,
    bottom: -78,
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  heroIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroInfo: { flex: 1, minWidth: 0 },
  heroEyebrow: {
    color: "#D4A64A",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.3,
  },
  heroTitle: {
    color: "#F5F0E6",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.55,
    marginTop: 2,
  },
  heroText: {
    color: "#BDB5A7",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 5,
  },
  regionBox: {
    marginTop: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
    backgroundColor: "rgba(5,5,5,0.42)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  regionInfo: { flex: 1, minWidth: 0 },
  regionLabel: {
    color: "#8F8A91",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  regionValue: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },
  countRow: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  countPill: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: "rgba(212,166,74,0.10)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.20)",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  countPillText: { color: "#E8D49B", fontSize: 11, fontWeight: "900" },
  countPillGreen: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.10)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.20)",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  countPillGreenText: { color: "#86EFAC", fontSize: 11, fontWeight: "900" },
  feedFilterRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  feedFilterButton: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  feedFilterButtonActive: {
    backgroundColor: "#D4A64A",
    borderColor: "#D4A64A",
  },
  feedFilterText: { color: "#9B969B", fontSize: 12, fontWeight: "900" },
  feedFilterTextActive: { color: "#080808" },
  loadingBox: {
    minHeight: 220,
    borderRadius: 16,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingText: {
    color: "#9B969B",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 12,
  },
  emptyState: {
    minHeight: 250,
    borderRadius: 16,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  emptyTitle: {
    color: "#F5F0E6",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: "#9B969B",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    textAlign: "center",
  },
  postsList: { gap: 16 },
  postCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 26,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.18)",
    padding: 15,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  postCardGlow: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(212,166,74,0.055)",
    right: -86,
    top: -82,
  },
  postAccent: {
    position: "absolute",
    left: 0,
    top: 22,
    bottom: 22,
    width: 4,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    opacity: 0.86,
  },
  postCardClosed: { opacity: 0.74 },
  postHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  postAuthorRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.32)",
    backgroundColor: "#18171D",
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: { color: "#D4A64A", fontSize: 17, fontWeight: "900" },
  postAuthorInfo: { flex: 1, minWidth: 0 },
  postAuthorName: { color: "#F5F0E6", fontSize: 14, fontWeight: "900" },
  postAuthorMeta: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  openBadge: {
    minHeight: 27,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.10)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  openBadgeText: { color: "#86EFAC", fontSize: 10, fontWeight: "900" },
  closedBadge: {
    minHeight: 27,
    borderRadius: 999,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  closedBadgeText: { color: "#9B969B", fontSize: 10, fontWeight: "900" },
  postContent: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 12,
  },
  feedOperationalResultBox: {
    backgroundColor: "rgba(9,9,11,0.72)",
    borderColor: "rgba(250,204,21,0.18)",
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 14,
    padding: 10,
  },
  feedOperationalResultInnerCard: {
    borderColor: "rgba(250,204,21,0.20)",
  },
  detailSection: {
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 12,
    marginTop: 12,
  },
  detailTitle: { color: "#F5F0E6", fontSize: 14, fontWeight: "900" },
  priceText: {
    color: "#86EFAC",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 5,
  },
  smallDetailText: {
    color: "#D8D1C4",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  pickupPaymentBox: {
    borderRadius: 16,
    backgroundColor: "rgba(34,197,94,0.09)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.22)",
    padding: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  pickupPaymentLabel: {
    color: "#BBF7D0",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  pickupPaymentValue: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },
  pickupPaymentDescription: {
    color: "#D7E6DD",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  postLocationBox: {
    borderRadius: 14,
    backgroundColor: "rgba(212,166,74,0.08)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.18)",
    padding: 11,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  postLocationIconBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(212,166,74,0.10)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  postLocationInfo: { flex: 1, minWidth: 0 },
  postLocationLabel: { color: "#E8D49B", fontSize: 11, fontWeight: "900" },
  postLocationText: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3,
  },
  locationActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 10,
  },
  locationEditButton: {
    minHeight: 36,
    borderRadius: 12,
    backgroundColor: "#D4A64A",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  locationEditButtonText: { color: "#080808", fontSize: 12, fontWeight: "900" },
  locationRemoveButton: {
    minHeight: 36,
    borderRadius: 12,
    backgroundColor: "rgba(248,113,113,0.10)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.22)",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  locationRemoveButtonText: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "900",
  },
  whatsappButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: "#16A34A",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 10,
  },
  whatsappButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  mapButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 12,
    backgroundColor: "rgba(212,166,74,0.08)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.22)",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 9,
  },
  mapButtonText: { color: "#D4A64A", fontSize: 12, fontWeight: "900" },
  paymentSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 8,
  },
  paymentSummaryText: {
    flex: 1,
    color: "#D8D1C4",
    fontSize: 11,
    fontWeight: "800",
  },
  postSingleImageWrap: {
    position: "relative",
    overflow: "hidden",
    height: 185,
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
    marginTop: 13,
  },
  postSingleImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#18171D",
  },
  postImagesList: {
    gap: 8,
    paddingTop: 13,
    paddingRight: 4,
  },
  postImageWrap: {
    position: "relative",
    overflow: "hidden",
    height: 148,
    borderRadius: 18,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
  },
  postImageExtraWrap: {
    width: 168,
  },
  postImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#18171D",
  },
  postImageDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  postImageIndexBadge: {
    position: "absolute",
    right: 9,
    top: 9,
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "rgba(5,5,5,0.62)",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.16)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  postImageIndexText: {
    color: "#F5F0E6",
    fontSize: 10,
    fontWeight: "900",
  },
  postActions: {
    borderTopWidth: 1,
    borderTopColor: "rgba(245,240,230,0.07)",
    marginTop: 13,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  postActionButton: {
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: "rgba(212,166,74,0.08)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.16)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  postActionButtonDisabled: { opacity: 0.45 },
  postActionText: { color: "#E8D49B", fontSize: 12, fontWeight: "900" },
  ownerActions: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ownerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  ownerDeleteButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "rgba(248,113,113,0.10)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingButton: {
    position: "absolute",
    right: 20,
    bottom: 104,
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.76)",
    justifyContent: "flex-end",
  },
  postModalCard: {
    maxHeight: "92%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#0B0B0F",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.18)",
    padding: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 12,
  },
  commentsModalCard: {
    position: "relative",
    height: "100%",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: "#070707",
    borderWidth: 0,
    borderColor: "#2A2830",
    paddingHorizontal: 16,
    paddingTop: 46,
    paddingBottom: 14,
  },
  modalHeader: {
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  modalHeaderLeftModern: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  createModalIconBox: {
    width: 48,
    height: 48,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderText: { flex: 1, minWidth: 0 },
  generalModalHeaderHint: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 3,
  },
  modalEyebrow: {
    color: "#D4A64A",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  modalTitle: {
    color: "#F5F0E6",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 2,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  inputLabel: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
    marginTop: 10,
  },
  generalComposerHero: {
    borderRadius: 22,
    backgroundColor: "rgba(212,166,74,0.08)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.20)",
    padding: 13,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  generalComposerHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  generalComposerHeroTextBox: {
    flex: 1,
    minWidth: 0,
  },
  generalComposerHeroTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  generalComposerHeroText: {
    color: "#A8A1A8",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 3,
  },
  generalInputCard: {
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
    padding: 12,
  },
  generalInputHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  generalInputLabel: {
    marginTop: 0,
    marginBottom: 9,
  },
  generalInputCounter: {
    color: "#8F8A91",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 9,
  },
  sosComposerBox: {
    gap: 12,
    marginBottom: 12,
  },
  sosHeroCard: {
    borderRadius: 24,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.26)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sosHeroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "rgba(248,113,113,0.14)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  sosHeroTextBox: {
    flex: 1,
    minWidth: 0,
  },
  sosHeroTitle: {
    color: "#FEE2E2",
    fontSize: 14,
    fontWeight: "900",
  },
  sosHeroText: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 3,
  },
  sosSectionCard: {
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.18)",
    padding: 12,
  },
  sosSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  sosSectionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(248,113,113,0.12)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  sosSectionHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  sosSectionTitle: {
    color: "#FEE2E2",
    fontSize: 13,
    fontWeight: "900",
  },
  sosSectionSubtitle: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2,
  },
  sosLocationButton: {
    minHeight: 76,
    borderRadius: 22,
    backgroundColor: "rgba(239,68,68,0.14)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.32)",
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  sosLocationButtonDisabled: {
    opacity: 0.72,
  },
  sosLocationButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  sosLocationButtonTextBox: {
    flex: 1,
    minWidth: 0,
  },
  sosLocationButtonTitle: {
    color: "#FEE2E2",
    fontSize: 13,
    fontWeight: "900",
  },
  sosLocationButtonSubtitle: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 3,
  },
  sosLocationCard: {
    borderRadius: 22,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.22)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sosLocationIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(248,113,113,0.12)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  sosLocationLabel: {
    color: "#FEE2E2",
    fontSize: 11,
    fontWeight: "900",
  },
  sosLocationText: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3,
  },
  sosRemoveLocationButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(248,113,113,0.12)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.26)",
    alignItems: "center",
    justifyContent: "center",
  },
  sosInputCard: {
    borderColor: "rgba(248,113,113,0.18)",
  },
  sosInputLabel: {
    color: "#FEE2E2",
  },
  sosInputCounter: {
    color: "#FCA5A5",
  },
  saleComposerBox: {
    gap: 12,
    marginBottom: 12,
  },
  saleHeroCard: {
    borderRadius: 24,
    backgroundColor: "rgba(34,197,94,0.09)",
    borderWidth: 1,
    borderColor: "rgba(134,239,172,0.22)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  saleHeroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "rgba(34,197,94,0.13)",
    borderWidth: 1,
    borderColor: "rgba(134,239,172,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  saleHeroTextBox: { flex: 1, minWidth: 0 },
  saleHeroTitle: { color: "#DCFCE7", fontSize: 14, fontWeight: "900" },
  saleHeroText: {
    color: "#86EFAC",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 3,
  },
  saleSectionCard: {
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(134,239,172,0.18)",
    padding: 12,
  },
  saleSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  saleSectionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(134,239,172,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  saleSectionHeaderText: { flex: 1, minWidth: 0 },
  saleSectionTitle: { color: "#DCFCE7", fontSize: 13, fontWeight: "900" },
  saleSectionSubtitle: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2,
  },
  saleInputLabel: {
    color: "#DCFCE7",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 8,
  },
  saleModernInput: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: "#0B0B0F",
    borderWidth: 1,
    borderColor: "rgba(134,239,172,0.20)",
    paddingHorizontal: 13,
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "800",
  },
  salePriceInputBox: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: "rgba(34,197,94,0.08)",
    borderWidth: 1,
    borderColor: "rgba(134,239,172,0.24)",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  salePriceCurrency: { color: "#86EFAC", fontSize: 13, fontWeight: "900" },
  salePriceInput: {
    flex: 1,
    color: "#F5F0E6",
    fontSize: 20,
    fontWeight: "900",
    paddingVertical: 0,
  },
  salePaymentCard: {
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(134,239,172,0.18)",
    padding: 12,
  },
  salePaymentBoxInner: {
    marginTop: 0,
    borderRadius: 18,
    backgroundColor: "rgba(34,197,94,0.06)",
    borderColor: "rgba(134,239,172,0.18)",
  },
  salePaymentTitle: { color: "#DCFCE7" },
  saleWhatsappCard: {
    borderRadius: 22,
    backgroundColor: "rgba(34,197,94,0.08)",
    borderWidth: 1,
    borderColor: "rgba(134,239,172,0.24)",
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  saleWhatsappIconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },
  saleWhatsappContent: { flex: 1, minWidth: 0 },
  saleWhatsappTitle: { color: "#DCFCE7", fontSize: 13, fontWeight: "900" },
  saleWhatsappSubtitle: {
    color: "#86EFAC",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 9,
  },
  saleWhatsappInput: {
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: "#0B0B0F",
    borderWidth: 1,
    borderColor: "rgba(134,239,172,0.20)",
    paddingHorizontal: 12,
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "800",
  },
  saleDescriptionCard: { borderColor: "rgba(134,239,172,0.18)" },
  saleInputCounter: { color: "#86EFAC" },

  resultsTurnPickerBox: {
    borderRadius: 20,
    backgroundColor: "rgba(250,204,21,0.06)",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.18)",
    padding: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  resultsTurnLoadingBox: {
    alignItems: "center",
    backgroundColor: "#0B0B0F",
    borderColor: "rgba(253,230,138,0.16)",
    borderRadius: 15,
    borderWidth: 1,
    gap: 7,
    minHeight: 72,
    justifyContent: "center",
    marginTop: 8,
    padding: 12,
  },
  resultsTurnLoadingText: {
    color: "#B9AA7A",
    fontSize: 11,
    fontWeight: "800",
  },
  resultsTurnEmptyBox: {
    alignItems: "center",
    backgroundColor: "#0B0B0F",
    borderColor: "rgba(253,230,138,0.16)",
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 52,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  resultsTurnEmptyText: {
    color: "#B9AA7A",
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
  },
  resultsTurnPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  resultsFindTurnsButton: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#FACC15",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  resultsFindTurnsButtonText: {
    color: "#080808",
    fontSize: 12,
    fontWeight: "900",
  },
  resultsTurnOptionsList: {
    gap: 8,
    marginTop: 10,
  },
  resultsTurnOptionCard: {
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: "#0B0B0F",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.16)",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resultsTurnOptionCardActive: {
    borderColor: "rgba(250,204,21,0.60)",
    backgroundColor: "rgba(250,204,21,0.10)",
  },
  resultsTurnOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "rgba(250,204,21,0.10)",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  resultsTurnOptionIconActive: {
    backgroundColor: "#FACC15",
    borderColor: "#FACC15",
  },
  resultsTurnOptionInfo: { flex: 1, minWidth: 0 },
  resultsTurnOptionTitle: {
    color: "#FEF3C7",
    fontSize: 12,
    fontWeight: "900",
  },
  resultsTurnOptionMeta: {
    color: "#B9AA7A",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },


  rentalComposerBox: { gap: 12, marginBottom: 12 },
  rentalHeroCard: {
    borderRadius: 24,
    backgroundColor: "rgba(96,165,250,0.10)",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.24)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rentalHeroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "rgba(96,165,250,0.14)",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  rentalHeroTextBox: { flex: 1, minWidth: 0 },
  rentalHeroTitle: { color: "#DBEAFE", fontSize: 14, fontWeight: "900" },
  rentalHeroText: {
    color: "#93C5FD",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 3,
  },
  rentalSectionCard: {
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.18)",
    padding: 12,
  },
  rentalSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  rentalSectionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(96,165,250,0.12)",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  rentalSectionHeaderText: { flex: 1, minWidth: 0 },
  rentalSectionTitle: { color: "#DBEAFE", fontSize: 13, fontWeight: "900" },
  rentalSectionSubtitle: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2,
  },
  rentalInputLabel: {
    color: "#DBEAFE",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 8,
  },
  rentalModernInput: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: "#0B0B0F",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.20)",
    paddingHorizontal: 13,
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "800",
  },
  rentalPriceInputBox: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: "rgba(96,165,250,0.08)",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.24)",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rentalPriceCurrency: { color: "#93C5FD", fontSize: 13, fontWeight: "900" },
  rentalPriceInput: {
    flex: 1,
    color: "#F5F0E6",
    fontSize: 20,
    fontWeight: "900",
    paddingVertical: 0,
  },
  rentalToggleBox: {
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: "rgba(96,165,250,0.05)",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rentalDepositBox: {
    borderRadius: 18,
    backgroundColor: "#0B0B0F",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.16)",
    padding: 10,
    marginVertical: 8,
  },
  rentalPaymentCard: {
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.18)",
    padding: 12,
  },
  rentalPaymentBoxInner: {
    marginTop: 0,
    borderRadius: 18,
    backgroundColor: "rgba(96,165,250,0.06)",
    borderColor: "rgba(147,197,253,0.18)",
  },
  rentalPaymentTitle: { color: "#DBEAFE" },
  rentalWhatsappCard: {
    borderRadius: 22,
    backgroundColor: "rgba(96,165,250,0.08)",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.24)",
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  rentalWhatsappIconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#60A5FA",
    alignItems: "center",
    justifyContent: "center",
  },
  rentalWhatsappContent: { flex: 1, minWidth: 0 },
  rentalWhatsappTitle: { color: "#DBEAFE", fontSize: 13, fontWeight: "900" },
  rentalWhatsappSubtitle: {
    color: "#93C5FD",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 9,
  },
  rentalWhatsappInput: {
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: "#0B0B0F",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.20)",
    paddingHorizontal: 12,
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "800",
  },
  rentalDescriptionCard: { borderColor: "rgba(147,197,253,0.18)" },
  rentalInputCounter: { color: "#93C5FD" },
  rentalPostInput: {
    minHeight: 142,
    backgroundColor: "#0B0B0F",
    borderColor: "rgba(147,197,253,0.22)",
  },
  rentalImagePickerButton: {
    borderColor: "rgba(147,197,253,0.34)",
    backgroundColor: "rgba(96,165,250,0.07)",
  },
  rentalImagePickerTitle: { color: "#DBEAFE" },
  rentalImagePickerSubtitle: { color: "#93C5FD" },
  rentalSelectedImageOverlay: { backgroundColor: "rgba(0,0,0,0.20)" },
  rentalSelectedImageIndexBadge: {
    backgroundColor: "rgba(96,165,250,0.78)",
    borderColor: "rgba(219,234,254,0.24)",
  },

  resultsComposerBox: { gap: 10, marginBottom: 12 },
  resultsHeroCard: {
    borderRadius: 22,
    backgroundColor: "rgba(250,204,21,0.10)",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.24)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  resultsHeroIconBox: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "rgba(250,204,21,0.14)",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  resultsHeroTextBox: { flex: 1, minWidth: 0 },
  resultsHeroTitle: { color: "#FEF3C7", fontSize: 14, fontWeight: "900" },
  resultsHeroText: {
    color: "#FDE68A",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 3,
  },
  resultsSectionCard: {
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.18)",
    padding: 12,
  },
  resultsStepCard: {
    gap: 10,
  },
  resultsStepHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
  },
  resultsStepBadge: {
    alignItems: "center",
    backgroundColor: "#FACC15",
    borderRadius: 999,
    height: 25,
    justifyContent: "center",
    width: 25,
  },
  resultsStepBadgeText: {
    color: "#080808",
    fontSize: 11,
    fontWeight: "900",
  },
  resultsStepIconBox: {
    alignItems: "center",
    backgroundColor: "rgba(250,204,21,0.12)",
    borderColor: "rgba(253,230,138,0.24)",
    borderRadius: 13,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  resultsStepHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  resultsStepTitle: {
    color: "#FEF3C7",
    fontSize: 13,
    fontWeight: "900",
  },
  resultsStepSubtitle: {
    color: "#B9AA7A",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2,
  },
  resultsPeriodTabsBox: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 2,
  },
  resultsPeriodOptionCard: {
    alignItems: "center",
    backgroundColor: "#18171D",
    borderColor: "#2A2830",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 13,
  },
  resultsPeriodOptionCardActive: {
    backgroundColor: "#FACC15",
    borderColor: "#FACC15",
  },
  resultsPeriodOptionText: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "900",
  },
  resultsPeriodOptionTextActive: {
    color: "#080808",
  },
  resultsReferenceArea: {
    marginTop: 2,
  },
  resultsEmptyPreviewCard: {
    alignItems: "center",
    backgroundColor: "rgba(250,204,21,0.06)",
    borderColor: "rgba(253,230,138,0.18)",
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  resultsEmptyPreviewIcon: {
    alignItems: "center",
    backgroundColor: "rgba(250,204,21,0.12)",
    borderColor: "rgba(253,230,138,0.24)",
    borderRadius: 15,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    marginBottom: 9,
    width: 40,
  },
  resultsEmptyPreviewTitle: {
    color: "#FEF3C7",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  resultsEmptyPreviewText: {
    color: "#B9AA7A",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 4,
    textAlign: "center",
  },
  resultsContextHintCard: {
    alignItems: "center",
    backgroundColor: "rgba(250,204,21,0.07)",
    borderColor: "rgba(253,230,138,0.20)",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  resultsContextHintIcon: {
    alignItems: "center",
    backgroundColor: "rgba(250,204,21,0.12)",
    borderColor: "rgba(253,230,138,0.24)",
    borderRadius: 14,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  resultsContextHintTextBox: {
    flex: 1,
    minWidth: 0,
  },
  resultsContextHintTitle: {
    color: "#FEF3C7",
    fontSize: 13,
    fontWeight: "900",
  },
  resultsContextHintText: {
    color: "#B9AA7A",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2,
  },
  resultsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  resultsSectionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(250,204,21,0.12)",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  resultsSectionHeaderText: { flex: 1, minWidth: 0 },
  resultsSectionTitle: { color: "#FEF3C7", fontSize: 13, fontWeight: "900" },
  resultsSectionSubtitle: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2,
  },
  resultsInputLabel: {
    color: "#FEF3C7",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 8,
  },
  resultsReferenceBox: {
    borderRadius: 18,
    backgroundColor: "rgba(250,204,21,0.08)",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.22)",
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resultsReferenceButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#0B0B0F",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  resultsReferenceEyebrow: {
    color: "#FDE68A",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  resultsReferenceValue: {
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 3,
    textTransform: "capitalize",
  },
  resultsReferenceHint: {
    color: "#B9AA7A",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginBottom: 10,
  },
  resultsLoadButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#FACC15",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 8,
  },
  resultsLoadButtonText: { color: "#080808", fontSize: 13, fontWeight: "900" },
  resultsExpensesBox: {
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.18)",
    padding: 12,
  },
  resultsExpenseOption: {
    minHeight: 40,
    borderRadius: 13,
    backgroundColor: "rgba(250,204,21,0.05)",
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  resultsPreviewCard: {
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.18)",
    padding: 1,
  },
  resultsDescriptionCard: { borderColor: "rgba(253,230,138,0.18)" },
  resultsInputCounter: { color: "#FDE68A" },
  resultsPostInput: {
    minHeight: 136,
    backgroundColor: "#0B0B0F",
    borderColor: "rgba(253,230,138,0.22)",
  },
  resultsImagePickerButton: {
    borderColor: "rgba(253,230,138,0.34)",
    backgroundColor: "rgba(250,204,21,0.07)",
  },
  resultsImagePickerTitle: { color: "#FEF3C7" },
  resultsImagePickerSubtitle: { color: "#FDE68A" },
  resultsSelectedImageOverlay: { backgroundColor: "rgba(0,0,0,0.18)" },
  resultsSelectedImageIndexBadge: {
    backgroundColor: "rgba(250,204,21,0.78)",
    borderColor: "rgba(254,243,199,0.24)",
  },
  resultsReferenceListBox: {
    gap: 9,
  },
  resultsReferenceCarousel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  resultsReferenceArrowButton: {
    width: 32,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#0B0B0F",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  resultsReferenceArrowButtonDisabled: {
    opacity: 0.45,
  },
  resultsReferenceOptionsRow: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
  },
  resultsReferenceOptionCard: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "rgba(250,204,21,0.06)",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.18)",
    paddingHorizontal: 4,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  resultsReferenceOptionCardActive: {
    backgroundColor: "rgba(250,204,21,0.18)",
    borderColor: "rgba(253,230,138,0.55)",
  },
  resultsReferenceOptionLabel: {
    color: "#F5F0E6",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "capitalize",
  },
  resultsReferenceOptionLabelActive: {
    color: "#FEF3C7",
  },
  resultsReferenceOptionSubtitle: {
    color: "#B9AA7A",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 3,
    textAlign: "center",
    textTransform: "capitalize",
  },
  resultsReferenceOptionSubtitleActive: {
    color: "#FDE68A",
  },

  eventsComposerBox: { gap: 12, marginBottom: 12 },
  eventsHeroCard: {
    borderRadius: 24,
    backgroundColor: "rgba(167,139,250,0.10)",
    borderWidth: 1,
    borderColor: "rgba(221,214,254,0.24)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  eventsHeroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "rgba(167,139,250,0.14)",
    borderWidth: 1,
    borderColor: "rgba(221,214,254,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  eventsHeroTextBox: { flex: 1, minWidth: 0 },
  eventsHeroTitle: { color: "#EDE9FE", fontSize: 14, fontWeight: "900" },
  eventsHeroText: {
    color: "#DDD6FE",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 3,
  },
  eventsSectionCard: {
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(221,214,254,0.18)",
    padding: 12,
  },
  eventsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  eventsSectionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(167,139,250,0.12)",
    borderWidth: 1,
    borderColor: "rgba(221,214,254,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  eventsSectionHeaderText: { flex: 1, minWidth: 0 },
  eventsSectionTitle: { color: "#EDE9FE", fontSize: 13, fontWeight: "900" },
  eventsSectionSubtitle: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2,
  },
  eventsInputLabel: {
    color: "#EDE9FE",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 8,
  },
  eventsDoubleInputRow: { flexDirection: "row", gap: 8 },
  eventsModernInput: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: "#0B0B0F",
    borderWidth: 1,
    borderColor: "rgba(221,214,254,0.20)",
    paddingHorizontal: 13,
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "800",
  },
  eventsAddressCard: {
    borderRadius: 22,
    backgroundColor: "rgba(167,139,250,0.08)",
    borderWidth: 1,
    borderColor: "rgba(221,214,254,0.24)",
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  eventsAddressIconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(167,139,250,0.18)",
    borderWidth: 1,
    borderColor: "rgba(221,214,254,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  eventsAddressContent: { flex: 1, minWidth: 0 },
  eventsAddressTitle: { color: "#EDE9FE", fontSize: 13, fontWeight: "900" },
  eventsAddressSubtitle: {
    color: "#DDD6FE",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 9,
  },
  eventsAddressInput: {
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: "#0B0B0F",
    borderWidth: 1,
    borderColor: "rgba(221,214,254,0.20)",
    paddingHorizontal: 12,
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "800",
  },
  eventsDescriptionCard: { borderColor: "rgba(221,214,254,0.18)" },
  eventsInputCounter: { color: "#DDD6FE" },
  eventsPostInput: {
    minHeight: 136,
    backgroundColor: "#0B0B0F",
    borderColor: "rgba(221,214,254,0.22)",
  },
  eventsImagePickerButton: {
    borderColor: "rgba(221,214,254,0.34)",
    backgroundColor: "rgba(167,139,250,0.07)",
  },
  eventsImagePickerTitle: { color: "#EDE9FE" },
  eventsImagePickerSubtitle: { color: "#DDD6FE" },
  eventsSelectedImageOverlay: { backgroundColor: "rgba(0,0,0,0.18)" },
  eventsSelectedImageIndexBadge: {
    backgroundColor: "rgba(167,139,250,0.78)",
    borderColor: "rgba(237,233,254,0.24)",
  },

  electricComposerHero: {
    borderRadius: 24,
    backgroundColor: "rgba(45,212,191,0.10)",
    borderWidth: 1,
    borderColor: "rgba(153,246,228,0.24)",
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  electricComposerHeroIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "rgba(45,212,191,0.14)",
    borderWidth: 1,
    borderColor: "rgba(153,246,228,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  electricComposerHeroTextBox: { flex: 1, minWidth: 0 },
  electricComposerHeroTitle: { color: "#CCFBF1", fontSize: 14, fontWeight: "900" },
  electricComposerHeroText: {
    color: "#99F6E4",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 3,
  },
  electricInputLabel: {
    color: "#CCFBF1",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 8,
  },
  electricDescriptionCard: { borderColor: "rgba(153,246,228,0.18)" },
  electricInputCounter: { color: "#99F6E4" },
  electricPostInput: {
    minHeight: 148,
    backgroundColor: "#0B0B0F",
    borderColor: "rgba(153,246,228,0.22)",
  },
  electricImagePickerButton: {
    borderColor: "rgba(153,246,228,0.34)",
    backgroundColor: "rgba(45,212,191,0.07)",
  },
  electricImagePickerTitle: { color: "#CCFBF1" },
  electricImagePickerSubtitle: { color: "#99F6E4" },
  electricSelectedImageOverlay: { backgroundColor: "rgba(0,0,0,0.18)" },
  electricSelectedImageIndexBadge: {
    backgroundColor: "rgba(45,212,191,0.78)",
    borderColor: "rgba(204,251,241,0.24)",
  },

  resultReferenceBox: {
    borderRadius: 16,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resultReferenceButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  resultReferenceContent: { flex: 1, minWidth: 0 },
  resultReferenceEyebrow: {
    color: "#D4A64A",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  resultReferenceValue: {
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 3,
    textTransform: "capitalize",
  },
  resultReferenceHint: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginBottom: 10,
  },
  categoryTabs: { gap: 8, paddingBottom: 10 },
  categoryTab: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  categoryTabActive: { backgroundColor: "#D4A64A", borderColor: "#D4A64A" },
  categoryTabText: { color: "#9B969B", fontSize: 12, fontWeight: "900" },
  categoryTabTextActive: { color: "#080808" },
  input: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 13,
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "700",
  },
  doubleInputRow: { flexDirection: "row", gap: 8 },
  doubleInput: { flex: 1 },
  postInput: {
    minHeight: 126,
    borderRadius: 16,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 13,
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  generalPostInput: {
    minHeight: 154,
    borderRadius: 18,
    backgroundColor: "#0B0B0F",
    borderColor: "rgba(212,166,74,0.20)",
    padding: 14,
    fontSize: 14,
    lineHeight: 21,
  },
  sosPostInput: {
    minHeight: 146,
    backgroundColor: "#0B0B0F",
    borderColor: "rgba(248,113,113,0.22)",
  },
  salePostInput: {
    minHeight: 142,
    backgroundColor: "#0B0B0F",
    borderColor: "rgba(134,239,172,0.22)",
  },
  goldButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#D4A64A",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 10,
  },
  goldButtonText: { color: "#080808", fontSize: 13, fontWeight: "900" },
  currentLocationBox: {
    borderRadius: 16,
    backgroundColor: "rgba(212,166,74,0.08)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.20)",
    padding: 12,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  currentLocationIconBox: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "rgba(212,166,74,0.10)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  currentLocationInfo: { flex: 1, minWidth: 0 },
  currentLocationLabel: { color: "#E8D49B", fontSize: 11, fontWeight: "900" },
  currentLocationText: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3,
  },
  removeLocationButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(248,113,113,0.10)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePickerButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "rgba(212,166,74,0.08)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.22)",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 12,
  },
  generalImagePickerButton: {
    minHeight: 72,
    borderRadius: 22,
    backgroundColor: "#101014",
    borderStyle: "dashed",
    borderColor: "rgba(212,166,74,0.34)",
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  sosImagePickerButton: {
    borderColor: "rgba(248,113,113,0.34)",
    backgroundColor: "rgba(239,68,68,0.07)",
  },
  saleImagePickerButton: {
    borderColor: "rgba(134,239,172,0.34)",
    backgroundColor: "rgba(34,197,94,0.07)",
  },
  generalImagePickerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  generalImagePickerIconBoxCompact: {
    width: 0,
    height: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  generalImagePickerTextBox: {
    flex: 1,
    minWidth: 0,
  },
  imagePickerButtonText: { color: "#D4A64A", fontSize: 13, fontWeight: "900" },
  generalImagePickerTitle: {
    color: "#E8D49B",
    fontSize: 13,
  },
  sosImagePickerTitle: {
    color: "#FEE2E2",
  },
  saleImagePickerTitle: {
    color: "#DCFCE7",
  },
  generalImagePickerSubtitle: {
    color: "#8F8A91",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 3,
  },
  sosImagePickerSubtitle: {
    color: "#FCA5A5",
  },
  saleImagePickerSubtitle: {
    color: "#86EFAC",
  },
  selectedImagesList: {
    gap: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedImageBox: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
  },
  selectedImage: {
    width: 140,
    height: 120,
    borderRadius: 16,
    backgroundColor: "#18171D",
  },
  generalSelectedImage: {
    width: "100%",
    height: 138,
    borderRadius: 18,
    backgroundColor: "#050505",
  },
  generalSelectedImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  sosSelectedImageOverlay: {
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  saleSelectedImageOverlay: {
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  generalSelectedImageIndexBadge: {
    position: "absolute",
    left: 9,
    top: 9,
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "rgba(5,5,5,0.68)",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.16)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  sosSelectedImageIndexBadge: {
    backgroundColor: "rgba(239,68,68,0.78)",
    borderColor: "rgba(254,226,226,0.24)",
  },
  saleSelectedImageIndexBadge: {
    backgroundColor: "rgba(34,197,94,0.78)",
    borderColor: "rgba(220,252,231,0.24)",
  },
  generalSelectedImageIndexText: {
    color: "#F5F0E6",
    fontSize: 10,
    fontWeight: "900",
  },
  removeImageButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentBox: {
    borderRadius: 16,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 12,
    marginTop: 10,
  },
  paymentTitle: { color: "#F5F0E6", fontSize: 13, fontWeight: "900" },
  toggleRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleLabel: { color: "#D8D1C4", fontSize: 12, fontWeight: "800" },
  expensesBox: {
    borderRadius: 16,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 12,
    marginTop: 12,
  },
  expensesTitle: { color: "#F5F0E6", fontSize: 13, fontWeight: "900" },
  expenseOption: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  expenseOptionText: {
    flex: 1,
    color: "#D8D1C4",
    fontSize: 12,
    fontWeight: "700",
  },
  resultCard: {
    borderRadius: 16,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    padding: 12,
    marginTop: 12,
  },
  resultTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  resultTitleInfo: { flex: 1, minWidth: 0 },
  resultReferenceText: {
    color: "#B9AA7A",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  resultPeriodBadge: {
    borderRadius: 999,
    backgroundColor: "rgba(250,204,21,0.12)",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.24)",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  resultPeriodBadgeText: {
    color: "#FDE68A",
    fontSize: 10,
    fontWeight: "900",
  },
  resultNoMetricsBox: {
    minHeight: 58,
    borderRadius: 15,
    backgroundColor: "rgba(250,204,21,0.08)",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.18)",
    padding: 11,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  resultNoMetricsText: {
    flex: 1,
    color: "#FDE68A",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
  },
  resultTitle: { color: "#F5F0E6", fontSize: 13, fontWeight: "900" },
  resultMainCard: {
    borderRadius: 15,
    backgroundColor: "#052E16",
    borderWidth: 1,
    borderColor: "#166534",
    padding: 12,
    marginTop: 10,
  },
  resultMainHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultMainIconBox: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "rgba(187,247,208,0.10)",
    borderWidth: 1,
    borderColor: "rgba(187,247,208,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  resultMainLabel: { color: "#BBF7D0", fontSize: 11, fontWeight: "800" },
  resultMainValue: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 8,
  },
  resultMainPercent: {
    color: "#86EFAC",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  resultGrid: { flexDirection: "row", gap: 8, marginTop: 8 },
  resultSmallCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 10,
  },
  resultSmallHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  resultSmallIconBox: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: "rgba(212,166,74,0.09)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  resultSmallLabel: {
    flex: 1,
    color: "#9B969B",
    fontSize: 10,
    fontWeight: "800",
  },
  resultSmallValue: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 7,
  },
  resultSmallPercent: {
    color: "#FACC15",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  resultDetailsButton: {
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: "#D4A64A",
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  resultDetailsButtonText: {
    color: "#080808",
    fontSize: 12,
    fontWeight: "900",
  },
  publishButton: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: "#D4A64A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 16,
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 13,
    elevation: 8,
  },
  publishButtonDisabled: { opacity: 0.72 },
  publishButtonText: { color: "#080808", fontSize: 14, fontWeight: "900" },
  publishButtonTextLight: { color: "#FFFFFF" },
  commentsList: { paddingBottom: 14, gap: 10 },
  commentPostPreview: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 13,
    marginBottom: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  closedNotice: {
    borderRadius: 13,
    backgroundColor: "rgba(250,204,21,0.08)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.18)",
    padding: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  closedNoticeText: {
    flex: 1,
    color: "#FDE68A",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
  },
  postPreviewAuthorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  postPreviewAvatar: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
  },
  postPreviewAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  postPreviewAvatarText: { color: "#D4A64A", fontSize: 14, fontWeight: "900" },
  postPreviewAuthorInfo: { flex: 1 },
  postPreviewAuthorName: { color: "#F5F0E6", fontSize: 13, fontWeight: "900" },
  postPreviewDate: {
    color: "#8F8A91",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  commentPostPreviewText: {
    color: "#D8D1C4",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 10,
  },
  commentPostPreviewImagesList: {
    gap: 8,
    paddingTop: 12,
    paddingRight: 4,
  },
  commentPostPreviewImageWrap: {
    position: "relative",
    overflow: "hidden",
    height: 118,
    borderRadius: 16,
    backgroundColor: "#050505",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
  },
  commentPostPreviewImageExtraWrap: {
    width: 138,
  },
  commentPostPreviewImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#050505",
  },
  commentPostPreviewImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  commentPostPreviewImageBadge: {
    position: "absolute",
    right: 7,
    top: 7,
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "rgba(5,5,5,0.66)",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.14)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  commentPostPreviewImageBadgeText: {
    color: "#F5F0E6",
    fontSize: 9,
    fontWeight: "900",
  },
  commentsLoadingBox: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  commentsEmptyBox: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  chatHeader: {
    minHeight: 60,
    borderRadius: 20,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  chatBackButton: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  chatBackButtonText: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "900",
  },
  chatHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  chatHeaderAvatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#18171D",
  },
  chatHeaderAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeaderAvatarText: { color: "#D4A64A", fontSize: 15, fontWeight: "900" },
  chatHeaderInfo: { flex: 1, minWidth: 0 },
  chatHeaderName: {
    color: "#F5F0E6",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginVertical: 3,
    paddingRight: 34,
  },
  messageRowMine: {
    justifyContent: "flex-end",
    paddingRight: 0,
    paddingLeft: 0,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#18171D",
  },
  messageAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  messageAvatarFallbackMine: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  messageAvatarText: { color: "#D4A64A", fontSize: 12, fontWeight: "900" },
  messageAvatarTextMine: { color: "#86EFAC", fontSize: 12, fontWeight: "900" },
  messageBubble: { maxWidth: "88%", borderRadius: 18, padding: 10 },
  messageBubbleOther: {
    backgroundColor: "#202C33",
    borderTopLeftRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  messageBubbleMine: {
    backgroundColor: "#075E54",
    borderTopRightRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(134,239,172,0.12)",
  },
  messageHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 3,
  },
  messageAuthor: {
    flexShrink: 1,
    color: "#D4A64A",
    fontSize: 11,
    fontWeight: "900",
  },
  messageAuthorMine: { color: "#BBF7D0" },
  messageDate: {
    color: "rgba(245,240,230,0.52)",
    fontSize: 9,
    fontWeight: "800",
  },
  messageText: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 3,
  },
  messageTextMine: { color: "#FFFFFF" },
  messageReplyBox: {
    borderLeftWidth: 3,
    borderLeftColor: "#D4A64A",
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 10,
    padding: 8,
    marginBottom: 7,
  },
  messageReplyAuthor: { color: "#E8D49B", fontSize: 10, fontWeight: "900" },
  messageReplyText: {
    color: "rgba(245,240,230,0.74)",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    lineHeight: 15,
  },
  messageImageWrap: {
    position: "relative",
    overflow: "hidden",
    alignSelf: "stretch",
    width: "100%",
    height: 154,
    borderRadius: 15,
    backgroundColor: "#050505",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
    marginTop: 7,
  },
  messageImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#050505",
  },
  messageImageDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  messageAudioBox: {
    minWidth: 210,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.20)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 9,
    marginTop: 6,
  },
  messageAudioBoxLoading: {
    opacity: 0.82,
  },
  messageAudioPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
  },
  messageAudioWave: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 3,
  },
  messageAudioLine: {
    flex: 1,
    maxWidth: 5,
    minWidth: 3,
    borderRadius: 999,
    backgroundColor: "rgba(245,240,230,0.62)",
  },
  messageAudioDuration: { color: "#F5F0E6", fontSize: 11, fontWeight: "900" },
  commentsScrollTopButton: {
    position: "absolute",
    top: 118,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#D4A64A",
    borderWidth: 2,
    borderColor: "#070707",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  commentsScrollBottomButton: {
    position: "absolute",
    right: 24,
    bottom: 92,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#D4A64A",
    borderWidth: 2,
    borderColor: "#070707",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  commentComposerBox: {
    borderTopWidth: 1,
    borderTopColor: "rgba(245,240,230,0.08)",
    paddingTop: 10,
    gap: 8,
  },
  replyComposerPreview: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  replyComposerBar: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 999,
    backgroundColor: "#D4A64A",
  },
  replyComposerInfo: { flex: 1, minWidth: 0 },
  replyComposerName: { color: "#E8D49B", fontSize: 11, fontWeight: "900" },
  replyComposerText: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  commentMediaPreview: {
    alignSelf: "flex-start",
    position: "relative",
    overflow: "hidden",
    width: 96,
    height: 78,
    borderRadius: 16,
    backgroundColor: "#050505",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
  },
  commentMediaPreviewImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#050505",
  },
  commentMediaPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  commentMediaRemoveButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.70)",
    alignItems: "center",
    justifyContent: "center",
  },
  audioComposerPreview: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  audioComposerText: {
    flex: 1,
    color: "#D8D1C4",
    fontSize: 12,
    fontWeight: "800",
  },
  recordingRow: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "rgba(248,113,113,0.10)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.24)",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordingDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#F87171",
  },
  recordingText: { flex: 1, color: "#FCA5A5", fontSize: 12, fontWeight: "900" },
  recordingCancelButton: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: "#18171D",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingCancelText: { color: "#FCA5A5", fontSize: 11, fontWeight: "900" },
  recordingStopButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#FCA5A5",
    alignItems: "center",
    justifyContent: "center",
  },
  commentInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  commentAttachButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  commentInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 118,
    borderRadius: 18,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 13,
    paddingTop: 11,
    paddingBottom: 10,
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "700",
  },
  commentSendButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
  },
  commentSendButtonDisabled: { opacity: 0.45 },
  commentClosedBox: {
    borderTopWidth: 1,
    borderTopColor: "#2A2830",
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentClosedText: { color: "#FDE68A", fontSize: 12, fontWeight: "800" },
  fullImageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullImageCloseButton: {
    position: "absolute",
    top: 48,
    right: 18,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(24,23,29,0.92)",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  fullImage: { width: "100%", height: "100%" },
  fullImageControls: {
    position: "absolute",
    bottom: 46,
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fullImageControlButton: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "rgba(24,23,29,0.92)",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  fullImageCounter: { color: "#F5F0E6", fontSize: 13, fontWeight: "900" },
});

