import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AjudaScreen() {
  return (
    <View style={styles.container}>
      <Header title="Central de ajuda" />

      <Option title="FAQ" icon="help-circle-outline" />
      <Option
        title="Falar com suporte"
        icon="logo-whatsapp"
        onPress={() => Linking.openURL('https://wa.me/5500000000000')}
      />
      <Option title="Reportar erro" icon="bug-outline" />
      <Option title="Sugestões" icon="bulb-outline" />
      <Option title="Política de privacidade" icon="document-text-outline" />
      <Option title="Termos de uso" icon="reader-outline" />
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

function Option({ title, icon, onPress }: { title: string; icon: any; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.option} onPress={onPress}>
      <View style={styles.optionLeft}>
        <Ionicons name={icon} size={20} color="#A1A1AA" />
        <Text style={styles.optionText}>{title}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#71717A" />
    </TouchableOpacity>
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
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});