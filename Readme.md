# 📖 Dating for Dummies Reader

A lightning-fast, mobile-first local web reader for **Dating For Dummies, 2nd Edition** by Dr. Joy Browne — built with Vite + React.

Dark-mode by default, scroll memory, fluid typography, and styled callout boxes that match the book's Tip / Warning / Remember / Note sidebars.

---

## Stack

| Tool | Purpose |
|---|---|
| [Vite](https://vitejs.dev/) | Dev server & bundler |
| [React](https://react.dev/) | UI framework |
| [react-markdown](https://github.com/remarkjs/react-markdown) | Markdown renderer |
| [remark-gfm](https://github.com/remarkjs/remark-gfm) | GitHub Flavored Markdown (tables, strikethrough) |
| [rehype-slug](https://github.com/rehypejs/rehype-slug) | Auto-generates `id` attributes on headings for anchor links |
| Vanilla CSS | All styling — no Tailwind, no CSS-in-JS |

---

## Project Structure

```
dating-reader/
├── public/
├── src/
│   ├── App.jsx        ← Main component: markdown renderer, scroll memory, callout detection
│   ├── index.css      ← Full design system: tokens, fluid type, callout styles
│   ├── main.jsx       ← React entry point (Vite default)
│   └── book.md        ← ← ← paste your markdown file here
├── index.html
├── vite.config.js
└── package.json
```

---

## Setup

### 1. Scaffold

```bash
npm create vite@latest dating-reader -- --template react
cd dating-reader
```

### 2. Install dependencies

```bash
npm install react-markdown remark-gfm rehype-slug rehype-auto-link-headings
```

### 3. Add your book

Copy the Marker-extracted markdown into `src/`:

```bash
cp /path/to/your/book.md src/book.md
```

### 4. Replace generated files

Replace `src/App.jsx` and `src/index.css` with the files from this project.

### 5. Update `vite.config.js`

Vite needs to know to serve `.md` files as raw strings:

```js
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.md'],
})
```

### 6. Update `index.html`

Add a proper mobile viewport and dark theme-color to the `<head>`:

```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#0f0e0d" />
<title>Dating for Dummies</title>
```

### 7. Run

```bash
npm run dev
```

Open `http://localhost:5173` in your phone's browser (make sure your phone and computer are on the same Wi-Fi network, then use your computer's local IP, e.g. `http://192.168.x.x:5173`).

---

## Features

### Scroll Memory
Your reading position is saved to `localStorage` automatically, debounced at 300ms. When you reopen the app, it jumps straight back to where you left off — no manual bookmarking needed.

### Marker Artifact Cleanup
The `cleanMarkdown()` function in `App.jsx` strips two types of junk that Marker injects during PDF extraction:

- **Page break markers** — lines like `{0}------------------------------------------------`, `{123}---...`
- **Orphaned page numbers** — headings like `# 34` or `# 116` that Marker extracted as H1s

### Callout Boxes
The book's Tip / Warning / Remember / Note sidebars were extracted by Marker as plain paragraphs starting with bold keywords like `**Remember:**`. The custom `<Paragraph>` renderer detects these and converts them to styled callout boxes:

| Keyword | Color |
|---|---|
| `**Tip:**` | Green |
| `**Warning:**` / `**Caution:**` | Amber |
| `**Remember:**` | Blue |
| `**Note:**` | Purple |

### Reading Progress Bar
A 3px amber gradient bar fixed at the top of the screen shows how far through the document you are.

### Fluid Typography
All type sizes use `clamp()` so the reading experience scales perfectly from a 375px iPhone SE to a large tablet — no pinch-zooming required.

### Heading Anchors
Every heading gets a stable `id` (via `rehype-slug`) and a `¶` link on hover, so you can deep-link to any chapter or section.

---

## About the Source File

**Book:** Dating For Dummies, 2nd Edition  
**Author:** Dr. Joy Browne  
**Publisher:** Wiley Publishing, Inc. (2006)  
**ISBN-13:** 978-0-471-76870-8  

The markdown was extracted from the PDF using [Marker](https://github.com/VikParuchuri/marker). Marker outputs heavily formatted markdown with headings, bold/italic, checkmark lists (`- ✓`), and inline callout paragraphs.

---

## Personal Use Only

This reader is a local tool for personal reading convenience. The book content (`book.md`) is copyrighted by Wiley Publishing, Inc. Do not distribute the markdown file or deploy this app publicly.
