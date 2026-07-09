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

import { getCurrentUserIsAdmin } from '../../../src/features/admin/services/adminAccess';
import { getSystemSettings, saveSystemSettings } from '../../../src/features/admin/services/adminSettings';

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

export default function AdminSettingsScreen() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [gracePeriodDays, setGracePeriodDays] = useState('');
  const [supportWhatsapp, setSupportWhatsapp] = useState('');

  async function validateAccessAndLoad() {
    try {
      setCheckingAccess(true);

      const isAdmin = await getCurrentUserIsAdmin();

      if (!isAdmin) {
        Alert.alert('Acesso negado', 'Essa área é permitida somente para administradores.');
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

  async function loadSettings() {
    try {
      setLoading(true);

      const response = await getSystemSettings();

      setMonthlyPrice(maskCurrency(String(Number(response?.monthly_price ?? 0) * 100)));
      setGracePeriodDays(String(response?.grace_period_days ?? 0));
      setSupportWhatsapp(response?.support_whatsapp ?? '');
    } catch (error: any) {
      console.log('Erro ao carregar configurações:', error);
      Alert.alert('Erro', error?.message ?? 'Não foi possível carregar as configurações.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      const price = parseCurrency(monthlyPrice);
      const grace = Number(gracePeriodDays.replace(/\D/g, '')) || 0;
      const whatsapp = supportWhatsapp.trim();

      if (price <= 0) {
        Alert.alert('Valor inválido', 'Informe o valor da mensalidade.');
        return;
      }

      if (!whatsapp) {
        Alert.alert('WhatsApp obrigatório', 'Informe o WhatsApp do suporte.');
        return;
      }

      setSaving(true);

      await saveSystemSettings({
        monthly_price: price,
        grace_period_days: grace,
        support_whatsapp: whatsapp,
      });

      Alert.alert('Configurações salvas', 'Os dados do sistema foram atualizados.');
    } catch (error: any) {
      console.log('Erro ao salvar configurações:', error);
      Alert.alert('Erro', error?.message ?? 'Não foi possível salvar as configurações.');
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
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.headerIconButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#F5F0E6" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.headerEyebrow}>Administração</Text>
            <Text style={styles.headerTitle}>Configurações</Text>
          </View>

          <View style={styles.headerConfigIcon}>
            <Ionicons name="settings-outline" size={22} color="#D4A64A" />
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoIconBox}>
            <Ionicons name="shield-checkmark-outline" size={26} color="#D4A64A" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Dados gerais do sistema</Text>
            <Text style={styles.infoText}>
              Essas configurações serão usadas para assinatura, carência e atendimento dos usuários.
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
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

          <Text style={styles.fieldLabel}>Tempo de carência</Text>
          <View style={styles.inputBox}>
            <Ionicons name="timer-outline" size={22} color="#D4A64A" />
            <TextInput
              value={gracePeriodDays}
              onChangeText={(text) => setGracePeriodDays(text.replace(/\D/g, '').slice(0, 3))}
              placeholder="Ex: 7"
              placeholderTextColor="#8F8A91"
              keyboardType="numeric"
              style={styles.input}
            />
            <Text style={styles.inputSuffix}>dias</Text>
          </View>

          <Text style={styles.fieldLabel}>WhatsApp do suporte</Text>
          <View style={styles.inputBox}>
            <Ionicons name="logo-whatsapp" size={22} color="#D4A64A" />
            <TextInput
              value={supportWhatsapp}
              onChangeText={setSupportWhatsapp}
              placeholder="Ex: 5531999999999"
              placeholderTextColor="#8F8A91"
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>

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
                <Text style={styles.saveButtonText}>Salvar configurações</Text>
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
    paddingTop: 50,
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
    marginHorizontal: -18,
    marginTop: -50,
    marginBottom: 18,
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 18,
    backgroundColor: '#070707',
    borderBottomWidth: 1,
    borderBottomColor: '#211D16',
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
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  headerTitle: {
    color: '#F5F0E6',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: -0.4,
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

  fieldLabel: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.2,
  },

  inputBox: {
    height: 58,
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
  },

  inputSuffix: {
    color: '#9B969B',
    fontSize: 13,
    fontWeight: '800',
  },

  saveButton: {
    height: 58,
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
    shadowOpacity: 0.20,
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
