# CustomSeal — Project Bible & Roadmap

> A web-based tool for generating custom 3D-printable moisture chamber attachments for prescription eyeglasses.

---

## 1. What This Is

**CustomSeal** solves a niche but real medical problem: people with severe dry eye need moisture chambers — foam or silicone gaskets that seal around the lens of their glasses to trap humidity near the eye. Off-the-shelf versions don't exist for most frame styles. Custom fabrication is expensive and inaccessible.

This app lets a user:
1. Select their glasses frame style from a library
2. Upload a 3D face scan (from a smartphone)
3. Align the glasses model to the scan
4. Receive a custom STL file optimized for TPU flexible filament printing

The core technical challenge is **generating the seal geometry** — a thin-walled surface that follows both the glasses frame profile and the user's face contour.

---

## 2. Current State (April 2026)

### What Works
- React + Vite + React-Three-Fiber app running
- STL model loading (head + glasses) via `STLLoader`
- 12-slider manual alignment tool (position, rotation, scale, head rotation)
- User STL file upload (validation only, no processing)
- Basic multi-step flow: Home → FrameSelection → ScanUpload → ModelPreview → Confirmation
- Responsive CSS layout with BEM naming

### What Doesn't Exist Yet
- Seal geometry generation (the whole point)
- Backend (no API, auth, file storage, or processing)
- Real frame library (4 hardcoded emoji placeholders)
- Actual 3D models of real glasses frames
- Hardpoint system
- STL export
- Any persistence (no DB, no user accounts)

---

## 3. Core Technical Challenge: Seal Geometry Generation

This is the crux of the product. Several approaches exist — they're not mutually exclusive.

### 3A. Hardpoint-Based Procedural Generation (Recommended Primary Approach)

**Concept:** 3D artists embed semantic "hardpoints" into each glasses model — named 3D coordinates that mark structurally significant locations on the frame. The seal algorithm uses these points as anchors, then finds corresponding face-surface points via ray casting.

**Hardpoint Schema (proposed):**
```json
{
  "frame_id": "aviator-001",
  "version": 1,
  "hardpoints": {
    "left_lens_inner_top":    [x, y, z],
    "left_lens_inner_bottom": [x, y, z],
    "left_lens_outer_top":    [x, y, z],
    "left_lens_outer_bottom": [x, y, z],
    "right_lens_inner_top":   [x, y, z],
    "right_lens_inner_bottom":[x, y, z],
    "right_lens_outer_top":   [x, y, z],
    "right_lens_outer_bottom":[x, y, z],
    "nose_bridge_left":       [x, y, z],
    "nose_bridge_right":      [x, y, z],
    "left_temple_start":      [x, y, z],
    "right_temple_start":     [x, y, z]
  },
  "seal_loop": [
    "left_lens_outer_top", "left_lens_outer_bottom",
    "nose_bridge_left", "nose_bridge_right",
    "right_lens_outer_bottom", "right_lens_outer_top"
  ]
}
```

**The `seal_loop` array** defines the ordered ring of hardpoints that will form the inner edge of the seal. This gives artists explicit control over the seal boundary — they define the geometry, the algorithm does the face-fitting.

**Generation algorithm:**
1. Apply the user's alignment transform to all hardpoints (same matrix as the glasses mesh)
2. For each transformed hardpoint, cast a ray toward the face mesh surface
3. The hit point becomes a face-surface anchor
4. Build a closed spline through the face-surface anchors
5. Extrude the spline outward (toward the glasses frame) by a configurable wall thickness (e.g., 2–4mm)
6. Cap ends, stitch walls, export as manifold mesh

**Why this approach:**
- Artists stay in their workflow (Blender, etc.) — hardpoints are just empties/vertices
- The JSON file is tiny and human-readable
- The algorithm doesn't need to understand the whole glasses mesh
- Scale and shape variation between frames is handled naturally
- TPU wall thickness is a single parameter artists don't need to know about

**For 3D Artists — Brief:**
> When you model a glasses frame, you'll also place a set of named empty objects at specific locations on the frame. These become the "seal loop." The app will use these points to generate the seal automatically. We'll give you a Blender addon or template file that makes this straightforward. Points need to be on the interior edge of the frame where the seal would contact the user's face.

