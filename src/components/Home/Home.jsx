import React from "react";
import { Eye, Upload, Users } from "lucide-react";
import Button from "../shared/Button";
import Notice from "../shared/Notice";
import "./Home.css";

export default function Home({ onGetStarted }) {
  return (
    <div className="home">
      <div className="hero">
        <h2 className="hero__title">Custom Moisture Chamber Glasses</h2>
        <p className="hero__subtitle">
          Design your own moisture chamber attachments for any glasses. 3D
          printable, customizable, and built for your comfort.
        </p>
      </div>

      <div className="features">
        <div className="feature-card">
          <Eye className="feature-card__icon" size={48} />
          <h3 className="feature-card__title">Choose Your Frame</h3>
          <p className="feature-card__description">
            Select from popular frame styles or contribute your own model
          </p>
        </div>
        <div className="feature-card">
          <Upload className="feature-card__icon" size={48} />
          <h3 className="feature-card__title">Upload Your 3D Scan</h3>
          <p className="feature-card__description">
            Scan your face with your smartphone and upload it for a perfectly
            fitted seal
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
        <Button variant="primary" onClick={onGetStarted}>
          Get Started
        </Button>
      </div>

      <Notice variant="info">
        <h3 className="notice__title">Coming Soon: Full 3D Customization</h3>
        <p className="notice__text">
          We're building the ability to upload 3D scans of your face and glasses
          for perfectly fitted moisture chamber attachments. Join our early
          access list below!
        </p>
      </Notice>
    </div>
  );
}
