import { supabase } from '../../../database/supabase';

export async function resumeWorkSession(session_id: string) {
  const { data: session, error: findError } = await supabase
    .from('work_sessions')
    .select('*')
    .eq('id', session_id)
    .single();

  if (findError) throw findError;

  const pausedAt = session.paused_at
    ? new Date(session.paused_at).getTime()
    : null;

  const now = new Date().getTime();

  const pausedSeconds = pausedAt
    ? Math.floor((now - pausedAt) / 1000)
    : 0;

  const totalPausedSeconds =
    Number(session.total_paused_seconds ?? 0) + pausedSeconds;

  const { data, error } = await supabase
    .from('work_sessions')
    .update({
      status: 'active',
      paused_at: null,
      total_paused_seconds: totalPausedSeconds,
    })
    .eq('id', session_id)
    .select()
    .single();

  if (error) throw error;

  return data;
}