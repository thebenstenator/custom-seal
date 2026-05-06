import { Component, Suspense, useEffect } from "react";
import type { ReactNode, RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport } from "@react-three/drei";

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

// Sets camera.up = Z so OrbitControls orbits around the Z axis and the gizmo shows Z as up.
function ZUpCamera() {
  const { camera } = useThree();
  useEffect(() => {
    camera.up.set(0, 0, 1);
  }, [camera]);
  return null;
}

interface SceneCanvasProps {
  cameraPosition?: [number, number, number];
  children?: ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controlsRef?: RefObject<any>;
  showGizmo?: boolean;
  zUp?: boolean;
}

export default function SceneCanvas({
  cameraPosition = [0, 0, 4.5],
  children,
  controlsRef,
  showGizmo = false,
  zUp = false,
}: SceneCanvasProps) {
  return (
    <CanvasErrorBoundary>
      <Canvas camera={{ position: cameraPosition, fov: 50, up: zUp ? [0, 0, 1] : [0, 1, 0] }}>
        <Suspense fallback={null}>
          {zUp && <ZUpCamera />}
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <directionalLight position={[-10, -10, -5]} intensity={0.3} />
          {children}
          <OrbitControls ref={controlsRef} enableZoom={true} enablePan={true} />
          {showGizmo && (
            <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
              <GizmoViewport
                axisColors={["#ef4444", "#22c55e", "#3b82f6"]}
                labelColor="white"
              />
            </GizmoHelper>
          )}
        </Suspense>
      </Canvas>
    </CanvasErrorBoundary>
  );
}
