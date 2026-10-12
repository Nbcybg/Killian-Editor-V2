# Appendix E — Glossary

**Language:** English · [ภาษาไทย](../th/E-glossary.md)

[← Back to the manual contents](README.md)

The terms used in the app and in this manual, by subject.

## Structure of a work

| Term | Meaning | See |
|---|---|---|
| **Project** | One folder containing a `project.khn.json` file — everything belonging to one work | [1](01-getting-started.md) |
| **Book** (Section) | A container for chapters = a top-level folder in the project | [3](03-project-structure.md) |
| **Draft** | A copy of a book's structure for trying changes · a book has one "main draft" | [3.9](03-project-structure.md#39-drafts) |
| **Chapter** | A container for scenes | |
| **Scene** | The smallest unit of the story = one `.md` file | |
| **Memo** | A note file in the project that is not part of the manuscript | [3.11](03-project-structure.md#311-memos) |
| **Header** (frontmatter) | The `--- … ---` part at the top of a `.md` file that holds the scene's properties | [D](D-file-formats.md) |
| **Registry files** | `section.json` `draft.json` `scenes.json` — they record the order and names of books/chapters/scenes | [D](D-file-formats.md) |
| **Scene properties** | Status · synopsis · point of view · mood · conflict · tags · story time, and so on | [3.5](03-project-structure.md#35-scene-properties) |
| **Status** | The stage a scene is at, e.g. Outline · Writing · Done · Checked · Archived | [3.6](03-project-structure.md#36-scene-statuses) |
| **Act** | A major section of the story — a property of the chapter | |
| **Story time** (story date) | When, in the story's world (not a real date) — used to place scenes on the timeline | |

## The screen

| Term | Meaning | See |
|---|---|---|
| **Panel** | A part of the window that can be docked/floated/tabbed/torn off into a window | [2.7](02-interface.md#27-the-panel-system) |
| **Dock** | To attach a panel to an edge of the workspace | |
| **Float** | A panel that floats over the writing area | |
| **Tear off** | To move a panel into a separate system window | |
| **Tab group** | Several panels stacked in one slot, switched by tabs | |
| **Workspace** | A saved panel layout | |
| **Project panel / Explorer** | The book → chapter → scene tree | [3.2](03-project-structure.md#32-the-project-panel-explorer) |
| **Navigation panel** | The outline of the open document | [11.5](11-search-navigate.md#115-the-navigation-panel) |
| **Writing area** | The central part that holds the document tabs | |
| **Format bar** | The bar of formatting buttons floating over the writing area | [2.4](02-interface.md#24-the-format-bar) |
| **Floating button / FAB** | The + button at the bottom right | [2.5](02-interface.md#25-the-floating--button-fab) |
| **Status bar** | The bar at the very bottom of the window | [2.6](02-interface.md#26-status-bar) |
| **Home** | The screen listing your recent projects | [1.3](01-getting-started.md#13-first-launch-the-home-screen) |
| **Toast** | A brief notification in the corner of the screen | |
| **Tooltip** | The description that appears when you hover | |
| **Command** | One action of the app — menus, buttons and shortcuts all call the same command | [C](C-commands.md) |

## Writing

| Term | Meaning | See |
|---|---|---|
| **Novel mode / screenplay mode** | The kind of scene — it decides the editor and the formatting | [4](04-writing-novel.md) · [5](05-writing-screenplay.md) |
| **View** | How the page is shown: Normal · Layout · Draft · Side-by-side · Overview | [4.5](04-writing-novel.md#45-the-page-and-how-you-view-it) |
| **Layout** | The view that shows real sheets and real page breaks | |
| **Element** | The type of a line in a screenplay (scene heading · action · character · dialogue …) | [5.1](05-writing-screenplay.md#51-screenplay-elements) |
| **Scene heading** (slugline) | The line that opens a screenplay scene, e.g. `INT. KITCHEN - DAY` | |
| **Parenthetical** | A direction for the line, under the character's name | |
| **Transition** | A scene-change instruction such as `CUT TO:` | |
| **Extension** | After a character's name: `(V.O.)` `(O.S.)` `(cont'd)` | |
| **CONTINUED / MORE** | Text indicating that a scene/speech carries on over the page | [5.4](05-writing-screenplay.md#54-page-breaks--continued--more) |
| **Line-prefix codes** | The marks in a file that say what type a line is (`###` `@` `>>` …) | [D](D-file-formats.md) |
| **SmartType** | Completes names/words as you type | [4.8](04-writing-novel.md#48-smarttype--completing-names-from-the-wiki) |
| **Shortcode** | `[title]` — replaced by a real value on export | [4.13](04-writing-novel.md#413-shortcodes-and-wiki-variables) |
| **Quick note** | A short note jotted while writing | [4.11](04-writing-novel.md#411-three-kinds-of-notes-kept-out-of-the-manuscript) |
| **Comment** | A remark anchored to text in a scene | [4.12](04-writing-novel.md#412-comments) |
| **Focus mode / reading mode / typewriter mode** | Modes that cut distraction | [4.6](04-writing-novel.md#46-zoom-and-writing-modes) |
| **Problem scene** (on-set) | A scene whose original is kept for comparison with the revised version | [5.10](05-writing-screenplay.md#510-problem-scenes--comparing-against-the-on-set-version) |
| **Script checker** (validator) | Checks the format of a screenplay | [5.8](05-writing-screenplay.md#58-the-script-format-checker) |

## The story world

| Term | Meaning | See |
|---|---|---|
| **Wiki** | The store of information about the story's world | [6](06-wiki-world.md) |
| **Entity** | One Wiki page — a character · a location · an item · a piece of lore … | |
| **Category** | A group of entities | |
| **Template** | A category's set of data fields (`templates.json`) | |
| **Alias** | An entity's nickname/epithet | |
| **Relationship** | A link between entities, with a role and a type | |
| **Mentions** (backlinks) | The list of scenes that mention an entity | [6.3](06-wiki-world.md#63-automatic-links-and-mentions) |
| **Encyclopedia** (Codex) | The encyclopedia-style view of the Wiki | [6.4](06-wiki-world.md#64-the-encyclopedia-codex) |
| **Story Network / relationship map** | The graph of entities and scenes | [6.5](06-wiki-world.md#65-story-network--the-relationship-map) |
| **Image library** (Gallery) · **album** | The project's images, and groups of them | [6.7](06-wiki-world.md#67-the-image-library) |
| **Mood board** | A canvas for reference images | [6.8](06-wiki-world.md#68-the-mood-board) |

## Planning

| Term | Meaning | See |
|---|---|---|
| **Dashboard** | An overview of progress | [7.1](07-planning.md#71-dashboard) |
| **Kanban** | A board of scenes arranged by status | [7.2](07-planning.md#72-kanban) |
| **Timeline** | The order of events in story time | [7.3](07-planning.md#73-timeline) |
| **Track** | A row of events on the timeline | |
| **Planning board** (Planner) | A free-form canvas of cards | [7.4](07-planning.md#74-planning-board) |
| **Branching chart** (branch map) | The chart of the story's choices | [7.5](07-planning.md#75-branching-chart-and-play-test) |
| **Choice** | A point where the story branches — `[text]` in a scene | |
| **Plan** | A set of positions/arrangements of the branching chart saved as a file | |
| **Play-test** (Player Mode) | Reading a branching story as a player | |
| **Pin · zone · door pin** | Things on a map | [7.6](07-planning.md#76-maps) |
| **Floor plan** | A top-down set plan | [7.7](07-planning.md#77-floor-plan) |
| **Beat** | One moment of a scene on a floor plan | |
| **Sprint** | A timed writing round | [7.9](07-planning.md#79-writing-sprints) |
| **Logline** | The core of the story in one sentence | [7.10](07-planning.md#710-journal-and-logline) |

## AI

| Term | Meaning | See |
|---|---|---|
| **Provider** | An AI endpoint you configure yourself | [8.2](08-ai.md#82-setting-up-a-provider) |
| **Credential** | A provider's key + address | |
| **Session** | One conversation with the AI | |
| **Mode** (chat) | What the AI may do: Plan · Co-write · Fully unlocked | [8.4](08-ai.md#84-chat-with-your-story-the-ai-writing-assistant-panel) |
| **Access level** | How much of your content the AI sees | |
| **System prompt** | Text sent before every AI request | |
| **Agent** | An assistant writer whose persona and references you define | |
| **Skill** | A standing-instruction file for the AI, in `Skills/` | |
| **Token** | The unit models count text in — used for cost and limits | |
| **AI Hub** | The panel that gathers the way in to every AI feature | [8.3](08-ai.md#83-ai-hub--one-way-in-to-everything) |
| **Rehearsal Room** | The AI plays your characters talking to each other | [8.9](08-ai.md#89-rehearsal-room) |
| **Story Starter** | Sets up a story and plays it in episodes with the AI | [8.10](08-ai.md#810-story-starter) |

## Exporting and looking after your work

| Term | Meaning | See |
|---|---|---|
| **Export Hub** | The dialog that exports the manuscript in every format | [9.1](09-export-import-print.md#91-the-export-hub) |
| **Workflow** | The sequence of steps that transforms the manuscript before it becomes a file | [9.2](09-export-import-print.md#92-export-workflows) |
| **Title page** · **page header** · **Cast of Characters** | Special pages and parts of an exported file | [5.7](05-writing-screenplay.md#57-title-pages--page-headers--cast-page) |
| **Watermark** | Text over every page of a PDF | |
| **Version history** (snapshots) | A copy of a file's content at each save | [10.3](10-history-backup.md#103-a-files-version-history) |
| **Activity history** | A timeline of actions on files; you can go back | [10.4](10-history-backup.md#104-activity-history-go-back-to-any-point) |
| **Trash** (Recycle) | Where deleted things are kept | [10.5](10-history-backup.md#105-the-trash) |
| **Backup** | A daily copy of the whole project | [10.6](10-history-backup.md#106-project-backups) |
| **Pending work** | Things that were changed and not yet saved | [10.2](10-history-backup.md#102-pending-work--before-closing-or-switching-projects) |
| **Project health check** | Checks/repairs the registries against the real files | [3.12](03-project-structure.md#312-project-health-check) |
| **User settings / project settings** | The scope of a setting | [12.1](12-settings.md#121-know-this-first-user-settings-versus-project-settings) |
| **User-data folder** | Where this machine's settings, plugins and logs are kept | [1.7](01-getting-started.md#17-where-the-app-keeps-its-data) |
| **Plugin** | Add-on code that gives the app new abilities | [14](14-plugins.md) |
| **Activity log** (Log) | The record of what the app does | [15.5](15-update-bug-log.md#155-the-activity-log) |

---

[← Back to the manual contents](README.md)
