import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header/Header";
import Footer from "./components/Footer/Footer";
import Home from "./components/Home/Home";
import FrameSelection from "./components/FrameSelection/FrameSelection";
import ModelPreview from "./components/ModelPreview/ModelPreview";
import ScanUpload from "./components/ScanUpload/ScanUpload";
import Confirmation from "./components/Confirmation/Confirmation";
import { frames } from "./data/frames";
import "./App.css";

export default function App() {
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [userScan, setuserScan] = useState(null);
  const [glassesAlignment, setGlassesAlignment] = useState(null);

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
                path="/scan"
                element={
                  <ScanUpload
                    selectedFrame={selectedFrame}
                    onSubmit={setuserScan}
                  />
                }
              />
              <Route
                path="/preview"
                element={
                  <ModelPreview
                    selectedFrame={selectedFrame}
                    userScan={userScan}
                    onSubmit={setGlassesAlignment}
                  />
                }
              />

              <Route
                path="/confirmation"
                element={
                  <Confirmation
                    userScan={userScan}
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
