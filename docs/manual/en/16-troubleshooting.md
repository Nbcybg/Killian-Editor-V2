# 16. Troubleshooting and FAQ

**Language:** English · [ภาษาไทย](../th/16-troubleshooting.md)

[← 15. Updates, bug reports and the activity log](15-update-bug-log.md) · [Contents](README.md) · Appendices: [A](A-menus.md) · [B](B-shortcuts.md) · [C](C-commands.md) · [D](D-file-formats.md) · [E](E-glossary.md)

---

## 16.1 First steps when something is wrong

1. **Read the status bar** — an error message stays there until a new message arrives.
2. **Open the Log panel** (`Ctrl+Alt+9`) and filter to errors.
3. **Save your work** (`Ctrl+Alt+S`) if you still can, then close and reopen the app.
4. If it is about the look of the window/panels: **View → Panels → Reset the whole panel layout**.
5. If it is about files or the project's structure: **Tools → Project health check**.
6. If you have plugins installed: disable them and try again.
7. Still not fixed: **Help → Report a bug…**

## 16.2 Starting the app / opening a project

| Symptom | Cause and fix |
|---|---|
| Windows warns that the publisher is unknown | Choose More info → Run anyway (when you downloaded it from the official Releases page) · why it happens and how to check the file: [1.2](01-getting-started.md#why-windows-or-macos-warns-you--and-how-to-check-the-file) |
| macOS says it cannot be opened because the developer is unidentified | The app is not signed yet — right-click the icon → Open → Open |
| Slow to start the first time | The portable build unpacks itself into a temporary folder every time (~380 MB) — check the free space on the drive that holds `%TEMP%` |
| A project shows **Cannot open** on Home | The folder was moved/deleted, or its drive is not connected — open it with **Open project…** from its new location, then **Remove from list** for the old entry |
| "No project file (project.khn.json)" | You chose the wrong level of folder — choose the folder that directly contains `project.khn.json` |
| On opening, the app says a registry file cannot be read | A JSON file is damaged (half-synced · a slip while hand-editing). The app keeps a copy `…unreadable-<time>.json`. Recover from `Backups/` or the Activity history panel. |
| The app opens in a language you did not choose | **Settings → Language**, choose again and restart (the language is a user setting, not a project setting) |
| Tabs that were open do not come back | The tab's file was moved/renamed while the app was closed — open it again from the Explorer |

## 16.3 Screen and panels

| Symptom | Fix |
|---|---|
| A panel has gone | **View → Panels** and choose it · or `Ctrl+\` (you may have hidden every panel by accident) · or check whether it was torn off into a separate window (close that window to bring it back) |
| The panels are in a muddle | **View → Panels → Reset the whole panel layout** |
| The format bar has gone or is somewhere odd | `Ctrl+Shift+/` brings it to the mouse · right-click the grip → reset everything |
| The format bar is too faint to see | `Ctrl+Shift+'` cycles the opacity back to 100% |
| The format bar will not drag | It is locked — `Ctrl+Shift+=` |
| A toolbar button has gone | **Settings → Toolbar** → tick it again, or reset · in a narrow window, look under the » button |
| The floating + button has gone | **View → Floating button, bottom right (FAB)** |
| The app's own text is too small/large | **View → UI size** (not the same as page zoom) |
| The page is too small/large | `Ctrl+Shift+0` resets the zoom · or **Fit to page width** |
| You see codes such as `###` `@` `>>` in a script | **View → Hide line-prefix codes** |
| Some scenes are missing from the Explorer | A filter is still on (status/tag chips · the filter box) — clear it · **Archived** scenes are hidden: press the archive button · the wrong draft is selected |
| Icons show as empty boxes | Close and reopen the app · if it persists, report a bug and say where you see it |
| Story Network's 3D mode does not appear / stutters | The graphics card/driver does not support WebGL — use 2D mode |

## 16.4 Writing

| Symptom | Fix |
|---|---|
| A shortcut does not work | See the current bindings in **Help → All Shortcuts…** (it may have been rebound) · another program on the machine may have claimed that key (for example the `Ctrl+Alt+…` shortcuts of some graphics drivers/keyboards) — rebind it in Settings → Shortcuts |
| `Ctrl+Tab` does not switch tabs | The cursor is in a screenplay (where it cycles the element) — use `Ctrl+PageDown` |
| A correct word is underlined in red | Right-click → **Add "word" to the dictionary** · for many special terms: put a word-list file in `Plugins/dictionaries/` |
| No spelling underlines at all | **Settings → Editor → Spell check** and **Use the app's dictionary** must both be on |
| Wiki names are not highlighted | **Settings → Editor → Auto-detect Wiki names** · the name must match the entity's name or one of its aliases |
| SmartType pops up names you do not want | `Esc` closes it · for wrongly remembered names: **Script → Manage SmartType** |
| A scene cannot be edited | The scene (or its chapter/book) is **locked** — unlock it from the context menu · or you are viewing the "original" of a problem scene (`Ctrl+Alt+Shift+O` returns to the revised version) |
| Action in a script turns into a character name/dialogue | Look at the type in the element selector and change it with `Ctrl+2` (Action) · check the **Line after dialogue = more dialogue** option |
| The page count of a script does not update | Switch to **Layout** view · or turn on automatic repagination (Settings → Script format) |
| Thai tone marks/vowels float or overlap | Change the Thai font in **Settings → Fonts by language** to one with full Thai support |
| An image does not appear | The image file was moved/deleted from `Images/` — restore it from the trash, or insert the image again |

## 16.5 Saving and files

| Symptom | Fix |
|---|---|
| Saving fails | Read the message on the status bar — disk full · the file is locked by another program (antivirus/sync) · no permission to write. Your work is still in the tab; try again. |
| It asks whether to "overwrite" or "use the version on disk" | The file was changed outside the app while you had unsaved edits — choose the version you want (unsure? **Save as…** to a new file first) |
| Deleted the wrong thing | The **Trash** section in the Explorer → Restore |
| Made a wrong edit and already saved | Right-click the scene → **Version history…** → Restore |
| A wrong batch replace/move/delete | The **Activity history** panel (`Ctrl+Alt+H`) → go back to an earlier point |
| The whole project folder is broken | Recover from `Backups/<date>/` ([10.6](10-history-backup.md#106-project-backups)) or from a ZIP you kept |
| You edited a file in another program and Killian does not see it | Press **Refresh** in the Project panel · for scene properties: **Tools → Sync scene properties from the .md file** |
| You dropped a `.md` file into a chapter folder and it is not in the tree | **Project health check** → Attach it as a scene in this chapter |
| A project-problem warning badge on the status bar | Click the badge → Project health check → Repair selected |

## 16.6 Exporting and printing

| Symptom | Fix |
|---|---|
| Non-Latin letters (e.g. Thai) in a PDF come out as `?` or vanish | Set a font for that script (`.ttf`/`.otf`) in **Settings → Fonts by language** |
| The PDF has no page numbers/headers/title page | Tick them under **PDF options** in the Export Hub — and set up the title pages/headers first, in the **Script** menu |
| The FDX / Watermarked PDFs destinations cannot be chosen | They are only for documents that are screenplays — check the **Document type** |
| Notes/memos end up in the exported file | Turn on the **Remove notes (memos)** / **leave out elements by type** steps in the workflow |
| A shortcode such as `[title]` is not replaced | Turn on the **Expand shortcodes** step in the workflow · a mistyped code name stays as plain text |
| The printed page count differs from the PDF | The Print command uses the system's page breaker — for exact pages, export a PDF and print that file ([9.6](09-export-import-print.md#96-printing)) |
| An imported script is badly formatted | Check the preview before importing · after importing, use **Script → Check the whole script** to work through the element types |

## 16.7 Frequently asked questions

**Where is my work stored? Do I need an account?**
In the project folder on your own machine, as `.md` and `.json` files. No account, no server, no uploading.

**What happens to my work if I stop using Killian?**
Open the `.md` files in any text editor — or export to DOCX / EPUB / PDF / Markdown first.

**Can I use it with Dropbox / OneDrive / Google Drive / iCloud?**
Yes — put the project folder inside the synced folder, but open it on one machine at a time and wait for syncing to finish before opening it on another. Step by step: [17. Using several computers](17-several-computers.md).

**Can several people work on it at the same time?**
There is no real-time co-editing. What does work is Git (the files are text and merge well), or passing the project/ZIP back and forth and using comments and version history.

**Can I use it on a phone or tablet?**
No — it is a desktop app (Windows · macOS · Linux). But the `.md` files can be read/edited with a Markdown app on a phone (press Refresh when you come back).

**Does it need an internet connection?**
No, except for calling an AI · checking for/downloading updates · sending/viewing bug reports · installing a plugin from a link · online synonyms (if you turned them on).

**Does the AI see all of my work?**
No. It sees only what is sent in that request, which you control with the "access level", and it goes only to the provider you configured. With no AI set up, nothing is sent.

**Can I open Killian v1 projects? Can I go back to v1?**
Yes, both ways — the file formats are compatible. (New things v1 does not have, such as boards and charts, are simply ignored by v1.)

**How many scenes should a book have? How big can a file be?**
There is no fixed limit. Keeping scenes small (one event per scene) gets you more out of Kanban, the timeline and version history than one long file does. The app has not yet been tested systematically with very large projects.

**Can I change the font, paper size or margins later?**
At any time — they are display/layout settings and are not written into the text of scene files.

**How do I move my settings to a new machine?**
Copy the user-data folder (`settings.json` · `Plugins/` · `languages/`) to the same place on the new machine ([1.7](01-getting-started.md#17-where-the-app-keeps-its-data)). Project settings already travel with the project folder.

**How do I reset every setting to factory defaults?**
Close the app → rename the user-data folder (keep it, just in case) → start the app again. The work in your project folders is not affected.

**Does the app collect data about how I use it?**
No. There is no telemetry. The activity log stays on your machine, and a bug report is sent only when you press send.

---

Appendices: [A — Menus](A-menus.md) · [B — Shortcuts](B-shortcuts.md) · [C — Commands](C-commands.md) · [D — File formats](D-file-formats.md) · [E — Glossary](E-glossary.md)
