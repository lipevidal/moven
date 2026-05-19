import { useEffect } from 'react';

import { router } from 'expo-router';

import { supabase } from '../database/supabase';

import { useAuthStore } from '../store/authStore';

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
          });

          router.replace('/(private)/(tabs)/dashboard');
        } else {
          setUser(null);

          router.replace('/(auth)/login');
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      setUser({
        id: session.user.id,
        email: session.user.email ?? '',
      });

      router.replace('/(private)/(tabs)/dashboard');
    }
  }

  return children;
}