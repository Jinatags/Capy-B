# Capy B — Animation & Rigging Guide

This document describes the current runtime model, what the app can animate today, and how to produce a compatible rigged GLB for Phase 2B+.

## 1. Current GLB structure and limitations

**Runtime asset:** `public/models/CapyB_Single.glb`

| Property | Value |
| --- | --- |
| Format | glTF 2.0 binary (`.glb`) |
| Nodes | 1 (`CapyB`) |
| Meshes | 1 combined `Mesh` (~31.7k verts, ~55k tris) |
| Skinned meshes | **None** |
| Bones / skins | **None** |
| Animation clips | **None** |
| Materials | 1× `MeshStandardMaterial` |
| Textures | 3 embedded images (preserved at runtime) |
| Bounds (approx.) | size ≈ `0.47 × 0.61 × 0.52`, centre at origin |

**Implications**

- Feet, arms, head, ears, and the green turtle backpack are **fused into one mesh**.
- Independent limb / ear / backpack motion is **not possible** without external rigging.
- The app currently drives **whole-model procedural poses** (breathing, small walk hop, sleep lean, drag dangle, happy bounce, sad dip).
- Appearance (curly hair, face, turtle backpack) must stay intact — do not replace this character with a different model.

**Optional future asset:** `public/models/CapyB_Animated.glb`

- The app probes for this file at startup.
- If present **and** it contains a skeleton and/or clips, it is used.
- If missing or invalid, the app falls back to `CapyB_Single.glb` without crashing.
- Only one model is loaded in the happy path (both are loaded only when an invalid animated file forces a fallback).

## 2. Is Blender rigging required?

**Yes.** The existing single mesh has no armature. To get real walk cycles, blinks, ear wiggles, or backpack sway you must:

1. Import `CapyB_Single.glb` (or your local Meshy original) into Blender.
2. Build an armature and weight-paint the mesh.
3. Author animation clips.
4. Export a new `CapyB_Animated.glb`.

You can keep the current fused geometry — you do **not** need to split the mesh into separate objects for skinning, though separating the backpack as its own mesh (still skinned to a bone) can make backpack animation cleaner.

Do **not** expect the app to invent a fake skeleton at runtime.

## 3. Recommended bone hierarchy

Keep the hierarchy simple and cute — Capy B is chubby and low-poly in motion intent, not a realistic quadruped IK rig.

```
Root                    # world / placement; app may still move the Electron window
└── Body                # main torso / hips
    ├── Spine
    │   └── Chest
    │       ├── Neck
    │       │   └── Head
    │       │       ├── Ear_L
    │       │       └── Ear_R
    │       ├── Arm_L
    │       │   └── (optional Hand_L)
    │       ├── Arm_R
    │       │   └── (optional Hand_R)
    │       └── Backpack          # turtle shell attachment
    ├── Leg_L
    │   └── (optional Foot_L)
    └── Leg_R
        └── (optional Foot_R)
```

**Notes**

- `Root` / `Body` should sit so the character is grounded (feet near Y = 0 after export).
- Ears are optional but lovely for idle / happy.
- Parent the backpack under `Chest` (or a dedicated `Backpack` bone on the back) so it follows the body without sliding through the mesh.
- Prefer **deform bones only** in the export (no leftover helper empties as skins).

## 4. Suggested animation clips

Clip names are matched **case-insensitively**, with common aliases. Prefer these exact names:

| Clip name | Behaviour state | Intent |
| --- | --- | --- |
| `Idle` | `idle` | Gentle breathing, tiny weight shifts, optional ear twitch |
| `Walk` | `walking` | Alternating little footsteps, subtle body sway; in-place cycle |
| `Sleep` | `sleeping` | Eyes soft/closed if morphs exist; relaxed body; slow breath |
| `Wake` | `waking` | Short stretch / yawn → settles (one-shot) |
| `PickedUp` | `dragging` | Lifted / dangling reaction while user drags the window |
| `Happy` | `happy` | Cute bounce after click / praise (one-shot) |
| `Sad` | `sad` | Lowered posture, gentle pout (one-shot; future habit reactions) |

**Looping:** `Idle`, `Walk`, `Sleep`, `PickedUp`  
**One-shot:** `Wake`, `Happy`, `Sad`

Walk should be an **in-place** cycle. Screen travel is still handled by nudging the Electron window horizontally.

## 5. Recommended approximate durations

