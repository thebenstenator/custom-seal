import { useRef, useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Upload, CheckCircle, ExternalLink } from "lucide-react";
import * as THREE from "three";
import { useAppStore, DEFAULT_HEAD_ROTATION } from "../../store/useAppStore";
import { useUploadedModel } from "../../hooks/useSTLModel";
import SceneCanvas from "../shared/SceneCanvas";
import Button from "../shared/Button";
import "./ScanUpload.css";

// Rotation buttons: label, world-axis unit vector, angle (radians)
const ORIENT_BUTTONS = [
  { label: "↻ Spin Left",  axis: new THREE.Vector3(0, 1, 0),  angle:  Math.PI / 2 },
  { label: "↺ Spin Right", axis: new THREE.Vector3(0, 1, 0),  angle: -Math.PI / 2 },
  { label: "↑ Tilt Up",    axis: new THREE.Vector3(1, 0, 0),  angle: -Math.PI / 2 },
  { label: "↓ Tilt Down",  axis: new THREE.Vector3(1, 0, 0),  angle:  Math.PI / 2 },
  { label: "↰ Roll CW",    axis: new THREE.Vector3(0, 0, 1),  angle: -Math.PI / 2 },
  { label: "↱ Roll CCW",   axis: new THREE.Vector3(0, 0, 1),  angle:  Math.PI / 2 },
];

function WizardHeadMesh({
  geometry,
  euler,
}: {
  geometry: THREE.BufferGeometry;
  euler: [number, number, number];
}) {
  return (
    <mesh geometry={geometry} rotation={euler} scale={0.01}>
      <meshStandardMaterial color="#f4a582" side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function ScanUpload() {
  const navigate       = useNavigate();
  const selectedFrame  = useAppStore((s) => s.selectedFrame);
  const userScan       = useAppStore((s) => s.userScan);
  const setUserScan    = useAppStore((s) => s.setUserScan);
  const headRotation   = useAppStore((s) => s.headRotation);
  const setHeadRotation = useAppStore((s) => s.setHeadRotation);
  const inputRef       = useRef<HTMLInputElement>(null);

  // Geometry for the orientation wizard preview
  const [loadError, setLoadError] = useState<string | null>(null);
  const geometry = useUploadedModel(userScan, setLoadError);

  // Accumulated rotation as a quaternion (ref) + euler state for the mesh + display
  const wizQuatRef = useRef(
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...headRotation))
  );
  const [wizEuler, setWizEuler] = useState<[number, number, number]>(
    () => [...headRotation] as [number, number, number]
  );

  // When a new file is uploaded, reset wizard to the default orientation
  useEffect(() => {
    if (userScan) {
      wizQuatRef.current.setFromEuler(new THREE.Euler(...DEFAULT_HEAD_ROTATION));
      setWizEuler([...DEFAULT_HEAD_ROTATION] as [number, number, number]);
      setLoadError(null);
    }
  }, [userScan?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!selectedFrame) return <Navigate to="/frames" replace />;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const valid = [".obj", ".ply", ".stl", ".glb", ".gltf"];
    if (!valid.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      alert("Please upload an OBJ, PLY, STL, GLB, or GLTF file.");
      return;
    }
    setUserScan(file);
  };

  const applyRotation = (axis: THREE.Vector3, angle: number) => {
    const delta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    // Pre-multiply = rotate around world axes (not local)
    wizQuatRef.current.premultiply(delta);
    const e = new THREE.Euler().setFromQuaternion(wizQuatRef.current);
    setWizEuler([e.x, e.y, e.z]);
  };

  const handleConfirm = () => {
    setHeadRotation(wizEuler);
    navigate("/preview");
  };

  const showWizard = Boolean(userScan);

  return (
    <div className="scan-upload">
      <div className="page-header">
        <Button variant="back" onClick={() => navigate("/fit-type")}>
          ← Back
        </Button>
        <h2 className="page-header__title">Scan Your Face</h2>
        <p className="page-header__subtitle">
          Selected frame:{" "}
          <span className="page-header__selected">{selectedFrame.name}</span>
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
                <h4 className="scan-step__title">Export &amp; Upload</h4>
                <p className="scan-step__description">
                  Export your scan as an OBJ, PLY, or STL file, then upload it
                  here. You'll align it with your glasses on the next page.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="scan-upload__form">
          <h3 className="scan-upload__form-title">
            {showWizard ? "Step 1: Upload" : "Upload Your Face Scan"}
          </h3>

          {userScan ? (
            <div className="upload-success">
              <CheckCircle className="upload-success__icon" size={40} />
              <p className="upload-success__title">{userScan.name}</p>
              <p className="upload-success__size">
                {(userScan.size / 1024 / 1024).toFixed(1)} MB
              </p>
              <button
                className="upload-success__change"
                onClick={() => inputRef.current?.click()}
              >
                Change file
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".obj,.ply,.stl,.glb,.gltf"
                onChange={handleFile}
                style={{ display: "none" }}
              />
            </div>
          ) : (
            <label className="upload-area">
              <Upload className="upload-area__icon" size={48} />
              <p className="upload-area__title">Click to upload your scan</p>
              <p className="upload-area__subtitle">
                You'll align it with your glasses on the next page
              </p>
              <p className="upload-area__formats">OBJ · PLY · STL · GLB · GLTF</p>
              <input
                type="file"
                accept=".obj,.ply,.stl,.glb,.gltf"
                onChange={handleFile}
                className="upload-area__input"
              />
            </label>
          )}

          {showWizard && (
            <div className="orient-wizard">
              <h3 className="orient-wizard__title">Step 2: Orient Your Scan</h3>
              <p className="orient-wizard__hint">
                Rotate until your face points <strong>toward you</strong> (toward the camera).
              </p>

              <div className="orient-wizard__viewer">
                {loadError ? (
                  <div className="orient-wizard__error">{loadError}</div>
                ) : !geometry ? (
                  <div className="orient-wizard__loading">Loading scan…</div>
                ) : (
                  <SceneCanvas cameraPosition={[0, 0, 2.5]}>
                    <WizardHeadMesh geometry={geometry} euler={wizEuler} />
                  </SceneCanvas>
                )}
              </div>

              <div className="orient-wizard__buttons">
                {ORIENT_BUTTONS.map(({ label, axis, angle }) => (
                  <button
                    key={label}
                    className="orient-wizard__btn"
                    onClick={() => applyRotation(axis, angle)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button
            variant="primary"
            fullWidth
            onClick={showWizard ? handleConfirm : () => navigate("/preview")}
          >
            {showWizard
              ? "Confirm & Continue to Alignment →"
              : "Skip — Use Demo Head"}
          </Button>
        </div>
      </div>
    </div>
  );
}
