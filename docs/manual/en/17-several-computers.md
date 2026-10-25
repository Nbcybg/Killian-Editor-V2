# 17. Using several computers (Google Drive · iCloud · Dropbox · OneDrive)

**Language:** English · [ภาษาไทย](../th/17-several-computers.md)

A Killian project is an ordinary folder of `.md` and `.json` files. There is no Killian server — to work on a laptop and a desktop, keep the project folder inside a folder that a sync service already copies between your computers.

## 17.1 Put the project in a synced folder

1. Install the sync app of your choice on **every** computer and sign in with the same account:

| Service | Where its folder is | Setting to check |
|---|---|---|
| Google Drive for desktop | `My Drive` (a drive letter on Windows, Finder sidebar on macOS) | Choose **Mirror files**, or right-click the project folder → **Offline access → Available offline** |
| iCloud Drive | macOS: Finder → iCloud Drive · Windows: the iCloud for Windows app | macOS: turn off **Optimise Mac Storage**, or right-click the folder → **Keep Downloaded** |
| Dropbox | `Dropbox` folder | Right-click the folder → **Make available offline** |
| OneDrive | `OneDrive` folder | Right-click the folder → **Always keep on this device** |

   The app reads and writes files directly, so the files must really be on the disk — not "online-only" placeholders.

2. Quit Killian (or open a different project), so nothing is writing to the folder.
3. In your file manager, **move** the whole project folder into the synced folder.
4. In Killian: **File → Open project…** and choose the folder at its new place. The *Recent projects* list remembers the new location.

## 17.2 Opening it on the other computer

1. Wait until the sync app says it is up to date (a tick on the folder icon).
2. **File → Open project…** → choose the same folder inside the synced folder.

Rule of thumb: **one computer at a time.** Quit the app (or open another project) before you walk away, and let the sync finish before you open it elsewhere.

## 17.3 "This project is still open on another computer"

While a project is open, Killian keeps a small file `.k2lock.json` in the project folder that says which computer has it open, and refreshes it every two minutes. The sync app carries it to your other computers.

If you open the project somewhere else while the first computer still has it open, Killian warns you first:

- **Cancel** — go back, quit Killian on the other computer, wait for sync, then open it again.
- **Open anyway** — for when you know the other computer is off, or has already closed the project but the sync has not caught up yet.

The lock is removed when you open another project or quit the app. If a computer was switched off or went to sleep with the project open, its lock expires after ten minutes; Killian then only shows a short note that the project was last open on that computer, as a reminder to check that everything has synced.

The lock file is never included in project ZIP exports or backups.

## 17.4 When the sync service makes a copy

If the same scene was changed on two computers before they synced, the sync service keeps both versions and renames one of them, for example:

| Service | Copy looks like |
|---|---|
| Dropbox | `Rain (conflicted copy).md` · `Rain (Laptop's conflicted copy 2026-10-23).md` |
| Google Drive | `Rain (1).md` |
| OneDrive | `Rain-LAPTOP.md` |
| iCloud | `Rain 2.md` |
| Syncthing | `Rain.sync-conflict-20261023-101500-ABCDEFG.md` |

Killian never shows such a copy in the Explorer by itself, because no chapter lists it. **Tools → Project health check** finds it and says which scene it is a copy of. To sort it out:

1. In the health check, tick the copy and press **Repair selected** — it becomes a scene next to the original.
2. Open both scenes side by side (split view), keep the text you want in one of them.
3. Delete the other one (it goes to the trash, so you can still get it back).

## 17.5 Reading or making small edits on a phone

There is no Killian app for phones yet. Because the scenes are plain Markdown, any Markdown app that can open a folder from your sync service (for example Obsidian or iA Writer) can read and edit them. Follow the same rule — quit Killian on the computer first — and Killian notices the changed files when you come back (see [10.7 When files are changed outside the app](10-history-backup.md#107-when-files-are-changed-outside-the-app)). Keep to editing text; do not rename or move files on the phone.

## 17.6 Good to know

- Version history (`.k2history`) and backups (`Backups`) live inside the project folder, so they sync too and use space in your cloud account. Lower **Settings → Saving & backups → Max auto backups** if space is tight.
- Sharing a project with another *person* through a shared folder works the same way, but only one person can have it open at a time. To work with an editor who uses Word, see [Working with an editor in Word](04-writing-novel.md#working-with-an-editor-in-word).
