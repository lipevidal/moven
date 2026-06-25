import { useState } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { uploadChallengeProof } from '../../../src/features/challenges/services/uploadChallengeProof';

type SelectedImage = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

export default function SendChallengeProofsScreen() {
  const { challengeId } = useLocalSearchParams<{
    challengeId: string;
  }>();

  const [images, setImages] =
    useState<SelectedImage[]>([]);

  const [amount, setAmount] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  function formatCurrencyInput(value: string) {
    const numbers = value.replace(/\D/g, '');

    if (!numbers) return '';

    const cents = Number(numbers) / 100;

    return cents.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function parseCurrency(value: string) {
    if (!value) return 0;

    return Number(
      value
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^\d.]/g, ''),
    );
  }

  async function handlePickImages() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permissão necessária',
        'Permita o acesso às imagens para enviar os comprovantes.',
      );

      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.85,
        selectionLimit: 8,
      });

    if (result.canceled) {
      return;
    }

    const selected = result.assets.map((asset) => ({
      uri: asset.uri,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
    }));

    setImages((current) => [
      ...current,
      ...selected,
    ]);
  }

  function handleRemoveImage(index: number) {
    setImages((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  async function handleSubmit() {
    if (!challengeId) {
      Alert.alert(
        'Erro',
        'Desafio não encontrado.',
      );

      return;
    }

    const declaredAmount = parseCurrency(amount);

    if (declaredAmount <= 0) {
      Alert.alert(
        'Informe o faturamento',
        'Digite o valor total faturado no desafio.',
      );

      return;
    }

    if (!images.length) {
      Alert.alert(
        'Envie os comprovantes',
        'Selecione pelo menos uma imagem de comprovante.',
      );

      return;
    }

    try {
      setLoading(true);

      for (const image of images) {
        await uploadChallengeProof({
          challengeId,
          image,
          declaredAmount,
        });
      }

      Alert.alert(
        'Comprovantes enviados',
        'Seus comprovantes foram enviados e agora aguardam análise.',
        [
          {
            text: 'OK',
            onPress: () =>
              router.replace({
                pathname: '/(private)/desafios/[id]',
                params: {
                  id: challengeId,
                },
              }),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message ??
          'Não foi possível enviar os comprovantes.',
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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <View>
          <Text style={styles.title}>
            Enviar comprovantes
          </Text>

          <Text style={styles.subtitle}>
            Envie prints das plataformas usadas no desafio.
          </Text>
        </View>
      </View>

      <View style={styles.amountCard}>
        <Text style={styles.label}>
          Faturamento total do desafio
        </Text>

        <View style={styles.inputBox}>
          <Text style={styles.currencyPrefix}>
            R$
          </Text>

          <TextInput
            value={amount}
            onChangeText={(text) =>
              setAmount(formatCurrencyInput(text))
            }
            placeholder="0,00"
            placeholderTextColor="#71717A"
            keyboardType="numeric"
            style={styles.input}
          />
        </View>

        <Text style={styles.helperText}>
          Informe o valor total somado dos prints que serão enviados.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.uploadCard}
        onPress={handlePickImages}
        activeOpacity={0.85}
      >
        <View style={styles.uploadIconBox}>
          <Ionicons
            name="images-outline"
            size={30}
            color="#22C55E"
          />
        </View>

        <Text style={styles.uploadTitle}>
          Selecionar imagens
        </Text>

        <Text style={styles.uploadText}>
          Você pode selecionar até 8 prints de comprovantes.
        </Text>
      </TouchableOpacity>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Imagens selecionadas
        </Text>

        <Text style={styles.sectionCount}>
          {images.length}
        </Text>
      </View>

      {images.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons
            name="cloud-upload-outline"
            size={42}
            color="#71717A"
          />

          <Text style={styles.emptyTitle}>
            Nenhuma imagem selecionada
          </Text>

          <Text style={styles.emptyText}>
            Selecione os prints de faturamento para continuar.
          </Text>
        </View>
      ) : (
        <View style={styles.imagesGrid}>
          {images.map((image, index) => (
            <View key={`${image.uri}-${index}`} style={styles.imageCard}>
              <Image
                source={{ uri: image.uri }}
                style={styles.previewImage}
              />

              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveImage(index)}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.submitButton,
          loading && styles.submitButtonDisabled,
        ]}
        disabled={loading}
        onPress={handleSubmit}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons
              name="send-outline"
              size={20}
              color="#FFFFFF"
            />

            <Text style={styles.submitButtonText}>
              Enviar para análise
            </Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },

  content: {
    padding: 18,
    paddingTop: 54,
    paddingBottom: 130,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 22,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
  },

  subtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
    maxWidth: 280,
  },

  amountCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    marginBottom: 14,
  },

  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },

  inputBox: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  currencyPrefix: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '900',
    marginRight: 8,
  },

  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  helperText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 10,
  },

  uploadCard: {
    minHeight: 160,
    borderRadius: 24,
    backgroundColor: '#052E16',
    borderWidth: 1,
    borderColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    marginBottom: 18,
  },

  uploadIconBox: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#064E3B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  uploadTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  uploadText: {
    color: '#BBF7D0',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  sectionCount: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '900',
  },

  emptyBox: {
    minHeight: 180,
    borderRadius: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    marginBottom: 18,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 10,
  },

  emptyText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  imageCard: {
    width: '48%',
    height: 170,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 12,
  },

  previewImage: {
    width: '100%',
    height: '100%',
  },

  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  submitButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  submitButtonDisabled: {
    opacity: 0.6,
  },

  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
