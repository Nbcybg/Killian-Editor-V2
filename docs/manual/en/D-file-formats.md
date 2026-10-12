# Appendix D — Folder layout and file formats

**Language:** English · [ภาษาไทย](../th/D-file-formats.md)

[← Back to the manual contents](README.md)

> For version **2.0.0-alpha.169**. A Killian project is a folder of plain-text files (`.md` + `.json`). This appendix describes what you see when you open that folder in a file manager.
> Files marked ⚠ are registries the app maintains itself — **you can edit them by hand, but take care** (close the app first, and keep a backup). If you break one, use **Tools → Project health check**.

## Layout of a project folder

```
My Novel/                             ← the project folder
├─ project.khn.json                ⚠ the project itself: title · project settings · workflows · various indexes
├─ templates.json                     templates for the Wiki categories (yours to edit)
├─ dictionary.json                    words added to the project's dictionary
├─ ai-key.json                        API keys for AI providers — never share it
├─ maps.json · timeline.json          maps · events on the timeline
│
├─ Book One/                          ← a book (folder name = book title)
│   ├─ section.json                ⚠ the book's data (id · title · order · main draft)
│   ├─ roster.json                    the book's cast-of-characters page
│   └─ Draft/
│       └─ default/                ← a draft
│           ├─ draft.json          ⚠ the list of chapters (order · title · folder)
│           ├─ scenes.json         ⚠ the list of scenes in each chapter (an index)
│           └─ Chapters/
│               └─ Chapter One/       ← a chapter's folder
│                   ├─ Opening.md     ← a scene (the text + its properties in the header)
│                   └─ …
│
├─ Memos/                             memos (.md)
├─ Wiki/
│   ├─ characters/  locations/  items/  lore/  <your own categories>/
│   │   └─ Tora.json                  one entity page
├─ Images/                            the image library (+ images.json: index/albums/tags)
├─ Fonts/                             font files imported into the project
├─ Models/                            3D models for Story Network
├─ Planners/                          planning boards (one .json file per board)
├─ Branches/                          plans for the branching chart
├─ FloorPlans/                        floor plans
├─ OnSet/                             the originals of "problem scenes"
├─ Starters/                          Story Starter stories (one folder per story)
├─ Sessions/                          AI chat sessions
├─ Analysis/ · Dialogues/             AI analysis results · Rehearsal Room sessions
├─ Skills/                            AI skills (.md files you write)
├─ References/                        reference files for agents
├─ Research/                          research material (not backed up automatically)
├─ languages/                         translations for this project only (k2_<language>.csv)
├─ Plugins/                           the project's plugins + Plugins/dictionaries/*.txt
│
├─ Snapshots/                         file version history
├─ .k2history/                        activity history (for going back)
├─ Recycle/                           the trash
└─ Backups/<year-month-day>/          automatic backups
```

The following top-level folder names are **reserved for the app** and cannot be used as a book title (case-insensitive):
`Wiki` `Bible` `Images` `Memos` `Research` `Snapshots` `.k2history` `Plugins` `Recycle` `Sessions` `Starters` `Planners` `Branches` `FloorPlans` `OnSet` `References` `Models` `Backups` `Draft` `languages` `Analysis` `Dialogues` `Fonts` `Skills` `.git`

**Folders you can delete without losing work**: `Snapshots/` `.k2history/` `Backups/` `Recycle/` (you only lose the ability to go back/restore) · `Sessions/` `Analysis/` `Dialogues/` (you lose chat history/analysis results)

## Syntax of a scene file (`.md`)

A scene file has three parts: the **header** · the **text** · a **comments block** (if there are any).

```markdown
---
title: The Old Market at Dusk
type: scene
format: prose
pov: Tora
synopsis: Tora meets a black cat at the Old Market and hears his name called from a dark alley.
tags: [opening]
modified: 2026-10-11T16:18:31.844Z
appVersion: 2.0.0-alpha.169
revision: 2
---
That night, Tora stood in the lamplight…

<!-- k2-comments
…this scene's comment threads (written by the app)…
-->
```

### The header (frontmatter)

| Key | Meaning |
|---|---|
| `title` | The scene title |
| `type` | `scene` or `memo` |
| `format` | `prose` (novel) or `screenplay` |
| `synopsis` · `pov` · `emotion` · `conflict` | Synopsis · point of view · mood · conflict |
| `note` · `futureNote` | Notes to yourself |
| `tags` | `[tag1, tag2]` |
| `storyDate` | Story time (free text) |
| `isFlashback` · `isFlashforward` | The flashback/flashforward flags |
| `modified` · `appVersion` · `revision` | Written by the app |

