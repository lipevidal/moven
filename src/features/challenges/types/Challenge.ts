export interface Challenge {
  id: string;
  challenge_type: 'daily' | 'weekly' | 'monthly';

  start_date: string;
  end_date: string;

  status:
    | 'open'
    | 'running'
    | 'analysis'
    | 'finished';
}