import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DEFAULT_GLASSES_POSITION = [-0.875, 0.405, -0.025];
export const DEFAULT_GLASSES_ROTATION = [0, Math.PI / 2, 0];
export const DEFAULT_GLASSES_SCALE = 0.01;
export const DEFAULT_HEAD_ROTATION = [0, 0, 0];

export const useAppStore = create(
  persist(
    (set) => ({
      // Step data
      selectedFrame: null,
      userScan: null,

      // Alignment
      glassesPosition: DEFAULT_GLASSES_POSITION,
      glassesRotation: DEFAULT_GLASSES_ROTATION,
      glassesScale: DEFAULT_GLASSES_SCALE,
      headRotation: DEFAULT_HEAD_ROTATION,

      // Geometry pipeline (not persisted — Three.js objects can't serialize)
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
      }),
    }
  )
);