For the "heavy" properties above, **the header is the source of truth** — `scenes.json` is only an index. After editing a header outside the app, use **Tools → Sync scene properties from the .md file**.

### The text — novel mode

| Write | You get |
|---|---|
| `**text**` | **Bold** |
| `*text*` | *Italic* |
| `***text***` | Bold + italic |
| `_text_` | Underline ⚠ (unlike common Markdown, where it means italic) |
| `~~text~~` | Strikethrough |
| `^text^` | Superscript |
| `~text~` | Subscript |
| `<span style="color:#rrggbb">text</span>` | Text colour |
| `# ` … `###### ` | Heading levels 1–6 |
| `> text` | Block quote |
| `- item` or `* item` | Bulleted list |
| `1. item` | Numbered list |
| `---` (on its own line) | Divider |
| ` ``` ` … ` ``` ` | Code block |
| `\` at the end of a line | A new line in the same paragraph |
| `<!--pagebreak-->` (on its own line) | A forced page break |
| `<!--align:center-->` | The paragraph's alignment (`left` `center` `right` `justify`) — written by the app |
| `![caption](Images/a.png)` (a whole line) | An illustration |
| `![caption](Images/a.png "fit=page w=60% r=8")` | Image options: `fit=page` full page · `w=` width % (1–100) · `r=` corner radius px (0–200) |
| `text ![](Images/i.png "h=2") text` | An image inside a paragraph — `h=` height in lines |
| `[[Name]]` · `[[Name\|text to show]]` | A link to a Wiki page |
| `[title]` `[date:iso]` … | Shortcodes (expanded on export) · `[[title]]` = the literal text |
| `{{Name.field}}` | A Wiki variable (expanded on export) |
| `[Choice text]` | A choice in a branching story |
| `%%…%%` · `<!-- … -->` | Comments in the text (can be stripped on export) |

A mark that has no partner (a lone `*`, say) stays an ordinary character. Paragraphs are separated by a blank line.

### The text — screenplay mode

One line = one element, identified by a prefix code:

```markdown
### EXT. THE PIER - NIGHT

Thick fog. TORA stands at the end of the pier.

@TORA
((whispering))
Come out. I know you're there.

@THE DARK SHAMAN (O.S.)
The bakery boy… you are a long way from home.

! CLOSE ON the Spirit Lantern

>> CUT TO:
```

| Code | Element |
|---|---|
| `### ` | Scene heading |
| (no code) | Action — or dialogue, if it is under a character |
| `@NAME` · `@NAME (V.O.)` | Character (+ extension) |
| `((text))` | Parenthetical (must be directly under a character) |
| `>> ` | Transition out (right-aligned) |
| `<< ` | Transition in (left-aligned) |
| `! ` (with a space) | Shot |
| `#### ` | Sub-header |
| `$intercut ` | Intercut |
| `$act ` | Act break |
| `---` | Page break |
| `/// ` | Note |
| `= ` | Summary |
| `# ` · `## ` · `##### ` | Outline 1 · 2 · 3 |
| `$contl ` · `$contr ` | Continued (left/right) |
| `![alt](src)` | Image |

- A blank line separates blocks — dialogue ends at a blank line.
- `!text` (no space) = forced action.
- Killian v1's codes (`.HEADING` · `>TRANSITION` · `$shot ` · `$sub ` · `$in `) are still read, and are written back with the new codes.

## A book's registry files

**`section.json`** — one per book

```json
{ "guid": "s1", "title": "Book One", "order": 1, "folderName": "Book One", "primaryDraft": "default" }
```

**`draft.json`** — the list of chapters in a draft

```json
{ "chapters": [
  { "guid": "c1", "title": "Night Market", "order": 1, "folderName": "Night Market",
    "status": "Outline", "act": "I", "date": "", "isFavorite": false }
] }
```

**`scenes.json`** — the list of scenes, grouped by chapter id

```json
{ "chapters": { "c1": [
  { "id": "sc1", "title": "The Old Market at Dusk", "order": 1, "fileName": "The Old Market at Dusk.md",
    "status": "ตรวจแล้ว", "wordCount": 1800,
    "choices": [ { "text": "Follow the cat", "nextSceneId": "sc3" } ] }
] } }
```

