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
  if (!loops || loops.length === 0) return null;
  const sorted = [...loops].sort((a, b) => bboxArea(b) - bboxArea(a));
  const maxArea = bboxArea(sorted[0]);

  console.log(
    "[Tier2 loops]",
    sorted.map((l, i) =>
      `#${i} pts=${l.length} area=${bboxArea(l).toFixed(0)} cx=${centroidX(l).toFixed(1)}`
    ).join(" | ")
  );

  // Standard case: combined outer frame with identifiable inner lens holes
  // (inner = area < 50% of largest loop, substantial enough not to be noise)
  const inner = sorted.filter((l) => bboxArea(l) < maxArea * 0.5 && bboxArea(l) > 100);

  if (inner.length > 0) {
    const leftLoops  = inner.filter((l) => centroidX(l) < 0);
    const rightLoops = inner.filter((l) => centroidX(l) >= 0);
    console.log("[Tier2 split] inner found:", inner.length, "→ left:", leftLoops.length, "right:", rightLoops.length);
    return {
      leftPath:  leftLoops.length  > 0 ? extractSilhouettePath(leftLoops,  numAngles) : null,
      rightPath: rightLoops.length > 0 ? extractSilhouettePath(rightLoops, numAngles) : null,
    };
  }

  // Fallback: no combined outer frame. Filter noise first, then split per-eye.
  // Noise loops have area≈0 or very few points (mesh intersection artifacts).
  const valid = sorted.filter((l) => l.length >= 5 && bboxArea(l) > 10);
  let leftLoops  = valid.filter((l) => centroidX(l) < 0);
  let rightLoops = valid.filter((l) => centroidX(l) >= 0);

  if (leftLoops.length === 0 || rightLoops.length === 0) {
    // All loops on one side — split individual points by X
    const allPts   = valid.flat();
    const leftPts  = allPts.filter((p) => p.x < 0);
    const rightPts = allPts.filter((p) => p.x >= 0);
    console.log("[Tier2 split] inner: 0 → point-split left:", leftPts.length, "right:", rightPts.length);
    return {
      leftPath:  leftPts.length  > 5 ? extractSilhouettePath([leftPts],  numAngles) : null,
      rightPath: rightPts.length > 5 ? extractSilhouettePath([rightPts], numAngles) : null,
    };
  }

  // Distinct loops per eye — use the largest loop for each eye directly.
  // Using loops directly gives far better resolution than silhouette extraction,
  // which collapses to very few points when source density is low.
  const pickBest = (ls) => {
    const best = [...ls].sort((a, b) => bboxArea(b) - bboxArea(a))[0];
    return downsample(best, 100);
  };

  console.log("[Tier2 split] inner: 0 → direct loops: left:", leftLoops.length, "right:", rightLoops.length);
  return {
    leftPath:  leftLoops.length  > 0 ? pickBest(leftLoops)  : null,
    rightPath: rightLoops.length > 0 ? pickBest(rightLoops) : null,
  };
}

/**
 * Builds the INNER silhouette from a point cloud — for each angle, picks the
 * NEAREST point (above a small threshold) from the centroid rather than the
 * farthest. For a ring of frame material whose centroid sits inside the lens
 * aperture, this gives the inner aperture boundary rather than the outer frame.
 */
