import { supabase } from '../../../database/supabase';

export async function uploadProof(
  challengeId: string,
  image: any,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    throw new Error(
      'Usuário não encontrado.',
    );

  const extension =
    image.uri.split('.').pop();

  const fileName =
    `${Date.now()}.${extension}`;

  const path =
    `${user.id}/${fileName}`;

  const response = await fetch(
    image.uri,
  );

  const blob =
    await response.blob();

  const { error: uploadError } =
    await supabase.storage
      .from('challenge-proofs')
      .upload(path, blob);

  if (uploadError)
    throw uploadError;

  const { data } =
    supabase.storage
      .from('challenge-proofs')
      .getPublicUrl(path);

  const { error } =
    await supabase
      .from('challenge_proofs')
      .insert({
        challenge_id: challengeId,
        user_id: user.id,
        image_url:
          data.publicUrl,
      });

  if (error) throw error;
}