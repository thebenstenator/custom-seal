import { useNavigate, Navigate } from "react-router-dom";
import { Download, ShoppingCart, Heart } from "lucide-react";
import * as THREE from "three";
import { useAppStore } from "../../store/useAppStore";
import { useSTLModel } from "../../hooks/useSTLModel";
import SceneCanvas from "../shared/SceneCanvas";
import Button from "../shared/Button";
import "./FrameDownload.css";

const KOFI_URL = "https://ko-fi.com/YOUR_KOFI_USERNAME";

function SealPreview({ url }: { url: string }) {
  const geometry = useSTLModel(url);
  if (!geometry) return <div className="frame-download__preview-loading">Loading preview…</div>;
  return (
    <mesh geometry={geometry} scale={0.01}>
      <meshStandardMaterial color="#60a5fa" side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function FrameDownload() {
  const navigate      = useNavigate();
  const selectedFrame = useAppStore((s) => s.selectedFrame);

  if (!selectedFrame) return <Navigate to="/frames" replace />;
  if (!selectedFrame.genericSealUrl) return <Navigate to="/fit-type" replace />;

  const { name, genericSealUrl, affiliateUrl } = selectedFrame;

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = genericSealUrl;
    a.download = `seal-${selectedFrame.id}.stl`;
    a.click();
  };

  return (
    <div className="frame-download">
      <div className="page-header">
        <Button variant="back" onClick={() => navigate("/fit-type")}>
          ← Back
        </Button>
        <h2 className="page-header__title">Ready-Made Seal</h2>
        <p className="page-header__subtitle">
          Frame: <span className="page-header__selected">{name}</span>
        </p>
      </div>

      <div className="frame-download__body">
        <div className="frame-download__info">
          <div className="frame-download__section">
            <h3 className="frame-download__section-title">Your seal is ready</h3>
            <p className="frame-download__text">
              This seal was hand-tuned to fit the <strong>{name}</strong> against
              a reference head model. It's a great starting point for most face
              shapes — if you need a tighter custom fit, use the alignment tool
              instead.
            </p>
          </div>

          <div className="frame-download__actions">
            <button className="frame-download__btn frame-download__btn--primary" onClick={handleDownload}>
              <Download size={18} />
              Download Seal STL
            </button>

            {affiliateUrl && (
              <a
                className="frame-download__btn frame-download__btn--amazon"
                href={affiliateUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ShoppingCart size={18} />
                Buy frames on Amazon
              </a>
            )}

            <a
              className="frame-download__btn frame-download__btn--kofi"
              href={KOFI_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Heart size={18} />
              Leave a tip on Ko-fi
            </a>
          </div>

          <div className="frame-download__section">
            <h3 className="frame-download__section-title">Printing tips</h3>
            <ul className="frame-download__tips">
              <li>Layer height: <strong>0.2 mm</strong></li>
              <li>Infill: <strong>15–20%</strong></li>
              <li>Print face-contact side down with supports</li>
              <li>Material: PLA works well for testing fit</li>
            </ul>
          </div>

          <button
            className="frame-download__custom-link"
            onClick={() => navigate("/fit-type")}
          >
            Need a custom fit? Use the alignment tool →
          </button>
        </div>

        <div className="frame-download__preview">
          <SceneCanvas cameraPosition={[0, 0, 4]}>
            <SealPreview url={genericSealUrl} />
          </SceneCanvas>
          <p className="frame-download__preview-hint">
            Left-drag to rotate • Scroll to zoom
          </p>
        </div>
      </div>
    </div>
  );
}
