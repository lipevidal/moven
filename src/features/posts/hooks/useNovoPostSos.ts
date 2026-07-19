import { useCallback, useMemo, useState } from "react";

import { SupportType } from "../components/sos/TipoAjudaCard";

const EMPTY_IMAGES = Array<string | null>(6).fill(null);

export function useNovoPostSos() {
  const [supportType, setSupportType] =
    useState<SupportType>("passenger_problem");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<Array<string | null>>([...EMPTY_IMAGES]);

  const imageUris = useMemo(
    () => images.filter((uri): uri is string => Boolean(uri)),
    [images],
  );

  const setLocation = useCallback(
    (next: {
      latitude: number;
      longitude: number;
      locationLabel?: string;
    }) => {
      setLatitude(next.latitude);
      setLongitude(next.longitude);
      setLocationLabel(next.locationLabel ?? "");
    },
    [],
  );

  const removeLocation = useCallback(() => {
    setLatitude(null);
    setLongitude(null);
    setLocationLabel("");
  }, []);

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
    setSupportType("passenger_problem");
    removeLocation();
    setDescription("");
    setImages([...EMPTY_IMAGES]);
  }, [removeLocation]);

  return {
    supportType,
    setSupportType,
    latitude,
    longitude,
    locationLabel,
    setLocation,
    removeLocation,
    description,
    setDescription,
    images,
    imageUris,
    setImageAt,
    removeImageAt,
    reset,
  };
}

export default useNovoPostSos;
