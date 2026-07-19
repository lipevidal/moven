import { useCallback, useMemo, useState } from "react";

const EMPTY_IMAGES = Array<string | null>(6).fill(null);

export function useNovoPostGeral() {
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
    setDescription("");
    setImages([...EMPTY_IMAGES]);
  }, []);

  return {
    description,
    setDescription,
    images,
    imageUris,
    setImageAt,
    removeImageAt,
    reset,
  };
}

export default useNovoPostGeral;
