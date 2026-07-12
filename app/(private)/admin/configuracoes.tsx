import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../src/database/supabase';
import { getCurrentUserIsAdmin } from '../../../src/features/admin/services/adminAccess';

type SubscriptionSettings = {
  monthly_price: number;
  grace_period_days: number;
  payment_due_days: number;
  warning_days_before_due: number;
  inactive_delete_warning_after_days: number;
  inactive_delete_after_days: number;
  new_users_start_with_free_plan: boolean;
};

function maskCurrency(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 12);

  if (!numbers) return '';

  return (Number(numbers) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrency(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.')) || 0;
}

function maskInteger(value: string, maxLength = 3) {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

function formatCurrencyToInput(value?: number | null) {
  return maskCurrency(String(Math.round(Number(value ?? 0) * 100)));
}

export default function AdminSettingsScreen() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [gracePeriodDays, setGracePeriodDays] = useState('');
  const [paymentDueDays, setPaymentDueDays] = useState('');
  const [warningDaysBeforeDue, setWarningDaysBeforeDue] = useState('');
  const [inactiveDeleteWarningAfterDays, setInactiveDeleteWarningAfterDays] =
    useState('');
  const [inactiveDeleteAfterDays, setInactiveDeleteAfterDays] = useState('');
  const [newUsersStartWithFreePlan, setNewUsersStartWithFreePlan] =
    useState(false);

  async function validateAccessAndLoad() {
    try {
      setCheckingAccess(true);

      const isAdmin = await getCurrentUserIsAdmin();

      if (!isAdmin) {
        Alert.alert(
          'Acesso negado',
          'Essa área é permitida somente para administradores.',
        );
        router.replace('/(private)/(tabs)/dashboard' as never);
        return;
      }

      await loadSettings();
    } catch (error) {
      console.log('Erro ao validar admin:', error);
      router.replace('/(private)/(tabs)/dashboard' as never);
    } finally {
      setCheckingAccess(false);
    }
  }

  function fillForm(settings: SubscriptionSettings) {
    setMonthlyPrice(formatCurrencyToInput(settings.monthly_price));
    setGracePeriodDays(String(settings.grace_period_days ?? 0));
    setPaymentDueDays(String(settings.payment_due_days ?? 1));
    setWarningDaysBeforeDue(String(settings.warning_days_before_due ?? 5));
    setInactiveDeleteWarningAfterDays(
      String(settings.inactive_delete_warning_after_days ?? 50),
    );
    setInactiveDeleteAfterDays(String(settings.inactive_delete_after_days ?? 80));
    setNewUsersStartWithFreePlan(
      Boolean(settings.new_users_start_with_free_plan),
    );
  }


  async function loadNewUserRuleFromSettingsTable() {
    const { data, error } = await (supabase as any)
      .from('admin_subscription_settings')
      .select('new_users_start_with_free_plan')
      .eq('id', 'default')
      .maybeSingle();

    if (error) {
      console.log('Não foi possível carregar regra de novos usuários:', error);
      return null;
    }

    return Boolean(data?.new_users_start_with_free_plan);
  }

  async function persistNewUserRuleInSettingsTable(value: boolean) {
    const { error } = await (supabase as any)
      .from('admin_subscription_settings')
      .upsert(
        {
          id: 'default',
          new_users_start_with_free_plan: value,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
        },
      );

    if (error) {
      console.log('Não foi possível salvar regra de novos usuários:', error);
      throw error;
    }
  }

  async function loadSettings() {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc(
        'admin_get_subscription_settings',
      );

      if (error) throw error;

      const settings = (Array.isArray(data) ? data[0] : data) as
        | SubscriptionSettings
        | null;

      if (!settings) {
        throw new Error('Não foi possível carregar as configurações.');
      }

      const persistedNewUserRule =
        await loadNewUserRuleFromSettingsTable();

      fillForm({
        ...settings,
        new_users_start_with_free_plan:
          persistedNewUserRule ?? settings.new_users_start_with_free_plan,
      });
    } catch (error: any) {
      console.log('Erro ao carregar configurações de assinatura:', error);

      Alert.alert(
        'Erro',
        String(error?.message ?? '').includes('admin_get_subscription_settings')
          ? 'Rode primeiro o SQL corrigido das configurações de assinatura.'
          : error?.message ?? 'Não foi possível carregar as configurações.',
      );
    } finally {
      setLoading(false);
    }
  }

  function validateSettings(payload: SubscriptionSettings) {
    if (payload.monthly_price <= 0) {
      Alert.alert('Valor inválido', 'Informe o valor da mensalidade.');
      return false;
    }

    if (payload.grace_period_days < 0) {
      Alert.alert('Carência inválida', 'A carência não pode ser negativa.');
      return false;
    }

    if (payload.warning_days_before_due < 0) {
      Alert.alert(
        'Alerta inválido',
        'O alerta antes do vencimento não pode ser negativo.',
      );
      return false;
    }

    if (payload.inactive_delete_warning_after_days < 0) {
      Alert.alert(
        'Aviso de exclusão inválido',
        'O prazo para aviso de exclusão não pode ser negativo.',
      );
      return false;
    }

    if (payload.inactive_delete_after_days <= 0) {
      Alert.alert(
        'Exclusão inválida',
        'O prazo total para exclusão precisa ser maior que zero.',
      );
      return false;
    }

    if (
      payload.inactive_delete_after_days <=
      payload.inactive_delete_warning_after_days
    ) {
      Alert.alert(
        'Prazos inválidos',
        'O prazo total para exclusão precisa ser maior que o prazo do primeiro aviso.',
      );
      return false;
    }

    return true;
  }

  async function handleSave() {
    try {
      const payload: SubscriptionSettings = {
        monthly_price: parseCurrency(monthlyPrice),
        grace_period_days: Number(maskInteger(gracePeriodDays)) || 0,
        payment_due_days: Number(maskInteger(paymentDueDays)) || 0,
        warning_days_before_due: Number(maskInteger(warningDaysBeforeDue)) || 0,
        inactive_delete_warning_after_days:
          Number(maskInteger(inactiveDeleteWarningAfterDays)) || 0,
        inactive_delete_after_days:
          Number(maskInteger(inactiveDeleteAfterDays)) || 0,
        new_users_start_with_free_plan: newUsersStartWithFreePlan,
      };

      if (!validateSettings(payload)) return;

      setSaving(true);

      await persistNewUserRuleInSettingsTable(
        payload.new_users_start_with_free_plan,
      );

      const { data, error } = await supabase.rpc(
        'admin_update_subscription_settings',
        {
          p_monthly_price: payload.monthly_price,
          p_grace_period_days: payload.grace_period_days,
          p_payment_due_days: payload.payment_due_days,
          p_warning_days_before_due: payload.warning_days_before_due,
          p_inactive_delete_warning_after_days:
            payload.inactive_delete_warning_after_days,
          p_inactive_delete_after_days: payload.inactive_delete_after_days,
          p_new_users_start_with_free_plan:
            payload.new_users_start_with_free_plan,
        },
      );

      if (error) throw error;

      const updatedSettings = (Array.isArray(data) ? data[0] : data) as
        | SubscriptionSettings
        | null;

      if (updatedSettings) {
        fillForm({
          ...updatedSettings,
          new_users_start_with_free_plan:
            payload.new_users_start_with_free_plan,
        });
      } else {
        setNewUsersStartWithFreePlan(payload.new_users_start_with_free_plan);
      }

      Alert.alert(
        'Configurações salvas',
        'Os valores de assinatura e regras para novos usuários foram atualizados.',
      );
    } catch (error: any) {
      console.log('Erro ao salvar configurações de assinatura:', error);

      Alert.alert(
        'Erro',
        String(error?.message ?? '').includes('admin_update_subscription_settings')
          ? 'Rode primeiro o SQL corrigido das configurações de assinatura.'
          : error?.message ?? 'Não foi possível salvar as configurações.',
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    validateAccessAndLoad();
  }, []);

  if (checkingAccess || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#D4A64A" />
        <Text style={styles.loadingText}>Carregando configurações...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.headerIconButton}
          onPress={() => router.replace('/(private)/admin')}
        >
          <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.headerEyebrow}>Administração</Text>
          <Text style={styles.headerTitle}>Assinaturas</Text>
        </View>

        <View style={styles.headerConfigIcon}>
          <Ionicons name="card-outline" size={22} color="#D4A64A" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.infoCard}>
          <View style={styles.infoIconBox}>
            <Ionicons name="shield-checkmark-outline" size={26} color="#D4A64A" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Configurações de assinatura</Text>
            <Text style={styles.infoText}>
              Defina o valor da mensalidade, a carência, as regras para novos
              usuários e os prazos de alerta e exclusão por inatividade.
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Mensalidade</Text>
            <Text style={styles.summaryValue}>R$ {monthlyPrice || '0,00'}</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Carência</Text>
            <Text style={styles.summaryValue}>{gracePeriodDays || '0'} dias</Text>
          </View>
        </View>

        <View style={styles.rulePreviewCard}>
          <View style={styles.rulePreviewIcon}>
            <Ionicons
              name={newUsersStartWithFreePlan ? 'gift-outline' : 'card-outline'}
              size={22}
              color="#D4A64A"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.rulePreviewTitle}>Regra para novos usuários</Text>
            <Text style={styles.rulePreviewText}>
              {newUsersStartWithFreePlan
                ? 'Novos usuários iniciarão com plano gratuito ativo.'
                : 'Novos usuários seguirão o fluxo padrão de carência e cobrança.'}
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Cobrança mensal</Text>

          <Text style={styles.fieldLabel}>Valor da mensalidade</Text>
          <View style={styles.inputBox}>
            <Text style={styles.currencyPrefix}>R$</Text>
            <TextInput
              value={monthlyPrice}
              onChangeText={(text) => setMonthlyPrice(maskCurrency(text))}
              placeholder="0,00"
              placeholderTextColor="#8F8A91"
              keyboardType="numeric"
              style={styles.input}
            />
          </View>

          <View style={styles.formDivider} />

          <Text style={styles.sectionTitle}>Regras para novos usuários</Text>

          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.checkboxCard,
              newUsersStartWithFreePlan && styles.checkboxCardActive,
            ]}
            onPress={() =>
              setNewUsersStartWithFreePlan((currentValue) => !currentValue)
            }
          >
            <View
              style={[
                styles.checkboxBox,
                newUsersStartWithFreePlan && styles.checkboxBoxActive,
              ]}
            >
              {newUsersStartWithFreePlan ? (
                <Ionicons name="checkmark" size={18} color="#080808" />
              ) : null}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.checkboxTitle}>Iniciar com plano mensal</Text>
              <Text style={styles.checkboxText}>
                Quando marcado, todo novo usuário cadastrado receberá um plano
                gratuito automaticamente.
              </Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.helpText}>
            Por padrão essa opção fica desmarcada. Assim, novos usuários seguem
            apenas o período de carência configurado.
          </Text>

          <View style={styles.formDivider} />

          <Text style={styles.sectionTitle}>Carência e alertas</Text>

          <Text style={styles.fieldLabel}>Tempo de carência para novo usuário</Text>
          <View style={styles.inputBox}>
            <Ionicons name="timer-outline" size={22} color="#D4A64A" />
            <TextInput
              value={gracePeriodDays}
              onChangeText={(text) => setGracePeriodDays(maskInteger(text))}
              placeholder="Ex: 7"
              placeholderTextColor="#8F8A91"
              keyboardType="numeric"
              style={styles.input}
            />
            <Text style={styles.inputSuffix}>dias</Text>
          </View>

          <Text style={styles.fieldLabel}>Mostrar alerta antes do vencimento</Text>
          <View style={styles.inputBox}>
            <Ionicons name="notifications-outline" size={22} color="#D4A64A" />
            <TextInput
              value={warningDaysBeforeDue}
              onChangeText={(text) => setWarningDaysBeforeDue(maskInteger(text))}
              placeholder="Ex: 5"
              placeholderTextColor="#8F8A91"
              keyboardType="numeric"
              style={styles.input}
            />
            <Text style={styles.inputSuffix}>dias antes</Text>
          </View>

          <View style={styles.formDivider} />

          <Text style={styles.sectionTitle}>Inatividade e exclusão</Text>

          <Text style={styles.fieldLabel}>Avisar risco de exclusão após</Text>
          <View style={styles.inputBox}>
            <Ionicons name="warning-outline" size={22} color="#D4A64A" />
            <TextInput
              value={inactiveDeleteWarningAfterDays}
              onChangeText={(text) =>
                setInactiveDeleteWarningAfterDays(maskInteger(text))
              }
              placeholder="Ex: 50"
              placeholderTextColor="#8F8A91"
              keyboardType="numeric"
              style={styles.input}
            />
            <Text style={styles.inputSuffix}>dias inativo</Text>
          </View>

          <Text style={styles.fieldLabel}>Excluir conta após</Text>
          <View style={styles.inputBox}>
            <Ionicons name="trash-outline" size={22} color="#D4A64A" />
            <TextInput
              value={inactiveDeleteAfterDays}
              onChangeText={(text) =>
                setInactiveDeleteAfterDays(maskInteger(text))
              }
              placeholder="Ex: 80"
              placeholderTextColor="#8F8A91"
              keyboardType="numeric"
              style={styles.input}
            />
            <Text style={styles.inputSuffix}>dias inativo</Text>
          </View>

          <Text style={styles.helpText}>
            Exemplo: aviso com 50 dias e exclusão com 80 dias significa que o
            usuário recebe o alerta faltando 30 dias para a exclusão.
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            disabled={saving}
            onPress={handleSave}
          >
            {saving ? (
              <ActivityIndicator color="#080808" />
            ) : (
              <>
                <Ionicons name="save-outline" size={22} color="#080808" />
                <Text style={styles.saveButtonText}>Salvar assinatura</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 150,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  loadingText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '800',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 18,
    backgroundColor: '#070707',
    borderBottomWidth: 1,
    borderBottomColor: '#211D16',
    zIndex: 50,
    elevation: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },

  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerConfigIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerInfo: {
    flex: 1,
    minWidth: 0,
  },

  headerEyebrow: {
    color: '#D4A64A',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.7,
  },

  headerTitle: {
    color: '#F5F0E6',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.1,
  },

  infoCard: {
    backgroundColor: '#101014',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 16,
    flexDirection: 'row',
    gap: 13,
    marginBottom: 16,
    shadowColor: '#D4A64A',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 8,
  },

  infoIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoTitle: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
  },

  infoText: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 5,
  },

  summaryCard: {
    backgroundColor: '#101014',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  summaryItem: {
    flex: 1,
  },

  summaryLabel: {
    color: '#9B969B',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  summaryValue: {
    color: '#F5F0E6',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 5,
  },

  summaryDivider: {
    width: 1,
    height: 42,
    backgroundColor: '#2A2830',
    marginHorizontal: 14,
  },

  rulePreviewCard: {
    backgroundColor: '#101014',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 16,
  },

  rulePreviewIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(212,166,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,166,74,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rulePreviewTitle: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  rulePreviewText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },

  checkboxCard: {
    minHeight: 86,
    borderRadius: 16,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },

  checkboxCardActive: {
    backgroundColor: 'rgba(212,166,74,0.10)',
    borderColor: 'rgba(212,166,74,0.42)',
  },

  checkboxBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#4A4650',
    backgroundColor: '#101014',
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxBoxActive: {
    backgroundColor: '#D4A64A',
    borderColor: '#D4A64A',
  },

  checkboxTitle: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '900',
  },

  checkboxText: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },

  formCard: {
    backgroundColor: '#101014',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2830',
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },

  sectionTitle: {
    color: '#D4A64A',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 14,
  },

  fieldLabel: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.2,
  },

  inputBox: {
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: '#18171D',
    borderWidth: 1,
    borderColor: '#2A2830',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },

  currencyPrefix: {
    color: '#D4A64A',
    fontSize: 17,
    fontWeight: '900',
  },

  input: {
    flex: 1,
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '800',
    minHeight: 48,
  },

  inputSuffix: {
    color: '#9B969B',
    fontSize: 12,
    fontWeight: '800',
  },

  helpText: {
    color: '#8F8A91',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: -6,
    marginBottom: 16,
    marginLeft: 4,
  },

  formDivider: {
    height: 1,
    backgroundColor: '#2A2830',
    marginVertical: 16,
  },

  saveButton: {
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: '#D4A64A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    marginTop: 8,
    shadowColor: '#D4A64A',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },

  saveButtonDisabled: {
    opacity: 0.65,
  },

  saveButtonText: {
    color: '#080808',
    fontSize: 15,
    fontWeight: '900',
  },
});
