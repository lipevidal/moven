import { SupabaseClient } from "@supabase/supabase-js";

export type CommunityPostPayload = {
  user_id: string;
  city?: string | null;
  content_type: string;
  category?: string | null;
  scope?: string | null;
  status?: string | null;
  content?: string | null;
  image_url?: string | null;
  images?: string[];
  expires_at?: string | null;
  support_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  product_name?: string | null;
  price?: number | null;
  payment_methods?: Record<string, unknown> | null;
  whatsapp_url?: string | null;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
  rental_periodicity?: string | null;
  rental_price?: number | null;
  deposit_required?: boolean | null;
  deposit_amount?: number | null;
  deposit_installments?: number | null;
  deposit_paid_on_delivery?: boolean | null;
  event_at?: string | null;
  event_end_at?: string | null;
  event_address?: string | null;
  result_period_type?: string | null;
  result_period_key?: string | null;
  result_period_start?: string | null;
  result_period_end?: string | null;
  result_snapshot?: Record<string, unknown> | null;
  hidden_expense_ids?: string[];
};

export type CreateCommunityPostParams = {
  supabase: SupabaseClient;
  payload: CommunityPostPayload;
};

export async function createCommunityPost({
  supabase,
  payload,
}: CreateCommunityPostParams) {
  if (!payload.user_id) {
    throw new Error("Usuário não encontrado.");
  }

  if (!payload.content_type) {
    throw new Error("Tipo de conteúdo não informado.");
  }

  const normalizedPayload: CommunityPostPayload = {
    ...payload,
    status: payload.status ?? "open",
    content: payload.content?.trim() || null,
    images: payload.images ?? [],
    image_url: payload.image_url ?? payload.images?.[0] ?? null,
    expires_at: payload.expires_at ?? null,
  };

  const { error } = await supabase
    .from("community_posts")
    .insert(normalizedPayload);

  if (error) {
    throw error;
  }

  return normalizedPayload;
}

export default createCommunityPost;
