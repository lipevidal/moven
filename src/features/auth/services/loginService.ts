import { supabase } from '../../../database/supabase';

export type LoginWithPasswordParams = {
  email: string;
  password: string;
};

export type LoginWithPasswordResponse = {
  user: any;
  session: any;
};

export class LoginServiceError extends Error {
  originalMessage?: string;

  constructor(message: string, originalMessage?: string) {
    super(message);
    this.name = 'LoginServiceError';
    this.originalMessage = originalMessage;
  }
}

export function getLoginErrorMessage(message?: string) {
  const normalizedMessage = String(message ?? '').toLowerCase();

  if (
    normalizedMessage.includes('invalid login credentials') ||
    normalizedMessage.includes('invalid credentials')
  ) {
    return 'E-mail ou senha incorretos. Verifique os dados e tente novamente.';
  }

  if (
    normalizedMessage.includes('email not confirmed') ||
    normalizedMessage.includes('email_not_confirmed')
  ) {
    return 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.';
  }

  if (
    normalizedMessage.includes('too many requests') ||
    normalizedMessage.includes('rate limit')
  ) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }

  if (
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('fetch')
  ) {
    return 'Não foi possível conectar. Verifique sua internet e tente novamente.';
  }

  return 'Não foi possível entrar. Verifique seus dados e tente novamente.';
}

export async function loginWithPassword({
  email,
  password,
}: LoginWithPasswordParams): Promise<LoginWithPasswordResponse> {
  const cleanEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error) {
    throw new LoginServiceError(
      getLoginErrorMessage(error.message),
      error.message,
    );
  }

  return {
    user: data.user,
    session: data.session,
  };
}
