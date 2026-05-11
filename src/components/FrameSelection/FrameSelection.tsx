import { useNavigate } from "react-router-dom";
import { PlusCircle } from "lucide-react";
import Button from "../shared/Button";
import { useAppStore } from "../../store/useAppStore";
import type { Frame } from "../../data/frames";
import "./FrameSelection.css";

interface FrameSelectionProps {
  frames: Frame[];
}

export default function FrameSelection({ frames }: FrameSelectionProps) {
  const navigate = useNavigate();
  const setSelectedFrame = useAppStore((s) => s.setSelectedFrame);

  function handleFrameSelect(frame: Frame) {
    setSelectedFrame(frame);
    navigate("/fit-type");
  }

  return (
    <div className="frames">
      <div className="page-header">
        <Button variant="back" onClick={() => navigate("/")}>
          ← Back
        </Button>
        <h2 className="page-header__title">Choose Your Frame</h2>
        <p className="page-header__subtitle">
          Select a compatible frame below, or request yours if it's not listed.
        </p>
      </div>

      {frames.length > 0 ? (
        <div className="frame-grid">
          {frames.map((frame) => (
            <button
              key={frame.id}
              onClick={() => handleFrameSelect(frame)}
              className={`frame-card ${frame.popular ? "frame-card--popular" : ""}`}
            >
              {frame.popular && (
                <span className="frame-card__badge">Popular</span>
              )}
              <div className="frame-card__thumbnail">
                {frame.image.startsWith("/") || frame.image.startsWith("http")
                  ? <img src={frame.image} alt={frame.name} className="frame-card__thumbnail-img" />
                  : frame.image}
              </div>
              <div className="frame-card__info">
                <h3 className="frame-card__title">{frame.name}</h3>
                <p className="frame-card__description">{frame.description}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="frames__empty">
          <p>No frames in the library yet — be the first to request one!</p>
        </div>
      )}

      <div className="frames__request">
        <div className="frames__request-text">
          <h3 className="frames__request-title">Don't see your frame?</h3>
          <p className="frames__request-subtitle">
            Submit your glasses and we'll model them for free. Once added,
            anyone with the same frame can use it.
          </p>
        </div>
        <button
          className="frames__request-btn"
          onClick={() => navigate("/request-frame")}
        >
          <PlusCircle size={18} />
          Request a Frame
        </button>
      </div>
    </div>
  );
}
