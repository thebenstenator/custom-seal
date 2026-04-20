import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { DEFAULT_SEAL_LOOP } from "./hardpoints";

/**
 * Assigns a BVH to the geometry so Three.js's patched raycast uses it.
 * Call once after loading the face mesh. Safe to call multiple times (no-op if already built).
 */
export function buildFaceBVH(geometry) {
  if (geometry.boundsTree) return;
  geometry.computeVertexNormals();
  geometry.boundsTree = new MeshBVH(geometry);
}

/**
 * For each hardpoint in world space, cast a ray toward the face mesh center
 * and return the surface intersection point. Falls back to the hardpoint
 * position itself if no hit is found (keeps the loop closed).
 */
function castHardpointsToFace(worldHardpoints, sealLoop, faceMesh) {
  const faceCenter = new THREE.Vector3();
  faceMesh.geometry.boundingBox.getCenter(faceCenter);
  faceCenter.applyMatrix4(faceMesh.matrixWorld);

  const raycaster = new THREE.Raycaster();
  const surfacePoints = [];

  for (const name of sealLoop) {
    const origin = worldHardpoints[name];
    if (!origin) continue;

    const dir = new THREE.Vector3().subVectors(faceCenter, origin).normalize();
    raycaster.set(origin, dir);

    const hits = raycaster.intersectObject(faceMesh, false);
    surfacePoints.push(hits.length > 0 ? hits[0].point.clone() : origin.clone());
  }

  return surfacePoints;
}

/**
 * Generates a seal mesh (TubeGeometry) from world-space hardpoints + face mesh.
 * Assumes buildFaceBVH has already been called on faceMesh.geometry.
 * Returns a THREE.BufferGeometry, or null if fewer than 3 points resolved.
 */
export function generateSeal(worldHardpoints, faceMesh, options = {}) {
  const {
    sealLoop = DEFAULT_SEAL_LOOP,
    tubeRadius = 0.03,
    tubularSegments = 64,
    radialSegments = 8,
  } = options;

  const surfacePoints = castHardpointsToFace(worldHardpoints, sealLoop, faceMesh);
  if (surfacePoints.length < 3) return null;

  const curve = new THREE.CatmullRomCurve3(surfacePoints, true);
  return new THREE.TubeGeometry(curve, tubularSegments, tubeRadius, radialSegments, true);
}
