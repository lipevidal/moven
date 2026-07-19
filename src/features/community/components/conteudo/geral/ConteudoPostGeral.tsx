import { ReactNode } from "react";
import { StyleSheet, Text } from "react-native";

import { ConteudoPostPost } from "../../ConteudoPost";
import { GaleriaImagensPost } from "../shared/GaleriaImagensPost";

type ConteudoPostGeralProps = {
  post: ConteudoPostPost;
  details?: ReactNode;
  images: string[];
  postImagesViewportWidth: number;
};

export function ConteudoPostGeral({
  post,
  details,
  images,
  postImagesViewportWidth,
}: ConteudoPostGeralProps) {
  return (
    <>
      {post.content ? (
        <Text style={styles.postContent}>
          {post.content}
        </Text>
      ) : null}

      {details}

      <GaleriaImagensPost
        images={images}
        postImagesViewportWidth={postImagesViewportWidth}
        variant="default"
        fullBleed
      />
    </>
  );
}

export default ConteudoPostGeral;

const styles = StyleSheet.create({
  postContent: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 12,
  },
});