### 3B. CSG Boolean Approach (Supplementary / Advanced)

Use Constructive Solid Geometry to subtract the positioned glasses volume from an offset of the face scan, yielding the exact gap geometry.

**Libraries:** `three-csg-ts`, `@jscad/modeling`

**Pros:** Geometrically precise, no artist setup required  
**Cons:** Computationally heavy in browser (face meshes are 50k–200k triangles), requires watertight meshes (not guaranteed from phone scans), hard to control seal thickness

**Recommendation:** Prototype this in parallel as a fallback/validation tool. If the hardpoint approach produces valid geometry, validate it against the CSG result.

### 3C. Marching Cubes / SDF Approach (Research-Grade)

Voxelize the space between face scan and glasses, use signed distance fields to define the seal shell, extract with marching cubes.

**Libraries:** `isosurface` npm, or custom WASM via Rust/C++

**Pros:** Handles arbitrary topology, robust to mesh quality  
**Cons:** High memory usage, voxel resolution trade-off, slow in browser

**Recommendation:** Viable for a server-side processing pipeline. Not suitable for real-time browser preview.

### 3D. Manual Spline Editing (User-Controlled)

Let the user draw the seal boundary directly on the face mesh using click-to-place control points in the 3D viewport.

**Pros:** Maximum user control, works with any frame  
**Cons:** Requires significant UX work, high skill ceiling for users

**Recommendation:** Phase 3+ feature. Offer as override/refinement on top of the hardpoint result.

---

## 4. Technologies Missing

### Critical Path
| Gap | Recommended Solution | Why |
|-----|---------------------|-----|
| No geometry generation | Custom Three.js + `three-mesh-bvh` | BVH accelerates ray casting against face mesh |
| No STL export | `three-mesh-stl-exporter` or custom serializer | Standard format for 3D printing |
| No state management at scale | **Zustand** | Prop drilling will break when alignment + hardpoints + generated geometry all need to share state |
| No TypeScript | Migrate incrementally | Geometry math is where bugs hide; types prevent them |
| No model format migration | Switch to **GLB** from STL | GLB is smaller, supports embedded normals, materials, metadata; can embed hardpoints as extras |

### Backend (when needed)
| Gap | Recommended Solution | Why |
|-----|---------------------|-----|
| No file storage | **Supabase Storage** or **Cloudflare R2** | Store user scans and generated STLs |
| No auth | **Supabase Auth** | Row-level security ties cleanly to file storage |
| No API | **Supabase Edge Functions** or **Next.js API routes** | Server-side geometry processing for heavy CSG |
| No DB | **Supabase Postgres** | Orders, frames library, hardpoint data |

### Quality of Life
| Gap | Recommended Solution | Why |
|-----|---------------------|-----|
| No tests | **Vitest** + **React Testing Library** | Unit test geometry math in isolation |
| No error tracking | **Sentry** | Geometry failures are silent without it |
| No loading states | Proper Suspense boundaries + skeleton UI | STL loads can take 1–3s |
| Tailwind installed, unused | Commit to Tailwind OR remove it | Mixed CSS approach creates debt |
| No CSS variables | Add `:root` token system | Color/spacing consistency at scale |

### 3D Specific
| Gap | Recommended Solution | Why |
|-----|---------------------|-----|
| No BVH acceleration | `three-mesh-bvh` | Face mesh ray casting is O(n) without it; BVH makes it O(log n) |
| No mesh repair | Server-side `manifold` (WASM) | Phone scans have holes; seal generation needs watertight input |
| No scan alignment | ICP via `pcl.js` or server-side | Auto-align face scan to canonical pose before processing |
| No preview of generated seal | Add as fourth mesh in ModelPreview | Critical for user confidence before download |

---

## 5. Refactoring Priorities

### 5.1 State → Zustand Store
Current prop drilling through 5 route components breaks once hardpoints and generated geometry are added. Create a single store:
```
useAppStore: { frame, scan, alignment, hardpoints, generatedSeal, actions }
```

### 5.2 Deduplicate 3D Scene Setup
`ScanUpload` and `ModelPreview` both set up near-identical Canvas + lighting + OrbitControls. Extract to a `<SceneCanvas>` wrapper component.

