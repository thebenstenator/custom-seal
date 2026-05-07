import { useNavigate, Navigate } from "react-router-dom";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter";
import { Download } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import SceneCanvas from "../shared/SceneCanvas";
import Button from "../shared/Button";
import Notice from "../shared/Notice";
import "./Confirmation.css";

function SealMesh({ geometry }: { geometry: THREE.BufferGeometry | null }) {
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

export default function Confirmation() {
  const navigate = useNavigate();
  const selectedFrame   = useAppStore((s) => s.selectedFrame);
  const generatedSeal   = useAppStore((s) => s.generatedSeal);
  const measurementMode = useAppStore((s) => s.measurementMode);
  if (!selectedFrame) return <Navigate to="/frames" replace />;

  const slug = selectedFrame.name.toLowerCase().replace(/\s+/g, "-");

  const handlePLADownload = () => {
    if (!generatedSeal) return;
    const geo = generatedSeal.clone();
    geo.applyMatrix4(new THREE.Matrix4().makeScale(100, 100, 100));
    exportSTL(geo, `seal-${slug}-pla.stl`);
  };

  return (
    <div className="confirmation">
      <div className="page-header">
        <Button
          variant="back"
          onClick={() => navigate(measurementMode ? "/measure" : "/preview")}
        >
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
            <SceneCanvas cameraPosition={[0, 0.5, 4]}>
              <SealMesh geometry={generatedSeal} />
            </SceneCanvas>
            <p className="confirmation__viewer-hint">
              Left-drag to rotate • Scroll to zoom • Right-drag to pan
            </p>
          </div>

          <div className="confirmation__downloads">
            <div className="confirmation__download-option">
              <div className="confirmation__download-info">
                <h4 className="confirmation__download-title">PLA — Rigid</h4>
                <p className="confirmation__download-desc">
                  Prints in the seal's natural curved shape. Print curved-side
                  down with supports. Good if you have PLA on hand.
                </p>
              </div>
              <button className="confirmation__download-btn confirmation__download-btn--pla" onClick={handlePLADownload}>
                <Download size={18} />
                Download STL (PLA)
              </button>
            </div>

          </div>
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

      <Notice variant="warning">
        <h3 className="notice__title">Get a Better Fit Faster</h3>
        <p className="notice__text">
          Go back and export <strong>2–3 versions</strong> with the{" "}
          <strong>Forward/Back</strong> slider at slightly different positions
          (e.g. −0.01, current, +0.01). Print all three at once — small
          differences in depth can make or break the seal, and testing a few
          variants costs almost no extra material.
        </p>
      </Notice>

      <Notice variant="info">
        <h3 className="notice__title">Printing Tips</h3>
        <ul className="notice__list">
          <li>Recommended layer height: <strong>0.2 mm</strong></li>
          <li>Infill: <strong>15–20%</strong> — the seal doesn't need to be solid</li>
          <li>Print curved-side down with supports enabled</li>
        </ul>
      </Notice>

      <div className="confirmation__footer">
        <Button
          variant="secondary"
          onClick={() => navigate(measurementMode ? "/measure" : "/preview")}
        >
          {measurementMode ? "Adjust Measurements" : "Adjust Alignment"}
        </Button>
        <Button variant="primary" onClick={() => navigate("/")}>
          Start Another Design
        </Button>
      </div>
    </div>
  );
}
