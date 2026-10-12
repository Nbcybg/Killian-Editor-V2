<p align="center">
  <img src="docs/assets/readme-banner.png" alt="Killian 2 — a novel and screenplay writing app for the people behind the scenes" width="100%">
</p>

<p align="center">
  <a href="https://github.com/Nbcybg/Killian-Editor-V2/releases"><img alt="Version" src="https://img.shields.io/badge/version-2.0.0--alpha.169-ff6640"></a>
  <img alt="Platforms" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-452f5e">
  <img alt="Electron" src="https://img.shields.io/badge/Electron-43-1e1250">
  <img alt="Languages" src="https://img.shields.io/badge/UI%20languages-7-ffc55c">
  <a href="https://buymeacoffee.com/noobcyborg"><img alt="Support the project" src="https://img.shields.io/badge/support-Buy%20me%20a%20coffee-ff6640"></a>
</p>

<p align="center">
  English · <a href="README.th.md">ภาษาไทย</a>
</p>

---

## What's new in 2.0.0-alpha.169

> Only the latest release is listed here. The full history is in [CHANGELOG.md](CHANGELOG.md), and in the app under **Help → Changelog**.

- **Printing prints everything.** *File → Print* used to stop after one page; it now prints the whole document, without on-screen decorations such as spell-check underlines or theme colours.
- **Exports you can hand over.** Novels export to RTF with headings, bold/italic, colour, lists and alignment intact; plain `.txt` is really plain; screenplay HTML no longer leaks Fountain codes.
- **Standard Fountain import** — notes, boneyard, centred text, lyrics, dual dialogue and forced page breaks are read correctly.
- **A native-feeling shell** — system window controls (Snap Layouts on Windows), drag files and project folders into the app, open a project from the OS, and a keyboard-driven menu bar.
- **Accessibility settings** — high-contrast and colour-blind-safe themes, key-press echo, a reading line band and an on-screen-keyboard shortcut.
- **File names follow titles.** Books, chapters and scenes are stored under their real names; rename them in K2 or from the OS and the project stays in sync.
- **Plugins reload without a restart**, and there is now a full [Extension Guide](docs/extension/en/README.md).
- **The manuals are built in.** *Help → User Manual* and *Help → Extension Guide* open the complete guides inside the app, offline, in English or Thai.
- **Bug reports and feature requests from inside the app** — send either one from the same dialog and follow its status in a public list, no account needed.
- **Language switching sticks** — the interface and the system menus stay in the language you picked after a restart.
- **Smaller things:** a readable *What's new* dialog (one release at a time), a cleaner Quick Open, dialogs whose buttons never fall off the screen, and a *Support the Project* link under **Help**.

---

## Disclaimer

