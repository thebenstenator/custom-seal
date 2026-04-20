import React from "react";
import { useLoader } from "@react-three/fiber";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

export function useSTLModel(url) {
  const geometry = useLoader(STLLoader, url);
  geometry.center();
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  return geometry;
}

export function useUploadedModel(file) {
  const fileUrl = React.useMemo(() => URL.createObjectURL(file), [file]);

  React.useEffect(() => {
    return () => URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);

  return useSTLModel(fileUrl);
}