### 5.3 Custom Hook: `useSTLModel(url)`
Geometry loading, centering, bounding box calculation, and URL cleanup are scattered. Centralize them.

### 5.4 Migrate from STL to GLB
GLB supports:
- Embedded normals (better shading out of the box)
- Material slots (artists can mark seal-zone surfaces)
- Extras/extras JSON (embed hardpoints directly in the file)
- Draco compression (50–80% smaller)

This also simplifies the hardpoint workflow — hardpoints live inside the GLB as named empty nodes, no separate JSON file needed.

### 5.5 TypeScript Migration (Incremental)
Start with `src/data/frames.js` → `frames.ts` and the geometry utility functions. Don't convert everything at once.

---

## 6. Roadmap — Vertical Slices

Each slice is independently shippable and demonstrable. Do them in order.

---

### Slice 1: Foundation Hardening (Now)
**Goal:** Get the existing app into a stable, extensible state before adding new features.

**Tasks:**
- [ ] Add Zustand, migrate App.jsx state into `useAppStore`
- [ ] Extract `<SceneCanvas>` shared 3D component
- [ ] Extract `useSTLModel` hook
- [ ] Add CSS custom properties (`:root` color tokens)
- [ ] Remove or fully adopt Tailwind (don't leave it in limbo)
- [ ] Convert geometry-adjacent files to TypeScript (frames, alignment types)
- [ ] Add Vitest + one test for the alignment transform math

**Done when:** App still works end-to-end, code is less tangled, CI passes.

---

### Slice 2: Real Frame Library + Hardpoint System
**Goal:** Replace emoji placeholders with real GLB models that carry hardpoint data.

**Tasks:**
- [ ] Define hardpoint specification document for 3D artists
- [ ] Build Blender template/addon that makes placing named empties easy
- [ ] Get 1–2 pilot frame models from artists (even basic shapes ok)
- [ ] Write `loadFrameWithHardpoints(glbUrl)` utility (loads GLB, extracts named nodes)
- [ ] Display hardpoints as visual markers in ModelPreview (small colored spheres)
- [ ] Persist hardpoints through alignment transforms (transform same matrix as glasses mesh)
- [ ] Store transformed hardpoints in Zustand

**Done when:** Load a real glasses GLB, see hardpoint spheres move correctly as user aligns glasses.

---

### Slice 3: Face Scan Pipeline
**Goal:** User uploads a real face scan, it displays cleanly and is ready for geometry operations.

**Tasks:**
- [ ] Support OBJ, PLY, STL, GLB, GLTF in loader (currently validation only)
- [ ] Add `three-mesh-bvh` to the face mesh after loading
- [ ] Add mesh repair step (detect and close holes, remove degenerate triangles)
- [ ] Auto-orient face scan to canonical pose (nose forward, eyes level) — simple centroid + PCA approach
- [ ] Show face mesh statistics in UI (triangle count, bounding box, quality warnings)
- [ ] Move heavy processing to a Web Worker to avoid blocking the UI thread

**Done when:** User uploads a real phone scan, it appears correctly oriented, BVH is built, scan quality issues are surfaced.

---

### Slice 4: Seal Generation (Core Feature)
**Goal:** Generate a real printable seal mesh from aligned glasses hardpoints + face scan.

**Tasks:**
- [ ] Implement `castHardpointToFace(hardpoint, faceMesh, bvh)` — ray cast to find face surface anchor
- [ ] Build ordered spline through face-surface anchors using `THREE.CatmullRomCurve3`
- [ ] Extrude spline outward (toward glasses frame) by user-configurable wall thickness
- [ ] Generate closed, manifold mesh from extruded profile
- [ ] Display generated seal as translucent overlay in ModelPreview
- [ ] Add parameter controls: wall thickness (2–5mm), seal height (3–8mm), softness factor
- [ ] Validate mesh (check manifold, check printability)

**Done when:** User sees a preview of the seal geometry overlaid on their face+glasses alignment.

---

### Slice 5: Export & Download
**Goal:** User can download their seal file, ready to print.

**Tasks:**
- [ ] Implement STL binary serializer for the generated seal mesh
- [ ] Add "Download STL" button on Confirmation page
- [ ] Add print settings recommendations page (layer height, infill, TPU brand suggestions)
- [ ] Optional: send to server for a manifold repair pass before download
- [ ] Optional: side-by-side print preview with scale reference

**Done when:** User downloads an STL that can be sliced and printed without errors.

---

### Slice 6: Backend & Accounts
**Goal:** Persist user data, enable order history, support server-side heavy processing.

**Tasks:**
- [ ] Set up Supabase project (Auth + Storage + DB)
- [ ] User registration/login (Supabase Auth)
- [ ] Store uploaded scans in Supabase Storage (never re-upload same scan)
- [ ] Store alignment data + generated seal per user in Postgres
- [ ] Move CSG/repair processing to Edge Function (handles heavy meshes server-side)
- [ ] Order history page

**Done when:** User can log in, see past seals, re-download them.

---

### Slice 7: Polish & Growth
**Goal:** Make the app trustworthy for first-time users.

**Tasks:**
- [ ] Onboarding flow with scan quality guide
- [ ] Video tutorials embedded (scanning tips, TPU printing tips)
- [ ] Community frame library (user-submitted frames, moderation queue)
- [ ] Manual spline override (let user drag seal boundary control points)
- [ ] Sentry error tracking
- [ ] Analytics (Plausible, privacy-respecting)
- [ ] Mobile experience audit

---

## 7. Business Model

CustomSeal is **free to use** — no charge for generating STL files. This keeps the community accessible to people who genuinely need it (dry eye is often a disability, not a lifestyle choice) and avoids any regulatory gray area around charging for therapeutic outputs.

### Monetization: Affiliate Marketing
The frame library is inherently a product catalog. Every frame we model is a specific product that exists for sale on Amazon and other retailers.

**How it works:**
- Each frame in the library has an Amazon affiliate link (or similar) for where to buy it
- Users searching for their frame find it in our library → we earn a small commission when they purchase
- As the library grows, so does the passive affiliate revenue surface area
- This creates a virtuous loop: more frames → more users → more community submissions → more frames

**Advantages of this model:**
- Completely free for users who already own the frame (they just want the STL)
- Natural for users who don't yet own their frame — they need to buy one anyway
- No payment processing, no subscriptions, no friction
- Library quality directly drives revenue (incentive to grow it well)

**Implementation notes:**
- Add `affiliateUrl` field to the frame data schema from day one
- Track click-throughs with UTM params (don't need a heavy analytics stack for this)
- Be transparent with users about affiliate links (builds trust, legally required in most regions)

---

## 8. Working With 3D Artists

### The Pitch (for recruiting volunteers)

CustomSeal is an open-source community project helping people with dry eye conditions get custom moisture chamber seals for their glasses — for free. We need 3D artists to model specific glasses frames from reference photos/measurements.

**What's in it for artists:**
- Credit in the app and on the site for every frame they contribute
- Real-world impact (people actually use and print these)
- Portfolio piece with a clear purpose and community reception
- The modeling work is well-defined and finite — no open-ended creative direction

**What the contribution looks like:**
- Model a single glasses frame from reference (or from a physical pair if you own them)
- Place a set of named markers at specific locations on the inner edge
- Export as GLB
- Usually 2–4 hours of work for a simple frame

**Where to find volunteers:**
- r/blender, r/3Dmodeling, r/dryeyesyndrome (the users themselves)
- Blender Artists forum
- Open source 3D communities (Fab, Sketchfab communities)
- Dry eye patient Facebook groups (users who can also model are highly motivated)

---

### Technical Spec for Artists

**What to deliver:**
1. **GLB file** — frame geometry only, no lenses, real-world scale (1 unit = 1 meter)
2. **Named empty objects** placed at each hardpoint location (see naming convention below)
3. **Two material slots:** `frame` (the visible frame) and `seal_zone` (the inner lens edge where seal attaches — can be a separate edge loop or face selection)
4. **Basic QA:** manifold mesh, no n-gons on the seal_zone edge, scale confirmed

**What "hardpoints" are:**
Hardpoints are named invisible marker objects (empties in Blender) that you place at specific locations on the inner edge of each lens, and at the nose bridge. They're like pins in a map — they tell the app exactly where the seal needs to attach to the frame. The app uses these to generate the custom seal automatically; without them, the app can't know where the frame ends and where the user's face needs to meet it.

Think of it as you doing the creative/precision work (placing the markers accurately on the model), and the app doing the repetitive math (fitting those markers to each individual user's face shape).

**Hardpoint naming convention:**
```
hp_left_outer_top       — top-outer corner of left lens inner edge
hp_left_outer_bottom    — bottom-outer corner of left lens inner edge
hp_left_inner_top       — top-inner corner of left lens inner edge (nose side)
hp_left_inner_bottom    — bottom-inner corner of left lens inner edge (nose side)
hp_right_outer_top
hp_right_outer_bottom
hp_right_inner_top
hp_right_inner_bottom
hp_nose_left            — left side of nose bridge, lowest point
hp_nose_right           — right side of nose bridge, lowest point
```

"Inner edge" means the edge of the frame that faces the wearer's face — not the outer cosmetic edge, but the back/bottom rim where a physical seal would sit.

**The seal_loop field:**
When you submit the model, also provide the ordered list of hardpoint names that define the seal boundary (going around the perimeter). For most frames this will be:
```
left_outer_top → left_outer_bottom → nose_left → nose_right → right_outer_bottom → right_outer_top
```
If the frame has an unusual shape, adjust the ordering so it traces the actual seal path without crossing itself.

**Blender workflow:**
1. Model or import the glasses frame at real-world scale
2. Open the provided `blender/hardpoint_template.blend` and append the Hardpoints collection
3. Snap each hardpoint empty to its correct position on the inner lens edge (use vertex snapping)
4. Name each empty using the `hp_*` convention above
5. Export: File → Export → glTF 2.0, enable "Data → Empty" and "Include → Custom Properties"
6. The hardpoints will appear in Three.js as `scene.getObjectByName('hp_left_outer_top')`

**Common mistakes to avoid:**
- Placing hardpoints on the outer cosmetic edge instead of the inner face-side edge
- Not using real-world scale (the seal will be 100x too large or too small)
- Exporting without "Data → Empty" enabled (hardpoints will be missing from the GLB)
- N-gons or non-manifold edges on the seal_zone geometry (causes ray casting artifacts)

---

## 9. Open Questions

1. **Scan quality floor** — what's the minimum acceptable scan resolution? Need to test with Polycam, LiDAR Scanner, RealityComposer output.
2. **TPU profile** — wall thickness and infill vary by printer; should the app generate a range of variants or take printer as input?
3. **Left/right symmetry** — should we offer a "mirror to other eye" option for simpler frames?
4. **Nose bridge coverage** — some moisture chambers cover the nose bridge, some don't. Make this a user option.
5. **Artist pipeline throughput** — how many frames per week can be reliably delivered? This gates Slice 2. Start with 1–2 pilot frames from any source to validate the hardpoint workflow before recruiting broadly.

---

## 9. Stack Summary

| Layer | Choice | Status |
|-------|--------|--------|
| Framework | React 19 + Vite 6 | ✅ In place |
| Routing | React Router v7 | ✅ In place |
| 3D Rendering | Three.js + React-Three-Fiber + Drei | ✅ In place |
| State | Zustand | ⬜ Not added |
| Types | TypeScript | ⬜ Not added |
| Geometry Processing | Custom + three-mesh-bvh | ⬜ Not added |
| CSG | three-csg-ts | ⬜ Not added (research) |
| Model Format | GLB (migrate from STL) | ⬜ Pending artist pipeline |
| STL Export | three-mesh-stl-exporter | ⬜ Needed at Slice 5 |
| Auth | Supabase Auth | ⬜ Slice 6 |
| Storage | Supabase Storage | ⬜ Slice 6 |
| DB | Supabase Postgres | ⬜ Slice 6 |
| CSS | Vanilla CSS (BEM) + CSS variables | ⬜ Needs variables |
| Testing | Vitest + RTL | ⬜ Not added |
| Error Tracking | Sentry | ⬜ Slice 7 |