export function extractInnerSilhouettePath(pointClouds, numAngles = 180, minFraction = 0.05) {
  const all = pointClouds.flat();
  if (all.length < 3) return null;

  const cx = all.reduce((s, p) => s + p.x, 0) / all.length;
  const cy = all.reduce((s, p) => s + p.y, 0) / all.length;
  const z = all[0].z;

  // Average radius sets the minimum threshold (excludes points at the centroid)
  let sumR = 0;
  for (const p of all) {
    const dx = p.x - cx, dy = p.y - cy;
    sumR += Math.sqrt(dx * dx + dy * dy);
  }
  const minThreshold = (sumR / all.length) * minFraction;

  const result = [];
  for (let i = 0; i < numAngles; i++) {
    const angle = (i / numAngles) * Math.PI * 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    let minProj = Infinity, best = null;
    for (const p of all) {
      const proj = (p.x - cx) * cos + (p.y - cy) * sin;
      if (proj >= minThreshold && proj < minProj) { minProj = proj; best = p; }
    }
    if (best) result.push(new THREE.Vector3(best.x, best.y, z));
  }

  if (result.length === 0) return null;
  const deduped = [result[0]];
  for (let i = 1; i < result.length; i++) {
    if (!result[i].equals(deduped[deduped.length - 1])) deduped.push(result[i]);
  }
  return deduped.length >= 3 ? deduped : null;
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
// Open boundary edge detection (works on surface/shell meshes)
// ---------------------------------------------------------------------------

/**
 * Finds all open boundary loops in a geometry — edges shared by exactly one
 * triangle. On a glasses-frame surface mesh these are the outer perimeter
 * and the inner lens-aperture perimeters. Returns ordered loops of Vector3.
 */
export function findOpenBoundaryLoops(geometry, epsilon = 0.5) {
  const pos = geometry.attributes.position;
  const n = pos.count;

  // Deduplicate vertices (STL is non-indexed — each triangle stores 3 explicit verts)
  const vertMap = new Map();
  const dedupVerts = [];
  const vidx = new Int32Array(n);

  for (let i = 0; i < n; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!vertMap.has(key)) {
      vertMap.set(key, dedupVerts.length);
      dedupVerts.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
    vidx[i] = vertMap.get(key);
  }

  // Count how many triangles each edge belongs to
  const edgeUse = new Map();
  const edgeEnds = new Map();

  for (let i = 0; i < n; i += 3) {
    const a = vidx[i], b = vidx[i + 1], c = vidx[i + 2];
    for (const [v0, v1] of [[a, b], [b, c], [c, a]]) {
      const lo = Math.min(v0, v1), hi = Math.max(v0, v1);
      const key = `${lo},${hi}`;
      edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
      if (!edgeEnds.has(key)) edgeEnds.set(key, [v0, v1]);
    }
  }

  // Collect boundary edge segments (used by exactly 1 triangle)
  const segs = [];
  for (const [key, count] of edgeUse) {
    if (count === 1) {
      const [v0, v1] = edgeEnds.get(key);
      segs.push([dedupVerts[v0].clone(), dedupVerts[v1].clone()]);
    }
  }

  if (segs.length === 0) return [];
  console.log("[boundary] boundary edge segments:", segs.length);
  return connectSegments(segs, epsilon);
}

// ---------------------------------------------------------------------------
// Face-contact surface boundary detection (curved solid frames)
// ---------------------------------------------------------------------------

/**
 * Finds boundary loops of the face-contact surface on a solid glasses frame.
 * Classifies each triangle as face-contact when its normal opposes cnAligned
 * (i.e. it points toward the head). Boundary edges of those triangles — shared
 * by exactly one face-contact triangle — form the outer frame perimeter and
 * the inner lens-aperture perimeters. Works regardless of frame curvature.
 */
export function extractFaceContactLoops(geometry, cnAligned, threshold = 0.25, epsilon = 0.5) {
  const pos = geometry.attributes.position;
  const n = pos.count;
  const cn = cnAligned.clone().normalize();

  // Deduplicate vertices (STL/non-indexed geometry stores every vertex explicitly)
  const vertMap = new Map();
  const dedupVerts = [];
  const vidx = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!vertMap.has(key)) {
      vertMap.set(key, dedupVerts.length);
      dedupVerts.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
    vidx[i] = vertMap.get(key);
  }

  // For each face-contact triangle, count how many face-contact triangles share each edge
  const edgeUse = new Map();
  const edgeEnds = new Map();
  let fcCount = 0;

  for (let t = 0; t < n; t += 3) {
    const ai = vidx[t], bi = vidx[t + 1], ci = vidx[t + 2];
    const a = dedupVerts[ai], b = dedupVerts[bi], c = dedupVerts[ci];

    // Triangle normal via cross product
    const e1x = b.x - a.x, e1y = b.y - a.y, e1z = b.z - a.z;
    const e2x = c.x - a.x, e2y = c.y - a.y, e2z = c.z - a.z;
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (nLen < 1e-10) continue;
    nx /= nLen; ny /= nLen; nz /= nLen;

    // Face-contact: normal agrees with cnAligned (both point toward head).
    // cnAligned points toward the head, so face-contact surface normals
    // have a POSITIVE dot product with it (same direction, not opposite).
    if (nx * cn.x + ny * cn.y + nz * cn.z <= threshold) continue;
    fcCount++;

    for (const [v0i, v1i] of [[ai, bi], [bi, ci], [ci, ai]]) {
      const lo = Math.min(v0i, v1i), hi = Math.max(v0i, v1i);
      const key = `${lo},${hi}`;
      edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
      if (!edgeEnds.has(key)) edgeEnds.set(key, [v0i, v1i]);
    }
  }

  // Boundary edges: shared by exactly one face-contact triangle
  const segs = [];
  for (const [key, count] of edgeUse) {
    if (count === 1) {
      const [v0i, v1i] = edgeEnds.get(key);
      segs.push([dedupVerts[v0i].clone(), dedupVerts[v1i].clone()]);
    }
  }

  console.log("[faceContact] face-contact tris:", fcCount, "/ boundary segs:", segs.length);
  if (segs.length === 0) return [];
  return connectSegments(segs, epsilon);
}

// ---------------------------------------------------------------------------
// Aggregate cross-section approach (handles curved/wrapped frames)
// ---------------------------------------------------------------------------

