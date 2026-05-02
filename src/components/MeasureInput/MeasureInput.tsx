import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import * as THREE from "three";
import { useAppStore } from "../../store/useAppStore";
import { generateParametricSealPath } from "../../utils/geometry/parametricSeal";
import { generateSeal } from "../../utils/geometry/sealGenerator";
import SceneCanvas from "../shared/SceneCanvas";
import Button from "../shared/Button";
import "./MeasureInput.css";

const SCALE = 0.01;

function buildSeal(
  lensWidth: number,
  bridgeWidth: number,
  lensHeight: number,
): THREE.BufferGeometry | null {
  if (!lensWidth || !bridgeWidth || !lensHeight) return null;
  const path = generateParametricSealPath({ lensWidth, bridgeWidth, lensHeight }, 0);
  const worldPath = path.map((p) => p.clone().multiplyScalar(SCALE));
  return generateSeal(worldPath, new THREE.Vector3(0, 0, 1));
}

interface SealPreviewProps {
  geometry: THREE.BufferGeometry | null;
}

function SealPreview({ geometry }: SealPreviewProps) {
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

export default function MeasureInput() {
  const navigate        = useNavigate();
  const selectedFrame   = useAppStore((s) => s.selectedFrame);
  const setGeneratedSeal = useAppStore((s) => s.setGeneratedSeal);
  const setMeasurements  = useAppStore((s) => s.setMeasurements);
  const setMeasurementMode = useAppStore((s) => s.setMeasurementMode);

  if (!selectedFrame) return <Navigate to="/frames" replace />;

  const [lensWidth, setLensWidth]     = useState(52);
  const [bridgeWidth, setBridgeWidth] = useState(17);
  const [lensHeight, setLensHeight]   = useState(39);
  const [heightManual, setHeightManual] = useState(false);

  const [photo, setPhoto]       = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!heightManual) {
      setLensHeight(Math.round(lensWidth * 0.75));
    }
  }, [lensWidth, heightManual]);

  useEffect(() => {
    if (!photo) { setPhotoUrl(null); return; }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const sealGeometry = useMemo(
    () => buildSeal(lensWidth, bridgeWidth, lensHeight),
    [lensWidth, bridgeWidth, lensHeight],
  );

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPhoto(file);
  }

  function handleUse() {
    const m = { lensWidth, bridgeWidth, lensHeight };
    setMeasurements(m);
    setMeasurementMode(true);
    setGeneratedSeal(sealGeometry);
    navigate("/confirmation");
  }

  function numField(
    label: string,
    value: number,
    setter: (v: number) => void,
    extra?: string,
  ) {
    return (
      <div className="measure-input__field">
        <label className="measure-input__label">{label}</label>
        <div className="measure-input__input-row">
          <input
            className="measure-input__number"
            type="number"
            min={1}
            max={200}
            value={value}
            onChange={(e) => setter(Number(e.target.value))}
          />
          <span className="measure-input__unit">mm</span>
        </div>
        {extra && <p className="measure-input__hint">{extra}</p>}
      </div>
    );
  }

  return (
    <div className="measure-input">
      <div className="page-header">
        <Button variant="back" onClick={() => navigate("/scan")}>
          ← Back
        </Button>
        <h2 className="page-header__title">Enter Measurements</h2>
        <p className="page-header__subtitle">
          Frame: <span className="page-header__selected">{selectedFrame.name}</span>
        </p>
      </div>

      <div className="measure-input__callout">
        <strong>Where to find these numbers:</strong> Look inside your glasses frame for a
        stamp like <code>52 □ 17 – 135</code>. That's lens width (52), bridge width (17),
        and temple length (135). Lens height isn't printed — measure it with a ruler or use
        the auto-derived default.
      </div>

      <div className="measure-input__layout">
        <div className="measure-input__form">
          {numField("Lens Width", lensWidth, setLensWidth)}
          {numField("Bridge Width", bridgeWidth, setBridgeWidth)}
          <div className="measure-input__field">
            <label className="measure-input__label">Lens Height</label>
            <div className="measure-input__input-row">
              <input
                className="measure-input__number"
                type="number"
                min={1}
                max={200}
                value={lensHeight}
                onChange={(e) => {
                  setHeightManual(true);
                  setLensHeight(Number(e.target.value));
                }}
              />
              <span className="measure-input__unit">mm</span>
              {heightManual && (
                <button
                  className="measure-input__reset"
                  title="Reset to auto"
                  onClick={() => setHeightManual(false)}
                >
                  ↺
                </button>
              )}
            </div>
            {!heightManual && (
              <p className="measure-input__hint">Auto-derived ({lensWidth} × 0.75)</p>
            )}
          </div>

          <div className="measure-input__photo-section">
            <p className="measure-input__label">Reference Photo (optional)</p>
            <p className="measure-input__hint">
              Upload a front-facing photo of your glasses to use as a visual guide.
            </p>
            {!photoUrl ? (
              <button
                className="measure-input__photo-btn"
                onClick={() => photoInputRef.current?.click()}
              >
                + Upload Photo
              </button>
            ) : (
              <div className="measure-input__photo-preview">
                <img src={photoUrl} alt="Glasses reference" className="measure-input__photo-img" />
                <button
                  className="measure-input__photo-remove"
                  onClick={() => {
                    setPhoto(null);
                    if (photoInputRef.current) photoInputRef.current.value = "";
                  }}
                >
                  ✕ Remove
                </button>
              </div>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="measure-input__hidden-input"
              onChange={handlePhotoChange}
            />
          </div>

          <button
            className="measure-input__submit"
            disabled={!sealGeometry}
            onClick={handleUse}
          >
            Use These Measurements →
          </button>
        </div>

        <div className="measure-input__preview">
          <div className="measure-input__canvas">
            <SceneCanvas cameraPosition={[0, 0, 1.5]}>
              <SealPreview geometry={sealGeometry} />
            </SceneCanvas>
          </div>
          <p className="measure-input__preview-hint">
            Left-drag to rotate • Scroll to zoom
          </p>
        </div>
      </div>
    </div>
  );
}
