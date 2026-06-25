import { supabase } from '../../../database/supabase';

export type Municipality = {
  id: string;
  name: string;
  uf: string;
  state_name?: string | null;
  immediate_region?: string | null;
};

export async function searchMunicipalities(search: string) {
  const term = search.trim();

  if (term.length < 2) return [];

  const { data, error } = await supabase
    .from('municipalities')
    .select('id, name, uf, state_name, immediate_region')
    .ilike('name', `%${term}%`)
    .order('name', { ascending: true })
    .limit(30);

  if (error) {
    console.log('Erro ao buscar cidades:', error);
    return [];
  }

  console.log('Cidades encontradas:', data);

  return data ?? [];
}