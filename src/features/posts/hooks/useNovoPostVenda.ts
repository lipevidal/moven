import { useCallback, useMemo, useState } from "react";

import { PostScope } from "../components/shared/SeletorEscopoCard";
import { PaymentMethodsValue } from "../components/venda/FormasPagamentoCard";

const EMPTY_IMAGES = Array<string | null>(6).fill(null);

const INITIAL_PAYMENT_METHODS: PaymentMethodsValue = {
  credit: false,
  creditInstallments: "",
  debit: false,
  pix: true,
  other: false,
  otherDescription: "",
};

export function useNovoPostVenda() {
  const [scope, setScope] = useState<PostScope>("national");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [paymentMethods, setPaymentMethods] =
    useState<PaymentMethodsValue>(INITIAL_PAYMENT_METHODS);
  const [whatsapp, setWhatsapp] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<Array<string | null>>([...EMPTY_IMAGES]);

  const imageUris = useMemo(
    () => images.filter((uri): uri is string => Boolean(uri)),
    [images],
  );

  const setImageAt = useCallback((slotIndex: number, uri: string) => {
    setImages((current) => {
      const next = [...current];
      next[slotIndex] = uri;
      return next;
    });
  }, []);

  const removeImageAt = useCallback((slotIndex: number) => {
    setImages((current) => {
      const next = [...current];
      next[slotIndex] = null;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setScope("national");
    setProductName("");
    setProductPrice("");
    setPaymentMethods(INITIAL_PAYMENT_METHODS);
    setWhatsapp("");
    setDescription("");
    setImages([...EMPTY_IMAGES]);
  }, []);

  return {
    scope,
    setScope,
    productName,
    setProductName,
    productPrice,
    setProductPrice,
    paymentMethods,
    setPaymentMethods,
    whatsapp,
    setWhatsapp,
    description,
    setDescription,
    images,
    imageUris,
    setImageAt,
    removeImageAt,
    reset,
  };
}

export default useNovoPostVenda;
