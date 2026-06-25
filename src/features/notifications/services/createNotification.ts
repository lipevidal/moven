import { supabase } from '../../../database/supabase';

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: string,
  referenceId?: string,
) {
  const { error } =
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        reference_id: referenceId,
      });

  if (error) throw error;
}