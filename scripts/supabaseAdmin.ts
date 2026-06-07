import dotenv from 'dotenv';
import path from 'path';
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';

dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    realtime: {
      transport: ws as any,
    },
  },
);