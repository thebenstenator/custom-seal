import React, { useState } from "react";
import { ChevronRight, Eye, Droplets, Upload, Users } from "lucide-react";
import "./App.css";

const frames = [
  {
    id: "aviator",
    name: "Aviator Style",
    description: "Classic teardrop shape with thin metal frames",
    image: "🕶️",
    popular: true,
  },
  {
    id: "wayfarer",
    name: "Wayfarer Style",
    description: "Bold rectangular frames with thick temples",
    image: "👓",
    popular: true,
  },
  {
    id: "round",
    name: "Round Style",
    description: "Circular frames for a vintage look",
    image: "🤓",
    popular: false,
  },
  {
    id: "rectangular",
    name: "Rectangular Style",
    description: "Wide rectangular frames for larger coverage",
    image: "👓",
    popular: false,
  },
];

export default function App() {
  const [step, setStep] = useState("home");
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [measurements, setMeasurements] = useState({
    faceWidth: "",
    noseBridge: "",
    templeLength: "",
    email: "",
  });

  const handleMeasurementChange = (field, value) => {
    setMeasurements((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (
      measurements.faceWidth &&
      measurements.noseBridge &&
      measurements.templeLength &&
      measurements.email
    ) {
      setStep("confirmation");
    }
  };

  const resetForm = () => {
    setStep("home");
    setSelectedFrame(null);
    setMeasurements({
      faceWidth: "",
      noseBridge: "",
      templeLength: "",
      email: "",
    });
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header__container">
          <div className="header__brand">
            <Droplets className="header__icon" size={32} />
            <h1 className="header__title">CustomSeal</h1>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="main__container">
          {/* Home Page */}
          {step === "home" && (
            <div className="home">
              <div className="hero">
                <h2 className="hero__title">Custom Moisture Chamber Glasses</h2>
                <p className="hero__subtitle">
                  Design your own moisture chamber attachments for any glasses.
                  3D printable, customizable, and built for your comfort.
                </p>
              </div>

              <div className="features">
                <div className="feature-card">
                  <Eye className="feature-card__icon" size={48} />
                  <h3 className="feature-card__title">Choose Your Frame</h3>
                  <p className="feature-card__description">
                    Select from popular frame styles or contribute your own
                    model
                  </p>
                </div>
                <div className="feature-card">
                  <Upload className="feature-card__icon" size={48} />
                  <h3 className="feature-card__title">Provide Measurements</h3>
                  <p className="feature-card__description">
                    Simple measurements to ensure a perfect, comfortable fit
                  </p>
                </div>
                <div className="feature-card">
                  <Users className="feature-card__icon" size={48} />
                  <h3 className="feature-card__title">Open Source</h3>
                  <p className="feature-card__description">
                    Community-driven models from professionals and users
                  </p>
                </div>
              </div>

              <div className="cta">
                <button
                  onClick={() => setStep("frames")}
                  className="button button--primary"
                >
                  Get Started
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="notice notice--info">
                <h3 className="notice__title">
                  Coming Soon: Full 3D Customization
                </h3>
                <p className="notice__text">
                  We're building the ability to upload 3D scans of your face and
                  glasses for perfectly fitted moisture chamber attachments.
                  Join our early access list below!
                </p>
              </div>
            </div>
          )}

          {/* Frame Selection */}
          {step === "frames" && (
            <div className="frames">
              <div className="page-header">
                <button
                  onClick={() => setStep("home")}
                  className="button button--back"
                >
                  ← Back
                </button>
                <h2 className="page-header__title">Select Your Frame Style</h2>
                <p className="page-header__subtitle">
                  Choose the style that best matches your glasses
                </p>
              </div>

              <div className="frame-grid">
                {frames.map((frame) => (
                  <button
                    key={frame.id}
                    onClick={() => {
                      setSelectedFrame(frame);
                      setStep("measurements");
                    }}
                    className={`frame-card ${frame.popular ? "frame-card--popular" : ""}`}
                  >
                    <div className="frame-card__content">
                      <div className="frame-card__image">{frame.image}</div>
                      <div className="frame-card__info">
                        <div className="frame-card__header">
                          <h3 className="frame-card__title">{frame.name}</h3>
                          {frame.popular && (
                            <span className="badge badge--popular">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="frame-card__description">
                          {frame.description}
                        </p>
                      </div>
                      <ChevronRight className="frame-card__arrow" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="notice notice--gray">
                <p className="notice__title">Don't see your frame style?</p>
                <p className="notice__text">
                  This is an open source project - contribute your frame model
                  on GitHub or request a new style for our next release.
                </p>
              </div>
            </div>
          )}

          {/* Measurements Form */}
          {step === "measurements" && selectedFrame && (
            <div className="measurements">
              <div className="page-header">
                <button
                  onClick={() => setStep("frames")}
                  className="button button--back"
                >
                  ← Back
                </button>
                <h2 className="page-header__title">
                  Provide Your Measurements
                </h2>
                <p className="page-header__subtitle">
                  Selected:{" "}
                  <span className="page-header__selected">
                    {selectedFrame.name}
                  </span>
                </p>
              </div>

              <div className="form">
                <div className="form-group">
                  <label className="form-group__label">Face Width (mm)</label>
                  <input
                    type="number"
                    value={measurements.faceWidth}
                    onChange={(e) =>
                      handleMeasurementChange("faceWidth", e.target.value)
                    }
                    placeholder="e.g., 140"
                    className="form-group__input"
                  />
                  <p className="form-group__help">
                    Measure across your face from temple to temple
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-group__label">
                    Nose Bridge Width (mm)
                  </label>
                  <input
                    type="number"
                    value={measurements.noseBridge}
                    onChange={(e) =>
                      handleMeasurementChange("noseBridge", e.target.value)
                    }
                    placeholder="e.g., 18"
                    className="form-group__input"
                  />
                  <p className="form-group__help">
                    Width of your nose bridge where glasses rest
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-group__label">
                    Temple Length (mm)
                  </label>
                  <input
                    type="number"
                    value={measurements.templeLength}
                    onChange={(e) =>
                      handleMeasurementChange("templeLength", e.target.value)
                    }
                    placeholder="e.g., 145"
                    className="form-group__input"
                  />
                  <p className="form-group__help">
                    Length from hinge to the end of the temple arm
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-group__label">Email Address</label>
                  <input
                    type="email"
                    value={measurements.email}
                    onChange={(e) =>
                      handleMeasurementChange("email", e.target.value)
                    }
                    placeholder="your@email.com"
                    className="form-group__input"
                  />
                  <p className="form-group__help">
                    We'll send you updates when 3D generation is available
                  </p>
                </div>

                <button
                  onClick={handleSubmit}
                  className="button button--primary button--full"
                >
                  Submit Measurements
                </button>
              </div>

              <div className="notice notice--warning">
                <p className="notice__text">
                  <strong>Note:</strong> The 3D model generation feature is
                  currently in development. Your measurements will be saved for
                  when this feature launches.
                </p>
              </div>
            </div>
          )}

          {/* Confirmation */}
          {step === "confirmation" && (
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
                  <span className="confirmation__email">
                    {measurements.email}
                  </span>{" "}
                  when the 3D model generation feature is ready.
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

                <button onClick={resetForm} className="button button--primary">
                  Start Another Design
                </button>
              </div>

              <div className="notice notice--info">
                <h3 className="notice__title">What's Next?</h3>
                <ul className="notice__list">
                  <li>✓ We're building the 3D mesh processing algorithm</li>
                  <li>✓ You'll receive your custom STL file for 3D printing</li>
                  <li>✓ Print with flexible filament (TPU recommended)</li>
                  <li>✓ Attach to your glasses for a perfect moisture seal</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="footer__container">
          <p className="footer__text">
            CustomSeal - Open Source Moisture Chamber Glasses
          </p>
          <p className="footer__credit">
            Built with React · Contributions welcome on GitHub
          </p>
        </div>
      </footer>
    </div>
  );
}
