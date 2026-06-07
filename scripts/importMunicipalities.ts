import { supabaseAdmin } from './supabaseAdmin';

async function importMunicipalities() {
  console.log('Buscando municípios do IBGE...');

  const response = await fetch(
    'https://servicodados.ibge.gov.br/api/v1/localidades/municipios',
  );

  const municipalities = await response.json();

  console.log(`${municipalities.length} municípios encontrados`);

  const rows = municipalities.map((city: any) => {
    const uf =
      city.microrregiao?.mesorregiao?.UF ||
      city.regiaoImediata?.regiaoIntermediaria?.UF;

    return {
      ibge_id: city.id,
      name: city.nome,
      uf: uf?.sigla ?? 'NA',
      state_name: uf?.nome ?? 'Não informado',
      immediate_region: city.regiaoImediata?.nome ?? 'Não informado',
      active: true,
    };
  });

  console.log(`${rows.length} linhas preparadas`);

  const chunkSize = 500;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    const { error } = await supabaseAdmin
      .from('municipalities')
      .upsert(chunk, {
        onConflict: 'ibge_id',
      });

    if (error) {
      console.log('Erro no chunk:', error);
      throw error;
    }

    console.log(`Importados ${i + chunk.length} municípios`);
  }

  console.log('Importação concluída!');
}

importMunicipalities();