import React, { useState, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useFrame } from "@react-three/fiber";
import { Upload } from "lucide-react";
import * as THREE from "three";
import {
  useAppStore,
  DEFAULT_GLASSES_POSITION,
  DEFAULT_GLASSES_ROTATION,
  DEFAULT_GLASSES_SCALE,
  DEFAULT_HEAD_ROTATION,
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

function HeadModel({ scanFile, rotation, meshRef }) {
  const uploaded = useUploadedModel(scanFile);
  const defaultGeo = useSTLModel("/models/default-head.stl");
  const geometry = scanFile ? uploaded : defaultGeo;
  if (!geometry) return null;
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      rotation={[-Math.PI / 2, rotation[1], rotation[2]]}
      scale={0.01}
    >
      <meshStandardMaterial color="#f4a582" />
    </mesh>
  );
}

function GlassesModel({ glassesFile, position, rotation, scale, meshRef }) {
  const uploaded = useUploadedModel(glassesFile);
  const defaultGeo = useSTLModel("/models/default-glasses.stl");
  const geometry = glassesFile ? uploaded : defaultGeo;
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

function SealPreview({ geometry }) {
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

function HardpointMarkers({ points }) {
  if (!points) return null;
  return (
    <>
      {Object.values(points).map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
      ))}
    </>
  );
}

