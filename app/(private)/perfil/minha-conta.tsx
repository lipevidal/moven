import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../src/database/supabase';
import { getProfile } from '../../../src/features/profile/services/getProfile';
import { updateProfile } from '../../../src/features/profile/services/updateProfile';

function formatPhone(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 11);

  if (numbers.length <= 2) {
    return numbers;
  }

  if (numbers.length <= 6) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  }

  if (numbers.length <= 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }

  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
}

export default function MinhaContaScreen() {
  const [profile, setProfile] = useState<any>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const response = await getProfile();

    setProfile(response);
    setFullName(response?.full_name ?? '');
    setEmail(response?.email ?? '');
    setPhone(formatPhone(response?.phone ?? ''));
    setAvatarUrl(response?.avatar_url ?? null);
  }

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
        Alert.alert('Permissão necessária', 'Permita o acesso à galeria.');
        return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
    });

    if (result.canceled) return;

    const asset = result.assets[0];

    const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';

    const fileName = `${profile.id}-${Date.now()}.${fileExt}`;

    const response = await fetch(asset.uri);
    const arrayBuffer = await response.arrayBuffer();

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
        contentType: asset.mimeType || `image/${fileExt}`,
        upsert: true,
        });

    if (uploadError) {
        console.log(uploadError);
        Alert.alert('Erro', uploadError.message);
        return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);

    const newAvatarUrl = `${data.publicUrl}?t=${Date.now()}`;

    setAvatarUrl(newAvatarUrl);

    await updateProfile({
        avatar_url: newAvatarUrl,
    });

    await supabase.auth.updateUser({
        data: {
        avatar_url: newAvatarUrl,
        },
    });

    Alert.alert('Sucesso', 'Foto atualizada.');
  }

  function handleRemoveAvatar() {
    Alert.alert(
        'Remover foto',
        'Deseja remover sua foto de perfil?',
        [
        {
            text: 'Cancelar',
            style: 'cancel',
        },
        {
            text: 'Remover',
            style: 'destructive',
            onPress: async () => {
            setAvatarUrl(null);

            await updateProfile({
                avatar_url: null,
            });

            await supabase.auth.updateUser({
                data: {
                avatar_url: null,
                },
            });

            Alert.alert('Sucesso', 'Foto removida.');
            },
        },
        ],
    );
  }

  async function handleSave() {
    if (!fullName.trim()) {
      Alert.alert('Atenção', 'Informe seu nome.');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Atenção', 'Informe seu e-mail.');
      return;
    }

    if (password || confirmPassword) {
      if (password.length < 6) {
        Alert.alert('Senha inválida', 'A senha precisa ter pelo menos 6 caracteres.');
        return;
      }

      if (password !== confirmPassword) {
        Alert.alert('Senha inválida', 'As senhas não são iguais.');
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        Alert.alert('Erro', error.message);
        return;
      }
    }

    const { error: authError } = await supabase.auth.updateUser({
      email,
      data: {
        full_name: fullName,
        avatar_url: avatarUrl,
      },
    });

    if (authError) {
      Alert.alert('Erro', authError.message);
      return;
    }

    await updateProfile({
        full_name: fullName,
        phone: phone.replace(/\D/g, ''),
        avatar_url: avatarUrl,
    });

    setPassword('');
    setConfirmPassword('');

    Alert.alert('Sucesso', 'Dados atualizados.');
  }

  if (!profile) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.title}>Minha conta</Text>
      </View>

      <View style={styles.avatarBox}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Ionicons name="person" size={34} color="#FFFFFF" />
          </View>
        )}

        <View style={styles.avatarActions}>
            <TouchableOpacity style={styles.changePhotoButton} onPress={pickAvatar}>
                <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
                <Text style={styles.changePhotoText}>Alterar foto</Text>
            </TouchableOpacity>

            {avatarUrl && (
                <TouchableOpacity style={styles.removePhotoButton} onPress={handleRemoveAvatar}>
                <Ionicons name="trash-outline" size={17} color="#EF4444" />
                <Text style={styles.removePhotoText}>Remover</Text>
                </TouchableOpacity>
            )}
        </View>
      </View>

      <Text style={styles.label}>Nome completo</Text>
      <TextInput
        value={fullName}
        onChangeText={setFullName}
        placeholder="Seu nome completo"
        placeholderTextColor="#71717A"
        style={styles.input}
      />

      <Text style={styles.label}>E-mail</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="seu@email.com"
        placeholderTextColor="#71717A"
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />

      <Text style={styles.label}>WhatsApp</Text>
      <TextInput
        value={phone}
        onChangeText={(text) => setPhone(formatPhone(text))}
        placeholder="(00) 00000-0000"
        placeholderTextColor="#71717A"
        keyboardType="phone-pad"
        style={styles.input}
      />

      <Text style={styles.sectionTitle}>Alterar senha</Text>

      <Text style={styles.label}>Nova senha</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Digite a nova senha"
        placeholderTextColor="#71717A"
        secureTextEntry
        style={styles.input}
      />

      <Text style={styles.label}>Confirmar senha</Text>
      <TextInput
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Confirme a nova senha"
        placeholderTextColor="#71717A"
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Salvar alterações</Text>
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
    paddingBottom: 120,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 28,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },

  avatarBox: {
    alignItems: 'center',
    marginBottom: 28,
  },

  avatar: {
    width: 96,
    height: 96,
    borderRadius: 999,
    marginBottom: 12,
  },

  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  changePhotoButton: {
    height: 40,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  changePhotoText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 14,
  },

  label: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },

  input: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },

  button: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  avatarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    },

    removePhotoButton: {
    height: 40,
    borderRadius: 999,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#3F1D1D',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    },

    removePhotoText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '900',
    },
});