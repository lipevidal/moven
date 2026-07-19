import { NovoPostAluguel, NovoPostAluguelProps } from "./aluguel/NovoPostAluguel";
import { NovoPostEletrico, NovoPostEletricoProps } from "./eletricos/NovoPostEletrico";
import { NovoPostEvento, NovoPostEventoProps } from "./eventos/NovoPostEvento";
import { NovoPostGeral, NovoPostGeralProps } from "./geral/NovoPostGeral";
import { NovoPostResultado, NovoPostResultadoProps } from "./resultados/NovoPostResultado";
import { NovoPostSos, NovoPostSosProps } from "./sos/NovoPostSos";
import { NovoPostVenda, NovoPostVendaProps } from "./venda/NovoPostVenda";

export type PostContentType =
  | "general"
  | "sos"
  | "sale"
  | "rental"
  | "results"
  | "events"
  | "electric";

export type ConteudoNovoPostProps = {
  contentType: PostContentType | string;
  geral?: NovoPostGeralProps;
  sos?: NovoPostSosProps;
  venda?: NovoPostVendaProps;
  aluguel?: NovoPostAluguelProps;
  resultados?: NovoPostResultadoProps;
  eventos?: NovoPostEventoProps;
  eletricos?: NovoPostEletricoProps;
};

export function ConteudoNovoPost({
  contentType,
  geral,
  sos,
  venda,
  aluguel,
  resultados,
  eventos,
  eletricos,
}: ConteudoNovoPostProps) {
  const normalized = String(contentType ?? "").trim().toLowerCase();

  switch (normalized) {
    case "general":
    case "geral":
      return geral ? <NovoPostGeral {...geral} /> : null;

    case "sos":
      return sos ? <NovoPostSos {...sos} /> : null;

    case "sale":
    case "venda":
      return venda ? <NovoPostVenda {...venda} /> : null;

    case "rental":
    case "aluguel":
      return aluguel ? <NovoPostAluguel {...aluguel} /> : null;

    case "results":
    case "resultados":
      return resultados ? <NovoPostResultado {...resultados} /> : null;

    case "events":
    case "eventos":
      return eventos ? <NovoPostEvento {...eventos} /> : null;

    case "electric":
    case "eletricos":
      return eletricos ? <NovoPostEletrico {...eletricos} /> : null;

    default:
      return null;
  }
}

export default ConteudoNovoPost;
