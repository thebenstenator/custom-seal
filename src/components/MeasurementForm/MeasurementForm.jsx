import React from "react";
import Button from "../shared/Button";
import "./MeasurementForm.css";

export default function MeasurementForm({ selectedFrame, onBack, onSubmit }) {
  return (
    <div className="measurement-form">
      <div className="page-header">
        <Button variant="back" onClick={onBack}>
          ← Back
        </Button>
        <h2 className="page-header__title">Provide Your Measurements</h2>
        <p className="page-header__subtitle">
          Selected: {selectedFrame ? selectedFrame.name : "None"}
        </p>
      </div>

      <form
        className="measurement-form__form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.target;
          const data = {
            email: form.email.value,
            faceWidth: form.faceWidth.value,
            noseBridge: form.noseBridge.value,
            templeLength: form.templeLength.value,
          };
          onSubmit(data);
        }}
      >
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <label>
          Face Width (mm)
          <input name="faceWidth" type="number" required />
        </label>
        <label>
          Nose Bridge (mm)
          <input name="noseBridge" type="number" required />
        </label>
        <label>
          Temple Length (mm)
          <input name="templeLength" type="number" required />
        </label>

        <div className="measurement-form__actions">
          <Button variant="secondary" onClick={onBack}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Save Measurements
          </Button>
        </div>
      </form>
    </div>
  );
}
