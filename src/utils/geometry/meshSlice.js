import * as THREE from "three";

// ---------------------------------------------------------------------------
// Z-plane cross-section
// ---------------------------------------------------------------------------

/**
 * Slices a BufferGeometry at a given Z value.
 * Returns an array of closed loops, each an ordered array of Vector3.
 * Largest loop = outer frame perimeter. Smaller loops = lens holes.
 */
export function sliceGeometryAtZ(geometry, z, epsilon = 0.01) {
  const segments = extractSegments(geometry, z);
  if (segments.length === 0) return [];
  return connectSegments(segments, epsilon);
}

/**
 * Scans from bb.max.z inward in steps until the largest loop spans at least
 * minXFraction of the geometry's total X range. Returns { z, loops }.
 * This handles glasses models where only hinges protrude to bb.max.z.
 */
/**
 * Scans Z depths to find the best cross-section. Returns { z, loops, quality }
 * where quality is 'good' (single outer loop spans the frame) or 'partial'
 * (fragmented — use extractSilhouettePath instead of extractSealPath).
 */
export function findBestSliceZ(geometry, epsilon = 0.5, minXFraction = 0.7) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const totalXSpan = max.x - min.x;
  const centerX = (min.x + max.x) / 2;
  const depth = max.z - min.z;
  const step = Math.max(0.5, depth * 0.04);

  let bestPartial = null;
  let bestPartialPts = 0;

  for (let d = 0; d <= depth * 0.95; d += step) {
    const z = max.z - d;
    const loops = sliceGeometryAtZ(geometry, z, epsilon);
    if (loops.length === 0) continue;

    const totalPts = loops.reduce((s, l) => s + l.length, 0);
    if (totalPts > bestPartialPts) {
      bestPartialPts = totalPts;
      bestPartial = { z, loops, quality: "partial" };
    }

    const sorted = [...loops].sort((a, b) => bboxArea(b) - bboxArea(a));
    const xs = sorted[0].map((p) => p.x);
    const outerMin = Math.min(...xs), outerMax = Math.max(...xs);
    const outerXSpan = outerMax - outerMin;
    const spansBothSides =
      outerMin < centerX - totalXSpan * 0.2 &&
      outerMax > centerX + totalXSpan * 0.2;
    if (outerXSpan >= totalXSpan * minXFraction && spansBothSides) {
      return { z, loops, quality: "good" };
    }
  }

  return bestPartial; // fragmented but still useful for silhouette extraction
}

function centroidX(loop) {
  return loop.reduce((s, p) => s + p.x, 0) / loop.length;
}

/**
 * Splits inner lens loops by eye (left centroid vs right centroid) and
 * silhouettes each eye independently. Returns { leftPath, rightPath }.
 * Both paths are in the same local space as the input loops.
 */
export function extractPerEyePaths(loops, numAngles = 120) {
  if (!loops || loops.length < 2) return null;
  const sorted = [...loops].sort((a, b) => bboxArea(b) - bboxArea(a));
  const maxArea = bboxArea(sorted[0]);
  // Keep only inner loops: smaller than half the outer frame, but not tiny noise
  const inner = sorted.filter((l) => bboxArea(l) < maxArea * 0.5 && bboxArea(l) > 100);
  if (inner.length === 0) return null;

  const leftLoops  = inner.filter((l) => centroidX(l) < 0);
  const rightLoops = inner.filter((l) => centroidX(l) >= 0);

  return {
    leftPath:  leftLoops.length  > 0 ? extractSilhouettePath(leftLoops,  numAngles) : null,
    rightPath: rightLoops.length > 0 ? extractSilhouettePath(rightLoops, numAngles) : null,
  };
}

/**
 * Builds the outer silhouette from all points across all loops by sampling
 * the farthest point per angle. Works on fragmented cross-sections where no
 * single loop traces the full perimeter. Result is the convex boundary of
 * the cross-section — equivalent to the outer envelope of the frame.
 */
export function extractSilhouettePath(loops, numAngles = 180) {
  if (!loops || loops.length === 0) return null;
  const all = loops.flat();
  if (all.length < 3) return null;

  const cx = all.reduce((s, p) => s + p.x, 0) / all.length;
  const cy = all.reduce((s, p) => s + p.y, 0) / all.length;
  const z = all[0].z;

  const result = [];
  for (let i = 0; i < numAngles; i++) {
    const angle = (i / numAngles) * Math.PI * 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    let maxProj = -Infinity, best = null;
    for (const p of all) {
      const proj = (p.x - cx) * cos + (p.y - cy) * sin;
      if (proj > maxProj) { maxProj = proj; best = p; }
    }
    if (best) result.push(new THREE.Vector3(best.x, best.y, z));
  }

  // Deduplicate consecutive identical points
  const deduped = [result[0]];
  for (let i = 1; i < result.length; i++) {
    if (!result[i].equals(deduped[deduped.length - 1])) deduped.push(result[i]);
  }

  return deduped.length >= 3 ? deduped : null;
}

function extractSegments(geometry, z) {
  const pos = geometry.attributes.position;
  const segments = [];

  for (let i = 0; i < pos.count; i += 3) {
    const v = [0, 1, 2].map((j) =>
      new THREE.Vector3(pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j))
    );

    const above = v.map((p) => p.z >= z);
    const aboveCount = above.filter(Boolean).length;
    if (aboveCount === 0 || aboveCount === 3) continue;

    const pts = [];
    for (let a = 0; a < 3; a++) {
      const b = (a + 1) % 3;
      if (above[a] !== above[b]) {
        const va = v[a], vb = v[b];
        const t = (z - va.z) / (vb.z - va.z);
        pts.push(
          new THREE.Vector3(
            va.x + t * (vb.x - va.x),
            va.y + t * (vb.y - va.y),
            z
          )
        );
      }
    }

    if (pts.length === 2) segments.push(pts);
  }

  return segments;
}

