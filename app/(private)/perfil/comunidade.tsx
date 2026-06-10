import { View, Text, StyleSheet } from 'react-native';

export default function ComunidadeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Comunidade</Text>
      <Text style={styles.subtitle}>
        Em breve: motoristas da sua cidade, chat e ranking.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
    padding: 18,
    paddingTop: 54,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: '#A1A1AA',
    fontSize: 15,
    marginTop: 10,
  },
});