// Watches sealTrigger from the store; runs generation on the next frame after trigger increments.
// useFrame is the correct R3F pattern for reading mesh state from inside the Canvas.
function SealGenerator({ glassesMeshRef, headMeshRef, onSealGenerated }) {
  const sealTrigger = useAppStore((s) => s.sealTrigger);
  const lastTrigger = useRef(0);

  useFrame(() => {
    if (sealTrigger === lastTrigger.current) return;
    const glasses = glassesMeshRef.current;
    const head = headMeshRef.current;
    if (!glasses || !head) return;

    lastTrigger.current = sealTrigger;

    glasses.updateMatrixWorld(true);
    head.updateMatrixWorld(true);

    glasses.geometry.computeBoundingBox();
    const bb = glasses.geometry.boundingBox;

    // Glasses frames are always thinnest along their depth axis (face normal direction).
    // Auto-detect which local axis that is rather than assuming Z.
    const sx = bb.max.x - bb.min.x;
    const sy = bb.max.y - bb.min.y;
    const sz = bb.max.z - bb.min.z;
    const localFaceDir =
      sz <= sx && sz <= sy ? new THREE.Vector3(0, 0, 1) :
      sy <= sx             ? new THREE.Vector3(0, 1, 0) :
                             new THREE.Vector3(1, 0, 0);
    const faceNormal = localFaceDir.clone().transformDirection(glasses.matrixWorld).normalize();
    console.log("[seal] face axis:", sz <= sx && sz <= sy ? "Z" : sy <= sx ? "Y" : "X",
      "sizes:", sx.toFixed(1), sy.toFixed(1), sz.toFixed(1));

    // Ensure faceNormal points toward the face/head, not away from it.
    // The thinnest-axis heuristic gives us the right axis but not the right sign.
    const headCenter = new THREE.Vector3();
    new THREE.Box3().setFromObject(head).getCenter(headCenter);
    const glassesWorldCenter = new THREE.Vector3();
    new THREE.Box3().setFromObject(glasses).getCenter(glassesWorldCenter);
    const toHead = headCenter.clone().sub(glassesWorldCenter).normalize();
    const correctedFaceNormal = faceNormal.dot(toHead) >= 0
      ? faceNormal.clone()
      : faceNormal.clone().negate();

    // Build a permutation matrix so the face axis becomes Z and the wider
    // non-face axis becomes X — both required by findBestSliceZ / extractPerEyePaths.
    const alignMat = (() => {
      if (localFaceDir.z === 1) return null; // already canonical, no-op
      if (localFaceDir.x === 1) {
        // depth=X → X to Z; put the wider of Y/Z into X
        return sy >= sz
          ? new THREE.Matrix4().set(0,1,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,1) // [y,z,x]
          : new THREE.Matrix4().set(0,0,1,0, 0,1,0,0, 1,0,0,0, 0,0,0,1); // [z,y,x]
      }
      // depth=Y → Y to Z; put the wider of X/Z into X
      return sx >= sz
        ? new THREE.Matrix4().set(1,0,0,0, 0,0,1,0, 0,1,0,0, 0,0,0,1) // [x,z,y]
        : new THREE.Matrix4().set(0,0,1,0, 1,0,0,0, 0,1,0,0, 0,0,0,1); // [z,x,y]
    })();
    const alignInv = alignMat ? alignMat.clone().invert() : null;

    // Transform aligned-local → original-local → world
    const toWorld = (localPts) =>
      localPts?.map((p) => {
        const v = p.clone();
        if (alignInv) v.applyMatrix4(alignInv);
        return v.applyMatrix4(glasses.matrixWorld);
      }) ?? null;

    // Compute face-side Z up front so extractPerEyeAggregate can filter
    // inner-wall vertices to the face-contact depth (curvature fix).
    const sliceGeo = alignMat
      ? (() => { const g = glasses.geometry.clone(); g.applyMatrix4(alignMat); g.computeBoundingBox(); return g; })()
      : glasses.geometry;
    const cnAligned = correctedFaceNormal.clone()
      .transformDirection(glasses.matrixWorld.clone().invert());
    if (alignMat) cnAligned.applyMatrix4(alignMat);
    sliceGeo.computeBoundingBox();
    const faceSideZ = cnAligned.z >= 0
      ? sliceGeo.boundingBox.max.z
      : sliceGeo.boundingBox.min.z;

    const best = findBestSliceZ(sliceGeo, 0.5);
    let eyePaths = null;

    if (best?.quality === "good") {
      eyePaths = extractPerEyePaths(best.loops);
    } else if (best) {
      eyePaths = extractPerEyeAggregate(sliceGeo, 120, 0.5, cnAligned);
    }

    // Remap all Z coords to the face-contact surface — unless the path was
    // extracted directly from the face-contact surface (skipZRemap flag).
    if (eyePaths && best?.quality !== "good" && !eyePaths.skipZRemap) {
      console.log("[seal] partial: face-side Z", faceSideZ.toFixed(2), "cnAligned.z", cnAligned.z.toFixed(2));
      const remap = (path) => path?.map((p) => new THREE.Vector3(p.x, p.y, faceSideZ));
      eyePaths = { leftPath: remap(eyePaths.leftPath), rightPath: remap(eyePaths.rightPath) };
    }

    const leftWorld = toWorld(eyePaths?.leftPath);
    const rightWorld = toWorld(eyePaths?.rightPath);
    const sealNormal = best?.quality !== "good" ? correctedFaceNormal : faceNormal;
    let sealGeometry = eyePaths
      ? generateDualSeal(leftWorld, rightWorld, sealNormal)
      : null;
    const worldHardpoints = [...(leftWorld ?? []), ...(rightWorld ?? [])];
    console.log(
      "[seal] Tier 2 — left:",
      leftWorld?.length ?? 0,
      "right:",
      rightWorld?.length ?? 0,
    );

    // Tier 3: world-space bounding box fallback (works for any model orientation/size)
    if (!sealGeometry) {
      const worldBox = new THREE.Box3().setFromObject(glasses);
      const worldCenter = new THREE.Vector3();
      worldBox.getCenter(worldCenter);

      // Build right/up basis vectors in the face plane
      const wUp = new THREE.Vector3(0, 1, 0);
      wUp.addScaledVector(correctedFaceNormal, -wUp.dot(correctedFaceNormal));
      if (wUp.lengthSq() < 0.01) wUp.set(0, 0, 1).addScaledVector(correctedFaceNormal, -correctedFaceNormal.z);
      wUp.normalize();
      const wRight = new THREE.Vector3().crossVectors(wUp, correctedFaceNormal).normalize();

      // Project all 8 BB corners to find face-plane extents and face-side depth
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
        correctedFaceNormal, maxFace - worldCenter.dot(correctedFaceNormal)
      );
      const worldPath = generateWorldSealPath(faceOrigin, wRight, wUp, halfW, halfH);
      sealGeometry = generateSeal(worldPath, correctedFaceNormal);
      console.log("[seal] Tier 3 world-space fallback, halfW:", halfW.toFixed(3), "halfH:", halfH.toFixed(3));
    }

    onSealGenerated({ worldHardpoints, sealGeometry });
  });

  return null;
}