function connectSegments(segments, epsilon) {
  const used = new Array(segments.length).fill(false);
  const loops = [];

  for (let startI = 0; startI < segments.length; startI++) {
    if (used[startI]) continue;

    const loop = [segments[startI][0].clone(), segments[startI][1].clone()];
    used[startI] = true;

    let extended = true;
    while (extended) {
      extended = false;
      const tail = loop[loop.length - 1];

      for (let i = 0; i < segments.length; i++) {
        if (used[i]) continue;
        const [a, b] = segments[i];

        if (tail.distanceTo(a) < epsilon) {
          loop.push(b.clone());
          used[i] = true;
          extended = true;
          break;
        } else if (tail.distanceTo(b) < epsilon) {
          loop.push(a.clone());
          used[i] = true;
          extended = true;
          break;
        }
      }
    }

    if (
      loop.length > 2 &&
      loop[0].distanceTo(loop[loop.length - 1]) < epsilon
    ) {
      loop.pop();
    }

    if (loop.length >= 3) loops.push(loop);
  }

  return loops;
}

// ---------------------------------------------------------------------------
// Seal path extraction from loops
// ---------------------------------------------------------------------------

function bboxArea(loop) {
  const xs = loop.map((p) => p.x);
  const ys = loop.map((p) => p.y);
  return (
    (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
  );
}

/**
 * Given loops from sliceGeometryAtZ, returns an ordered array of local-space
 * Vector3 tracing the glasses frame perimeter (temples trimmed).
 * Returns null if extraction fails.
 */
export function extractSealPath(loops) {
  if (!loops || loops.length === 0) return null;

  const sorted = [...loops].sort((a, b) => bboxArea(b) - bboxArea(a));
  sorted.forEach((l, i) => {
    const xs = l.map(p => p.x), ys = l.map(p => p.y);
    console.log(`[loop ${i}] pts:${l.length} area:${bboxArea(l).toFixed(0)} x:[${Math.min(...xs).toFixed(1)},${Math.max(...xs).toFixed(1)}] y:[${Math.min(...ys).toFixed(1)},${Math.max(...ys).toFixed(1)}]`);
  });

  const outer = sorted[0];
  const inner = sorted.slice(1).filter((l) => l.length >= 3);

  // Determine temple trim bounds from inner lens loops.
  // If no inner loops found, use 70% of the outer loop's X range.
  let trimMinX, trimMaxX;
  if (inner.length > 0) {
    const allInner = inner.flat();
    const margin = 8; // mm past the lens outer edge
    trimMinX = Math.min(...allInner.map((p) => p.x)) - margin;
    trimMaxX = Math.max(...allInner.map((p) => p.x)) + margin;
  } else {
    const xs = outer.map((p) => p.x);
    const span = Math.max(...xs) - Math.min(...xs);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    trimMinX = cx - span * 0.7;
    trimMaxX = cx + span * 0.7;
  }

  // Find the contiguous arc of the outer loop within the trim X range.
  // Walk the loop to find the longest contiguous run of in-range points.
  const n = outer.length;
  const inRange = outer.map((p) => p.x >= trimMinX && p.x <= trimMaxX);

  // Find start of longest contiguous run
  let bestStart = 0, bestLen = 0, curStart = 0, curLen = 0;
  for (let i = 0; i < n * 2; i++) {
    if (inRange[i % n]) {
      if (curLen === 0) curStart = i % n;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curLen = 0;
    }
    if (curLen >= n) break; // full loop is in range
  }

  if (bestLen < 3) return null;

  const path = [];
  for (let i = 0; i < bestLen; i++) {
    path.push(outer[(bestStart + i) % n].clone());
  }

  return downsample(path, 100);
}

/**
 * Reduces a point array to at most maxPoints, evenly spaced by index.
 */
function downsample(points, maxPoints) {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const result = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(points[Math.round(i * step)]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Measurement extraction (feeds Tier 3 parametric as byproduct of Tier 2)
// ---------------------------------------------------------------------------

/**
 * Attempts to extract lens measurements from cross-section loops.
 * Returns { lensWidth, lensHeight, bridgeWidth } or null.
 */
export function extractMeasurements(loops) {
  if (!loops || loops.length < 3) return null;

  const sorted = [...loops].sort((a, b) => bboxArea(b) - bboxArea(a));
  const inner = sorted.slice(1).filter((l) => {
    const xs = l.map((p) => p.x);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    return Math.abs(cx) > 5; // off-center → likely a lens hole
  });

  if (inner.length < 2) return null;

  inner.sort((a, b) => {
    const cx = (l) =>
      (Math.max(...l.map((p) => p.x)) + Math.min(...l.map((p) => p.x))) / 2;
    return cx(a) - cx(b);
  });

  const left = inner[0];
  const right = inner[inner.length - 1];

  const lensWidth =
    Math.max(...left.map((p) => p.x)) - Math.min(...left.map((p) => p.x));
  const lensHeight =
    Math.max(...left.map((p) => p.y)) - Math.min(...left.map((p) => p.y));
  const bridgeWidth =
    Math.min(...right.map((p) => p.x)) - Math.max(...left.map((p) => p.x));

  if (lensWidth <= 0 || lensHeight <= 0) return null;

  return { lensWidth, lensHeight, bridgeWidth: Math.max(bridgeWidth, 1) };
}
