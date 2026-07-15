import { useCallback, useState } from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getUnreadNotificationsCount } from '../services/getUnreadNotificationsCount';

/**
 * Propriedades aceitas pelo componente NotificationBell.
 *
 * size:
 * - define a largura e altura do botão de notificações;
 * - se não for informado, o botão usa 44 por padrão.
 */
type NotificationBellProps = {
  size?: number;
};

/**
 * Componente do sino de notificações.
 *
 * Ele exibe:
 * - um botão com ícone de notificações;
 * - um badge vermelho com a quantidade de notificações não lidas;
 * - navegação para a tela de notificações ao tocar no botão.
 *
 * Normalmente é usado no header do Dashboard ou em outras telas principais.
 */
export function NotificationBell({
  size = 44,
}: NotificationBellProps) {
  /**
   * Guarda a quantidade de notificações não lidas.
   *
   * Quando count for maior que 0, o badge vermelho será exibido.
   */
  const [count, setCount] =
    useState(0);

  /**
   * useFocusEffect executa sempre que a tela onde esse componente está
   * volta a ficar em foco.
   *
   * Isso garante que o contador seja atualizado quando o usuário:
   * - abre o app;
   * - volta para o Dashboard;
   * - retorna de outra tela depois de ler notificações.
   */
  useFocusEffect(
    useCallback(() => {
      loadCount();
    }, []),
  );

  /**
   * Busca no banco/serviço a quantidade de notificações não lidas.
   *
   * Se a busca der certo:
   * - atualiza count com o número retornado.
   *
   * Se der erro:
   * - mostra o erro no console;
   * - zera o contador para evitar badge incorreto.
   */
  async function loadCount() {
    try {
      const response =
        await getUnreadNotificationsCount();

      setCount(response);
    } catch (error) {
      console.log(error);
      setCount(0);
    }
  }

  return (
    /**
     * Botão principal do sino.
     *
     * O tamanho é dinâmico de acordo com a prop size.
     * Ao tocar, navega para a tela de notificações.
     */
    <TouchableOpacity
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 3,
        },
      ]}
      activeOpacity={0.85}
      onPress={() => router.push('/(private)/notifications')}
    >
      <Ionicons
        name="notifications-outline"
        size={22}
        color="#FFFFFF"
      />

      {/**
       * Badge de notificações não lidas.
       *
       * Só aparece quando count for maior que zero.
       *
       * Se houver mais de 99 notificações, mostra "99+"
       * para evitar quebrar o layout.
       */}
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  /**
   * Estilo do botão do sino.
   *
   * width, height e borderRadius são definidos dinamicamente no componente,
   * porque dependem da prop size.
   */
  button: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /**
   * Badge vermelho que mostra a quantidade de notificações não lidas.
   *
   * position absolute permite que ele fique sobre o canto superior direito
   * do botão.
   */
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },

  /**
   * Texto dentro do badge.
   */
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
