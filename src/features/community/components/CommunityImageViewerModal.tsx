import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type CommunityImageViewerModalProps = {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
};

const SWIPE_HORIZONTAL_THRESHOLD = 55;
const SWIPE_VERTICAL_THRESHOLD = 70;

export function CommunityImageViewerModal({
  visible,
  images,
  initialIndex = 0,
  onClose,
}: CommunityImageViewerModalProps) {
  const { width, height } = useWindowDimensions();

  const safeImages = useMemo(
    () => images.filter((imageUrl) => Boolean(imageUrl)),
    [images],
  );

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (safeImages.length <= 0) return 0;

    return Math.min(Math.max(initialIndex, 0), safeImages.length - 1);
  });

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const currentImage = safeImages[currentIndex] ?? null;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < safeImages.length - 1;

  useEffect(() => {
    if (!visible) return;

    const nextIndex =
      safeImages.length <= 0
        ? 0
        : Math.min(Math.max(initialIndex, 0), safeImages.length - 1);

    setCurrentIndex(nextIndex);
    translateX.setValue(0);
    translateY.setValue(0);
    opacity.setValue(1);
  }, [initialIndex, opacity, safeImages.length, translateX, translateY, visible]);

  const resetPosition = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 3,
        speed: 20,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 3,
        speed: 20,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateX, translateY]);

  const closeWithGesture = useCallback(
    (direction: "up" | "down") => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: direction === "down" ? height : -height,
          duration: 170,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 170,
          useNativeDriver: true,
        }),
      ]).start(() => {
        translateX.setValue(0);
        translateY.setValue(0);
        opacity.setValue(1);
        onClose();
      });
    },
    [height, onClose, opacity, translateX, translateY],
  );

  const goToPrevious = useCallback(() => {
    if (!hasPrevious) {
      resetPosition();
      return;
    }

    Animated.timing(translateX, {
      toValue: width,
      duration: 130,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex((current) => Math.max(current - 1, 0));
      translateX.setValue(-width);
      translateY.setValue(0);
      opacity.setValue(1);

      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 2,
        speed: 20,
      }).start();
    });
  }, [hasPrevious, opacity, resetPosition, translateX, translateY, width]);

  const goToNext = useCallback(() => {
    if (!hasNext) {
      resetPosition();
      return;
    }

    Animated.timing(translateX, {
      toValue: -width,
      duration: 130,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex((current) => Math.min(current + 1, safeImages.length - 1));
      translateX.setValue(width);
      translateY.setValue(0);
      opacity.setValue(1);

      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 2,
        speed: 20,
      }).start();
    });
  }, [hasNext, opacity, resetPosition, safeImages.length, translateX, translateY, width]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          translateX.stopAnimation();
          translateY.stopAnimation();
          opacity.stopAnimation();

          translateX.setValue(0);
          translateY.setValue(0);
          opacity.setValue(1);
        },
        onPanResponderMove: (_, gestureState) => {
          translateX.setValue(gestureState.dx);
          translateY.setValue(gestureState.dy);

          const verticalDistance = Math.abs(gestureState.dy);
          const nextOpacity = Math.max(1 - verticalDistance / 300, 0.35);

          opacity.setValue(nextOpacity);
        },
        onPanResponderRelease: (_, gestureState) => {
          const horizontalMove = Math.abs(gestureState.dx);
          const verticalMove = Math.abs(gestureState.dy);

          const shouldCloseVertically =
            verticalMove > horizontalMove && verticalMove > SWIPE_VERTICAL_THRESHOLD;

          if (shouldCloseVertically) {
            closeWithGesture(gestureState.dy >= 0 ? "down" : "up");
            return;
          }

          const shouldChangeImage =
            horizontalMove >= verticalMove && horizontalMove > SWIPE_HORIZONTAL_THRESHOLD;

          if (shouldChangeImage) {
            if (gestureState.dx < 0) {
              goToNext();
            } else {
              goToPrevious();
            }

            return;
          }

          resetPosition();
        },
        onPanResponderTerminate: resetPosition,
      }),
    [
      closeWithGesture,
      goToNext,
      goToPrevious,
      opacity,
      resetPosition,
      translateX,
      translateY,
    ],
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <Animated.View style={[styles.overlay, { opacity }]}>
        <View style={styles.header} pointerEvents="box-none">
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={25} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.counterBox}>
            <Text style={styles.counterText}>
              {safeImages.length > 0 ? currentIndex + 1 : 0}/{safeImages.length}
            </Text>
          </View>
        </View>

        <Animated.View
          collapsable={false}
          {...panResponder.panHandlers}
          style={[
            styles.imageGestureArea,
            {
              transform: [{ translateX }, { translateY }],
            },
          ]}
        >
          {currentImage ? (
            <Image
              source={{ uri: currentImage }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.emptyText}>Imagem não disponível</Text>
          )}
        </Animated.View>

        {safeImages.length > 1 ? (
          <View style={styles.footer} pointerEvents="box-none">
            <Pressable
              disabled={!hasPrevious}
              style={[styles.navButton, !hasPrevious && styles.navButtonDisabled]}
              onPress={goToPrevious}
            >
              <Ionicons
                name="chevron-back"
                size={26}
                color={hasPrevious ? "#FFFFFF" : "#6B7280"}
              />
            </Pressable>

            <View style={styles.dotsRow} pointerEvents="none">
              {safeImages.map((imageUrl, index) => (
                <View
                  key={`${imageUrl}-${index}`}
                  style={[
                    styles.dot,
                    index === currentIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>

            <Pressable
              disabled={!hasNext}
              style={[styles.navButton, !hasNext && styles.navButtonDisabled]}
              onPress={goToNext}
            >
              <Ionicons
                name="chevron-forward"
                size={26}
                color={hasNext ? "#FFFFFF" : "#6B7280"}
              />
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

export default CommunityImageViewerModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000",
  },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 46,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  counterBox: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  counterText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  imageGestureArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  fullImage: {
    width: "100%",
    height: "100%",
  },

  emptyText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  navButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  navButtonDisabled: {
    opacity: 0.45,
  },

  dotsRow: {
    flex: 1,
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.32)",
  },

  dotActive: {
    width: 18,
    backgroundColor: "#FFFFFF",
  },
});
