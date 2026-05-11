import { useNavigate, Navigate } from "react-router-dom";
import { ScanFace, Shapes, Download } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import Button from "../shared/Button";
import "./FitType.css";

export default function FitType() {
  const navigate      = useNavigate();
  const selectedFrame = useAppStore((s) => s.selectedFrame);
  const setFitType    = useAppStore((s) => s.setFitType);
  const setUserScan   = useAppStore((s) => s.setUserScan);

  if (!selectedFrame) return <Navigate to="/frames" replace />;

  function chooseStandard() {
    setFitType("standard");
    setUserScan(null);
    navigate("/preview");
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

      {/* Ready-made seal — shown only when a hand-tuned STL exists for this frame */}
      {selectedFrame.genericSealUrl && (
        <button className="fit-card fit-card--active fit-card--featured" onClick={() => navigate("/ready-made")}>
          <div className="fit-card__featured-badge">Ready to Print</div>
          <div className="fit-card__icon-wrap fit-card__icon-wrap--blue">
            <Download size={40} strokeWidth={1.5} />
          </div>
          <h3 className="fit-card__title">Ready-Made Seal</h3>
          <p className="fit-card__description">
            A hand-tuned seal for this exact frame — <strong>download and print straight away</strong>.
            No alignment or scanning needed.
          </p>
          <ul className="fit-card__perks">
            <li>Hand-tuned for this frame</li>
            <li>Fastest path to a printed seal</li>
            <li>Buy the matching frames on Amazon</li>
          </ul>
          <span className="fit-card__cta">Download now →</span>
        </button>
      )}

      <div className="fit-type__cards">

        {/* Standard fit — active */}
        <button className="fit-card fit-card--active" onClick={chooseStandard}>
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
          <span className="fit-card__cta">Get started →</span>
        </button>

        {/* Custom fit — coming soon */}
        <div className="fit-card fit-card--soon">
          <div className="fit-card__soon-badge">Coming Soon</div>
          <div className="fit-card__icon-wrap fit-card__icon-wrap--gray">
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
          <span className="fit-card__cta fit-card__cta--muted">In development</span>
        </div>

      </div>
    </div>
  );
}
