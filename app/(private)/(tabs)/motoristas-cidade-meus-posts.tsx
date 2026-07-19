import { useCallback, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { supabase } from '../../../src/database/supabase';
import {
  DashboardPeriod,
} from '../../../src/features/dashboard/services/getDashboardData';
import { OperationalResultCard } from '../../../src/features/dashboard/components/OperationalResultCard';
import { ResumoJornada } from '../../../src/features/dashboard/components/ResumoJornada';
import { CommunityPostCard } from '../../../src/features/community/components/CommunityPostCard';
import { CommunityPostConversation } from '../../../src/features/community/components/CommunityPostConversation';
import { CommunityCreatePostModal } from '../../../src/features/community/components/CommunityCreatePostModal';

type IconName = keyof typeof Ionicons.glyphMap;

type CommunityContentType =
  | 'general'
  | 'sos'
  | 'sale'
  | 'rental'
  | 'results'
  | 'events'
  | 'electric';

type PostFilter = 'all' | 'open' | 'closed';

type CommunityPost = {
  id: string;
  user_id: string;
  city: string | null;
  content_type: CommunityContentType | string | null;
  category: string | null;
  scope: string | null;
  status: 'open' | 'closed' | string | null;
  content: string | null;
  image_url: string | null;
  images?: string[] | null;
  created_at: string;
  closed_at?: string | null;
  deleted_at?: string | null;
  expires_at?: string | null;
  product_name?: string | null;
  price?: number | string | null;
  whatsapp_url?: string | null;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | string | null;
  rental_periodicity?: string | null;
  rental_price?: number | string | null;
  event_at?: string | null;
  event_end_at?: string | null;
  event_address?: string | null;
  result_period_type?: string | null;
  result_snapshot?: any;
  likes_count?: number;
  comments_count?: number;
  liked_by_me?: boolean;
  profile?: any;
};

type ContentConfig = {
  id: CommunityContentType;
  title: string;
  icon: IconName;
  color: string;
  canRenew: boolean;
};

const contentConfigs: ContentConfig[] = [
  {
    id: 'general',
    title: 'Geral',
    icon: 'chatbubbles-outline',
    color: '#D4A64A',
    canRenew: false,
  },
  {
    id: 'sos',
    title: 'Apoio / S.O.S',
    icon: 'alert-circle-outline',
    color: '#EF4444',
    canRenew: false,
  },
  {
    id: 'sale',
    title: 'Venda de Itens',
    icon: 'pricetags-outline',
    color: '#22C55E',
    canRenew: true,
  },
  {
    id: 'rental',
    title: 'Aluguel de Veículos',
    icon: 'car-sport-outline',
    color: '#60A5FA',
    canRenew: true,
  },
  {
    id: 'results',
    title: 'Resultados e Metas',
    icon: 'trophy-outline',
    color: '#FACC15',
    canRenew: false,
  },
  {
    id: 'events',
    title: 'Eventos',
    icon: 'calendar-outline',
    color: '#A78BFA',
    canRenew: false,
  },
  {
    id: 'electric',
    title: 'Elétricos e Híbridos',
    icon: 'flash-outline',
    color: '#2DD4BF',
    canRenew: false,
  },
];

const filterOptions: {
  id: PostFilter;
  label: string;
  icon: IconName;
}[] = [
  { id: 'all', label: 'Todos', icon: 'albums-outline' },
  { id: 'open', label: 'Abertos', icon: 'lock-open-outline' },
  { id: 'closed', label: 'Fechados', icon: 'lock-closed-outline' },
];

function getContentConfig(contentType?: string | null) {
  return (
    contentConfigs.find((item) => item.id === contentType) ??
    contentConfigs[0]
  );
}

function formatDate(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value?: number | string | null) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);

  next.setDate(next.getDate() + days);

  return next;
}

function getPostImages(post: CommunityPost) {
  const images = Array.isArray(post.images) ? post.images.filter(Boolean) : [];

  if (images.length > 0) return images;

  return post.image_url ? [post.image_url] : [];
}

function isPostOpen(post: CommunityPost) {
  if (post.status !== 'open' || post.closed_at) return false;

  if (post.expires_at) {
    const expiresAt = new Date(post.expires_at);

    if (!Number.isNaN(expiresAt.getTime()) && expiresAt <= new Date()) {
      return false;
    }
  }

  return true;
}

