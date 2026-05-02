import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as THREE from "three";
import type { Frame } from "../data/frames";
import type { Measurements } from "../utils/geometry/parametricSeal";

export const DEFAULT_GLASSES_POSITION: [number, number, number] = [-0.875, 0.405, -0.025];
export const DEFAULT_GLASSES_ROTATION: [number, number, number] = [0, Math.PI / 2, 0];
export const DEFAULT_GLASSES_SCALE = 0.01;
export const DEFAULT_HEAD_ROTATION: [number, number, number] = [0, 0, 0];

interface AppState {
  selectedFrame: Frame | null;
  userScan: null;

  glassesPosition: [number, number, number];
  glassesRotation: [number, number, number];
  glassesScale: number;
  headRotation: [number, number, number];

  hardpoints: THREE.Vector3[] | null;
  generatedSeal: THREE.BufferGeometry | null;

  measurements: Measurements | null;
  measurementMode: boolean;

  sealTrigger: number;

  setSelectedFrame: (frame: Frame | null) => void;
  setUserScan: (scan: null) => void;

  setGlassesPosition: (position: [number, number, number]) => void;
  setGlassesRotation: (rotation: [number, number, number]) => void;
  setGlassesScale: (scale: number) => void;
  setHeadRotation: (rotation: [number, number, number]) => void;

  setHardpoints: (hardpoints: THREE.Vector3[] | null) => void;
  setGeneratedSeal: (geometry: THREE.BufferGeometry | null) => void;

  setMeasurements: (m: Measurements | null) => void;
  setMeasurementMode: (v: boolean) => void;

  triggerSealGeneration: () => void;
  resetAlignment: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedFrame: null,
      userScan: null,

      glassesPosition: DEFAULT_GLASSES_POSITION,
      glassesRotation: DEFAULT_GLASSES_ROTATION,
      glassesScale: DEFAULT_GLASSES_SCALE,
      headRotation: DEFAULT_HEAD_ROTATION,

      hardpoints: null,
      generatedSeal: null,

      measurements: null,
      measurementMode: false,

      setSelectedFrame: (frame) => set({ selectedFrame: frame }),
      setUserScan: (scan) => set({ userScan: scan }),

      setGlassesPosition: (position) => set({ glassesPosition: position }),
      setGlassesRotation: (rotation) => set({ glassesRotation: rotation }),
      setGlassesScale: (scale) => set({ glassesScale: scale }),
      setHeadRotation: (rotation) => set({ headRotation: rotation }),

      setHardpoints: (hardpoints) => set({ hardpoints }),
      setGeneratedSeal: (geometry) => set({ generatedSeal: geometry }),

      setMeasurements: (m) => set({ measurements: m }),
      setMeasurementMode: (v) => set({ measurementMode: v }),

      sealTrigger: 0,
      triggerSealGeneration: () => set((s) => ({ sealTrigger: s.sealTrigger + 1 })),

      resetAlignment: () =>
        set({
          glassesPosition: DEFAULT_GLASSES_POSITION,
          glassesRotation: DEFAULT_GLASSES_ROTATION,
          glassesScale: DEFAULT_GLASSES_SCALE,
          headRotation: DEFAULT_HEAD_ROTATION,
        }),
    }),
    {
      name: "custom-seal-store",
      partialize: (state) => ({
        selectedFrame: state.selectedFrame,
        glassesPosition: state.glassesPosition,
        glassesRotation: state.glassesRotation,
        glassesScale: state.glassesScale,
        headRotation: state.headRotation,
        measurements: state.measurements,
        measurementMode: state.measurementMode,
      }),
    }
  )
);
