import { supabase } from '../../../database/supabase';

type UploadChallengeProofParams = {
  challengeId: string;
  image: {
    uri: string;
    mimeType?: string | null;
    fileName?: string | null;
  };
  declaredAmount?: number;
};

function getFileExtension(image: UploadChallengeProofParams['image']) {
  if (image.fileName?.includes('.')) {
    return image.fileName.split('.').pop() || 'jpg';
  }

  if (image.uri.includes('.')) {
    const extension = image.uri.split('.').pop()?.split('?')[0];

    if (extension) return extension;
  }

  if (image.mimeType?.includes('png')) return 'png';
  if (image.mimeType?.includes('webp')) return 'webp';

  return 'jpg';
}

export async function uploadChallengeProof({
  challengeId,
  image,
  declaredAmount,
}: UploadChallengeProofParams) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error('Usuário não encontrado.');
  }

  const extension = getFileExtension(image);
  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${extension}`;

  const filePath = `${user.id}/${challengeId}/${fileName}`;

  const response = await fetch(image.uri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from('challenge-proofs')
    .upload(filePath, blob, {
      contentType: image.mimeType ?? 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage
    .from('challenge-proofs')
    .getPublicUrl(filePath);

  const imageUrl = publicUrlData.publicUrl;

  const { error: insertError } = await supabase
    .from('challenge_proofs')
    .insert({
      challenge_id: challengeId,
      user_id: user.id,
      image_url: imageUrl,
      declared_amount: declaredAmount ?? null,
      status: 'pending',
    });

  if (insertError) {
    throw insertError;
  }

  const updatePayload: any = {
    status: 'under_review',
  };

  if (typeof declaredAmount === 'number') {
    updatePayload.submitted_amount = declaredAmount;
    updatePayload.reported_amount = declaredAmount;
  }

  const { error: updateError } = await supabase
    .from('challenge_entries')
    .update(updatePayload)
    .eq('id', challengeId)
    .eq('user_id', user.id);

  if (updateError) {
    throw updateError;
  }

  return {
    image_url: imageUrl,
  };
}
