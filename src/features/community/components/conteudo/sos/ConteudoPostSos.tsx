import { ReactNode } from "react";
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ConteudoPostPost } from "../../ConteudoPost";
import { GaleriaImagensPost } from "../shared/GaleriaImagensPost";
import { getSupportTypeData } from "../shared/postContentUtils";

type ConteudoPostSosProps = {
  post: ConteudoPostPost;
  details?: ReactNode;
  images: string[];
  postImagesViewportWidth: number;
  color: string;
};

export function ConteudoPostSos({
  post,
  images,
  postImagesViewportWidth,
  color,
}: ConteudoPostSosProps) {
  const support = getSupportTypeData(post.support_type);

  const hasCoordinates =
    post.latitude != null && post.longitude != null;

  const locationText =
    String(post.location_label ?? "").trim() ||
    (hasCoordinates
      ? `Lat: ${Number(post.latitude).toFixed(5)} · Long: ${Number(
          post.longitude,
        ).toFixed(5)}`
      : "");

  async function openMap(event: any) {
    event.stopPropagation?.();

    if (!hasCoordinates) return;

    const latitude = Number(post.latitude);
    const longitude = Number(post.longitude);

    const url =
      `https://www.google.com/maps/search/?api=1&query=` +
      `${latitude},${longitude}`;

    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
    }
  }

  return (
    <>
      <View style={styles.supportCard}>
        <View
          style={[
            styles.sosBadge,
            {
              backgroundColor: color,
            },
          ]}
        >
          <Text style={styles.sosBadgeText}>
            S.O.S.
          </Text>
        </View>

        <View style={styles.supportText}>
          <Text
            style={[
              styles.supportLabel,
              {
                color,
              },
            ]}
          >
            Solicitação de apoio
          </Text>

          <Text
            style={styles.supportTitle}
            numberOfLines={2}
          >
            {support.label}
          </Text>
        </View>
      </View>

      {post.content ? (
        <Text style={styles.descriptionText}>
          {post.content}
        </Text>
      ) : null}

      {images.length > 0 ? (
        <View style={styles.gallery}>
          <GaleriaImagensPost
            images={images}
            postImagesViewportWidth={postImagesViewportWidth}
            variant="compact"
            fullBleed={false}
          />
        </View>
      ) : null}

      {locationText ? (
        <View
          style={[
            styles.locationRow,
            {
              borderTopColor: `${color}28`,
              borderBottomColor: `${color}28`,
            },
          ]}
        >
          <View
            style={[
              styles.locationIcon,
              {
                backgroundColor: `${color}16`,
              },
            ]}
          >
            <Ionicons
              name="location-outline"
              size={19}
              color={color}
            />
          </View>

          <View style={styles.locationInfo}>
            <Text style={styles.locationTitle}>
              Localização
            </Text>

            <Text
              style={styles.locationText}
              numberOfLines={3}
            >
              {locationText}
            </Text>
          </View>

          {hasCoordinates ? (
            <TouchableOpacity
              activeOpacity={0.86}
              style={[
                styles.mapButton,
                {
                  backgroundColor: color,
                },
              ]}
              onPress={openMap}
            >
              <Ionicons
                name="navigate-outline"
                size={17}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

export default ConteudoPostSos;

const styles = StyleSheet.create({
  supportCard: {
    alignSelf: "flex-start",
    maxWidth: "82%",
    marginTop: 10,
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#3A3A40",
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  supportIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  supportText: {
    flexShrink: 1,
    minWidth: 0,
  },

  supportLabel: {
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.85,
  },

  supportTitle: {
    color: "#F5F0E6",
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "900",
    marginTop: 2,
  },

  sosBadge: {
    minHeight: 24,
    borderRadius: 999,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  sosBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.45,
  },

  descriptionText: {
    color: "#E4DED4",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 11,
  },

  gallery: {
    marginTop: 11,
  },

  locationRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingTop: 11,
    paddingBottom: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  locationIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  locationInfo: {
    flex: 1,
    minWidth: 0,
  },

  locationTitle: {
    color: "#F5F0E6",
    fontSize: 10,
    fontWeight: "900",
  },

  locationText: {
    color: "#A8A1A8",
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "700",
    marginTop: 2,
  },

  mapButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
});
