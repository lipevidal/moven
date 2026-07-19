import { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ConteudoPostPost } from "../../ConteudoPost";
import { GaleriaImagensPost } from "../shared/GaleriaImagensPost";

type ConteudoPostResultadosProps = {
  post: ConteudoPostPost;
  details?: ReactNode;
  images: string[];
  postImagesViewportWidth: number;
  color: string;
};

function getResultPeriodLabel(value?: string | null) {
  if (value === "turn") return "Turno";
  if (value === "day") return "Dia";
  if (value === "week") return "Semana";
  if (value === "month") return "Mês";
  if (value === "year") return "Ano";

  return "Período";
}

export function ConteudoPostResultados({
  post,
  details,
  images,
  postImagesViewportWidth,
  color,
}: ConteudoPostResultadosProps) {
  const snapshotPeriod =
    post.result_snapshot?.period ||
    post.result_snapshot?.result_period_type ||
    post.result_period_type;

  return (
    <>
      <View
        style={[
          styles.resultsHeader,
          {
            borderColor: `${color}42`,
            backgroundColor: `${color}0D`,
          },
        ]}
      >
        <View
          style={[
            styles.trophyIcon,
            {
              backgroundColor: color,
              shadowColor: color,
            },
          ]}
        >
          <Ionicons
            name="trophy-outline"
            size={23}
            color="#080808"
          />
        </View>

        <View style={styles.resultsHeaderText}>
          <Text style={[styles.resultsEyebrow, { color }]}>
            Resultado compartilhado
          </Text>

          <Text style={styles.resultsTitle}>
            Desempenho do período
          </Text>
        </View>

        <View
          style={[
            styles.periodPill,
            {
              borderColor: `${color}40`,
              backgroundColor: `${color}18`,
            },
          ]}
        >
          <Text style={[styles.periodText, { color }]}>
            {getResultPeriodLabel(snapshotPeriod)}
          </Text>
        </View>
      </View>

      {post.content ? (
        <Text style={styles.description}>
          {post.content}
        </Text>
      ) : null}

      {details ? (
        <View style={styles.resultDetails}>
          {details}
        </View>
      ) : null}

      <GaleriaImagensPost
        images={images}
        postImagesViewportWidth={postImagesViewportWidth}
        variant="compact"
        fullBleed={false}
      />
    </>
  );
}

export default ConteudoPostResultados;

const styles = StyleSheet.create({
  resultsHeader: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  trophyIcon: {
    width: 47,
    height: 47,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },

  resultsHeaderText: {
    flex: 1,
    minWidth: 0,
  },

  resultsEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },

  resultsTitle: {
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
  },

  periodPill: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  periodText: {
    fontSize: 10,
    fontWeight: "900",
  },

  description: {
    color: "#D8D1C4",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 11,
  },

  resultDetails: {
    marginTop: 1,
  },
});
