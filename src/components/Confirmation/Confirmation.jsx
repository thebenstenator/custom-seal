import React from "react";
import Button from "../shared/Button";
import Notice from "../shared/Notice";
import "./Confirmation.css";

export default function Confirmation({ scanData, selectedFrame, onReset }) {
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
          Your 3D scan has been received. We'll process it and notify you when
          your custom moisture chamber attachment is ready to download.
        </p>

        <div className="confirmation__details">
          <h3 className="confirmation__details-title">Submission Summary:</h3>
          <ul className="confirmation__list">
            <li>Frame Style: {selectedFrame.name}</li>
            <li>Scan File: {scanData.fileName}</li>
            <li>
              File Size: {(scanData.fileSize / 1024 / 1024).toFixed(2)} MB
            </li>
          </ul>
        </div>

        <Button variant="primary" onClick={onReset}>
          Start Another Design
        </Button>
      </div>

      <Notice variant="info">
        <h3 className="notice__title">What's Next?</h3>
        <ul className="notice__list">
          <li>
            ✓ Your scan will be processed and aligned to your selected frame
          </li>
          <li>✓ A custom seal piece will be generated to bridge the gap</li>
          <li>✓ You'll receive a download link for your STL file</li>
          <li>
            ✓ Print with flexible filament (TPU recommended) and attach to your
            glasses
          </li>
        </ul>
      </Notice>
    </div>
  );
}
