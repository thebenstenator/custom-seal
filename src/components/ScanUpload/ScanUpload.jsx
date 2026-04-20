import React from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Upload, ExternalLink } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import SceneCanvas from "../shared/SceneCanvas";
import { useSTLModel } from "../../hooks/useSTLModel";
import Button from "../shared/Button";
import Notice from "../shared/Notice";
import "./ScanUpload.css";

function DefaultHeadModel() {
  const geometry = useSTLModel("/models/default-head.stl");
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} scale={0.01}>
      <meshStandardMaterial color="#f4a582" />
    </mesh>
  );
}

function GlassesModel() {
  const geometry = useSTLModel("/models/default-glasses.stl");
  return (
    <mesh
      geometry={geometry}
      rotation={[0, Math.PI / 2, 0]}
      position={[-0.875, 0.405, -0.025]}
      scale={0.01}
    >
      <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
    </mesh>
  );
}

export default function ScanUpload() {
  const navigate = useNavigate();
  const selectedFrame = useAppStore((s) => s.selectedFrame);

  if (!selectedFrame) return <Navigate to="/frames" replace />;

  return (
    <div className="scan-upload">
      <div className="page-header">
        <Button variant="back" onClick={() => navigate("/frames")}>
          ← Back
        </Button>
        <h2 className="page-header__title">Scan Your Face</h2>
        <p className="page-header__subtitle">
          Selected frame:{" "}
          <span className="page-header__selected">{selectedFrame.name}</span>
        </p>
      </div>

      <Notice variant="info">
        <p className="notice__text">
          <strong>Preview below:</strong> This shows how your selected glasses
          will look. Follow the scanning instructions, then upload your face
          scan to create a custom fit.
        </p>
      </Notice>

      <div className="scan-upload__preview">
        <h3 className="scan-upload__preview-title">
          Preview: {selectedFrame.name}
        </h3>
        <div className="scan-upload__viewer">
          <SceneCanvas>
            <group rotation={[0, Math.PI / 2, 0]}>
              <DefaultHeadModel />
              <GlassesModel />
            </group>
          </SceneCanvas>
          <p className="scan-upload__viewer-instructions">
            Drag to rotate • Scroll to zoom
          </p>
        </div>
        <p className="scan-upload__preview-note">
          This is a demo head. Upload your scan below to see YOUR face with
          these glasses.
        </p>
      </div>

      <div className="scan-upload__content">
        <div className="scan-instructions">
          <h3 className="scan-instructions__title">How to Scan Your Face</h3>

          <a
            href="https://www.youtube.com/watch?v=bqN5IWSm2zE&t=63s"
            target="_blank"
            rel="noopener noreferrer"
            className="scan-instructions__video-link"
          >
            <ExternalLink size={16} />
            Watch detailed scanning tutorial (skip to 1:03)
          </a>

          <div className="scan-instructions__steps">
            <div className="scan-step">
              <div className="scan-step__number">1</div>
              <div className="scan-step__info">
                <h4 className="scan-step__title">Download a Scanning App</h4>
                <p className="scan-step__description">
                  We recommend <strong>Kiri Engine</strong>,{" "}
                  <strong>Polycam</strong>, or <strong>Scaniverse</strong> — all
                  are free and work on most smartphones.
                </p>
              </div>
            </div>
            <div className="scan-step">
              <div className="scan-step__number">2</div>
              <div className="scan-step__info">
                <h4 className="scan-step__title">Set Up Your Environment</h4>
                <p className="scan-step__description">
                  Sit in a well-lit area with even lighting. Avoid harsh shadows
                  or direct sunlight on your face.
                </p>
              </div>
            </div>
            <div className="scan-step">
              <div className="scan-step__number">3</div>
              <div className="scan-step__info">
                <h4 className="scan-step__title">Scan Your Face</h4>
                <p className="scan-step__description">
                  Keep a neutral expression. Slowly rotate your phone around
                  your face, making sure the area around your eyes and nose
                  bridge is clearly captured.{" "}
                  <strong>You don't need to use Blender</strong> — just export
                  directly from the scanning app.
                </p>
              </div>
            </div>
            <div className="scan-step">
              <div className="scan-step__number">4</div>
              <div className="scan-step__info">
                <h4 className="scan-step__title">Export Your Scan</h4>
                <p className="scan-step__description">
                  Export your scan as an OBJ, PLY, or STL file from your
                  scanning app, then upload it below.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="scan-upload__form">
          <h3 className="scan-upload__form-title">Upload Your Face Scan</h3>

          <div className="upload-area upload-area--disabled">
            <Upload className="upload-area__icon" size={48} />
            <p className="upload-area__title">Upload Feature Coming Soon</p>
            <p className="upload-area__subtitle">
              We're working on optimizing the upload and processing pipeline.
              Continue below to try the alignment tool with a demo head model.
            </p>
          </div>

          <Button variant="primary" fullWidth onClick={() => navigate("/preview")}>
            Continue to Alignment (Demo)
          </Button>
        </div>
      </div>
    </div>
  );
}
