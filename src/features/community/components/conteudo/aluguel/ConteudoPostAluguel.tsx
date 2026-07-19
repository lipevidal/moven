import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ConteudoPostPost } from "../../ConteudoPost";
import { GaleriaImagensPost } from "../shared/GaleriaImagensPost";
import {
  formatPostCurrency,
  getPaymentMethodLabels,
  getRentalPeriodLabel,
  openPostWhatsApp,
} from "../shared/postContentUtils";

type ConteudoPostAluguelProps = {
  post: ConteudoPostPost;
  images: string[];
  postImagesViewportWidth: number;
  color: string;
};

export function ConteudoPostAluguel({
  post,
  images,
  postImagesViewportWidth,
  color,
}: ConteudoPostAluguelProps) {
  const vehicleName = [
    post.vehicle_brand,
    post.vehicle_model,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const periodLabel = getRentalPeriodLabel(
    post.rental_periodicity,
  );

  const paymentLabels = getPaymentMethodLabels(
    post.payment_methods,
  );

  const rentalPrice = Number(post.rental_price ?? 0);
  const depositAmount = post.deposit_required
    ? Number(post.deposit_amount ?? 0)
    : 0;

  const pickupTotal =
    Math.max(depositAmount, 0) +
    (post.deposit_paid_on_delivery
      ? Math.max(rentalPrice, 0)
      : 0);

  return (
    <>
      <View
        style={[
          styles.vehicleHero,
          {
            borderColor: `${color}42`,
            backgroundColor: `${color}0D`,
          },
        ]}
      >
        <View
          style={[
            styles.vehicleIcon,
            {
              backgroundColor: color,
              shadowColor: color,
            },
          ]}
        >
          <Ionicons
            name="car-sport-outline"
            size={25}
            color="#FFFFFF"
          />
        </View>

        <View style={styles.vehicleInfo}>
          <Text style={[styles.vehicleEyebrow, { color }]}>
            Veículo para aluguel
          </Text>

          <Text style={styles.vehicleName}>
            {vehicleName || "Veículo anunciado"}
          </Text>

          {post.vehicle_year ? (
            <Text style={styles.vehicleYear}>
              Ano {post.vehicle_year}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.pricePill,
            {
              borderColor: `${color}45`,
              backgroundColor: `${color}18`,
            },
          ]}
        >
          <Text style={[styles.priceValue, { color }]}>
            R$ {formatPostCurrency(post.rental_price)}
          </Text>

          <Text style={styles.pricePeriod}>
            por {periodLabel}
          </Text>
        </View>
      </View>

      {post.content ? (
        <Text style={styles.description}>
          {post.content}
        </Text>
      ) : null}

      <GaleriaImagensPost
        images={images}
        postImagesViewportWidth={postImagesViewportWidth}
        variant="medium"
        fullBleed={false}
      />

      <View style={styles.infoGrid}>
        <View
          style={[
            styles.infoCard,
            {
              borderColor: `${color}30`,
            },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={18}
            color={color}
          />

          <Text style={styles.infoLabel}>Cobrança</Text>

          <Text style={styles.infoValue}>
            Por {periodLabel}
          </Text>
        </View>

        <View
          style={[
            styles.infoCard,
            {
              borderColor: `${color}30`,
            },
          ]}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={color}
          />

          <Text style={styles.infoLabel}>Caução</Text>

          <Text style={styles.infoValue}>
            {post.deposit_required
              ? `R$ ${formatPostCurrency(post.deposit_amount)}`
              : "Não exige"}
          </Text>

          {post.deposit_required &&
          post.deposit_installments ? (
            <Text style={styles.infoHint}>
              Até {post.deposit_installments}x
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.infoCard,
            {
              borderColor: `${color}30`,
            },
          ]}
        >
          <Ionicons
            name="key-outline"
            size={18}
            color={color}
          />

          <Text style={styles.infoLabel}>
            Para retirar
          </Text>

          <Text style={styles.infoValue}>
            R$ {formatPostCurrency(pickupTotal)}
          </Text>

          <Text style={styles.infoHint}>
            {post.deposit_paid_on_delivery
              ? `Inclui a primeira ${periodLabel}`
              : "Sem primeira cobrança marcada"}
          </Text>
        </View>
      </View>

      {paymentLabels.length > 0 ? (
        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>
            Formas de pagamento
          </Text>

          <View style={styles.paymentList}>
            {paymentLabels.map((label) => (
              <View
                key={label}
                style={[
                  styles.paymentChip,
                  {
                    borderColor: `${color}35`,
                    backgroundColor: `${color}12`,
                  },
                ]}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={14}
                  color={color}
                />

                <Text style={styles.paymentChipText}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {post.whatsapp_url ? (
        <TouchableOpacity
          activeOpacity={0.86}
          style={[
            styles.whatsappButton,
            {
              backgroundColor: color,
              shadowColor: color,
            },
          ]}
          onPress={(event: any) => {
            event.stopPropagation?.();
            void openPostWhatsApp(post.whatsapp_url);
          }}
        >
          <View style={styles.whatsappIcon}>
            <Ionicons
              name="logo-whatsapp"
              size={21}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.whatsappTextBox}>
            <Text style={styles.whatsappTitle}>
              Conversar sobre o aluguel
            </Text>

            <Text style={styles.whatsappSubtitle}>
              Tire dúvidas sobre disponibilidade e retirada.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={19}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      ) : null}
    </>
  );
}

export default ConteudoPostAluguel;

const styles = StyleSheet.create({
  vehicleHero: {
    marginTop: 12,
    borderRadius: 21,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  vehicleIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },

  vehicleInfo: {
    flex: 1,
    minWidth: 0,
  },

  vehicleEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },

  vehicleName: {
    color: "#F5F0E6",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },

  vehicleYear: {
    color: "#A8A1A8",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 3,
  },

  pricePill: {
    minWidth: 90,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 8,
    alignItems: "flex-end",
  },

  priceValue: {
    fontSize: 15,
    fontWeight: "900",
  },

  pricePeriod: {
    color: "#A8A1A8",
    fontSize: 8,
    fontWeight: "800",
    marginTop: 1,
  },

  description: {
    color: "#D8D1C4",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 11,
  },

  infoGrid: {
    marginTop: 11,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  infoCard: {
    flexGrow: 1,
    flexBasis: "30%",
    minHeight: 105,
    borderRadius: 17,
    borderWidth: 1,
    backgroundColor: "#141419",
    padding: 10,
  },

  infoLabel: {
    color: "#8F8991",
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 8,
  },

  infoValue: {
    color: "#F5F0E6",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 3,
  },

  infoHint: {
    color: "#858087",
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "700",
    marginTop: 3,
  },

  paymentSection: {
    marginTop: 11,
  },

  paymentTitle: {
    color: "#D8D1C4",
    fontSize: 10,
    fontWeight: "900",
  },

  paymentList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 7,
  },

  paymentChip: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  paymentChipText: {
    color: "#D8D1C4",
    fontSize: 9,
    fontWeight: "900",
  },

  whatsappButton: {
    minHeight: 60,
    borderRadius: 18,
    paddingHorizontal: 11,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },

  whatsappIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  whatsappTextBox: {
    flex: 1,
    minWidth: 0,
  },

  whatsappTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  whatsappSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "700",
    marginTop: 2,
  },
});
