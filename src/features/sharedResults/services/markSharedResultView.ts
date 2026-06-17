import { supabase } from '../../../database/supabase';

export async function markSharedResultView(sharedResultId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from('shared_result_views')
    .upsert(
      {
        shared_result_id: sharedResultId,
        user_id: user.id,
      },
      {
        onConflict: 'shared_result_id,user_id',
      },
    );
}