import { supabase } from '../../../database/supabase';

type CreateVehicleParams = {
  brand: string;

  model: string;

  year: number;

  plate: string;

  type: string;

  current_km: number;

  next_revision_km: number;
};

export async function createVehicle({
  brand,
  model,
  year,
  plate,
  type,
  current_km,
  next_revision_km,
}: CreateVehicleParams) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      user_id: user.id,

      brand,

      model,

      year,

      plate: plate.toUpperCase(),

      type,

      current_km,

      next_revision_km,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}