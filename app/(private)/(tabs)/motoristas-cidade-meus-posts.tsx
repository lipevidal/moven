import { useCallback, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { supabase } from '../../../src/database/supabase';

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
  rental_periodicity?: string | null;
  rental_price?: number | string | null;
  event_at?: string | null;
  event_end_at?: string | null;
  event_address?: string | null;
  result_snapshot?: any;
  likes_count?: number;
  comments_count?: number;
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

function getPostTitle(post: CommunityPost) {
  const contentType = String(post.content_type || 'general');

  if (contentType === 'sale') {
    return post.product_name || 'Item à venda';
  }

  if (contentType === 'rental') {
    const vehicle = `${post.vehicle_brand || ''} ${post.vehicle_model || ''}`.trim();
    return vehicle || 'Veículo para aluguel';
  }

  if (contentType === 'events') return 'Evento';
  if (contentType === 'results') return 'Resultado compartilhado';

  if (contentType === 'sos') {
    return post.category === 'vehicle_breakdown'
      ? 'Pane no veículo'
      : 'Apoio / S.O.S';
  }

  return 'Feed geral';
}

export default function MyCommunityPostsScreen() {
  const [currentUserId, setCurrentUserId] = useState('');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [filter, setFilter] = useState<PostFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingPostId, setUpdatingPostId] = useState('');

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

    return {
      total,
      open,
      closed: Math.max(total - open, 0),
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
        return;
      }

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

      const [likesByPostId, commentsByPostId] = await Promise.all([
        getLikesCountByPostIds(postIds),
        getCommentsCountByPostIds(postIds),
      ]);

      setPosts(
        loadedPosts.map((post: any) => ({
          ...post,
          images: Array.isArray(post.images) ? post.images : [],
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

  function openPostContent(post: CommunityPost) {
    const contentType = String(post.content_type || 'general');

    router.push({
      pathname: '/(private)/(tabs)/motoristas-cidade-feed',
      params: {
        contentType,
      },
    } as never);
  }

  function openWhatsApp(post: CommunityPost) {
    if (!post.whatsapp_url) return;
    Linking.openURL(String(post.whatsapp_url));
  }

  function renderPostDetails(post: CommunityPost) {
    const contentType = String(post.content_type || 'general');

    if (contentType === 'sale') {
      return (
        <View style={styles.detailBox}>
          <Text style={styles.detailLabel}>Valor do item</Text>
          <Text style={styles.priceText}>R$ {formatCurrency(post.price)}</Text>
        </View>
      );
    }

    if (contentType === 'rental') {
      return (
        <View style={styles.detailBox}>
          <Text style={styles.detailLabel}>Valor do aluguel</Text>
          <Text style={styles.priceText}>
            R$ {formatCurrency(post.rental_price)} /{' '}
            {post.rental_periodicity === 'day'
              ? 'dia'
              : post.rental_periodicity === 'month'
                ? 'mês'
                : 'semana'}
          </Text>
        </View>
      );
    }

    if (contentType === 'events') {
      return (
        <View style={styles.detailBox}>
          <Text style={styles.detailLabel}>Evento</Text>
          <Text style={styles.detailText}>Início: {formatDate(post.event_at)}</Text>
          <Text style={styles.detailText}>Fim: {formatDate(post.event_end_at)}</Text>
          <Text style={styles.detailText}>
            Endereço: {post.event_address || 'Não informado'}
          </Text>
        </View>
      );
    }

    if (contentType === 'results' && post.result_snapshot) {
      const revenue = Number(post.result_snapshot.revenue ?? 0);
      const expenses = Number(post.result_snapshot.expenses ?? 0);
      const profit = Number(post.result_snapshot.profit ?? revenue - expenses);

      return (
        <View style={styles.detailBox}>
          <Text style={styles.detailLabel}>Resultado</Text>
          <Text style={styles.detailText}>
            Faturamento: R$ {formatCurrency(revenue)}
          </Text>
          <Text style={styles.detailText}>
            Despesas: R$ {formatCurrency(expenses)}
          </Text>
          <Text style={styles.priceText}>Lucro: R$ {formatCurrency(profit)}</Text>
        </View>
      );
    }

    return null;
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

        <View style={styles.headerIconBox}>
          <Ionicons name="folder-open-outline" size={21} color="#D4A64A" />
        </View>
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
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconBox}>
              <Ionicons name="settings-outline" size={22} color="#D4A64A" />
            </View>

            <View style={styles.heroInfo}>
              <Text style={styles.heroTitle}>Administrar meus posts</Text>
              <Text style={styles.heroText}>
                Veja seus feeds, acompanhe status, feche, renove quando
                permitido ou exclua publicações.
              </Text>
            </View>
          </View>

          <View style={styles.countRow}>
            <View style={styles.countPill}>
              <Ionicons name="newspaper-outline" size={14} color="#D4A64A" />
              <Text style={styles.countPillText}>{summary.total} total</Text>
            </View>

            <View style={styles.countPillGreen}>
              <Ionicons name="lock-open-outline" size={14} color="#22C55E" />
              <Text style={styles.countPillGreenText}>
                {summary.open} abertos
              </Text>
            </View>

            <View style={styles.countPillGray}>
              <Ionicons name="lock-closed-outline" size={14} color="#9B969B" />
              <Text style={styles.countPillGrayText}>
                {summary.closed} fechados
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.filterRow}>
          <FilterButton
            label="Todos"
            active={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <FilterButton
            label="Abertos"
            active={filter === 'open'}
            onPress={() => setFilter('open')}
          />
          <FilterButton
            label="Fechados"
            active={filter === 'closed'}
            onPress={() => setFilter('closed')}
          />
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
              Seus posts criados na comunidade aparecerão aqui para
              administração.
            </Text>
          </View>
        ) : (
          <View style={styles.postsList}>
            {filteredPosts.map((post) => {
              const contentType = String(post.content_type || 'general');
              const config = getContentConfig(contentType);
              const open = isPostOpen(post);
              const images = getPostImages(post);
              const canRenew = !open && config.canRenew;
              const updating = updatingPostId === post.id;

              return (
                <View key={post.id} style={styles.postCard}>
                  <View style={styles.postTopRow}>
                    <View
                      style={[
                        styles.contentIconBox,
                        {
                          backgroundColor: `${config.color}1F`,
                          borderColor: `${config.color}45`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={config.icon}
                        size={22}
                        color={config.color}
                      />
                    </View>

                    <View style={styles.postInfo}>
                      <Text style={styles.postTitle} numberOfLines={1}>
                        {getPostTitle(post)}
                      </Text>
                      <Text style={styles.postMeta} numberOfLines={1}>
                        {config.title} · {formatDate(post.created_at)}
                      </Text>
                    </View>

                    <View style={open ? styles.openBadge : styles.closedBadge}>
                      <Text
                        style={
                          open ? styles.openBadgeText : styles.closedBadgeText
                        }
                      >
                        {open ? 'Aberto' : 'Fechado'}
                      </Text>
                    </View>
                  </View>

                  {post.content ? (
                    <Text style={styles.postContent} numberOfLines={4}>
                      {post.content}
                    </Text>
                  ) : null}

                  {renderPostDetails(post)}

                  {images.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.imagesList}
                    >
                      {images.map((imageUrl, index) => (
                        <Image
                          key={`${imageUrl}-${index}`}
                          source={{ uri: imageUrl }}
                          style={styles.postImage}
                        />
                      ))}
                    </ScrollView>
                  ) : null}

                  <View style={styles.metricsRow}>
                    <View style={styles.metricPill}>
                      <Ionicons name="heart-outline" size={15} color="#D4A64A" />
                      <Text style={styles.metricText}>
                        {Number(post.likes_count ?? 0)}
                      </Text>
                    </View>

                    <View style={styles.metricPill}>
                      <Ionicons
                        name="chatbubble-outline"
                        size={15}
                        color="#D4A64A"
                      />
                      <Text style={styles.metricText}>
                        {Number(post.comments_count ?? 0)}
                      </Text>
                    </View>

                    {post.expires_at ? (
                      <View style={styles.metricPill}>
                        <Ionicons
                          name="timer-outline"
                          size={15}
                          color="#D4A64A"
                        />
                        <Text style={styles.metricText}>
                          {open ? 'Fecha' : 'Fechou'} {formatDate(post.expires_at)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.86}
                      style={styles.secondaryButton}
                      onPress={() => openPostContent(post)}
                    >
                      <Ionicons name="eye-outline" size={17} color="#D4A64A" />
                      <Text style={styles.secondaryButtonText}>Ver</Text>
                    </TouchableOpacity>

                    {post.whatsapp_url ? (
                      <TouchableOpacity
                        activeOpacity={0.86}
                        style={styles.whatsappButton}
                        onPress={() => openWhatsApp(post)}
                      >
                        <Ionicons
                          name="logo-whatsapp"
                          size={17}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                    ) : null}

                    {open ? (
                      <TouchableOpacity
                        activeOpacity={0.86}
                        style={styles.closeButton}
                        disabled={updating}
                        onPress={() => handleClosePost(post)}
                      >
                        {updating ? (
                          <ActivityIndicator color="#FACC15" />
                        ) : (
                          <>
                            <Ionicons
                              name="lock-closed-outline"
                              size={17}
                              color="#FACC15"
                            />
                            <Text style={styles.closeButtonText}>Fechar</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : null}

                    {canRenew ? (
                      <TouchableOpacity
                        activeOpacity={0.86}
                        style={styles.renewButton}
                        disabled={updating}
                        onPress={() => handleRenewPost(post)}
                      >
                        {updating ? (
                          <ActivityIndicator color="#080808" />
                        ) : (
                          <>
                            <Ionicons
                              name="refresh-outline"
                              size={17}
                              color="#080808"
                            />
                            <Text style={styles.renewButtonText}>Renovar</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      activeOpacity={0.86}
                      style={styles.deleteButton}
                      disabled={updating}
                      onPress={() => handleDeletePost(post)}
                    >
                      {updating ? (
                        <ActivityIndicator color="#F87171" />
                      ) : (
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color="#F87171"
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function FilterButton({
  label,
  active,
  onPress,
}: {
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
      <Text style={[styles.filterText, active && styles.filterTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050505' },
  container: { flex: 1, backgroundColor: '#050505' },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 128 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 50,
    paddingBottom: 16,
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
    borderRadius: 12,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
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
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    backgroundColor: '#101014',
    padding: 18,
    marginBottom: 14,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: { flex: 1 },
  heroTitle: { color: '#F5F0E6', fontSize: 18, fontWeight: '900' },
  heroText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  countRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  countPill: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.20)',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countPillText: { color: '#E8D49B', fontSize: 11, fontWeight: '900' },
  countPillGreen: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.20)',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countPillGreenText: { color: '#86EFAC', fontSize: 11, fontWeight: '900' },
  countPillGray: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countPillGrayText: { color: '#9B969B', fontSize: 11, fontWeight: '900' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterButton: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: { backgroundColor: '#D4A64A', borderColor: '#D4A64A' },
  filterText: { color: '#9B969B', fontSize: 12, fontWeight: '900' },
  filterTextActive: { color: '#080808' },
  loadingBox: {
    minHeight: 220,
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
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
    minHeight: 250,
    borderRadius: 16,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyIconBox: {
    width: 70,
    height: 70,
    borderRadius: 18,
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
  postsList: { gap: 12 },
  postCard: {
    borderRadius: 18,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 14,
  },
  postTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contentIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postInfo: { flex: 1, minWidth: 0 },
  postTitle: { color: '#F5F0E6', fontSize: 14, fontWeight: '900' },
  postMeta: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },
  openBadge: {
    minHeight: 27,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openBadgeText: { color: '#86EFAC', fontSize: 10, fontWeight: '900' },
  closedBadge: {
    minHeight: 27,
    borderRadius: 999,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedBadgeText: { color: '#9B969B', fontSize: 10, fontWeight: '900' },
  postContent: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 12,
  },
  detailBox: {
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 12,
    marginTop: 12,
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
    color: '#86EFAC',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
  },
  imagesList: { gap: 10, paddingTop: 12 },
  postImage: {
    width: 148,
    height: 120,
    borderRadius: 15,
    backgroundColor: '#18171D',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metricPill: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(212,166,74,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.16)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricText: { color: '#E8D49B', fontSize: 11, fontWeight: '900' },
  actionsRow: {
    borderTopWidth: 1,
    borderTopColor: '#2A2830',
    marginTop: 13,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  secondaryButton: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(212,166,74,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.18)',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secondaryButtonText: { color: '#D4A64A', fontSize: 12, fontWeight: '900' },
  whatsappButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(250,204,21,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.18)',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  closeButtonText: { color: '#FACC15', fontSize: 12, fontWeight: '900' },
  renewButton: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: '#D4A64A',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  renewButtonText: { color: '#080808', fontSize: 12, fontWeight: '900' },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(248,113,113,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

