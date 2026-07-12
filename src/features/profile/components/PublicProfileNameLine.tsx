import { Text, StyleSheet } from "react-native";

type PublicProfileNameLineProps = {
  userId?: string;
  name: string;
};

/**
 * Mostra apenas o nome público do usuário.
 *
 * A lógica antiga de posição nacional, ranking, XP, medalhas e recompensas
 * foi removida para não exibir mais números como (#1), (#2), etc.
 */
export function PublicProfileNameLine({ name }: PublicProfileNameLineProps) {
  return (
    <Text style={styles.name} numberOfLines={2}>
      {name}
    </Text>
  );
}

const styles = StyleSheet.create({
  name: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
  },
});
