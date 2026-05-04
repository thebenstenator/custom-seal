import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, X, CheckCircle } from "lucide-react";
import Button from "../shared/Button";
import "./RequestFrame.css";

interface PhotoSlot {
  label: string;
  hint: string;
  angle: string;
}

const PHOTO_SLOTS: PhotoSlot[] = [
  {
    label: "Front View",
    hint: "Camera at eye level, frame face-on. Hold it flat against a plain background.",
    angle: "Front",
  },
  {
    label: "Side View",
    hint: "Pure 90° profile. Stand back and zoom in rather than getting close — reduces lens distortion.",
    angle: "Side",
  },
  {
    label: "Top-Down View",
    hint: "Looking straight down at the top of the frame. Shows the curvature of the front piece.",
    angle: "Top",
  },
];

interface PhotoState {
  file: File;
  url: string;
}

export default function RequestFrame() {
  const navigate = useNavigate();

  const [frameName, setFrameName]     = useState("");
  const [amazonUrl, setAmazonUrl]     = useState("");
  const [photos, setPhotos]           = useState<(PhotoState | null)[]>([null, null, null]);
  const [submitted, setSubmitted]     = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});

  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  function handlePhotoChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const prev = photos[index];
    if (prev) URL.revokeObjectURL(prev.url);
    const url = URL.createObjectURL(file);
    setPhotos((p) => p.map((s, i) => (i === index ? { file, url } : s)));
  }

  function removePhoto(index: number) {
    const prev = photos[index];
    if (prev) URL.revokeObjectURL(prev.url);
    setPhotos((p) => p.map((s, i) => (i === index ? null : s)));
    if (fileInputRefs[index].current) fileInputRefs[index].current!.value = "";
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!frameName.trim()) e.frameName = "Please enter the frame name or model number.";
    if (!amazonUrl.trim()) {
      e.amazonUrl = "Please include a link so we can identify the exact frame.";
    } else if (!amazonUrl.startsWith("http")) {
      e.amazonUrl = "Please enter a full URL starting with http or https.";
    }
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="request-frame">
        <div className="page-header">
          <Button variant="back" onClick={() => navigate("/frames")}>
            ← Back to Frames
          </Button>
        </div>
        <div className="request-frame__success">
          <CheckCircle size={48} className="request-frame__success-icon" />
          <h2 className="request-frame__success-title">Request Received!</h2>
          <p className="request-frame__success-body">
            Thanks for submitting <strong>{frameName}</strong>. We'll review
            your request and reach out if we need anything.
          </p>
          {photos.some(Boolean) && (
            <p className="request-frame__success-photos">
              You attached {photos.filter(Boolean).length} photo
              {photos.filter(Boolean).length !== 1 ? "s" : ""} — great, those
              will help a lot!
            </p>
          )}
          <Button variant="primary" onClick={() => navigate("/frames")}>
            Back to Frame Library
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="request-frame">
      <div className="page-header">
        <Button variant="back" onClick={() => navigate("/frames")}>
          ← Back
        </Button>
        <h2 className="page-header__title">Request a Frame</h2>
        <p className="page-header__subtitle">
          We'll model your glasses for free and add them to the library.
        </p>
      </div>

      <form className="request-frame__form" onSubmit={handleSubmit} noValidate>

        {/* Frame details */}
        <section className="request-frame__section">
          <h3 className="request-frame__section-title">Frame Details</h3>

          <div className="request-frame__field">
            <label className="request-frame__label" htmlFor="frameName">
              Frame name or model number
            </label>
            <input
              id="frameName"
              className={`request-frame__input ${errors.frameName ? "request-frame__input--error" : ""}`}
              type="text"
              placeholder="e.g. Ray-Ban RB2132 New Wayfarer"
              value={frameName}
              onChange={(e) => setFrameName(e.target.value)}
            />
            {errors.frameName && (
              <p className="request-frame__error">{errors.frameName}</p>
            )}
          </div>

          <div className="request-frame__field">
            <label className="request-frame__label" htmlFor="amazonUrl">
              Amazon or retailer listing URL
            </label>
            <p className="request-frame__hint">
              This helps us identify the exact variant (size, colour, material).
            </p>
            <input
              id="amazonUrl"
              className={`request-frame__input ${errors.amazonUrl ? "request-frame__input--error" : ""}`}
              type="url"
              placeholder="https://www.amazon.com/dp/..."
              value={amazonUrl}
              onChange={(e) => setAmazonUrl(e.target.value)}
            />
            {errors.amazonUrl && (
              <p className="request-frame__error">{errors.amazonUrl}</p>
            )}
          </div>
        </section>

        {/* Photo upload */}
        <section className="request-frame__section">
          <h3 className="request-frame__section-title">Photos</h3>
          <div className="request-frame__photo-intro">
            <p>
              Upload up to three orthographic photos so we can accurately
              model the frame geometry. <strong>You don't need all three</strong>{" "}
              — even one helps — but more is better.
            </p>
          </div>

          <div className="request-frame__tips">
            <h4 className="request-frame__tips-title">Tips for good photos</h4>
            <ul className="request-frame__tips-list">
              <li>
                <strong>Stand back and zoom in</strong> rather than getting close
                — phone cameras distort geometry when too near.
              </li>
              <li>
                <strong>Plain background</strong> — a white wall or sheet works
                perfectly.
              </li>
              <li>
                <strong>Even lighting</strong> — avoid harsh shadows across the
                frame. Overcast daylight or a lamp behind you is ideal.
              </li>
              <li>
                <strong>Hold the frame square</strong> to the camera — no tilt,
                no rotation.
              </li>
            </ul>
          </div>

          <div className="request-frame__photo-slots">
            {PHOTO_SLOTS.map((slot, i) => (
              <div key={slot.angle} className="photo-slot">
                <div className="photo-slot__header">
                  <span className="photo-slot__angle-label">{slot.angle}</span>
                  <span className="photo-slot__label">{slot.label}</span>
                </div>

                {photos[i] ? (
                  <div className="photo-slot__preview">
                    <img
                      src={photos[i]!.url}
                      alt={slot.label}
                      className="photo-slot__img"
                    />
                    <button
                      type="button"
                      className="photo-slot__remove"
                      onClick={() => removePhoto(i)}
                      aria-label="Remove photo"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="photo-slot__upload"
                    onClick={() => fileInputRefs[i].current?.click()}
                  >
                    <Upload size={20} className="photo-slot__upload-icon" />
                    <span>Upload {slot.angle} photo</span>
                  </button>
                )}

                <p className="photo-slot__hint">{slot.hint}</p>

                <input
                  ref={fileInputRefs[i]}
                  type="file"
                  accept="image/*"
                  className="photo-slot__hidden-input"
                  onChange={(e) => handlePhotoChange(i, e)}
                />
              </div>
            ))}
          </div>
        </section>

        <div className="request-frame__submit-row">
          <button type="submit" className="request-frame__submit-btn">
            Submit Request
          </button>
          <p className="request-frame__submit-note">
            We'll review every request manually and be in touch via email.
          </p>
        </div>

      </form>
    </div>
  );
}
