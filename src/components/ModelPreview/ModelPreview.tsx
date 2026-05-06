import { useState, useRef, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useFrame } from "@react-three/fiber";
import { Upload, Download } from "lucide-react";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter";
import {
  useAppStore,
  DEFAULT_GLASSES_POSITION,
  DEFAULT_GLASSES_ROTATION,
  DEFAULT_GLASSES_SCALE,
  DEFAULT_HEAD_ROTATION,
  type SealRawEdges,
} from "../../store/useAppStore";
import SceneCanvas from "../shared/SceneCanvas";
import { useSTLModel, useUploadedModel } from "../../hooks/useSTLModel";
import {
  findBestSliceZ,
  extractPerEyePaths,
  extractPerEyeAggregate,
} from "../../utils/geometry/meshSlice";
import { generateWorldSealPath } from "../../utils/geometry/parametricSeal";
import {
  generateSeal,
  generateDualSeal,
  flattenEdgesForTPU,
} from "../../utils/geometry/sealGenerator";
import Button from "../shared/Button";
import Notice from "../shared/Notice";
import "./ModelPreview.css";

// --- Scene sub-components ---

interface HeadModelProps {
  scanFile: File | null;
  rotation: [number, number, number];
  meshRef: React.RefObject<THREE.Mesh | null>;
  onLoadError?: (msg: string) => void;
}

function HeadModel({ scanFile, rotation, meshRef, onLoadError }: HeadModelProps) {
  const uploaded = useUploadedModel(scanFile, onLoadError);
  const defaultGeo = useSTLModel("/models/default-head.stl");
  const geometry = scanFile ? uploaded : defaultGeo;
  if (!geometry) return null;
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      rotation={[rotation[0], rotation[1], rotation[2]]}
      scale={0.01}
    >
      <meshStandardMaterial color="#f4a582" />
    </mesh>
  );
}

interface GlassesModelProps {
  glassesFile: File | null;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  meshRef: React.RefObject<THREE.Mesh | null>;
  onBboxWidth: (widthInStlUnits: number) => void;
  onLoadError?: (msg: string) => void;
}

function GlassesModel({
  glassesFile,
  position,
  rotation,
  scale,
  meshRef,
  onBboxWidth,
  onLoadError,
}: GlassesModelProps) {
  const uploaded = useUploadedModel(glassesFile, onLoadError);
  const defaultGeo = useSTLModel("/models/default-glasses.stl");
  const geometry = glassesFile ? uploaded : defaultGeo;

  useEffect(() => {
    if (!geometry) return;
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    const sx = bb.max.x - bb.min.x;
    const sy = bb.max.y - bb.min.y;
    const sz = bb.max.z - bb.min.z;
    // largest dimension is always the left-to-right width regardless of export orientation
    onBboxWidth(Math.max(sx, sy, sz));
  }, [geometry]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!geometry) return null;
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      rotation={rotation}
      position={position}
      scale={scale}
    >
      <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
    </mesh>
  );
}

interface SealPreviewProps {
  geometry: THREE.BufferGeometry | null;
}

function SealPreview({ geometry }: SealPreviewProps) {
  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#60a5fa"
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface HardpointMarkersProps {
  points: THREE.Vector3[] | null;
}

function HardpointMarkers({ points }: HardpointMarkersProps) {
  if (!points) return null;
  return (
    <>
      {points.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
      ))}
    </>
  );
}

// Continuously raycasts from the glasses nose-bridge area toward the head
// and reports the gap distance in mm via the callback.
interface BridgeDistanceMeasurerProps {
  glassesMeshRef: React.RefObject<THREE.Mesh | null>;
  headMeshRef: React.RefObject<THREE.Mesh | null>;
  onDistance: (mm: number | null) => void;
}

const BRIDGE_DIRS = [
  new THREE.Vector3( 1, 0, 0), new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3( 0, 1, 0), new THREE.Vector3( 0,-1, 0),
  new THREE.Vector3( 0, 0, 1), new THREE.Vector3( 0, 0,-1),
];

