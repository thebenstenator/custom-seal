import * as THREE from "three";

/**
 * Derives approximate hardpoints from a glasses geometry bounding box.
 * Used as a fallback when a frame has no artist-supplied hardpoints.
 *
 * Points sit at the back face (maxZ) of the bounding box so they face
 * toward the user's face.
 */
/**
 * Derives hardpoints from the glasses bounding box.
 *
 * The default-glasses STL sits in local space with:
 *   Z = left-right (width of frame) — becomes world X after rotation=[0, PI/2, 0]
 *   Y = up-down
 *   X = depth (front-to-back of frame); bb.min.x is the face-side edge
 *
 * This assumption holds for any frame exported under the same convention.
 * Artist-supplied GLBs override this entirely with named hp_ nodes.
 */
export function deriveHardpointsFromBbox(geometry) {
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;

  // Face-side depth: the back edge of the frame that sits closest to the skin
  const faceX = bb.min.x;

  const minZ = bb.min.z, maxZ = bb.max.z;
  const minY = bb.min.y, maxY = bb.max.y;
  const midZ = (minZ + maxZ) / 2;
  const lensW = (maxZ - minZ) / 2;
  const noseOffset = lensW * 0.12;

  return {
    hp_left_outer_top:     new THREE.Vector3(faceX, maxY, minZ),
    hp_left_outer_bottom:  new THREE.Vector3(faceX, minY, minZ),
    hp_left_inner_top:     new THREE.Vector3(faceX, maxY, midZ - noseOffset * 2),
    hp_left_inner_bottom:  new THREE.Vector3(faceX, minY, midZ - noseOffset * 2),
    hp_right_inner_top:    new THREE.Vector3(faceX, maxY, midZ + noseOffset * 2),
    hp_right_inner_bottom: new THREE.Vector3(faceX, minY, midZ + noseOffset * 2),
    hp_right_outer_top:    new THREE.Vector3(faceX, maxY, maxZ),
    hp_right_outer_bottom: new THREE.Vector3(faceX, minY, maxZ),
    hp_nose_left:          new THREE.Vector3(faceX, minY, midZ - noseOffset),
    hp_nose_right:         new THREE.Vector3(faceX, minY, midZ + noseOffset),
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
