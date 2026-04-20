import { create } from "zustand";

const DEFAULT_GLASSES_POSITION = [-0.875, 0.405, -0.025];
const DEFAULT_GLASSES_ROTATION = [0, Math.PI / 2, 0];
const DEFAULT_GLASSES_SCALE = 0.01;
const DEFAULT_HEAD_ROTATION = [0, 0, 0];

export const useAppStore = create((set) => ({
  // Step data
  selectedFrame: null,
  userScan: null,

  // Alignment
  glassesPosition: DEFAULT_GLASSES_POSITION,
  glassesRotation: DEFAULT_GLASSES_ROTATION,
  glassesScale: DEFAULT_GLASSES_SCALE,
  headRotation: DEFAULT_HEAD_ROTATION,

  // Geometry pipeline
  hardpoints: null,
  generatedSeal: null,

  // Actions
  setSelectedFrame: (frame) => set({ selectedFrame: frame }),
  setUserScan: (scan) => set({ userScan: scan }),

  setGlassesPosition: (position) => set({ glassesPosition: position }),
  setGlassesRotation: (rotation) => set({ glassesRotation: rotation }),
  setGlassesScale: (scale) => set({ glassesScale: scale }),
  setHeadRotation: (rotation) => set({ headRotation: rotation }),

  setHardpoints: (hardpoints) => set({ hardpoints }),
  setGeneratedSeal: (geometry) => set({ generatedSeal: geometry }),

  resetAlignment: () =>
    set({
      glassesPosition: DEFAULT_GLASSES_POSITION,
      glassesRotation: DEFAULT_GLASSES_ROTATION,
      glassesScale: DEFAULT_GLASSES_SCALE,
      headRotation: DEFAULT_HEAD_ROTATION,
    }),
}));