function getPostSortTime(post: CommunityPost) {
  return new Date(post.closed_at || post.created_at).getTime();
}

function getDashboardPeriodFromSnapshot(snapshot: any): DashboardPeriod | null {
  const period = String(snapshot?.period || snapshot?.result_period_type || '').trim();

  if (period === 'day' || period === 'week' || period === 'month' || period === 'year') {
    return period;
  }

  return null;
}

function getSnapshotReferenceDate(snapshot: any) {
  const rawValue =
    snapshot?.referenceDate ||
    snapshot?.startDate ||
    snapshot?.created_at ||
    '';

  const parsedDate = rawValue ? new Date(rawValue) : new Date();

  if (Number.isNaN(parsedDate.getTime())) {
    return new Date();
  }

  return parsedDate;
}

function buildOperationalResultSummaryFromSnapshot(snapshot: any) {
  const revenue = Number(snapshot?.revenue ?? 0);
  const operationalExpenses = Number(
    snapshot?.operationalExpenses ?? snapshot?.expenses ?? 0,
  );
  const operationalResult = Number(
    snapshot?.operationalResult ?? snapshot?.profit ?? revenue - operationalExpenses,
  );
  const totalHours = Number(snapshot?.totalHours ?? 0);
  const totalKm = Number(snapshot?.totalKm ?? 0);

  return {
    revenue,
    operationalExpenses,
    operationalFuelExpenses: Number(snapshot?.operationalFuelExpenses ?? 0),
    operationalChargingExpenses: Number(snapshot?.operationalChargingExpenses ?? 0),
    operationalResult,
    totalHours,
    totalKm,
    revenuePerHour:
      Number(snapshot?.revenuePerHour ?? 0) || (totalHours > 0 ? revenue / totalHours : 0),
    revenuePerKm:
      Number(snapshot?.revenuePerKm ?? 0) || (totalKm > 0 ? revenue / totalKm : 0),
    startDate: snapshot?.startDate ?? getSnapshotReferenceDate(snapshot),
    endDate: snapshot?.endDate ?? getSnapshotReferenceDate(snapshot),
  };
}

function getSnapshotResultPeriod(snapshot: any, fallbackPeriod?: string | null) {
  return String(
    snapshot?.period ||
      snapshot?.result_period_type ||
      fallbackPeriod ||
      "",
  ).trim();
}

function buildResumoJornadaDataFromSnapshot(snapshot: any) {
  const dailySession = Array.isArray(snapshot?.dailySessions)
    ? snapshot.dailySessions[0]
    : null;

  const totalHours = Number(
    snapshot?.totalHours ??
      dailySession?.hours ??
      dailySession?.totalHours ??
      dailySession?.total_hours ??
      0,
  );

  const totalKm = Number(
    snapshot?.totalKm ??
      dailySession?.km ??
      dailySession?.totalKm ??
      dailySession?.total_km ??
      0,
  );

  const revenue = Number(
    snapshot?.revenue ??
      dailySession?.revenue ??
      dailySession?.amount ??
      dailySession?.total_earnings ??
      dailySession?.totalEarnings ??
      0,
  );

  return {
    id: snapshot?.turnId ?? dailySession?.id ?? null,
    referenceDate:
      snapshot?.referenceDate ??
      snapshot?.startDate ??
      dailySession?.startedAt ??
      dailySession?.started_at ??
      null,
    started_at:
      dailySession?.startedAt ??
      dailySession?.started_at ??
      dailySession?.start_time ??
      snapshot?.startDate ??
      null,
    finished_at:
      dailySession?.endedAt ??
      dailySession?.finished_at ??
      dailySession?.ended_at ??
      dailySession?.end_time ??
      snapshot?.endDate ??
      null,
    totalHours,
    totalKm,
    revenue,
    revenuePerHour:
      Number(snapshot?.revenuePerHour ?? 0) ||
      (totalHours > 0 ? revenue / totalHours : 0),
    revenuePerKm:
      Number(snapshot?.revenuePerKm ?? 0) ||
      (totalKm > 0 ? revenue / totalKm : 0),
  };
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
    'Motorista'
  );
}

function getShortName(user: any) {
  const fullName = String(getUserDisplayName(user)).trim();
  const parts = fullName.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) return parts[0] || 'Motorista';

  return `${parts[0]} ${parts[1]}`;
}

