import { ReactNode } from "react";

import { ConteudoPostAluguel } from "./conteudo/aluguel/ConteudoPostAluguel";
import { ConteudoPostEletricos } from "./conteudo/eletricos/ConteudoPostEletricos";
import { ConteudoPostEventos } from "./conteudo/eventos/ConteudoPostEventos";
import { ConteudoPostGeral } from "./conteudo/geral/ConteudoPostGeral";
import { ConteudoPostResultados } from "./conteudo/resultados/ConteudoPostResultados";
import { ConteudoPostSos } from "./conteudo/sos/ConteudoPostSos";
import { ConteudoPostVenda } from "./conteudo/venda/ConteudoPostVenda";
import {
  getPostAreaColor,
  normalizePostContentType,
  PostPaymentMethods,
} from "./conteudo/shared/postContentUtils";

export type ConteudoPostPost = {
  id: string;
  content?: string | null;
  content_type?: string | null;
  category?: string | null;
  image_url?: string | null;
  images?: string[] | null;

  support_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;

  product_name?: string | null;
  price?: number | string | null;
  payment_methods?: PostPaymentMethods | null;
  whatsapp_url?: string | null;

  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | string | null;
  rental_periodicity?: string | null;
  rental_price?: number | string | null;
  deposit_required?: boolean | null;
  deposit_amount?: number | string | null;
  deposit_installments?: number | string | null;
  deposit_paid_on_delivery?: boolean | null;

  event_at?: string | null;
  event_end_at?: string | null;
  event_address?: string | null;

  result_period_type?: string | null;
  result_snapshot?: any;

  [key: string]: any;
};

type ConteudoPostProps<
  TPost extends ConteudoPostPost = ConteudoPostPost,
> = {
  post: TPost;
  details?: ReactNode;
  postImagesViewportWidth: number;
};

export function getPostImages(post: ConteudoPostPost) {
  const images = Array.isArray(post.images)
    ? post.images.filter(Boolean)
    : [];

  return images.length > 0
    ? images
    : post.image_url
      ? [post.image_url]
      : [];
}

export function ConteudoPost<
  TPost extends ConteudoPostPost = ConteudoPostPost,
>({
  post,
  details,
  postImagesViewportWidth,
}: ConteudoPostProps<TPost>) {
  const contentType = normalizePostContentType(
    post.content_type || post.category,
  );

  const color = getPostAreaColor(contentType);
  const images = getPostImages(post);

  if (contentType === "sos") {
    return (
      <ConteudoPostSos
        post={post}
        details={details}
        images={images}
        postImagesViewportWidth={postImagesViewportWidth}
        color={color}
      />
    );
  }

  if (contentType === "sale") {
    return (
      <ConteudoPostVenda
        post={post}
        images={images}
        postImagesViewportWidth={postImagesViewportWidth}
        color={color}
      />
    );
  }

  if (contentType === "rental") {
    return (
      <ConteudoPostAluguel
        post={post}
        images={images}
        postImagesViewportWidth={postImagesViewportWidth}
        color={color}
      />
    );
  }

  if (contentType === "results") {
    return (
      <ConteudoPostResultados
        post={post}
        details={details}
        images={images}
        postImagesViewportWidth={postImagesViewportWidth}
        color={color}
      />
    );
  }

  if (contentType === "events") {
    return (
      <ConteudoPostEventos
        post={post}
        images={images}
        postImagesViewportWidth={postImagesViewportWidth}
        color={color}
      />
    );
  }

  if (contentType === "electric") {
    return (
      <ConteudoPostEletricos
        post={post}
        images={images}
        postImagesViewportWidth={postImagesViewportWidth}
        color={color}
      />
    );
  }

  return (
    <ConteudoPostGeral
      post={post}
      details={details}
      images={images}
      postImagesViewportWidth={postImagesViewportWidth}
    />
  );
}

export default ConteudoPost;
