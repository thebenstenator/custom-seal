import * as THREE from "three";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface SliceResult {
  z: number;
  loops: THREE.Vector3[][];
  quality: "good" | "partial";
}

export interface EyePaths {
  leftPath: THREE.Vector3[] | null;
  rightPath: THREE.Vector3[] | null;
  skipZRemap?: boolean;
}

// ---------------------------------------------------------------------------
// Z-plane cross-section
// ---------------------------------------------------------------------------

export function sliceGeometryAtZ(
  geometry: THREE.BufferGeometry,
  z: number,
  epsilon = 0.01,
): THREE.Vector3[][] {
  const segments = extractSegments(geometry, z);
  if (segments.length === 0) return [];
  return connectSegments(segments, epsilon);
}

export function findBestSliceZ(
  geometry: THREE.BufferGeometry,
  epsilon = 0.5,
  minXFraction = 0.7,
): SliceResult | null {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  const totalXSpan = max.x - min.x;
  const centerX = (min.x + max.x) / 2;
  const depth = max.z - min.z;
  const step = Math.max(0.5, depth * 0.04);

  let bestPartial: SliceResult | null = null;
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

  return bestPartial;
}

function centroidX(loop: THREE.Vector3[]): number {
  return loop.reduce((s, p) => s + p.x, 0) / loop.length;
}

export function extractPerEyePaths(
  loops: THREE.Vector3[][],
  numAngles = 120,
): EyePaths | null {
  if (!loops || loops.length === 0) return null;
  const sorted = [...loops].sort((a, b) => bboxArea(b) - bboxArea(a));
  const maxArea = bboxArea(sorted[0]);

  console.log(
    "[Tier2 loops]",
    sorted.map((l, i) =>
      `#${i} pts=${l.length} area=${bboxArea(l).toFixed(0)} cx=${centroidX(l).toFixed(1)}`
    ).join(" | ")
  );

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

  const valid = sorted.filter((l) => l.length >= 5 && bboxArea(l) > 10);
  const leftLoops  = valid.filter((l) => centroidX(l) < 0);
  const rightLoops = valid.filter((l) => centroidX(l) >= 0);

  if (leftLoops.length === 0 || rightLoops.length === 0) {
    const allPts   = valid.flat();
    const leftPts  = allPts.filter((p) => p.x < 0);
    const rightPts = allPts.filter((p) => p.x >= 0);
    console.log("[Tier2 split] inner: 0 → point-split left:", leftPts.length, "right:", rightPts.length);
    return {
      leftPath:  leftPts.length  > 5 ? extractSilhouettePath([leftPts],  numAngles) : null,
      rightPath: rightPts.length > 5 ? extractSilhouettePath([rightPts], numAngles) : null,
    };
  }

  const pickBest = (ls: THREE.Vector3[][]): THREE.Vector3[] =>
    downsample([...ls].sort((a, b) => bboxArea(b) - bboxArea(a))[0], 100);

  console.log("[Tier2 split] inner: 0 → direct loops: left:", leftLoops.length, "right:", rightLoops.length);
  return {
    leftPath:  leftLoops.length  > 0 ? pickBest(leftLoops)  : null,
    rightPath: rightLoops.length > 0 ? pickBest(rightLoops) : null,
  };
}

