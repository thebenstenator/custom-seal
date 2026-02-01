# CustomSeal

![CustomSeal](public/droplets.svg)

**Custom Moisture Chamber Glasses Builder** — An open source tool that lets users design and 3D print their own moisture chamber attachments for any pair of glasses using smartphone 3D scans.

## The Problem

Moisture chamber glasses are a medical necessity for people with dry eye conditions, but the market offers very limited options in terms of style, fit, and customization. Most people are stuck with bulky, one-size-fits-all designs that are uncomfortable and visually unappealing.

## The Solution

CustomSeal lets users create a perfectly fitted moisture chamber attachment for their existing glasses. Users upload a 3D scan of their face (taken with a smartphone) and select their glasses frame from our community-driven model library. CustomSeal then generates a custom seal piece that bridges the gap between the user's face and their glasses — creating an airtight, comfortable fit. The output is a 3D-printable STL file, optimized for flexible filaments like TPU.

## How It Works

1. **Scan your face** — Use your smartphone to capture a 3D scan of your face following our guided instructions. No special equipment needed.
2. **Select your frame** — Choose your glasses frame from our library of 3D models, contributed by professionals and users alike.
3. **Generate your seal** — Upload your scan and selected frame, and CustomSeal generates a custom moisture chamber attachment tailored to your exact facial geometry.
4. **3D print and attach** — Download your STL file, print it with flexible filament (TPU recommended), and attach it to your glasses.

## Features

- **Guided 3D Scanning** — Step-by-step instructions optimized for smartphone scanning apps, ensuring a usable scan every time
- **Open Source Frame Library** — Community-driven 3D models of glasses frames, contributed by professionals and users
- **Custom Seal Generation** _(coming soon)_ — Computes the gap between your face and glasses and generates a perfectly fitted seal
- **3D Printable Output** _(coming soon)_ — Export custom STL files optimized for flexible filament like TPU

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/custom-seal.git
cd custom-seal
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Project Structure

```
src/
├── components/
│   ├── Header/              # App header with branding
│   ├── Footer/              # App footer
│   ├── Home/                # Landing page
│   ├── FrameSelection/      # Frame style picker
│   ├── MeasurementForm/     # User measurement input
│   ├── Confirmation/        # Submission confirmation
│   └── shared/              # Reusable components (Button, Notice)
├── App.jsx                  # Root component and routing logic
├── App.css                  # Global styles
├── main.jsx                 # Entry point
└── index.css                # Base reset styles
```

## Tech Stack

- **React** — Component-based UI library
- **Vite** — Fast build tool and dev server
- **Lucide React** — Icon library
- **CSS (BEM)** — Block Element Modifier naming convention for maintainable styles

## Roadmap

- [x] Landing page with project overview
- [x] Frame style selection
- [ ] 3D scanning guide and instructions
- [ ] 3D scan upload and validation
- [ ] Frame model library with community contributions
- [ ] 3D model visualization (Three.js)
- [ ] Custom seal generation algorithm (mesh processing)
- [ ] STL file export
- [ ] Backend for storing scans and submissions
- [ ] 3D printing material and settings guide
- [ ] GitHub workflow for contributing frame models

## 3D Scanning Requirements

For the best results, we recommend using one of the following smartphone apps:

- **Polycam** (iOS/Android) — Best overall quality
- **Scaniverse** (iOS/Android) — Great free option

When scanning, follow these tips for the most accurate seal:

- Keep your face in a neutral expression
- Make sure lighting is even with no harsh shadows
- Capture your full face from forehead to chin
- Slowly rotate around your face to ensure full coverage
- Make sure the area around your eyes and nose bridge is clearly captured

## Contributing

This project is open source and welcomes contributions! There are a few ways to get involved:

- **Add frame models** — If you have access to 3D scans or models of glasses frames, contribute them to the library. See the contributing guide for the required format and metadata.
- **Report bugs** — Open an issue if something isn't working
- **Suggest features** — Have an idea? We'd love to hear it

## License

This project is licensed under the MIT License.
