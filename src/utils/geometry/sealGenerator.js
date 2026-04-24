import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";

/**
 * Assigns a BVH to the geometry. Kept for future face-scan raycasting.
 * Safe to call multiple times — no-op if already built.
 */
export function buildFaceBVH(geometry) {
  if (geometry.boundsTree) return;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.boundsTree = new MeshBVH(geometry);
}

function extrudeAlongNormal(worldPath, faceNormal, depth) {
  return worldPath.map((p) => p.clone().addScaledVector(faceNormal, depth));
}

/**
 * Computes the outward radial offset vector at each point of a loop.
 * Direction = centroid → point, projected onto the seal plane (perpendicular
 * to faceNormal), normalised and scaled to halfWall.
 */
function radialOffsets(loop, faceNormal, halfWall) {
  const centroid = new THREE.Vector3();
  for (const p of loop) centroid.add(p);
  centroid.divideScalar(loop.length);

  return loop.map((p) => {
    const r = p.clone().sub(centroid);
    // Remove faceNormal component so offset stays in the seal plane
    r.addScaledVector(faceNormal, -r.dot(faceNormal));
    const len = r.length();
    return len > 1e-6
      ? r.multiplyScalar(halfWall / len)
      : new THREE.Vector3(halfWall, 0, 0);
  });
}

/**
 * Builds a solid quad-tube band between glassesEdge and faceEdge.
 * Each quad cross-section has four walls:
 *   - outer wall  (faces away from loop centroid)
 *   - inner wall  (faces toward loop centroid)
 *   - glasses cap (faces away from face, closes the frame-side edge)
 *   - face cap    (faces toward face, closes the face-side edge)
 *
 * Vertex layout (4n total):
 *   0   .. n-1  : outer glasses edge
 *   n   .. 2n-1 : inner glasses edge
 *   2n  .. 3n-1 : outer face edge
 *   3n  .. 4n-1 : inner face edge
 */
function buildThickBand(glassesEdge, faceEdge, faceNormal, wallThickness) {
  const n = Math.min(glassesEdge.length, faceEdge.length);
  if (n < 3) return null;

  const offsets = radialOffsets(glassesEdge, faceNormal, wallThickness / 2);

  const og  = glassesEdge.map((p, i) => p.clone().add(offsets[i]));   // outer glasses
  const ig  = glassesEdge.map((p, i) => p.clone().sub(offsets[i]));   // inner glasses
  const of_ = faceEdge.map((p, i)    => p.clone().add(offsets[i]));   // outer face
  const if_ = faceEdge.map((p, i)    => p.clone().sub(offsets[i]));   // inner face

  const positions = new Float32Array(n * 4 * 3);
  const set = (idx, v) => {
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

  const indices = [];
  const isClosedLoop = glassesEdge[0].distanceTo(glassesEdge[n - 1]) < 0.1;
  const segs = isClosedLoop ? n : n - 1;

  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n;

    // Outer wall (normal points outward from centroid)
    indices.push(i,      j,      2*n+i);
    indices.push(j,      2*n+j,  2*n+i);

    // Inner wall (normal points inward toward centroid)
    indices.push(n+i,    3*n+i,  n+j);
    indices.push(n+j,    3*n+i,  3*n+j);

    // Glasses-side cap (normal points away from face)
    indices.push(i,      n+i,    j);
    indices.push(n+i,    n+j,    j);

    // Face-side cap (normal points toward face)
    indices.push(2*n+i,  2*n+j,  3*n+i);
    indices.push(2*n+j,  3*n+j,  3*n+i);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ~5mm depth toward face, ~0.9mm wall thickness (at glasses scale 0.01)
const SEAL_DEPTH      = 0.05;
const WALL_THICKNESS  = 0.009;

export function generateSeal(worldSealPath, faceNormal) {
  if (!worldSealPath || worldSealPath.length < 3) return null;
  const faceEdge = extrudeAlongNormal(worldSealPath, faceNormal, SEAL_DEPTH);
  return buildThickBand(worldSealPath, faceEdge, faceNormal, WALL_THICKNESS);
}

function mergeGeos(geos) {
  const valid = geos.filter(Boolean);
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];

  const totalVerts = valid.reduce((s, g) => s + g.attributes.position.count, 0);
  const positions = new Float32Array(totalVerts * 3);
  const indices = [];
  let vertOffset = 0, posOffset = 0;
  for (const g of valid) {
    positions.set(g.attributes.position.array, posOffset);
    for (const idx of g.index.array) indices.push(idx + vertOffset);
    vertOffset += g.attributes.position.count;
    posOffset  += g.attributes.position.array.length;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  return merged;
}

export function generateDualSeal(leftPath, rightPath, faceNormal) {
  return mergeGeos([
    leftPath?.length  >= 3 ? generateSeal(leftPath,  faceNormal) : null,
    rightPath?.length >= 3 ? generateSeal(rightPath, faceNormal) : null,
  ]);
}
