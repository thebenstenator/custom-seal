export interface Frame {
  id: string;
  name: string;
  description: string;
  image: string;
  popular: boolean;
  modelUrl: string | null;
  affiliateUrl: string | null;
  genericSealUrl: string | null; // pre-baked STL generated against the mannequin head
  hardpoints: null;
  sealLoop: null;
}

export const frames: Frame[] = [
  {
    id: "vmjfbj",
    name: "VMJFBJ Blue Light Blocking Glasses",
    description: "Lightweight rectangular frames with blue light filtering lenses",
    image: "🕶️",
    popular: true,
    modelUrl: "/models/vmjfbj_post-mirror_non-man-fixed.stl",
    affiliateUrl: "https://www.amazon.com/dp/B0FLPTHSM8",
    genericSealUrl: "/models/seal-vmjfbj.stl",
    hardpoints: null,
    sealLoop: null,
  },
  {
    id: "aviator",
    name: "Aviator Style",
    description: "Classic teardrop shape with thin metal frames",
    image: "🕶️",
    popular: true,
    modelUrl: null,
    affiliateUrl: null,
    genericSealUrl: null,
    hardpoints: null,
    sealLoop: null,
  },
  {
    id: "wayfarer",
    name: "Wayfarer Style",
    description: "Bold rectangular frames with thick temples",
    image: "👓",
    popular: true,
    modelUrl: null,
    affiliateUrl: null,
    genericSealUrl: null,
    hardpoints: null,
    sealLoop: null,
  },
  {
    id: "round",
    name: "Round Style",
    description: "Circular frames for a vintage look",
    image: "🤓",
    popular: false,
    modelUrl: null,
    affiliateUrl: null,
    genericSealUrl: null,
    hardpoints: null,
    sealLoop: null,
  },
  {
    id: "rectangular",
    name: "Rectangular Style",
    description: "Wide rectangular frames for larger coverage",
    image: "👓",
    popular: false,
    modelUrl: null,
    affiliateUrl: null,
    genericSealUrl: null,
    hardpoints: null,
    sealLoop: null,
  },
];
