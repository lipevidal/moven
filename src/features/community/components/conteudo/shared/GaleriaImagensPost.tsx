import { useEffect, useMemo, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { CommunityImageViewerModal } from "../../CommunityImageViewerModal";

export type GaleriaImagensPostVariant =
  | "default"
  | "compact"
  | "medium";

type GaleriaImagensPostProps = {
  images: string[];
  postImagesViewportWidth: number;
  variant?: GaleriaImagensPostVariant;
  fullBleed?: boolean;
};

const IMAGE_GRID_GAP = 3;

const gallerySizes = {
  default: {
    singleMin: 160,
    singleMax: 550,
    double: 260,
    triple: 220,
    quad: 550,
    borderRadius: 0,
  },
  compact: {
    singleMin: 120,
    singleMax: 320,
    double: 176,
    triple: 158,
    quad: 300,
    borderRadius: 17,
  },
  medium: {
    singleMin: 145,
    singleMax: 420,
    double: 218,
    triple: 188,
    quad: 390,
    borderRadius: 18,
  },
} satisfies Record<
  GaleriaImagensPostVariant,
  {
    singleMin: number;
    singleMax: number;
    double: number;
    triple: number;
    quad: number;
    borderRadius: number;
  }
>;

function getSingleImageHeight(
  imageSize: { width: number; height: number } | null,
  availableWidth: number,
  minimumHeight: number,
  maximumHeight: number,
) {
  if (
    !imageSize?.width ||
    !imageSize?.height ||
    availableWidth <= 0
  ) {
    return minimumHeight;
  }

  const aspectRatio = imageSize.width / imageSize.height;
  const proportionalHeight = availableWidth / aspectRatio;

  return Math.min(
    Math.max(proportionalHeight, minimumHeight),
    maximumHeight,
  );
}

export function GaleriaImagensPost({
  images,
  postImagesViewportWidth,
  variant = "default",
  fullBleed = variant === "default",
}: GaleriaImagensPostProps) {
  const cleanImages = images.filter(Boolean);
  const sizes = gallerySizes[variant];
  const { width: windowWidth } = useWindowDimensions();

  const singleImageUrl =
    cleanImages.length === 1 ? cleanImages[0] : null;

  const availableWidth = Math.max(
    Math.min(
      postImagesViewportWidth || windowWidth,
      windowWidth,
    ),
    0,
  );

  const [singleImageSize, setSingleImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] =
    useState(0);

  useEffect(() => {
    if (!singleImageUrl) {
      setSingleImageSize(null);
      return;
    }

    let active = true;

    Image.getSize(
      singleImageUrl,
      (width, height) => {
        if (!active) return;

        setSingleImageSize({
          width,
          height,
        });
      },
      () => {
        if (!active) return;

        setSingleImageSize(null);
      },
    );

    return () => {
      active = false;
    };
  }, [singleImageUrl]);

  const singleImageHeight = useMemo(
    () =>
      getSingleImageHeight(
        singleImageSize,
        availableWidth,
        sizes.singleMin,
        sizes.singleMax,
      ),
    [
      availableWidth,
      singleImageSize,
      sizes.singleMax,
      sizes.singleMin,
    ],
  );

  function openViewer(index: number) {
    setViewerImages(cleanImages);
    setViewerInitialIndex(index);
    setViewerVisible(true);
  }

  if (cleanImages.length === 0) {
    return null;
  }

  const horizontalStyle = fullBleed
    ? styles.fullBleed
    : styles.contained;

  const visibleQuadImages = cleanImages.slice(0, 4);
  const hiddenImagesCount = Math.max(
    cleanImages.length - 4,
    0,
  );

  return (
    <>
      {cleanImages.length === 1 ? (
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.singleImageWrap,
            horizontalStyle,
            {
              height: singleImageHeight,
              maxHeight: sizes.singleMax,
              borderRadius: sizes.borderRadius,
            },
          ]}
          onPress={(event: any) => {
            event.stopPropagation?.();
            openViewer(0);
          }}
        >
          <Image
            source={{ uri: cleanImages[0] }}
            style={styles.image}
            resizeMode="cover"
          />

          <View
            pointerEvents="none"
            style={styles.darkOverlay}
          />
        </TouchableOpacity>
      ) : cleanImages.length === 2 ? (
        <View
          style={[
            styles.imagesRow,
            horizontalStyle,
            {
              height: sizes.double,
              borderRadius: sizes.borderRadius,
            },
          ]}
        >
          {cleanImages.map((imageUrl, index) => (
            <TouchableOpacity
              key={`${imageUrl}-${index}`}
              activeOpacity={0.9}
              style={styles.imageCell}
              onPress={(event: any) => {
                event.stopPropagation?.();
                openViewer(index);
              }}
            >
              <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                resizeMode="cover"
              />

              <View
                pointerEvents="none"
                style={styles.darkOverlay}
              />
            </TouchableOpacity>
          ))}
        </View>
      ) : cleanImages.length === 3 ? (
        <View
          style={[
            styles.imagesRow,
            horizontalStyle,
            {
              height: sizes.triple,
              borderRadius: sizes.borderRadius,
            },
          ]}
        >
          {cleanImages.map((imageUrl, index) => (
            <TouchableOpacity
              key={`${imageUrl}-${index}`}
              activeOpacity={0.9}
              style={styles.imageCell}
              onPress={(event: any) => {
                event.stopPropagation?.();
                openViewer(index);
              }}
            >
              <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                resizeMode="cover"
              />

              <View
                pointerEvents="none"
                style={styles.darkOverlay}
              />
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View
          style={[
            styles.quadGrid,
            horizontalStyle,
            {
              height: sizes.quad,
              borderRadius: sizes.borderRadius,
            },
          ]}
        >
          {[0, 2].map((rowStart) => (
            <View
              key={`quad-row-${rowStart}`}
              style={styles.quadRow}
            >
              {visibleQuadImages
                .slice(rowStart, rowStart + 2)
                .map((imageUrl, imageIndex) => {
                  const index = rowStart + imageIndex;
                  const showHiddenOverlay =
                    hiddenImagesCount > 0 && index === 3;

                  return (
                    <TouchableOpacity
                      key={`${imageUrl}-${index}`}
                      activeOpacity={0.9}
                      style={styles.imageCell}
                      onPress={(event: any) => {
                        event.stopPropagation?.();
                        openViewer(index);
                      }}
                    >
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.image}
                        resizeMode="cover"
                      />

                      <View
                        pointerEvents="none"
                        style={styles.darkOverlay}
                      />

                      {showHiddenOverlay ? (
                        <View style={styles.hiddenOverlay}>
                          <Text style={styles.hiddenText}>
                            +{hiddenImagesCount}
                          </Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
            </View>
          ))}
        </View>
      )}

      <CommunityImageViewerModal
        visible={viewerVisible}
        images={viewerImages}
        initialIndex={viewerInitialIndex}
        onClose={() => setViewerVisible(false)}
      />
    </>
  );
}

export default GaleriaImagensPost;

const styles = StyleSheet.create({
  fullBleed: {
    marginLeft: -14,
    marginRight: -14,
  },

  contained: {
    marginHorizontal: 0,
  },

  singleImageWrap: {
    position: "relative",
    overflow: "hidden",
    marginTop: 12,
    backgroundColor: "#18171D",
  },

  imagesRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: IMAGE_GRID_GAP,
    overflow: "hidden",
    backgroundColor: "#0B0B0F",
  },

  quadGrid: {
    marginTop: 12,
    gap: IMAGE_GRID_GAP,
    overflow: "hidden",
    backgroundColor: "#0B0B0F",
  },

  quadRow: {
    flex: 1,
    flexDirection: "row",
    gap: IMAGE_GRID_GAP,
  },

  imageCell: {
    flex: 1,
    height: "100%",
    overflow: "hidden",
    backgroundColor: "#18171D",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.16)",
  },

  hiddenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center",
  },

  hiddenText: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
});
