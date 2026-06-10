import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getProfile } from '../../../src/features/profile/services/getProfile';
import { updateProfile } from '../../../src/features/profile/services/updateProfile';

export default function NotificacoesScreen() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setProfile(await getProfile());
  }

  async function toggle(key: string, value: boolean) {
    setProfile((prev: any) => ({ ...prev, [key]: value }));
    await updateProfile({ [key]: value } as any);
  }

  if (!profile) return null;

  return (
    <View style={styles.container}>
      <Header title="Notificações" />

      <Option label="Metas" value={profile.notification_goals} onChange={(v: boolean) => toggle('notification_goals', v)} />
      <Option label="Revisões" value={profile.notification_revision} onChange={(v: boolean) => toggle('notification_revision', v)} />
      <Option label="IPVA" value={profile.notification_ipva} onChange={(v: boolean) => toggle('notification_ipva', v)} />
      <Option label="Comunidade" value={profile.notification_community} onChange={(v: boolean) => toggle('notification_community', v)} />
      <Option label="Novidades" value={profile.notification_news} onChange={(v: boolean) => toggle('notification_news', v)} />
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

function Option({ label, value, onChange }: any) {
  return (
    <View style={styles.option}>
      <Text style={styles.optionText}>{label}</Text>
      <Switch value={!!value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B', padding: 18, paddingTop: 54 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
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
  optionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});