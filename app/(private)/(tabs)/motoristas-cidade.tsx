import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../../src/database/supabase";

type IconName = keyof typeof Ionicons.glyphMap;
type FeedFilter = "all" | "mine";
type PostCategory = "general" | "event" | "question" | "performance";

type CommunityPost = {
  id: string;
  user_id: string;
  city: string;
  category: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  deleted_at?: string | null;
  profile?: any;
  liked_by_me?: boolean;
  likes_count?: number;
  comments_count?: number;
};

type CommunityComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: any;
};

const postCategories: {
  id: PostCategory;
  label: string;
  icon: IconName;
  color: string;
}[] = [
  {
    id: "general",
    label: "Geral",
    icon: "chatbubble-ellipses-outline",
    color: "#D4A64A",
  },
  { id: "event", label: "Evento", icon: "calendar-outline", color: "#60A5FA" },
  {
    id: "question",
    label: "Dúvida",
    icon: "help-circle-outline",
    color: "#FACC15",
  },
  {
    id: "performance",
    label: "Desempenho",
    icon: "trending-up-outline",
    color: "#22C55E",
  },
];

const MY_PROFILE_ROUTE = "/(private)/(tabs)/perfil";

function normalizeCity(value?: string | null) {
  return String(value ?? "").trim();
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

function getUsername(user: any) {
  const username = String(user?.username ?? "").trim();
  return username ? `@${username}` : user?.email || "Membro da comunidade";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCategoryInfo(category?: string | null) {
  return (
    postCategories.find((item) => item.id === category) ?? postCategories[0]
  );
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

export default function CommunityFeedScreen() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [profileCity, setProfileCity] = useState("");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedFullImageUrl, setSelectedFullImageUrl] = useState<
    string | null
  >(null);
  const [postCategory, setPostCategory] = useState<PostCategory>("general");
  const [postContent, setPostContent] = useState("");
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [savingPost, setSavingPost] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [savingComment, setSavingComment] = useState(false);

  const commentsScrollRef = useRef<any>(null);

  const visiblePosts = useMemo(() => {
    if (filter === "mine") {
      return posts.filter(
        (post) => String(post.user_id) === String(currentUserId),
      );
    }

    return posts;
  }, [posts, filter, currentUserId]);

  const myPostsCount = useMemo(
    () =>
      posts.filter((post) => String(post.user_id) === String(currentUserId))
        .length,
    [posts, currentUserId],
  );

  useFocusEffect(
    useCallback(() => {
      loadCommunity();
    }, []),
  );

  async function loadCommunity(showRefresh = false) {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      const userId = user?.id ?? "";
      setCurrentUserId(userId);

      if (!userId) {
        setCurrentProfile(null);
        setProfileCity("");
        setPosts([]);
        return;
      }

      const profile = await getLoggedProfile(userId, user);
      const city = normalizeCity(
        profile?.city ||
          user?.user_metadata?.city ||
          user?.user_metadata?.profile_city ||
          user?.user_metadata?.municipality,
      );

      setCurrentProfile(profile);
      setProfileCity(city);

      if (!city) {
        setPosts([]);
        return;
      }

      await loadPosts(city, userId);
    } catch (error) {
      console.log("Erro ao carregar comunidade:", error);
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function getLoggedProfile(userId: string, user: any) {
    const { data: profileById, error: profileByIdError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileByIdError) {
      console.log("Erro ao buscar profile por id:", profileByIdError);
    }

    if (profileById) return profileById;

    const { data: profileByUserId, error: profileByUserIdError } =
      await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (profileByUserIdError) {
      console.log(
        "Fallback profiles.user_id não disponível:",
        profileByUserIdError,
      );
    }

    return (
      profileByUserId ?? {
        id: userId,
        full_name: user?.user_metadata?.full_name || user?.user_metadata?.name,
        username: user?.user_metadata?.username,
        avatar_url:
          user?.user_metadata?.avatar_url || user?.user_metadata?.picture,
        email: user?.email,
        city: user?.user_metadata?.city,
      }
    );
  }

  async function loadPosts(city: string, userId: string) {
    const { data: postsResponse, error: postsError } = await supabase
      .from("community_posts")
      .select("*")
      .eq("city", city)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (postsError) throw postsError;

    const loadedPosts = postsResponse ?? [];
    const postIds = loadedPosts.map((post: any) => post.id).filter(Boolean);
    const userIds = Array.from(
      new Set(
        loadedPosts.map((post: any) => String(post.user_id)).filter(Boolean),
      ),
    ) as string[];

    const [profilesByUserId, likesByPostId, commentsByPostId, likedPostIds] =
      await Promise.all([
        getProfilesByUserIds(userIds),
        getLikesCountByPostIds(postIds),
        getCommentsCountByPostIds(postIds),
        getLikedPostIdsByUser(postIds, userId),
      ]);

    setPosts(
      loadedPosts.map((post: any) => ({
        ...post,
        profile: profilesByUserId[post.user_id] ?? null,
        likes_count: likesByPostId[post.id] ?? 0,
        comments_count: commentsByPostId[post.id] ?? 0,
        liked_by_me: likedPostIds.includes(post.id),
      })),
    );
  }

  async function getProfilesByUserIds(userIds: string[]) {
    if (userIds.length === 0) return {};

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds);

    if (error) {
      console.log("Erro ao buscar perfis dos posts:", error);
      return {};
    }

    return (data ?? []).reduce((acc: Record<string, any>, profile: any) => {
      acc[profile.id] = profile;
      return acc;
    }, {});
  }

  async function getLikesCountByPostIds(postIds: string[]) {
    if (postIds.length === 0) return {};

    const { data, error } = await supabase
      .from("community_post_likes")
      .select("post_id")
      .in("post_id", postIds);

    if (error) {
      console.log("Erro ao contar curtidas:", error);
      return {};
    }

    return (data ?? []).reduce((acc: Record<string, number>, like: any) => {
      acc[like.post_id] = (acc[like.post_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  async function getCommentsCountByPostIds(postIds: string[]) {
    if (postIds.length === 0) return {};

    const { data, error } = await supabase
      .from("community_post_comments")
      .select("post_id")
      .in("post_id", postIds)
      .is("deleted_at", null);

    if (error) {
      console.log("Erro ao contar comentários:", error);
      return {};
    }

    return (data ?? []).reduce((acc: Record<string, number>, comment: any) => {
      acc[comment.post_id] = (acc[comment.post_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  async function getLikedPostIdsByUser(postIds: string[], userId: string) {
    if (postIds.length === 0 || !userId) return [];

    const { data, error } = await supabase
      .from("community_post_likes")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds);

    if (error) {
      console.log("Erro ao buscar curtidas do usuário:", error);
      return [];
    }

    return (data ?? []).map((item: any) => item.post_id);
  }

  async function pickPostImage() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso às suas fotos para adicionar uma imagem ao post.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.82,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setSelectedImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.log("Erro ao selecionar imagem:", error);
      Alert.alert("Erro", "Não foi possível selecionar a imagem.");
    }
  }

  async function uploadPostImage(uri: string) {
    const extension = getImageExtension(uri);
    const contentType = getImageContentType(extension);
    const path = `${currentUserId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`;
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();

    const { error } = await supabase.storage
      .from("community-post-images")
      .upload(path, arrayBuffer, { contentType, upsert: false });

    if (error) throw error;

    const { data } = supabase.storage
      .from("community-post-images")
      .getPublicUrl(path);
    return data.publicUrl;
  }

  function openCreatePostModal() {
    setPostCategory("general");
    setPostContent("");
    setSelectedImageUri(null);
    setPostModalVisible(true);
  }

  function closeCreatePostModal() {
    if (savingPost) return;
    setPostModalVisible(false);
    setPostContent("");
    setSelectedImageUri(null);
    setPostCategory("general");
  }

  async function handleCreatePost() {
    try {
      if (!currentUserId) return;
      const content = postContent.trim();

      if (!content && !selectedImageUri) {
        Alert.alert(
          "Post vazio",
          "Escreva um texto ou selecione uma imagem para publicar.",
        );
        return;
      }

      if (!profileCity) {
        Alert.alert(
          "Cidade não definida",
          "Preencha sua cidade no perfil para postar na comunidade local.",
        );
        return;
      }

      setSavingPost(true);

      const imageUrl = selectedImageUri
        ? await uploadPostImage(selectedImageUri)
        : null;
      const { error } = await supabase.from("community_posts").insert({
        user_id: currentUserId,
        city: profileCity,
        category: postCategory,
        content: content || null,
        image_url: imageUrl,
      });

      if (error) throw error;

      setPostModalVisible(false);
      setPostContent("");
      setSelectedImageUri(null);
      setPostCategory("general");
      await loadCommunity(true);
    } catch (error: any) {
      console.log("Erro ao criar post:", error);
      Alert.alert(
        "Erro ao publicar",
        error?.message ?? "Não foi possível criar o post.",
      );
    } finally {
      setSavingPost(false);
    }
  }

  async function handleToggleLike(post: CommunityPost) {
    try {
      if (!currentUserId) return;
      const alreadyLiked = Boolean(post.liked_by_me);

      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                liked_by_me: !alreadyLiked,
                likes_count: Math.max(
                  Number(item.likes_count ?? 0) + (alreadyLiked ? -1 : 1),
                  0,
                ),
              }
            : item,
        ),
      );

      if (alreadyLiked) {
        const { error } = await supabase
          .from("community_post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("community_post_likes")
          .insert({ post_id: post.id, user_id: currentUserId });
        if (error) throw error;
      }
    } catch (error) {
      console.log("Erro ao curtir post:", error);
      await loadCommunity(true);
    }
  }

  function scrollToCommentsEnd(delay = 250) {
    setTimeout(() => {
      commentsScrollRef.current?.scrollToEnd({ animated: true });
    }, delay);
  }

  function openImageModal(imageUrl?: string | null) {
    if (!imageUrl) return;

    setSelectedFullImageUrl(imageUrl);
    setImageModalVisible(true);
  }

  function closeImageModal() {
    setImageModalVisible(false);
    setSelectedFullImageUrl(null);
  }

  async function openCommentsModal(post: CommunityPost) {
    setSelectedPost(post);
    setCommentContent("");
    setCommentsModalVisible(true);
    await loadComments(post);
    scrollToCommentsEnd(350);
  }

  async function loadComments(post: CommunityPost) {
    try {
      setLoadingComments(true);

      const { data, error } = await supabase
        .from("community_post_comments")
        .select("*")
        .eq("post_id", post.id)
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

  async function handleCreateComment() {
    if (!selectedPost || !currentUserId) return;

    try {
      const content = commentContent.trim();
      if (!content) return;

      setSavingComment(true);

      const { error } = await supabase.from("community_post_comments").insert({
        post_id: selectedPost.id,
        user_id: currentUserId,
        content,
      });

      if (error) throw error;

      setCommentContent("");
      await Promise.all([loadComments(selectedPost), loadCommunity(true)]);
      scrollToCommentsEnd(300);
    } catch (error: any) {
      console.log("Erro ao comentar:", error);
      Alert.alert(
        "Erro",
        error?.message ?? "Não foi possível enviar o comentário.",
      );
    } finally {
      setSavingComment(false);
    }
  }

  async function handleDeletePost(post: CommunityPost) {
    Alert.alert(
      "Excluir post",
      "Deseja realmente excluir este post da comunidade?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("community_posts")
                .update({ deleted_at: new Date().toISOString() })
                .eq("id", post.id)
                .eq("user_id", currentUserId);

              if (error) throw error;
              await loadCommunity(true);
            } catch (error: any) {
              console.log("Erro ao excluir post:", error);
              Alert.alert(
                "Erro",
                error?.message ?? "Não foi possível excluir este post.",
              );
            }
          },
        },
      ],
    );
  }

  function openDriversList() {
    router.push("/(private)/(tabs)/motoristas-cidade-lista" as never);
  }

  function openMyAccount() {
    router.push("/(private)/(tabs)/minha-conta" as never);
  }

  function isCurrentUserProfile(userId?: string | null) {
    return Boolean(
      userId && currentUserId && String(userId) === String(currentUserId),
    );
  }

  function openDriverProfile(userId?: string | null) {
    if (!userId) return;

    if (isCurrentUserProfile(userId)) {
      router.push(MY_PROFILE_ROUTE as never);
      return;
    }

    router.push({ pathname: "/perfil-publico", params: { userId } } as never);
  }

  function openDriverProfileFromModal(userId?: string | null) {
    if (!userId) return;

    const isMe = isCurrentUserProfile(userId);

    setCommentsModalVisible(false);
    setImageModalVisible(false);

    setTimeout(() => {
      if (isMe) {
        router.push(MY_PROFILE_ROUTE as never);
        return;
      }

      router.push({ pathname: "/perfil-publico", params: { userId } } as never);
    }, 120);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
        </TouchableOpacity>

        <View style={styles.headerTextContent}>
          <Text style={styles.headerEyebrow}>Comunidade local</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {profileCity || "Comunidade"}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.headerMenuButton}
          onPress={openDriversList}
        >
          <Ionicons name="people-outline" size={21} color="#D4A64A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadCommunity(true)}
            tintColor="#D4A64A"
          />
        }
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconBox}>
              <Ionicons name="chatbubbles-outline" size={22} color="#D4A64A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Feed da comunidade</Text>
              <Text style={styles.heroText}>
                Publique eventos da cidade, dúvidas, dicas, resultados e imagens
                do seu dia.
              </Text>
            </View>
          </View>

          <View style={styles.countRow}>
            <View style={styles.countPill}>
              <Ionicons name="newspaper-outline" size={14} color="#D4A64A" />
              <Text style={styles.countPillText}>{posts.length} posts</Text>
            </View>
            <View style={styles.countPillGreen}>
              <Ionicons name="person-outline" size={14} color="#22C55E" />
              <Text style={styles.countPillGreenText}>
                {myPostsCount} meus posts
              </Text>
            </View>
          </View>
        </View>

        {!profileCity && !loading ? (
          <View style={styles.warningCard}>
            <View style={styles.warningIconBox}>
              <Ionicons name="location-outline" size={22} color="#FACC15" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Cidade não definida</Text>
              <Text style={styles.warningText}>
                Preencha sua cidade no perfil para participar da comunidade
                local.
              </Text>
              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.warningButton}
                onPress={openMyAccount}
              >
                <Text style={styles.warningButtonText}>Abrir minha conta</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.feedFilterRow}>
          <TouchableOpacity
            activeOpacity={0.86}
            style={[
              styles.feedFilterButton,
              filter === "all" && styles.feedFilterButtonActive,
            ]}
            onPress={() => setFilter("all")}
          >
            <Ionicons
              name="earth-outline"
              size={17}
              color={filter === "all" ? "#080808" : "#9B969B"}
            />
            <Text
              style={[
                styles.feedFilterText,
                filter === "all" && styles.feedFilterTextActive,
              ]}
            >
              Todos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.86}
            style={[
              styles.feedFilterButton,
              filter === "mine" && styles.feedFilterButtonActive,
            ]}
            onPress={() => setFilter("mine")}
          >
            <Ionicons
              name="person-circle-outline"
              size={17}
              color={filter === "mine" ? "#080808" : "#9B969B"}
            />
            <Text
              style={[
                styles.feedFilterText,
                filter === "mine" && styles.feedFilterTextActive,
              ]}
            >
              Meus posts
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#D4A64A" />
            <Text style={styles.loadingText}>Carregando comunidade...</Text>
          </View>
        ) : visiblePosts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={36}
                color="#8F8A91"
              />
            </View>
            <Text style={styles.emptyTitle}>
              {filter === "mine"
                ? "Você ainda não postou"
                : "Nenhum post encontrado"}
            </Text>
            <Text style={styles.emptyText}>
              {filter === "mine"
                ? "Toque no botão + para compartilhar algo com a comunidade."
                : "Seja o primeiro a publicar um evento, dúvida, dica ou desempenho."}
            </Text>
          </View>
        ) : (
          <View style={styles.postsList}>
            {visiblePosts.map((post) => {
              const category = getCategoryInfo(post.category);
              const profile = post.profile ?? {};
              const avatarUrl = getUserAvatarUrl(profile);
              const name = getUserDisplayName(profile);
              const isMine = String(post.user_id) === String(currentUserId);

              return (
                <TouchableOpacity
                  key={post.id}
                  activeOpacity={0.92}
                  style={styles.postCard}
                  onPress={() => openCommentsModal(post)}
                >
                  <View style={styles.postHeader}>
                    <TouchableOpacity
                      activeOpacity={0.86}
                      style={styles.postAuthorRow}
                      onPress={(event: any) => {
                        event.stopPropagation?.();
                        openDriverProfile(post.user_id);
                      }}
                    >
                      {avatarUrl ? (
                        <Image
                          source={{ uri: avatarUrl }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={styles.avatarFallback}>
                          <Text style={styles.avatarFallbackText}>
                            {name.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.postAuthorInfo}>
                        <Text style={styles.postAuthorName} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={styles.postAuthorMeta} numberOfLines={1}>
                          {getUsername(profile)} · {formatDate(post.created_at)}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {isMine ? (
                      <TouchableOpacity
                        activeOpacity={0.86}
                        style={styles.deletePostButton}
                        onPress={(event: any) => {
                          event.stopPropagation?.();
                          handleDeletePost(post);
                        }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color="#F87171"
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View
                    style={[
                      styles.categoryBadge,
                      {
                        backgroundColor: `${category.color}1F`,
                        borderColor: `${category.color}45`,
                      },
                    ]}
                  >
                    <Ionicons
                      name={category.icon}
                      size={14}
                      color={category.color}
                    />
                    <Text
                      style={[
                        styles.categoryBadgeText,
                        { color: category.color },
                      ]}
                    >
                      {category.label}
                    </Text>
                  </View>

                  {post.content ? (
                    <Text style={styles.postContent}>{post.content}</Text>
                  ) : null}
                  {post.image_url ? (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={(event: any) => {
                        event.stopPropagation?.();
                        openImageModal(post.image_url);
                      }}
                    >
                      <Image
                        source={{ uri: post.image_url }}
                        style={styles.postImage}
                      />
                    </TouchableOpacity>
                  ) : null}

                  <View style={styles.postActions}>
                    <TouchableOpacity
                      activeOpacity={0.86}
                      style={styles.postActionButton}
                      onPress={(event: any) => {
                        event.stopPropagation?.();
                        handleToggleLike(post);
                      }}
                    >
                      <Ionicons
                        name={post.liked_by_me ? "heart" : "heart-outline"}
                        size={20}
                        color={post.liked_by_me ? "#F87171" : "#D4A64A"}
                      />
                      <Text style={styles.postActionText}>
                        {Number(post.likes_count ?? 0)}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.86}
                      style={styles.postActionButton}
                      onPress={(event: any) => {
                        event.stopPropagation?.();
                        openCommentsModal(post);
                      }}
                    >
                      <Ionicons
                        name="chatbubble-outline"
                        size={19}
                        color="#D4A64A"
                      />
                      <Text style={styles.postActionText}>
                        {Number(post.comments_count ?? 0)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.floatingButton}
        onPress={openCreatePostModal}
      >
        <Ionicons name="add" size={30} color="#080808" />
      </TouchableOpacity>

      <Modal
        visible={postModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCreatePostModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.postModalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Novo post</Text>
                <Text style={styles.modalTitle}>
                  Compartilhar na comunidade
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.modalCloseButton}
                onPress={closeCreatePostModal}
              >
                <Ionicons name="close" size={22} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Tipo de post</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryTabs}
              >
                {postCategories.map((category) => {
                  const selected = postCategory === category.id;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      activeOpacity={0.86}
                      style={[
                        styles.categoryTab,
                        selected && {
                          backgroundColor: category.color,
                          borderColor: category.color,
                        },
                      ]}
                      onPress={() => setPostCategory(category.id)}
                    >
                      <Ionicons
                        name={category.icon}
                        size={16}
                        color={selected ? "#080808" : category.color}
                      />
                      <Text
                        style={[
                          styles.categoryTabText,
                          selected && styles.categoryTabTextActive,
                        ]}
                      >
                        {category.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.inputLabel}>Texto</Text>
              <TextInput
                value={postContent}
                onChangeText={setPostContent}
                placeholder="Escreva uma dúvida, evento, dica, resultado ou recado..."
                placeholderTextColor="#8F8A91"
                multiline
                textAlignVertical="top"
                style={styles.postInput}
              />

              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.imagePickerButton}
                onPress={pickPostImage}
              >
                <Ionicons name="image-outline" size={20} color="#D4A64A" />
                <Text style={styles.imagePickerButtonText}>
                  {selectedImageUri ? "Trocar imagem" : "Adicionar imagem"}
                </Text>
              </TouchableOpacity>

              {selectedImageUri ? (
                <View style={styles.selectedImageBox}>
                  <Image
                    source={{ uri: selectedImageUri }}
                    style={styles.selectedImage}
                  />
                  <TouchableOpacity
                    activeOpacity={0.86}
                    style={styles.removeImageButton}
                    onPress={() => setSelectedImageUri(null)}
                  >
                    <Ionicons name="close" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.publishButton,
                savingPost && styles.publishButtonDisabled,
              ]}
              disabled={savingPost}
              onPress={handleCreatePost}
            >
              {savingPost ? (
                <ActivityIndicator color="#080808" />
              ) : (
                <>
                  <Ionicons name="send-outline" size={20} color="#080808" />
                  <Text style={styles.publishButtonText}>Publicar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={commentsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCommentsModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.commentsModalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Comentários</Text>
                <Text style={styles.modalTitle}>Conversa do post</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.modalCloseButton}
                onPress={() => setCommentsModalVisible(false)}
              >
                <Ionicons name="close" size={22} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={commentsScrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.commentsList}
              onContentSizeChange={() => scrollToCommentsEnd(80)}
            >
              {selectedPost ? (
                <View style={styles.commentPostPreview}>
                  <View style={styles.commentPostPreviewHeader}>
                    <TouchableOpacity
                      activeOpacity={0.86}
                      onPress={() =>
                        openDriverProfileFromModal(selectedPost.user_id)
                      }
                    >
                      {getUserAvatarUrl(selectedPost.profile) ? (
                        <Image
                          source={{
                            uri: getUserAvatarUrl(selectedPost.profile),
                          }}
                          style={styles.commentPostPreviewAvatar}
                        />
                      ) : (
                        <View style={styles.commentPostPreviewAvatarFallback}>
                          <Text style={styles.commentPostPreviewAvatarText}>
                            {getUserDisplayName(selectedPost.profile)
                              .slice(0, 1)
                              .toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.86}
                      style={{ flex: 1 }}
                      onPress={() =>
                        openDriverProfileFromModal(selectedPost.user_id)
                      }
                    >
                      <Text
                        style={styles.commentPostPreviewAuthor}
                        numberOfLines={1}
                      >
                        {getUserDisplayName(selectedPost.profile)}
                      </Text>
                      <Text
                        style={styles.commentPostPreviewMeta}
                        numberOfLines={1}
                      >
                        {getCategoryInfo(selectedPost.category).label} ·{" "}
                        {formatDate(selectedPost.created_at)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {selectedPost.content ? (
                    <Text style={styles.commentPostPreviewText}>
                      {selectedPost.content}
                    </Text>
                  ) : null}

                  {selectedPost.image_url ? (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => openImageModal(selectedPost.image_url)}
                    >
                      <Image
                        source={{ uri: selectedPost.image_url }}
                        style={styles.commentPostPreviewImage}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              {loadingComments ? (
                <View style={styles.commentsLoadingBox}>
                  <ActivityIndicator color="#D4A64A" />
                  <Text style={styles.loadingText}>
                    Carregando comentários...
                  </Text>
                </View>
              ) : comments.length === 0 ? (
                <View style={styles.commentsEmptyBox}>
                  <Ionicons
                    name="chatbubble-outline"
                    size={34}
                    color="#8F8A91"
                  />
                  <Text style={styles.emptyTitle}>Nenhum comentário</Text>
                  <Text style={styles.emptyText}>
                    Seja o primeiro a comentar.
                  </Text>
                </View>
              ) : (
                comments.map((comment) => {
                  const profile = comment.profile ?? {};
                  const name = getUserDisplayName(profile);
                  const avatarUrl = getUserAvatarUrl(profile);
                  return (
                    <View key={comment.id} style={styles.commentCard}>
                      <TouchableOpacity
                        activeOpacity={0.86}
                        onPress={() =>
                          openDriverProfileFromModal(comment.user_id)
                        }
                      >
                        {avatarUrl ? (
                          <Image
                            source={{ uri: avatarUrl }}
                            style={styles.commentAvatar}
                          />
                        ) : (
                          <View style={styles.commentAvatarFallback}>
                            <Text style={styles.commentAvatarText}>
                              {name.slice(0, 1).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      <View style={styles.commentInfo}>
                        <TouchableOpacity
                          activeOpacity={0.86}
                          onPress={() =>
                            openDriverProfileFromModal(comment.user_id)
                          }
                        >
                          <Text style={styles.commentAuthor} numberOfLines={1}>
                            {name}
                          </Text>
                        </TouchableOpacity>

                        <Text style={styles.commentText}>
                          {comment.content}
                        </Text>
                        <Text style={styles.commentDate}>
                          {formatDate(comment.created_at)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.commentInputRow}>
              <TextInput
                value={commentContent}
                onChangeText={setCommentContent}
                placeholder="Escreva um comentário..."
                placeholderTextColor="#8F8A91"
                style={styles.commentInput}
              />
              <TouchableOpacity
                activeOpacity={0.86}
                style={[
                  styles.commentSendButton,
                  (!commentContent.trim() || savingComment) &&
                    styles.commentSendButtonDisabled,
                ]}
                disabled={!commentContent.trim() || savingComment}
                onPress={handleCreateComment}
              >
                {savingComment ? (
                  <ActivityIndicator color="#080808" />
                ) : (
                  <Ionicons name="send" size={18} color="#080808" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        <View style={styles.fullImageModalOverlay}>
          <View style={styles.fullImageModalHeader}>
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.fullImageCloseButton}
              onPress={closeImageModal}
            >
              <Ionicons name="close" size={24} color="#F5F0E6" />
            </TouchableOpacity>
          </View>

          {selectedFullImageUrl ? (
            <Image
              source={{ uri: selectedFullImageUrl }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#050505" },
  container: { flex: 1, backgroundColor: "#050505" },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 128 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 18,
    backgroundColor: "#070707",
    borderBottomWidth: 1,
    borderBottomColor: "#211D16",
    zIndex: 50,
    elevation: 50,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  headerMenuButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContent: { flex: 1, minWidth: 0 },
  headerEyebrow: {
    color: "#D4A64A",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: "#F5F0E6",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2A2830",
    backgroundColor: "#101014",
    padding: 18,
    marginBottom: 14,
    elevation: 10,
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.07,
    shadowRadius: 22,
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(212,166,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: "#F5F0E6", fontSize: 18, fontWeight: "900" },
  heroText: {
    color: "#9B969B",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  countRow: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  countPill: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: "rgba(212,166,74,0.10)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.20)",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  countPillText: { color: "#E8D49B", fontSize: 11, fontWeight: "900" },
  countPillGreen: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.10)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.20)",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  countPillGreenText: { color: "#86EFAC", fontSize: 11, fontWeight: "900" },
  warningCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.24)",
    backgroundColor: "rgba(250,204,21,0.08)",
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  warningIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(250,204,21,0.12)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  warningTitle: { color: "#F5F0E6", fontSize: 14, fontWeight: "900" },
  warningText: {
    color: "#D8D1C4",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  warningButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: "#D4A64A",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  warningButtonText: { color: "#080808", fontSize: 12, fontWeight: "900" },
  feedFilterRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  feedFilterButton: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  feedFilterButtonActive: {
    backgroundColor: "#D4A64A",
    borderColor: "#D4A64A",
  },
  feedFilterText: { color: "#9B969B", fontSize: 12, fontWeight: "900" },
  feedFilterTextActive: { color: "#080808" },
  loadingBox: {
    minHeight: 220,
    borderRadius: 16,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingText: {
    color: "#9B969B",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 12,
  },
  emptyState: {
    minHeight: 250,
    borderRadius: 16,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyIconBox: {
    width: 70,
    height: 70,
    borderRadius: 18,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
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
    marginTop: 8,
    textAlign: "center",
  },
  postsList: { gap: 12 },
  postCard: {
    borderRadius: 18,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 14,
  },
  postHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  postAuthorRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.30)",
    backgroundColor: "#18171D",
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: { color: "#D4A64A", fontSize: 17, fontWeight: "900" },
  postAuthorInfo: { flex: 1, minWidth: 0 },
  postAuthorName: { color: "#F5F0E6", fontSize: 14, fontWeight: "900" },
  postAuthorMeta: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  deletePostButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(248,113,113,0.10)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryBadge: {
    alignSelf: "flex-start",
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  categoryBadgeText: { fontSize: 11, fontWeight: "900" },
  postContent: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 12,
  },
  postImage: {
    width: "100%",
    height: 240,
    borderRadius: 16,
    backgroundColor: "#18171D",
    marginTop: 12,
  },
  postActions: {
    borderTopWidth: 1,
    borderTopColor: "#2A2830",
    marginTop: 13,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  postActionButton: {
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: "rgba(212,166,74,0.08)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.16)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  postActionText: { color: "#E8D49B", fontSize: 12, fontWeight: "900" },
  floatingButton: {
    position: "absolute",
    right: 20,
    bottom: 104,
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 12,
  },
  commentPostPreview: {
    borderRadius: 16,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 12,
    marginBottom: 12,
  },
  commentPostPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  commentPostPreviewAvatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.30)",
    backgroundColor: "#101014",
  },
  commentPostPreviewAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  commentPostPreviewAvatarText: {
    color: "#D4A64A",
    fontSize: 16,
    fontWeight: "900",
  },
  commentPostPreviewAuthor: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
  },
  commentPostPreviewMeta: {
    color: "#9B969B",
    fontSize: 11,
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
  commentPostPreviewImage: {
    width: "100%",
    height: 170,
    borderRadius: 14,
    backgroundColor: "#101014",
    marginTop: 10,
  },
  fullImageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullImageModalHeader: {
    position: "absolute",
    top: 48,
    right: 18,
    zIndex: 10,
  },
  fullImageCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(24,23,29,0.92)",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.76)",
    justifyContent: "flex-end",
  },
  postModalCard: {
    maxHeight: "88%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 18,
  },
  commentsModalCard: {
    height: "90%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#101014",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  modalEyebrow: {
    color: "#D4A64A",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  modalTitle: {
    color: "#F5F0E6",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  inputLabel: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
    marginTop: 6,
  },
  categoryTabs: { gap: 8, paddingBottom: 10 },
  categoryTab: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  categoryTabText: { color: "#9B969B", fontSize: 12, fontWeight: "900" },
  categoryTabTextActive: { color: "#080808" },
  postInput: {
    minHeight: 130,
    borderRadius: 16,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    padding: 13,
    color: "#F5F0E6",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  imagePickerButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "rgba(212,166,74,0.08)",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.22)",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 12,
  },
  imagePickerButtonText: { color: "#D4A64A", fontSize: 13, fontWeight: "900" },
  selectedImageBox: { marginTop: 12 },
  selectedImage: {
    width: "100%",
    height: 210,
    borderRadius: 16,
    backgroundColor: "#18171D",
  },
  removeImageButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  publishButton: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: "#D4A64A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 16,
  },
  publishButtonDisabled: { opacity: 0.72 },
  publishButtonText: { color: "#080808", fontSize: 14, fontWeight: "900" },
  commentsList: { paddingBottom: 12 },
  commentsLoadingBox: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  commentsEmptyBox: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  commentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2830",
  },
  commentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#18171D",
  },
  commentAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "rgba(212,166,74,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: { color: "#D4A64A", fontSize: 14, fontWeight: "900" },
  commentInfo: { flex: 1 },
  commentAuthor: { color: "#F5F0E6", fontSize: 13, fontWeight: "900" },
  commentText: {
    color: "#D8D1C4",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 3,
  },
  commentDate: {
    color: "#8F8A91",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 5,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#2A2830",
    paddingTop: 12,
  },
  commentInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    paddingHorizontal: 13,
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "700",
  },
  commentSendButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#D4A64A",
    alignItems: "center",
    justifyContent: "center",
  },
  commentSendButtonDisabled: { opacity: 0.45 },
});