export default function MyCommunityPostsScreen() {
  const { width: windowWidth } = useWindowDimensions();

  const postImagesViewportWidth = Math.max(windowWidth - 66, 260);
  const postImagePairItemWidth = Math.max((postImagesViewportWidth - 8) / 2, 120);
  const postImageTripleItemWidth = Math.max((postImagesViewportWidth - 16) / 3, 82);
  const messageBubbleMinWidth = Math.max(windowWidth * 0.6, 220);
  const summaryCardWidth = Math.max((windowWidth - 82) / 2, 136);

  const [currentUserId, setCurrentUserId] = useState('');
  const [loggedProfile, setLoggedProfile] = useState<any | null>(null);
  const [profileCity, setProfileCity] = useState('');
  const [profileImmediateRegion, setProfileImmediateRegion] = useState('');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [filter, setFilter] = useState<PostFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingPostId, setUpdatingPostId] = useState('');
  const [fullImages, setFullImages] = useState<string[]>([]);
  const [fullImageIndex, setFullImageIndex] = useState(0);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedConversationPost, setSelectedConversationPost] =
    useState<CommunityPost | null>(null);
  const [conversationVisible, setConversationVisible] = useState(false);
  const [createAreaPickerVisible, setCreateAreaPickerVisible] = useState(false);
  const [createPostModalVisible, setCreatePostModalVisible] = useState(false);
  const [createPostContentType, setCreatePostContentType] =
    useState<CommunityContentType>('general');

  const filteredPosts = useMemo(() => {
    const result = posts.filter((post) => {
      const open = isPostOpen(post);

      if (filter === 'open') return open;
      if (filter === 'closed') return !open;

      return true;
    });

    return result.sort((a, b) => {
      const aOpen = isPostOpen(a);
      const bOpen = isPostOpen(b);

      if (aOpen !== bOpen) return aOpen ? -1 : 1;

      return getPostSortTime(b) - getPostSortTime(a);
    });
  }, [filter, posts]);

  const summary = useMemo(() => {
    const open = posts.filter(isPostOpen).length;
    const total = posts.length;
    const likes = posts.reduce((sum, post) => sum + Number(post.likes_count ?? 0), 0);
    const comments = posts.reduce(
      (sum, post) => sum + Number(post.comments_count ?? 0),
      0,
    );

    return {
      total,
      open,
      closed: Math.max(total - open, 0),
      likes,
      comments,
    };
  }, [posts]);

  useFocusEffect(
    useCallback(() => {
      loadMyPosts();
    }, []),
  );

  async function loadMyPosts(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      await closeExpiredPosts();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      const userId = user?.id ?? '';
      setCurrentUserId(userId);

      if (!userId) {
        setPosts([]);
        setLoggedProfile(null);
        setProfileCity('');
        setProfileImmediateRegion('');
        return;
      }

      const profile = await getLoggedProfile(userId, user);
      setLoggedProfile(profile);
      setProfileCity(
        String(
          profile?.city ||
            user?.user_metadata?.city ||
            user?.user_metadata?.profile_city ||
            user?.user_metadata?.municipality ||
            '',
        ).trim(),
      );
      setProfileImmediateRegion(
        String(
          profile?.regiao_imediata ||
            profile?.immediate_region ||
            profile?.region ||
            user?.user_metadata?.regiao_imediata ||
            user?.user_metadata?.immediate_region ||
            user?.user_metadata?.region ||
            '',
        ).trim(),
      );

      const { data: postsResponse, error: postsError } = await supabase
        .from('community_posts')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200);

      if (postsError) throw postsError;

      const loadedPosts = postsResponse ?? [];
      const postIds = loadedPosts.map((post: any) => post.id).filter(Boolean);

      const [likesByPostId, commentsByPostId, likedPostIds] = await Promise.all([
        getLikesCountByPostIds(postIds),
        getCommentsCountByPostIds(postIds),
        getLikedPostIdsByUser(postIds, userId),
      ]);

      setPosts(
        loadedPosts.map((post: any) => ({
          ...post,
          images: Array.isArray(post.images) ? post.images : [],
          profile,
          liked_by_me: likedPostIds.includes(post.id),
          likes_count: likesByPostId[post.id] ?? 0,
          comments_count: commentsByPostId[post.id] ?? 0,
        })),
      );
    } catch (error) {
      console.log('Erro ao carregar meus posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function getLoggedProfile(userId: string, user: any) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.log('Erro ao buscar perfil do usuário logado:', error);
    }

    return (
      data ?? {
        id: userId,
        full_name: user?.user_metadata?.full_name || user?.user_metadata?.name,
        username: user?.user_metadata?.username,
        avatar_url: user?.user_metadata?.avatar_url || user?.user_metadata?.picture,
        email: user?.email,
        city: user?.user_metadata?.city,
        regiao_imediata: user?.user_metadata?.regiao_imediata,
        immediate_region: user?.user_metadata?.immediate_region,
        region: user?.user_metadata?.region,
      }
    );
  }

  async function closeExpiredPosts() {
    try {
      await (supabase as any).rpc('close_expired_community_posts');
    } catch (error) {
      console.log('Função close_expired_community_posts indisponível:', error);
    }
  }

  async function getLikesCountByPostIds(postIds: string[]) {
    if (postIds.length === 0) return {};

    const { data, error } = await supabase
      .from('community_post_likes')
      .select('post_id')
      .in('post_id', postIds);

    if (error) {
      console.log('Erro ao contar curtidas:', error);
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
      .from('community_post_comments')
      .select('post_id')
      .in('post_id', postIds)
      .is('deleted_at', null);

    if (error) {
      console.log('Erro ao contar comentários:', error);
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
      .from('community_post_likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds);

    if (error) {
      console.log('Erro ao buscar curtidas do usuário:', error);
      return [];
    }

    return (data ?? []).map((item: any) => item.post_id);
  }

  async function handleToggleLike(post: CommunityPost) {
    if (!currentUserId || !post.id) return;

    const liked = Boolean(post.liked_by_me);

    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              liked_by_me: !liked,
              likes_count: Math.max(
                Number(item.likes_count ?? 0) + (liked ? -1 : 1),
                0,
              ),
            }
          : item,
      ),
    );

    try {
      if (liked) {
        const { error } = await supabase
          .from('community_post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', currentUserId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('community_post_likes')
          .insert({
            post_id: post.id,
            user_id: currentUserId,
          });

        if (error) throw error;
      }
    } catch (error) {
      console.log('Erro ao alterar curtida:', error);
      await loadMyPosts(true);
    }
  }

  async function handleClosePost(post: CommunityPost) {
    if (!isPostOpen(post)) return;

    Alert.alert('Fechar post', 'Deseja fechar este post agora?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Fechar',
        onPress: async () => {
          try {
            setUpdatingPostId(post.id);

            const { error } = await supabase
              .from('community_posts')
              .update({
                status: 'closed',
                closed_at: new Date().toISOString(),
              })
              .eq('id', post.id)
              .eq('user_id', currentUserId);

            if (error) throw error;

            await loadMyPosts(true);
          } catch (error: any) {
            Alert.alert(
              'Erro',
              error?.message ?? 'Não foi possível fechar este post.',
            );
          } finally {
            setUpdatingPostId('');
          }
        },
      },
    ]);
  }

  async function handleRenewPost(post: CommunityPost) {
    const config = getContentConfig(post.content_type);

    if (!config.canRenew) return;

    try {
      setUpdatingPostId(post.id);

      const { error } = await supabase
        .from('community_posts')
        .update({
          status: 'open',
          closed_at: null,
          expires_at: addDays(new Date(), 7).toISOString(),
          renewed_at: new Date().toISOString(),
        })
        .eq('id', post.id)
        .eq('user_id', currentUserId);

      if (error) throw error;

      await loadMyPosts(true);
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível renovar o post.');
    } finally {
      setUpdatingPostId('');
    }
  }

  async function handleDeletePost(post: CommunityPost) {
    Alert.alert(
      'Excluir post',
      'Deseja realmente excluir este post da comunidade?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdatingPostId(post.id);

              const { error } = await supabase
                .from('community_posts')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', post.id)
                .eq('user_id', currentUserId);

              if (error) throw error;

              await loadMyPosts(true);
            } catch (error: any) {
              Alert.alert(
                'Erro',
                error?.message ?? 'Não foi possível excluir este post.',
              );
            } finally {
              setUpdatingPostId('');
            }
          },
        },
      ],
    );
  }

  function openLoggedProfile(_userId?: string, _profile?: any) {
    router.push('/(private)/(tabs)/perfil' as never);
  }

  function openImageModal(images: string[], index: number) {
    setFullImages(images);
    setFullImageIndex(index);
    setImageModalVisible(true);
  }

  function closeImageModal() {
    setImageModalVisible(false);
    setFullImages([]);
    setFullImageIndex(0);
  }

  function openPostConversation(post: CommunityPost) {
    setSelectedConversationPost(post);
    setConversationVisible(true);
  }

  function closePostConversation() {
    setConversationVisible(false);
    setSelectedConversationPost(null);
  }

  function openCreateAreaPicker() {
    setCreateAreaPickerVisible(true);
  }

  function closeCreateAreaPicker() {
    setCreateAreaPickerVisible(false);
  }

  function handleSelectCreatePostArea(contentType: CommunityContentType) {
    setCreatePostContentType(contentType);
    setCreateAreaPickerVisible(false);
    setCreatePostModalVisible(true);
  }

  function closeCreatePostModal() {
    setCreatePostModalVisible(false);
  }

  function openWhatsApp(post: CommunityPost) {
    if (!post.whatsapp_url) return;

    Linking.openURL(String(post.whatsapp_url));
  }

  function renderPostDetails(post: CommunityPost) {
    const contentType = String(post.content_type || 'general');
    const config = getContentConfig(contentType);

    if (contentType === 'sale') {
      return (
        <View style={[styles.detailBox, { borderColor: `${config.color}2A` }]}>
          <View style={styles.detailHeaderRow}>
            <View style={[styles.detailIconBox, { backgroundColor: `${config.color}18` }]}>
              <Ionicons name="cash-outline" size={17} color={config.color} />
            </View>

            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Valor do item</Text>
              <Text style={[styles.priceText, { color: config.color }]}>
                R$ {formatCurrency(post.price)}
              </Text>
            </View>

            {post.whatsapp_url ? (
              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.whatsappButton}
                onPress={(event: any) => {
                  event.stopPropagation?.();
                  openWhatsApp(post);
                }}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      );
    }

    if (contentType === 'rental') {
      return (
        <View style={[styles.detailBox, { borderColor: `${config.color}2A` }]}>
          <View style={styles.detailHeaderRow}>
            <View style={[styles.detailIconBox, { backgroundColor: `${config.color}18` }]}>
              <Ionicons name="car-sport-outline" size={17} color={config.color} />
            </View>

            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Valor do aluguel</Text>
              <Text style={[styles.priceText, { color: config.color }]}>
                R$ {formatCurrency(post.rental_price)} /{' '}
                {post.rental_periodicity === 'day'
                  ? 'dia'
                  : post.rental_periodicity === 'month'
                    ? 'mês'
                    : 'semana'}
              </Text>
            </View>

            {post.whatsapp_url ? (
              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.whatsappButton}
                onPress={(event: any) => {
                  event.stopPropagation?.();
                  openWhatsApp(post);
                }}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      );
    }

    if (contentType === 'events') {
      return (
        <View style={[styles.detailBox, { borderColor: `${config.color}2A` }]}>
          <View style={styles.detailHeaderRow}>
            <View style={[styles.detailIconBox, { backgroundColor: `${config.color}18` }]}>
              <Ionicons name="calendar-outline" size={17} color={config.color} />
            </View>

            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Evento</Text>
              <Text style={styles.detailText}>Início: {formatDate(post.event_at)}</Text>
              <Text style={styles.detailText}>Fim: {formatDate(post.event_end_at)}</Text>
              <Text style={styles.detailText} numberOfLines={2}>
                Endereço: {post.event_address || 'Não informado'}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    if (contentType === 'results' && post.result_snapshot) {
      const snapshotPeriod = getSnapshotResultPeriod(
        post.result_snapshot,
        post.result_period_type,
      );

      if (snapshotPeriod === 'turn') {
        return (
          <View style={styles.resultCardBox}>
            <ResumoJornada
              jornada={buildResumoJornadaDataFromSnapshot(post.result_snapshot)}
              accentColor={config.color}
            />
          </View>
        );
      }

      const dashboardPeriod = getDashboardPeriodFromSnapshot(post.result_snapshot);

      if (dashboardPeriod) {
        return (
          <View style={styles.resultCardBox}>
            <OperationalResultCard
              period={dashboardPeriod}
              referenceDate={getSnapshotReferenceDate(post.result_snapshot)}
              summaryOverride={buildOperationalResultSummaryFromSnapshot(post.result_snapshot)}
              showDetailsButton
              detailsButtonLabel="Ver detalhes"
              cardStyle={styles.resultOperationalCard}
            />
          </View>
        );
      }

      const revenue = Number(post.result_snapshot.revenue ?? 0);
      const expenses = Number(post.result_snapshot.expenses ?? 0);
      const profit = Number(post.result_snapshot.profit ?? revenue - expenses);

      return (
        <View style={[styles.detailBox, { borderColor: `${config.color}2A` }]}>
          <Text style={styles.detailLabel}>Resultado</Text>
          <Text style={styles.detailText}>Faturamento: R$ {formatCurrency(revenue)}</Text>
          <Text style={styles.detailText}>Despesas: R$ {formatCurrency(expenses)}</Text>
          <Text style={[styles.priceText, { color: config.color }]}>
            Lucro: R$ {formatCurrency(profit)}
          </Text>
        </View>
      );
    }

    return null;
  }


  function renderCreateAreaPickerModal() {
    return (
      <Modal
        visible={createAreaPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCreateAreaPicker}
      >
        <View style={styles.createAreaOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            style={StyleSheet.absoluteFill}
            onPress={closeCreateAreaPicker}
          />

          <View style={styles.createAreaCard}>
            <View style={styles.createAreaHeader}>
              <View style={styles.createAreaHeaderIcon}>
                <Ionicons name="add" size={21} color="#080808" />
              </View>

              <View style={styles.createAreaHeaderText}>
                <Text style={styles.createAreaEyebrow}>Novo post</Text>
                <Text style={styles.createAreaTitle}>Escolha a área</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.createAreaCloseButton}
                onPress={closeCreateAreaPicker}
              >
                <Ionicons name="close" size={20} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <Text style={styles.createAreaDescription}>
              Selecione onde deseja publicar. O formulário será aberto conforme a área escolhida.
            </Text>

            <View style={styles.createAreaOptions}>
              {contentConfigs.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.88}
                  style={[
                    styles.createAreaOption,
                    {
                      borderColor: `${item.color}2E`,
                      backgroundColor: `${item.color}10`,
                    },
                  ]}
                  onPress={() => handleSelectCreatePostArea(item.id)}
                >
                  <View
                    style={[
                      styles.createAreaOptionIcon,
                      { backgroundColor: `${item.color}1F` },
                    ]}
                  >
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>

                  <View style={styles.createAreaOptionTextBox}>
                    <Text style={styles.createAreaOptionTitle}>{item.title}</Text>
                    <Text style={styles.createAreaOptionSubtitle}>
                      Criar publicação em {item.title}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color="#8F8A91" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function renderImageModal() {
    const currentImage = fullImages[fullImageIndex];

    return (
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.imageModalCloseButton}
            onPress={closeImageModal}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {currentImage ? (
            <Image
              source={{ uri: currentImage }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : null}

          {fullImages.length > 1 ? (
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>
                {fullImageIndex + 1} de {fullImages.length}
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.86}
          onPress={() =>
            router.replace('/(private)/(tabs)/motoristas-cidade' as never)
          }
        >
          <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
        </TouchableOpacity>

        <View style={styles.headerTextContent}>
          <Text style={styles.headerEyebrow}>Comunidade</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Meus posts
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.headerIconBox}
          onPress={() => loadMyPosts(true)}
        >
          <Ionicons name="refresh-outline" size={21} color="#D4A64A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadMyPosts(true)}
            tintColor="#D4A64A"
          />
        }
      >
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTopRow}>
            {getUserAvatarUrl(loggedProfile) ? (
              <Image
                source={{ uri: getUserAvatarUrl(loggedProfile) }}
                style={styles.heroAvatar}
              />
            ) : (
              <View style={styles.heroIconBox}>
                <Ionicons name="person-outline" size={24} color="#D4A64A" />
              </View>
            )}

            <View style={styles.heroInfo}>
              <Text style={styles.heroEyebrow}>Área do criador</Text>
              <Text style={styles.heroTitle} numberOfLines={1}>
                {getShortName(loggedProfile)}
              </Text>
              <Text style={styles.heroText}>
                Gerencie as publicações que pertencem ao seu usuário logado.
              </Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <StatCard
              icon="newspaper-outline"
              label="Total"
              value={summary.total}
              color="#D4A64A"
              width={summaryCardWidth}
            />
            <StatCard
              icon="lock-open-outline"
              label="Abertos"
              value={summary.open}
              color="#22C55E"
              width={summaryCardWidth}
            />
            <StatCard
              icon="lock-closed-outline"
              label="Fechados"
              value={summary.closed}
              color="#9B969B"
              width={summaryCardWidth}
            />
            <StatCard
              icon="chatbubble-outline"
              label="Interações"
              value={summary.likes + summary.comments}
              color="#60A5FA"
              width={summaryCardWidth}
            />
          </View>
        </View>

        <View style={styles.filterPanel}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Gerenciamento</Text>
              <Text style={styles.sectionTitle}>Suas publicações</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.newPostButton}
              onPress={openCreateAreaPicker}
            >
              <Ionicons name="add" size={17} color="#080808" />
              <Text style={styles.newPostButtonText}>Novo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterRow}>
            {filterOptions.map((item) => (
              <FilterButton
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={filter === item.id}
                onPress={() => setFilter(item.id)}
              />
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#D4A64A" />
            <Text style={styles.loadingText}>Carregando seus posts...</Text>
          </View>
        ) : filteredPosts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="folder-open-outline" size={36} color="#8F8A91" />
            </View>
            <Text style={styles.emptyTitle}>Nenhum post encontrado</Text>
            <Text style={styles.emptyText}>
              Os posts criados pelo usuário logado aparecerão aqui.
            </Text>
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.emptyButton}
              onPress={openCreateAreaPicker}
            >
              <Ionicons name="add" size={18} color="#080808" />
              <Text style={styles.emptyButtonText}>Criar post</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.postsList}>
            {filteredPosts.map((post) => {
              const contentType = String(post.content_type || 'general');
              const config = getContentConfig(contentType);
              const open = isPostOpen(post);
              const canRenew = !open && config.canRenew;
              const postWithProfile: CommunityPost = {
                ...post,
                profile: post.profile ?? loggedProfile,
              };

              return (
                <View
                  key={post.id}
                  style={[
                    styles.postWrapper,
                    updatingPostId === post.id && styles.postWrapperUpdating,
                  ]}
                >
                  <CommunityPostCard
                    post={postWithProfile}
                    color={config.color}
                    currentUserId={currentUserId}
                    canRenew={canRenew}
                    postImagesViewportWidth={postImagesViewportWidth}
                    postImagePairItemWidth={postImagePairItemWidth}
                    details={renderPostDetails(post)}
                    onOpenComments={openPostConversation}
                    onOpenDriverProfile={openLoggedProfile}
                    onOpenImages={openImageModal}
                    onToggleLike={handleToggleLike}
                    onClosePost={handleClosePost}
                    onRenewPost={handleRenewPost}
                    onDeletePost={handleDeletePost}
                  />

                  {updatingPostId === post.id ? (
                    <View style={styles.updatingOverlay}>
                      <ActivityIndicator color="#D4A64A" />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {renderImageModal()}
      {renderCreateAreaPickerModal()}

      <CommunityCreatePostModal
        visible={createPostModalVisible}
        contentType={createPostContentType}
        currentUserId={currentUserId}
        profileCity={profileCity}
        profileImmediateRegion={profileImmediateRegion}
        onClose={closeCreatePostModal}
        onCreated={async () => {
          setCreatePostModalVisible(false);
          await loadMyPosts(true);
        }}
      />

      <CommunityPostConversation
        visible={conversationVisible}
        post={selectedConversationPost}
        currentUserId={currentUserId}
        postColor={
          selectedConversationPost
            ? getContentConfig(selectedConversationPost.content_type).color
            : '#D4A64A'
        }
        postImagesViewportWidth={postImagesViewportWidth}
        postImagePairItemWidth={postImagePairItemWidth}
        postImageTripleItemWidth={postImageTripleItemWidth}
        messageBubbleMinWidth={messageBubbleMinWidth}
        renderPostDetails={renderPostDetails}
        onClose={closePostConversation}
        onPostUpdated={() => loadMyPosts(true)}
        onOpenDriverProfile={openLoggedProfile}
        onOpenImages={openImageModal}
      />
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  width,
}: {
  icon: IconName;
  label: string;
  value: number;
  color: string;
  width: number;
}) {
  return (
    <View style={[styles.statCard, { borderColor: `${color}22`, width }]}>
      <View style={[styles.statIconBox, { backgroundColor: `${color}16` }]}>
        <Ionicons name={icon} size={17} color={color} />
      </View>

      <View style={styles.statTextBox}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function FilterButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      style={[styles.filterButton, active && styles.filterButtonActive]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={15}
        color={active ? '#080808' : '#9B969B'}
      />
      <Text style={[styles.filterText, active && styles.filterTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050505' },
  container: { flex: 1, backgroundColor: '#050505' },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 128 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 18,
    backgroundColor: '#070707',
    borderBottomWidth: 1,
    borderBottomColor: '#211D16',
    zIndex: 50,
    elevation: 50,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContent: { flex: 1, minWidth: 0 },
  headerEyebrow: {
    color: '#D4A64A',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: '#F5F0E6',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    backgroundColor: '#0B0B0F',
    overflow: 'hidden',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  heroGlow: {
    position: 'absolute',
    right: -42,
    top: -48,
    width: 156,
    height: 156,
    borderRadius: 999,
    backgroundColor: 'rgba(212,166,74,0.13)',
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.32)',
    backgroundColor: '#18171D',
  },
  heroIconBox: {
    width: 56,
    height: 56,
    borderRadius: 19,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: { flex: 1, minWidth: 0 },
  heroEyebrow: {
    color: '#B9AA7A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#F5F0E6',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  heroText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 4,
  },
  statsGrid: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginTop: 16,
  },
  statCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 78,
    borderRadius: 20,
    backgroundColor: 'rgba(16,16,20,0.88)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'flex-start',
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTextBox: {
    alignItems: 'flex-start',
    flex: 1,
    minWidth: 0,
  },
  statValue: {
    color: '#F5F0E6',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
    textAlign: 'left',
  },
  statLabel: {
    color: '#9B969B',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
    textAlign: 'left',
  },
  filterPanel: {
    borderRadius: 22,
    backgroundColor: '#0B0B0F',
    borderWidth: 1,
    borderColor: '#25222A',
    padding: 12,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
    gap: 10,
  },
  sectionEyebrow: {
    color: '#B9AA7A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  newPostButton: {
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: '#D4A64A',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newPostButtonText: {
    color: '#080808',
    fontSize: 12,
    fontWeight: '900',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: '#151419',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  filterButtonActive: { backgroundColor: '#D4A64A', borderColor: '#D4A64A' },
  filterText: { color: '#9B969B', fontSize: 11, fontWeight: '900' },
  filterTextActive: { color: '#080808' },
  loadingBox: {
    minHeight: 240,
    borderRadius: 24,
    backgroundColor: '#0B0B0F',
    borderWidth: 1,
    borderColor: '#25222A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 12,
  },
  emptyState: {
    minHeight: 280,
    borderRadius: 24,
    backgroundColor: '#0B0B0F',
    borderWidth: 1,
    borderColor: '#25222A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#F5F0E6',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: '#D4A64A',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 16,
  },
  emptyButtonText: {
    color: '#080808',
    fontSize: 13,
    fontWeight: '900',
  },
  postsList: { gap: 13 },
  postWrapper: {
    position: 'relative',
  },
  postWrapperUpdating: {
    opacity: 0.82,
  },
  updatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    backgroundColor: 'rgba(5,5,5,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBox: {
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  detailHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  detailIconBox: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailInfo: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: { color: '#9B969B', fontSize: 11, fontWeight: '900' },
  detailText: {
    color: '#D8D1C4',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
  },
  whatsappButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCardBox: {
    marginTop: 12,
  },
  resultOperationalCard: {
    borderColor: 'rgba(250,204,21,0.20)',
  },
  createAreaOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  createAreaCard: {
    borderRadius: 26,
    backgroundColor: '#0B0B0F',
    borderWidth: 1,
    borderColor: '#25222A',
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.36,
    shadowRadius: 24,
    elevation: 12,
  },
  createAreaHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  createAreaHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createAreaHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  createAreaEyebrow: {
    color: '#B9AA7A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  createAreaTitle: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  createAreaCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createAreaDescription: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 10,
  },
  createAreaOptions: {
    gap: 8,
    marginTop: 14,
  },
  createAreaOption: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  createAreaOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createAreaOptionTextBox: {
    flex: 1,
    minWidth: 0,
  },
  createAreaOptionTitle: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '900',
  },
  createAreaOptionSubtitle: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '82%',
  },
  imageCounter: {
    position: 'absolute',
    bottom: 44,
    alignSelf: 'center',
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCounterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
});
