import React, { Suspense, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useFrame } from "@react-three/fiber";
import { Upload } from "lucide-react";
import * as THREE from "three";
import { useAppStore } from "../../store/useAppStore";
import SceneCanvas from "../shared/SceneCanvas";
import { useSTLModel, useUploadedModel } from "../../hooks/useSTLModel";
import { deriveHardpointsFromBbox, transformHardpoints } from "../../utils/geometry/hardpoints";
import { buildFaceBVH, generateSeal } from "../../utils/geometry/sealGenerator";
import Button from "../shared/Button";
import Notice from "../shared/Notice";
import "./ModelPreview.css";

// --- Scene sub-components ---

function HeadModel({ scanFile, rotation, meshRef }) {
  const geometry = scanFile
    ? useUploadedModel(scanFile)
    : useSTLModel("/models/default-head.stl");

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

function GlassesModel({ position, rotation, scale, meshRef }) {
  const geometry = useSTLModel("/models/default-glasses.stl");
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
  const lastTrigger = useRef(-1);

  useFrame(() => {
    if (sealTrigger === lastTrigger.current) return;
    const glasses = glassesMeshRef.current;
    const head = headMeshRef.current;
    if (!glasses || !head) return;

    lastTrigger.current = sealTrigger;

    glasses.updateMatrixWorld(true);
    head.updateMatrixWorld(true);

    const rawHardpoints = deriveHardpointsFromBbox(glasses.geometry);
    const worldHardpoints = transformHardpoints(rawHardpoints, glasses.matrixWorld);

    buildFaceBVH(head.geometry);
    const sealGeometry = generateSeal(worldHardpoints, head);

    onSealGenerated({ worldHardpoints, sealGeometry });
  });

  return null;
}

// --- Main component ---

export default function ModelPreview() {
  const navigate = useNavigate();

  const selectedFrame   = useAppStore((s) => s.selectedFrame);
  const userScan        = useAppStore((s) => s.userScan);
  const glassesPosition = useAppStore((s) => s.glassesPosition);
  const glassesRotation = useAppStore((s) => s.glassesRotation);
  const glassesScale    = useAppStore((s) => s.glassesScale);
  const headRotation    = useAppStore((s) => s.headRotation);
  const setGlassesPosition = useAppStore((s) => s.setGlassesPosition);
  const setGlassesRotation = useAppStore((s) => s.setGlassesRotation);
  const setGlassesScale    = useAppStore((s) => s.setGlassesScale);
  const setHeadRotation    = useAppStore((s) => s.setHeadRotation);
  const resetAlignment     = useAppStore((s) => s.resetAlignment);
  const setHardpoints          = useAppStore((s) => s.setHardpoints);
  const setGeneratedSeal       = useAppStore((s) => s.setGeneratedSeal);
  const generatedSeal          = useAppStore((s) => s.generatedSeal);
  const hardpoints             = useAppStore((s) => s.hardpoints);
  const triggerSealGeneration  = useAppStore((s) => s.triggerSealGeneration);

  const [uploadedScan, setUploadedScan] = useState(userScan?.file || null);
  const [showHardpoints, setShowHardpoints] = useState(false);

  const glassesMeshRef = useRef(null);
  const headMeshRef    = useRef(null);

  if (!selectedFrame) {
    navigate("/frames");
    return null;
  }

  const handleScanUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const validExtensions = [".obj", ".ply", ".stl", ".glb", ".gltf"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (validExtensions.includes(ext)) {
      setUploadedScan(file);
    } else {
      alert("Invalid file type. Please upload an OBJ, PLY, STL, GLB, or GLTF file.");
    }
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
            <><strong>Your scan is loaded!</strong> Position the glasses exactly where they sit on your face.</>
          ) : (
            <><strong>Demo Mode:</strong> Generic head model. Upload your face scan below for a custom fit.</>
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
                position={glassesPosition}
                rotation={glassesRotation}
                scale={glassesScale}
                meshRef={glassesMeshRef}
              />
              <SealPreview geometry={generatedSeal} />
              {showHardpoints && <HardpointMarkers points={hardpoints} />}
            </group>

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
            Drag to rotate • Scroll to zoom
          </p>
        </div>

        <div className="model-preview__controls">
          <h3 className="controls__title">Adjust Alignment</h3>

          <div className="control-group">
            <h4 className="control-group__label">Head Orientation</h4>
            {[["Rotate Y", "y", headRotation[1]], ["Rotate Z", "z", headRotation[2]]].map(
              ([label, axis, val]) => (
                <div className="control-row" key={axis}>
                  <label className="control">
                    <span className="control__label">{label}</span>
                    <input
                      type="range"
                      min={-Math.PI} max={Math.PI} step="0.01"
                      value={val}
                      onChange={(e) => handleHeadRotationChange(axis, e.target.value)}
                      className="control__slider"
                    />
                    <span className="control__value">{val.toFixed(2)}</span>
                  </label>
                </div>
              )
            )}
          </div>

          <div className="control-group">
            <h4 className="control-group__label">Glasses Position</h4>
            {[
              ["Forward/Back", "x", glassesPosition[0]],
              ["Up/Down",      "y", glassesPosition[1]],
              ["Left/Right",   "z", glassesPosition[2]],
            ].map(([label, axis, val]) => (
              <div className="control-row" key={axis}>
                <label className="control">
                  <span className="control__label">{label}</span>
                  <input
                    type="range"
                    min="-2" max="2" step="0.01"
                    value={val}
                    onChange={(e) => handlePositionChange(axis, e.target.value)}
                    className="control__slider"
                  />
                  <span className="control__value">{val.toFixed(2)}</span>
                </label>
              </div>
            ))}
          </div>

          <div className="control-group">
            <h4 className="control-group__label">Glasses Rotation</h4>
            {[
              ["Tilt X", "x", glassesRotation[0]],
              ["Tilt Y", "y", glassesRotation[1]],
              ["Tilt Z", "z", glassesRotation[2]],
            ].map(([label, axis, val]) => (
              <div className="control-row" key={axis}>
                <label className="control">
                  <span className="control__label">{label}</span>
                  <input
                    type="range"
                    min="0" max={Math.PI * 2} step="0.01"
                    value={val}
                    onChange={(e) => handleRotationChange(axis, e.target.value)}
                    className="control__slider"
                  />
                  <span className="control__value">{val.toFixed(2)}</span>
                </label>
              </div>
            ))}
          </div>

          <div className="control-group">
            <h4 className="control-group__label">Glasses Scale</h4>
            <div className="control-row">
              <label className="control">
                <span className="control__label">Size</span>
                <input
                  type="range"
                  min="0.005" max="0.02" step="0.001"
                  value={glassesScale}
                  onChange={(e) => setGlassesScale(parseFloat(e.target.value))}
                  className="control__slider"
                />
                <span className="control__value">{glassesScale.toFixed(3)}</span>
              </label>
            </div>
          </div>

          <div className="controls__actions">
            <button onClick={resetAlignment} className="controls__reset">
              Reset
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
