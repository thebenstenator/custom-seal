import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { DEFAULT_SEAL_LOOP } from "./hardpoints";

/**
 * Builds a BVH accelerator on a face mesh geometry.
 * Call once after loading the face mesh; store the result.
 */
export function buildFaceBVH(geometry) {
  geometry.computeVertexNormals();
  return new MeshBVH(geometry);
}

/**
 * For each hardpoint in world space, cast a ray toward the face mesh center
 * and return the surface intersection point. Points with no hit are skipped.
 */
function castHardpointsToFace(worldHardpoints, sealLoop, faceMesh, bvh) {
  const faceCenter = new THREE.Vector3();
  faceMesh.geometry.computeBoundingBox();
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
    if (hits.length > 0) {
      surfacePoints.push(hits[0].point.clone());
    } else {
      // No hit — use the hardpoint itself as a fallback so the loop stays closed
      surfacePoints.push(origin.clone());
    }
  }

  return surfacePoints;
}

/**
 * Generates a seal mesh (TubeGeometry) from world-space hardpoints + face mesh.
 *
 * Returns a THREE.BufferGeometry, or null if fewer than 3 points were resolved.
 */
export function generateSeal(worldHardpoints, faceMesh, bvh, options = {}) {
  const {
    sealLoop = DEFAULT_SEAL_LOOP,
    tubeRadius = 0.03,      // ~3mm wall in scene units
    tubularSegments = 64,
    radialSegments = 8,
  } = options;

  const surfacePoints = castHardpointsToFace(
    worldHardpoints,
    sealLoop,
    faceMesh,
    bvh,
  );

  if (surfacePoints.length < 3) return null;

  const curve = new THREE.CatmullRomCurve3(surfacePoints, true /* closed */);
  const geometry = new THREE.TubeGeometry(
    curve,
    tubularSegments,
    tubeRadius,
    radialSegments,
    true, /* closed */
  );

  return geometry;
}
