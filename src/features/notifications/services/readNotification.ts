import { supabase } from '../../../database/supabase';

export async function readNotification(
  id: string,
) {
  const { error } =
    await supabase
      .from('notifications')
      .update({
        read: true,
      })
      .eq('id', id);

  if (error) throw error;
}