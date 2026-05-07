import * as THREE from "three";

// three-mesh-bvh augments THREE.BufferGeometry with boundsTree/computeBoundsTree
// (declared in three-mesh-bvh's own index.d.ts — we don't redeclare it here).

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


// Flattens both edges of a seal ring together for TPU flat printing.
//
// The per-point shift needed to flatten the frame-contact edge is also applied
// to the face-contact edge, so the depth (frame→face distance) is preserved at
// every point. When the printed flat frame side is bent back onto the curved
// glasses frame, the face side moves with it and lands at the original
// face-conforming position — no extra thickness is introduced at curved areas.
//
// Uses min(dot(p, normal)) as the flat plane so all face-contact points remain
// strictly on the face side (centroid would allow inversions at curved areas).
export function flattenEdgesForTPU(
  glassesEdge: THREE.Vector3[],
  faceEdge: THREE.Vector3[],
  normal: THREE.Vector3,
): { flatFrame: THREE.Vector3[]; shiftedFace: THREE.Vector3[] } {
  let planeD = Infinity;
  for (const p of glassesEdge) {
    const d = p.dot(normal);
    if (d < planeD) planeD = d;
  }

  const n = Math.min(glassesEdge.length, faceEdge.length);
  const flatFrame: THREE.Vector3[]   = [];
  const shiftedFace: THREE.Vector3[] = [];

  for (let i = 0; i < n; i++) {
    const shift = planeD - glassesEdge[i].dot(normal);
    flatFrame.push(glassesEdge[i].clone().addScaledVector(normal, shift));
    shiftedFace.push(faceEdge[i].clone().addScaledVector(normal, shift));
  }

  return { flatFrame, shiftedFace };
}

export const SEAL_DEPTH    = 0.05;  // fallback flat depth (5 mm at 0.01 scale)
const WALL_THICKNESS       = 0.009; // 0.9 mm body thickness
const FLANGE_THICKNESS     = 0.020; // 2.0 mm mating flange thickness
const FLANGE_DEPTH         = 0.020; // 2.0 mm flange height (from glasses contact face)

// Builds a seal band with an upside-down-T cross section:
//   wide flange (FLANGE_THICKNESS) for the first FLANGE_DEPTH toward the face,
//   then a narrow body (WALL_THICKNESS) the rest of the way to the face.
// 8 vertex rings: [ogf, igf, ogfb, igfb, ogwb, igwb, ogwe, igwe]
function buildTBand(
  glassesEdge: THREE.Vector3[],
  faceEdge:    THREE.Vector3[],
  faceNormal:  THREE.Vector3,
  wallThickness:   number,
  flangeThickness: number,
  flangeDepth:     number,
): THREE.BufferGeometry | null {
  const n = Math.min(glassesEdge.length, faceEdge.length);
  if (n < 3) return null;

  const flangeOff = radialOffsets(glassesEdge, faceNormal, flangeThickness / 2);
  const wallOff   = radialOffsets(glassesEdge, faceNormal, wallThickness   / 2);

  // Depth-0 rings (glasses frame contact)
  const ogf  = glassesEdge.map((p, i) => p.clone().add(flangeOff[i]));
  const igf  = glassesEdge.map((p, i) => p.clone().sub(flangeOff[i]));

  // Rings at flangeDepth
  const fBase = extrudeAlongNormal(glassesEdge, faceNormal, flangeDepth);
  const ogfb  = fBase.map((p, i) => p.clone().add(flangeOff[i])); // outer flange bottom
  const igfb  = fBase.map((p, i) => p.clone().sub(flangeOff[i])); // inner flange bottom
  const ogwb  = fBase.map((p, i) => p.clone().add(wallOff[i]));   // outer wall top
  const igwb  = fBase.map((p, i) => p.clone().sub(wallOff[i]));   // inner wall top

  // Rings at faceEdge
  const ogwe  = faceEdge.map((p, i) => p.clone().add(wallOff[i]));
  const igwe  = faceEdge.map((p, i) => p.clone().sub(wallOff[i]));

  const rings = [ogf, igf, ogfb, igfb, ogwb, igwb, ogwe, igwe];
  const positions = new Float32Array(n * 8 * 3);
  rings.forEach((ring, r) => {
    ring.forEach((v, i) => {
      const b = (r * n + i) * 3;
      positions[b] = v.x; positions[b + 1] = v.y; positions[b + 2] = v.z;
    });
  });

  const V = (r: number, i: number) => r * n + i;
  const indices: number[] = [];

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;

    // Top cap — normal toward glasses (-faceNormal)
    indices.push(V(0,i), V(1,i), V(0,j));
    indices.push(V(1,i), V(1,j), V(0,j));

    // Outer flange wall (depth 0 → flangeDepth)
    indices.push(V(0,i), V(0,j), V(2,i));
    indices.push(V(0,j), V(2,j), V(2,i));

    // Inner flange wall (depth 0 → flangeDepth)
    indices.push(V(1,i), V(3,i), V(1,j));
    indices.push(V(1,j), V(3,i), V(3,j));

    // Outer step face — underside of flange shoulder, normal toward face (+faceNormal)
    indices.push(V(2,i), V(2,j), V(4,i));
    indices.push(V(2,j), V(4,j), V(4,i));

    // Inner step face — underside of flange shoulder, normal toward face (+faceNormal)
    indices.push(V(5,i), V(5,j), V(3,i));
    indices.push(V(5,j), V(3,j), V(3,i));

    // Outer body wall (flangeDepth → faceEdge)
    indices.push(V(4,i), V(4,j), V(6,i));
    indices.push(V(4,j), V(6,j), V(6,i));

    // Inner body wall (flangeDepth → faceEdge)
    indices.push(V(5,i), V(7,i), V(5,j));
    indices.push(V(5,j), V(7,i), V(7,j));

    // Bottom cap — normal toward face (+faceNormal)
    indices.push(V(6,i), V(6,j), V(7,i));
    indices.push(V(6,j), V(7,j), V(7,i));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function generateSeal(
  worldSealPath: THREE.Vector3[],
  faceNormal: THREE.Vector3,
  faceEdge?: THREE.Vector3[],
): THREE.BufferGeometry | null {
  if (!worldSealPath || worldSealPath.length < 3) return null;
  const edge = faceEdge ?? extrudeAlongNormal(worldSealPath, faceNormal, SEAL_DEPTH);
  return buildTBand(worldSealPath, edge, faceNormal, WALL_THICKNESS, FLANGE_THICKNESS, FLANGE_DEPTH);
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
  leftPath:  THREE.Vector3[] | null,
  rightPath: THREE.Vector3[] | null,
  faceNormal: THREE.Vector3,
  leftEdge?:  THREE.Vector3[] | null,
  rightEdge?: THREE.Vector3[] | null,
): THREE.BufferGeometry | null {
  return mergeGeos([
    leftPath  && leftPath.length  >= 3
      ? generateSeal(leftPath,  faceNormal, leftEdge  ?? undefined) : null,
    rightPath && rightPath.length >= 3
      ? generateSeal(rightPath, faceNormal, rightEdge ?? undefined) : null,
  ]);
}
