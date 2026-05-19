export type VehicleType =
  | 'car'
  | 'motorcycle'
  | 'utility';

export type Vehicle = {
  id: string;

  brand: string;

  model: string;

  year: number;

  plate: string;

  type: VehicleType;

  current_km: number;

  next_revision_km: number;

  active: boolean;
};