import { supabase } from '../../../database/supabase';

export async function getMunicipalities() {
  const { data, error } = await supabase
    .from('municipalities')
    .select('*')
    .eq('active', true)
    .order('uf', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;

  return data ?? [];
}