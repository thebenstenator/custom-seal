import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import Button from "../shared/Button";
import Notice from "../shared/Notice";
import "./FrameSelection.css";

export default function FrameSelection({ frames, onBack, onSelectFrame }) {
  const navigate = useNavigate();

  function handleFrameSelect(frame) {
    onSelectFrame(frame);
    navigate("/preview");
  }

  return (
    <div className="frames">
      <div className="page-header">
        <Button variant="back" onClick={onBack}>
          ← Back
        </Button>
        <h2 className="page-header__title">Select Your Frame Style</h2>
        <p className="page-header__subtitle">
          Choose the style that best matches your glasses
        </p>
      </div>

      <div className="frame-grid">
        {frames.map((frame) => (
          <button
            key={frame.id}
            onClick={() => handleFrameSelect(frame)}
            className={`frame-card ${frame.popular ? "frame-card--popular" : ""}`}
          >
            <div className="frame-card__content">
              <div className="frame-card__image">{frame.image}</div>
              <div className="frame-card__info">
                <div className="frame-card__header">
                  <h3 className="frame-card__title">{frame.name}</h3>
                  {frame.popular && (
                    <span className="badge badge--popular">Popular</span>
                  )}
                </div>
                <p className="frame-card__description">{frame.description}</p>
              </div>
              <ChevronRight className="frame-card__arrow" />
            </div>
          </button>
        ))}
      </div>

      <Notice variant="gray">
        <p className="notice__title">Don't see your frame style?</p>
        <p className="notice__text">
          This is an open source project - contribute your frame model on GitHub
          or request a new style for our next release.
        </p>
      </Notice>
    </div>
  );
}
