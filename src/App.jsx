import React, { useState } from "react";
import Header from "./components/Header/Header";
import Footer from "./components/Footer/Footer";
import Home from "./components/Home/Home";
import FrameSelection from "./components/FrameSelection/FrameSelection";
import MeasurementForm from "./components/MeasurementForm/MeasurementForm";
import Confirmation from "./components/Confirmation/Confirmation";
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

  const handleFrameSelect = (frame) => {
    setSelectedFrame(frame);
    setStep("measurements");
  };

  const handleMeasurementSubmit = (measurementData) => {
    setMeasurements(measurementData);
    setStep("confirmation");
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
      <Header />

      <main className="main">
        <div className="main__container">
          {step === "home" && <Home onGetStarted={() => setStep("frames")} />}

          {step === "frames" && (
            <FrameSelection
              frames={frames}
              onBack={() => setStep("home")}
              onSelectFrame={handleFrameSelect}
            />
          )}

          {step === "measurements" && selectedFrame && (
            <MeasurementForm
              selectedFrame={selectedFrame}
              onBack={() => setStep("frames")}
              onSubmit={handleMeasurementSubmit}
            />
          )}

          {step === "confirmation" && (
            <Confirmation
              measurements={measurements}
              selectedFrame={selectedFrame}
              onReset={resetForm}
            />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
