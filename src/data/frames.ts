export interface Frame {
  id: string;
  name: string;
  description: string;
  image: string;
  popular: boolean;
  modelUrl: string | null;
  affiliateUrl: string | null;
  hardpoints: null;
  sealLoop: null;
}

export const frames: Frame[] = [
  {
    id: "aviator",
    name: "Aviator Style",
    description: "Classic teardrop shape with thin metal frames",
    image: "🕶️",
    popular: true,
    modelUrl: null,
    affiliateUrl: null,
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
    hardpoints: null,
    sealLoop: null,
  },
];
