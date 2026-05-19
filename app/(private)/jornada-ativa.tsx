import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

export default function ActiveSessionScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Jornada ativa
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  text: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
});