function BridgeDistanceMeasurer({
  glassesMeshRef,
  headMeshRef,
  onDistance,
}: BridgeDistanceMeasurerProps) {
  const rc         = useRef(new THREE.Raycaster());
  const frameCount = useRef(0);
  const lastMm     = useRef<number | null>(null);

  rc.current.near = 0;
  rc.current.far  = 2.0;

  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % 8 !== 0) return;

    const glasses = glassesMeshRef.current;
    const head    = headMeshRef.current;
    if (!glasses || !head) return;

    glasses.updateMatrixWorld(true);
    head.updateMatrixWorld(true);

    const glassesCenter = new THREE.Vector3();
    new THREE.Box3().setFromObject(glasses).getCenter(glassesCenter);

    // Cast in all 6 cardinal directions; closest hit is the nearest head surface.
    // This avoids the head-center-direction issue when the neck lowers the bbox centroid.
    let minDist = Infinity;
    for (const dir of BRIDGE_DIRS) {
      rc.current.set(glassesCenter, dir);
      const hits = rc.current.intersectObject(head, false);
      if (hits.length > 0 && hits[0].distance < minDist) minDist = hits[0].distance;
    }
    const mm = isFinite(minDist) ? Math.round(minDist * 100 * 10) / 10 : null;

    if (mm !== lastMm.current) {
      lastMm.current = mm;
      onDistance(mm);
    }
  });

  return null;
}

interface SealGeneratorResult {
  worldHardpoints: THREE.Vector3[];
  sealGeometry: THREE.BufferGeometry | null;
  rawEdges: SealRawEdges | null;
}

interface SealGeneratorProps {
  glassesMeshRef: React.RefObject<THREE.Mesh | null>;
  headMeshRef: React.RefObject<THREE.Mesh | null>;
  onSealGenerated: (result: SealGeneratorResult) => void;
}

