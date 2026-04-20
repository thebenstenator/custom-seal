import * as THREE from "three";

/**
 * Derives approximate hardpoints from a glasses geometry bounding box.
 * Used as a fallback when a frame has no artist-supplied hardpoints.
 *
 * Points sit at the back face (maxZ) of the bounding box so they face
 * toward the user's face.
 */
export function deriveHardpointsFromBbox(geometry) {
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;

  const minX = bb.min.x, maxX = bb.max.x;
  const minY = bb.min.y, maxY = bb.max.y;
  const midZ = (bb.min.z + bb.max.z) / 2;

  const midX = (minX + maxX) / 2;
  const lensW = (maxX - minX) / 2;
  const noseOffset = lensW * 0.12;

  return {
    hp_left_outer_top:    new THREE.Vector3(minX,                  maxY, midZ),
    hp_left_outer_bottom: new THREE.Vector3(minX,                  minY, midZ),
    hp_left_inner_top:    new THREE.Vector3(midX - noseOffset * 2, maxY, midZ),
    hp_left_inner_bottom: new THREE.Vector3(midX - noseOffset * 2, minY, midZ),
    hp_right_inner_top:   new THREE.Vector3(midX + noseOffset * 2, maxY, midZ),
    hp_right_inner_bottom:new THREE.Vector3(midX + noseOffset * 2, minY, midZ),
    hp_right_outer_top:   new THREE.Vector3(maxX,                  maxY, midZ),
    hp_right_outer_bottom:new THREE.Vector3(maxX,                  minY, midZ),
    hp_nose_left:         new THREE.Vector3(midX - noseOffset,     minY, midZ),
    hp_nose_right:        new THREE.Vector3(midX + noseOffset,     minY, midZ),
  };
}

export const DEFAULT_SEAL_LOOP = [
  "hp_left_outer_top",
  "hp_left_outer_bottom",
  "hp_left_inner_bottom",
  "hp_nose_left",
  "hp_nose_right",
  "hp_right_inner_bottom",
  "hp_right_outer_bottom",
  "hp_right_outer_top",
];

/**
 * Applies a Three.js Object3D world matrix to a map of local-space hardpoints,
 * returning world-space Vector3s. Call this after the glasses mesh is positioned.
 */
export function transformHardpoints(hardpoints, matrixWorld) {
  const result = {};
  for (const [name, localPos] of Object.entries(hardpoints)) {
    result[name] = localPos.clone().applyMatrix4(matrixWorld);
  }
  return result;
}
