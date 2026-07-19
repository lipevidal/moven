import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  createAudioPlayer,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import { ReactNode, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../../database/supabase";
import { ConteudoPost } from "./ConteudoPost";

type IconName = keyof typeof Ionicons.glyphMap;

export type CommunityPostConversationPost = {
  id: string;
  user_id: string;
  content?: string | null;
  image_url?: string | null;
  images?: string[] | null;
  created_at: string;
  closed_at?: string | null;
  expires_at?: string | null;
  status?: string | null;
  profile?: any;
  [key: string]: any;
};

export type CommunityPostConversationComment = {
  id: string;
  post_id: string;
  user_id: string;
  content?: string | null;
  created_at: string;
  image_url?: string | null;
  audio_url?: string | null;
  audio_duration_seconds?: number | null;
  reply_to_comment_id?: string | null;
  reply_to_author_name?: string | null;
  reply_to_content?: string | null;
  profile?: any;
};

type CommunityPostConversationProps<
  TPost extends CommunityPostConversationPost = CommunityPostConversationPost,
> = {
  visible: boolean;
  post: TPost | null;
  currentUserId: string;
  postColor: string;
  postImagesViewportWidth: number;
  postImagePairItemWidth: number;
  postImageTripleItemWidth: number;
  messageBubbleMinWidth: number;
  renderPostDetails?: (post: TPost) => ReactNode;
  onClose: () => void;
  onPostUpdated?: () => void | Promise<void>;
  onOpenDriverProfile?: (userId?: string, profile?: any) => void;
  onOpenImages?: (images: string[], index: number) => void;
  storageBucket?: string;
};

function getAudioExtension(uri: string) {
  const extension = uri.split("?")[0]?.split(".").pop()?.toLowerCase();

  if (extension === "mp3") return "mp3";
  if (extension === "wav") return "wav";
  if (extension === "aac") return "aac";
  if (extension === "caf") return "caf";

  return "m4a";
}

function getAudioContentType(extension: string) {
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "wav") return "audio/wav";
  if (extension === "aac") return "audio/aac";
  if (extension === "caf") return "audio/x-caf";

  return "audio/mp4";
}

function getImageExtension(uri: string) {
  const extension = uri.split("?")[0]?.split(".").pop()?.toLowerCase();

  if (extension === "png") return "png";
  if (extension === "webp") return "webp";

  return "jpg";
}

function getImageContentType(extension: string) {
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";

  return "image/jpeg";
}

