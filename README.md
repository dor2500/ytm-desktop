# Aria - Modern YouTube Music Desktop Client

A modern, fast, and feature-rich desktop client for YouTube Music built with Electron, React, and TypeScript.

![Aria Music](https://img.shields.io/badge/Aria-YouTube%20Music-10b981?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)
![Electron](https://img.shields.io/badge/Electron-45.3-47848F?style=for-the-badge&logo=electron)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)

---

## ✨ Features

- **🛡️ Built-in Smart Ad Blocker**:
  - Network-level filtering blocking ad trackers and promotional assets.
  - Active in-player ad skipper that automatically skips and mutes any video/audio ads instantly.
  - Live blocked ads counter and toggleable protection shield.

- **🔑 Google Account Integration**:
  - Secure Google sign-in window with desktop Chrome emulation to prevent "This browser or app may not be secure" blocks.
  - Fast Browser Cookie Import: 1-click connect using your active browser session without typing passwords.
  - Syncs your personal library, private playlists, liked songs, and subscription feed.

- **🎨 Ultra-Modern Glassmorphic UI**:
  - Frosted acrylic backdrop blur with depth and dynamic glow adapting to the playing song's artwork.
  - 6 customizable accent color themes (Emerald Neon, Electric Lime, Neon Violet, Cyber Cyan, Sunset Rose, Solar Amber).
  - Mood & Activity filter chips on the Home screen (Relax, Workout, Focus, Energize, Commute, Party).
  - Floating player bar with luminous seek bar, volume control, and animated like button.

- **🎵 Rich Music Playback**:
  - Full YouTube Music catalogue playback powered by the official engine.
  - Synchronized and full-text lyrics viewer.
  - Interactive "Up Next" queue management with drag-to-jump.
  - Hardware media keys support (Play/Pause, Next, Previous).

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Space` | Play / Pause |
| `Shift + N` | Next track |
| `Shift + P` | Previous track |
| `Ctrl + K` or `/` | Focus search bar |
| `Esc` | Close menus / modals |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/dor2500/ytm-desktop.git

# Navigate into project directory
cd ytm-desktop

# Install dependencies
npm install

# Start development mode
npm run dev
```

### Production Build
```bash
# Build desktop packages (Installer & Portable)
npm run dist
```

---

## 🛠️ Tech Stack
- **Framework**: Electron + Vite (`electron-vite`)
- **Frontend**: React 19, TypeScript
- **Backend**: Node.js, `youtubei.js`
- **Styling**: Modern CSS variables, acrylic glassmorphism, flexbox & grid

---

## 📄 License
MIT License.
