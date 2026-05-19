import { View, Text } from 'react-native';

export default function DashboardScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#09090B',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF' }}>
        Dashboard
      </Text>
    </View>
  );
}