// --- Main component ---

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
  const generatedSeal = useAppStore((s) => s.generatedSeal);
  const hardpoints = useAppStore((s) => s.hardpoints);
  const triggerSealGeneration = useAppStore((s) => s.triggerSealGeneration);

  const [uploadedScan, setUploadedScan] = useState(userScan?.file || null);
  const [glassesFile, setGlassesFile] = useState(null);
  const [showHardpoints, setShowHardpoints] = useState(false);
  const [fineMode, setFineMode] = useState(false);
  const [fineCenters, setFineCenters] = useState(null);

  const glassesMeshRef = useRef(null);
  const headMeshRef = useRef(null);

  if (!selectedFrame) return <Navigate to="/frames" replace />;

  const handleScanUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const validExtensions = [".obj", ".ply", ".stl", ".glb", ".gltf"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (validExtensions.includes(ext)) {
      setUploadedScan(file);
    } else {
      alert(
        "Invalid file type. Please upload an OBJ, PLY, STL, GLB, or GLTF file.",
      );
    }
  };

  const handleGlassesUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const validExts = [".stl", ".glb", ".gltf", ".obj", ".ply"];
    if (!validExts.some(ext => file.name.toLowerCase().endsWith(ext))) {
      alert("Please upload an STL, GLB, GLTF, OBJ, or PLY file.");
      return;
    }
    setGlassesFile(file);
    resetAlignment();
  };

  const handlePositionChange = (axis, value) => {
    const next = [...glassesPosition];
    next[{ x: 0, y: 1, z: 2 }[axis]] = parseFloat(value);
    setGlassesPosition(next);
  };

  const handleRotationChange = (axis, value) => {
    const next = [...glassesRotation];
    next[{ x: 0, y: 1, z: 2 }[axis]] = parseFloat(value);
    setGlassesRotation(next);
  };

  const handleHeadRotationChange = (axis, value) => {
    const next = [...headRotation];
    next[{ x: 0, y: 1, z: 2 }[axis]] = parseFloat(value);
    setHeadRotation(next);
  };

  const axisIdx = { x: 0, y: 1, z: 2 };
  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;
  const FINE_HALF_ROT = 15 * RAD; // ±15° for fine rotation mode

  const toggleFine = () => {
    if (!fineMode) {
      setFineCenters({
        pos: [...glassesPosition],
        rot: [...glassesRotation],
        scale: glassesScale,
        head: [...headRotation],
      });
    }
    setFineMode((f) => !f);
  };

  const getRange = (coarseMin, coarseMax, fineCenter, fineHalf) =>
    fineMode && fineCenters != null
      ? { min: fineCenter - fineHalf, max: fineCenter + fineHalf }
      : { min: coarseMin, max: coarseMax };

  const handleContinue = () => {
    navigate("/confirmation");
  };

  return (
    <div className="model-preview">
      <div className="page-header">
        <Button variant="back" onClick={() => navigate("/frames")}>
          ← Back
        </Button>
        <h2 className="page-header__title">Position Your Glasses</h2>
        <p className="page-header__subtitle">
          Selected frame:{" "}
          <span className="page-header__selected">
            {selectedFrame?.name || "None"}
          </span>
        </p>
      </div>

      <Notice variant="info">
        <p className="notice__text">
          {uploadedScan ? (
            <>
              <strong>Your scan is loaded!</strong> Position the glasses exactly
              where they sit on your face.
            </>
          ) : (
            <>
              <strong>Demo Mode:</strong> Generic head model. Upload your face
              scan below for a custom fit.
            </>
          )}
        </p>
      </Notice>

      {!uploadedScan && (
        <div className="scan-upload-section">
          <label className="scan-upload-button">
            <Upload size={20} />
            <span>Upload Your Face Scan (Optional)</span>
            <input
              type="file"
              accept=".obj,.ply,.stl,.glb,.gltf"
              onChange={handleScanUpload}
              className="scan-upload-input"
            />
          </label>
        </div>
      )}

      <div className="model-preview__container">
        <div className="model-preview__viewer">
          <SceneCanvas cameraPosition={[0, 0, 7.5]}>
            <group rotation={[0, Math.PI / 2, 0]}>
              <HeadModel
                scanFile={uploadedScan}
                rotation={headRotation}
                meshRef={headMeshRef}
              />
              <GlassesModel
                glassesFile={glassesFile}
                position={glassesPosition}
                rotation={glassesRotation}
                scale={glassesScale}
                meshRef={glassesMeshRef}
              />
            </group>

            {/* World-space geometry — must be outside the group to avoid double-transform */}
            <SealPreview geometry={generatedSeal} />
            {showHardpoints && <HardpointMarkers points={hardpoints} />}

            <SealGenerator
              glassesMeshRef={glassesMeshRef}
              headMeshRef={headMeshRef}
              onSealGenerated={({ worldHardpoints, sealGeometry }) => {
                setHardpoints(worldHardpoints);
                setGeneratedSeal(sealGeometry);
              }}
            />
          </SceneCanvas>
          <p className="model-preview__instructions">
            Left-drag to rotate • Scroll to zoom • Right-drag to pan
          </p>
        </div>

        <div className="model-preview__controls">
          <h3 className="controls__title">Adjust Alignment</h3>

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

          <div className="control-group">
            <h4 className="control-group__label">Head Orientation</h4>
            {[
              ["Rotate Y", "y", headRotation[1], DEFAULT_HEAD_ROTATION[1]],
              ["Rotate Z", "z", headRotation[2], DEFAULT_HEAD_ROTATION[2]],
            ].map(([label, axis, val, def]) => {
              const { min: minRad, max: maxRad } = getRange(-Math.PI, Math.PI, fineCenters?.head[axisIdx[axis]] ?? val, FINE_HALF_ROT);
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
            {[
              ["Forward/Back", "x", glassesPosition[0], DEFAULT_GLASSES_POSITION[0]],
              ["Up/Down",      "y", glassesPosition[1], DEFAULT_GLASSES_POSITION[1]],
              ["Left/Right",   "z", glassesPosition[2], DEFAULT_GLASSES_POSITION[2]],
            ].map(([label, axis, val, def]) => {
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
                      onChange={(e) => handlePositionChange(axis, e.target.value)}
                      className="control__slider"
                    />
                    <input
                      type="number"
                      value={parseFloat(val.toFixed(3))}
                      step={step}
                      onChange={(e) => handlePositionChange(axis, e.target.value)}
                      className="control__number"
                    />
                    <button
                      className="control__reset-field"
                      title="Reset to default"
                      onClick={() => handlePositionChange(axis, def)}
                    >↺</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="control-group">
            <h4 className="control-group__label">Glasses Rotation</h4>
            {[
              ["Tilt X", "x", glassesRotation[0], DEFAULT_GLASSES_ROTATION[0]],
              ["Tilt Y", "y", glassesRotation[1], DEFAULT_GLASSES_ROTATION[1]],
              ["Tilt Z", "z", glassesRotation[2], DEFAULT_GLASSES_ROTATION[2]],
            ].map(([label, axis, val, def]) => {
              const { min: minRad, max: maxRad } = getRange(0, Math.PI * 2, fineCenters?.rot[axisIdx[axis]] ?? val, FINE_HALF_ROT);
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
            <h4 className="control-group__label">Glasses Scale</h4>
            <div className="control-row">
              <div className="control">
                <span className="control__label">Size</span>
                {(() => {
                  const { min, max } = getRange(0.005, 0.02, fineCenters?.scale ?? glassesScale, 0.003);
                  const step = fineMode ? "0.0001" : "0.0005";
                  return (
                    <>
                      <input
                        type="range"
                        min={min} max={max} step={step}
                        value={glassesScale}
                        onChange={(e) => setGlassesScale(parseFloat(e.target.value))}
                        className="control__slider"
                      />
                      <input
                        type="number"
                        value={parseFloat(glassesScale.toFixed(4))}
                        step={step}
                        onChange={(e) => setGlassesScale(parseFloat(e.target.value))}
                        className="control__number"
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

          <button
            onClick={triggerSealGeneration}
            className="controls__generate"
          >
            Generate Seal Preview
          </button>
        </div>
      </div>

      <div className="model-preview__actions">
        <Button variant="primary" onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
