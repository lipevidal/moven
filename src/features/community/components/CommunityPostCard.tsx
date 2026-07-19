import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { ConteudoPost, ConteudoPostPost } from "./ConteudoPost";

type IconName = keyof typeof Ionicons.glyphMap;

export type CommunityPostCardPost = ConteudoPostPost & {
  id: string;
  user_id: string;
  created_at: string;
  closed_at?: string | null;
  expires_at?: string | null;
  status?: string | null;
  profile?: any;
  liked_by_me?: boolean;
  likes_count?: number;
  comments_count?: number;
  [key: string]: any;
};

type CommunityPostCardProps<
  TPost extends CommunityPostCardPost = CommunityPostCardPost,
> = {
  post: TPost;
  color: string;
  currentUserId: string;
  canRenew?: boolean;
  postImagesViewportWidth: number;
  postImagePairItemWidth: number;
  details?: ReactNode;
  onOpenComments: (post: TPost) => void;
  onOpenDriverProfile: (userId: string, profile: any) => void;
  onOpenImages?: (images: string[], index: number) => void;
  onToggleLike: (post: TPost) => void;
  onClosePost?: (post: TPost) => void;
  onRenewPost?: (post: TPost) => void;
  onDeletePost?: (post: TPost) => void;
};

const CARD_GRAY = "#8B8B94";

function getUserAvatarUrl(user: any) {
  return (
    user?.avatar_url ||
    user?.photo_url ||
    user?.picture ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null
  );
}

function getUserDisplayName(user: any) {
  return (
    user?.full_name ||
    user?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "Motorista"
  );
}

function getFirstAndLastName(user: any) {
  const fullName = String(getUserDisplayName(user)).trim();
  const parts = fullName.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) return parts[0] || "Motorista";

  return `${parts[0]} ${parts[1]}`;
}

function isSameCalendarDay(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function formatPostDateTime(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const yesterday = new Date(now);

  yesterday.setDate(now.getDate() - 1);

  const timeLabel = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isSameCalendarDay(date, now)) {
    return `Hoje · ${timeLabel}`;
  }

  if (isSameCalendarDay(date, yesterday)) {
    return `Ontem · ${timeLabel}`;
  }

  const dateLabel = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return `${dateLabel} · ${timeLabel}`;
}

export function CommunityPostCard<
  TPost extends CommunityPostCardPost = CommunityPostCardPost,
>({
  post,
  currentUserId,
  postImagesViewportWidth,
  details,
  onOpenComments,
  onOpenDriverProfile,
  onToggleLike,
  onDeletePost,
}: CommunityPostCardProps<TPost>) {
  const profile = post.profile ?? {};
  const avatarUrl = getUserAvatarUrl(profile);
  const name = getUserDisplayName(profile);
  const shortName = getFirstAndLastName(profile);
  const isMine = String(post.user_id) === String(currentUserId);
  const postColor = CARD_GRAY;
  const { width: windowWidth } = useWindowDimensions();

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={[
        styles.postCard,
        {
          width: windowWidth,
          borderColor: stylesColors.cardBorder,
        },
      ]}
      onPress={() => onOpenComments(post)}
    >
      <View style={styles.postHeader}>
        <View style={styles.postAuthorRow}>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={(event: any) => {
              event.stopPropagation?.();
              onOpenDriverProfile(post.user_id, profile);
            }}
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={[
                  styles.avatar,
                  {
                    borderColor: stylesColors.cardBorderStrong,
                  },
                ]}
              />
            ) : (
              <View
                style={[
                  styles.avatarFallback,
                  {
                    borderColor: stylesColors.cardBorderStrong,
                  },
                ]}
              >
                <Text style={[styles.avatarFallbackText, { color: postColor }]}>
                  {name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.postAuthorInfo}>
            <Text style={styles.postAuthorName} numberOfLines={1}>
              {shortName}
            </Text>
            <Text style={styles.postAuthorMeta} numberOfLines={1}>
              {formatPostDateTime(post.created_at)}
            </Text>
          </View>
        </View>
      </View>

      <ConteudoPost
        post={post}
        details={details}
        postImagesViewportWidth={postImagesViewportWidth}
      />

      <View style={styles.postActions}>
        <TouchableOpacity
          activeOpacity={0.86}
          style={[styles.postActionButton, styles.postActionButtonDefault]}
          onPress={(event: any) => {
            event.stopPropagation?.();
            onToggleLike(post);
          }}
        >
          <Ionicons
            name={(post.liked_by_me ? "heart" : "heart-outline") as IconName}
            size={20}
            color={post.liked_by_me ? "#F87171" : postColor}
          />
          <Text style={[styles.postActionText, { color: postColor }]}>
            {Number(post.likes_count ?? 0)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.86}
          style={[styles.postActionButton, styles.postActionButtonDefault]}
          onPress={(event: any) => {
            event.stopPropagation?.();
            onOpenComments(post);
          }}
        >
          <Ionicons name="chatbubble-outline" size={19} color={postColor} />
          <Text style={[styles.postActionText, { color: postColor }]}>
            {Number(post.comments_count ?? 0)}
          </Text>
        </TouchableOpacity>

        {isMine ? (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.ownerDeleteButton}
              onPress={(event: any) => {
                event.stopPropagation?.();
                onDeletePost?.(post);
              }}
            >
              <Ionicons name="trash-outline" size={17} color="#F87171" />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default CommunityPostCard;

const stylesColors = {
  cardBorder: "#28252c6f",
  cardBorderStrong: "rgba(113,113,122,0.42)",
};

const styles = StyleSheet.create({
  postCard: {
    position: "relative",
    overflow: "hidden",
    alignSelf: "center",
    borderRadius: 0,
    backgroundColor: "#0B0B0F",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    padding: 14,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  postAuthorRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  avatar: {
    width: 43,
    height: 43,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: "#18171D",
  },
  avatarFallback: {
    width: 43,
    height: 43,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: "#18171D",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 16,
    fontWeight: "900",
  },
  postAuthorInfo: { flex: 1, minWidth: 0 },
  postAuthorName: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  postAuthorMeta: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 13,
  },
  postActionButton: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  postActionButtonDefault: {
    backgroundColor: "rgba(63,63,70,0.18)",
    borderColor: "rgba(113,113,122,0.30)",
  },
  postActionText: {
    fontSize: 12,
    fontWeight: "900",
  },
  ownerActions: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  ownerDeleteButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "rgba(248,113,113,0.10)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
});
