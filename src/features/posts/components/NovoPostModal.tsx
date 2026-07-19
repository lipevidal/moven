import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  ConteudoNovoPost,
  ConteudoNovoPostProps,
} from "./ConteudoNovoPost";

type IconName = keyof typeof Ionicons.glyphMap;

export type NovoPostModalHeader = {
  eyebrow?: string;
  title: string;
  description?: string;
  icon: IconName;
  color: string;
};

export type NovoPostModalButton = {
  label: string;
  icon: IconName;
  color: string;
  textColor?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void | Promise<void>;
};

export type NovoPostModalProps = {
  visible: boolean;
  onClose: () => void;
  header: NovoPostModalHeader;
  button: NovoPostModalButton;
  conteudo: ConteudoNovoPostProps;
};

export function NovoPostModal({
  visible,
  onClose,
  header,
  button,
  conteudo,
}: NovoPostModalProps) {
  const buttonDisabled = Boolean(button.disabled || button.loading);
  const buttonTextColor = button.textColor ?? "#080808";

  function handleClose() {
    if (button.loading) return;

    Keyboard.dismiss();
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View
                style={[
                  styles.modalIconBox,
                  {
                    backgroundColor: `${header.color}18`,
                    borderColor: `${header.color}35`,
                  },
                ]}
              >
                <Ionicons
                  name={header.icon}
                  size={22}
                  color={header.color}
                />
              </View>

              <View style={styles.modalHeaderTextBox}>
                <Text style={[styles.modalEyebrow, { color: header.color }]}>
                  {header.eyebrow ?? "Novo post"}
                </Text>

                <Text style={styles.modalTitle}>{header.title}</Text>

                {header.description ? (
                  <Text style={styles.modalDescription} numberOfLines={2}>
                    {header.description}
                  </Text>
                ) : null}
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.modalCloseButton}
              disabled={Boolean(button.loading)}
              onPress={handleClose}
            >
              <Ionicons name="close" size={22} color="#F5F0E6" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <ConteudoNovoPost {...conteudo} />
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.actionButton,
              {
                backgroundColor: button.color,
                shadowColor: button.color,
              },
              buttonDisabled && styles.actionButtonDisabled,
            ]}
            disabled={buttonDisabled}
            onPress={button.onPress}
          >
            {button.loading ? (
              <ActivityIndicator color={buttonTextColor} />
            ) : (
              <>
                <Ionicons
                  name={button.icon}
                  size={20}
                  color={buttonTextColor}
                />

                <Text
                  style={[
                    styles.actionButtonText,
                    { color: buttonTextColor },
                  ]}
                >
                  {button.label}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default NovoPostModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.76)",
  },
  modalCard: {
    flex: 1,
    width: "100%",
    backgroundColor: "#0B0B0F",
  },
  modalHeader: {
    width: "100%",
    backgroundColor: "#101014",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245,240,230,0.08)",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 54,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  modalHeaderLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  modalIconBox: {
    width: 48,
    height: 48,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderTextBox: {
    flex: 1,
    minWidth: 0,
  },
  modalEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  modalTitle: {
    color: "#F5F0E6",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 2,
  },
  modalDescription: {
    color: "#9B969B",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 3,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#18171D",
    borderWidth: 1,
    borderColor: "#2A2830",
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    flex: 1,
    width: "100%",
  },
  modalScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
  },
  actionButton: {
    minHeight: 54,
    borderRadius: 17,
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: Platform.OS === "ios" ? 28 : 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 13,
    elevation: 8,
  },
  actionButtonDisabled: {
    opacity: 0.72,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "900",
  },
});
