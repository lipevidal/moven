import {
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ConteudoPostPost } from "../../ConteudoPost";
import { GaleriaImagensPost } from "../shared/GaleriaImagensPost";

type ConteudoPostEletricosProps = {
  post: ConteudoPostPost;
  images: string[];
  postImagesViewportWidth: number;
  color: string;
};

export function ConteudoPostEletricos({
  post,
  images,
  postImagesViewportWidth,
  color,
}: ConteudoPostEletricosProps) {
  return (
    <>
      <View
        style={[
          styles.energyHeader,
          {
            borderColor: `${color}42`,
            backgroundColor: `${color}0D`,
          },
        ]}
      >
        <View
          style={[
            styles.energyIcon,
            {
              backgroundColor: color,
              shadowColor: color,
            },
          ]}
        >
          <Ionicons
            name="flash-outline"
            size={24}
            color="#05201D"
          />
        </View>

        <View style={styles.energyText}>
          <Text style={[styles.energyEyebrow, { color }]}>
            Mobilidade elétrica
          </Text>

          <Text style={styles.energyTitle}>
            Elétricos, híbridos e tecnologia
          </Text>

          <Text style={styles.energySubtitle}>
            Experiências, consumo, carregamento e manutenção.
          </Text>
        </View>
      </View>

      {post.content ? (
        <Text style={styles.description}>
          {post.content}
        </Text>
      ) : null}

      <GaleriaImagensPost
        images={images}
        postImagesViewportWidth={postImagesViewportWidth}
        variant="medium"
        fullBleed={false}
      />

      <View
        style={[
          styles.energyFooter,
          {
            borderColor: `${color}30`,
          },
        ]}
      >
        <Ionicons
          name="leaf-outline"
          size={17}
          color={color}
        />

        <Text style={styles.energyFooterText}>
          Conteúdo compartilhado pela comunidade de motoristas.
        </Text>
      </View>
    </>
  );
}

export default ConteudoPostEletricos;

const styles = StyleSheet.create({
  energyHeader: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  energyIcon: {
    width: 49,
    height: 49,
    borderRadius: 18,
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

  energyText: {
    flex: 1,
    minWidth: 0,
  },

  energyEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },

  energyTitle: {
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
  },

  energySubtitle: {
    color: "#9E989F",
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "700",
    marginTop: 3,
  },

  description: {
    color: "#D8D1C4",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 11,
  },

  energyFooter: {
    minHeight: 44,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: "#141419",
    marginTop: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  energyFooterText: {
    flex: 1,
    color: "#8F8991",
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "700",
  },
});
