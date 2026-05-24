import { supabase } from '../../../database/supabase';

export async function toggleUserPlatform(platformId: string, selected: boolean) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuário não autenticado.');

  if (selected) {
    const { error } = await supabase
      .from('user_platforms')
      .upsert(
        {
          user_id: user.id,
          platform_id: platformId,
          is_active: true,
        },
        {
          onConflict: 'user_id,platform_id',
        },
      );

    if (error) throw error;

    return true;
  }

  const { error } = await supabase
    .from('user_platforms')
    .update({
      is_active: false,
    })
    .eq('user_id', user.id)
    .eq('platform_id', platformId);

  if (error) throw error;

  return true;
}