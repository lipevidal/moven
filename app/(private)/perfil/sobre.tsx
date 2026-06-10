import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SobreScreen() {
  return (
    <View style={styles.container}>
      <Header title="Sobre o Moven" />

      <View style={styles.logoBox}>
        <Ionicons name="navigate-circle" size={62} color="#22C55E" />
        <Text style={styles.appName}>Moven</Text>
        <Text style={styles.version}>Versão 1.0.0</Text>
        <Text style={styles.description}>
          Controle financeiro para motoristas e entregadores.
        </Text>
      </View>

      <Option title="Instagram" icon="logo-instagram" />
      <Option title="Site oficial" icon="globe-outline" />
      <Option title="Avaliar aplicativo" icon="star-outline" />
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

function Option({ title, icon }: { title: string; icon: any }) {
  return (
    <TouchableOpacity style={styles.option}>
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
  logoBox: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 18,
  },
  appName: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 10 },
  version: { color: '#A1A1AA', fontSize: 13, fontWeight: '700', marginTop: 4 },
  description: { color: '#A1A1AA', fontSize: 14, textAlign: 'center', marginTop: 14 },
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