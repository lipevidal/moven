import { supabase } from '../../../database/supabase';

export type CityOption = {
  id?: string | null;
  name: string;
  uf?: string | null;
  label: string;
};

const fallbackCities: CityOption[] = [
  { name: 'Belo Horizonte', uf: 'MG', label: 'Belo Horizonte - MG' },
  { name: 'São Paulo', uf: 'SP', label: 'São Paulo - SP' },
  { name: 'Rio de Janeiro', uf: 'RJ', label: 'Rio de Janeiro - RJ' },
  { name: 'Contagem', uf: 'MG', label: 'Contagem - MG' },
  { name: 'Betim', uf: 'MG', label: 'Betim - MG' },
  { name: 'Nova Lima', uf: 'MG', label: 'Nova Lima - MG' },
  { name: 'Uberlândia', uf: 'MG', label: 'Uberlândia - MG' },
  { name: 'Campinas', uf: 'SP', label: 'Campinas - SP' },
  { name: 'Guarulhos', uf: 'SP', label: 'Guarulhos - SP' },
  { name: 'Niterói', uf: 'RJ', label: 'Niterói - RJ' },
];

export async function searchCities(query: string): Promise<CityOption[]> {
  const term = query.trim();

  if (term.length < 2) {
    return fallbackCities.slice(0, 5);
  }

  try {
    const { data, error } = await supabase
      .from('municipalities')
      .select('id, name, state_uf')
      .ilike('name', `%${term}%`)
      .order('name', { ascending: true })
      .limit(20);

    if (!error && data && data.length > 0) {
      return data.map((item: any) => ({
        id: item.id,
        name: item.name,
        uf: item.state_uf,
        label: item.state_uf ? `${item.name} - ${item.state_uf}` : item.name,
      }));
    }
  } catch (error) {
    console.log(error);
  }

  const normalizedTerm = normalizeText(term);

  return fallbackCities.filter((city) =>
    normalizeText(city.label).includes(normalizedTerm),
  );
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
