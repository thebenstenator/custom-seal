import React from "react";
import ReactDOM from "react-dom/client";
import * as THREE from "three";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import App from "./App";
import "./index.css";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
THREE.Mesh.prototype.raycast = acceleratedRaycast as any;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
