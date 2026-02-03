import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header/Header";
import Footer from "./components/Footer/Footer";
import Home from "./components/Home/Home";
import FrameSelection from "./components/FrameSelection/FrameSelection";
import ModelPreview from "./components/ModelPreview/ModelPreview";
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
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [scanData, setScanData] = useState(null);

  return (
    <Router>
      <div className="app">
        <Header />

        <main className="main">
          <div className="main__container">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route
                path="/frames"
                element={
                  <FrameSelection
                    frames={frames}
                    onSelectFrame={setSelectedFrame}
                  />
                }
              />
              <Route
                path="/preview"
                element={<ModelPreview selectedFrame={selectedFrame} />}
              />
              <Route
                path="/scan"
                element={
                  <ScanUpload
                    selectedFrame={selectedFrame}
                    onSubmit={setScanData}
                  />
                }
              />
              <Route
                path="/confirmation"
                element={
                  <Confirmation
                    scanData={scanData}
                    selectedFrame={selectedFrame}
                  />
                }
              />
            </Routes>
          </div>
        </main>

        <Footer />
      </div>
    </Router>
  );
}
