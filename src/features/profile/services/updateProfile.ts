import { supabase } from '../../../database/supabase';

type UpdateProfileParams = {
  full_name?: string;
  phone?: string;
  avatar_url?: string | null;
  default_municipality_id?: string | null;
  notification_goals?: boolean;
  notification_revision?: boolean;
  notification_ipva?: boolean;
  notification_community?: boolean;
  notification_news?: boolean;
  show_in_community?: boolean;
  allow_private_messages?: boolean;
  show_avatar?: boolean;
  share_statistics?: boolean;
  bio?: string | null;
};

export async function updateProfile(params: UpdateProfileParams) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuário não encontrado.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(params)
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;

  return data;
}