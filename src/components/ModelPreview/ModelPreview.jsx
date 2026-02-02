import React, { Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import Button from "../shared/Button";
import Notice from "../shared/Notice";
import "./ModelPreview.css";

function HeadModel() {
  const geometry = useLoader(STLLoader, "/models/default-head.stl");
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color="#f4a582" />
    </mesh>
  );
}

function GlassesModel() {
  const geometry = useLoader(STLLoader, "/models/default-glasses.stl");
  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.5, 0.3]}
    >
      <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
    </mesh>
  );
}

export default function ModelPreview({ selectedFrame, onBack, onContinue }) {
  return (
    <div className="model-preview">
      <div className="page-header">
        <Button variant="back" onClick={onBack}>
          ← Back
        </Button>
        <h2 className="page-header__title">Preview Your Selection</h2>
        <p className="page-header__subtitle">
          Selected frame:{" "}
          <span className="page-header__selected">{selectedFrame.name}</span>
        </p>
      </div>

      <Notice variant="info">
        <p className="notice__text">
          <strong>Note:</strong> This is a generic head model for demonstration
          purposes only. Your custom seal will be generated from your personal
          3D scan for a perfect fit.
        </p>
      </Notice>

      <div className="model-preview__viewer">
        <Canvas camera={{ position: [0, 2, 5], fov: 50 }}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <directionalLight position={[-10, -10, -5]} intensity={0.3} />
            <HeadModel />
            <GlassesModel />
            <OrbitControls enableZoom={true} enablePan={false} />
          </Suspense>
        </Canvas>
        <p className="model-preview__instructions">
          Drag to rotate • Scroll to zoom
        </p>
      </div>

      <div className="model-preview__actions">
        <Button variant="primary" onClick={onContinue}>
          Continue to Upload Scan
        </Button>
      </div>
    </div>
  );
}
