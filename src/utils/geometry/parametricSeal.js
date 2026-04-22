import * as THREE from "three";

/**
 * Generates an ordered array of local-space Vector3 tracing the outer
 * perimeter of the glasses frame as a single closed path.
 *
 * Treats both lenses + bridge as one unit (a wide rounded rectangle).
 * This is a valid moisture chamber design — one continuous seal ring
 * around both eyes including the bridge, rather than two per-eye rings.
 *
 * @param {object} m  - { lensWidth, lensHeight, bridgeWidth, cornerRadius? }
 * @param {number} faceZ  - face-side Z in glasses local space (bb.max.z)
 * @param {number} density - target points per mm of perimeter
 */
export function generateParametricSealPath(m, faceZ, density = 0.5) {
  const { lensWidth, lensHeight, bridgeWidth } = m;
  const r = m.cornerRadius ?? Math.min(5, lensWidth * 0.1, lensHeight * 0.1);

  // Combined frame extent (both lenses + bridge as one rectangle)
  const halfTotal = bridgeWidth / 2 + lensWidth;
  const x0 = -halfTotal;  // left outer edge
  const x1 =  halfTotal;  // right outer edge
  const y0 = -lensHeight / 2;  // bottom
  const y1 =  lensHeight / 2;  // top

  const pts = [];

  function addArc(cx, cy, startDeg, endDeg) {
    const arcLen = (Math.abs(endDeg - startDeg) / 360) * 2 * Math.PI * r;
    const n = Math.max(4, Math.ceil(arcLen * density));
    const s = (startDeg * Math.PI) / 180;
    const e = (endDeg * Math.PI) / 180;
    for (let i = 0; i <= n; i++) {
      const a = s + (e - s) * (i / n);
      pts.push(new THREE.Vector3(cx + r * Math.cos(a), cy + r * Math.sin(a), faceZ));
    }
  }

  function addLine(ax, ay, bx, by) {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.ceil(len * density));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push(new THREE.Vector3(ax + (bx - ax) * t, ay + (by - ay) * t, faceZ));
    }
  }

  // Clockwise from top-left corner
  addArc(x0 + r, y1 - r, 180, 90);   // top-left corner
  addLine(x0 + r, y1, x1 - r, y1);   // top edge
  addArc(x1 - r, y1 - r, 90, 0);     // top-right corner
  addLine(x1, y1 - r, x1, y0 + r);   // right edge
  addArc(x1 - r, y0 + r, 0, -90);    // bottom-right corner
  addLine(x1 - r, y0, x0 + r, y0);   // bottom edge
  addArc(x0 + r, y0 + r, -90, -180); // bottom-left corner
  addLine(x0, y0 + r, x0, y1 - r);   // left edge

  return pts;
}
