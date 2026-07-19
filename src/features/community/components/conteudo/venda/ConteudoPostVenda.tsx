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
  openPostWhatsApp,
} from "../shared/postContentUtils";

type ConteudoPostVendaProps = {
  post: ConteudoPostPost;
  images: string[];
  postImagesViewportWidth: number;
  color: string;
};

export function ConteudoPostVenda({
  post,
  images,
  postImagesViewportWidth,
  color,
}: ConteudoPostVendaProps) {
  const productName =
    String(post.product_name ?? "").trim() ||
    "Produto anunciado";

  const paymentLabels = getPaymentMethodLabels(
    post.payment_methods,
  );

  const hasWhatsapp = Boolean(
    String(post.whatsapp_url ?? "").trim(),
  );

  return (
    <>
      <View style={styles.productHeader}>
        <View
          style={[
            styles.productIcon,
            {
              backgroundColor: `${color}18`,
              borderColor: `${color}3D`,
            },
          ]}
        >
          <Ionicons
            name="pricetag-outline"
            size={21}
            color={color}
          />
        </View>

        <View style={styles.productHeaderText}>
          <Text style={[styles.productEyebrow, { color }]}>
            Item à venda
          </Text>

          <Text style={styles.productName}>
            {productName}
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
        variant="compact"
        fullBleed={false}
      />

      <View
        style={[
          styles.commerceBar,
          {
            borderColor: `${color}35`,
            backgroundColor: `${color}0D`,
          },
        ]}
      >
        <View style={styles.priceArea}>
          <Text style={styles.priceLabel}>Valor</Text>

          <Text style={[styles.price, { color }]}>
            {post.price != null
              ? `R$ ${formatPostCurrency(post.price)}`
              : "A combinar"}
          </Text>

          {paymentLabels.length > 0 ? (
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
                  <Text
                    style={[
                      styles.paymentChipText,
                      {
                        color,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noPaymentText}>
              Forma de pagamento não informada
            </Text>
          )}
        </View>

        {hasWhatsapp ? (
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
            <Ionicons
              name="logo-whatsapp"
              size={22}
              color="#FFFFFF"
            />

            <Text style={styles.whatsappText}>
              WhatsApp
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );
}

export default ConteudoPostVenda;

const styles = StyleSheet.create({
  productHeader: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  productIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  productHeaderText: {
    flex: 1,
    minWidth: 0,
  },

  productEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  productName: {
    color: "#F5F0E6",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginTop: 2,
  },

  description: {
    color: "#D8D1C4",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 10,
  },

  commerceBar: {
    marginTop: 12,
    borderRadius: 19,
    borderWidth: 1,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  priceArea: {
    flex: 1,
    minWidth: 0,
  },

  priceLabel: {
    color: "#989299",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  price: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 2,
  },

  paymentList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 7,
  },

  paymentChip: {
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  paymentChipText: {
    fontSize: 9,
    fontWeight: "900",
  },

  noPaymentText: {
    color: "#858087",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 5,
  },

  whatsappButton: {
    minWidth: 86,
    minHeight: 64,
    borderRadius: 17,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 6,
  },

  whatsappText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
});
