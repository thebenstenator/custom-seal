import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

export default function SceneCanvas({ cameraPosition = [0, 0, 4.5], children }) {
  return (
    <Canvas camera={{ position: cameraPosition, fov: 50 }}>
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.3} />
        {children}
        <OrbitControls enableZoom={true} enablePan={true} />
      </Suspense>
    </Canvas>
  );
}
