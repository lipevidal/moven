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
        <ActivityIndicator color="#22C55E" />
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
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.headerEyebrow}>Administração</Text>
            <Text style={styles.headerTitle}>Configurações</Text>
          </View>

          <View style={styles.headerConfigIcon}>
            <Ionicons name="settings-outline" size={22} color="#22C55E" />
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoIconBox}>
            <Ionicons name="shield-checkmark-outline" size={26} color="#22C55E" />
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
              placeholderTextColor="#71717A"
              keyboardType="numeric"
              style={styles.input}
            />
          </View>

          <Text style={styles.fieldLabel}>Tempo de carência</Text>
          <View style={styles.inputBox}>
            <Ionicons name="timer-outline" size={22} color="#22C55E" />
            <TextInput
              value={gracePeriodDays}
              onChangeText={(text) => setGracePeriodDays(text.replace(/\D/g, '').slice(0, 3))}
              placeholder="Ex: 7"
              placeholderTextColor="#71717A"
              keyboardType="numeric"
              style={styles.input}
            />
            <Text style={styles.inputSuffix}>dias</Text>
          </View>

          <Text style={styles.fieldLabel}>WhatsApp do suporte</Text>
          <View style={styles.inputBox}>
            <Ionicons name="logo-whatsapp" size={22} color="#22C55E" />
            <TextInput
              value={supportWhatsapp}
              onChangeText={setSupportWhatsapp}
              placeholder="Ex: 5531999999999"
              placeholderTextColor="#71717A"
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
              <ActivityIndicator color="#06130B" />
            ) : (
              <>
                <Ionicons name="save-outline" size={22} color="#06130B" />
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
  container: { flex: 1, backgroundColor: '#09090B' },
  content: { paddingHorizontal: 18, paddingTop: 54, paddingBottom: 140 },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#A1A1AA', fontSize: 13, fontWeight: '800' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerConfigIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#102A1A',
    borderWidth: 1,
    borderColor: '#14532D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerEyebrow: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 2 },
  infoCard: {
    backgroundColor: '#111827',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    flexDirection: 'row',
    gap: 13,
    marginBottom: 16,
  },
  infoIconBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  infoText: { color: '#A1A1AA', fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 5 },
  formCard: {
    backgroundColor: '#111827',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 18,
  },
  fieldLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputBox: {
    height: 58,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  currencyPrefix: { color: '#22C55E', fontSize: 17, fontWeight: '900' },
  input: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  inputSuffix: { color: '#A1A1AA', fontSize: 13, fontWeight: '800' },
  saveButton: {
    height: 56,
    borderRadius: 19,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    marginTop: 6,
  },
  saveButtonDisabled: { opacity: 0.65 },
  saveButtonText: { color: '#06130B', fontSize: 15, fontWeight: '900' },
});
