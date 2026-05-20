import { supabase } from '../../../database/supabase';

type UpdateSessionKmParams = {
  session_id: string;
  end_km: number;
};

export async function updateSessionKm({
  session_id,
  end_km,
}: UpdateSessionKmParams) {
  const { data, error } = await supabase
    .from('work_sessions')
    .update({
      end_km,
    })
    .eq('id', session_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}