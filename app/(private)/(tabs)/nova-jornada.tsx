import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';

import { useEffect, useState } from 'react';

import { router } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../src/constants/colors';

import { getVehicles } from '../../../src/features/vehicles/services/getVehicles';

import { createWorkSession } from '../../../src/features/workSessions/services/createWorkSession';

export default function NewSessionScreen() {
  const [vehicles, setVehicles] =
    useState<any[]>([]);

  const [selectedVehicle, setSelectedVehicle] =
    useState<any>(null);

  const [startKm, setStartKm] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    loadVehicles();
  }, []);

  async function loadVehicles() {
    try {
      const response =
        await getVehicles();

      setVehicles(response);

      if (response.length > 0) {
        setSelectedVehicle(
          response[0],
        );

        setStartKm(
          String(
            response[0]
              .current_km ?? 0,
          ),
        );
      }
    } catch (error) {
      console.log(error);
    }
  }

  async function handleStartSession() {
    try {
      if (!selectedVehicle) {
        Alert.alert(
          'Atenção',
          'Selecione um veículo.',
        );

        return;
      }

      setLoading(true);

      const session =
        await createWorkSession({
          vehicle_id:
            selectedVehicle.id,

          start_km:
            Number(startKm),
        });

      router.replace({
        pathname:
          '/(private)/jornada-ativa',

        params: {
          id: session.id,
        },
      });
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message ??
          'Não foi possível iniciar a jornada.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>
        Nova jornada
      </Text>

      <Text style={styles.subtitle}>
        Inicie uma nova jornada de trabalho.
      </Text>

      <Text style={styles.sectionTitle}>
        Veículo
      </Text>

      <View style={styles.vehiclesList}>
        {vehicles.map((vehicle) => (
          <TouchableOpacity
            key={vehicle.id}
            style={[
              styles.vehicleCard,

              selectedVehicle?.id ===
                vehicle.id && {
                borderColor:
                  '#22C55E',
              },
            ]}
            onPress={() => {
              setSelectedVehicle(
                vehicle,
              );

              setStartKm(
                String(
                  vehicle.current_km,
                ),
              );
            }}
          >
            <View
              style={
                styles.vehicleIcon
              }
            >
              <Ionicons
                name="car-outline"
                size={24}
                color="#22C55E"
              />
            </View>

            <View>
              <Text
                style={
                  styles.vehicleTitle
                }
              >
                {vehicle.brand}{' '}
                {vehicle.model}
              </Text>

              <Text
                style={
                  styles.vehiclePlate
                }
              >
                {vehicle.plate}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>
        KM inicial
      </Text>

      <TextInput
        value={startKm}
        onChangeText={setStartKm}
        keyboardType="numeric"
        placeholder="KM inicial"
        placeholderTextColor="#71717A"
        style={styles.input}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={
          handleStartSession
        }
        disabled={loading}
      >
        <Text
          style={styles.buttonText}
        >
          {loading
            ? 'Iniciando...'
            : 'Iniciar jornada'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      colors.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 120,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },

  subtitle: {
    color: '#71717A',
    marginTop: 6,
    marginBottom: 30,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },

  vehiclesList: {
    marginBottom: 24,
  },

  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:
      '#18181B',
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#18181B',
  },

  vehicleIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor:
      '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  vehicleTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  vehiclePlate: {
    color: '#71717A',
    marginTop: 4,
  },

  input: {
    height: 58,
    borderRadius: 18,
    backgroundColor:
      '#18181B',
    paddingHorizontal: 18,
    color: '#FFFFFF',
    marginBottom: 28,
  },

  button: {
    height: 58,
    borderRadius: 18,
    backgroundColor:
      '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});