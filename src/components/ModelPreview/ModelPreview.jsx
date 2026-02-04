import React, { Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import Button from "../shared/Button";
import Notice from "../shared/Notice";
import "./ModelPreview.css";

function HeadModel() {
  const geometry = useLoader(STLLoader, "/models/default-head.stl");
  geometry.center();
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} scale={0.01}>
      <meshStandardMaterial color="#f4a582" />
    </mesh>
  );
}

function GlassesModel({ position, rotation, scale }) {
  const geometry = useLoader(STLLoader, "/models/default-glasses.stl");
  geometry.center();
  return (
    <mesh
      geometry={geometry}
      rotation={rotation}
      position={position}
      scale={scale}
    >
      <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
    </mesh>
  );
}

export default function ModelPreview({ selectedFrame }) {
  const navigate = useNavigate();

  // State for glasses positioning
  const [glassesPosition, setGlassesPosition] = useState([
    -0.875, 0.405, -0.025,
  ]);
  const [glassesRotation, setGlassesRotation] = useState([0, Math.PI / 2, 0]);
  const [glassesScale, setGlassesScale] = useState(0.01);

  // If no frame is selected, redirect to frame selection
  if (!selectedFrame) {
    navigate("/frames");
    return null;
  }

  const handlePositionChange = (axis, value) => {
    const newPosition = [...glassesPosition];
    const axisIndex = { x: 0, y: 1, z: 2 }[axis];
    newPosition[axisIndex] = parseFloat(value);
    setGlassesPosition(newPosition);
  };

  const handleRotationChange = (axis, value) => {
    const newRotation = [...glassesRotation];
    const axisIndex = { x: 0, y: 1, z: 2 }[axis];
    newRotation[axisIndex] = parseFloat(value);
    setGlassesRotation(newRotation);
  };

  const handleScaleChange = (value) => {
    setGlassesScale(parseFloat(value));
  };

  const resetPosition = () => {
    setGlassesPosition([-0.875, 0.405, -0.025]);
    setGlassesRotation([0, Math.PI / 2, 0]);
    setGlassesScale(0.01);
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
          <strong>Note:</strong> This is a generic head model for demonstration
          purposes. Use the controls below to position the glasses where they
          would sit on a face.
        </p>
      </Notice>

      <div className="model-preview__container">
        <div className="model-preview__viewer">
          <Canvas camera={{ position: [0, 0, 7.5], fov: 50 }}>
            <Suspense fallback={null}>
              <ambientLight intensity={0.5} />
              <directionalLight position={[10, 10, 5]} intensity={1} />
              <directionalLight position={[-10, -10, -5]} intensity={0.3} />

              <group rotation={[0, Math.PI / 2, 0]}>
                <HeadModel />
                <GlassesModel
                  position={glassesPosition}
                  rotation={glassesRotation}
                  scale={glassesScale}
                />
              </group>

              <OrbitControls enableZoom={true} enablePan={false} />
            </Suspense>
          </Canvas>
          <p className="model-preview__instructions">
            Drag to rotate • Scroll to zoom
          </p>
        </div>

        <div className="model-preview__controls">
          <h3 className="controls__title">Adjust Glasses Position</h3>

          <div className="control-group">
            <h4 className="control-group__label">Position</h4>
            <div className="control-row">
              <label className="control">
                <span className="control__label">Forward/Back</span>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.01"
                  value={glassesPosition[0]}
                  onChange={(e) => handlePositionChange("x", e.target.value)}
                  className="control__slider"
                />
                <span className="control__value">
                  {glassesPosition[0].toFixed(2)}
                </span>
              </label>
            </div>
            <div className="control-row">
              <label className="control">
                <span className="control__label">Up/Down</span>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.01"
                  value={glassesPosition[1]}
                  onChange={(e) => handlePositionChange("y", e.target.value)}
                  className="control__slider"
                />
                <span className="control__value">
                  {glassesPosition[1].toFixed(2)}
                </span>
              </label>
            </div>
            <div className="control-row">
              <label className="control">
                <span className="control__label">Left/Right</span>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.01"
                  value={glassesPosition[2]}
                  onChange={(e) => handlePositionChange("z", e.target.value)}
                  className="control__slider"
                />
                <span className="control__value">
                  {glassesPosition[2].toFixed(2)}
                </span>
              </label>
            </div>
          </div>

          <div className="control-group">
            <h4 className="control-group__label">Rotation</h4>
            <div className="control-row">
              <label className="control">
                <span className="control__label">Tilt X</span>
                <input
                  type="range"
                  min="0"
                  max={Math.PI * 2}
                  step="0.01"
                  value={glassesRotation[0]}
                  onChange={(e) => handleRotationChange("x", e.target.value)}
                  className="control__slider"
                />
                <span className="control__value">
                  {glassesRotation[0].toFixed(2)}
                </span>
              </label>
            </div>
            <div className="control-row">
              <label className="control">
                <span className="control__label">Tilt Y</span>
                <input
                  type="range"
                  min="0"
                  max={Math.PI * 2}
                  step="0.01"
                  value={glassesRotation[1]}
                  onChange={(e) => handleRotationChange("y", e.target.value)}
                  className="control__slider"
                />
                <span className="control__value">
                  {glassesRotation[1].toFixed(2)}
                </span>
              </label>
            </div>
            <div className="control-row">
              <label className="control">
                <span className="control__label">Tilt Z</span>
                <input
                  type="range"
                  min="0"
                  max={Math.PI * 2}
                  step="0.01"
                  value={glassesRotation[2]}
                  onChange={(e) => handleRotationChange("z", e.target.value)}
                  className="control__slider"
                />
                <span className="control__value">
                  {glassesRotation[2].toFixed(2)}
                </span>
              </label>
            </div>
          </div>

          <div className="control-group">
            <h4 className="control-group__label">Scale</h4>
            <div className="control-row">
              <label className="control">
                <span className="control__label">Size</span>
                <input
                  type="range"
                  min="0.005"
                  max="0.02"
                  step="0.001"
                  value={glassesScale}
                  onChange={(e) => handleScaleChange(e.target.value)}
                  className="control__slider"
                />
                <span className="control__value">
                  {glassesScale.toFixed(3)}
                </span>
              </label>
            </div>
          </div>

          <button onClick={resetPosition} className="controls__reset">
            Reset to Default
          </button>
        </div>
      </div>

      <div className="model-preview__actions">
        <Button variant="primary" onClick={() => navigate("/scan")}>
          Continue to Upload Scan
        </Button>
      </div>
    </div>
  );
}