| Thing | Identity (never changes) | Order | Name on disk |
|---|---|---|---|
| Book | `guid` in section.json | `order` | folder name = `folderName` |
| Chapter | `guid` in draft.json | `order` | `folderName` |
| Scene | `id` in scenes.json | `order` | `fileName` |

- **The order is in the `order` field, not in the file name.**
- `choices` = the choices of a branching story (`nextSceneId` points to the `id` of the destination scene).
- A status value (`status`) is stored as text exactly as it was set; it is not translated with the interface language. The five built-in statuses are stored under their Thai names (`โครงร่าง` Outline · `กำลังเขียน` Writing · `เขียนเสร็จ` Done · `ตรวจแล้ว` Checked · `เก็บถาวร` Archived) and translated only when shown — which is why the example above contains `"ตรวจแล้ว"`.

## Wiki and `templates.json`

**An entity** — `Wiki/<category>/<name>.json`

```json
{
  "name": "Tora",
  "entityTypeKey": "characters",
  "aliases": ["the bakery boy"],
  "tags": ["protagonist"],
  "fields": { "Age": "19", "Role": "Bakery assistant" },
  "relationships": [
    { "targetName": "Cassie", "role": "Sweetheart", "type": "romantic" }
  ],
  "images": []
}
```

- `entityTypeKey` = the name of the category's folder under `Wiki/`
- Relationship types (`type`): `family` · `romantic` · `ally` · `rival` · `enemy` · `mentor` · `acquaintance` · `neutral` · `custom` (shown as "Other"). `role` is the free-text role shown on the line.
- An entity page also stores: long-text headings · fields you added · AI prompts · its shortcode · images (file name + caption)

**`templates.json`** — the templates of each category

```json
{
  "version": 1,
  "templates": [
    { "id": "…", "entityTypeKey": "characters", "name": "Character — default",
      "fields": [
        { "key": "Age",      "label": "Age",      "type": "String", "defaultValue": "" },
        { "key": "Birthday", "label": "Birthday", "type": "Date",   "defaultValue": "" }
      ] }
  ]
}
```

Field types (`type`): `String` `Text` `Int` `Bool` `Date` `Enum` `EntityRef`. This file can be edited in a text editor: add/remove/change fields and headings anywhere.

## Other files worth knowing

| File | Format | Notes |
|---|---|---|
| `project.khn.json` ⚠ | JSON: `title` · `type: "killian-project"` · `settings` (project settings + plugin settings under `settings.plugins`) · `goals` · `ai` (providers **without keys** · agents) · `compileWorkflows` · `backlinks` · `wordHistory` · `navMarks` · `explorer` (star/pin/lock for things that have no file header) · `titlePages` … | A folder containing this file = a project |
| `ai-key.json` | API keys per credential | **Never share/commit** · left out of the app's backups and ZIPs |
| `dictionary.json` | `{ "words": ["word", …] }` | Words added to the dictionary |
| `Plugins/dictionaries/*.txt` | One word per line · `#` = comment | Extra word lists for the spell checker |
| `Skills/*.md` | Markdown (+ an optional header with `name` and `description`) | AI skills |
| `languages/k2_<language>.csv` | `key,text` | Translations for this project only |
| `Recycle/…` + `.k2restore.json` | Deleted files + a restore slip | The slip records where the item came from |
| `<name>.unreadable-<time>.json` | A copy of a JSON file that could not be read | Created by the app when it meets a damaged file — you can open/repair it by hand |

## Compatibility

- **Killian v1**: the `project.khn.json` / `section.json` / `draft.json` / `scenes.json` / `Chapters/*.md` structure is compatible both ways. Things v1 does not know (boards · charts · and so on) live in separate files/folders.
- **Other Markdown programs** (Obsidian · VS Code · text editors): scene files open fine — watch out for `_underline_`, `^superscript^` and `~subscript~`, which other programs may render differently.
- **Git**: a suggested `.gitignore`

  ```gitignore
  ai-key.json
  Backups/
  Snapshots/
  .k2history/
  Recycle/
  Sessions/
  *.unreadable-*.json
  ```

---

[← Back to the manual contents](README.md) · For plugin developers: [Working with project files](../../extension/en/06-data-and-files.md)
