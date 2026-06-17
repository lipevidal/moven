import { supabase } from '../../../database/supabase';

export async function reportUser(reportedId: string, reason?: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuário não encontrado.');

  const { error } = await supabase.from('user_reports').insert({
    reporter_id: user.id,
    reported_id: reportedId,
    reason: reason ?? null,
  });

  if (error) throw error;
}