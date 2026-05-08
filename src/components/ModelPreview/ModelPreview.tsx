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

function HeadModel({
  scanFile,
  rotation,
  meshRef,
  onLoadError,
}: HeadModelProps) {
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


interface SealGeneratorResult {
  worldHardpoints: THREE.Vector3[];
  sealGeometry: THREE.BufferGeometry | null;
  rawEdges: SealRawEdges | null;
}

interface SealGeneratorProps {
  glassesMeshRef: React.RefObject<THREE.Mesh | null>;
  headMeshRef: React.RefObject<THREE.Mesh | null>;
  onSealGenerated: (result: SealGeneratorResult) => void;
  symmetrize: boolean;
}

function SealGenerator({
  glassesMeshRef,
  headMeshRef,
  symmetrize,
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
    // localFaceDir: the local axis with the shortest span is the face-depth axis.
    // Used only to build alignMat so that face-depth maps to sliceGeo Z.
    const localFaceDir =
      sz <= sx && sz <= sy
        ? new THREE.Vector3(0, 0, 1)
        : sy <= sx
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);

    const headCenter = new THREE.Vector3();
    new THREE.Box3().setFromObject(head).getCenter(headCenter);

    const alignMat: THREE.Matrix4 | null = (() => {
      if (localFaceDir.z === 1) return null;
      if (localFaceDir.x === 1) {
        return sy >= sz
          ? new THREE.Matrix4().set(
              0,
              1,
              0,
              0,
              0,
              0,
              1,
              0,
              1,
              0,
              0,
              0,
              0,
              0,
              0,
              1,
            )
          : new THREE.Matrix4().set(
              0,
              0,
              1,
              0,
              0,
              1,
              0,
              0,
              1,
              0,
              0,
              0,
              0,
              0,
              0,
              1,
            );
      }
      return sx >= sz
        ? new THREE.Matrix4().set(
            1,
            0,
            0,
            0,
            0,
            0,
            1,
            0,
            0,
            1,
            0,
            0,
            0,
            0,
            0,
            1,
          )
        : new THREE.Matrix4().set(
            0,
            0,
            1,
            0,
            1,
            0,
            0,
            0,
            0,
            1,
            0,
            0,
            0,
            0,
            0,
            1,
          );
    })();
    const alignInv = alignMat ? alignMat.clone().invert() : null;

    const sliceGeo = alignMat
      ? (() => {
          const g = glasses.geometry.clone();
          g.applyMatrix4(alignMat);
          g.computeBoundingBox();
          return g;
        })()
      : glasses.geometry;
    sliceGeo.computeBoundingBox();

    // Center sliceGeo X,Y so the slicer's centroidX < 0 / > 0 thresholds work
    // regardless of where the model sits in its local coordinate space.
    const sliceBB = sliceGeo.boundingBox!;
    const centerOffset = new THREE.Vector3(
      (sliceBB.min.x + sliceBB.max.x) / 2,
      (sliceBB.min.y + sliceBB.max.y) / 2,
      0,
    );
    sliceGeo.translate(-centerOffset.x, -centerOffset.y, 0);
    sliceGeo.computeBoundingBox();

    // Helper: convert a point in sliceGeo local coords to world space.
    const toWorld = (
      localPts: THREE.Vector3[] | null,
    ): THREE.Vector3[] | null =>
      localPts?.map((p) => {
        const v = p.clone();
        v.x += centerOffset.x;
        v.y += centerOffset.y;
        if (alignInv) v.applyMatrix4(alignInv);
        return v.applyMatrix4(glasses.matrixWorld);
      }) ?? null;

    // Determine face-contact Z side geometrically: the Z extreme whose world-space
    // midpoint is closer to the head is the face-contact (skin-side) surface.
    // This avoids the fragile cnAligned dot-product approach which breaks when the
    // local face-depth axis and the glasses→head vector are nearly perpendicular.
    const bbMinZ = sliceGeo.boundingBox!.min.z;
    const bbMaxZ = sliceGeo.boundingBox!.max.z;
    const minPtWorld = toWorld([new THREE.Vector3(0, 0, bbMinZ)])![0];
    const maxPtWorld = toWorld([new THREE.Vector3(0, 0, bbMaxZ)])![0];
    const faceSideZ =
      minPtWorld.distanceTo(headCenter) < maxPtWorld.distanceTo(headCenter)
        ? bbMinZ
        : bbMaxZ;

    // correctedFaceNormal: unit vector pointing from the outer (viewer-facing) surface
    // toward the face-contact surface — i.e., from glasses into the face.
    const facePtWorld = faceSideZ === bbMinZ ? minPtWorld : maxPtWorld;
    const otherPtWorld = faceSideZ === bbMinZ ? maxPtWorld : minPtWorld;
    const correctedFaceNormal = facePtWorld
      .clone()
      .sub(otherPtWorld)
      .normalize();

    // cnAligned: face-contact direction in sliceGeo space — derived from faceSideZ
    // so it's consistent with the geometric face-side detection above.
    const cnAligned = new THREE.Vector3(0, 0, faceSideZ === bbMaxZ ? 1 : -1);

    const best = findBestSliceZ(sliceGeo, 0.5);
    let eyePaths = null;

    if (best?.quality === "good") {
      eyePaths = extractPerEyePaths(best.loops);
    } else if (best) {
      eyePaths = extractPerEyeAggregate(sliceGeo, 120, 0.5, cnAligned);
    }

    if (eyePaths && !eyePaths.skipZRemap) {
      const remap = (path: THREE.Vector3[] | null) =>
        path?.map((p) => new THREE.Vector3(p.x, p.y, faceSideZ)) ?? null;
      eyePaths = {
        leftPath: remap(eyePaths.leftPath),
        rightPath: remap(eyePaths.rightPath),
      };
    }

    const leftWorld = toWorld(eyePaths?.leftPath ?? null);
    const rightWorld = toWorld(eyePaths?.rightPath ?? null);
    const sealNormal = correctedFaceNormal;

    if (!head.geometry.boundsTree) head.geometry.computeBoundsTree();

    const rc = new THREE.Raycaster();
    rc.near = 0.002;
    rc.far = 0.5;

    // Raycast from each frame-edge point toward the face; interpolate misses.
    function getDepths(pts: THREE.Vector3[]): number[] {
      const n = pts.length;
      const depths: number[] = pts.map((p) => {
        rc.set(p, correctedFaceNormal);
        const hits = rc.intersectObject(head!, false);
        return hits.length > 0 ? hits[0].distance : -1;
      });
      for (let i = 0; i < n; i++) {
        if (depths[i] >= 0) continue;
        let lo = -1,
          hi = -1;
        for (let step = 1; step < n; step++) {
          if (lo < 0 && depths[(i - step + n) % n] >= 0)
            lo = (i - step + n) % n;
          if (hi < 0 && depths[(i + step) % n] >= 0) hi = (i + step) % n;
          if (lo >= 0 && hi >= 0) break;
        }
        if (lo >= 0 && hi >= 0) {
          const dLo = (i - lo + n) % n,
            dHi = (hi - i + n) % n;
          depths[i] = (depths[lo] * dHi + depths[hi] * dLo) / (dLo + dHi);
        } else if (lo >= 0) depths[i] = depths[lo];
        else if (hi >= 0) depths[i] = depths[hi];
        else depths[i] = 0.05;
      }
      return depths;
    }

    function buildEdge(
      pts: THREE.Vector3[],
      depths: number[],
    ): THREE.Vector3[] {
      return pts.map((p, i) =>
        p.clone().addScaledVector(correctedFaceNormal, depths[i] + 0.001),
      );
    }

    const leftDepths = leftWorld ? getDepths(leftWorld) : null;
    const rightDepths = rightWorld ? getDepths(rightWorld) : null;

    if (symmetrize && leftDepths && rightDepths) {
      // Equalize the mean depth between the two sides so a tilted frame or
      // slightly asymmetric scan doesn't produce wildly different seal heights.
      const mean = (arr: number[]) =>
        arr.reduce((s, v) => s + v, 0) / arr.length;
      const lm = mean(leftDepths),
        rm = mean(rightDepths);
      const target = (lm + rm) / 2;
      for (let i = 0; i < leftDepths.length; i++) leftDepths[i] += target - lm;
      for (let i = 0; i < rightDepths.length; i++)
        rightDepths[i] += target - rm;
    }

    const leftEdge =
      leftWorld && leftDepths ? buildEdge(leftWorld, leftDepths) : null;
    const rightEdge =
      rightWorld && rightDepths ? buildEdge(rightWorld, rightDepths) : null;

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
        wUp
          .set(0, 0, 1)
          .addScaledVector(correctedFaceNormal, -correctedFaceNormal.z);
      wUp.normalize();
      const wRight = new THREE.Vector3()
        .crossVectors(wUp, correctedFaceNormal)
        .normalize();

      let halfW = 0,
        halfH = 0,
        maxFace = -Infinity;
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

      const faceOrigin = worldCenter
        .clone()
        .addScaledVector(
          correctedFaceNormal,
          maxFace - worldCenter.dot(correctedFaceNormal),
        );
      const worldPath = generateWorldSealPath(
        faceOrigin,
        wRight,
        wUp,
        halfW,
        halfH,
      );
      sealGeometry = generateSeal(worldPath, correctedFaceNormal);
    }

    const rawEdges: SealRawEdges = {
      leftPath: leftWorld,
      rightPath: rightWorld,
      leftFace: leftEdge,
      rightFace: rightEdge,
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

  const selectedFrame = useAppStore((s) => s.selectedFrame);
  const userScan = useAppStore((s) => s.userScan);
  const glassesPosition = useAppStore((s) => s.glassesPosition);
  const glassesRotation = useAppStore((s) => s.glassesRotation);
  const glassesScale = useAppStore((s) => s.glassesScale);
  const headRotation = useAppStore((s) => s.headRotation);
  const setGlassesPosition = useAppStore((s) => s.setGlassesPosition);
  const setGlassesRotation = useAppStore((s) => s.setGlassesRotation);
  const setGlassesScale = useAppStore((s) => s.setGlassesScale);
  const setHeadRotation = useAppStore((s) => s.setHeadRotation);
  const resetAlignment = useAppStore((s) => s.resetAlignment);
  const setHardpoints = useAppStore((s) => s.setHardpoints);
  const setGeneratedSeal = useAppStore((s) => s.setGeneratedSeal);
  const setSealRawEdges = useAppStore((s) => s.setSealRawEdges);
  const generatedSeal = useAppStore((s) => s.generatedSeal);
  const sealRawEdges = useAppStore((s) => s.sealRawEdges);
  const hardpoints = useAppStore((s) => s.hardpoints);
  const triggerSealGeneration = useAppStore((s) => s.triggerSealGeneration);

  const [glassesFile, setGlassesFile] = useState<File | null>(null);
  const [showHardpoints, setShowHardpoints] = useState(false);
  const [fineMode, setFineMode] = useState(false);
  const [fineCenters, setFineCenters] = useState<FineCenters | null>(null);
  const [stlBboxWidth, setStlBboxWidth] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [symmetrize, setSymmetrize] = useState(false);

  const glassesMeshRef = useRef<THREE.Mesh>(null);
  const headMeshRef = useRef<THREE.Mesh>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orbitRef = useRef<any>(null);

  if (!selectedFrame) return <Navigate to="/frames" replace />;

  // Frame width in mm derived from STL geometry width × applied scale × 100
  const frameWidthMm =
    stlBboxWidth !== null
      ? Math.round(stlBboxWidth * glassesScale * 100)
      : null;

  const slug = selectedFrame.name.toLowerCase().replace(/\s+/g, "-");

  const snapView = (
    pos: [number, number, number],
    target: [number, number, number] = [0, 0, 0.3],
  ) => {
    const ctrl = orbitRef.current;
    if (!ctrl) return;
    ctrl.object.position.set(...pos);
    ctrl.target.set(...target);
    ctrl.update();
  };

  const handleAutoOrient = () => {
    const head = headMeshRef.current;
    if (!head) return;

    head.updateMatrixWorld(true);
    if (!head.geometry.boundsTree) head.geometry.computeBoundsTree();

    // ── Position ────────────────────────────────────────────────────────────
    // Coordinate system: Z is up, Y is front (face points toward +Y), X is left-right.
    const headBox = new THREE.Box3().setFromObject(head);
    const headCenterX = (headBox.min.x + headBox.max.x) / 2;
    const headHeight = headBox.max.z - headBox.min.z; // height along Z

    const rc = new THREE.Raycaster();
    rc.near = 0;
    rc.far = 30;

    // Sweep 14 rays from 48% to 76% of head height (Z) to find the nose tip —
    // the most-forward (highest world-Y) point on the face centre-line.
    let noseFwdY = -Infinity;
    let noseHeightZ = headBox.min.z + headHeight * 0.65; // fallback
    for (let i = 0; i < 14; i++) {
      const t = 0.48 + (i / 13) * 0.28;
      const sampleZ = headBox.min.z + headHeight * t;
      rc.set(
        new THREE.Vector3(headCenterX, 15, sampleZ),
        new THREE.Vector3(0, -1, 0),
      );
      const hits = rc.intersectObject(head, false);
      if (hits.length > 0 && hits[0].point.y > noseFwdY) {
        noseFwdY = hits[0].point.y;
        noseHeightZ = sampleZ;
      }
    }
    if (!isFinite(noseFwdY)) noseFwdY = headBox.max.y;

    // The glasses bridge sits above the nose tip. Step up ~5% of head height.
    const bridgeHeightZ = noseHeightZ + headHeight * 0.05;
    rc.set(
      new THREE.Vector3(headCenterX, 15, bridgeHeightZ),
      new THREE.Vector3(0, -1, 0),
    );
    const bridgeHits = rc.intersectObject(head, false);
    const bridgeFwdY = bridgeHits.length > 0 ? bridgeHits[0].point.y : noseFwdY;

    // Convert world → group-local for new rotation [PI/2, 0, -PI/2]:
    //   localX = -worldZ,  localY = worldX,  localZ = -worldY
    setGlassesPosition([-bridgeHeightZ, headCenterX, -(bridgeFwdY + 0.05)]);

    // ── Rotation ────────────────────────────────────────────────────────────
    // Start from the default orientation (glasses depth axis → toward head).
    setGlassesRotation([...DEFAULT_GLASSES_ROTATION]);
  };

  const handleMultiDownload = () => {
    if (!generatedSeal || !sealRawEdges) return;
    const { leftPath, rightPath, leftFace, rightFace, faceNormal } =
      sealRawEdges;

    const prepareGeo = (geo: THREE.BufferGeometry): THREE.BufferGeometry => {
      geo.applyMatrix4(new THREE.Matrix4().makeScale(100, 100, 100));
      // Rotate so the face-contact end (in +faceNormal direction) faces the print bed.
      // Using setFromUnitVectors rather than a hardcoded rotateX so it works for any
      // glasses orientation, not just the default model's axis alignment.
      const printRot = new THREE.Quaternion().setFromUnitVectors(
        faceNormal.clone().normalize(),
        new THREE.Vector3(0, 0, -1),
      );
      geo.applyMatrix4(
        new THREE.Matrix4().makeRotationFromQuaternion(printRot),
      );
      geo.computeBoundingBox();
      const minZ = geo.boundingBox?.min.z ?? 0;
      if (minZ !== 0)
        geo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, -minZ));
      return geo;
    };

    const exportVariant = (offsetMm: number, suffix: string) => {
      let geo: THREE.BufferGeometry | null;

      if (offsetMm === 0 || (!leftPath && !rightPath)) {
        geo = generatedSeal.clone();
      } else {
        // Shift only the glasses-contact edge by offsetMm along the face normal,
        // keeping the face-contact edge fixed. This changes the seal depth the same
        // way moving the glasses forward/back would — positive offset pushes the
        // glasses edge toward the face (shallower seal), negative pulls it away
        // (deeper seal).
        const shift = offsetMm * 0.01; // mm → world units
        const sv = faceNormal.clone().normalize().multiplyScalar(shift);
        const shiftPath = (pts: THREE.Vector3[] | null) =>
          pts?.map((p) => p.clone().add(sv)) ?? null;
        geo = generateDualSeal(
          shiftPath(leftPath),
          shiftPath(rightPath),
          faceNormal,
          leftFace,
          rightFace,
        );
      }

      if (!geo) return;
      exportSTL(prepareGeo(geo), `seal-${slug}${suffix}.stl`);
    };

    exportVariant(0, "");
    exportVariant(+2, "-shallow"); // glasses 2 mm closer → shorter seal
    exportVariant(-2, "-deep"); // glasses 2 mm farther → taller seal
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

  // tuple: [label, axis, value, default, invertSlider?]
  const posControls: Array<[string, AxisKey, number, number, boolean?]> = [
    ["Up/Down", "x", glassesPosition[0], DEFAULT_GLASSES_POSITION[0]],
    ["Left/Right", "y", glassesPosition[1], DEFAULT_GLASSES_POSITION[1], true],
    ["Forward/Back", "z", glassesPosition[2], DEFAULT_GLASSES_POSITION[2]],
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
        <Button
          variant="back"
          onClick={() => navigate(userScan ? "/scan" : "/fit-type")}
        >
          ← Back
        </Button>
        <h2 className="page-header__title">Position Your Glasses</h2>
        <p className="page-header__subtitle">
          {userScan ? (
            <>
              Scan loaded:{" "}
              <span className="page-header__selected">{userScan.name}</span>
            </>
          ) : (
            <>
              Selected frame:{" "}
              <span className="page-header__selected">
                {selectedFrame?.name}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="alignment-tips">
        <div className="alignment-tips__item">
          <span className="alignment-tips__icon">📷</span>
          <span>
            Before aligning: take front and side photos of yourself{" "}
            <em>wearing</em> these glasses — use them as a reference while
            adjusting.
          </span>
        </div>
        <div className="alignment-tips__item">
          <span className="alignment-tips__icon">🖨️</span>
          <span>
            Pro tip: export 2–3 versions with the <strong>Forward/Back</strong>{" "}
            slider at slightly different positions (e.g. −0.01, current, +0.01)
            and test-print them all — small differences in fit matter for
            sealing.
          </span>
        </div>
      </div>

      <div className="model-preview__container">
        <div className="model-preview__viewer">
          <div className="view-snap">
            {(
              [
                ["F", [0, 2.1, 0.45], [0, 0, 0.38]],
                ["B", [0, -7.5, 0.3], [0, 0, 0.3]],
                ["L", [-7.5, 0, 0.3], [0, 0, 0.3]],
                ["R", [7.5, 0, 0.3], [0, 0, 0.3]],
                ["T", [0, 0, 7.5], [0, 0, 0.3]],
              ] as [
                string,
                [number, number, number],
                [number, number, number],
              ][]
            ).map(([label, pos, target]) => (
              <button
                key={label}
                className="view-snap__btn"
                onClick={() => snapView(pos, target)}
                title={
                  label === "F"
                    ? "Front (close-up)"
                    : label === "B"
                      ? "Back"
                      : label === "L"
                        ? "Left"
                        : label === "R"
                          ? "Right"
                          : "Top"
                }
              >
                {label}
              </button>
            ))}
          </div>
          <SceneCanvas
            cameraPosition={[0, 7.5, 0]}
            controlsRef={orbitRef}
            showGizmo
            zUp
          >
            <group rotation={[Math.PI / 2, 0, -Math.PI / 2]}>
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
              symmetrize={symmetrize}
              onSealGenerated={({
                worldHardpoints,
                sealGeometry,
                rawEdges,
              }) => {
                useAppStore.getState().generatedSeal?.dispose();
                setHardpoints(worldHardpoints);
                setGeneratedSeal(sealGeometry);
                setSealRawEdges(rawEdges);
              }}
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
                <span className="glasses-upload__filename">
                  {glassesFile.name}
                </span>
                <button
                  className="glasses-upload__remove"
                  onClick={() => {
                    setGlassesFile(null);
                    resetAlignment();
                  }}
                >
                  ✕
                </button>
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
            <button
              className="controls__auto-orient"
              onClick={handleAutoOrient}
            >
              ⊕ Auto-Orient Glasses
            </button>
          )}

          <div className="control-group">
            <h4 className="control-group__label">Head Orientation</h4>
            {headControls.map(([label, axis, val, def]) => {
              const { min: minRad, max: maxRad } = getRange(
                -Math.PI,
                Math.PI,
                fineCenters?.head[axisIdx[axis]] ?? val,
                FINE_HALF_ROT,
              );
              const step = fineMode ? "0.5" : "1";
              const degStep = parseFloat(step);
              const degVal = parseFloat((val * DEG).toFixed(1));
              return (
                <div className="control-row" key={axis}>
                  <div className="control">
                    <span className="control__label">{label}</span>
                    <button
                      className="control__nudge"
                      onClick={() =>
                        handleHeadRotationChange(axis, val - degStep * RAD)
                      }
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min={Math.round(minRad * DEG)}
                      max={Math.round(maxRad * DEG)}
                      step={step}
                      value={degVal}
                      onChange={(e) =>
                        handleHeadRotationChange(
                          axis,
                          parseFloat(e.target.value) * RAD,
                        )
                      }
                      className="control__slider"
                    />
                    <button
                      className="control__nudge"
                      onClick={() =>
                        handleHeadRotationChange(axis, val + degStep * RAD)
                      }
                    >
                      +
                    </button>
                    <input
                      type="number"
                      value={degVal}
                      step={step}
                      onChange={(e) =>
                        handleHeadRotationChange(
                          axis,
                          parseFloat(e.target.value) * RAD,
                        )
                      }
                      className="control__number"
                    />
                    <button
                      className="control__reset-field"
                      title="Reset to default"
                      onClick={() => handleHeadRotationChange(axis, def)}
                    >
                      ↺
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="control-group">
            <h4 className="control-group__label">Glasses Position</h4>
            {posControls.map(([label, axis, val, def, invert]) => {
              const { min, max } = getRange(
                -2,
                2,
                fineCenters?.pos[axisIdx[axis]] ?? val,
                0.25,
              );
              const step = fineMode ? "0.001" : "0.005";
              const posStep = parseFloat(step);
              // invertSlider: flip slider direction so visual left = world left
              const s = invert ? -1 : 1;
              const setPos = (displayed: number) =>
                handlePositionChange(axis, displayed * s);
              return (
                <div className="control-row" key={axis}>
                  <div className="control">
                    <span className="control__label">{label}</span>
                    <button
                      className="control__nudge"
                      onClick={() => setPos(val * s - posStep)}
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min={s > 0 ? min : -max}
                      max={s > 0 ? max : -min}
                      step={step}
                      value={val * s}
                      onChange={(e) => setPos(parseFloat(e.target.value))}
                      className="control__slider"
                    />
                    <button
                      className="control__nudge"
                      onClick={() => setPos(val * s + posStep)}
                    >
                      +
                    </button>
                    <input
                      type="number"
                      value={parseFloat(val.toFixed(3))}
                      step={step}
                      onChange={(e) =>
                        handlePositionChange(axis, parseFloat(e.target.value))
                      }
                      className="control__number"
                    />
                    <button
                      className="control__reset-field"
                      title="Reset to default"
                      onClick={() => handlePositionChange(axis, def)}
                    >
                      ↺
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="control-group">
            <h4 className="control-group__label">Glasses Rotation</h4>
            {rotControls.map(([label, axis, val, def]) => {
              const { min: minRad, max: maxRad } = getRange(
                0,
                Math.PI * 2,
                fineCenters?.rot[axisIdx[axis]] ?? val,
                FINE_HALF_ROT,
              );
              const step = fineMode ? "0.5" : "1";
              const degStep = parseFloat(step);
              const degVal = parseFloat((val * DEG).toFixed(1));
              return (
                <div className="control-row" key={axis}>
                  <div className="control">
                    <span className="control__label">{label}</span>
                    <button
                      className="control__nudge"
                      onClick={() =>
                        handleRotationChange(axis, val - degStep * RAD)
                      }
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min={Math.round(minRad * DEG)}
                      max={Math.round(maxRad * DEG)}
                      step={step}
                      value={degVal}
                      onChange={(e) =>
                        handleRotationChange(
                          axis,
                          parseFloat(e.target.value) * RAD,
                        )
                      }
                      className="control__slider"
                    />
                    <button
                      className="control__nudge"
                      onClick={() =>
                        handleRotationChange(axis, val + degStep * RAD)
                      }
                    >
                      +
                    </button>
                    <input
                      type="number"
                      value={degVal}
                      step={step}
                      onChange={(e) =>
                        handleRotationChange(
                          axis,
                          parseFloat(e.target.value) * RAD,
                        )
                      }
                      className="control__number"
                    />
                    <button
                      className="control__reset-field"
                      title="Reset to default"
                      onClick={() => handleRotationChange(axis, def)}
                    >
                      ↺
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="control-group">
            <h4 className="control-group__label">
              Frame Scale
              {frameWidthMm !== null && (
                <span className="control-group__label-sub">
                  {" "}
                  — {frameWidthMm} mm wide
                </span>
              )}
            </h4>
            <div className="control-row">
              <div className="control">
                <span className="control__label">Width (mm)</span>
                {(() => {
                  const minMm = 80,
                    maxMm = 200;
                  const stepMm = fineMode ? "0.1" : "1";
                  const mmStep = parseFloat(stepMm);
                  const currentMm =
                    frameWidthMm ??
                    Math.round((glassesScale / DEFAULT_GLASSES_SCALE) * 147);
                  return (
                    <>
                      <button
                        className="control__nudge"
                        disabled={stlBboxWidth === null}
                        onClick={() => handleWidthMmChange(currentMm - mmStep)}
                      >
                        −
                      </button>
                      <input
                        type="range"
                        min={minMm}
                        max={maxMm}
                        step={stepMm}
                        value={currentMm}
                        onChange={(e) =>
                          handleWidthMmChange(parseFloat(e.target.value))
                        }
                        className="control__slider"
                        disabled={stlBboxWidth === null}
                      />
                      <button
                        className="control__nudge"
                        disabled={stlBboxWidth === null}
                        onClick={() => handleWidthMmChange(currentMm + mmStep)}
                      >
                        +
                      </button>
                      <input
                        type="number"
                        value={frameWidthMm ?? "—"}
                        step={stepMm}
                        onChange={(e) =>
                          handleWidthMmChange(parseFloat(e.target.value))
                        }
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
                >
                  ↺
                </button>
              </div>
              <p className="control__subtext">
                Scale is auto-computed from your STL dimensions — only adjust if
                you know the size is wrong.
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
              {fineMode ? "Fine" : "Normal"}
            </button>
            <button
              onClick={() => setShowHardpoints((v) => !v)}
              className={`controls__toggle ${showHardpoints ? "controls__toggle--active" : ""}`}
            >
              {showHardpoints ? "Hide" : "Show"} Points
            </button>
          </div>

          <div className="controls__seal-row">
            <button
              onClick={triggerSealGeneration}
              className="controls__generate"
            >
              Generate Seal Preview
            </button>
            {userScan && (
              <button
                onClick={() => setSymmetrize((v) => !v)}
                className={`controls__toggle ${symmetrize ? "controls__toggle--active" : ""}`}
                title="Equalize left/right seal depth to compensate for slight frame tilt or scan asymmetry"
              >
                Symmetrize
              </button>
            )}
          </div>

          {generatedSeal && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                className="controls__download-btn controls__download-btn--pla"
                onClick={handleMultiDownload}
              >
                <Download size={15} />
                Download Seal (3 variants)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
