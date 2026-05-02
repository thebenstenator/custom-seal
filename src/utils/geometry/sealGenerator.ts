import * as THREE from "three";

// three-mesh-bvh augments THREE.BufferGeometry with boundsTree/computeBoundsTree
// (declared in three-mesh-bvh's own index.d.ts — we don't redeclare it here).

/**
 * Assigns a BVH to the geometry. Kept for future face-scan raycasting.
 * Safe to call multiple times — no-op if already built.
 */
export function buildFaceBVH(geometry: THREE.BufferGeometry): void {
  if (geometry.boundsTree) return;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundsTree();
}

function extrudeAlongNormal(
  worldPath: THREE.Vector3[],
  faceNormal: THREE.Vector3,
  depth: number,
): THREE.Vector3[] {
  return worldPath.map((p) => p.clone().addScaledVector(faceNormal, depth));
}

function radialOffsets(
  loop: THREE.Vector3[],
  faceNormal: THREE.Vector3,
  halfWall: number,
): THREE.Vector3[] {
  const centroid = new THREE.Vector3();
  for (const p of loop) centroid.add(p);
  centroid.divideScalar(loop.length);

  return loop.map((p) => {
    const r = p.clone().sub(centroid);
    r.addScaledVector(faceNormal, -r.dot(faceNormal));
    const len = r.length();
    return len > 1e-6
      ? r.multiplyScalar(halfWall / len)
      : new THREE.Vector3(halfWall, 0, 0);
  });
}

function buildThickBand(
  glassesEdge: THREE.Vector3[],
  faceEdge: THREE.Vector3[],
  faceNormal: THREE.Vector3,
  wallThickness: number,
): THREE.BufferGeometry | null {
  const n = Math.min(glassesEdge.length, faceEdge.length);
  if (n < 3) return null;

  const offsets = radialOffsets(glassesEdge, faceNormal, wallThickness / 2);

  const og  = glassesEdge.map((p, i) => p.clone().add(offsets[i]));
  const ig  = glassesEdge.map((p, i) => p.clone().sub(offsets[i]));
  const of_ = faceEdge.map((p, i)    => p.clone().add(offsets[i]));
  const if_ = faceEdge.map((p, i)    => p.clone().sub(offsets[i]));

  const positions = new Float32Array(n * 4 * 3);
  const set = (idx: number, v: THREE.Vector3) => {
    positions[idx * 3]     = v.x;
    positions[idx * 3 + 1] = v.y;
    positions[idx * 3 + 2] = v.z;
  };
  for (let i = 0; i < n; i++) {
    set(i,       og[i]);
    set(n + i,   ig[i]);
    set(2*n + i, of_[i]);
    set(3*n + i, if_[i]);
  }

  const indices: number[] = [];
  const isClosedLoop = glassesEdge[0].distanceTo(glassesEdge[n - 1]) < 0.1;
  const segs = isClosedLoop ? n : n - 1;

  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n;
    indices.push(i,      j,      2*n+i);
    indices.push(j,      2*n+j,  2*n+i);
    indices.push(n+i,    3*n+i,  n+j);
    indices.push(n+j,    3*n+i,  3*n+j);
    indices.push(i,      n+i,    j);
    indices.push(n+i,    n+j,    j);
    indices.push(2*n+i,  2*n+j,  3*n+i);
    indices.push(2*n+j,  3*n+j,  3*n+i);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const SEAL_DEPTH     = 0.05;
const WALL_THICKNESS = 0.009;

export function generateSeal(
  worldSealPath: THREE.Vector3[],
  faceNormal: THREE.Vector3,
): THREE.BufferGeometry | null {
  if (!worldSealPath || worldSealPath.length < 3) return null;
  const faceEdge = extrudeAlongNormal(worldSealPath, faceNormal, SEAL_DEPTH);
  return buildThickBand(worldSealPath, faceEdge, faceNormal, WALL_THICKNESS);
}

function mergeGeos(geos: Array<THREE.BufferGeometry | null>): THREE.BufferGeometry | null {
  const valid = geos.filter((g): g is THREE.BufferGeometry => g !== null);
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];

  const totalVerts = valid.reduce((s, g) => s + g.attributes.position.count, 0);
  const positions = new Float32Array(totalVerts * 3);
  const indices: number[] = [];
  let vertOffset = 0, posOffset = 0;
  for (const g of valid) {
    positions.set(g.attributes.position.array as Float32Array, posOffset);
    for (const idx of (g.index!.array as Uint32Array | Uint16Array)) {
      indices.push(idx + vertOffset);
    }
    vertOffset += g.attributes.position.count;
    posOffset  += (g.attributes.position.array as Float32Array).length;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  return merged;
}

export function generateDualSeal(
  leftPath: THREE.Vector3[] | null,
  rightPath: THREE.Vector3[] | null,
  faceNormal: THREE.Vector3,
): THREE.BufferGeometry | null {
  return mergeGeos([
    leftPath  && leftPath.length  >= 3 ? generateSeal(leftPath,  faceNormal) : null,
    rightPath && rightPath.length >= 3 ? generateSeal(rightPath, faceNormal) : null,
  ]);
}
