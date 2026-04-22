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

/**
 * Offsets each point by a fixed depth along faceNormal.
 * Used as the face-side edge of the seal until real face scans are available,
 * at which point this should be replaced with raycasting against the scan mesh.
 */
function extrudeAlongNormal(worldPath, faceNormal, depth) {
  return worldPath.map((p) => p.clone().addScaledVector(faceNormal, depth));
}

/**
 * Builds a ruled-surface quad strip between two ordered point arrays
 * (glassesEdge and faceEdge). The result is the seal wall — one edge
 * on the glasses frame, the other contacting the face.
 */
function buildRuledSurface(glassesEdge, faceEdge) {
  const n = Math.min(glassesEdge.length, faceEdge.length);
  const positions = new Float32Array(n * 2 * 3);
  const indices = [];

  for (let i = 0; i < n; i++) {
    const g = glassesEdge[i];
    const f = faceEdge[i];
    positions[(i * 2 + 0) * 3 + 0] = g.x;
    positions[(i * 2 + 0) * 3 + 1] = g.y;
    positions[(i * 2 + 0) * 3 + 2] = g.z;
    positions[(i * 2 + 1) * 3 + 0] = f.x;
    positions[(i * 2 + 1) * 3 + 1] = f.y;
    positions[(i * 2 + 1) * 3 + 2] = f.z;
  }

  for (let i = 0; i < n - 1; i++) {
    const g0 = i * 2,     f0 = i * 2 + 1;
    const g1 = (i+1)*2,   f1 = (i+1)*2 + 1;
    indices.push(g0, f0, g1);
    indices.push(f0, f1, g1);
  }

  // Only close the loop if the path endpoints are nearly coincident (closed loop,
  // not a temple-trimmed open arc — open arcs closing creates a spike).
  const isClosedLoop = glassesEdge[0].distanceTo(glassesEdge[n - 1]) < 0.1;
  if (isClosedLoop) {
    const g0 = (n-1)*2, f0 = (n-1)*2+1, g1 = 0, f1 = 1;
    indices.push(g0, f0, g1);
    indices.push(f0, f1, g1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates the seal wall geometry.
 *
 * @param {THREE.Vector3[]} worldSealPath - ordered world-space points on
 *   the glasses frame edge (output of any of the three pipeline tiers).
 * @param {THREE.Mesh} faceMesh - the head mesh (must have boundsTree built).
 * @returns {THREE.BufferGeometry | null}
 */
const SEAL_DEPTH = 0.05; // ~5 mm at glasses scale 0.01

export function generateSeal(worldSealPath, faceNormal) {
  if (!worldSealPath || worldSealPath.length < 3) return null;
  const faceEdge = extrudeAlongNormal(worldSealPath, faceNormal, SEAL_DEPTH);
  return buildRuledSurface(worldSealPath, faceEdge);
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
    posOffset += g.attributes.position.array.length;
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
