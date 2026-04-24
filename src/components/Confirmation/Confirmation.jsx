import React from "react";
import { useNavigate, Navigate } from "react-router-dom";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter";
import { Download } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import SceneCanvas from "../shared/SceneCanvas";
import { useSTLModel } from "../../hooks/useSTLModel";
import Button from "../shared/Button";
import Notice from "../shared/Notice";
import "./Confirmation.css";

function SealMesh({ geometry }) {
  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#60a5fa"
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function GlassesPreview({ position, rotation, scale }) {
  const geometry = useSTLModel("/models/default-glasses.stl");
  return (
    <mesh geometry={geometry} position={position} rotation={rotation} scale={scale}>
      <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
    </mesh>
  );
}

export default function Confirmation() {
  const navigate = useNavigate();
  const selectedFrame   = useAppStore((s) => s.selectedFrame);
  const generatedSeal   = useAppStore((s) => s.generatedSeal);
  const glassesPosition = useAppStore((s) => s.glassesPosition);
  const glassesRotation = useAppStore((s) => s.glassesRotation);
  const glassesScale    = useAppStore((s) => s.glassesScale);

  if (!selectedFrame) return <Navigate to="/frames" replace />;

  const handleDownload = () => {
    if (!generatedSeal) return;
    const exporter = new STLExporter();
    const scaledGeo = generatedSeal.clone();
    scaledGeo.applyMatrix4(new THREE.Matrix4().makeScale(100, 100, 100));
    const mesh = new THREE.Mesh(scaledGeo);
    const result = exporter.parse(mesh, { binary: true });
    const blob = new Blob([result], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seal-${selectedFrame.name.toLowerCase().replace(/\s+/g, "-")}.stl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="confirmation">
      <div className="page-header">
        <Button variant="back" onClick={() => navigate("/preview")}>
          ← Back
        </Button>
        <h2 className="page-header__title">Your Seal is Ready</h2>
        <p className="page-header__subtitle">
          Frame:{" "}
          <span className="page-header__selected">{selectedFrame.name}</span>
        </p>
      </div>

      {generatedSeal ? (
        <>
          <div className="confirmation__viewer">
            <SceneCanvas cameraPosition={[0, 0, 7.5]}>
              <group rotation={[0, Math.PI / 2, 0]}>
                <GlassesPreview
                  position={glassesPosition}
                  rotation={glassesRotation}
                  scale={glassesScale}
                />
              </group>
              <SealMesh geometry={generatedSeal} />
            </SceneCanvas>
            <p className="confirmation__viewer-hint">
              Left-drag to rotate • Scroll to zoom • Right-drag to pan
            </p>
          </div>

          <button className="confirmation__download" onClick={handleDownload}>
            <Download size={20} />
            Download STL
          </button>
        </>
      ) : (
        <Notice variant="info">
          <p className="notice__text">
            No seal generated yet.{" "}
            <button
              className="confirmation__inline-link"
              onClick={() => navigate("/preview")}
            >
              Go back and click "Generate Seal Preview" first.
            </button>
          </p>
        </Notice>
      )}

      <Notice variant="info">
        <h3 className="notice__title">Printing Tips</h3>
        <ul className="notice__list">
          <li>
            Print with <strong>TPU (flexible filament)</strong> for a
            comfortable, conforming fit
          </li>
          <li>
            Recommended layer height: <strong>0.2mm</strong>
          </li>
          <li>
            Infill: <strong>15–20%</strong> — the seal doesn't need to be solid
          </li>
          <li>No supports needed for most designs</li>
        </ul>
      </Notice>

      <div className="confirmation__footer">
        <Button variant="secondary" onClick={() => navigate("/preview")}>
          Adjust Alignment
        </Button>
        <Button variant="primary" onClick={() => navigate("/")}>
          Start Another Design
        </Button>
      </div>
    </div>
  );
}
