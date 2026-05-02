import { useState, useEffect } from "react";
import { useLoader } from "@react-three/fiber";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";

export function useSTLModel(url: string): THREE.BufferGeometry {
  const geometry = useLoader(STLLoader, url);
  geometry.center();
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  return geometry;
}

function mergeSceneGeometries(object: THREE.Object3D): THREE.BufferGeometry | null {
  const geos: THREE.BufferGeometry[] = [];
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.updateWorldMatrix(true, false);
    let g: THREE.BufferGeometry = child.geometry.index
      ? child.geometry.toNonIndexed()
      : child.geometry.clone();
    g.applyMatrix4(child.matrixWorld);
    for (const key of Object.keys(g.attributes)) {
      if (key !== "position" && key !== "normal") g.deleteAttribute(key);
    }
    geos.push(g);
  });
  if (geos.length === 0) return null;
  const merged: THREE.BufferGeometry =
    geos.length === 1
      ? geos[0]
      : BufferGeometryUtils.mergeGeometries(geos, false);
  merged.center();
  merged.computeBoundingBox();

  const bb = merged.boundingBox!;
  const maxDim = Math.max(
    bb.max.x - bb.min.x,
    bb.max.y - bb.min.y,
    bb.max.z - bb.min.z,
  );
  if (maxDim > 0) {
    const s = 130 / maxDim;
    merged.scale(s, s, s);
    merged.computeBoundingBox();
  }

  {
    const b = merged.boundingBox!;
    const dx = b.max.x - b.min.x;
    const dy = b.max.y - b.min.y;
    const dz = b.max.z - b.min.z;
    if (!(dz <= dx && dz <= dy)) {
      if (dy <= dx && dy <= dz) {
        merged.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
      } else {
        merged.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2));
      }
      merged.computeBoundingBox();
    }
  }

  merged.computeVertexNormals();
  return merged;
}

export function useUploadedModel(file: File | null): THREE.BufferGeometry | null {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!file) { setGeometry(null); return; }
    const url = URL.createObjectURL(file);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

    const finish = (geo: THREE.BufferGeometry) => {
      geo.center();
      geo.computeBoundingBox();
      geo.computeVertexNormals();
      setGeometry(geo);
    };

    const onError = (err: unknown) =>
      console.error("[useUploadedModel] Failed to load:", err);

    if (ext === "glb" || ext === "gltf") {
      new GLTFLoader().load(
        url,
        (gltf: GLTF) => {
          const geo = mergeSceneGeometries(gltf.scene);
          if (geo) setGeometry(geo);
          else onError(new Error("No mesh geometry found in GLTF scene"));
        },
        undefined,
        onError,
      );
    } else if (ext === "obj") {
      new OBJLoader().load(
        url,
        (group: THREE.Group) => {
          const geo = mergeSceneGeometries(group);
          if (geo) setGeometry(geo);
          else onError(new Error("No mesh geometry found in OBJ"));
        },
        undefined,
        onError,
      );
    } else if (ext === "ply") {
      new PLYLoader().load(url, finish, undefined, onError);
    } else {
      new STLLoader().load(url, finish, undefined, onError);
    }

    return () => URL.revokeObjectURL(url);
  }, [file]);

  return geometry;
}