function SealGenerator({
  glassesMeshRef,
  headMeshRef,
  onSealGenerated,
}: SealGeneratorProps) {
  const sealTrigger = useAppStore((s) => s.sealTrigger);
  // Initialize to current value so a stale trigger from a previous session
  // doesn't fire immediately when this component mounts.
  const lastTrigger = useRef(sealTrigger);

  useFrame(() => {
    if (sealTrigger === lastTrigger.current) return;
    const glasses = glassesMeshRef.current;
    const head = headMeshRef.current;
    if (!glasses || !head) return;

    lastTrigger.current = sealTrigger;

    glasses.updateMatrixWorld(true);
    head.updateMatrixWorld(true);

    glasses.geometry.computeBoundingBox();
    const bb = glasses.geometry.boundingBox!;

    const sx = bb.max.x - bb.min.x;
    const sy = bb.max.y - bb.min.y;
    const sz = bb.max.z - bb.min.z;
    const localFaceDir =
      sz <= sx && sz <= sy ? new THREE.Vector3(0, 0, 1) :
      sy <= sx             ? new THREE.Vector3(0, 1, 0) :
                             new THREE.Vector3(1, 0, 0);
    const faceNormal = localFaceDir.clone().transformDirection(glasses.matrixWorld).normalize();

    const headCenter = new THREE.Vector3();
    new THREE.Box3().setFromObject(head).getCenter(headCenter);
    const glassesWorldCenter = new THREE.Vector3();
    new THREE.Box3().setFromObject(glasses).getCenter(glassesWorldCenter);
    const toHead = headCenter.clone().sub(glassesWorldCenter).normalize();
    const correctedFaceNormal =
      faceNormal.dot(toHead) >= 0
        ? faceNormal.clone()
        : faceNormal.clone().negate();

    const alignMat: THREE.Matrix4 | null = (() => {
      if (localFaceDir.z === 1) return null;
      if (localFaceDir.x === 1) {
        return sy >= sz
          ? new THREE.Matrix4().set(0,1,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,1)
          : new THREE.Matrix4().set(0,0,1,0, 0,1,0,0, 1,0,0,0, 0,0,0,1);
      }
      return sx >= sz
        ? new THREE.Matrix4().set(1,0,0,0, 0,0,1,0, 0,1,0,0, 0,0,0,1)
        : new THREE.Matrix4().set(0,0,1,0, 1,0,0,0, 0,1,0,0, 0,0,0,1);
    })();
    const alignInv = alignMat ? alignMat.clone().invert() : null;

    const toWorld = (localPts: THREE.Vector3[] | null): THREE.Vector3[] | null =>
      localPts?.map((p) => {
        const v = p.clone();
        if (alignInv) v.applyMatrix4(alignInv);
        return v.applyMatrix4(glasses.matrixWorld);
      }) ?? null;

    const sliceGeo = alignMat
      ? (() => {
          const g = glasses.geometry.clone();
          g.applyMatrix4(alignMat);
          g.computeBoundingBox();
          return g;
        })()
      : glasses.geometry;
    const cnAligned = correctedFaceNormal.clone()
      .transformDirection(glasses.matrixWorld.clone().invert());
    if (alignMat) cnAligned.applyMatrix4(alignMat);
    sliceGeo.computeBoundingBox();
    const faceSideZ = cnAligned.z >= 0
      ? sliceGeo.boundingBox!.max.z
      : sliceGeo.boundingBox!.min.z;

    const best = findBestSliceZ(sliceGeo, 0.5);
    let eyePaths = null;

    if (best?.quality === "good") {
      eyePaths = extractPerEyePaths(best.loops);
    } else if (best) {
      eyePaths = extractPerEyeAggregate(sliceGeo, 120, 0.5, cnAligned);
    }

    if (eyePaths && best?.quality !== "good" && !eyePaths.skipZRemap) {
      const remap = (path: THREE.Vector3[] | null) =>
        path?.map((p) => new THREE.Vector3(p.x, p.y, faceSideZ)) ?? null;
      eyePaths = { leftPath: remap(eyePaths.leftPath), rightPath: remap(eyePaths.rightPath) };
    }

    const leftWorld  = toWorld(eyePaths?.leftPath  ?? null);
    const rightWorld = toWorld(eyePaths?.rightPath ?? null);
    const sealNormal = best?.quality !== "good" ? correctedFaceNormal : faceNormal;

    if (!head.geometry.boundsTree) head.geometry.computeBoundsTree();

    const rc = new THREE.Raycaster();
    rc.near = 0.002;
    rc.far  = 0.5;

    function conformedEdge(pts: THREE.Vector3[] | null): THREE.Vector3[] | null {
      if (!pts) return null;
      const n = pts.length;

      const depths: number[] = pts.map((p) => {
        rc.set(p, correctedFaceNormal);
        const hits = rc.intersectObject(head!, false);
        return hits.length > 0 ? hits[0].distance : -1;
      });

      for (let i = 0; i < n; i++) {
        if (depths[i] >= 0) continue;
        let lo = -1, hi = -1;
        for (let step = 1; step < n; step++) {
          if (lo < 0 && depths[(i - step + n) % n] >= 0) lo = (i - step + n) % n;
          if (hi < 0 && depths[(i + step)     % n] >= 0) hi = (i + step) % n;
          if (lo >= 0 && hi >= 0) break;
        }
        if (lo >= 0 && hi >= 0) {
          const dLo = (i - lo + n) % n;
          const dHi = (hi - i  + n) % n;
          depths[i] = (depths[lo] * dHi + depths[hi] * dLo) / (dLo + dHi);
        } else if (lo >= 0) {
          depths[i] = depths[lo];
        } else if (hi >= 0) {
          depths[i] = depths[hi];
        } else {
          depths[i] = 0.05;
        }
      }

      return pts.map((p, i) =>
        p.clone().addScaledVector(correctedFaceNormal, depths[i] + 0.001)
      );
    }

    const leftEdge  = conformedEdge(leftWorld);
    const rightEdge = conformedEdge(rightWorld);

    let sealGeometry = eyePaths
      ? generateDualSeal(leftWorld, rightWorld, sealNormal, leftEdge, rightEdge)
      : null;
    const worldHardpoints = [...(leftWorld ?? []), ...(rightWorld ?? [])];

    if (!sealGeometry) {
      const worldBox = new THREE.Box3().setFromObject(glasses);
      const worldCenter = new THREE.Vector3();
      worldBox.getCenter(worldCenter);

      const wUp = new THREE.Vector3(0, 1, 0);
      wUp.addScaledVector(correctedFaceNormal, -wUp.dot(correctedFaceNormal));
      if (wUp.lengthSq() < 0.01)
        wUp.set(0, 0, 1).addScaledVector(correctedFaceNormal, -correctedFaceNormal.z);
      wUp.normalize();
      const wRight = new THREE.Vector3().crossVectors(wUp, correctedFaceNormal).normalize();

      let halfW = 0, halfH = 0, maxFace = -Infinity;
      for (let i = 0; i < 8; i++) {
        const c = new THREE.Vector3(
          i & 1 ? worldBox.max.x : worldBox.min.x,
          i & 2 ? worldBox.max.y : worldBox.min.y,
          i & 4 ? worldBox.max.z : worldBox.min.z,
        );
        const rel = c.clone().sub(worldCenter);
        halfW = Math.max(halfW, Math.abs(rel.dot(wRight)));
        halfH = Math.max(halfH, Math.abs(rel.dot(wUp)));
        maxFace = Math.max(maxFace, c.dot(correctedFaceNormal));
      }

      const faceOrigin = worldCenter.clone().addScaledVector(
        correctedFaceNormal,
        maxFace - worldCenter.dot(correctedFaceNormal),
      );
      const worldPath = generateWorldSealPath(faceOrigin, wRight, wUp, halfW, halfH);
      sealGeometry = generateSeal(worldPath, correctedFaceNormal);
    }

    const rawEdges: SealRawEdges = {
      leftPath:   leftWorld,
      rightPath:  rightWorld,
      leftFace:   leftEdge,
      rightFace:  rightEdge,
      faceNormal: correctedFaceNormal,
    };

    if (alignMat) sliceGeo.dispose();

    onSealGenerated({ worldHardpoints, sealGeometry, rawEdges });
  });

  return null;
}

