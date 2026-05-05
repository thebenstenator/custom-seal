import { useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Upload, CheckCircle, ExternalLink } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import Button from "../shared/Button";
import "./ScanUpload.css";

export default function ScanUpload() {
  const navigate      = useNavigate();
  const selectedFrame = useAppStore((s) => s.selectedFrame);
  const userScan      = useAppStore((s) => s.userScan);
  const setUserScan   = useAppStore((s) => s.setUserScan);
  const inputRef      = useRef<HTMLInputElement>(null);

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
          <h3 className="scan-upload__form-title">Upload Your Face Scan</h3>

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

          <Button
            variant="primary"
            fullWidth
            onClick={() => navigate("/preview")}
          >
            {userScan ? "Continue to Alignment →" : "Skip — Use Demo Head"}
          </Button>
        </div>
      </div>
    </div>
  );
}
