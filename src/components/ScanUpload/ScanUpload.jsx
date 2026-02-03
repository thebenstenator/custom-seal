import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";
import Button from "../shared/Button";
import Notice from "../shared/Notice";
import "./ScanUpload.css";

export default function ScanUpload({ selectedFrame, onSubmit }) {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setError(null);

    if (!selectedFrame) {
      navigate("/frames");
      return null;
    }

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
        frame: selectedFrame,
      });
      navigate("/confirmation");
    }
  };

  return (
    <div className="scan-upload">
      <div className="page-header">
        <Button variant="back" onClick={() => navigate("/preview")}>
          ← Back
        </Button>
        <h2 className="page-header__title">Upload Your 3D Scan</h2>
        <p className="page-header__subtitle">
          Selected frame:{" "}
          <span className="page-header__selected">{selectedFrame.name}</span>
        </p>
      </div>

      <div className="scan-upload__content">
        {/* Scanning Instructions */}
        <div className="scan-instructions">
          <h3 className="scan-instructions__title">How to Scan Your Face</h3>
          <div className="scan-instructions__steps">
            <div className="scan-step">
              <div className="scan-step__number">1</div>
              <div className="scan-step__info">
                <h4 className="scan-step__title">Download a Scanning App</h4>
                <p className="scan-step__description">
                  We recommend <strong>Polycam</strong> or{" "}
                  <strong>Scaniverse</strong> — both are free and work on most
                  smartphones.
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
                  bridge is clearly captured.
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
            Submit Scan
          </Button>
        </div>
      </div>
    </div>
  );
}
