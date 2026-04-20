/**
 * Frame library.
 *
 * modelUrl:      Path to the GLB file (null = placeholder, uses default STL)
 * affiliateUrl:  Amazon/retailer affiliate link for this specific frame
 * hardpoints:    Null when using the default STL demo model.
 *                Populated by the GLB loader for real artist-supplied models
 *                (hardpoints are embedded as named empty nodes with hp_ prefix).
 * sealLoop:      Ordered array of hardpoint names defining the seal boundary ring.
 */
export const frames = [
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