// --- STL export ---

function exportSTL(geo: THREE.BufferGeometry, filename: string) {
  const exporter = new STLExporter();
  const mesh = new THREE.Mesh(geo);
  const result = exporter.parse(mesh, { binary: true });
  const blob = new Blob([result], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Main component ---

const axisIdx: Record<string, number> = { x: 0, y: 1, z: 2 };
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const FINE_HALF_ROT = 15 * RAD;

interface FineCenters {
  pos: [number, number, number];
  rot: [number, number, number];
  scale: number;
  head: [number, number, number];
}

export default function ModelPreview() {
  const navigate = useNavigate();

  const selectedFrame        = useAppStore((s) => s.selectedFrame);
  const userScan             = useAppStore((s) => s.userScan);
  const glassesPosition      = useAppStore((s) => s.glassesPosition);
  const glassesRotation      = useAppStore((s) => s.glassesRotation);
  const glassesScale         = useAppStore((s) => s.glassesScale);
  const headRotation         = useAppStore((s) => s.headRotation);
  const setGlassesPosition   = useAppStore((s) => s.setGlassesPosition);
  const setGlassesRotation   = useAppStore((s) => s.setGlassesRotation);
  const setGlassesScale      = useAppStore((s) => s.setGlassesScale);
  const setHeadRotation      = useAppStore((s) => s.setHeadRotation);
  const resetAlignment       = useAppStore((s) => s.resetAlignment);
  const setHardpoints        = useAppStore((s) => s.setHardpoints);
  const setGeneratedSeal     = useAppStore((s) => s.setGeneratedSeal);
  const setSealRawEdges      = useAppStore((s) => s.setSealRawEdges);
  const generatedSeal        = useAppStore((s) => s.generatedSeal);
  const sealRawEdges         = useAppStore((s) => s.sealRawEdges);
  const hardpoints           = useAppStore((s) => s.hardpoints);
  const triggerSealGeneration = useAppStore((s) => s.triggerSealGeneration);

  const [glassesFile, setGlassesFile]       = useState<File | null>(null);
  const [showHardpoints, setShowHardpoints] = useState(false);
  const [fineMode, setFineMode]             = useState(false);
  const [fineCenters, setFineCenters]       = useState<FineCenters | null>(null);
  const [stlBboxWidth, setStlBboxWidth]     = useState<number | null>(null);
  const [bridgeDistMm, setBridgeDistMm]     = useState<number | null>(null);
  const [loadError, setLoadError]           = useState<string | null>(null);

  const glassesMeshRef = useRef<THREE.Mesh>(null);
  const headMeshRef    = useRef<THREE.Mesh>(null);

  if (!selectedFrame) return <Navigate to="/frames" replace />;

  // Frame width in mm derived from STL geometry width × applied scale × 100
  const frameWidthMm = stlBboxWidth !== null
    ? Math.round(stlBboxWidth * glassesScale * 100)
    : null;

  const slug = selectedFrame.name.toLowerCase().replace(/\s+/g, "-");

  const handleAutoOrient = () => {
    const head    = headMeshRef.current;
    const glasses = glassesMeshRef.current;
    if (!head) return;

    head.updateMatrixWorld(true);
    if (!head.geometry.boundsTree) head.geometry.computeBoundsTree();

    // ── Position ────────────────────────────────────────────────────────────
    const headBox    = new THREE.Box3().setFromObject(head);
    const headCenterX = (headBox.min.x + headBox.max.x) / 2;
    const headHeight  = headBox.max.y - headBox.min.y;

    const rc = new THREE.Raycaster();
    rc.near = 0;
    rc.far  = 30;

    // Sweep 14 rays from 48% to 76% of head height to find the nose tip —
    // the most-forward (highest world-Z) point on the face centre-line.
    let noseZ = -Infinity;
    let noseY = headBox.min.y + headHeight * 0.65; // fallback
    for (let i = 0; i < 14; i++) {
      const t       = 0.48 + (i / 13) * 0.28;
      const sampleY = headBox.min.y + headHeight * t;
      rc.set(new THREE.Vector3(headCenterX, sampleY, 15), new THREE.Vector3(0, 0, -1));
      const hits = rc.intersectObject(head, false);
      if (hits.length > 0 && hits[0].point.z > noseZ) {
        noseZ = hits[0].point.z;
        noseY = sampleY;
      }
    }
    if (!isFinite(noseZ)) noseZ = headBox.max.z;

    // The glasses bridge sits above the nose tip. Step up ~5% of head height
    // to move from the tip to the nose bridge, then re-sample surface depth.
    const bridgeY    = noseY + headHeight * 0.05;
    rc.set(new THREE.Vector3(headCenterX, bridgeY, 15), new THREE.Vector3(0, 0, -1));
    const bridgeHits = rc.intersectObject(head, false);
    const bridgeZ    = bridgeHits.length > 0 ? bridgeHits[0].point.z : noseZ;

    // Convert world (headCenterX, bridgeY, bridgeZ + 5mm) → group-local.
    // Ry(PI/2) group: worldX = localZ, worldZ = -localX.
    // Place glasses 5 mm in front of the nose bridge surface.
    setGlassesPosition([-(bridgeZ + 0.05), bridgeY, headCenterX]);

    // ── Rotation ────────────────────────────────────────────────────────────
    // Start from the default orientation (glasses depth axis → toward head).
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(...DEFAULT_GLASSES_ROTATION)
    );

    if (glasses) {
      glasses.geometry.computeBoundingBox();
      const gb = glasses.geometry.boundingBox!;
      const gx = gb.max.x - gb.min.x;
      const gy = gb.max.y - gb.min.y;
      const gz = gb.max.z - gb.min.z;

      if (gy > gx) {
        // Glasses are "vertical" (lens-to-lens along geometry Y).
        // Post-multiply = apply in geometry-local space first, making lens-to-lens horizontal.
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));

        if (gz > gx) {
          // Frame is also "laying down" — height is along geometry Z, depth along X.
          // After the horizontal fix the frame sits in world XZ (flat on a table).
          // Pre-multiply = apply in group-local space to rotate the frame upright into world XY.
          q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
        }
      }
    }

    const euler = new THREE.Euler().setFromQuaternion(q);
    setGlassesRotation([euler.x, euler.y, euler.z]);
  };

  const handlePLADownload = () => {
    if (!generatedSeal) return;
    const geo = generatedSeal.clone();
    geo.applyMatrix4(new THREE.Matrix4().makeScale(100, 100, 100));
    exportSTL(geo, `seal-${slug}-pla.stl`);
  };

  const handleTPUDownload = () => {
    if (!generatedSeal) return;
    let geo: THREE.BufferGeometry;
    if (sealRawEdges && (sealRawEdges.leftPath || sealRawEdges.rightPath)) {
      const { leftPath, rightPath, leftFace, rightFace, faceNormal } = sealRawEdges;
      const { flatFrame: flatLeft, shiftedFace: shiftedLeftFace } =
        leftPath && leftFace ? flattenEdgesForTPU(leftPath, leftFace, faceNormal) : { flatFrame: null, shiftedFace: null };
      const { flatFrame: flatRight, shiftedFace: shiftedRightFace } =
        rightPath && rightFace ? flattenEdgesForTPU(rightPath, rightFace, faceNormal) : { flatFrame: null, shiftedFace: null };
      const flat = generateDualSeal(flatLeft, flatRight, faceNormal, shiftedLeftFace, shiftedRightFace);
      if (!flat) return;
      geo = flat;
    } else {
      geo = generatedSeal.clone();
    }
    geo.applyMatrix4(new THREE.Matrix4().makeScale(100, 100, 100));
    if (sealRawEdges) {
      const q = new THREE.Quaternion().setFromUnitVectors(
        sealRawEdges.faceNormal.clone().normalize(),
        new THREE.Vector3(0, 0, 1),
      );
      geo.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
    }
    geo.computeBoundingBox();
    const minZ = geo.boundingBox?.min.z ?? 0;
    if (minZ !== 0) geo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, -minZ));
    exportSTL(geo, `seal-${slug}-tpu-flat.stl`);
  };

  const handleGlassesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validExts = [".stl", ".glb", ".gltf", ".obj", ".ply"];
    if (!validExts.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      alert("Please upload an STL, GLB, GLTF, OBJ, or PLY file.");
      return;
    }
    setLoadError(null);
    setGlassesFile(file);
    resetAlignment();
    // Clear any seal generated for the previous glasses model.
    useAppStore.getState().generatedSeal?.dispose();
    setGeneratedSeal(null);
    setHardpoints(null);
    setSealRawEdges(null);
  };

  const handleWidthMmChange = (mm: number) => {
    if (!stlBboxWidth || stlBboxWidth === 0) return;
    setGlassesScale(mm / (stlBboxWidth * 100));
  };

  const handlePositionChange = (axis: string, value: number) => {
    const next = [...glassesPosition] as [number, number, number];
    next[axisIdx[axis]] = value;
    setGlassesPosition(next);
  };

  const handleRotationChange = (axis: string, value: number) => {
    const next = [...glassesRotation] as [number, number, number];
    next[axisIdx[axis]] = value;
    setGlassesRotation(next);
  };

  const handleHeadRotationChange = (axis: string, value: number) => {
    const next = [...headRotation] as [number, number, number];
    next[axisIdx[axis]] = value;
    setHeadRotation(next);
  };

  const toggleFine = () => {
    if (!fineMode) {
      setFineCenters({
        pos: [...glassesPosition] as [number, number, number],
        rot: [...glassesRotation] as [number, number, number],
        scale: glassesScale,
        head: [...headRotation] as [number, number, number],
      });
    }
    setFineMode((f) => !f);
  };

  const getRange = (
    coarseMin: number,
    coarseMax: number,
    fineCenter: number,
    fineHalf: number,
  ) =>
    fineMode && fineCenters != null
      ? { min: fineCenter - fineHalf, max: fineCenter + fineHalf }
      : { min: coarseMin, max: coarseMax };

  type AxisKey = "x" | "y" | "z";

  const posControls: Array<[string, AxisKey, number, number]> = [
    ["Forward/Back", "x", glassesPosition[0], DEFAULT_GLASSES_POSITION[0]],
    ["Up/Down",      "y", glassesPosition[1], DEFAULT_GLASSES_POSITION[1]],
    ["Left/Right",   "z", glassesPosition[2], DEFAULT_GLASSES_POSITION[2]],
  ];

  const rotControls: Array<[string, AxisKey, number, number]> = [
    ["Tilt X", "x", glassesRotation[0], DEFAULT_GLASSES_ROTATION[0]],
    ["Tilt Y", "y", glassesRotation[1], DEFAULT_GLASSES_ROTATION[1]],
    ["Tilt Z", "z", glassesRotation[2], DEFAULT_GLASSES_ROTATION[2]],
  ];

  const headControls: Array<[string, AxisKey, number, number]> = [
    ["Rotate Y", "y", headRotation[1], DEFAULT_HEAD_ROTATION[1]],
    ["Rotate Z", "z", headRotation[2], DEFAULT_HEAD_ROTATION[2]],
  ];

  return (
    <div className="model-preview">
      <div className="page-header">
        <Button variant="back" onClick={() => navigate("/scan")}>
          ← Back
        </Button>
        <h2 className="page-header__title">Position Your Glasses</h2>
        <p className="page-header__subtitle">
          {userScan ? (
            <>Scan loaded: <span className="page-header__selected">{userScan.name}</span></>
          ) : (
            <>Selected frame: <span className="page-header__selected">{selectedFrame?.name}</span></>
          )}
        </p>
      </div>

      <div className="alignment-tips">
        <div className="alignment-tips__item">
          <span className="alignment-tips__icon">📷</span>
          <span>Before aligning: take front and side photos of yourself <em>wearing</em> these glasses — use them as a reference while adjusting.</span>
        </div>
        <div className="alignment-tips__item">
          <span className="alignment-tips__icon">🖨️</span>
          <span>Pro tip: export 2–3 versions with the <strong>Forward/Back</strong> slider at slightly different positions (e.g. −0.01, current, +0.01) and test-print them all — small differences in fit matter for sealing.</span>
        </div>
      </div>

      <div className="model-preview__container">
        <div className="model-preview__viewer">
          <SceneCanvas cameraPosition={[0, 0, 7.5]}>
            <group rotation={[0, Math.PI / 2, 0]}>
              <HeadModel
                scanFile={userScan}
                rotation={headRotation}
                meshRef={headMeshRef}
                onLoadError={setLoadError}
              />
              <GlassesModel
                glassesFile={glassesFile}
                position={glassesPosition}
                rotation={glassesRotation}
                scale={glassesScale}
                meshRef={glassesMeshRef}
                onBboxWidth={setStlBboxWidth}
                onLoadError={setLoadError}
              />
            </group>

            <SealPreview geometry={generatedSeal} />
            {showHardpoints && <HardpointMarkers points={hardpoints} />}

            <SealGenerator
              glassesMeshRef={glassesMeshRef}
              headMeshRef={headMeshRef}
              onSealGenerated={({ worldHardpoints, sealGeometry, rawEdges }) => {
                useAppStore.getState().generatedSeal?.dispose();
                setHardpoints(worldHardpoints);
                setGeneratedSeal(sealGeometry);
                setSealRawEdges(rawEdges);
              }}
            />
            <BridgeDistanceMeasurer
              glassesMeshRef={glassesMeshRef}
              headMeshRef={headMeshRef}
              onDistance={setBridgeDistMm}
            />
          </SceneCanvas>
          <p className="model-preview__instructions">
            Left-drag to rotate • Scroll to zoom • Right-drag to pan
          </p>
        </div>

        <div className="model-preview__controls">
          <h3 className="controls__title">Adjust Alignment</h3>

          {loadError && (
            <Notice variant="warning">
              <p className="notice__text">Failed to load model: {loadError}</p>
            </Notice>
          )}

          <div className="control-group">
            <h4 className="control-group__label">Glasses Model</h4>
            {glassesFile ? (
              <div className="glasses-upload__loaded">
                <span className="glasses-upload__filename">{glassesFile.name}</span>
                <button
                  className="glasses-upload__remove"
                  onClick={() => { setGlassesFile(null); resetAlignment(); }}
                >✕</button>
              </div>
            ) : (
              <label className="glasses-upload__button">
                <Upload size={14} />
                <span>Upload STL</span>
                <input
                  type="file"
                  accept=".stl,.glb,.gltf,.obj,.ply"
                  onChange={handleGlassesUpload}
                  className="scan-upload-input"
                />
              </label>
            )}
          </div>

          {glassesFile && (
            <button className="controls__auto-orient" onClick={handleAutoOrient}>
              ⊕ Auto-Orient Glasses
            </button>
          )}

          <div className="control-group">
            <h4 className="control-group__label">Head Orientation</h4>
            {headControls.map(([label, axis, val, def]) => {
              const { min: minRad, max: maxRad } = getRange(
                -Math.PI, Math.PI, fineCenters?.head[axisIdx[axis]] ?? val, FINE_HALF_ROT,
              );
              const step = fineMode ? "0.5" : "1";
              const degVal = parseFloat((val * DEG).toFixed(1));
              return (
                <div className="control-row" key={axis}>
                  <div className="control">
                    <span className="control__label">{label}</span>
                    <input
                      type="range"
                      min={Math.round(minRad * DEG)} max={Math.round(maxRad * DEG)} step={step}
                      value={degVal}
                      onChange={(e) => handleHeadRotationChange(axis, parseFloat(e.target.value) * RAD)}
                      className="control__slider"
                    />
                    <input
                      type="number"
                      value={degVal}
                      step={step}
                      onChange={(e) => handleHeadRotationChange(axis, parseFloat(e.target.value) * RAD)}
                      className="control__number"
                    />
                    <button
                      className="control__reset-field"
                      title="Reset to default"
                      onClick={() => handleHeadRotationChange(axis, def)}
                    >↺</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="control-group">
            <h4 className="control-group__label">Glasses Position</h4>
            {posControls.map(([label, axis, val, def]) => {
              const { min, max } = getRange(-2, 2, fineCenters?.pos[axisIdx[axis]] ?? val, 0.25);
              const step = fineMode ? "0.001" : "0.005";
              return (
                <div className="control-row" key={axis}>
                  <div className="control">
                    <span className="control__label">{label}</span>
                    <input
                      type="range"
                      min={min} max={max} step={step}
                      value={val}
                      onChange={(e) => handlePositionChange(axis, parseFloat(e.target.value))}
                      className="control__slider"
                    />
                    <input
                      type="number"
                      value={parseFloat(val.toFixed(3))}
                      step={step}
                      onChange={(e) => handlePositionChange(axis, parseFloat(e.target.value))}
                      className="control__number"
                    />
                    <button
                      className="control__reset-field"
                      title="Reset to default"
                      onClick={() => handlePositionChange(axis, def)}
                    >↺</button>
                  </div>
                  {axis === "x" && (
                    <p className="control__subtext">
                      Nose bridge gap:{" "}
                      {bridgeDistMm !== null
                        ? <><strong>{bridgeDistMm} mm</strong>
                            {bridgeDistMm > 4 ? " — may be too far" : " — good (0–4 mm is normal)"}
                          </>
                        : <em>measuring…</em>
                      }
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="control-group">
            <h4 className="control-group__label">Glasses Rotation</h4>
            {rotControls.map(([label, axis, val, def]) => {
              const { min: minRad, max: maxRad } = getRange(
                0, Math.PI * 2, fineCenters?.rot[axisIdx[axis]] ?? val, FINE_HALF_ROT,
              );
              const step = fineMode ? "0.5" : "1";
              const degVal = parseFloat((val * DEG).toFixed(1));
              return (
                <div className="control-row" key={axis}>
                  <div className="control">
                    <span className="control__label">{label}</span>
                    <input
                      type="range"
                      min={Math.round(minRad * DEG)} max={Math.round(maxRad * DEG)} step={step}
                      value={degVal}
                      onChange={(e) => handleRotationChange(axis, parseFloat(e.target.value) * RAD)}
                      className="control__slider"
                    />
                    <input
                      type="number"
                      value={degVal}
                      step={step}
                      onChange={(e) => handleRotationChange(axis, parseFloat(e.target.value) * RAD)}
                      className="control__number"
                    />
                    <button
                      className="control__reset-field"
                      title="Reset to default"
                      onClick={() => handleRotationChange(axis, def)}
                    >↺</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="control-group">
            <h4 className="control-group__label">
              Frame Scale
              {frameWidthMm !== null && (
                <span className="control-group__label-sub"> — {frameWidthMm} mm wide</span>
              )}
            </h4>
            <div className="control-row">
              <div className="control">
                <span className="control__label">Width (mm)</span>
                {(() => {
                  const minMm = 80, maxMm = 200;
                  const stepMm = fineMode ? "0.1" : "1";
                  return (
                    <>
                      <input
                        type="range"
                        min={minMm} max={maxMm} step={stepMm}
                        value={frameWidthMm ?? Math.round(glassesScale / DEFAULT_GLASSES_SCALE * 147)}
                        onChange={(e) => handleWidthMmChange(parseFloat(e.target.value))}
                        className="control__slider"
                        disabled={stlBboxWidth === null}
                      />
                      <input
                        type="number"
                        value={frameWidthMm ?? "—"}
                        step={stepMm}
                        onChange={(e) => handleWidthMmChange(parseFloat(e.target.value))}
                        className="control__number"
                        disabled={stlBboxWidth === null}
                      />
                    </>
                  );
                })()}
                <button
                  className="control__reset-field"
                  title="Reset to default"
                  onClick={() => setGlassesScale(DEFAULT_GLASSES_SCALE)}
                >↺</button>
              </div>
              <p className="control__subtext">
                Scale is auto-computed from your STL dimensions — only adjust if you know the size is wrong.
              </p>
            </div>
          </div>

          <div className="controls__actions">
            <button onClick={resetAlignment} className="controls__reset">
              Reset All
            </button>
            <button
              onClick={toggleFine}
              className={`controls__toggle ${fineMode ? "controls__toggle--active" : ""}`}
            >
              {fineMode ? "Fine" : "Coarse"}
            </button>
            <button
              onClick={() => setShowHardpoints((v) => !v)}
              className={`controls__toggle ${showHardpoints ? "controls__toggle--active" : ""}`}
            >
              {showHardpoints ? "Hide" : "Show"} Points
            </button>
          </div>

          <button onClick={triggerSealGeneration} className="controls__generate">
            Generate Seal Preview
          </button>

          {generatedSeal && (
            <div className="controls__downloads">
              <button className="controls__download-btn controls__download-btn--pla" onClick={handlePLADownload}>
                <Download size={15} />
                Download PLA
              </button>
              <button className="controls__download-btn controls__download-btn--tpu" onClick={handleTPUDownload}>
                <Download size={15} />
                Download TPU (Flat)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
