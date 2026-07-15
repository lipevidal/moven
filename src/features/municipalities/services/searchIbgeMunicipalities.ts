import { supabase } from '../../../database/supabase';

export type IbgeMunicipality = {
  id: number;
  name: string;
  uf: string;
  state: string;
  immediate_region: string;
  intermediate_region: string;
};

const SEARCH_LIMIT = 80;

function normalizeSearchText(value: string) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function uniqueMunicipalities(rows: any[]): IbgeMunicipality[] {
  const map = new Map<number, IbgeMunicipality>();

  rows.forEach((row) => {
    const municipalityId = Number(row?.municipio_id ?? row?.id);
    const municipalityName = String(row?.municipio_nome ?? row?.nome ?? '').trim();
    const stateUf = String(row?.uf_sigla ?? '').trim().toUpperCase();
    const stateName = String(row?.uf_nome ?? '').trim();
    const immediateRegion = String(row?.regiao_imediata_nome ?? '').trim();
    const intermediateRegion = String(row?.regiao_intermediaria_nome ?? '').trim();

    if (!municipalityId || !municipalityName || !stateUf) return;

    if (!map.has(municipalityId)) {
      map.set(municipalityId, {
        id: municipalityId,
        name: municipalityName,
        uf: stateUf,
        state: stateName,
        immediate_region: immediateRegion,
        intermediate_region: intermediateRegion,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    `${a.name}-${a.uf}`.localeCompare(`${b.name}-${b.uf}`, 'pt-BR'),
  );
}

export async function searchIbgeMunicipalities(
  searchText: string,
): Promise<IbgeMunicipality[]> {
  const cleanText = searchText.trim();

  if (cleanText.length < 2) {
    return [];
  }

  const normalizedSearch = normalizeSearchText(cleanText);

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'search_ibge_municipios',
    {
      p_search: cleanText,
      p_limit: SEARCH_LIMIT,
    },
  );

  if (!rpcError && Array.isArray(rpcData)) {
    return uniqueMunicipalities(rpcData as unknown as any[]).slice(0, SEARCH_LIMIT);
  }

  if (rpcError) {
    console.log('RPC search_ibge_municipios indisponível:', rpcError);
  }

  const { data, error } = await supabase
    .from('ibge_localidades')
    .select(
      'municipio_id, municipio_nome, uf_nome, uf_sigla, regiao_imediata_nome, regiao_intermediaria_nome',
    )
    .ilike('municipio_nome', `%${cleanText}%`)
    .order('municipio_nome', { ascending: true })
    .limit(500);

  if (error) throw error;

  const rows = ((data ?? []) as unknown as any[]).filter((row) => {
    const city = normalizeSearchText(row?.municipio_nome ?? '');

    return city.includes(normalizedSearch);
  });

  return uniqueMunicipalities(rows).slice(0, SEARCH_LIMIT);
}
