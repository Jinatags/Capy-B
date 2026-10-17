# Capy B 🦫💚

> Helps me feel better ♡

**Capy B** is a cute interactive 3D desktop companion for macOS - a fluffy, chubby capybara with dark curly hair and a green turtle backpack who lives on your desktop, wanders around, naps, and greets you with gently.

---

## Tech stack

- Electron
- React + TypeScript
- Vite (`electron-vite`)
- Three.js · React Three Fiber · Drei
- Tailwind CSS

Target platform: **macOS** first.

---

## Getting started

### Requirements

- Node.js 20+ (Node 22 recommended)
- macOS

### Install & run

```bash
git clone https://github.com/Jinatags/Capy-B.git
cd Capy-B
npm install
npm run dev
```

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Electron + Vite in development |
| `npm run typecheck` | TypeScript checks (main + renderer) |
| `npm run build` | Production compile via electron-vite |
| `npm run pack:mac` | Package a local macOS `.app` / `.dmg` into `release/` |

Settings are stored locally at:

`~/Library/Application Support/capy-b/settings.json`

Launch-at-login is never enabled automatically during development.

---

## macOS tray controls

- **Show / Hide Capy B**
- **Pause / Resume Capy B**
- **Enable / Disable Walking**
- **Character Size** → Tiny / Small / Medium / Large
- **Open Main App…** (placeholder)
- **Settings…** (placeholder)
- **Quit Capy B**

The Dock icon is hidden so Capy B behaves like a menu-bar companion. Use the tray icon to control him.

---

## Model notes

| Asset | Role |
| --- | --- |
| `public/models/CapyB_Single.glb` | **Runtime** single-character extract (~7.6 MB, ~55k tris) |
| Local originals (not in git) | Full Meshy bake / backups kept on the developer machine only |

The original Meshy export fused a four-view turnaround into one mesh. The app uses a safe single-character extract. There is **no skeleton** and **no animation clips** yet — motion is procedural.

Optional debug HUD (dev only):

```js
localStorage.setItem('capyDebug', '1') // then reload
// or open with ?debug=1
```