import { useCallback, useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Text,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
  Pressable,
  DeviceEventEmitter,
} from 'react-native';
import { Tabs, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../src/database/supabase';
import { getPlatforms } from '../../../src/features/platforms/services/getPlatforms';
import { getUserPlatforms } from '../../../src/features/platforms/services/getUserPlatforms';
import { toggleUserPlatform } from '../../../src/features/platforms/services/toggleUserPlatform';

type StandaloneGainErrors = {
  platform?: string;
  description?: string;
  date?: string;
  amount?: string;
};

function formatDateInput(date: Date) {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function maskDateInput(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 8);

  if (numbers.length <= 2) return numbers;

  if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  }

  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4)}`;
}

function parseDateInput(value: string) {
  const [day, month, year] = value.split('/').map(Number);

  if (!day || !month || !year) return null;

  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  const valid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return valid ? date : null;
}

function maskCurrency(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 12);

  if (!numbers) return '';

  return (Number(numbers) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrency(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : 0;
}

function toLocalISOString(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, -1);
}

export default function TabsLayout() {
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);

  const [standaloneGainModalVisible, setStandaloneGainModalVisible] =
    useState(false);
  const [platformDrawerVisible, setPlatformDrawerVisible] = useState(false);
  const [
    returnToStandaloneGainAfterPlatforms,
    setReturnToStandaloneGainAfterPlatforms,
  ] = useState(false);

  const [platformsList, setPlatformsList] = useState<any[]>([]);
  const [userPlatforms, setUserPlatforms] = useState<any[]>([]);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);

  const [gainPlatform, setGainPlatform] = useState('');
  const [gainDescription, setGainDescription] = useState('');
  const [gainDate, setGainDate] = useState(formatDateInput(new Date()));
  const [gainAmount, setGainAmount] = useState('');
  const [gainErrors, setGainErrors] = useState<StandaloneGainErrors>({});
  const [savingGain, setSavingGain] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadActiveSession();
      loadPlatforms();
    }, []),
  );

  useEffect(() => {
    DeviceEventEmitter.emit(
      'movenapp:quick-actions-visible',
      quickActionsVisible,
    );

    return () => {
      DeviceEventEmitter.emit('movenapp:quick-actions-visible', false);
    };
  }, [quickActionsVisible]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function startRealtime() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      channel = supabase
        .channel(`tabs-active-session-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'work_sessions',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadActiveSession();
          },
        )
        .subscribe();
    }

    startRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  async function loadActiveSession() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from('work_sessions')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['active', 'paused'])
      .maybeSingle();

    setHasActiveSession(!!data);
  }

  async function loadPlatforms() {
    try {
      const [allPlatforms, selectedPlatforms] = await Promise.all([
        getPlatforms(),
        getUserPlatforms(),
      ]);

      setPlatformsList(allPlatforms ?? []);
      setUserPlatforms(selectedPlatforms ?? []);
      setSelectedPlatformIds(
        (selectedPlatforms ?? []).map((item: any) => item.platform_id),
      );
    } catch (error) {
      console.log('Erro ao carregar plataformas:', error);
    }
  }

  function renderTabIcon(
    iconName: keyof typeof Ionicons.glyphMap,
    focused: boolean,
    color: string,
  ) {
    return (
      <View style={[styles.iconBox, focused && styles.iconBoxActive]}>
        <Ionicons
          name={iconName}
          size={22}
          color={focused ? '#06130B' : color}
        />
      </View>
    );
  }

  function resetStandaloneGainForm() {
    setGainPlatform('');
    setGainDescription('');
    setGainDate(formatDateInput(new Date()));
    setGainAmount('');
    setGainErrors({});
  }

  async function openStandaloneGainModal() {
    setQuickActionsVisible(false);
    resetStandaloneGainForm();
    await loadPlatforms();
    setStandaloneGainModalVisible(true);
  }

  function openExpenseForm() {
    setQuickActionsVisible(false);

    router.push({
      pathname: '/(private)/(tabs)/despesas',
      params: {
        openExpense: '1',
        t: String(Date.now()),
      },
    } as never);
  }

  function openNewJourney() {
    setQuickActionsVisible(false);

    if (hasActiveSession) {
      Alert.alert(
        'Jornada em andamento',
        'Finalize ou exclua a jornada atual antes de iniciar uma nova.',
      );
      return;
    }

    router.push('/(private)/(tabs)/nova-jornada' as never);
  }

  function clearGainError(field: keyof StandaloneGainErrors) {
    setGainErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  }

  function validateStandaloneGainForm() {
    const errors: StandaloneGainErrors = {};
    const parsedDate = parseDateInput(gainDate);
    const amount = parseCurrency(gainAmount);

    if (!gainPlatform) {
      errors.platform = 'Selecione uma plataforma.';
    }

    if (!gainDescription.trim()) {
      errors.description = 'Informe uma descrição.';
    } else if (gainDescription.trim().length < 3) {
      errors.description = 'A descrição precisa ter pelo menos 3 caracteres.';
    }

    if (!parsedDate) {
      errors.date = 'Informe uma data válida.';
    } else {
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (parsedDate > today) {
        errors.date = 'A data do ganho não pode ser futura.';
      }
    }

    if (!gainAmount.trim()) {
      errors.amount = 'Informe o valor.';
    } else if (amount <= 0) {
      errors.amount = 'O valor precisa ser maior que zero.';
    }

    setGainErrors(errors);

    return Object.keys(errors).length === 0;
  }

  async function handleSaveStandaloneGain() {
    try {
      const valid = validateStandaloneGainForm();

      if (!valid) return;

      setSavingGain(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user?.id) {
        Alert.alert('Sessão expirada', 'Entre novamente para lançar o ganho.');
        return;
      }

      const parsedDate = parseDateInput(gainDate);

      if (!parsedDate) return;

      const { error } = await supabase.from('earnings').insert({
        user_id: user.id,
        session_id: null,
        platform: gainPlatform,
        description: gainDescription.trim(),
        amount: parseCurrency(gainAmount),
        earning_date: toLocalISOString(parsedDate),
      });

      if (error) throw error;

      DeviceEventEmitter.emit('movenapp:dashboard-refresh');

      setStandaloneGainModalVisible(false);
      resetStandaloneGainForm();

      Alert.alert(
        'Ganho lançado',
        'O ganho avulso foi registrado sem vínculo com uma jornada.',
      );
    } catch (error: any) {
      console.log('Erro ao salvar ganho avulso:', error);

      const message = String(error?.message ?? '').toLowerCase();

      Alert.alert(
        'Erro ao salvar ganho',
        message.includes('session_id')
          ? 'A coluna session_id precisa aceitar vazio para permitir ganho avulso.'
          : message.includes('user_id') ||
              message.includes('description') ||
              message.includes('earning_date')
            ? 'Rode o SQL de ganhos avulsos no Supabase para preparar a tabela earnings.'
            : 'Não foi possível salvar o ganho. Confira os dados e tente novamente.',
      );
    } finally {
      setSavingGain(false);
    }
  }

  function openPlatformDrawerFromStandaloneGain() {
    setReturnToStandaloneGainAfterPlatforms(true);
    setStandaloneGainModalVisible(false);

    setTimeout(() => {
      setPlatformDrawerVisible(true);
    }, 350);
  }

  function closePlatformDrawerAndReturn() {
    const shouldReturn = returnToStandaloneGainAfterPlatforms;

    setPlatformDrawerVisible(false);
    setReturnToStandaloneGainAfterPlatforms(false);

    setTimeout(() => {
      if (shouldReturn) {
        setStandaloneGainModalVisible(true);
      }
    }, 350);
  }

  function togglePlatformSelection(platformId: string) {
    setSelectedPlatformIds((current) => {
      if (current.includes(platformId)) {
        return current.filter((id) => id !== platformId);
      }

      return [...current, platformId];
    });
  }

  async function handleSaveUserPlatforms() {
    try {
      for (const platform of platformsList) {
        const selected = selectedPlatformIds.includes(platform.id);

        await toggleUserPlatform(platform.id, selected);
      }

      await loadPlatforms();
      closePlatformDrawerAndReturn();
    } catch (error) {
      console.log('Erro ao salvar plataformas:', error);
      Alert.alert('Erro', 'Não foi possível salvar suas plataformas.');
    }
  }

  const selectedPlatformData = userPlatforms.find(
    (item: any) => item.platform?.name === gainPlatform,
  )?.platform;

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,

          tabBarStyle: {
            position: 'absolute',
            left: 10,
            right: 10,
            bottom: 0,
            height: 74,
            backgroundColor: '#0B0B0F',
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: '#18181B',
            borderRadius: 0,
            paddingTop: 10,
            paddingBottom: 10,
            paddingHorizontal: 6,
            shadowColor: '#000000',
            shadowOffset: {
              width: 0,
              height: 12,
            },
            shadowOpacity: 0.35,
            shadowRadius: 20,
            elevation: 18,
          },

          tabBarItemStyle: {
            height: 54,
            alignItems: 'center',
            justifyContent: 'center',
          },

          tabBarActiveTintColor: '#22C55E',
          tabBarInactiveTintColor: '#71717A',
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, focused }) =>
              renderTabIcon('grid-outline', focused, color),
          }}
        />

        <Tabs.Screen
          name="despesas"
          options={{
            title: 'Despesas',
            tabBarIcon: ({ color, focused }) =>
              renderTabIcon('card-outline', focused, color),
          }}
        />

        <Tabs.Screen
          name="jornadas"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="veiculos"
          options={{
            title: 'Veículos',
            tabBarIcon: ({ color, focused }) =>
              renderTabIcon('car-sport-outline', focused, color),
          }}
        />

        <Tabs.Screen
          name="nova-jornada"
          options={{
            title: '',
            tabBarButton: () => (
              <TouchableOpacity
                activeOpacity={0.86}
                style={[
                  styles.centerButton,
                  quickActionsVisible && styles.centerButtonOpen,
                ]}
                onPress={() => setQuickActionsVisible((current) => !current)}
              >
                <Ionicons
                  name={quickActionsVisible ? 'close' : 'add'}
                  size={31}
                  color="#06130B"
                />
              </TouchableOpacity>
            ),
          }}
        />

        <Tabs.Screen
          name="recordes"
          options={{
            title: 'Meus recordes',
            tabBarIcon: ({ color, focused }) =>
              renderTabIcon('podium-outline', focused, color),
          }}
        />

        <Tabs.Screen
          name="conversas"
          options={{
            title: 'Conversas',
            tabBarIcon: ({ color, focused }) =>
              renderTabIcon('chatbubble-ellipses-outline', focused, color),
          }}
        />

        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, focused }) =>
              renderTabIcon('person-circle-outline', focused, color),
          }}
        />
      </Tabs>

      {quickActionsVisible ? (
        <>
          <Pressable
            style={styles.quickBackdrop}
            onPress={() => setQuickActionsVisible(false)}
          />

          <View style={styles.quickActionsWrapper} pointerEvents="box-none">
            <QuickActionButton
              icon="cash-outline"
              label="Ganho"
              style={styles.quickActionGain}
              iconBoxStyle={styles.quickActionIconGreen}
              onPress={openStandaloneGainModal}
            />

            <QuickActionButton
              icon="receipt-outline"
              label="Despesa"
              style={styles.quickActionExpense}
              iconBoxStyle={styles.quickActionIconRed}
              onPress={openExpenseForm}
            />

            {!hasActiveSession ? (
              <QuickActionButton
                icon="play-circle-outline"
                label="Jornada"
                style={styles.quickActionJourney}
                iconBoxStyle={styles.quickActionIconBlue}
                onPress={openNewJourney}
              />
            ) : null}
          </View>
        </>
      ) : null}

      <Modal visible={standaloneGainModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.gainModalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 18 }}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>Ganho avulso</Text>
                  <Text style={styles.modalTitle}>Novo ganho</Text>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setStandaloneGainModalVisible(false);
                    resetStandaloneGainForm();
                  }}
                >
                  <Ionicons name="close" size={27} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDescription}>
                Ideal para lançar promoção, bônus ou recompensa da plataforma sem vincular a uma jornada.
              </Text>

              <View style={styles.fieldHeader}>
                <Text style={styles.fieldLabel}>Plataforma</Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.managePlatformsButton}
                  onPress={openPlatformDrawerFromStandaloneGain}
                >
                  <Ionicons name="apps-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.managePlatformsButtonText}>Gerenciar</Text>
                </TouchableOpacity>
              </View>

              {gainErrors.platform ? (
                <Text style={styles.errorText}>{gainErrors.platform}</Text>
              ) : null}

              {userPlatforms.length === 0 ? (
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.emptyPlatformsBox}
                  onPress={openPlatformDrawerFromStandaloneGain}
                >
                  <Ionicons name="apps-outline" size={30} color="#71717A" />
                  <Text style={styles.emptyPlatformsTitle}>
                    Nenhuma plataforma selecionada
                  </Text>
                  <Text style={styles.emptyPlatformsText}>
                    Toque para escolher as plataformas que você usa.
                  </Text>
                </TouchableOpacity>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.platformsHorizontalList}
                >
                  {userPlatforms.map((item: any) => {
                    const platform = item.platform;

                    if (!platform) return null;

                    const selected = gainPlatform === platform.name;

                    return (
                      <TouchableOpacity
                        key={platform.id}
                        activeOpacity={0.86}
                        style={[
                          styles.platformChip,
                          selected && styles.platformChipActive,
                        ]}
                        onPress={() => {
                          setGainPlatform(platform.name);
                          clearGainError('platform');
                        }}
                      >
                        {platform.logo_url ? (
                          <Image
                            source={{ uri: platform.logo_url }}
                            style={styles.platformChipLogo}
                          />
                        ) : (
                          <View style={styles.platformChipLogoFallback}>
                            <Text style={styles.platformChipLogoText}>
                              {platform.name?.slice(0, 1) ?? '?'}
                            </Text>
                          </View>
                        )}

                        <Text
                          style={[
                            styles.platformChipText,
                            selected && styles.platformChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {platform.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {selectedPlatformData ? (
                <View style={styles.selectedPlatformPreview}>
                  {selectedPlatformData.logo_url ? (
                    <Image
                      source={{ uri: selectedPlatformData.logo_url }}
                      style={styles.selectedPlatformLogo}
                    />
                  ) : (
                    <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
                  )}

                  <Text style={styles.selectedPlatformPreviewText}>
                    Plataforma selecionada: {selectedPlatformData.name}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>Descrição</Text>
              <TextInput
                value={gainDescription}
                onChangeText={(text) => {
                  setGainDescription(text);
                  clearGainError('description');
                }}
                placeholder="Ex: Promoção, bônus, recompensa..."
                placeholderTextColor="#71717A"
                style={[
                  styles.input,
                  gainErrors.description && styles.inputError,
                ]}
              />
              {gainErrors.description ? (
                <Text style={styles.errorText}>{gainErrors.description}</Text>
              ) : null}

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Data</Text>
                  <TextInput
                    value={gainDate}
                    onChangeText={(text) => {
                      setGainDate(maskDateInput(text));
                      clearGainError('date');
                    }}
                    placeholder="dd/mm/aaaa"
                    placeholderTextColor="#71717A"
                    keyboardType="numeric"
                    maxLength={10}
                    style={[styles.input, gainErrors.date && styles.inputError]}
                  />
                  {gainErrors.date ? (
                    <Text style={styles.errorText}>{gainErrors.date}</Text>
                  ) : null}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Valor</Text>
                  <TextInput
                    value={gainAmount}
                    onChangeText={(text) => {
                      setGainAmount(maskCurrency(text));
                      clearGainError('amount');
                    }}
                    placeholder="0,00"
                    placeholderTextColor="#71717A"
                    keyboardType="numeric"
                    style={[styles.input, gainErrors.amount && styles.inputError]}
                  />
                  {gainErrors.amount ? (
                    <Text style={styles.errorText}>{gainErrors.amount}</Text>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  styles.saveGainButton,
                  savingGain && styles.saveGainButtonDisabled,
                ]}
                disabled={savingGain}
                onPress={handleSaveStandaloneGain}
              >
                {savingGain ? (
                  <ActivityIndicator color="#06130B" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={22}
                      color="#06130B"
                    />
                    <Text style={styles.saveGainButtonText}>Salvar ganho</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={platformDrawerVisible} transparent animationType="slide">
        <View style={styles.platformDrawerOverlay}>
          <View style={styles.platformDrawerContent}>
            <View style={styles.drawerHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Configuração</Text>
                <Text style={styles.modalTitle}>Minhas plataformas</Text>
              </View>

              <TouchableOpacity onPress={closePlatformDrawerAndReturn}>
                <Ionicons name="close" size={27} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Escolha quais plataformas devem aparecer nos formulários de ganhos e corridas.
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.platformDrawerList}
            >
              {platformsList.map((platform: any) => {
                const selected = selectedPlatformIds.includes(platform.id);

                return (
                  <TouchableOpacity
                    key={platform.id}
                    activeOpacity={0.86}
                    style={[
                      styles.platformDrawerItem,
                      selected && styles.platformDrawerItemActive,
                    ]}
                    onPress={() => togglePlatformSelection(platform.id)}
                  >
                    <View style={styles.platformDrawerLeft}>
                      {platform.logo_url ? (
                        <Image
                          source={{ uri: platform.logo_url }}
                          style={styles.platformDrawerLogo}
                        />
                      ) : (
                        <View style={styles.platformDrawerLogoFallback}>
                          <Text style={styles.platformDrawerLogoText}>
                            {platform.name?.slice(0, 1) ?? '?'}
                          </Text>
                        </View>
                      )}

                      <Text
                        style={[
                          styles.platformDrawerName,
                          selected && styles.platformDrawerNameActive,
                        ]}
                      >
                        {platform.name}
                      </Text>
                    </View>

                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={selected ? '#22C55E' : '#71717A'}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.savePlatformsButton}
              onPress={handleSaveUserPlatforms}
            >
              <Text style={styles.savePlatformsButtonText}>Salvar plataformas</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function QuickActionButton({
  icon,
  label,
  onPress,
  style,
  iconBoxStyle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  style: any;
  iconBoxStyle: any;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[styles.quickActionButton, style]}
      onPress={onPress}
    >
      <View style={[styles.quickActionIconBox, iconBoxStyle]}>
        <Ionicons name={icon} size={24} color="#FFFFFF" />
      </View>

      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  iconBox: {
    width: 39,
    height: 39,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconBoxActive: {
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },

  centerButton: {
    position: 'absolute',
    left: '50%',
    marginLeft: -33,
    top: -27,

    width: 66,
    height: 66,
    borderRadius: 999,

    backgroundColor: '#22C55E',
    borderWidth: 5,
    borderColor: '#09090B',

    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#22C55E',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.42,
    shadowRadius: 16,
    elevation: 14,
  },

  centerButtonOpen: {
    transform: [{ rotate: '45deg' }],
  },

  quickBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.80)',
  },

  quickActionsWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'ios' ? 60 : 60,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickActionButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickActionGain: {
    transform: [{ translateX: -118 }, { translateY: 18 }],
  },

  quickActionExpense: {
    transform: [{ translateX: 0 }, { translateY: -34 }],
  },

  quickActionJourney: {
    transform: [{ translateX: 118 }, { translateY: 18 }],
  },

  quickActionIconBox: {
    width: 58,
    height: 58,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 10,
  },

  quickActionIconGreen: {
    backgroundColor: '#16A34A',
  },

  quickActionIconRed: {
    backgroundColor: '#EF4444',
  },

  quickActionIconBlue: {
    backgroundColor: '#3B82F6',
  },

  quickActionLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 6,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#27272A',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 18,
    justifyContent: 'center',
  },

  gainModalContent: {
    backgroundColor: '#111827',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
    maxHeight: '92%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },

  modalEyebrow: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 2,
  },

  modalDescription: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginBottom: 18,
  },

  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  fieldLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
    marginLeft: 4,
  },

  managePlatformsButton: {
    height: 34,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  managePlatformsButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  emptyPlatformsBox: {
    minHeight: 140,
    borderRadius: 22,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginBottom: 14,
  },

  emptyPlatformsTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 10,
  },

  emptyPlatformsText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },

  platformsHorizontalList: {
    gap: 8,
    paddingBottom: 14,
  },

  platformChip: {
    width: 102,
    minHeight: 82,
    borderRadius: 20,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 9,
    gap: 7,
  },

  platformChipActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },

  platformChipLogo: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },

  platformChipLogoFallback: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  platformChipLogoText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  platformChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },

  platformChipTextActive: {
    color: '#06130B',
  },

  selectedPlatformPreview: {
    minHeight: 42,
    borderRadius: 15,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },

  selectedPlatformLogo: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },

  selectedPlatformPreviewText: {
    flex: 1,
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: '900',
  },

  input: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#FFFFFF',
    paddingHorizontal: 15,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 13,
  },

  inputError: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },

  errorText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
    marginTop: -3,
    marginBottom: 10,
    marginLeft: 4,
    lineHeight: 17,
  },

  formRow: {
    flexDirection: 'row',
    gap: 10,
  },

  saveGainButton: {
    height: 58,
    borderRadius: 19,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },

  saveGainButtonDisabled: {
    opacity: 0.65,
  },

  saveGainButtonText: {
    color: '#06130B',
    fontSize: 15,
    fontWeight: '900',
  },

  platformDrawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },

  platformDrawerContent: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
    maxHeight: '86%',
  },

  drawerHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 16,
  },

  platformDrawerList: {
    gap: 10,
    paddingBottom: 18,
  },

  platformDrawerItem: {
    minHeight: 62,
    borderRadius: 20,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    gap: 12,
  },

  platformDrawerItemActive: {
    borderColor: 'rgba(34,197,94,0.55)',
    backgroundColor: 'rgba(34,197,94,0.10)',
  },

  platformDrawerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
  },

  platformDrawerLogo: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },

  platformDrawerLogoFallback: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  platformDrawerLogoText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  platformDrawerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  platformDrawerNameActive: {
    color: '#86EFAC',
  },

  savePlatformsButton: {
    height: 56,
    borderRadius: 19,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  savePlatformsButtonText: {
    color: '#06130B',
    fontSize: 15,
    fontWeight: '900',
  },
});
