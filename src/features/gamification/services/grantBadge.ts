import { supabase } from '../../../database/supabase';
import { createNotification } from '../../notifications/services/createNotification';
import { addXp } from './addXp';

export async function grantBadge(
  userId: string,
  badgeSlug: string,
) {
  const { data: badge, error: badgeError } = await supabase
    .from('badges')
    .select('id, slug, title, description, xp_reward')
    .eq('slug', badgeSlug)
    .single();

  if (badgeError) {
    throw badgeError;
  }

  const { data: existing, error: existingError } = await supabase
    .from('user_badges')
    .select('id')
    .eq('user_id', userId)
    .eq('badge_id', badge.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return {
      alreadyEarned: true,
      badge,
    };
  }

  const { error: insertError } = await supabase
    .from('user_badges')
    .insert({
      user_id: userId,
      badge_id: badge.id,
    });

  if (insertError) {
    throw insertError;
  }

  if (Number(badge.xp_reward ?? 0) > 0) {
    await addXp(
      userId,
      Number(badge.xp_reward),
      `Selo: ${badge.title}`,
    );
  }

  await createNotification(
    userId,
    '🏅 Novo selo conquistado',
    `Você desbloqueou o selo "${badge.title}".`,
    'badge',
    badge.id,
  );

  return {
    alreadyEarned: false,
    badge,
  };
}
