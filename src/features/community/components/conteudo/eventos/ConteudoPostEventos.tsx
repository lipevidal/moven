import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ConteudoPostPost } from "../../ConteudoPost";
import { GaleriaImagensPost } from "../shared/GaleriaImagensPost";
import {
  formatPostDate,
  formatPostTime,
} from "../shared/postContentUtils";

type ConteudoPostEventosProps = {
  post: ConteudoPostPost;
  images: string[];
  postImagesViewportWidth: number;
  color: string;

  isAttending?: boolean;
  attendanceLoading?: boolean;
  attendeeAvatars?: string[];
  attendeeCount?: number;
  onConfirmAttendance?: () => void | Promise<void>;
};

function normalizeAvatarList(values: unknown) {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => {
      if (typeof value === "string") {
        return value.trim();
      }

      if (
        value &&
        typeof value === "object"
      ) {
        const item = value as Record<string, unknown>;

        return String(
          item.avatar_url ??
            item.photo_url ??
            item.image_url ??
            "",
        ).trim();
      }

      return "";
    })
    .filter(Boolean);
}

export function ConteudoPostEventos({
  post,
  images,
  postImagesViewportWidth,
  color,
  isAttending = false,
  attendanceLoading = false,
  attendeeAvatars,
  attendeeCount,
  onConfirmAttendance,
}: ConteudoPostEventosProps) {
  const eventTitle =
    String(
      post.event_title ??
        post.title ??
        "",
    ).trim() || "Evento da comunidade";

  const confirmedAvatars =
    attendeeAvatars ??
    normalizeAvatarList(
      post.attendee_avatars ??
        post.event_attendee_avatars ??
        post.confirmed_attendees,
    );

  const totalConfirmed = Math.max(
    Number(
      attendeeCount ??
        post.attendee_count ??
        post.event_attendee_count ??
        post.confirmed_attendees_count ??
        confirmedAvatars.length,
    ) || 0,
    confirmedAvatars.length,
  );

  const visibleAvatars = confirmedAvatars.slice(0, 4);
  const hiddenAttendeesCount = Math.max(
    totalConfirmed - visibleAvatars.length,
    0,
  );

  function handleConfirmAttendance(event: any) {
    event.stopPropagation?.();

    if (attendanceLoading) return;

    void onConfirmAttendance?.();
  }

  return (
    <>
      <View
        style={[
          styles.eventHero,
          {
            borderColor: `${color}42`,
            backgroundColor: `${color}0D`,
          },
        ]}
      >
        <View
          style={[
            styles.calendarIcon,
            {
              backgroundColor: color,
              shadowColor: color,
            },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={24}
            color="#FFFFFF"
          />
        </View>

        <View style={styles.eventHeaderText}>
          <Text style={[styles.eventEyebrow, { color }]}>
            Evento da comunidade
          </Text>

          <Text
            style={styles.eventTitle}
            numberOfLines={2}
          >
            {eventTitle}
          </Text>
        </View>
      </View>

      <View style={styles.scheduleGrid}>
        <View style={styles.scheduleCard}>
          <View style={styles.scheduleHeader}>
            <Ionicons
              name="play-circle-outline"
              size={18}
              color={color}
            />

            <Text style={styles.scheduleLabel}>
              Início
            </Text>
          </View>

          <Text style={styles.scheduleValue}>
            {formatPostDate(post.event_at)}
          </Text>

          <Text style={[styles.scheduleTime, { color }]}>
            {formatPostTime(post.event_at)}
          </Text>
        </View>

        <View style={styles.scheduleCard}>
          <View style={styles.scheduleHeader}>
            <Ionicons
              name="stop-circle-outline"
              size={18}
              color={color}
            />

            <Text style={styles.scheduleLabel}>
              Término
            </Text>
          </View>

          <Text style={styles.scheduleValue}>
            {formatPostDate(post.event_end_at)}
          </Text>

          <Text style={[styles.scheduleTime, { color }]}>
            {formatPostTime(post.event_end_at)}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.addressCard,
          {
            borderColor: `${color}35`,
          },
        ]}
      >
        <View
          style={[
            styles.addressIcon,
            {
              backgroundColor: `${color}18`,
            },
          ]}
        >
          <Ionicons
            name="location-outline"
            size={19}
            color={color}
          />
        </View>

        <View style={styles.addressText}>
          <Text style={styles.addressLabel}>
            Local
          </Text>

          <Text style={styles.addressValue}>
            {String(post.event_address ?? "").trim() ||
              "Endereço não informado"}
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

      <View style={styles.attendanceRow}>
        <TouchableOpacity
          activeOpacity={0.86}
          disabled={attendanceLoading}
          style={[
            styles.attendanceButton,
            {
              backgroundColor: isAttending
                ? `${color}18`
                : color,
              borderColor: isAttending
                ? `${color}55`
                : color,
            },
            attendanceLoading && styles.disabled,
          ]}
          onPress={handleConfirmAttendance}
        >
          {attendanceLoading ? (
            <ActivityIndicator
              size="small"
              color={isAttending ? color : "#FFFFFF"}
            />
          ) : (
            <Ionicons
              name={
                isAttending
                  ? "checkmark-circle"
                  : "person-add-outline"
              }
              size={18}
              color={isAttending ? color : "#FFFFFF"}
            />
          )}

          <Text
            style={[
              styles.attendanceButtonText,
              {
                color: isAttending
                  ? color
                  : "#FFFFFF",
              },
            ]}
          >
            {isAttending
              ? "Presença confirmada"
              : "Confirmar presença"}
          </Text>
        </TouchableOpacity>

        {totalConfirmed > 0 ? (
          <View style={styles.attendeesBlock}>
            <View style={styles.avatarStack}>
              {visibleAvatars.map((avatarUrl, index) => (
                <View
                  key={`${avatarUrl}-${index}`}
                  style={[
                    styles.avatarWrap,
                    {
                      marginLeft: index === 0 ? 0 : -11,
                      borderColor: "#0B0B0F",
                      zIndex:
                        visibleAvatars.length - index,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: avatarUrl }}
                    style={styles.avatar}
                  />
                </View>
              ))}

              {hiddenAttendeesCount > 0 ? (
                <View
                  style={[
                    styles.extraAvatar,
                    {
                      marginLeft:
                        visibleAvatars.length > 0
                          ? -11
                          : 0,
                      borderColor: "#0B0B0F",
                      backgroundColor: `${color}24`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.extraAvatarText,
                      {
                        color,
                      },
                    ]}
                  >
                    +{hiddenAttendeesCount}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.attendeesCount}>
              {totalConfirmed === 1
                ? "1 pessoa"
                : `${totalConfirmed} pessoas`}
            </Text>
          </View>
        ) : null}
      </View>
    </>
  );
}

export default ConteudoPostEventos;

const styles = StyleSheet.create({
  eventHero: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  calendarIcon: {
    width: 48,
    height: 48,
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

  eventHeaderText: {
    flex: 1,
    minWidth: 0,
  },

  eventEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },

  eventTitle: {
    color: "#F5F0E6",
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 19,
    marginTop: 2,
  },

  scheduleGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  scheduleCard: {
    flex: 1,
    minHeight: 98,
    borderRadius: 17,
    backgroundColor: "#141419",
    borderWidth: 1,
    borderColor: "#29272E",
    padding: 10,
  },

  scheduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  scheduleLabel: {
    color: "#D6CFD7",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.65,
  },

  scheduleValue: {
    color: "#F5F0E6",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 10,
    textTransform: "capitalize",
  },

  scheduleTime: {
    fontSize: 14,
    fontWeight: "900",
    marginTop: 3,
  },

  addressCard: {
    marginTop: 8,
    borderRadius: 17,
    borderWidth: 1,
    backgroundColor: "#141419",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  addressIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  addressText: {
    flex: 1,
    minWidth: 0,
  },

  addressLabel: {
    color: "#8F8991",
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  addressValue: {
    color: "#F5F0E6",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    marginTop: 3,
  },

  description: {
    color: "#D8D1C4",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 11,
  },

  attendanceRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  attendanceButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  attendanceButtonText: {
    fontSize: 10,
    fontWeight: "900",
  },

  attendeesBlock: {
    alignItems: "flex-end",
    justifyContent: "center",
  },

  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  avatarWrap: {
    width: 31,
    height: 31,
    borderRadius: 999,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: "#202026",
  },

  avatar: {
    width: "100%",
    height: "100%",
  },

  extraAvatar: {
    width: 31,
    height: 31,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  extraAvatarText: {
    fontSize: 8,
    fontWeight: "900",
  },

  attendeesCount: {
    color: "#8F8991",
    fontSize: 8,
    fontWeight: "800",
    marginTop: 4,
  },

  disabled: {
    opacity: 0.58,
  },
});
