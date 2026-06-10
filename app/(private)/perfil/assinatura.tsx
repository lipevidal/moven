import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getProfile } from '../../../src/features/profile/services/getProfile';

export default function AssinaturaScreen() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function load() {
      setProfile(await getProfile());
    }

    load();
  }, []);

  if (!profile) return null;

  return (
    <View style={styles.container}>
      <Header title="Assinatura" />

      <View style={styles.card}>
        <Text style={styles.label}>Plano atual</Text>
        <Text style={styles.value}>{profile.premium ? 'Premium' : 'Free'}</Text>

        <Text style={styles.label}>Status</Text>
        <Text style={styles.status}>{profile.premium ? 'Ativo' : 'Gratuito'}</Text>
      </View>

      <Button title="Alterar plano" icon="diamond-outline" />
      <Button title="Histórico de pagamentos" icon="receipt-outline" />
      <Button
        title="Cancelar assinatura"
        icon="close-circle-outline"
        danger
        onPress={() => Alert.alert('Cancelar assinatura', 'Função em desenvolvimento.')}
      />
    </View>
  );
}

function Header({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function Button({
  title,
  icon,
  danger,
  onPress,
}: {
  title: string;
  icon: any;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.option} onPress={onPress}>
      <View style={styles.optionLeft}>
        <Ionicons name={icon} size={20} color={danger ? '#EF4444' : '#A1A1AA'} />
        <Text style={[styles.optionText, danger && { color: '#EF4444' }]}>
          {title}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#71717A" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B', padding: 18, paddingTop: 54 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  card: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  label: { color: '#A1A1AA', fontSize: 13, fontWeight: '800', marginTop: 8 },
  value: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginTop: 4 },
  status: { color: '#22C55E', fontSize: 18, fontWeight: '900', marginTop: 4 },
  option: {
    minHeight: 58,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});