| Clip | Duration | Notes |
| --- | --- | --- |
| `Idle` | 2.0–4.0 s loop | Seamless loop; low amplitude |
| `Walk` | 0.6–1.0 s loop | One full left/right step pair |
| `Sleep` | 3.0–5.0 s loop | Very slow breath |
| `Wake` | 1.4–2.0 s | One-shot |
| `PickedUp` | 1.5–2.5 s loop | Soft sway; no violent spin |
| `Happy` | 1.2–1.8 s | One-shot bounce |
| `Sad` | 1.6–2.4 s | One-shot settle |

Keep motion gentle. Capy B should feel calm and playful, not athletic.

## 6. Exporting a compatible animated GLB from Blender

1. **Import** the source mesh (`File → Import → glTF 2.0`).
2. **Add armature**, place bones, parent mesh with automatic weights, then refine weight paint (especially armpits, neck, backpack strap area).
3. **Animate** on the armature; store each action with the clip names above (`Idle`, `Walk`, …).
4. **Apply** location/rotation/scale on mesh + armature (`Ctrl+A`) before export when possible.
5. Face the character so the app’s yaw conventions still read correctly:
   - Idle uses a slight three-quarter view.
   - Walk facing is adjusted in code for left/right roam.
6. **Export** `File → Export → glTF 2.0 (.glb)`:
   - Format: **glTF Binary (`.glb`)**
   - Include: **Armature + Mesh + Materials + Animations**
   - Geometry: apply modifiers if you use them
   - Animations: **bake** if you use constraints/NLA that need baking
   - Do not strip textures; keep the original look (hair, face, turtle backpack)
7. Save as:

   ```
   public/models/CapyB_Animated.glb
   ```

8. Leave `CapyB_Single.glb` in place as the fallback.

### Optional morph targets

Blink / smile shapekeys are welcome (`Blink`, `Smile`) but not required. The current app maps **armature clips** to behaviour states; morphs can be layered later.

## 7. How to test and integrate in this app

1. Place `public/models/CapyB_Animated.glb` next to the static model.
2. Run `npm run dev`.
3. Confirm the console (dev / `?debug=1`) does **not** warn about falling back.

> **Dev-server note:** Vite’s SPA fallback returns HTTP 200 + `text/html` for missing files.
> The app therefore validates Content-Type / `glTF` magic bytes before treating
> `CapyB_Animated.glb` as present. A bare `fetch().ok` check is not enough.

4. Missing individual clips log as:

   `[CapyB] Missing animation clips for states: …`

   The app continues with procedural fallbacks for those states only.
5. Verify:
   - Idle breathing / clip
   - Walking (window moves; character faces travel direction)
   - Sleep → Wake
   - Drag (walking stops; `PickedUp` or procedural dangle)
   - Click → Happy + speech bubble
   - Size presets, pause, tray walking toggle
6. Production check: `npm run typecheck` and `npm run build`.

### Code entry points

| Piece | Path |
| --- | --- |
| Model probe / URLs | `src/renderer/src/animation/modelUrls.ts` |
| Clip → state mapping | `src/renderer/src/animation/clipMap.ts` |
| Mixer / crossfade | `src/renderer/src/animation/AnimationController.ts` |
| Behaviour FSM | `src/renderer/src/behaviour/stateMachine.ts` |
| Procedural fallback poses | `src/renderer/src/behaviour/motion.ts` |
| Character component | `src/renderer/src/components/CapyModel.tsx` |

## 8. Problems caused by the existing mesh structure

1. **Single combined mesh** — no separate head/limb objects; only skinning (or whole-object transforms) can articulate parts.
2. **No rest-pose armature** — weight painting must be done from scratch in Blender (or another DCC).
3. **Backpack fused into body** — without a backpack bone, shell motion will stretch weirdly if torso weights are wrong; paint carefully or detach the backpack mesh and bind it to its own bone.
4. **Hair / face detail** — dense curly hair can show weight artifacts near the neck; keep head bone influence clean.
5. **Eyes** — if they are painted into the texture (not separate geometry), true “eye close” needs morph targets or texture swaps; a sleep pose alone will not blink.
6. **Do not** attempt to explode or auto-rig the mesh inside the Electron app — that path is fragile and risks breaking the visual identity.

---

When `CapyB_Animated.glb` is ready, drop it into `public/models/` and relaunch. No code change is required if clip names follow this guide.

### Mood clips (Phase 3)

In addition to the table above, the app also maps an optional `Annoyed` clip for reminder “hmph” reactions. If missing, a short procedural shake is used.
