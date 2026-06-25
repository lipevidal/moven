import { useEffect, useState } from 'react';

import { supabase } from '../../../database/supabase';

import { getUnreadCount } from '../services/getUnreadCount';

export function useNotificationBadge() {
  const [count, setCount] =
    useState(0);

  async function load() {
    const total =
      await getUnreadCount();

    setCount(total);
  }

  useEffect(() => {
    load();

    const channel =
      supabase.channel(
        'notification-badge',
      );

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        channel,
      );
    };
  }, []);

  return count;
}