- **Killian 2 is never-finished software.** It is in continuous development and there is no "final version": features are added, reshaped and occasionally removed, and bugs are expected. Keep your own backups of anything you can't afford to lose — the built-in version history, recycle bin and backup tools help, but they are not a replacement.
- **Standalone by design.** K2 is a self-contained desktop application — no account, no server and no cloud service are needed to use it. Your project is a normal folder on your own disk.
- **Built for game narrative first.** K2 was originally created as a tool for writing the story of a game — branching narrative, characters and a built-in world-building bible. It later grew to cover novels and screenplays, but game writing remains its original purpose and shapes many of its tools.
- **Open to contributions.** Anyone is free to fork the project and open a **pull request** — see [Support the Project](#support-the-project).
- **The software is provided "as is", without warranty of any kind.** You are responsible for your work and your files.
- **AI features are optional and bring-your-own-key.** Killian 2 ships with no AI service. When you configure a provider, the text you choose to send goes to *that provider*, under *their* terms. Without a key, the offline checks still work.
- **Network access is limited to what you trigger:** AI requests, update checks/downloads, and sending or viewing bug reports. Writing itself works fully offline.
- **No affiliation.** Final Draft, Celtx, Scrivener, Adobe Story, Fade In and any other product names are trademarks of their respective owners. Killian 2 only reads and writes their public/exchange file formats.
- The macOS build is currently **not code-signed**, so macOS will warn you the first time you open it.

---

## What is K2

**Killian 2** (K2) is a standalone desktop writing environment for **game narrative, novels and screenplays** — built for writers *and* for the people who work behind them: narrative designers, script supervisors, directors, story editors, world-builders.

K2 runs on **Windows, macOS and Linux**.

It puts the manuscript, the story bible, the planning boards and the production notes in one place, and keeps all of it as **plain Markdown + JSON files** in a folder you own. No database, no proprietary container, no lock-in: if K2 disappeared tomorrow, your story is still readable in any text editor.

- **Writing-first.** Built on [ProseMirror](https://prosemirror.net/) (the rich-text engine behind many modern editors) for a smooth, word-processor-grade feel, with real page layout, standard screenplay formatting and Undo that covers everything.
- **Your files, your folder.** Books → chapters → scenes are ordinary files. Rename or move them from the OS and K2 reconciles the project when you return.
- **Portable and standalone.** On Windows it's a single `.exe` — no installer, no account, no cloud.
- **Cross-platform.** Windows, macOS and Linux (see [System requirements](#system-requirements)).
- **Multilingual, Thai-first.** The full UI is available in 7 languages (Thai, English, German, French, Japanese, Portuguese, Chinese), and shortcuts bind to *physical keys* so they work on any keyboard layout.

### System requirements

| | Minimum | Recommended |
|---|---|---|
| **OS** | Windows 10 64-bit · macOS 12 (Monterey) on an Intel Mac, or on Apple Silicon through Rosetta 2 · Linux x64 | Windows 10 / 11 64-bit · macOS 14 or later · a current Linux desktop |
| **CPU** | 2 cores, ~2 GHz | 4 cores or more |
| **RAM** | 4 GB | 8 GB (large projects, many panels open) |
| **Disk** | ~500 MB free on Windows, ~600 MB on macOS, + space for your work | SSD, 2 GB+ free |
| **Display** | 1366 × 768 | 1920 × 1080 or higher |
| **GPU** | Not required | WebGL-capable (3D Story Network and 3D models) |

- **Prebuilt downloads:** Windows x64 (portable `.exe`, ~92 MB, no installer) and macOS **Intel x64** (`.dmg`, ~143 MB; ~330 MB once copied to Applications). There are no ARM or 32-bit builds — Apple Silicon Macs run it through Rosetta 2.
- **Linux:** there is no prebuilt package yet — run it from source (see [Building](#building)).
- The portable build unpacks itself into a temporary folder on every launch (~380 MB), so keep some headroom on the drive that holds `%TEMP%`.
- Windows 7 / 8 / 8.1 are **not** supported (Electron 43 dropped them).
- Internet is only needed for AI requests, update checks and bug reports — writing works fully offline.
- The figures above are estimates based on measured memory use with a small project open — about 460 MB on Windows and about 400 MB on macOS — and have not yet been tested on low-end hardware or very large projects.

#### macOS in detail

| | |
|---|---|
| **macOS version** | macOS 12 Monterey or later (the minimum Electron 43 supports). Tested on macOS 15.7 (Sequoia). |
| **Processor** | Intel (x64) build. Apple Silicon (M-series) Macs run the same build through Rosetta 2; a native ARM build is not available yet. |
| **Download / installed size** | `.dmg` ~143 MB · `Killian 2.app` ~330 MB in Applications |
| **Memory in use** | ~400 MB with a small project open (4 processes, measured with `footprint` after 25 seconds idle) |
| **Launch time** | About 2 s from launch to an open project (about 5 s the very first time), on the test machine |
| **Your data** | Settings and logs live in `~/Library/Application Support/Killian 2/`; your writing lives in the project folder you choose. |
| **Gatekeeper** | The build is **not code-signed or notarised**. The first time, right-click **Killian 2** → **Open** → **Open**. If macOS still refuses, run `xattr -cr "/Applications/Killian 2.app"` once in Terminal. |
| **Interface** | Native traffic-light window buttons, menus in the system menu bar, and shortcuts on `⌘` instead of `Ctrl`. |
| **Test machine** | MacBook Pro 15-inch 2019 (8-core Intel Core i9 2.4 GHz · 32 GB RAM · macOS 15.7 Sequoia) — the app's own end-to-end test suite passes there. |

---

## Documentation

| Guide | Where |
|---|---|
| **User manual** | [docs/manual/en/](docs/manual/en/README.md) ([ภาษาไทย](docs/manual/th/README.md)) — the full manual: 16 chapters from first launch to troubleshooting, plus appendices listing every menu, shortcut, command and file format. In the app: **Help → User Manual** opens this same manual offline (English by default, Thai when the interface is Thai), **Help → Getting Started** gives a short tour, and the keyboard-shortcut cheat sheet reflects your own bindings. Release notes: [CHANGELOG.md](CHANGELOG.md) (also readable in-app under *What's new*). |
| **Extension guide** | [docs/extension/en/](docs/extension/en/README.md) ([ภาษาไทย](docs/extension/th/README.md)) — the full guide: plugin anatomy, the `k2` SDK reference, hooks & lifecycle, UI guidelines, data & files, security, packaging & distribution, publishing, debugging, a cookbook, [`k2.d.ts`](docs/extension/k2.d.ts) typings and [working example plugins](docs/extension/examples/README.md). In the app: **Help → Extension Guide**. Short version: [docs/plugin-dev.md](docs/plugin-dev.md). |
| Engine & design specs | [docs/](docs/README.md) — specs for the panel system, split view, Kanban, AI modules and more. |
| Contributor / agent notes | [AGENTS.md](AGENTS.md) — architecture and project rules. |

---

## Features

### Your workspace

- **Dockable panel system** — dock, snap, tab-group, float, collapse, or tear a panel out into its own window. Save and switch **workspaces**.
- **Split view** — edit two things side by side.
- **Explorer** — Book → Chapter → Scene tree with keyboard navigation, inline rename (F2), stars, pins, locks, colours and a full context menu.
- **Navigation panel** — outline of the open document with search, filters and colour/star markers.
- **Page view and paper mode** — see your text on real paper sizes and margins; zoom, fit-to-width, focus mode and typewriter mode.
- **Quick open**, status bar toggles, a "today's goal" word counter and a **Dashboard** with writing statistics.
- **Native feel** — system window controls (including Windows Snap Layouts), drag files and project folders into the app, open a project from the command line, taskbar progress for long jobs, themed system menus.
- **Accessibility** — high-contrast and colour-blind-safe themes, key-press echo, reading line band, on-screen keyboard shortcut, reduced-motion support.

### Writing tools

- **Novel editor** — headings, lists, quotes, text colour, inline images, alignment, indentation, paragraph and page formatting that carries into exports.
- **Screenplay editor** — standard script format with scene numbers, CONTINUED/MORE, running headers, title pages, and a **script validator** that flags formatting problems.
- **SmartType, spell check, thesaurus** — with user-extendable dictionaries.
- **Dialogue panel** — every line of dialogue in the project in one place: filter, jump, edit inline.
- **Rehearsal Room** — let AI play your Encyclopedia characters turn by turn, then drop the lines you like into the script (optional, your own key).
- **Comments and notes** — threaded comments anchored to the text.
- **AI assistance (optional, your own key)** — chat with your story, expand/summarise/rewrite a selection, generate dialogue, plot-hole and character-consistency checks, and a five-card "chapter doctor" (dialogue, pacing, logic, out-of-character, tone). Custom agents and system prompts supported.

### Story structure & files

- **Books → chapters → scenes**, with multiple drafts per book and a **Book Manager / library** for reordering and bulk operations.
- **Scene properties** — status, POV, emotion, conflict, synopsis, tags, story date, flashback/flash-forward flags — stored in each scene file's frontmatter.
- **Custom scene statuses and colours.**
- **Plain-file project format** — `project.khn.json`, `section.json`, `draft.json`, `scenes.json` and Markdown scene files.
- **File names match titles** — rename a book, chapter or scene in K2 and the file/folder follows; rename it from the OS and K2 detects and syncs it.
- **Project health check** — finds and repairs orphaned files, missing entries and mismatched names.

### World & character bible

- **Encyclopedia / Codex** — characters, places, items and your own categories, with images, aliases and custom fields.
- **Auto-linking** — mentions in your text link back to entries, with backlinks and a "scenes that mention this" view.
- **Relationships and Story Network** — an interactive graph (2D and 3D) of characters, places and scenes, with focus, shortest-path and insight tools.
- **Character roster** per book.
- **World generator** — optional AI templates that produce Encyclopedia entries.

### Plot planning & visual boards

- **Kanban** — scenes by status, drag to re-status, search and sort.
- **Timeline** — a horizontal board of story time: drag and stretch cards, "leads to" arrows, conflict detection for backwards-in-time links.
- **Planner board** — a free-form canvas of notes, cards and connectors.
- **Branching map** — branching/interactive story graphs with choices.
- **Maps** — your own images with pins, zones, routes, nested maps, real-world scale and travel times, GeoJSON export.
- **Floor plan** — a Shot-Designer-style set/blocking diagram with cameras, lenses, lighting, actors moving per beat, and AI shot-prompt generation.
- **Mood board** — cards for characters, scenes, palettes and references.

### References & media

- **Image gallery** with metadata, linked to Encyclopedia entries.
- **Memos and reference files** — keep notes and source documents with the project; reference text can feed AI context.
- **3D models and panoramas** for Story Network backdrops.
- **"Problem scene" comparison** — keep the original on-set version of a scene and compare it against the revised one.

### Exporting, importing & printing

- **Export Hub** — one place to export to **PDF** (screenplay and novel), **DOCX**, **RTF**, **HTML**, **EPUB**, **FDX**, **Fountain**, **TXT** and **ZIP**, with a live page preview.
- **PDF extras** — title pages, headers/footers, page numbers, bookmarks/outline, watermarks (including per-recipient watermarked copies).
- **Export workflows** — compile pipelines you can save and reuse; templated output file names.
- **Panel exports** — timeline, maps, boards and graphs to PNG/HTML/CSV/Markdown.
- **Import** — Scrivener, Final Draft (FDX), Celtx, Adobe Story, Fade In and Fountain.
- **Print** the document straight from the editor.

### History, backups & recovery

- **Version history** per file — snapshots you can preview, restore and compare.
- **Script comparison** — a colour-coded diff between two versions of a screenplay.
- **Recycle bin** — deleted scenes, chapters, books and entries are recoverable.
- **Backups** and **unsaved-work registry** — K2 lists everything that would be lost before you close or switch projects.
- **Conflict protection** — files changed outside K2 are detected before they can be overwritten.

> K2's version tools are built in and file-based; the project folder can also be placed under Git if you prefer.

### Finding & replacing

- **In-document find and replace.**
- **Project-wide full-text search** — ranked results with highlighted snippets that jump to the exact match; excludes recycle bin, history and backups.
- **Project-wide replace.**
- **Scene filters** — query by status, tag, POV and more, with filter chips in the Explorer.

### Make it yours

- **Themes** — dozens of colour themes (dark, light, colour-blind-safe, high-contrast, monochrome and more) that restyle the app shell without touching page colours or exports.
- **Remappable shortcuts** — every command can be rebound; shortcuts follow physical keys.
- **Layouts** — panel layouts, workspaces and a configurable toolbar.
- **Formatting** — page sizes, margin presets, fonts, and per-element screenplay format (indents, widths, spacing).
- **Languages** — 7 built-in UI languages in editable CSV files, plus per-project translation overrides.
- **Settings scoping** — user-level vs. project-level settings are clearly labelled.

### Plugins & extensibility

- **Plugins** — a folder with `plugin.json` and a JavaScript file; the `k2` API lets plugins register commands, shortcuts, panels and listen to app events. Plugins can be **hot-reloaded**, and project-bundled plugins require your explicit permission before they run.
- **Custom dictionaries** for spell check and thesaurus.
- **Language files and export workflows** as plain data files you can edit and share.
- See the **[Extension Guide](docs/extension/en/README.md)** to get started.

---

## Building

Killian 2 is an **[Electron](https://www.electronjs.org/)** app (Electron 43 + ProseMirror). The renderer is bundled with esbuild; there is no separate framework build step.

```bash
# 1. Get the source and install dependencies
git clone https://github.com/Nbcybg/Killian-Editor-V2.git
cd Killian-Editor-V2
npm install

# 2. Bundle src/*.js into renderer/bundle.js (run after every source change)
npm run build

# 3. Run in development
npm start     # works the same on Windows, macOS and Linux
```

Package a distributable:

```bash
npm run dist        # Windows x64 portable .exe  → dist/
npm run dist:mac    # macOS Intel x64 .dmg       → dist/
npm run dist:dir    # unpacked Windows build, for quick local testing
```

Tests:

```bash
npm run test:unit   # unit tests (pure-logic modules)
```

An end-to-end self-test suite also runs inside the app itself (`KILLIAN_TEST=1`); see [AGENTS.md](AGENTS.md) for the exact commands and project conventions before contributing.

---

## Support the Project

Killian 2 is developed independently. If it helps your writing, here's how you can help it grow:

- ⭐ **Star the repository** and tell other writers and filmmakers about it.
- 🐞 **Report bugs and request features from inside the app** — use the bug button at the end of the status bar (or **Help → Report a bug** / **Help → Request a feature**). Reports and requests sent from the app go straight to the maintainers, and you can follow their status in the app (**Help → Bug & request status**) or on the [Issues](https://github.com/Nbcybg/Killian-Editor-V2/issues) tab.
- 🌍 **Translate** — UI text lives in simple CSV files in [`languages/`](languages/).
- 🔌 **Build and share plugins** — start with the [Extension Guide](docs/extension/en/README.md).
- 🔧 **Contribute code** — fork the repository, make your change on a branch and open a **pull request**. Read [AGENTS.md](AGENTS.md) first for the architecture and project rules (and run `npm run test:unit` before submitting).
- ☕ **Buy me a coffee** — [buymeacoffee.com/noobcyborg](https://buymeacoffee.com/noobcyborg) (also in the app: **Help → Support the Project**).

---

## License

Released under the **ISC License** — see [LICENSE](LICENSE).

© 2026 Noobcyborg Studio
