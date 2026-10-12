# 10. Other extension points

**Language:** English · [ภาษาไทย](../th/10-other-extension-points.md)

[← 9. Publishing, and the "plugin store"](09-store-submission.md) · [Overview](README.md) · Next: [11. Debugging and testing →](11-debugging-testing.md)

---

A great deal of Killian 2 can be extended with **data files** — no code to write, no permission to ask as with plugins, and you distribute them by sending a file.

| Extension point | File | Scope | How to distribute |
|---|---|---|---|
| [Languages](#101-language-files) | `k2_<code>.csv` | User, or project | Send the CSV file |
| [Dictionaries](#102-spell-check-dictionaries) | `*.txt` · `dictionary.json` | Project | Send the file / it travels with the project |
| [AI skills and agents](#103-ai-skills-and-agents) | `Skills/*.md` · `References/*.txt` | Project | Send the file / it travels with the project |
| [Wiki templates](#104-wiki-templates) | `templates.json` | Project | Send the file |
| [Export workflows and shortcodes](#105-export-workflows-and-shortcodes) | Inside `project.khn.json` | Project | It travels with the project |
| [Status sets · colour sets · workspaces](#107-things-you-can-export-and-import-as-a-set) | `.json` files | Depends on the kind | Export/import inside the app |
| [Colour themes](#106-colour-themes) | `themes.json` (in the source) | The app itself | A pull request |

## 10.1 Language files

### Adding a language without touching the app

1. Export a starting point: **Export → Export language as CSV (key · Thai · English)…**
2. Translate it into a two-column file named `k2_<language code>.csv` (e.g. `k2_ko.csv`)
3. Put it in a `languages` folder the app looks in (see the real list in **Settings → Language** · the **Open the language folder** button)
4. Restart the app → the language is in the list

### File format

```csv
meta.code,ko
meta.name,Korean
meta.nativeName,한국어
meta.version,3
meta.author,Translator's name
ui.common.cancel,취소
ui.common.save,저장
"ui.app.confirmQuit","저장하지 않은 작업이 있습니다. ""종료""하시겠습니까?"
# a line whose first cell starts with # = a translator's comment
```

| Rule | Detail |
|---|---|
| Columns | `key,text` — a header row `key,text` is allowed (optional) |
| Quoting | A cell containing `,` `"` or a line break goes inside `"…"` · a `"` inside is written `""` |
| Encoding | UTF-8 (a BOM is fine — recommended if the file will be opened in Excel on Windows) |
| `meta.*` rows | `meta.code` (the language code) · `meta.name` (the English name) · `meta.nativeName` (the name in that language — shown in the language selector) · `meta.version` · `meta.author` |
| An empty cell | = not translated yet → the text from the next file down is used |
| `{0}` `{1}` … | Placeholders — they must be kept (you may move them within the sentence) |
| `{0\|singular\|plural}` | A plural form chosen by the value of `{0}`: `{0} {0\|page\|pages}` |
| `{sc:command}` | Replaced by that command's current shortcut, e.g. `{sc:save}` — **never type key names in directly** |
| Not allowed | HTML tags · emoji/icons at the start of the text · changing key names |

**Text that is an instruction to the AI** (keys in the `ui.ai*` families): you may translate the content, but **you must keep the structure** — the field names of sample JSON · command blocks · the `###` `@` marks of a script · `{{ }}`. Otherwise the app cannot read the AI's reply.

### The layering order

The app joins the same language's files from several places. **The first key found wins**:

```
1. <project>/languages/k2_<language>.csv      ← this project only
2. languages/ next to the program file
3. <user data>/languages/k2_<language>.csv    ← the user's, every project
4. the files shipped with the app
```

That is useful in two ways:

- **Correcting a few translations**: create a file containing only the keys you want to change and put it in a higher layer — the remaining keys come from below.
- **A project's own vocabulary**: put it in `<project>/languages/`, for example changing "Scene" to "Episode" or "Chapter" to "Quest" for a game project. It travels with the project and takes effect only while that project is open (it is layered over the language the user chose; it does not change the language).

### Testing, and contributing to the project

- **Settings → Language → Reload language files** re-reads the file of the language in use without closing the app.
- **Tools → Import language from CSV…** merges a table into the project's language file (it merges over; keys not in the table are not deleted).
- Check on a real screen: selectors · buttons · tables, where long text may be cut off — try window widths of 1366 and 1024.
- To make it available to everyone: a pull request adding/changing a file in the repository's `languages/` folder (read the language-file section of `AGENTS.md` first — every key must exist in every language file).

## 10.2 Spell-check dictionaries

The offline spell checker (Thai + English) takes extra words in two ways:

| File | Format | Comes from |
|---|---|---|
| `<project>/dictionary.json` | `{ "words": ["word1", "word2"] }` | The user right-clicking → **Add "word" to the dictionary** |
| `<project>/Plugins/dictionaries/*.txt` | One word per line · a leading `#` = a comment | Word lists you put there |

```text
# vocabulary of the world of "The Demon of Bangkok"
Nazarena
Kyleigh
lamplight
```

- Save as UTF-8 · any file name ending in `.txt` · you can have several files (by subject: names · technical terms · dialect).
- They are loaded when the project opens — after editing a file, reopen the project.
- Words of 2 characters or fewer and words longer than 65 characters are not checked anyway; there is no need to list them.
- `Plugins/dictionaries/` is inside the plugins folder but **is not a plugin** — there is no code and no permission to ask.
- Distributing a word list: send the `.txt` file for users to put in place, or let it travel with the project.

## 10.3 AI skills and agents

### Skills — standing instructions for the AI assistant

Markdown files in `<project>/Skills/` that the user can turn on/off per session in the chat panel:

```markdown
---
name: Writing tone
description: Enforces the language tone of this story
---
Write in short, tight sentences. No filler words.
Use the pronouns the characters actually use in the story; never change them.
Do not wrap up the ending unless the author asks.
```

| Rule | |
|---|---|
| Location | `<project>/Skills/<name>.md` |
| Header | Optional — `name` (the name shown · absent = the file name) · `description` |
| Body | Instructions in plain language — attached to the request while the skill is on, and the AI is told to follow them strictly, above general guidance |
| Limit | All the skills that are on, together, may not exceed **12,000 characters** per request |
| Identity | The file name (without the extension) — renaming the file = a new skill (sessions that had the old one on will not see it) |

Writing a good skill: short · specific · a rule that can be checked ("Tora's lines are never longer than two sentences"), not a broad wish ("write well") · one subject per file, so they can be switched separately.

**Distributing a set of skills**: a folder of `.md` files — the recipient puts them in the project's `Skills/`. A skill is text, not code, but **it is an instruction to an AI that may have the right to change files** (Co-write/Fully unlocked mode) — read a skill from someone else before using it.

### Agents — a persona and references for Rewrite this

Defined in the **AI settings** dialog (stored in `project.khn.json`): a persona (style · themes · tone · sources · rules) + `.txt` reference files, which are copied into `<project>/References/`.

- The references are sent to the AI as examples/ideas every time that agent is used (there is a total length limit — files higher in the list go first).
- **The project's system prompt** (set in the same place) is placed before every AI request of every feature.
- Agents travel with the project — send the project to a team and the team gets the same agents (but not the API key).

### Per-entity AI prompts

Every Wiki page has an **AI prompts** section (pairs of topic — requirement) that the AI follows when writing about that entity. It is the finest-grained extension point of all ([User Manual 6.2](../../manual/en/06-wiki-world.md#62-the-entity-page)).

## 10.4 Wiki templates

`<project>/templates.json` defines the data fields of each category. It can be edited in a text editor:

```json
{
  "version": 1,
  "templates": [
    {
      "id": "c0ffee00-0000-4000-8000-000000000001",
      "entityTypeKey": "characters",
      "name": "Character — RPG",
      "fields": [
        { "key": "Class",   "label": "Class",     "type": "String", "defaultValue": "" },
        { "key": "Level",   "label": "Level",     "type": "Int",    "defaultValue": "" },
        { "key": "Playable","label": "Playable",  "type": "Bool",   "defaultValue": "" },
        { "key": "Mentor",  "label": "Mentor",    "type": "EntityRef", "defaultValue": "" },
        { "key": "Bio",     "label": "Short bio", "type": "Text",   "defaultValue": "" }
      ]
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `id` | The template's unique id |
| `entityTypeKey` | The name of the category's folder under `Wiki/` (`characters` · `locations` · `items` · `lore` · a custom category) |
| `name` | The name the user sees when choosing/changing a template |
| `fields[].key` | The field's name in the entity file (`fields.<key>`) — **do not change it once there is data** (the existing data would turn into "your own data") |
| `fields[].label` | The label shown |
| `fields[].type` | `String` · `Text` · `Int` · `Bool` · `Date` · `Enum` · `EntityRef` |
| `fields[].defaultValue` | The default value (for the shape of the value, look at the starting templates the app created in your project) |

- A category can have several templates — an entity page has a **Change template** button (existing data is kept; only missing fields are added).
- Template fields can be used as variables on export: `{{Tora.Class}}` · `[wiki:Tora.Class]`
- The file has a `note` field explaining more of the structure (including the `profile` block for the profile card's header) — read it in the file the app created in your project.
- **Distributing a template set** (e.g. "a set for RPGs" · "a set for mystery novels"): send the `templates.json` file — the recipient **merges the `templates` array into their own** (rather than replacing the whole file, if they have templates of their own) · use new, unique `id`s.
- Editing the file while the app is open: close and reopen the project. The file must be valid JSON (back it up before editing).

## 10.5 Export workflows and shortcodes

### Workflows

The sequence of export steps (remove notes · chapter headings · scene separators · convert to HTML …) is set in **Export → Edit export workflow steps…** and stored in `project.khn.json → compileWorkflows`. The full list of steps is in the [User Manual, 9.2](../../manual/en/09-export-import-print.md#92-export-workflows).

The extension points inside a workflow:

| Point | What you can do |
|---|---|
| The format of the **Chapter heading** / **Scene name** steps | Template text using `{n}` `{title}`, e.g. `## Chapter {n} — {title}` |
| The **Separator between scenes** step | Any text |
| The **Only scenes with status…** step | Filter by statuses you defined yourself |
| The **Expand shortcodes** · **Expand `{{name}}` variables** steps | Content assembled at export time |
| The **Custom JavaScript** step | Transform the text with your own code — [4.5](04-hooks-lifecycle.md#45-other-hooks-outside-plugins) |

Workflows travel with the project. Make a "template project" containing your publisher's/studio's workflows, and have the team start from a copy of it.

### Shortcodes and variables

Users can assemble context-dependent content without writing code:

| Syntax | Replaced by | When |
|---|---|---|
| `[title]` `[chapter]` `[date:iso]` `[words]` … | Values from the context being exported | The "Expand shortcodes" step · export file names · fields of the Wiki/chat/comments |
| `[wiki:Name.field]` · `[field:name]` · `[relation:role]` | Data from the Wiki | The same |
| `{{Name}}` · `{{Name.field}}` | An entity's name/field value | The "Expand {{name}} variables from the Wiki" step |
| `${PAGE}` `${TITLE}` … | Page-header variables | A screenplay's page headers |

The full list: [User Manual 4.13](../../manual/en/04-writing-novel.md#413-shortcodes-and-wiki-variables). The shortcode registry is in the source (`src/shortcode.js`) — **adding a new shortcode means changing the app's source** (a pull request). A plugin cannot add one in this version.

## 10.6 Colour themes

Themes are generated when the app is built — **adding a theme means changing the source and building**. In this version a user cannot drop an extra theme file into the portable build.

For people who build from source, or who want to contribute a theme to the project:

1. Add an entry to `renderer/themes/themes.json`:

   ```json
   { "id": "ocean-night", "mode": "dark",
     "name": { "th": "ทะเลยามค่ำ", "en": "Ocean Night" },
     "colors": { "bg": "#0b1d2e", "fg": "#e6f1ff",
                 "accent": "#ff7a59", "accentHi": "#ffd166", "link": "#6ec1ff" } }
   ```

2. `node build.js` — the generator computes the remaining colours from the 5 main ones, writes the CSS file · registers the theme · adds its label to every language file
3. `node tools/run-unit.cjs theme` — checks that every variable is there · contrast passes · the paper colours are untouched
4. Start the app → Settings → General → Colour theme

| Field | |
|---|---|
| `id` | a–z 0–9 and hyphens · unique |
| `mode` | `dark` or `light` |
| `colors` | 5 required colours: `bg` `fg` `accent` `accentHi` `link` · optional: `side` `bar` `border` `dim` `sel` |
| `vars` | Overrides individual variables, e.g. `{ "--chip": "#334455" }` |
| `group: "a11y"` | A vision theme (it appears as a button on the Accessibility page) — it must include `status` (warning/danger colours that can be told apart) |

Rules a theme must satisfy: **it does not change the colours of the page** (a theme only styles the app shell) · text colours are pushed automatically until contrast passes · the full guide is in `renderer/themes/README.md`.

> A plugin **should not** make a "theme" by injecting CSS over the app's variables — it affects the paper colours/contrast the app guarantees, and breaks when the app renames a variable.

## 10.7 Things you can export and import as a set

| Thing | Where to export/import | File |
|---|---|---|
| **A scene-status set** + colours | File → Settings → Manage scene statuses → export / import | `.json` (importing = merging with what you have) |
| **A Story Network colour set** | Settings → Story Network → Save as new set | Stored with the project |
| **The panel layout** | Export → Export panel layout (JSON)… | `.json` (for reference/problem reports) |
| **A Story Starter story** | The Story Starter panel → export/import | `.zip` (one portable folder) |
| **AI providers** (keys do not cross machines) | AI settings → Save as mine / Use my providers | Stored on the machine |
| **Export file-name presets** | The Export Hub → Save as preset | A user setting |
| **A planning board** | The board → export JSON | `.json` |
| **The whole project** (everything above that belongs to the project) | Export → Whole project as ZIP… | `.zip` |

**A "starter kit" for a team/community**: the most complete way is to make a **template project** — an empty project with Wiki templates · statuses · workflows · AI skills · dictionaries · its own vocabulary · (project plugins, if needed) already set up. Export it as a ZIP for others to import and start work from.

## 10.8 Choosing the right extension point

| You want | Use |
|---|---|
| The app's vocabulary to match your work (Scene → Quest) | A project language file |
| Proper names to stop being underlined in red | A dictionary |
| The AI to write in the story's style | Skills · agents · the system prompt · per-entity prompts |
| Your own character data fields | Wiki templates |
| A particular look for exported files | Workflows (+ the JavaScript step) · format settings |
| Your team's work statuses | A scene-status set |
| A new command · a new panel · automatic work on save · a link to an outside service | **A plugin** |
| A new export format in the Export Hub · a new shortcode · a theme · a feature in the editor | Change the app's source (a pull request) |

---

Next: [11. Debugging and testing →](11-debugging-testing.md)
