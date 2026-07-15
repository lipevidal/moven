import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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

type ContentType =
  | 'general'
  | 'sos'
  | 'sale'
  | 'rental'
  | 'results'
  | 'events'
  | 'electric';

type ContentCard = {
  id: ContentType;
  title: string;
  description: string;
  icon: IconName;
  color: string;
  cityOnly?: boolean;
};

type CommunityProfile = {
  id?: string;
  user_id?: string;
  full_name?: string | null;
  name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  city?: string | null;
  region?: string | null;
  regiao_imediata?: string | null;
  regiao_intermediaria?: string | null;
  estado?: string | null;
  estado_uf?: string | null;
};

type RegionCityMember = {
  city: string;
  members: number;
};

const contents: ContentCard[] = [
  {
    id: 'general',
    title: 'Geral',
    description: 'Dúvidas, discussões e comentários de todos os usuários.',
    icon: 'chatbubbles-outline',
    color: '#D4A64A',
  },
  {
    id: 'sos',
    title: 'Apoio / S.O.S',
    description: 'Ajuda rápida para passageiro, pane no veículo ou emergência local.',
    icon: 'alert-circle-outline',
    color: '#EF4444',
    cityOnly: true,
  },
  {
    id: 'sale',
    title: 'Venda de Itens',
    description: 'Produtos regionais e nacionais anunciados por motoristas.',
    icon: 'pricetags-outline',
    color: '#22C55E',
  },
  {
    id: 'rental',
    title: 'Aluguel de Veículos',
    description: 'Veículos disponíveis para aluguel na sua cidade.',
    icon: 'car-sport-outline',
    color: '#60A5FA',
    cityOnly: true,
  },
  {
    id: 'results',
    title: 'Resultados e Metas',
    description: 'Compartilhe resultados do dia, semana, mês ou ano.',
    icon: 'trophy-outline',
    color: '#FACC15',
  },
  {
    id: 'events',
    title: 'Eventos',
    description: 'Eventos, encontros e ações locais da comunidade.',
    icon: 'calendar-outline',
    color: '#A78BFA',
    cityOnly: true,
  },
  {
    id: 'electric',
    title: 'Elétricos e Híbridos',
    description: 'Conteúdo nacional sobre elétricos, híbridos e tecnologia.',
    icon: 'flash-outline',
    color: '#2DD4BF',
  },
];

function normalizeText(value?: string | null) {
  return String(value ?? '').trim();
}

function getProfileImmediateRegion(profile?: CommunityProfile | null, user?: any) {
  return normalizeText(
    profile?.regiao_imediata ||
      profile?.region ||
      user?.user_metadata?.regiao_imediata ||
      user?.user_metadata?.immediate_region,
  );
}

function getProfileCity(profile?: CommunityProfile | null, user?: any) {
  return normalizeText(
    profile?.city ||
      user?.user_metadata?.city ||
      user?.user_metadata?.profile_city ||
      user?.user_metadata?.municipality,
  );
}

