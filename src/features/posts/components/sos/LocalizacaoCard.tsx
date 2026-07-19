import { memo, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type LocalizacaoCardProps = {
  color: string;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string;
  loading?: boolean;
  disabled?: boolean;
  onRequestLocation: () => void | Promise<void>;
  onSetManualLocation: (locationLabel: string) => void | Promise<void>;
  onRemoveLocation: () => void;
};

export const LocalizacaoCard = memo(function LocalizacaoCard({
  color,
  latitude,
  longitude,
  locationLabel,
  loading = false,
  disabled = false,
  onRequestLocation,
  onSetManualLocation,
  onRemoveLocation,
}: LocalizacaoCardProps) {
  const hasCoordinates = latitude !== null && longitude !== null;
  const hasLocation = hasCoordinates || Boolean(locationLabel.trim());

  const [manualFieldVisible, setManualFieldVisible] = useState(false);
  const [manualLocation, setManualLocation] = useState("");
  const [savingManualLocation, setSavingManualLocation] = useState(false);
  const [manualError, setManualError] = useState("");

  useEffect(() => {
    if (!manualFieldVisible) return;

    setManualLocation(locationLabel);
  }, [manualFieldVisible, locationLabel]);

  function toggleManualField() {
    if (disabled || loading || savingManualLocation) return;

    setManualFieldVisible((current) => {
      const next = !current;

      if (next) {
        setManualLocation(locationLabel);
        setManualError("");
      } else {
        Keyboard.dismiss();
      }

      return next;
    });
  }

  async function handleSaveManualLocation() {
    const cleanLocation = manualLocation.trim();

    if (cleanLocation.length < 5) {
      setManualError(
        "Digite uma localização mais completa, incluindo rua, número, bairro ou ponto de referência.",
      );
      return;
    }

    try {
      setSavingManualLocation(true);
      setManualError("");

      await onSetManualLocation(cleanLocation);

      setManualFieldVisible(false);
      Keyboard.dismiss();
    } catch (error: any) {
      console.log("Erro ao salvar localização manual:", error);

      setManualError(
        error?.message ??
          "Não foi possível salvar a localização informada.",
      );
    } finally {
      setSavingManualLocation(false);
    }
  }

  return (
    <View style={[styles.card, { borderColor: `${color}38` }]}>
      <View style={styles.header}>
        <Ionicons name="location-outline" size={20} color={color} />

        <View style={styles.headerText}>
          <Text style={styles.title}>Localização</Text>
          <Text style={styles.description}>
            Use sua posição atual ou informe manualmente o endereço onde
            precisa de apoio.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.86}
        disabled={disabled || loading || savingManualLocation}
        style={[
          styles.locationButton,
          {
            backgroundColor: `${color}18`,
            borderColor: `${color}45`,
          },
          (disabled || loading || savingManualLocation) && styles.disabled,
        ]}
        onPress={onRequestLocation}
      >
        <View
          style={[
            styles.locationButtonIcon,
            {
              backgroundColor: color,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons name="locate-outline" size={20} color="#FFFFFF" />
          )}
        </View>

        <View style={styles.locationButtonText}>
          <Text style={styles.locationButtonTitle}>
            {hasCoordinates
              ? "Atualizar localização atual"
              : "Usar localização atual"}
          </Text>

          <Text style={styles.locationButtonSubtitle}>
            Captura a posição atual do celular.
          </Text>
        </View>

        {!loading ? (
          <Ionicons name="chevron-forward" size={18} color={color} />
        ) : null}
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.86}
        disabled={disabled || loading || savingManualLocation}
        style={[
          styles.manualButton,
          {
            borderColor: `${color}35`,
          },
          (disabled || loading || savingManualLocation) && styles.disabled,
        ]}
        onPress={toggleManualField}
      >
        <View
          style={[
            styles.manualButtonIcon,
            {
              backgroundColor: `${color}16`,
              borderColor: `${color}35`,
            },
          ]}
        >
          <Ionicons name="create-outline" size={19} color={color} />
        </View>

        <View style={styles.locationButtonText}>
          <Text style={styles.locationButtonTitle}>
            Digitar localização manualmente
          </Text>

          <Text style={styles.locationButtonSubtitle}>
            Informe rua, número, bairro ou ponto de referência.
          </Text>
        </View>

        <Ionicons
          name={manualFieldVisible ? "chevron-up" : "chevron-down"}
          size={18}
          color={color}
        />
      </TouchableOpacity>

      {manualFieldVisible ? (
        <View
          style={[
            styles.manualFieldCard,
            {
              borderColor: `${color}35`,
            },
          ]}
        >
          <Text style={styles.manualFieldLabel}>
            Endereço ou ponto de referência
          </Text>

          <View
            style={[
              styles.manualInputContainer,
              {
                borderColor: manualError ? "#EF4444" : `${color}45`,
              },
            ]}
          >
            <Ionicons
              name="location-outline"
              size={18}
              color={manualError ? "#FCA5A5" : color}
            />

            <TextInput
              value={manualLocation}
              editable={!disabled && !savingManualLocation}
              style={styles.manualInput}
              placeholder="Ex.: Av. Afonso Pena, 1000, Centro, BH"
              placeholderTextColor="#716C74"
              multiline
              maxLength={180}
              autoCapitalize="sentences"
              autoCorrect
              textAlignVertical="top"
              onChangeText={(value) => {
                setManualLocation(value);

                if (manualError) {
                  setManualError("");
                }
              }}
            />
          </View>

          <View style={styles.manualCounterRow}>
            <Text style={styles.manualHint}>
              Quanto mais completo, mais fácil será encontrar você.
            </Text>

            <Text style={styles.manualCounter}>
              {manualLocation.length}/180
            </Text>
          </View>

          {manualError ? (
            <View style={styles.manualErrorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color="#FCA5A5"
              />

              <Text style={styles.manualErrorText}>{manualError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.88}
            disabled={
              disabled ||
              savingManualLocation ||
              manualLocation.trim().length < 5
            }
            style={[
              styles.saveManualButton,
              {
                backgroundColor: color,
                shadowColor: color,
              },
              (disabled ||
                savingManualLocation ||
                manualLocation.trim().length < 5) &&
                styles.disabled,
            ]}
            onPress={handleSaveManualLocation}
          >
            {savingManualLocation ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={19}
                  color="#FFFFFF"
                />

                <Text style={styles.saveManualButtonText}>
                  Usar este endereço
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {hasLocation ? (
        <View
          style={[
            styles.locationResult,
            {
              borderColor: `${color}35`,
            },
          ]}
        >
          <View
            style={[
              styles.resultIcon,
              {
                backgroundColor: `${color}18`,
              },
            ]}
          >
            <Ionicons
              name={hasCoordinates ? "navigate-outline" : "pin-outline"}
              size={18}
              color={color}
            />
          </View>

          <View style={styles.resultText}>
            <Text style={styles.resultTitle}>
              {hasCoordinates
                ? "Localização atual adicionada"
                : "Localização manual adicionada"}
            </Text>

            <Text style={styles.resultDescription}>
              {locationLabel ||
                (hasCoordinates
                  ? `Lat: ${latitude.toFixed(5)} · Long: ${longitude.toFixed(5)}`
                  : "")}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.86}
            disabled={disabled || savingManualLocation}
            style={styles.removeButton}
            onPress={() => {
              setManualLocation("");
              setManualFieldVisible(false);
              setManualError("");
              onRemoveLocation();
            }}
          >
            <Ionicons name="close" size={18} color={color} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
});

export default LocalizacaoCard;

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: "#101014",
    padding: 13,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 11,
  },

  headerText: {
    flex: 1,
  },

  title: {
    color: "#F5F0E6",
    fontSize: 13,
    fontWeight: "900",
  },

  description: {
    color: "#979198",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    marginTop: 2,
  },

  locationButton: {
    minHeight: 66,
    borderRadius: 17,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  manualButton: {
    minHeight: 64,
    borderRadius: 17,
    borderWidth: 1,
    padding: 10,
    marginTop: 9,
    backgroundColor: "#0B0B0F",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  locationButtonIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  manualButtonIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  locationButtonText: {
    flex: 1,
    minWidth: 0,
  },

  locationButtonTitle: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "900",
  },

  locationButtonSubtitle: {
    color: "#858087",
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 13,
    marginTop: 2,
  },

  manualFieldCard: {
    marginTop: 9,
    borderRadius: 17,
    borderWidth: 1,
    backgroundColor: "#0B0B0F",
    padding: 10,
  },

  manualFieldLabel: {
    color: "#D8D1C4",
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 7,
  },

  manualInputContainer: {
    minHeight: 88,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#141419",
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },

  manualInput: {
    flex: 1,
    minHeight: 66,
    color: "#F5F0E6",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    padding: 0,
  },

  manualCounterRow: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  manualHint: {
    flex: 1,
    color: "#858087",
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "700",
  },

  manualCounter: {
    color: "#77717A",
    fontSize: 9,
    fontWeight: "800",
  },

  manualErrorBox: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
    padding: 9,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },

  manualErrorText: {
    flex: 1,
    color: "#FCA5A5",
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "700",
  },

  saveManualButton: {
    minHeight: 46,
    borderRadius: 14,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },

  saveManualButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  locationResult: {
    marginTop: 9,
    minHeight: 64,
    borderRadius: 17,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0B0B0F",
  },

  resultIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  resultText: {
    flex: 1,
    minWidth: 0,
  },

  resultTitle: {
    color: "#F5F0E6",
    fontSize: 11,
    fontWeight: "900",
  },

  resultDescription: {
    color: "#969097",
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "700",
    marginTop: 2,
  },

  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,240,230,0.04)",
  },

  disabled: {
    opacity: 0.55,
  },
});
