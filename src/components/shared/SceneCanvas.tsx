import { Component, Suspense } from "react";
import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

interface ErrorBoundaryState { hasError: boolean }

class CanvasErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError(): ErrorBoundaryState { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          color: "#6b7280",
          background: "#f9fafb",
          fontFamily: "inherit",
        }}>
          <p style={{ margin: 0 }}>3D view failed to load.</p>
          <button
            style={{ padding: "0.4rem 1rem", cursor: "pointer", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
            onClick={() => this.setState({ hasError: false })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface SceneCanvasProps {
  cameraPosition?: [number, number, number];
  children?: ReactNode;
}

export default function SceneCanvas({
  cameraPosition = [0, 0, 4.5],
  children,
}: SceneCanvasProps) {
  return (
    <CanvasErrorBoundary>
      <Canvas camera={{ position: cameraPosition, fov: 50 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <directionalLight position={[-10, -10, -5]} intensity={0.3} />
          {children}
          <OrbitControls enableZoom={true} enablePan={true} />
        </Suspense>
      </Canvas>
    </CanvasErrorBoundary>
  );
}
