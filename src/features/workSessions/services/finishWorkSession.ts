import { supabase } from '../../../database/supabase';

type FinishWorkSessionParams = {
  session_id: string;

  end_km: number;

  earnings: {
    platform: string;
    amount: number;
  }[];
};

export async function finishWorkSession({
  session_id,
  end_km,
  earnings,
}: FinishWorkSessionParams) {
  const { data: session } = await supabase
    .from('work_sessions')
    .select(`
      *,
      vehicle:vehicles(*)
    `)
    .eq('id', session_id)
    .single();

  if (!session) {
    throw new Error('Jornada não encontrada.');
  }

  const { error } = await supabase
    .from('work_sessions')
    .update({
      end_km,

      finished_at:
        new Date().toISOString(),

      status: 'finished',
    })
    .eq('id', session_id);

  if (error) {
    throw error;
  }

  if (earnings.length > 0) {
    const formattedEarnings =
      earnings.map((item) => ({
        session_id,

        platform: item.platform,

        category: item.platform,

        amount: item.amount,
      }));

    const {
      error: earningsError,
    } = await supabase
      .from('earnings')
      .insert(formattedEarnings);

    if (earningsError) {
      throw earningsError;
    }
  }

  await supabase
    .from('vehicles')
    .update({
      current_km: end_km,
    })
    .eq(
      'id',
      session.vehicle_id,
    );
}