export default function LocalCommunityHomeScreen() {
  const [city, setCity] = useState('');
  const [immediateRegion, setImmediateRegion] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const [myOpenPostsCount, setMyOpenPostsCount] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [regionCities, setRegionCities] = useState<RegionCityMember[]>([]);
  const [citiesModalVisible, setCitiesModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadHome();
    }, []),
  );

  async function loadHome(showRefresh = false) {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      await closeExpiredPosts();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user?.id) {
        setCity('');
        setImmediateRegion('');
        setMemberCount(0);
        setMyOpenPostsCount(0);
        setCounts({});
        setRegionCities([]);
        setCitiesModalVisible(false);
        return;
      }

      const profile = await getLoggedProfile(user.id, user);
      const userCity = getProfileCity(profile, user);
      const userImmediateRegion = getProfileImmediateRegion(profile, user);

      setCity(userCity);
      setImmediateRegion(userImmediateRegion);

      const [postCounts, members, openPosts, cities] = await Promise.all([
        loadCounts(userImmediateRegion),
        loadMemberCount(userImmediateRegion, userCity),
        loadMyOpenPostsCount(user.id),
        loadRegionCities(userImmediateRegion, userCity),
      ]);

      setCounts(postCounts);
      setMemberCount(members);
      setMyOpenPostsCount(openPosts);
      setRegionCities(cities);
    } catch (error) {
      console.log('Erro ao carregar comunidade local:', error);
      setCounts({});
      setMemberCount(0);
      setMyOpenPostsCount(0);
      setRegionCities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function closeExpiredPosts() {
    try {
      await (supabase as any).rpc('close_expired_community_posts');
    } catch (error) {
      console.log('close_expired_community_posts indisponível:', error);
    }
  }

  async function getLoggedProfile(userId: string, user: any): Promise<CommunityProfile | null> {
    const { data: profileById, error: profileByIdError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!profileByIdError && profileById) {
      return profileById as CommunityProfile;
    }

    const { data: profileByUserId, error: profileByUserIdError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!profileByUserIdError && profileByUserId) {
      return profileByUserId as CommunityProfile;
    }

    return {
      id: userId,
      full_name: user?.user_metadata?.full_name || user?.user_metadata?.name,
      username: user?.user_metadata?.username,
      avatar_url: user?.user_metadata?.avatar_url || user?.user_metadata?.picture,
      email: user?.email,
      city: user?.user_metadata?.city,
      regiao_imediata: user?.user_metadata?.regiao_imediata,
      regiao_intermediaria: user?.user_metadata?.regiao_intermediaria,
      estado: user?.user_metadata?.estado,
      estado_uf: user?.user_metadata?.estado_uf,
    };
  }

  async function loadMemberCount(userImmediateRegion: string, userCity: string) {
    try {
      if (userImmediateRegion) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('regiao_imediata', userImmediateRegion)
          .limit(3000);

        if (!error) {
          return (data ?? []).length;
        }

        console.log('Erro ao contar membros por região imediata:', error);
      }

      if (userCity) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('city', userCity)
          .limit(3000);

        if (!error) {
          return (data ?? []).length;
        }

        console.log('Erro ao contar membros por cidade:', error);
      }

      return 0;
    } catch (error) {
      console.log('Erro ao carregar membros da comunidade:', error);
      return 0;
    }
  }

  async function loadRegionCities(userImmediateRegion: string, userCity: string) {
    try {
      if (userImmediateRegion) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, city, regiao_imediata')
          .eq('regiao_imediata', userImmediateRegion)
          .limit(5000);

        if (!error) {
          const cityMap = (data ?? []).reduce((acc: Record<string, number>, profile: any) => {
            const profileCity = normalizeText(profile?.city) || 'Cidade não informada';
            acc[profileCity] = (acc[profileCity] ?? 0) + 1;
            return acc;
          }, {});

          return Object.entries(cityMap)
            .map(([cityName, members]) => ({
              city: cityName,
              members: Number(members),
            }))
            .sort((a, b) => {
              if (b.members !== a.members) return b.members - a.members;
              return a.city.localeCompare(b.city, 'pt-BR');
            });
        }

        console.log('Erro ao carregar cidades da região imediata:', error);
      }

      if (userCity) {
        const fallbackMembers = await loadMemberCount('', userCity);
        return [{ city: userCity, members: fallbackMembers }];
      }

      return [];
    } catch (error) {
      console.log('Erro ao listar cidades da região:', error);
      return [];
    }
  }


  async function loadMyOpenPostsCount(userId: string) {
    try {
      const nowIso = new Date().toISOString();

      const { data, error } = await supabase
        .from('community_posts')
        .select('id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .eq('status', 'open')
        .is('closed_at', null)
        .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
        .limit(1000);

      if (error) {
        console.log('Erro ao contar meus posts abertos:', error);
        return 0;
      }

      return (data ?? []).length;
    } catch (error) {
      console.log('Erro ao carregar meus posts abertos:', error);
      return 0;
    }
  }

  function getProfileUserIds(profile: any) {
    return [profile?.id]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean);
  }

  function splitIntoChunks<T>(items: T[], size = 80) {
    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }

    return chunks;
  }

  async function loadRegionMemberUserIds(userImmediateRegion: string) {
    const cleanImmediateRegion = normalizeText(userImmediateRegion);

    if (!cleanImmediateRegion) return [];

    const { data, error } = await supabase
      .from('profiles')
      .select('id, regiao_imediata')
      .eq('regiao_imediata', cleanImmediateRegion)
      .limit(5000);

    if (error) {
      console.log('Erro ao buscar membros da região imediata para contar posts:', error);
      return [];
    }

    return Array.from(
      new Set(
        (data ?? [])
          .flatMap(getProfileUserIds)
          .map((value) => String(value).trim())
          .filter(Boolean),
      ),
    );
  }

  async function loadCounts(userImmediateRegion: string) {
    const nowIso = new Date().toISOString();
    const regionMemberUserIds = await loadRegionMemberUserIds(userImmediateRegion);

    if (regionMemberUserIds.length === 0) {
      return {};
    }

    const countsByType: Record<string, number> = {};

    for (const userIdChunk of splitIntoChunks(regionMemberUserIds)) {
      const { data, error } = await supabase
        .from('community_posts')
        .select('id, user_id, content_type, category, status, closed_at, expires_at')
        .in('user_id', userIdChunk)
        .is('deleted_at', null)
        .eq('status', 'open')
        .is('closed_at', null)
        .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
        .limit(5000);

      if (error) {
        console.log('Erro ao contar posts abertos por região imediata:', error);
        throw error;
      }

      (data ?? []).forEach((post: any) => {
        const contentType = String(post.content_type || post.category || 'general');
        const content = contents.find((item) => item.id === contentType);

        if (!content) return;

        countsByType[contentType] = (countsByType[contentType] ?? 0) + 1;
      });
    }

    return countsByType;
  }

  function openContent(contentType: ContentType) {
    router.push({
      pathname: '/(private)/motoristas-cidade-feed',
      params: { contentType },
    } as never);
  }

  function openDriversList() {
    router.push('/(private)/(tabs)/motoristas-cidade-lista' as never);
  }

  function openCitiesModal() {
    setCitiesModalVisible(true);
  }

  function closeCitiesModal() {
    setCitiesModalVisible(false);
  }

  function openMyPosts() {
    router.push('/(private)/motoristas-cidade-meus-posts' as never);
  }

  function openMyAccount() {
    router.push('/(private)/(tabs)/minha-conta' as never);
  }

  function renderCitiesModal() {
    return (
      <Modal
        visible={citiesModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeCitiesModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            style={StyleSheet.absoluteFillObject}
            onPress={closeCitiesModal}
          />

          <View style={styles.citiesModalCard}>
            <View style={styles.citiesModalHeader}>
              <View style={styles.citiesModalIconBox}>
                <Ionicons name="business-outline" size={23} color="#D4A64A" />
              </View>

              <View style={styles.citiesModalTitleBox}>
                <Text style={styles.citiesModalEyebrow}>Cidades da região</Text>
                <Text style={styles.citiesModalTitle} numberOfLines={1}>
                  {immediateRegion || city || 'Região não definida'}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.citiesModalCloseButton}
                onPress={closeCitiesModal}
              >
                <Ionicons name="close" size={21} color="#F5F0E6" />
              </TouchableOpacity>
            </View>

            <Text style={styles.citiesModalDescription}>
              Cidades pertencentes à sua região imediata, ordenadas da maior para a menor
              quantidade de membros.
            </Text>

            <ScrollView
              style={styles.citiesListScroll}
              contentContainerStyle={styles.citiesListContent}
              showsVerticalScrollIndicator={false}
            >
              {regionCities.length === 0 ? (
                <View style={styles.citiesEmptyBox}>
                  <Ionicons name="location-outline" size={28} color="#8F8A91" />
                  <Text style={styles.citiesEmptyTitle}>Nenhuma cidade encontrada</Text>
                  <Text style={styles.citiesEmptyText}>
                    Atualize sua cidade onde mora para liberar a lista de cidades da sua região.
                  </Text>
                </View>
              ) : (
                regionCities.map((item, index) => (
                  <View key={`${item.city}-${index}`} style={styles.cityRow}>
                    <View style={styles.cityRankBox}>
                      <Text style={styles.cityRankText}>{index + 1}</Text>
                    </View>

                    <View style={styles.cityInfo}>
                      <Text style={styles.cityName} numberOfLines={1}>
                        {item.city}
                      </Text>
                      <Text style={styles.citySubtitle}>
                        {item.members === 1 ? '1 membro cadastrado' : `${item.members} membros cadastrados`}
                      </Text>
                    </View>

                    <View style={styles.cityMembersPill}>
                      <Ionicons name="people-outline" size={14} color="#D4A64A" />
                      <Text style={styles.cityMembersText}>{item.members}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  const regionTitle = immediateRegion || city || 'Defina sua região';
  const hasLocation = Boolean(immediateRegion || city);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          activeOpacity={0.86}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
        </TouchableOpacity>

        <View style={styles.headerTextContent}>
          <Text style={styles.headerEyebrow}>Comunidade</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {regionTitle}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.headerIconButton}
            onPress={openCitiesModal}
          >
            <Ionicons name="business-outline" size={21} color="#D4A64A" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.headerIconButton}
            onPress={openDriversList}
          >
            <Ionicons name="people-outline" size={21} color="#D4A64A" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.headerIconButton}
            onPress={openMyPosts}
          >
            <Ionicons name="folder-open-outline" size={21} color="#D4A64A" />

            {myOpenPostsCount > 0 ? (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>
                  {myOpenPostsCount > 99 ? '99+' : myOpenPostsCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadHome(true)} tintColor="#D4A64A" />
        }
      >
        <View style={styles.heroCard}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroIconBox}>
              <Ionicons name="people-circle-outline" size={28} color="#D4A64A" />
            </View>

            <View style={styles.heroInfo}>
              <Text style={styles.heroEyebrow}>Comunidade da regiao de</Text>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {regionTitle}
              </Text>
            </View>
          </View>

          <Text style={styles.heroText}>
            Encontre motoristas próximos, acompanhe publicações locais e compartilhe avisos,
            oportunidades, eventos e resultados da sua rotina.
          </Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatValue}>{memberCount}</Text>
              <Text style={styles.heroStatLabel}>membros</Text>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatValue}>
                {contents.reduce((total, item) => total + Number(counts[item.id] ?? 0), 0)}
              </Text>
              <Text style={styles.heroStatLabel}>posts abertos</Text>
            </View>
          </View>
        </View>

        {!hasLocation && !loading ? (
          <View style={styles.warningCard}>
            <Ionicons name="location-outline" size={22} color="#FACC15" />

            <View style={styles.warningInfo}>
              <Text style={styles.warningTitle}>Região não definida</Text>
              <Text style={styles.warningText}>
                Atualize sua cidade onde mora para liberar a comunidade da sua região.
              </Text>

              <TouchableOpacity activeOpacity={0.86} style={styles.warningButton} onPress={openMyAccount}>
                <Text style={styles.warningButtonText}>Abrir minha conta</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Explorar</Text>
            <Text style={styles.sectionTitle}>Áreas da comunidade</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#D4A64A" />
            <Text style={styles.loadingText}>Carregando comunidade...</Text>
          </View>
        ) : (
          <View style={styles.contentsList}>
            {contents.map((content) => {
              const count = Number(counts[content.id] ?? 0);

              return (
                <TouchableOpacity
                  key={content.id}
                  activeOpacity={0.9}
                  style={[
                    styles.contentCard,
                    {
                      borderColor: `${content.color}33`,
                    },
                  ]}
                  onPress={() => openContent(content.id)}
                >
                  <View
                    style={[
                      styles.contentGlow,
                      {
                        backgroundColor: `${content.color}18`,
                      },
                    ]}
                  />

                  <View
                    style={[
                      styles.contentAccent,
                      {
                        backgroundColor: content.color,
                      },
                    ]}
                  />

                  <View
                    style={[
                      styles.contentIconBox,
                      {
                        backgroundColor: `${content.color}1F`,
                        borderColor: `${content.color}45`,
                      },
                    ]}
                  >
                    <Ionicons name={content.icon} size={25} color={content.color} />
                  </View>

                  <View style={styles.contentInfo}>
                    <View style={styles.contentTitleRow}>
                      <Text style={styles.contentTitle}>{content.title}</Text>

                      <View style={[styles.openBadge, count > 0 && styles.openBadgeActive]}>
                        <Text style={[styles.openBadgeText, count > 0 && styles.openBadgeTextActive]}>
                          {count} posts
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.contentDescription}>{content.description}</Text>
                  </View>

                  <View style={styles.contentArrowBox}>
                    <Ionicons name="chevron-forward" size={19} color="#F5F0E6" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {renderCitiesModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },

  container: {
    flex: 1,
    backgroundColor: '#050505',
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 128,
  },

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

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  headerBadge: {
    position: 'absolute',
    minWidth: 19,
    height: 19,
    borderRadius: 999,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#070707',
    top: -6,
    right: -6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

  headerTextContent: {
    flex: 1,
    minWidth: 0,
  },

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
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.32)',
    backgroundColor: '#101014',
    padding: 18,
    marginBottom: 14,
  },

  heroGlowOne: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(212,166,74,0.18)',
    right: -70,
    top: -80,
  },

  heroGlowTwo: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(96,165,250,0.10)',
    left: -55,
    bottom: -65,
  },

  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },

  heroIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(212,166,74,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroInfo: {
    flex: 1,
    minWidth: 0,
  },

  heroEyebrow: {
    color: '#D4A64A',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },

  heroTitle: {
    color: '#F5F0E6',
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginTop: 3,
  },

  heroText: {
    color: '#BDB5A7',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 14,
  },

  heroStatsRow: {
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: 'rgba(5,5,5,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(245,240,230,0.08)',
    marginTop: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  heroStatBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroStatValue: {
    color: '#F5F0E6',
    fontSize: 20,
    fontWeight: '900',
  },

  heroStatLabel: {
    color: '#8F8A91',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },

  heroDivider: {
    width: 1,
    height: 34,
    backgroundColor: 'rgba(245,240,230,0.10)',
  },

  warningCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.24)',
    backgroundColor: 'rgba(250,204,21,0.08)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },

  warningInfo: {
    flex: 1,
  },

  warningTitle: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  warningText: {
    color: '#D8D1C4',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },

  warningButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: '#D4A64A',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  warningButtonText: {
    color: '#080808',
    fontSize: 12,
    fontWeight: '900',
  },

  sectionHeader: {
    marginTop: 4,
    marginBottom: 12,
  },

  sectionEyebrow: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },

  sectionTitle: {
    color: '#F5F0E6',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 2,
  },

  loadingBox: {
    minHeight: 220,
    borderRadius: 18,
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

  contentsList: {
    gap: 13,
  },

  contentCard: {
    position: 'relative',
    minHeight: 104,
    borderRadius: 22,
    backgroundColor: '#101014',
    borderWidth: 1,
    padding: 15,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },

  contentGlow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    right: -62,
    top: -54,
  },

  contentAccent: {
    position: 'absolute',
    left: 0,
    top: 18,
    bottom: 18,
    width: 4,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },

  contentIconBox: {
    width: 56,
    height: 56,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  contentInfo: {
    flex: 1,
    minWidth: 0,
  },

  contentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  contentTitle: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.25,
  },

  contentDescription: {
    color: '#A8A1A8',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 6,
  },

  contentArrowBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(245,240,230,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,240,230,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  openBadge: {
    flexShrink: 0,
    minHeight: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2A2830',
    backgroundColor: '#18171D',
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  openBadgeActive: {
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderColor: 'rgba(212,166,74,0.30)',
  },

  openBadgeText: {
    color: '#9B969B',
    fontSize: 10,
    fontWeight: '900',
  },

  openBadgeTextActive: {
    color: '#D4A64A',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 18,
    justifyContent: 'center',
  },

  citiesModalCard: {
    maxHeight: '78%',
    borderRadius: 26,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.28)',
    padding: 16,
    overflow: 'hidden',
  },

  citiesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  citiesModalIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  citiesModalTitleBox: {
    flex: 1,
    minWidth: 0,
  },

  citiesModalEyebrow: {
    color: '#D4A64A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  citiesModalTitle: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },

  citiesModalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  citiesModalDescription: {
    color: '#A8A1A8',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 12,
  },

  citiesListScroll: {
    marginTop: 14,
  },

  citiesListContent: {
    gap: 10,
    paddingBottom: 2,
  },

  cityRow: {
    minHeight: 66,
    borderRadius: 18,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },

  cityRankBox: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cityRankText: {
    color: '#D4A64A',
    fontSize: 12,
    fontWeight: '900',
  },

  cityInfo: {
    flex: 1,
    minWidth: 0,
  },

  cityName: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  citySubtitle: {
    color: '#8F8A91',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },

  cityMembersPill: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  cityMembersText: {
    color: '#E8D49B',
    fontSize: 12,
    fontWeight: '900',
  },

  citiesEmptyBox: {
    minHeight: 180,
    borderRadius: 18,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },

  citiesEmptyTitle: {
    color: '#F5F0E6',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 10,
    textAlign: 'center',
  },

  citiesEmptyText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center',
  },
});
