import React from "react";
import Button from "../shared/Button";
import Notice from "../shared/Notice";
import "./Confirmation.css";

export default function Confirmation({ measurements, selectedFrame, onReset }) {
  return (
    <div className="confirmation">
      <div className="confirmation__card">
        <div className="confirmation__icon">
          <svg
            className="confirmation__checkmark"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="confirmation__title">Thank You!</h2>
        <p className="confirmation__message">
          Your measurements have been recorded. We'll notify you at{" "}
          <span className="confirmation__email">{measurements.email}</span> when
          the 3D model generation feature is ready.
        </p>

        <div className="confirmation__details">
          <h3 className="confirmation__details-title">Your Details:</h3>
          <ul className="confirmation__list">
            <li>Frame Style: {selectedFrame.name}</li>
            <li>Face Width: {measurements.faceWidth}mm</li>
            <li>Nose Bridge: {measurements.noseBridge}mm</li>
            <li>Temple Length: {measurements.templeLength}mm</li>
          </ul>
        </div>

        <Button variant="primary" onClick={onReset}>
          Start Another Design
        </Button>
      </div>

      <Notice variant="info">
        <h3 className="notice__title">What's Next?</h3>
        <ul className="notice__list">
          <li>✓ We're building the 3D mesh processing algorithm</li>
          <li>✓ You'll receive your custom STL file for 3D printing</li>
          <li>✓ Print with flexible filament (TPU recommended)</li>
          <li>✓ Attach to your glasses for a perfect moisture seal</li>
        </ul>
      </Notice>
    </div>
  );
}
