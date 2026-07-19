import { memo } from "react";
import {
  GestureResponderEvent,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const TOTAL_POST_PHOTOS = 6;

export type FotosPostCardProps = {
  images: Array<string | null | undefined>;
  color: string;
  onAddImage: (slotIndex: number) => void;
  onRemoveImage: (slotIndex: number) => void;
  title?: string;
  description?: string;
  disabled?: boolean;
};

export const FotosPostCard = memo(function FotosPostCard({
  images,
  color,
  onAddImage,
  onRemoveImage,
  title = "Adicionar fotos",
  description = "Adicione até 6 imagens para deixar a publicação mais completa.",
  disabled = false,
}: FotosPostCardProps) {
  const normalizedImages = Array.from(
    { length: TOTAL_POST_PHOTOS },
    (_, index) => images[index] || null,
  );

  const selectedCount = normalizedImages.filter(Boolean).length;
  const hasImages = selectedCount > 0;

  function handleRemoveImage(
    event: GestureResponderEvent,
    slotIndex: number,
  ) {
    event.stopPropagation();
    onRemoveImage(slotIndex);
  }

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: `${color}32`,
          shadowColor: color,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.accentGlow,
          {
            backgroundColor: `${color}12`,
          },
        ]}
      />

      <View style={styles.header}>
        <View
          style={[
            styles.iconBox,
            {
              backgroundColor: `${color}18`,
              borderColor: `${color}42`,
            },
          ]}
        >
          <Ionicons name="images-outline" size={20} color={color} />
        </View>

        <View style={styles.headerTextBox}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>

            {hasImages ? (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: `${color}16`,
                    borderColor: `${color}32`,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: color,
                    },
                  ]}
                />

                <Text style={[styles.statusText, { color }]}>
                  Selecionadas
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.description}>{description}</Text>
        </View>

        <View
          style={[
            styles.countBadge,
            {
              backgroundColor: `${color}14`,
              borderColor: `${color}35`,
            },
          ]}
        >
          <Text style={[styles.countCurrent, { color }]}>
            {selectedCount}
          </Text>
          <Text style={styles.countDivider}>/</Text>
          <Text style={styles.countTotal}>{TOTAL_POST_PHOTOS}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {normalizedImages.map((uri, index) => {
          const isCover = index === 0 && Boolean(uri);

          return (
            <TouchableOpacity
              key={`post-photo-slot-${index}`}
              activeOpacity={0.86}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={
                uri
                  ? `Substituir foto ${index + 1}`
                  : `Adicionar foto ${index + 1}`
              }
              style={[
                styles.photoSlot,
                uri ? styles.photoSlotFilled : styles.photoSlotEmpty,
                {
                  borderColor: uri ? `${color}72` : `${color}32`,
                  backgroundColor: uri ? "#050507" : `${color}0A`,
                },
                disabled && styles.disabled,
              ]}
              onPress={() => onAddImage(index)}
            >
              {uri ? (
                <>
                  <Image
                    source={{ uri }}
                    style={styles.photo}
                    resizeMode="cover"
                  />

                  <View pointerEvents="none" style={styles.photoShadeTop} />
                  <View pointerEvents="none" style={styles.photoShadeBottom} />

                  <View
                    pointerEvents="none"
                    style={[
                      styles.positionBadge,
                      {
                        backgroundColor: `${color}E8`,
                      },
                    ]}
                  >
                    <Text style={styles.positionText}>{index + 1}</Text>
                  </View>

                  {isCover ? (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.coverBadge,
                        {
                          borderColor: `${color}70`,
                        },
                      ]}
                    >
                      <Ionicons
                        name="star"
                        size={10}
                        color={color}
                      />
                      <Text style={[styles.coverText, { color }]}>
                        Capa
                      </Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover foto ${index + 1}`}
                    style={[
                      styles.removeButton,
                      {
                        borderColor: `${color}55`,
                      },
                    ]}
                    disabled={disabled}
                    onPress={(event) =>
                      handleRemoveImage(event, index)
                    }
                  >
                    <Ionicons
                      name="trash-outline"
                      size={15}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>

                  <View
                    pointerEvents="none"
                    style={styles.replaceHint}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={12}
                      color="#FFFFFF"
                    />
                    <Text style={styles.replaceHintText}>
                      Substituir
                    </Text>
                  </View>
                </>
              ) : (
                <View pointerEvents="none" style={styles.emptyContent}>
                  <View
                    style={[
                      styles.plusCircleOuter,
                      {
                        borderColor: `${color}32`,
                        backgroundColor: `${color}0D`,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.plusCircleInner,
                        {
                          backgroundColor: `${color}18`,
                          borderColor: `${color}55`,
                        },
                      ]}
                    >
                      <Ionicons
                        name="add"
                        size={24}
                        color={color}
                      />
                    </View>
                  </View>

                  <Text style={styles.emptyTitle}>Adicionar</Text>
                  <Text style={[styles.emptyNumber, { color }]}>
                    Foto {index + 1}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View
          style={[
            styles.footerIconBox,
            {
              backgroundColor: `${color}12`,
            },
          ]}
        >
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={color}
          />
        </View>

        <Text style={styles.footerText}>
          Toque em um espaço para adicionar. Toque novamente na foto
          para substituí-la.
        </Text>
      </View>
    </View>
  );
});

export default FotosPostCard;

const styles = StyleSheet.create({
  card: {
    position: "relative",
    overflow: "hidden",
    width: "100%",
    borderRadius: 24,
    backgroundColor: "#101014",
    borderWidth: 1,
    padding: 14,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  accentGlow: {
    position: "absolute",
    top: -70,
    right: -55,
    width: 170,
    height: 170,
    borderRadius: 999,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 15,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextBox: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  title: {
    color: "#F7F3EA",
    fontSize: 14,
    fontWeight: "900",
  },
  description: {
    color: "#969098",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 15,
    marginTop: 4,
  },
  statusBadge: {
    minHeight: 22,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  countBadge: {
    minWidth: 50,
    height: 34,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  countCurrent: {
    fontSize: 13,
    fontWeight: "900",
  },
  countDivider: {
    color: "#68626A",
    fontSize: 11,
    fontWeight: "800",
    marginHorizontal: 2,
  },
  countTotal: {
    color: "#A8A2AA",
    fontSize: 10,
    fontWeight: "900",
  },
  grid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 9,
  },
  photoSlot: {
    position: "relative",
    overflow: "hidden",
    width: "31.5%",
    aspectRatio: 0.96,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  photoSlotEmpty: {
    borderStyle: "dashed",
  },
  photoSlotFilled: {
    borderStyle: "solid",
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  photoShadeTop: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    height: "42%",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  photoShadeBottom: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: "48%",
    backgroundColor: "rgba(0,0,0,0.26)",
  },
  emptyContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  plusCircleOuter: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  plusCircleInner: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: "#D8D2DA",
    fontSize: 9,
    fontWeight: "900",
    marginTop: 8,
  },
  emptyNumber: {
    fontSize: 8,
    fontWeight: "900",
    marginTop: 2,
  },
  positionBadge: {
    position: "absolute",
    left: 7,
    top: 7,
    minWidth: 23,
    height: 23,
    borderRadius: 999,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  positionText: {
    color: "#080808",
    fontSize: 9,
    fontWeight: "900",
  },
  coverBadge: {
    position: "absolute",
    left: 7,
    bottom: 7,
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(6,6,8,0.84)",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  coverText: {
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  removeButton: {
    position: "absolute",
    right: 7,
    top: 7,
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: "rgba(8,8,10,0.82)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  replaceHint: {
    position: "absolute",
    right: 7,
    bottom: 7,
    minHeight: 24,
    borderRadius: 999,
    backgroundColor: "rgba(8,8,10,0.78)",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  replaceHintText: {
    color: "#FFFFFF",
    fontSize: 7,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  footer: {
    minHeight: 42,
    borderRadius: 15,
    backgroundColor: "#0A0A0D",
    marginTop: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  footerIconBox: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    flex: 1,
    color: "#817B83",
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 13,
  },
  disabled: {
    opacity: 0.5,
  },
});
