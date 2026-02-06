import React, { useState, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { Upload, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import Button from "../shared/Button";
import Notice from "../shared/Notice";
import "./ScanUpload.css";

function DefaultHeadModel() {
  const geometry = useLoader(STLLoader, "/models/default-head.stl");
  geometry.center();
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} scale={0.01}>
      <meshStandardMaterial color="#f4a582" />
    </mesh>
  );
}

function GlassesModel() {
  const geometry = useLoader(STLLoader, "/models/default-glasses.stl");
  geometry.center();
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

export default function ScanUpload({ selectedFrame, onSubmit }) {
  const navigate = useNavigate();
  const [uploadedFile, setUploadedFile] = useState(null);
  const [error, setError] = useState(null);

  if (!selectedFrame) {
    navigate("/frames");
    return null;
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setError(null);

    if (!file) return;

    const validExtensions = [".obj", ".ply", ".stl", ".glb", ".gltf"];
    const extension = "." + file.name.split(".").pop().toLowerCase();

    if (!validExtensions.includes(extension)) {
      setError(
        "Invalid file type. Please upload an OBJ, PLY, STL, GLB, or GLTF file.",
      );
      return;
    }

    setUploadedFile(file);
  };

  const handleSubmit = () => {
    if (uploadedFile) {
      onSubmit({
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size,
        file: uploadedFile,
      });
      navigate("/preview");
    }
  };

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

      {/* 3D Preview */}
      <div className="scan-upload__preview">
        <h3 className="scan-upload__preview-title">
          Preview: {selectedFrame.name}
        </h3>
        <div className="scan-upload__viewer">
          <Canvas camera={{ position: [0, 0, 7.5], fov: 50 }}>
            <Suspense fallback={null}>
              <ambientLight intensity={0.5} />
              <directionalLight position={[10, 10, 5]} intensity={1} />
              <directionalLight position={[-10, -10, -5]} intensity={0.3} />

              <group rotation={[0, Math.PI / 2, 0]}>
                <DefaultHeadModel />
                <GlassesModel />
              </group>

              <OrbitControls enableZoom={true} enablePan={false} />
            </Suspense>
          </Canvas>
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
        {/* Scanning Instructions */}
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

        {/* Upload Area */}
        <div className="scan-upload__form">
          <h3 className="scan-upload__form-title">Upload Your Face Scan</h3>

          {!uploadedFile ? (
            <label className="upload-area">
              <Upload className="upload-area__icon" size={48} />
              <p className="upload-area__title">
                Drag and drop your 3D scan here
              </p>
              <p className="upload-area__subtitle">or click to browse</p>
              <p className="upload-area__formats">
                Supported formats: OBJ, PLY, STL, GLB, GLTF
              </p>
              <input
                type="file"
                accept=".obj,.ply,.stl,.glb,.gltf"
                onChange={handleFileChange}
                className="upload-area__input"
              />
            </label>
          ) : (
            <div className="upload-success">
              <CheckCircle className="upload-success__icon" size={48} />
              <p className="upload-success__title">{uploadedFile.name}</p>
              <p className="upload-success__size">
                {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <button
                className="upload-success__change"
                onClick={() => setUploadedFile(null)}
              >
                Change file
              </button>
            </div>
          )}

          {error && (
            <div className="upload-error">
              <AlertCircle className="upload-error__icon" size={20} />
              <p className="upload-error__text">{error}</p>
            </div>
          )}

          <Button
            variant="primary"
            fullWidth
            onClick={handleSubmit}
            disabled={!uploadedFile}
          >
            Continue to Position Glasses
          </Button>
        </div>
      </div>
    </div>
  );
}