function formatAudioDuration(seconds?: number | null) {
  const totalSeconds = Math.max(Number(seconds ?? 0), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = Math.floor(totalSeconds % 60);

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function isSameCalendarDay(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function formatDate(value?: string | null) {
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

function getReplyPreviewText(comment: CommunityPostConversationComment) {
  if (comment.content?.trim()) return comment.content.trim();
  if (comment.image_url) return "Imagem";
  if (comment.audio_url) return "Áudio";

  return "Mensagem";
}

function getPostImages(post: CommunityPostConversationPost) {
  const images = Array.isArray(post.images) ? post.images.filter(Boolean) : [];

  return images.length > 0 ? images : post.image_url ? [post.image_url] : [];
}

export function CommunityPostConversation<
  TPost extends CommunityPostConversationPost = CommunityPostConversationPost,
>({
  visible,
  post,
  currentUserId,
  postImagesViewportWidth,
  postImagePairItemWidth,
  postImageTripleItemWidth,
  messageBubbleMinWidth,
  renderPostDetails,
  onClose,
  onPostUpdated,
  onOpenDriverProfile,
  onOpenImages,
  storageBucket = "community-post-images",
}: CommunityPostConversationProps<TPost>) {
  const [comments, setComments] = useState<CommunityPostConversationComment[]>(
    [],
  );
  const [loadingComments, setLoadingComments] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [commentImageUri, setCommentImageUri] = useState("");
  const [commentAudioUri, setCommentAudioUri] = useState("");
  const [commentAudioDuration, setCommentAudioDuration] = useState(0);
  const [replyingToComment, setReplyingToComment] =
    useState<CommunityPostConversationComment | null>(null);
  const [expandedReplyGroups, setExpandedReplyGroups] = useState<
    Record<string, boolean>
  >({});
  const [recordingCommentAudio, setRecordingCommentAudio] = useState(false);
  const [playingAudioUrl, setPlayingAudioUrl] = useState("");
  const [loadingAudioUrl, setLoadingAudioUrl] = useState("");
  const [postLikesCount, setPostLikesCount] = useState(0);
  const [postLikeProfiles, setPostLikeProfiles] = useState<any[]>([]);
  const [postLikedByMe, setPostLikedByMe] = useState(false);
  const [likingPost, setLikingPost] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState("");
  const [commentsScrollY, setCommentsScrollY] = useState(0);
  const [commentsContentHeight, setCommentsContentHeight] = useState(0);
  const [commentsLayoutHeight, setCommentsLayoutHeight] = useState(0);

  const commentsScrollRef = useRef<any>(null);
  const commentInputRef = useRef<any>(null);
  const commentLayoutsRef = useRef<Record<string, number>>({});
  const commentRecordingStartTimeRef = useRef<number | null>(null);
  const commentPlayerRef = useRef<any>(null);
  const commentPlayerUrlRef = useRef("");
  const commentAudioPlayersRef = useRef<Record<string, any>>({});
  const commentAudioSubscriptionsRef = useRef<Record<string, any>>({});
  const commentAudioEndedRef = useRef<Record<string, boolean>>({});
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const safeAreaInsets = useSafeAreaInsets();
  const bottomSafeAreaSpacing = Math.max(
    Math.min(safeAreaInsets.bottom, 8),
    Platform.OS === "android" ? 4 : 6,
  );

  const postProfile = post?.profile ?? {};
  const postAuthorName = getFirstAndLastName(postProfile);
  const postAvatarUrl = getUserAvatarUrl(postProfile);
  const postPreviewImages = post ? getPostImages(post) : [];
  const canSendComment =
    Boolean(commentContent.trim() || commentImageUri || commentAudioUri) &&
    !savingComment &&
    !recordingCommentAudio;
  const commentsCanScroll = commentsContentHeight > commentsLayoutHeight + 24;
  const showScrollTopButton = commentsScrollY > 80;
  const showScrollBottomButton =
    commentsCanScroll &&
    commentsScrollY < commentsContentHeight - commentsLayoutHeight - 80;

  useEffect(() => {
    if (!visible || !post) return;

    resetCommentComposer();
    setExpandedReplyGroups({});
    setComments([]);
    setPostLikesCount(Number((post as any)?.likes_count ?? 0));
    setPostLikeProfiles([]);
    setPostLikedByMe(Boolean((post as any)?.liked_by_me));
    setLikingPost(false);
    setDeletingCommentId("");
    void loadComments(post);
    void loadPostLikes(post);
    scrollToCommentsEnd(350);
  }, [post?.id, visible]);

  async function getProfilesByUserIds(userIds: string[]) {
    if (userIds.length === 0) return {};

    const cleanUserIds = Array.from(
      new Set(userIds.map((item) => String(item ?? "").trim()).filter(Boolean)),
    );

    if (cleanUserIds.length === 0) return {};

    const profilesByUserId: Record<string, any> = {};
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("id", cleanUserIds);

    if (error) {
      console.log("Erro ao buscar profiles por id:", error);
      return {};
    }

    (data ?? []).forEach((profile: any) => {
      const profileId = String(profile?.id ?? "").trim();

      if (profileId) {
        profilesByUserId[profileId] = profile;
      }
    });

    return profilesByUserId;
  }

  async function loadComments(targetPost: CommunityPostConversationPost) {
    try {
      setLoadingComments(true);

      const { data, error } = await supabase
        .from("community_post_comments")
        .select("*")
        .eq("post_id", targetPost.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const loadedComments = data ?? [];
      const userIds = Array.from(
        new Set(
          loadedComments
            .map((comment: any) => String(comment.user_id))
            .filter(Boolean),
        ),
      ) as string[];

      const profilesByUserId = await getProfilesByUserIds(userIds);

      setComments(
        loadedComments.map((comment: any) => ({
          ...comment,
          profile: profilesByUserId[comment.user_id] ?? null,
        })),
      );
    } catch (error) {
      console.log("Erro ao carregar comentários:", error);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }

  async function loadPostLikes(targetPost: CommunityPostConversationPost) {
    try {
      setPostLikesCount(Number((targetPost as any)?.likes_count ?? 0));
      setPostLikeProfiles([]);

      const [{ data, count, error }, myLikeResult] = await Promise.all([
        supabase
          .from("community_post_likes")
          .select("user_id", { count: "exact" })
          .eq("post_id", targetPost.id)
          .order("created_at", { ascending: false })
          .limit(5),
        currentUserId
          ? supabase
              .from("community_post_likes")
              .select("user_id")
              .eq("post_id", targetPost.id)
              .eq("user_id", currentUserId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (error) throw error;
      if ((myLikeResult as any)?.error) throw (myLikeResult as any).error;

      setPostLikedByMe(Boolean((myLikeResult as any)?.data));

      const likedUserIds = Array.from(
        new Set(
          ((data ?? []) as any[])
            .map((item: any) => String(item?.user_id ?? "").trim())
            .filter(Boolean),
        ),
      ) as string[];

      if (likedUserIds.length === 0) {
        setPostLikesCount(
          Number(count ?? (targetPost as any)?.likes_count ?? 0),
        );
        setPostLikeProfiles([]);
        return;
      }

      const profilesByUserId = await getProfilesByUserIds(likedUserIds);

      setPostLikesCount(
        Number(
          count ?? (targetPost as any)?.likes_count ?? likedUserIds.length,
        ),
      );
      setPostLikeProfiles(
        likedUserIds.map((userId) => profilesByUserId[userId]).filter(Boolean),
      );
    } catch (error) {
      console.log("Erro ao carregar curtidas do post:", error);
      setPostLikesCount(Number((targetPost as any)?.likes_count ?? 0));
      setPostLikeProfiles([]);
      setPostLikedByMe(Boolean((targetPost as any)?.liked_by_me));
    }
  }

  async function uploadImage(uri: string) {
    const extension = getImageExtension(uri);
    const contentType = getImageContentType(extension);
    const path = `${currentUserId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`;
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();

    const { error } = await supabase.storage
      .from(storageBucket)
      .upload(path, arrayBuffer, { contentType, upsert: false });

    if (error) throw error;

    const { data } = supabase.storage.from(storageBucket).getPublicUrl(path);

    return data.publicUrl;
  }

  async function uploadCommentAudio(uri: string) {
    const extension = getAudioExtension(uri);
    const contentType = getAudioContentType(extension);
    const path = `${currentUserId}/comment-audios/${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`;
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();

    const { error } = await supabase.storage
      .from(storageBucket)
      .upload(path, arrayBuffer, { contentType, upsert: false });

    if (error) throw error;

    const { data } = supabase.storage.from(storageBucket).getPublicUrl(path);

    return data.publicUrl;
  }

  async function handleCreateComment() {
    if (!post || !currentUserId || savingComment) return;

    try {
      const content = commentContent.trim();

      if (!content && !commentImageUri && !commentAudioUri) {
        Alert.alert(
          "Atenção",
          "Escreva uma mensagem, envie uma imagem ou grave um áudio.",
        );
        return;
      }

      const replyTargetCommentId = replyingToComment?.id
        ? String(replyingToComment.id)
        : "";

      Keyboard.dismiss();
      setSavingComment(true);

      const [uploadedImage, uploadedAudio] = await Promise.all([
        commentImageUri ? uploadImage(commentImageUri) : Promise.resolve(null),
        commentAudioUri
          ? uploadCommentAudio(commentAudioUri)
          : Promise.resolve(null),
      ]);

      const { error } = await supabase.from("community_post_comments").insert({
        post_id: post.id,
        user_id: currentUserId,
        content: content || null,
        image_url: uploadedImage,
        audio_url: uploadedAudio,
        audio_duration_seconds: uploadedAudio ? commentAudioDuration : null,
        reply_to_comment_id: replyingToComment?.id ?? null,
        reply_to_author_name: null,
        reply_to_content: null,
      });

      if (error) throw error;

      resetCommentComposer();
      Keyboard.dismiss();
      await Promise.all([
        loadComments(post),
        Promise.resolve(onPostUpdated?.()),
      ]);

      if (replyTargetCommentId) {
        scrollToComment(replyTargetCommentId, 350);
      } else {
        scrollToCommentsEnd(350);
      }
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error?.message ?? "Não foi possível enviar a mensagem.",
      );
    } finally {
      setSavingComment(false);
    }
  }

  function resetCommentComposer() {
    setCommentContent("");
    setCommentImageUri("");
    setCommentAudioUri("");
    setCommentAudioDuration(0);
    setReplyingToComment(null);
  }

  async function pickCommentImage() {
    if (savingComment || recordingCommentAudio) return;

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso às suas fotos para responder com imagem.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.82,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setCommentImageUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Erro", "Não foi possível selecionar a imagem.");
    }
  }

  function disableAudioLoop(player: any) {
    try {
      if ("loop" in player) {
        player.loop = false;
      }
    } catch {
      // Alguns players não expõem a propriedade loop.
    }

    try {
      player?.setIsLoopingAsync?.(false);
    } catch {
      // Compatibilidade com outros players.
    }
  }

  function releaseCachedAudioPlayer(audioUrl: string) {
    const subscription = commentAudioSubscriptionsRef.current[audioUrl];
    const player = commentAudioPlayersRef.current[audioUrl];

    try {
      subscription?.remove?.();
    } catch {
      // Ignora falhas de limpeza.
    }

    try {
      player?.pause?.();
      player?.remove?.();
    } catch {
      // Ignora falhas de limpeza.
    }

    delete commentAudioSubscriptionsRef.current[audioUrl];
    delete commentAudioPlayersRef.current[audioUrl];
    delete commentAudioEndedRef.current[audioUrl];

    if (commentPlayerUrlRef.current === audioUrl) {
      commentPlayerRef.current = null;
      commentPlayerUrlRef.current = "";
    }
  }

  function releaseCachedAudioPlayers() {
    Object.entries(commentAudioSubscriptionsRef.current).forEach(
      ([, subscription]) => {
        try {
          subscription?.remove?.();
        } catch {
          // Ignora falhas de limpeza.
        }
      },
    );

    Object.entries(commentAudioPlayersRef.current).forEach(([, player]) => {
      try {
        player?.pause?.();
        player?.remove?.();
      } catch {
        // Ignora falhas de limpeza.
      }
    });

    commentAudioPlayersRef.current = {};
    commentAudioSubscriptionsRef.current = {};
    commentAudioEndedRef.current = {};
    commentPlayerRef.current = null;
    commentPlayerUrlRef.current = "";
  }

  async function stopCurrentAudioPlayer() {
    try {
      releaseCachedAudioPlayers();
    } catch (error) {
      console.log("Erro ao parar áudio:", error);
    } finally {
      setPlayingAudioUrl("");
      setLoadingAudioUrl("");
    }
  }

  function getCachedAudioPlayer(audioUrl: string) {
    return commentAudioPlayersRef.current[audioUrl] ?? null;
  }

  function saveCachedAudioPlayer(audioUrl: string, player: any) {
    disableAudioLoop(player);
    commentAudioPlayersRef.current[audioUrl] = player;

    const oldSubscription = commentAudioSubscriptionsRef.current[audioUrl];
    oldSubscription?.remove?.();

    const subscription = player.addListener?.(
      "playbackStatusUpdate",
      (status: any) => {
        const finished =
          status?.didJustFinish ||
          status?.playbackState === "ended" ||
          (status?.isLoaded === true && status?.didJustFinish === true);

        if (!finished) return;

        commentAudioEndedRef.current[audioUrl] = true;

        try {
          player?.pause?.();
        } catch {
          // Ignora falhas de pausa.
        }

        if (commentPlayerUrlRef.current === audioUrl) {
          setPlayingAudioUrl("");
          setLoadingAudioUrl("");
        }

        releaseCachedAudioPlayer(audioUrl);
      },
    );

    commentAudioSubscriptionsRef.current[audioUrl] = subscription;
  }

  async function prepareAudioPlayer(audioUrl: string) {
    const cachedPlayer = getCachedAudioPlayer(audioUrl);

    if (cachedPlayer) {
      return cachedPlayer;
    }

    await setAudioModeAsync({ playsInSilentMode: true });

    const player = createAudioPlayer({ uri: audioUrl });
    disableAudioLoop(player);
    saveCachedAudioPlayer(audioUrl, player);

    return player;
  }

  async function startCommentAudioRecording() {
    if (savingComment || commentAudioUri) return;

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso ao microfone para responder com áudio.",
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      commentRecordingStartTimeRef.current = Date.now();
      setRecordingCommentAudio(true);
    } catch (error) {
      console.log("Erro ao gravar áudio:", error);
      Alert.alert("Erro", "Não foi possível iniciar a gravação do áudio.");
      setRecordingCommentAudio(false);
      commentRecordingStartTimeRef.current = null;
    }
  }

  async function stopCommentAudioRecording() {
    if (!recordingCommentAudio) {
      setRecordingCommentAudio(false);
      return;
    }

    try {
      const startedAt = commentRecordingStartTimeRef.current;
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });

      const uri = audioRecorder.uri;
      const durationSeconds = startedAt
        ? Math.max(Math.round((Date.now() - startedAt) / 1000), 1)
        : 1;

      if (uri) {
        setCommentAudioUri(uri);
        setCommentAudioDuration(durationSeconds);
      }
    } catch (error) {
      Alert.alert("Erro", "Não foi possível finalizar a gravação do áudio.");
    } finally {
      setRecordingCommentAudio(false);
      commentRecordingStartTimeRef.current = null;
    }
  }

  async function cancelCommentAudioRecording() {
    try {
      if (recordingCommentAudio) {
        await audioRecorder.stop();
      }

      await setAudioModeAsync({ allowsRecording: false });
    } catch (error) {
      console.log("Erro ao cancelar áudio:", error);
    } finally {
      setRecordingCommentAudio(false);
      setCommentAudioUri("");
      setCommentAudioDuration(0);
      commentRecordingStartTimeRef.current = null;
    }
  }

  async function togglePlayAudio(audioUrl?: string | null) {
    const cleanAudioUrl = String(audioUrl ?? "").trim();
    if (!cleanAudioUrl || loadingAudioUrl === cleanAudioUrl) return;

    try {
      const cachedPlayer = getCachedAudioPlayer(cleanAudioUrl);

      if (playingAudioUrl === cleanAudioUrl && cachedPlayer) {
        cachedPlayer.pause?.();
        setPlayingAudioUrl("");
        return;
      }

      setLoadingAudioUrl(cleanAudioUrl);

      await new Promise((resolve) => setTimeout(resolve, 40));

      Object.entries(commentAudioPlayersRef.current).forEach(
        ([audioUrlItem, player]) => {
          if (audioUrlItem === cleanAudioUrl) return;

          try {
            player?.pause?.();
          } catch {
            // Ignora falhas de pausa.
          }
        },
      );

      const player = await prepareAudioPlayer(cleanAudioUrl);

      commentPlayerRef.current = player;
      commentPlayerUrlRef.current = cleanAudioUrl;

      if (commentAudioEndedRef.current[cleanAudioUrl]) {
        releaseCachedAudioPlayer(cleanAudioUrl);
        const freshPlayer = await prepareAudioPlayer(cleanAudioUrl);
        commentPlayerRef.current = freshPlayer;
        commentPlayerUrlRef.current = cleanAudioUrl;
        await Promise.resolve(freshPlayer.play?.());
      } else {
        await Promise.resolve(player.play?.());
      }

      setPlayingAudioUrl(cleanAudioUrl);
    } catch (error) {
      console.log("Erro ao reproduzir áudio:", error);
      Alert.alert("Erro", "Não foi possível reproduzir o áudio.");
      setPlayingAudioUrl("");
    } finally {
      setLoadingAudioUrl("");
    }
  }

  function handleCommentLongPress(comment: CommunityPostConversationComment) {
    if (!post) return;

    Alert.alert("Mensagem", "O que deseja fazer?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Responder", onPress: () => handleStartReply(comment) },
    ]);
  }

  function scrollToCommentsEnd(delay = 250) {
    setTimeout(
      () => commentsScrollRef.current?.scrollToEnd({ animated: true }),
      delay,
    );
  }

  function scrollToCommentsTop(delay = 0) {
    setTimeout(
      () => commentsScrollRef.current?.scrollTo({ y: 0, animated: true }),
      delay,
    );
  }

  function saveCommentLayout(commentId: string, event: any) {
    const cleanCommentId = String(commentId ?? "").trim();
    if (!cleanCommentId) return;

    commentLayoutsRef.current[cleanCommentId] = Math.max(
      Number(event?.nativeEvent?.layout?.y ?? 0),
      0,
    );
  }

  function scrollToComment(commentId: string, delay = 80) {
    const cleanCommentId = String(commentId ?? "").trim();
    if (!cleanCommentId) return;

    setTimeout(() => {
      const commentY = commentLayoutsRef.current[cleanCommentId];

      if (typeof commentY !== "number") return;

      commentsScrollRef.current?.scrollTo({
        y: Math.max(commentY, 0),
        animated: true,
      });
    }, delay);
  }

  function handleCommentsScroll(event: any) {
    setCommentsScrollY(Number(event?.nativeEvent?.contentOffset?.y ?? 0));
  }

  function closeConversation() {
    setCommentsScrollY(0);
    setCommentsContentHeight(0);
    setCommentsLayoutHeight(0);
    resetCommentComposer();
    setExpandedReplyGroups({});
    void stopCurrentAudioPlayer();
    onClose();
  }

  function openDriverProfile(userId?: string, profile?: any) {
    onOpenDriverProfile?.(userId, profile);
  }

  async function handleTogglePostLike() {
    if (!post || !currentUserId || likingPost) return;

    const previousLiked = postLikedByMe;
    const previousCount = postLikesCount;

    try {
      setLikingPost(true);
      setPostLikedByMe(!previousLiked);
      setPostLikesCount((current) =>
        Math.max(current + (previousLiked ? -1 : 1), 0),
      );

      if (previousLiked) {
        const { error } = await supabase
          .from("community_post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("community_post_likes").upsert(
          {
            post_id: post.id,
            user_id: currentUserId,
          },
          { onConflict: "post_id,user_id" },
        );

        if (error) throw error;
      }

      await Promise.all([
        loadPostLikes(post),
        Promise.resolve(onPostUpdated?.()),
      ]);
    } catch (error: any) {
      setPostLikedByMe(previousLiked);
      setPostLikesCount(previousCount);
      Alert.alert(
        "Erro",
        error?.message ?? "Não foi possível atualizar a curtida.",
      );
    } finally {
      setLikingPost(false);
    }
  }

  function renderPostLikesSummary() {
    const visibleProfiles = postLikeProfiles.slice(0, 5);

    return (
      <View style={styles.postLikesSummaryRow}>
        <TouchableOpacity
          activeOpacity={0.84}
          style={styles.postLikeButton}
          disabled={likingPost || !post}
          onPress={handleTogglePostLike}
        >
          {likingPost ? (
            <ActivityIndicator size="small" color="#D4A64A" />
          ) : (
            <Ionicons
              name={(postLikedByMe ? "heart" : "heart-outline") as IconName}
              size={24}
              color={postLikedByMe ? "#EF4444" : "#D4A64A"}
            />
          )}
        </TouchableOpacity>

        {postLikesCount > 0 ? (
          <>
            {visibleProfiles.length > 0 ? (
              <View style={styles.postLikeAvatarsStack}>
                {visibleProfiles.map((profile, index) => {
                  const avatarUrl = getUserAvatarUrl(profile);
                  const displayName = getFirstAndLastName(profile);

                  return (
                    <View
                      key={`post-like-profile-${String(profile?.id ?? index)}`}
                      style={[
                        styles.postLikeAvatarWrap,
                        {
                          marginLeft: index === 0 ? 0 : -8,
                          zIndex: visibleProfiles.length - index,
                        },
                      ]}
                    >
                      {avatarUrl ? (
                        <Image
                          source={{ uri: avatarUrl }}
                          style={styles.postLikeAvatar}
                        />
                      ) : (
                        <View style={styles.postLikeAvatarFallback}>
                          <Text style={styles.postLikeAvatarText}>
                            {displayName.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : null}

            <Text style={styles.postLikesSummaryText}>
              {postLikesCount} curtida{postLikesCount === 1 ? "" : "s"}
            </Text>
          </>
        ) : (
          <Text style={styles.postLikesSummaryTextMuted}>
            Seja o primeiro a curtir
          </Text>
        )}
      </View>
    );
  }

  function openImages(images: string[], index = 0) {
    const cleanImages = images
      .map((image) => String(image ?? "").trim())
      .filter(Boolean);

    if (cleanImages.length === 0) return;

    const safeIndex = Math.min(Math.max(index, 0), cleanImages.length - 1);

    onOpenImages?.(cleanImages, safeIndex);
  }

  function handleStartReply(comment: CommunityPostConversationComment) {
    setReplyingToComment(comment);
    scrollToComment(comment.id, 40);

    setTimeout(() => {
      commentInputRef.current?.focus?.();
    }, 160);
  }

  function openReplyGroup(commentId: string) {
    setExpandedReplyGroups((current) => ({
      ...current,
      [String(commentId)]: true,
    }));
  }

  async function handleDeleteComment(
    comment: CommunityPostConversationComment,
  ) {
    if (!post || deletingCommentId || comment.user_id !== currentUserId) return;

    Alert.alert(
      "Excluir comentário",
      "Deseja excluir este comentário e todas as respostas dele?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingCommentId(comment.id);

              const deletedAt = new Date().toISOString();
              const commentIdsToDelete = [
                comment.id,
                ...comments
                  .filter((item) => item.reply_to_comment_id === comment.id)
                  .map((item) => item.id),
              ];

              const { error } = await supabase
                .from("community_post_comments")
                .update({ deleted_at: deletedAt })
                .in("id", commentIdsToDelete);

              if (error) throw error;

              setComments((current) =>
                current.filter((item) => !commentIdsToDelete.includes(item.id)),
              );

              if (
                replyingToComment?.id &&
                commentIdsToDelete.includes(replyingToComment.id)
              ) {
                setReplyingToComment(null);
              }

              await Promise.all([
                loadComments(post),
                Promise.resolve(onPostUpdated?.()),
              ]);
            } catch (error: any) {
              Alert.alert(
                "Erro",
                error?.message ?? "Não foi possível excluir o comentário.",
              );
            } finally {
              setDeletingCommentId("");
            }
          },
        },
      ],
    );
  }

  function renderComment(
    comment: CommunityPostConversationComment,
    childComments: CommunityPostConversationComment[] = [],
    nested = false,
  ) {
    const profile = comment.profile ?? {};
    const name = getFirstAndLastName(profile);
    const avatarUrl = getUserAvatarUrl(profile);
    const isMine = comment.user_id === currentUserId;
    const audioUrl = String(comment.audio_url || "");
    const isAudioLoading = Boolean(audioUrl && loadingAudioUrl === audioUrl);
    const isPlaying = Boolean(audioUrl && playingAudioUrl === audioUrl);
    const totalChildComments = childComments.length;
    const hasManyChildComments = totalChildComments > 1;
    const childCommentsExpanded = Boolean(
      expandedReplyGroups[String(comment.id)],
    );
    const shouldShowChildComments =
      !nested &&
      totalChildComments > 0 &&
      (!hasManyChildComments || childCommentsExpanded);
    const shouldShowViewRepliesButton =
      !nested && hasManyChildComments && !childCommentsExpanded;

    return (
      <View
        key={comment.id}
        onLayout={(event: any) => {
          if (!nested) {
            saveCommentLayout(comment.id, event);
          }
        }}
        style={[
          styles.commentThreadRow,
          nested && styles.commentThreadRowNested,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.86}
          style={[
            styles.commentThreadAvatarButton,
            nested && styles.commentThreadAvatarButtonNested,
          ]}
          onPress={() => openDriverProfile(comment.user_id, profile)}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={[
                styles.commentThreadAvatar,
                nested && styles.commentThreadAvatarNested,
              ]}
            />
          ) : (
            <View
              style={[
                styles.commentThreadAvatarFallback,
                nested && styles.commentThreadAvatarNested,
              ]}
            >
              <Text style={styles.commentThreadAvatarText}>
                {(isMine ? "Você" : name).slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.commentThreadContent}>
          <View style={styles.commentThreadHeaderLine}>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => openDriverProfile(comment.user_id, profile)}
            >
              <Text style={styles.commentThreadAuthor} numberOfLines={1}>
                {isMine ? "Você" : name}
              </Text>
            </TouchableOpacity>

            <Text style={styles.commentThreadDot}>·</Text>

            <Text style={styles.commentThreadDate}>
              {formatDate(comment.created_at)}
            </Text>

            {isMine ? (
              <TouchableOpacity
                activeOpacity={0.82}
                style={styles.commentDeleteButton}
                disabled={deletingCommentId === comment.id}
                onPress={() => handleDeleteComment(comment)}
              >
                {deletingCommentId === comment.id ? (
                  <ActivityIndicator size="small" color="#FCA5A5" />
                ) : (
                  <Ionicons name="trash-outline" size={16} color="#FCA5A5" />
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          {comment.content ? (
            <Text style={styles.commentThreadText}>{comment.content}</Text>
          ) : null}

          {comment.image_url ? (
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.commentThreadImageWrap}
              onPress={() => openImages([String(comment.image_url)], 0)}
            >
              <Image
                source={{ uri: String(comment.image_url) }}
                style={styles.commentThreadImage}
                resizeMode="cover"
                onError={(error: any) =>
                  console.log("Erro ao carregar imagem do comentário:", error)
                }
              />
            </TouchableOpacity>
          ) : null}

          {comment.audio_url ? (
            <TouchableOpacity
              activeOpacity={0.86}
              style={[
                styles.commentThreadAudioBox,
                isAudioLoading && styles.messageAudioBoxLoading,
              ]}
              disabled={isAudioLoading}
              onPress={() => togglePlayAudio(audioUrl)}
            >
              <View style={styles.commentThreadAudioPlayButton}>
                {isAudioLoading ? (
                  <ActivityIndicator size="small" color="#080808" />
                ) : (
                  <Ionicons
                    name={(isPlaying ? "pause" : "play") as IconName}
                    size={15}
                    color="#080808"
                  />
                )}
              </View>

              <View style={styles.commentThreadAudioWave}>
                {Array.from({ length: 18 }).map((_, index) => (
                  <View
                    key={`audio-wave-${comment.id}-${index}`}
                    style={[
                      styles.commentThreadAudioLine,
                      {
                        height: [12, 20, 15, 26, 18, 23][index % 6],
                        opacity: isPlaying || isAudioLoading ? 0.92 : 0.58,
                      },
                    ]}
                  />
                ))}
              </View>

              <Text style={styles.commentThreadAudioDuration}>
                {formatAudioDuration(comment.audio_duration_seconds)}
              </Text>
            </TouchableOpacity>
          ) : null}

          {!nested ? (
            <View style={styles.commentThreadActionsRow}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => handleStartReply(comment)}
              >
                <Text style={styles.commentThreadActionText}>Responder</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {shouldShowViewRepliesButton ? (
            <TouchableOpacity
              activeOpacity={0.82}
              style={styles.commentThreadViewRepliesButton}
              onPress={() => openReplyGroup(comment.id)}
            >
              <Ionicons
                name="chevron-down-circle-outline"
                size={15}
                color="#D4A64A"
              />
              <Text style={styles.commentThreadViewRepliesText}>
                Ver {totalChildComments} respostas
              </Text>
            </TouchableOpacity>
          ) : null}

          {shouldShowChildComments ? (
            <View style={styles.commentThreadChildrenBox}>
              {childComments.map((childComment) =>
                renderComment(childComment, [], true),
              )}
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  function renderCommentsList() {
    const commentsByParentId: Record<
      string,
      CommunityPostConversationComment[]
    > = {};
    const rootComments: CommunityPostConversationComment[] = [];
    const existingCommentIds = new Set(
      comments.map((comment) => String(comment.id)),
    );

    comments.forEach((comment) => {
      const parentId = comment.reply_to_comment_id
        ? String(comment.reply_to_comment_id)
        : "";

      if (parentId && existingCommentIds.has(parentId)) {
        if (!commentsByParentId[parentId]) {
          commentsByParentId[parentId] = [];
        }

        commentsByParentId[parentId].push(comment);
        return;
      }

      rootComments.push(comment);
    });

    return rootComments.map((comment) =>
      renderComment(comment, commentsByParentId[String(comment.id)] ?? []),
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={closeConversation}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.commentsModalCard} onTouchStart={Keyboard.dismiss}>
          <View style={styles.chatHeader}>
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.chatBackButton}
              onPress={closeConversation}
            >
              <Ionicons name="chevron-back" size={20} color="#F5F0E6" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.chatHeaderLeft}
              onPress={() => openDriverProfile(post?.user_id, postProfile)}
            >
              {postAvatarUrl ? (
                <Image
                  source={{ uri: postAvatarUrl }}
                  style={styles.chatHeaderAvatar}
                />
              ) : (
                <View style={styles.chatHeaderAvatarFallback}>
                  <Text style={styles.chatHeaderAvatarText}>
                    {postAuthorName.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.chatHeaderInfo}>
                <Text style={styles.chatHeaderName} numberOfLines={1}>
                  {postAuthorName}
                </Text>
                <Text style={styles.chatHeaderDate} numberOfLines={1}>
                  {formatDate(post?.created_at)}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.modalCloseButton}
              onPress={closeConversation}
            >
              <Ionicons name="close" size={22} color="#F5F0E6" />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={commentsScrollRef}
            style={styles.commentsScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onTouchStart={Keyboard.dismiss}
            contentContainerStyle={styles.commentsList}
            onScroll={handleCommentsScroll}
            scrollEventThrottle={16}
            onLayout={(event: any) =>
              setCommentsLayoutHeight(
                Number(event?.nativeEvent?.layout?.height ?? 0),
              )
            }
            onContentSizeChange={(_width: number, height: number) => {
              setCommentsContentHeight(Number(height ?? 0));
            }}
          >
            {post ? (
              <View style={styles.postContentPreviewSlot}>
                <ConteudoPost
                  post={post}
                  details={renderPostDetails?.(post)}
                  postImagesViewportWidth={postImagesViewportWidth}
                />

                {renderPostLikesSummary()}
              </View>
            ) : null}

            {loadingComments ? (
              <View style={styles.commentsLoadingBox}>
                <ActivityIndicator color="#D4A64A" />
                <Text style={styles.loadingText}>Carregando mensagens...</Text>
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.commentsEmptyBox}>
                <Ionicons name="chatbubble-outline" size={34} color="#8F8A91" />
                <Text style={styles.emptyTitle}>Nenhuma mensagem</Text>
                <Text style={styles.emptyText}>
                  Seja o primeiro a responder.
                </Text>
              </View>
            ) : (
              renderCommentsList()
            )}
          </ScrollView>

          {showScrollTopButton ? (
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.commentsScrollTopButton}
              onPress={() => scrollToCommentsTop()}
            >
              <Ionicons name="arrow-up" size={20} color="#080808" />
            </TouchableOpacity>
          ) : null}

          {showScrollBottomButton ? (
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.commentsScrollBottomButton}
              onPress={() => scrollToCommentsEnd(0)}
            >
              <Ionicons name="arrow-down" size={20} color="#080808" />
            </TouchableOpacity>
          ) : null}

          <View
            style={[
              styles.commentComposerBox,
              { paddingBottom: bottomSafeAreaSpacing },
            ]}
          >
            {replyingToComment ? (
              <View style={styles.replyComposerPreview}>
                <View style={styles.replyComposerBar} />
                <View style={styles.replyComposerInfo}>
                  <Text style={styles.replyComposerName}>
                    Respondendo{" "}
                    {getFirstAndLastName(replyingToComment.profile ?? {})}
                  </Text>
                  <Text style={styles.replyComposerText} numberOfLines={1}>
                    {getReplyPreviewText(replyingToComment)}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => setReplyingToComment(null)}
                >
                  <Ionicons name="close" size={18} color="#8F8A91" />
                </TouchableOpacity>
              </View>
            ) : null}

            {commentImageUri ? (
              <View style={styles.commentMediaPreview}>
                <Image
                  source={{ uri: commentImageUri }}
                  style={styles.commentMediaPreviewImage}
                  resizeMode="contain"
                />
                <View style={styles.commentMediaPreviewOverlay} />
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={styles.commentMediaRemoveButton}
                  onPress={() => setCommentImageUri("")}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : null}

            {commentAudioUri ? (
              <View style={styles.audioComposerPreview}>
                <Ionicons name="mic" size={18} color="#D4A64A" />
                <Text style={styles.audioComposerText}>
                  Áudio gravado · {formatAudioDuration(commentAudioDuration)}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => {
                    setCommentAudioUri("");
                    setCommentAudioDuration(0);
                  }}
                >
                  <Ionicons name="close" size={18} color="#8F8A91" />
                </TouchableOpacity>
              </View>
            ) : null}

            {recordingCommentAudio ? (
              <View style={styles.recordingRow}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>Gravando áudio...</Text>
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={styles.recordingCancelButton}
                  onPress={cancelCommentAudioRecording}
                >
                  <Text style={styles.recordingCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={styles.recordingStopButton}
                  onPress={stopCommentAudioRecording}
                >
                  <Ionicons name="stop" size={16} color="#080808" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.commentInputRow}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={styles.commentAttachButton}
                  disabled={savingComment}
                  onPress={pickCommentImage}
                >
                  <Ionicons name="image-outline" size={21} color="#D4A64A" />
                </TouchableOpacity>

                <TextInput
                  ref={commentInputRef}
                  value={commentContent}
                  onChangeText={setCommentContent}
                  placeholder="Mensagem"
                  placeholderTextColor="#8F8A91"
                  style={styles.commentInput}
                  multiline
                  blurOnSubmit={false}
                />

                <TouchableOpacity
                  activeOpacity={0.86}
                  style={styles.commentAttachButton}
                  disabled={savingComment || Boolean(commentAudioUri)}
                  onPress={startCommentAudioRecording}
                >
                  <Ionicons name="mic-outline" size={21} color="#D4A64A" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.86}
                  style={[
                    styles.commentSendButton,
                    !canSendComment && styles.commentSendButtonDisabled,
                  ]}
                  disabled={!canSendComment}
                  onPress={handleCreateComment}
                >
                  {savingComment ? (
                    <ActivityIndicator color="#080808" />
                  ) : (
                    <Ionicons name="send" size={18} color="#080808" />
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default CommunityPostConversation;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.76)",
    justifyContent: "flex-end",
  },
  commentsModalCard: {
    position: "relative",
    height: "100%",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: "#070707",
    borderWidth: 0,
    borderColor: "#2A2830",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  chatHeader: {
    minHeight: 92,
    borderRadius: 0,
    backgroundColor: "#101014",
    borderWidth: 0,
    borderBottomWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
    paddingTop: 30,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 0,
  },
  chatBackButton: {
    width: 40,
    height: 40,
    borderRadius: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -10,
  },
  chatHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  chatHeaderAvatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#18171D",
  },
  chatHeaderAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeaderAvatarText: { color: "#D4A64A", fontSize: 15, fontWeight: "900" },
  chatHeaderInfo: { flex: 1, minWidth: 0 },
  modalEyebrow: {
    color: "#D4A64A",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  chatHeaderName: {
    color: "#F5F0E6",
    fontSize: 16,
    fontWeight: "900",
  },
  chatHeaderDate: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  commentsScroll: {
    flex: 1,
  },
  commentsList: {
    paddingHorizontal: 0,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 0,
  },
  postLikesSummaryRow: {
    minHeight: 34,
    marginTop: 10,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  postLikeButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  postLikesSummaryTextMuted: {
    color: "#8F8A91",
    fontSize: 12,
    fontWeight: "800",
  },
  postLikeAvatarsStack: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 0,
    paddingRight: 2,
  },
  postLikeAvatarWrap: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#070707",
    borderWidth: 2,
    borderColor: "#070707",
    overflow: "hidden",
  },
  postLikeAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#18171D",
  },
  postLikeAvatarFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#18171D",
    alignItems: "center",
    justifyContent: "center",
  },
  postLikeAvatarText: {
    color: "#D4A64A",
    fontSize: 10,
    fontWeight: "900",
  },
  postLikesSummaryText: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "900",
  },
  postContentPreviewSlot: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245,240,230,0.08)",
    marginBottom: 10,
    paddingBottom: 10,
    paddingHorizontal: 14,
  },
  commentPostPreview: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 0,
    backgroundColor: "#0D0D11",
    borderWidth: 0,
    borderBottomWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 0,
  },
  postPreviewAuthorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  postPreviewAvatar: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
  },
  postPreviewAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  postPreviewAvatarText: { color: "#D4A64A", fontSize: 14, fontWeight: "900" },
  postPreviewAuthorInfo: { flex: 1 },
  postPreviewAuthorName: { color: "#F5F0E6", fontSize: 13, fontWeight: "900" },
  postPreviewDate: {
    color: "#8F8A91",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  commentPostPreviewText: {
    color: "#D8D1C4",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 10,
  },
  commentPostPreviewImagesList: {
    gap: 8,
    paddingTop: 12,
    paddingRight: 4,
  },
  commentPostPreviewImageWrap: {
    position: "relative",
    overflow: "hidden",
    height: 118,
    borderRadius: 16,
    backgroundColor: "#050505",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
  },
  commentPostPreviewImageExtraWrap: {
    width: 138,
  },
  commentPostPreviewImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#050505",
  },
  commentPostPreviewImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  commentPostPreviewImageBadge: {
    position: "absolute",
    right: 7,
    top: 7,
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "rgba(5,5,5,0.66)",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.14)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  commentPostPreviewImageBadgeText: {
    color: "#F5F0E6",
    fontSize: 9,
    fontWeight: "900",
  },
  commentsLoadingBox: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#9B969B",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 12,
  },
  commentsEmptyBox: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyTitle: {
    color: "#F5F0E6",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: "#9B969B",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    textAlign: "center",
  },
  commentsScrollTopButton: {
    position: "absolute",
    top: 178,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#D4A64A",
    borderWidth: 2,
    borderColor: "#070707",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  commentsScrollBottomButton: {
    position: "absolute",
    right: 8,
    bottom: 92,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#D4A64A",
    borderWidth: 2,
    borderColor: "#070707",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  commentComposerBox: {
    borderTopWidth: 1,
    borderTopColor: "rgba(245,240,230,0.08)",
    paddingTop: 8,
    paddingHorizontal: 0,
    gap: 8,
  },
  replyComposerPreview: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  replyComposerBar: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 999,
    backgroundColor: "#D4A64A",
  },
  replyComposerInfo: { flex: 1, minWidth: 0 },
  replyComposerName: { color: "#E8D49B", fontSize: 11, fontWeight: "900" },
  replyComposerText: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  commentMediaPreview: {
    alignSelf: "flex-start",
    position: "relative",
    overflow: "hidden",
    width: 96,
    height: 78,
    borderRadius: 16,
    backgroundColor: "#050505",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
  },
  commentMediaPreviewImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#050505",
  },
  commentMediaPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  commentMediaRemoveButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.70)",
    alignItems: "center",
    justifyContent: "center",
  },
  audioComposerPreview: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  audioComposerText: {
    flex: 1,
    color: "#D8D1C4",
    fontSize: 12,
    fontWeight: "800",
  },
  recordingRow: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "rgba(248,113,113,0.10)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.24)",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordingDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#F87171",
  },
  recordingText: { flex: 1, color: "#FCA5A5", fontSize: 12, fontWeight: "900" },
  recordingCancelButton: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: "#18171D",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingCancelText: { color: "#FCA5A5", fontSize: 11, fontWeight: "900" },
  recordingStopButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#FCA5A5",
    alignItems: "center",
    justifyContent: "center",
  },
  commentInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  commentAttachButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  commentInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 118,
    borderRadius: 18,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 13,
    paddingTop: 11,
    paddingBottom: 10,
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "700",
  },
  commentSendButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
  },
  commentSendButtonDisabled: { opacity: 0.45 },
  commentThreadRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 10,
  },
  commentThreadAvatarButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 2,
  },
  commentThreadAvatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#18171D",
  },
  commentThreadAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  commentThreadAvatarText: {
    color: "#D4A64A",
    fontSize: 13,
    fontWeight: "900",
  },
  commentThreadContent: {
    flex: 1,
    minWidth: 0,
  },
  commentThreadRowNested: {
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 10,
  },
  commentThreadAvatarButtonNested: {
    width: 28,
    height: 28,
    marginTop: 2,
  },
  commentThreadAvatarNested: {
    width: 28,
    height: 28,
    borderRadius: 999,
  },
  commentThreadViewRepliesButton: {
    alignSelf: "flex-start",
    minHeight: 30,
    borderRadius: 999,
    marginTop: 2,
    marginBottom: 2,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  commentThreadViewRepliesText: {
    color: "#D4A64A",
    fontSize: 12,
    fontWeight: "900",
  },
  commentThreadChildrenBox: {
    marginTop: 4,
    marginBottom: 8,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(245,240,230,0.08)",
    paddingLeft: 10,
    paddingBottom: 8,
  },

  commentThreadHeaderLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  commentThreadAuthor: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "900",
  },
  commentThreadDot: {
    color: "#8F8A91",
    fontSize: 13,
    fontWeight: "800",
  },
  commentThreadDate: {
    color: "#8F8A91",
    fontSize: 12,
    fontWeight: "700",
  },
  commentDeleteButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    marginLeft: "auto",
    alignItems: "center",
    justifyContent: "center",
  },
  commentThreadText: {
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    marginTop: 2,
  },
  commentThreadReplyBox: {
    borderLeftWidth: 3,
    borderLeftColor: "#D4A64A",
    backgroundColor: "#101014",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 8,
    marginTop: 7,
    marginBottom: 4,
  },
  commentThreadReplyAuthor: {
    color: "#E8D49B",
    fontSize: 11,
    fontWeight: "900",
  },
  commentThreadReplyText: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    lineHeight: 16,
  },
  commentThreadImageWrap: {
    position: "relative",
    overflow: "hidden",
    alignSelf: "flex-start",
    width: "88%",
    maxWidth: 290,
    height: 160,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
    marginTop: 8,
  },
  commentThreadImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#18171D",
  },
  commentThreadAudioBox: {
    alignSelf: "flex-start",
    width: "88%",
    maxWidth: 290,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  commentThreadAudioPlayButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
  },
  commentThreadAudioWave: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 3,
  },
  commentThreadAudioLine: {
    flex: 1,
    maxWidth: 5,
    minWidth: 3,
    borderRadius: 999,
    backgroundColor: "#9B969B",
  },
  commentThreadAudioDuration: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "900",
  },
  commentThreadActionsRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  commentThreadActionText: {
    color: "#8F8A91",
    fontSize: 12,
    fontWeight: "900",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginVertical: 3,
    paddingRight: 34,
  },
  messageRowMine: {
    justifyContent: "flex-end",
    paddingRight: 0,
    paddingLeft: 0,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#18171D",
  },
  messageAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  messageAvatarText: { color: "#D4A64A", fontSize: 12, fontWeight: "900" },
  messageBubble: { maxWidth: "88%", borderRadius: 18, padding: 10 },
  messageBubbleMine: {
    backgroundColor: "#075E54",
    borderTopRightRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(134,239,172,0.12)",
  },
  messageBubbleOther: {
    backgroundColor: "#202C33",
    borderTopLeftRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  messageHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 3,
  },
  messageAuthor: {
    flexShrink: 1,
    color: "#D4A64A",
    fontSize: 11,
    fontWeight: "900",
  },
  messageAuthorMine: { color: "#BBF7D0" },
  messageDate: {
    color: "rgba(245,240,230,0.52)",
    fontSize: 9,
    fontWeight: "800",
  },
  messageReplyBox: {
    borderLeftWidth: 3,
    borderLeftColor: "#D4A64A",
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 10,
    padding: 8,
    marginBottom: 7,
  },
  messageReplyAuthor: { color: "#E8D49B", fontSize: 10, fontWeight: "900" },
  messageReplyText: {
    color: "rgba(245,240,230,0.74)",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    lineHeight: 15,
  },
  messageImageWrap: {
    position: "relative",
    overflow: "hidden",
    alignSelf: "stretch",
    width: "100%",
    height: 154,
    borderRadius: 15,
    backgroundColor: "#050505",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.08)",
    marginTop: 7,
  },
  messageImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#050505",
  },
  messageImageDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  messageAudioBox: {
    minWidth: 210,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.20)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 9,
    marginTop: 6,
  },
  messageAudioBoxLoading: {
    opacity: 0.82,
  },
  messageAudioPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
  },
  messageAudioWave: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 3,
  },
  messageAudioLine: {
    flex: 1,
    maxWidth: 5,
    minWidth: 3,
    borderRadius: 999,
    backgroundColor: "rgba(245,240,230,0.62)",
  },
  messageAudioDuration: { color: "#F5F0E6", fontSize: 11, fontWeight: "900" },
  messageText: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 3,
  },
  messageTextMine: { color: "#FFFFFF" },
});
