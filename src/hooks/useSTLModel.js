import React from "react";
import { useLoader } from "@react-three/fiber";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";

export function useSTLModel(url) {
  const geometry = useLoader(STLLoader, url);
  geometry.center();
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  return geometry;
}

function mergeSceneGeometries(object) {
  const geos = [];
  object.traverse((child) => {
    if (child.isMesh && child.geometry) {
      child.updateWorldMatrix(true, false);
      let g = child.geometry.index
        ? child.geometry.toNonIndexed()
        : child.geometry.clone();
      // Bake the mesh's world transform into vertex positions
      g.applyMatrix4(child.matrixWorld);
      // Strip attributes other than position/normal (avoids merge errors)
      for (const key of Object.keys(g.attributes)) {
        if (key !== "position" && key !== "normal") g.deleteAttribute(key);
      }
      geos.push(g);
    }
  });
  if (geos.length === 0) return null;
  const merged = geos.length === 1
    ? geos[0]
    : BufferGeometryUtils.mergeGeometries(geos, false);
  merged.center();
  merged.computeBoundingBox();

  // Normalize to ~130 units on the largest axis so the model arrives at the
  // same scale as a Blender mm-unit STL export. This lets DEFAULT_GLASSES_SCALE
  // (0.01) work for GLB/OBJ regardless of whether they were authored in m/cm/mm.
  const bb = merged.boundingBox;
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

  // Auto-orient so the thinnest dimension lands on Z (the face-depth axis the
  // seal generator expects). GLBs vary in up-axis convention — a model authored
  // face-up has Y as the thinnest axis, causing the seal to trace the top-down
  // shadow silhouette instead of the front face. Rotate to canonical orientation.
  {
    const b = merged.boundingBox;
    const dx = b.max.x - b.min.x;
    const dy = b.max.y - b.min.y;
    const dz = b.max.z - b.min.z;
    if (!(dz <= dx && dz <= dy)) {
      if (dy <= dx && dy <= dz) {
        // Y is thinnest → rotate −90° around X so Y maps to Z
        merged.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
      } else {
        // X is thinnest → rotate 90° around Y so X maps to Z
        merged.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2));
      }
      merged.computeBoundingBox();
    }
  }

  merged.computeVertexNormals();
  return merged;
}

// Imperative load — does NOT suspend the component, so the rest of the
// scene stays visible while loading and errors surface in the console.
export function useUploadedModel(file) {
  const [geometry, setGeometry] = React.useState(null);

  React.useEffect(() => {
    if (!file) { setGeometry(null); return; }
    const url = URL.createObjectURL(file);
    const ext = file.name.split(".").pop().toLowerCase();

    const finish = (geo) => {
      geo.center();
      geo.computeBoundingBox();
      geo.computeVertexNormals();
      setGeometry(geo);
    };

    const onError = (err) => console.error("[useUploadedModel] Failed to load:", err);

    if (ext === "glb" || ext === "gltf") {
      new GLTFLoader().load(url, ({ scene }) => {
        const geo = mergeSceneGeometries(scene);
        if (geo) setGeometry(geo);
        else onError(new Error("No mesh geometry found in GLTF scene"));
      }, undefined, onError);
    } else if (ext === "obj") {
      new OBJLoader().load(url, (group) => {
        const geo = mergeSceneGeometries(group);
        if (geo) setGeometry(geo);
        else onError(new Error("No mesh geometry found in OBJ"));
      }, undefined, onError);
    } else if (ext === "ply") {
      new PLYLoader().load(url, finish, undefined, onError);
    } else {
      // STL (default)
      new STLLoader().load(url, finish, undefined, onError);
    }

    return () => URL.revokeObjectURL(url);
  }, [file]);

  return geometry;
}
