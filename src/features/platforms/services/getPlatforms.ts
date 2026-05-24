import { supabase } from '../../../database/supabase';

export async function getPlatforms() {
  const { data, error } = await supabase
    .from('platforms')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.log('Erro ao buscar platforms:', error);
    throw error;
  }

  return data ?? [];
}