export function extractInnerSilhouettePath(
  pointClouds: THREE.Vector3[][],
  numAngles = 180,
  minFraction = 0.05,
): THREE.Vector3[] | null {
  const all = pointClouds.flat();
  if (all.length < 3) return null;

  const cx = all.reduce((s, p) => s + p.x, 0) / all.length;
  const cy = all.reduce((s, p) => s + p.y, 0) / all.length;
  const z = all[0].z;

  let sumR = 0;
  for (const p of all) {
    const dx = p.x - cx, dy = p.y - cy;
    sumR += Math.sqrt(dx * dx + dy * dy);
  }
  const minThreshold = (sumR / all.length) * minFraction;

  const result: THREE.Vector3[] = [];
  for (let i = 0; i < numAngles; i++) {
    const angle = (i / numAngles) * Math.PI * 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    let minProj = Infinity, best: THREE.Vector3 | null = null;
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

export function extractSilhouettePath(
  loops: THREE.Vector3[][],
  numAngles = 180,
): THREE.Vector3[] | null {
  if (!loops || loops.length === 0) return null;
  const all = loops.flat();
  if (all.length < 3) return null;

  const cx = all.reduce((s, p) => s + p.x, 0) / all.length;
  const cy = all.reduce((s, p) => s + p.y, 0) / all.length;
  const z = all[0].z;

  const result: THREE.Vector3[] = [];
  for (let i = 0; i < numAngles; i++) {
    const angle = (i / numAngles) * Math.PI * 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    let maxProj = -Infinity, best: THREE.Vector3 | null = null;
    for (const p of all) {
      const proj = (p.x - cx) * cos + (p.y - cy) * sin;
      if (proj > maxProj) { maxProj = proj; best = p; }
    }
    if (best) result.push(new THREE.Vector3(best.x, best.y, z));
  }

  const deduped = [result[0]];
  for (let i = 1; i < result.length; i++) {
    if (!result[i].equals(deduped[deduped.length - 1])) deduped.push(result[i]);
  }
  return deduped.length >= 3 ? deduped : null;
}

function extractSegments(
  geometry: THREE.BufferGeometry,
  z: number,
): [THREE.Vector3, THREE.Vector3][] {
  const pos = geometry.attributes.position;
  const segments: [THREE.Vector3, THREE.Vector3][] = [];

  for (let i = 0; i < pos.count; i += 3) {
    const v = [0, 1, 2].map((j) =>
      new THREE.Vector3(pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j))
    );
    const above = v.map((p) => p.z >= z);
    const aboveCount = above.filter(Boolean).length;
    if (aboveCount === 0 || aboveCount === 3) continue;

    const pts: THREE.Vector3[] = [];
    for (let a = 0; a < 3; a++) {
      const b = (a + 1) % 3;
      if (above[a] !== above[b]) {
        const va = v[a], vb = v[b];
        const t = (z - va.z) / (vb.z - va.z);
        pts.push(new THREE.Vector3(
          va.x + t * (vb.x - va.x),
          va.y + t * (vb.y - va.y),
          z,
        ));
      }
    }
    if (pts.length === 2) segments.push([pts[0], pts[1]]);
  }
  return segments;
}

function connectSegments(
  segments: [THREE.Vector3, THREE.Vector3][],
  epsilon: number,
): THREE.Vector3[][] {
  const used = new Array(segments.length).fill(false) as boolean[];
  const loops: THREE.Vector3[][] = [];

  for (let startI = 0; startI < segments.length; startI++) {
    if (used[startI]) continue;
    const loop: THREE.Vector3[] = [segments[startI][0].clone(), segments[startI][1].clone()];
    used[startI] = true;

    let extended = true;
    while (extended) {
      extended = false;
      const tail = loop[loop.length - 1];
      for (let i = 0; i < segments.length; i++) {
        if (used[i]) continue;
        const [a, b] = segments[i];
        if (tail.distanceTo(a) < epsilon) {
          loop.push(b.clone()); used[i] = true; extended = true; break;
        } else if (tail.distanceTo(b) < epsilon) {
          loop.push(a.clone()); used[i] = true; extended = true; break;
        }
      }
    }

    if (loop.length > 2 && loop[0].distanceTo(loop[loop.length - 1]) < epsilon) {
      loop.pop();
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

// ---------------------------------------------------------------------------
// Open boundary edge detection
// ---------------------------------------------------------------------------

export function findOpenBoundaryLoops(
  geometry: THREE.BufferGeometry,
  epsilon = 0.5,
): THREE.Vector3[][] {
  const pos = geometry.attributes.position;
  const n = pos.count;

  const vertMap = new Map<string, number>();
  const dedupVerts: THREE.Vector3[] = [];
  const vidx = new Int32Array(n);

  for (let i = 0; i < n; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!vertMap.has(key)) {
      vertMap.set(key, dedupVerts.length);
      dedupVerts.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
    vidx[i] = vertMap.get(key)!;
  }

  const edgeUse = new Map<string, number>();
  const edgeEnds = new Map<string, [number, number]>();

  for (let i = 0; i < n; i += 3) {
    const a = vidx[i], b = vidx[i + 1], c = vidx[i + 2];
    for (const [v0, v1] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      const lo = Math.min(v0, v1), hi = Math.max(v0, v1);
      const key = `${lo},${hi}`;
      edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
      if (!edgeEnds.has(key)) edgeEnds.set(key, [v0, v1]);
    }
  }

  const segs: [THREE.Vector3, THREE.Vector3][] = [];
  for (const [key, count] of edgeUse) {
    if (count === 1) {
      const [v0, v1] = edgeEnds.get(key)!;
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

export function extractFaceContactLoops(
  geometry: THREE.BufferGeometry,
  cnAligned: THREE.Vector3,
  threshold = 0.25,
  epsilon = 0.5,
): THREE.Vector3[][] {
  const pos = geometry.attributes.position;
  const n = pos.count;
  const cn = cnAligned.clone().normalize();

  const vertMap = new Map<string, number>();
  const dedupVerts: THREE.Vector3[] = [];
  const vidx = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!vertMap.has(key)) {
      vertMap.set(key, dedupVerts.length);
      dedupVerts.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
    vidx[i] = vertMap.get(key)!;
  }

  const edgeUse = new Map<string, number>();
  const edgeEnds = new Map<string, [number, number]>();
  let fcCount = 0;

  for (let t = 0; t < n; t += 3) {
    const ai = vidx[t], bi = vidx[t + 1], ci = vidx[t + 2];
    const a = dedupVerts[ai], b = dedupVerts[bi], c = dedupVerts[ci];

    const e1x = b.x - a.x, e1y = b.y - a.y, e1z = b.z - a.z;
    const e2x = c.x - a.x, e2y = c.y - a.y, e2z = c.z - a.z;
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (nLen < 1e-10) continue;
    nx /= nLen; ny /= nLen; nz /= nLen;

    if (nx * cn.x + ny * cn.y + nz * cn.z <= threshold) continue;
    fcCount++;

    for (const [v0i, v1i] of [[ai, bi], [bi, ci], [ci, ai]] as [number, number][]) {
      const lo = Math.min(v0i, v1i), hi = Math.max(v0i, v1i);
      const key = `${lo},${hi}`;
      edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
      if (!edgeEnds.has(key)) edgeEnds.set(key, [v0i, v1i]);
    }
  }

  const segs: [THREE.Vector3, THREE.Vector3][] = [];
  for (const [key, count] of edgeUse) {
    if (count === 1) {
      const [v0i, v1i] = edgeEnds.get(key)!;
      segs.push([dedupVerts[v0i].clone(), dedupVerts[v1i].clone()]);
    }
  }

  console.log("[faceContact] face-contact tris:", fcCount, "/ boundary segs:", segs.length);
  if (segs.length === 0) return [];
  return connectSegments(segs, epsilon);
}

// ---------------------------------------------------------------------------
// Aggregate cross-section approach
// ---------------------------------------------------------------------------

export function extractPerEyeAggregate(
  geometry: THREE.BufferGeometry,
  numAngles = 120,
  epsilon = 0.5,
  cnAligned: THREE.Vector3 | null = null,
): EyePaths {
  // ── Strategy 0: face-contact surface boundary ────────────────────────────
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

      const maxArea = bboxArea(sorted[0]);
      const candidates = sorted.filter(l => l.length >= 4 && bboxArea(l) > 20);
      const inner = candidates.filter(l => bboxArea(l) < maxArea * 0.85);
      const pool = inner.length >= 2 ? inner : candidates;

      const leftLoops  = pool.filter(l => centroidX(l) < -2);
      const rightLoops = pool.filter(l => centroidX(l) >  2);

      if (leftLoops.length > 0 && rightLoops.length > 0) {
        const SEAL_OUTSET_MM = 1.0;
        const pickBest = (ls: THREE.Vector3[][]): THREE.Vector3[] => {
          const raw = [...ls].sort((a, b) => bboxArea(b) - bboxArea(a))[0];
          return downsample(expandLoopOutward(raw, SEAL_OUTSET_MM), 120);
        };
        console.log("[aggregate S0] left pts:", leftLoops[0].length, "right pts:", rightLoops[0].length);
        return {
          leftPath:  pickBest(leftLoops),
          rightPath: pickBest(rightLoops),
          skipZRemap: true,
        };
      }
    }
  }

  // ── Strategy 1: open boundary edge detection ────────────────────────────
  const boundaryLoops = findOpenBoundaryLoops(geometry, epsilon);
  if (boundaryLoops.length > 0) {
    const sorted = [...boundaryLoops].sort((a, b) => bboxArea(b) - bboxArea(a));
    console.log(
      "[aggregate] boundary loops:",
      sorted.map((l, i) =>
        `#${i} pts=${l.length} area=${bboxArea(l).toFixed(0)} cx=${centroidX(l).toFixed(1)}`
      ).join(" | ")
    );

    const candidates = sorted.filter(l => bboxArea(l) > 50);
    const leftLoops  = candidates.filter(l => centroidX(l) < -1);
    const rightLoops = candidates.filter(l => centroidX(l) >  1);

    if (leftLoops.length > 0 && rightLoops.length > 0) {
      geometry.computeBoundingBox();
      const sealZ = geometry.boundingBox!.max.z;
      const pickEye = (ls: THREE.Vector3[][], sign: number): THREE.Vector3[] =>
        [...ls].sort((a, b) => sign * (centroidX(b) - centroidX(a)))[0];
      const leftBest  = pickEye(leftLoops,  -1);
      const rightBest = pickEye(rightLoops,  1);
      console.log("[aggregate] boundary path: left pts:", leftBest.length, "right pts:", rightBest.length);
      return {
        leftPath:  downsample(leftBest.map(p  => new THREE.Vector3(p.x, p.y, sealZ)), 120),
        rightPath: downsample(rightBest.map(p => new THREE.Vector3(p.x, p.y, sealZ)), 120),
      };
    }
  }

  // ── Strategy 2: Z-slice outer rims → lens centers → normal filter ───────
  geometry.computeBoundingBox();
  const { max } = geometry.boundingBox!;
  const depth = max.z - geometry.boundingBox!.min.z;
  const step = Math.max(0.5, depth * 0.04);
  const sealZ = max.z;

  const leftRim: THREE.Vector3[] = [], rightRim: THREE.Vector3[] = [];
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

  const mean2d = (pts: THREE.Vector3[]) => ({
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  });
  const lc = mean2d(leftRim);
  const rc = mean2d(rightRim);
  console.log("[aggregate] lens centers L(", lc.x.toFixed(1), lc.y.toFixed(1),
    ") R(", rc.x.toFixed(1), rc.y.toFixed(1), ")");

  geometry.computeVertexNormals();
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const leftWall: THREE.Vector3[] = [], rightWall: THREE.Vector3[] = [];

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const nx = nrm.getX(i), ny = nrm.getY(i);
    const nXYlen = Math.sqrt(nx * nx + ny * ny);
    if (nXYlen < 0.15) continue;
    const isLeft = x < 0;
    const { x: lcx, y: lcy } = isLeft ? lc : rc;
    const dx = lcx - x, dy = lcy - y;
    const dirLen = Math.sqrt(dx * dx + dy * dy);
    if (dirLen < 0.5) continue;
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

  console.log("[aggregate] falling back to outer silhouette from rim loops");
  return {
    leftPath:  extractSilhouettePath([leftRim],  numAngles),
    rightPath: extractSilhouettePath([rightRim], numAngles),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function expandLoopOutward(loop: THREE.Vector3[], amount: number): THREE.Vector3[] {
  const cx = loop.reduce((s, p) => s + p.x, 0) / loop.length;
  const cy = loop.reduce((s, p) => s + p.y, 0) / loop.length;
  return loop.map((p) => {
    const dx = p.x - cx, dy = p.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) return p.clone();
    return new THREE.Vector3(p.x + (dx / len) * amount, p.y + (dy / len) * amount, p.z);
  });
}

function bboxArea(loop: THREE.Vector3[]): number {
  const xs = loop.map((p) => p.x);
  const ys = loop.map((p) => p.y);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
}

export function extractSealPath(loops: THREE.Vector3[][]): THREE.Vector3[] | null {
  if (!loops || loops.length === 0) return null;

  const sorted = [...loops].sort((a, b) => bboxArea(b) - bboxArea(a));
  sorted.forEach((l, i) => {
    const xs = l.map(p => p.x), ys = l.map(p => p.y);
    console.log(`[loop ${i}] pts:${l.length} area:${bboxArea(l).toFixed(0)} x:[${Math.min(...xs).toFixed(1)},${Math.max(...xs).toFixed(1)}] y:[${Math.min(...ys).toFixed(1)},${Math.max(...ys).toFixed(1)}]`);
  });

  const outer = sorted[0];
  const inner = sorted.slice(1).filter((l) => l.length >= 3);

  let trimMinX: number, trimMaxX: number;
  if (inner.length > 0) {
    const allInner = inner.flat();
    const margin = 8;
    trimMinX = Math.min(...allInner.map((p) => p.x)) - margin;
    trimMaxX = Math.max(...allInner.map((p) => p.x)) + margin;
  } else {
    const xs = outer.map((p) => p.x);
    const span = Math.max(...xs) - Math.min(...xs);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    trimMinX = cx - span * 0.7;
    trimMaxX = cx + span * 0.7;
  }

  const n = outer.length;
  const inRange = outer.map((p) => p.x >= trimMinX && p.x <= trimMaxX);

  let bestStart = 0, bestLen = 0, curStart = 0, curLen = 0;
  for (let i = 0; i < n * 2; i++) {
    if (inRange[i % n]) {
      if (curLen === 0) curStart = i % n;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else {
      curLen = 0;
    }
    if (curLen >= n) break;
  }

  if (bestLen < 3) return null;
  const path: THREE.Vector3[] = [];
  for (let i = 0; i < bestLen; i++) path.push(outer[(bestStart + i) % n].clone());
  return downsample(path, 100);
}

function downsample(points: THREE.Vector3[], maxPoints: number): THREE.Vector3[] {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const result: THREE.Vector3[] = [];
  for (let i = 0; i < maxPoints; i++) result.push(points[Math.round(i * step)]);
  return result;
}

export function extractMeasurements(
  loops: THREE.Vector3[][],
): { lensWidth: number; lensHeight: number; bridgeWidth: number } | null {
  if (!loops || loops.length < 3) return null;

  const sorted = [...loops].sort((a, b) => bboxArea(b) - bboxArea(a));
  const inner = sorted.slice(1).filter((l) => {
    const xs = l.map((p) => p.x);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    return Math.abs(cx) > 5;
  });

  if (inner.length < 2) return null;

  inner.sort((a, b) => {
    const cx = (l: THREE.Vector3[]) =>
      (Math.max(...l.map((p) => p.x)) + Math.min(...l.map((p) => p.x))) / 2;
    return cx(a) - cx(b);
  });

  const left = inner[0];
  const right = inner[inner.length - 1];
  const lensWidth  = Math.max(...left.map((p) => p.x)) - Math.min(...left.map((p) => p.x));
  const lensHeight = Math.max(...left.map((p) => p.y)) - Math.min(...left.map((p) => p.y));
  const bridgeWidth = Math.min(...right.map((p) => p.x)) - Math.max(...left.map((p) => p.x));

  if (lensWidth <= 0 || lensHeight <= 0) return null;
  return { lensWidth, lensHeight, bridgeWidth: Math.max(bridgeWidth, 1) };
}
