import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

export const useImageBlob = (blob: Blob | undefined): string | undefined => {
  // Create a new URL for the blob
  const objectUrl = useMemo(() => {
    if (!blob) {
      return;
    }

    return URL.createObjectURL(blob);
  }, [blob]);

  const { data: loadedObjectUrl } = useQuery({
    enabled: !!objectUrl,
    queryKey: ["image-preload", objectUrl],
    queryFn: async (): Promise<string | undefined> => {
      if (!objectUrl) {
        throw new Error("Object URL is not defined");
      }

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.addEventListener("load", () => {
          resolve(objectUrl);
        });
        img.addEventListener("error", (error) => {
          reject(error);
        });

        img.src = objectUrl;
      });
    },
  });

  // Revoke the object URL to free memory when the component is unmounted
  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  return loadedObjectUrl;
};