/**
 * Scans every Z depth, collects per-eye boundary points from each slice,
 * projects them all to Z = max.z, then extracts the silhouette for each eye.
 * A single Z cross-section only captures the portion of the rim at that depth;
 * aggregating all depths gives the complete outline regardless of curvature.
 *
 * cnAligned: the corrected face-away-from-head normal in aligned local space.
 * When provided, Strategy 0 (face-contact surface boundary) is tried first —
 * it directly traces the frame's face-contact edge regardless of curvature.
 * geometry must be aligned so face axis = Z (widest horizontal = X).
 */
export function extractPerEyeAggregate(geometry, numAngles = 120, epsilon = 0.5, cnAligned = null) {
  // ── Strategy 0: face-contact surface boundary ────────────────────────────
  // Find triangles whose normals face the head and trace their boundary edges.
  // This works for any curvature — no Z-slicing assumptions needed.
  if (cnAligned) {
    const fcLoops = extractFaceContactLoops(geometry, cnAligned, 0.25, epsilon);
    if (fcLoops.length >= 2) {
      const sorted = [...fcLoops].sort((a, b) => bboxArea(b) - bboxArea(a));
      console.log(
        "[aggregate S0] face-contact loops:",
        sorted.map((l, i) =>
          `#${i} pts=${l.length} area=${bboxArea(l).toFixed(0)} cx=${centroidX(l).toFixed(1)}`
        ).join(" | ")
      );

      // Outer perimeter is the largest loop. Inner lens apertures are smaller.
      const maxArea = bboxArea(sorted[0]);
      const candidates = sorted.filter(l => l.length >= 4 && bboxArea(l) > 20);
      const inner = candidates.filter(l => bboxArea(l) < maxArea * 0.85);
      // Fall back to all candidates if we can't clearly identify inner loops
      const pool = inner.length >= 2 ? inner : candidates;

      const leftLoops  = pool.filter(l => centroidX(l) < -2);
      const rightLoops = pool.filter(l => centroidX(l) >  2);

      if (leftLoops.length > 0 && rightLoops.length > 0) {
        // 1 mm outward offset so the seal sits on the frame material,
        // not at the sharp inner edge of the lens aperture.
        const SEAL_OUTSET_MM = 1.0;
        const pickBest = (ls) => {
          const raw = [...ls].sort((a, b) => bboxArea(b) - bboxArea(a))[0];
          return downsample(expandLoopOutward(raw, SEAL_OUTSET_MM), 120);
        };
        console.log("[aggregate S0] left pts:", leftLoops[0].length, "right pts:", rightLoops[0].length);
        return {
          leftPath:  pickBest(leftLoops),
          rightPath: pickBest(rightLoops),
          skipZRemap: true, // points already sit on the face-contact surface
        };
      }
    }
  }

  // ── Strategy 1: open boundary edge detection ────────────────────────────
  // Lens apertures are always open boundaries on a surface/shell mesh.
  // This is more accurate than Z-slicing for wrapped/curved frames.
  const boundaryLoops = findOpenBoundaryLoops(geometry, epsilon);
  if (boundaryLoops.length > 0) {
    const sorted = [...boundaryLoops].sort((a, b) => bboxArea(b) - bboxArea(a));
    console.log(
      "[aggregate] boundary loops:",
      sorted.map((l, i) =>
        `#${i} pts=${l.length} area=${bboxArea(l).toFixed(0)} cx=${centroidX(l).toFixed(1)}`
      ).join(" | ")
    );

    // The outer-frame perimeter (if present) spans the full width and has
    // centroidX ≈ 0. Lens apertures sit clearly off-center on each side.
    // Pick the loop with the most extreme centroidX for each eye.
    const candidates = sorted.filter(l => bboxArea(l) > 50);
    const leftLoops  = candidates.filter(l => centroidX(l) < -1);
    const rightLoops = candidates.filter(l => centroidX(l) >  1);

    if (leftLoops.length > 0 && rightLoops.length > 0) {
      geometry.computeBoundingBox();
      const sealZ = geometry.boundingBox.max.z; // Z remapped by caller anyway
      // Among loops on each side, pick the one most extreme (farthest from center)
      const pickEye = (ls, sign) =>
        [...ls].sort((a, b) => sign * (centroidX(b) - centroidX(a)))[0];
      const leftBest  = pickEye(leftLoops,  -1);
      const rightBest = pickEye(rightLoops,  1);
      console.log("[aggregate] boundary path: left pts:", leftBest.length,
        "right pts:", rightBest.length);
      return {
        leftPath:  downsample(leftBest.map(p  => new THREE.Vector3(p.x,  p.y,  sealZ)), 120),
        rightPath: downsample(rightBest.map(p => new THREE.Vector3(p.x,  p.y,  sealZ)), 120),
      };
    }
  }

  // ── Strategy 2: Z-slice outer rims → lens centers → normal filter ───────
  // Inner hole-wall triangles have normals pointing TOWARD the lens center;
  // outer frame and face-surface triangles point outward or in Z.
  // Filter by that dot product, then take the outer silhouette of the
  // surviving (inner-wall) vertices → inner aperture boundary.

  // 2a — Outer rim Z-slices to find per-eye lens centers
  geometry.computeBoundingBox();
  const { max } = geometry.boundingBox;
  const depth = max.z - geometry.boundingBox.min.z;
  const step = Math.max(0.5, depth * 0.04);
  const sealZ = max.z;

  const leftRim = [], rightRim = [];
  for (let d = 0; d <= depth * 0.95; d += step) {
    const z = max.z - d;
    const loops = sliceGeometryAtZ(geometry, z, epsilon);
    if (loops.length === 0) continue;
    const sorted = [...loops].sort((a, b) => bboxArea(b) - bboxArea(a));
    const valid = sorted.filter(l => l.length >= 5 && bboxArea(l) > 10);
    for (const loop of valid.slice(0, 4)) {
      for (const p of loop) { (p.x < 0 ? leftRim : rightRim).push(p); }
    }
  }

  if (leftRim.length < 3 || rightRim.length < 3) return { leftPath: null, rightPath: null };

  const mean2d = (pts) => ({
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  });
  const lc = mean2d(leftRim);
  const rc = mean2d(rightRim);
  console.log("[aggregate] lens centers L(", lc.x.toFixed(1), lc.y.toFixed(1),
    ") R(", rc.x.toFixed(1), rc.y.toFixed(1), ")");

  // 2b — Normal-direction filter: keep vertices whose normals point toward
  //      their eye's lens center (inner hole-wall vertices)
  // 2b — Normal-direction filter: keep vertices whose normals point toward
  //      their eye's lens center (inner hole-wall vertices).
  //      For curved frames the inner-wall normal can be heavily tilted in Z,
  //      so we normalize only the XY component before the dot product — this
  //      asks "does the XY part of this normal point toward the lens center?"
  //      regardless of how much the face tilts.
  geometry.computeVertexNormals();
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const leftWall = [], rightWall = [];

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const nx = nrm.getX(i), ny = nrm.getY(i);
    // Skip vertices whose normals are almost purely in Z — those are face /
    // back surfaces, not hole walls, and have no useful XY inward component.
    const nXYlen = Math.sqrt(nx * nx + ny * ny);
    if (nXYlen < 0.15) continue;
    const isLeft = x < 0;
    const { x: lcx, y: lcy } = isLeft ? lc : rc;
    const dx = lcx - x, dy = lcy - y;
    const dirLen = Math.sqrt(dx * dx + dy * dy);
    if (dirLen < 0.5) continue;
    // Normalized XY dot product — independent of Z-tilt of the wall
    const dot = (nx * dx + ny * dy) / (nXYlen * dirLen);
    if (dot > 0.3) {
      (isLeft ? leftWall : rightWall).push(new THREE.Vector3(x, y, sealZ));
    }
  }

  console.log("[aggregate] inner-wall verts: left:", leftWall.length, "right:", rightWall.length);

  if (leftWall.length > 10 && rightWall.length > 10) {
    return {
      leftPath:  extractSilhouettePath([leftWall],  numAngles),
      rightPath: extractSilhouettePath([rightWall], numAngles),
    };
  }

  // 2c — Normal filter found too few verts (e.g. very smooth mesh with no
  //      distinct hole-wall faces). Fall back: outer silhouette of all
  //      per-eye vertices, re-centered on the known lens center so the
  //      silhouette stays meaningful even when the centroid drifts.
  console.log("[aggregate] falling back to outer silhouette from rim loops");
  return {
    leftPath:  extractSilhouettePath([leftRim],  numAngles),
    rightPath: extractSilhouettePath([rightRim], numAngles),
  };
}

// ---------------------------------------------------------------------------
// Seal path extraction from loops
// ---------------------------------------------------------------------------

/**
 * Expands every point in a loop radially outward from its XY centroid by
 * `amount` units, keeping Z unchanged. Used to offset a lens-aperture boundary
 * loop outward onto the frame material so the seal overlaps the frame.
 */
function expandLoopOutward(loop, amount) {
  const cx = loop.reduce((s, p) => s + p.x, 0) / loop.length;
  const cy = loop.reduce((s, p) => s + p.y, 0) / loop.length;
  return loop.map((p) => {
    const dx = p.x - cx, dy = p.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) return p.clone();
    return new THREE.Vector3(p.x + (dx / len) * amount, p.y + (dy / len) * amount, p.z);
  });
}

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
