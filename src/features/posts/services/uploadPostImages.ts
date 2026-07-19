import { SupabaseClient } from "@supabase/supabase-js";

function getImageExtension(uri: string) {
  const extension = uri.split("?")[0]?.split(".").pop()?.toLowerCase();

  if (extension === "png") return "png";
  if (extension === "webp") return "webp";

  return "jpg";
}

function getImageContentType(extension: string) {
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";

  return "image/jpeg";
}

export type UploadPostImagesParams = {
  supabase: SupabaseClient;
  userId: string;
  images: Array<string | null | undefined>;
  bucket?: string;
};

export async function uploadPostImages({
  supabase,
  userId,
  images,
  bucket = "community-post-images",
}: UploadPostImagesParams) {
  if (!userId) {
    throw new Error("Usuário não encontrado para enviar as imagens.");
  }

  const validImages = images
    .map((uri) => String(uri ?? "").trim())
    .filter(Boolean)
    .slice(0, 6);

  if (validImages.length === 0) {
    return [];
  }

  return Promise.all(
    validImages.map(async (uri, index) => {
      const extension = getImageExtension(uri);
      const contentType = getImageContentType(extension);
      const path =
        `${userId}/${Date.now()}-${index}-` +
        `${Math.random().toString(16).slice(2)}.${extension}`;

      const response = await fetch(uri);

      if (!response.ok) {
        throw new Error(`Não foi possível ler a imagem ${index + 1}.`);
      }

      const arrayBuffer = await response.arrayBuffer();

      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, arrayBuffer, {
          contentType,
          upsert: false,
        });

      if (error) {
        throw error;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);

      return data.publicUrl;
    }),
  );
}

export default uploadPostImages;
