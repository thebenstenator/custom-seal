import { useNavigate, Navigate } from "react-router-dom";
import { ScanFace, Shapes, Download } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import Button from "../shared/Button";
import "./FitType.css";

export default function FitType() {
  const navigate     = useNavigate();
  const selectedFrame = useAppStore((s) => s.selectedFrame);
  const setFitType   = useAppStore((s) => s.setFitType);

  if (!selectedFrame) return <Navigate to="/frames" replace />;

  const hasGenericSeal = Boolean(selectedFrame.genericSealUrl);

  function chooseCustom() {
    setFitType("custom");
    navigate("/scan");
  }

  return (
    <div className="fit-type">
      <div className="page-header">
        <Button variant="back" onClick={() => navigate("/frames")}>
          ← Back
        </Button>
        <h2 className="page-header__title">Choose Your Fit</h2>
        <p className="page-header__subtitle">
          Frame:{" "}
          <span className="page-header__selected">{selectedFrame.name}</span>
        </p>
      </div>

      <div className="fit-type__cards">

        {/* Custom fit */}
        <button className="fit-card fit-card--active" onClick={chooseCustom}>
          <div className="fit-card__icon-wrap fit-card__icon-wrap--blue">
            <ScanFace size={40} strokeWidth={1.5} />
          </div>
          <h3 className="fit-card__title">Custom Fit</h3>
          <p className="fit-card__description">
            A seal shaped to <strong>your exact face</strong>. Upload a quick
            3D scan taken with your phone — the whole process takes about
            10 minutes.
          </p>
          <ul className="fit-card__perks">
            <li>Best seal quality and comfort</li>
            <li>Tailored to your face shape</li>
            <li>Free scanning apps available on iOS &amp; Android</li>
          </ul>
          <span className="fit-card__cta">Get started →</span>
        </button>

        {/* Standard fit */}
        {hasGenericSeal ? (
          <div className="fit-card fit-card--active fit-card--standard">
            <div className="fit-card__icon-wrap fit-card__icon-wrap--green">
              <Shapes size={40} strokeWidth={1.5} />
            </div>
            <h3 className="fit-card__title">Standard Fit</h3>
            <p className="fit-card__description">
              A well-fitting seal designed for <strong>most face shapes</strong>,
              generated against our reference mannequin. No scan required.
            </p>
            <ul className="fit-card__perks">
              <li>No scanning needed</li>
              <li>Good fit for average face shapes</li>
              <li>Ready to print immediately</li>
            </ul>
            <a
              href={selectedFrame.genericSealUrl!}
              download={`seal-${selectedFrame.id}-standard.stl`}
              className="fit-card__download"
              onClick={() => setFitType("standard")}
            >
              <Download size={18} />
              Download Standard Seal
            </a>
          </div>
        ) : (
          <div className="fit-card fit-card--soon">
            <div className="fit-card__soon-badge">Coming Soon</div>
            <div className="fit-card__icon-wrap fit-card__icon-wrap--gray">
              <Shapes size={40} strokeWidth={1.5} />
            </div>
            <h3 className="fit-card__title">Standard Fit</h3>
            <p className="fit-card__description">
              A well-fitting seal designed for <strong>most face shapes</strong>,
              generated against our reference mannequin. No scan required.
            </p>
            <ul className="fit-card__perks">
              <li>No scanning needed</li>
              <li>Good fit for average face shapes</li>
              <li>Ready to print immediately</li>
            </ul>
            <span className="fit-card__cta fit-card__cta--muted">
              Not yet available for this frame
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
