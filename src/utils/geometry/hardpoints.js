import * as THREE from "three";

/**
 * Derives approximate hardpoints from a glasses geometry bounding box.
 * Used as a fallback when a frame has no artist-supplied hardpoints.
 *
 * Confirmed axis layout from bbox logging (default-glasses.stl):
 *   X = left-right  (wide axis, ±73 units)
 *   Y = up-down     (±20 units)
 *   Z = depth       (narrow axis, ±5 units — frame thickness)
 *
 * Face-side = bb.max.z: the full scene transform is mesh rotation [0,PI/2,0]
 * inside group rotation [0,PI/2,0] = combined [0,PI,0]. The resulting world_z
 * formula is: world_z = -0.01*lz + 0.875. Higher lz → lower world_z → closer
 * to face. So bb.max.z is the face-side edge.
 */
export function deriveHardpointsFromBbox(geometry) {
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;

  const faceZ = bb.max.z;

  const minX = bb.min.x, maxX = bb.max.x;
  const minY = bb.min.y, maxY = bb.max.y;
  const midX = (minX + maxX) / 2;
  const lensW = (maxX - minX) / 2;
  const noseOffset = lensW * 0.12;

  return {
    hp_left_outer_top:     new THREE.Vector3(minX,                  maxY, faceZ),
    hp_left_outer_bottom:  new THREE.Vector3(minX,                  minY, faceZ),
    hp_left_inner_top:     new THREE.Vector3(midX - noseOffset * 2, maxY, faceZ),
    hp_left_inner_bottom:  new THREE.Vector3(midX - noseOffset * 2, minY, faceZ),
    hp_right_inner_top:    new THREE.Vector3(midX + noseOffset * 2, maxY, faceZ),
    hp_right_inner_bottom: new THREE.Vector3(midX + noseOffset * 2, minY, faceZ),
    hp_right_outer_top:    new THREE.Vector3(maxX,                  maxY, faceZ),
    hp_right_outer_bottom: new THREE.Vector3(maxX,                  minY, faceZ),
    hp_nose_left:          new THREE.Vector3(midX - noseOffset,     minY, faceZ),
    hp_nose_right:         new THREE.Vector3(midX + noseOffset,     minY, faceZ),
  };
}

// Full perimeter loop: left outer (top→bottom) → across bottom (nose bridge) →
// right outer (bottom→top) → across top → closes back to left outer top.
export const DEFAULT_SEAL_LOOP = [
  "hp_left_outer_top",
  "hp_left_outer_bottom",
  "hp_left_inner_bottom",
  "hp_nose_left",
  "hp_nose_right",
  "hp_right_inner_bottom",
  "hp_right_outer_bottom",
  "hp_right_outer_top",
  "hp_right_inner_top",
  "hp_left_inner_top",
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
