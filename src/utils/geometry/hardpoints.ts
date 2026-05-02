import * as THREE from "three";

export interface Hardpoints {
  hp_left_outer_top: THREE.Vector3;
  hp_left_outer_bottom: THREE.Vector3;
  hp_left_inner_top: THREE.Vector3;
  hp_left_inner_bottom: THREE.Vector3;
  hp_right_inner_top: THREE.Vector3;
  hp_right_inner_bottom: THREE.Vector3;
  hp_right_outer_top: THREE.Vector3;
  hp_right_outer_bottom: THREE.Vector3;
  hp_nose_left: THREE.Vector3;
  hp_nose_right: THREE.Vector3;
}

export function deriveHardpointsFromBbox(geometry: THREE.BufferGeometry): Hardpoints {
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;

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

export const DEFAULT_SEAL_LOOP: string[] = [
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

export function transformHardpoints(
  hardpoints: Hardpoints,
  matrixWorld: THREE.Matrix4,
): Record<string, THREE.Vector3> {
  const result: Record<string, THREE.Vector3> = {};
  for (const [name, localPos] of Object.entries(hardpoints)) {
    result[name] = (localPos as THREE.Vector3).clone().applyMatrix4(matrixWorld);
  }
  return result;
}
