import { useEffect, useMemo } from "react";

export const useImageBlob = (blob: Blob | undefined): string | undefined => {
  // Create a new URL for the blob
  const objectUrl = useMemo(() => {
    if (!blob) {
      return undefined;
    }

    return URL.createObjectURL(blob);
  }, [blob]);

  // Revoke the object URL to free memory when the component is unmounted
  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  return objectUrl;
};
