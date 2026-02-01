import React, { useState } from "react";
import Header from "./components/Header/Header";
import Footer from "./components/Footer/Footer";
import Home from "./components/Home/Home";
import FrameSelection from "./components/FrameSelection/FrameSelection";
import ScanUpload from "./components/ScanUpload/ScanUpload";
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
  const [scanData, setScanData] = useState(null);

  const handleFrameSelect = (frame) => {
    setSelectedFrame(frame);
    setStep("scan");
  };

  const handleScanSubmit = (data) => {
    setScanData(data);
    setStep("confirmation");
  };

  const resetForm = () => {
    setStep("home");
    setSelectedFrame(null);
    setScanData(null);
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

          {step === "scan" && selectedFrame && (
            <ScanUpload
              selectedFrame={selectedFrame}
              onBack={() => setStep("frames")}
              onSubmit={handleScanSubmit}
            />
          )}

          {step === "confirmation" && (
            <Confirmation
              scanData={scanData}
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
