# Appendix C — Every command

**Language:** English · [ภาษาไทย](../th/C-commands.md)

> Generated from the app itself, version **2.0.0-alpha.release.2** (English · default settings). Menu names and shortcuts on your machine may differ with the language you chose and the shortcuts you rebound.
> On macOS: `Ctrl` = `⌘` · `Alt` = `⌥`

[← Back to the manual contents](README.md)

Everything you can trigger in the app (menu items, buttons, shortcuts, the floating button) runs the same "command". This table is the full command registry, with the description the app shows in tooltips.

- The **command id** is the command’s internal name. You see it in the activity log on `cmd:` lines, and it is handy to quote in a bug report.
- An id containing `:` is a command with a value, e.g. `zoom:1` = zoom in one step · `toggle-panel:kanban` = show/hide the Kanban panel.
- An empty shortcut cell means there is no default shortcut (use the menu or a button).
- Ids starting with `ui:` are toolbar buttons that have no menu item.

## Create

| Command id | Default shortcut | What it does |
|---|---|---|
| `chapter` | `Ctrl+Alt+1` | Creates a new chapter in the book you choose and opens it. A chapter groups several scenes together. |
| `character` | `Ctrl+Alt+3` | Creates a new character page in the Wiki from the character template — a place for the details you look up while writing. |
| `location` | `Ctrl+Alt+4` | Creates a new location page in the Wiki from the location template — for the look and feel of your settings. |
| `memo` | `Ctrl+Alt+5` | Creates a memo in the project for ideas, research, or anything that has no home yet — kept apart from the manuscript. |
| `new-entity:characters` |  | Creates a new character page in the Wiki from the character template. |
| `new-entity:items` |  | Creates a new item page in the Wiki — weapons, artefacts, or anything important a character carries. |
| `new-entity:locations` |  | Creates a new location page in the Wiki from the location template. |
| `new-entity:lore` |  | Creates a new lore page in the Wiki — history, religion, rules of magic, anything about how your world works. |
| `quick-note` | `Ctrl+Shift+Q` | Jot down a thought without leaving the scene you are writing. All notes collect in the notes panel. |
| `scene` | `Ctrl+Alt+2` | Creates a new scene in the chapter you choose. Scenes are the smallest unit of the story; each is its own .md file. |
| `scratchpad` |  | Opens the quick notebook for jotting down passing thoughts, separate from the manuscript. |
| `new-entity` |  | Creates a new Wiki page in the chosen category, from that category’s template. |

## File · project · tabs

| Command id | Default shortcut | What it does |
|---|---|---|
| `backup-now` |  | Backs up the whole project right now instead of waiting for the automatic backup. Good before a big rewrite. |
| `close-all-tabs` | `Ctrl+Shift+W` | Closes every document tab. If any tab has unsaved changes you are asked first. |
| `close-tab` | `Ctrl+W` | Closes the current tab, always asking first if it has unsaved changes. |
| `new-from-template` | `Ctrl+Shift+N` | Creates a new project from a template that already has a story structure and Wiki categories set up. |
| `new-project` | `Ctrl+N` | Creates an empty project in the folder you choose. Everything is stored as .md and .json you can edit outside the app. |
| `next-tab` | `Ctrl+Tab / Ctrl+PageDown` | Switch to the next tab in tab-bar order (wraps around at the end) · While typing a screenplay, the first key of this command cycles element types instead (Settings → Screenplay keys) |
| `open-project` | `Ctrl+O` | Opens an existing project folder — the one containing project.khn.json. |
| `prev-tab` | `Ctrl+Shift+Tab / Ctrl+PageUp` | Switch to the previous tab in tab-bar order (wraps around at the start) · While typing a screenplay, the first key of this command cycles element types instead (Settings → Screenplay keys) |
| `project-doctor` | `Ctrl+Alt+Shift+D` | Checks that the scene index matches the real files — finds orphan files, scenes sharing a file, ghost folders and broken file headers — and repairs them |
| `reopen-closed-tab` | `Ctrl+Alt+Shift+Z` | Reopens the document you just closed. Press again to go further back, one tab at a time. |
| `save` | `Ctrl+S` | Saves the document in the current tab to its file. |
| `save-all` | `Ctrl+Alt+S` | Saves everything with pending changes at once — document tabs, planner boards and branch plans. |
| `save-as` | `Ctrl+Shift+S` | Saves this tab’s content as a new .md file wherever you choose. The original file is left untouched. |
| `settings` | `Ctrl+,` | Opens project and app settings — saving, fonts, page setup, language and shortcuts. |
| `confirm-quit` |  | Quits the app. If anything is unsaved, you get a list to decide on first. |
| `custom-status` |  | Add, rename or remove the scene statuses (draft, revising, done…) used across the project. |
| `home` |  | Opens the home screen — recent projects, and creating or opening another project. |
| `lang-fonts` |  | Choose fonts by character range — one font for Thai, another for Latin — for both prose and scripts. |
| `open-project-path` |  | Opens a project from the recent projects list. |
| `project-setup` |  | Sets the work’s details — author, agent, copyright — used on title pages and in exported files. |
| `revert` |  | Discards unsaved changes and reloads the content from the last saved file. |
| `sync-scene-meta` |  | Reads scene properties back from the .md file headers — use after editing files in another program. |
| `visual-tags` |  | Manage the colour tags you attach to scenes — by storyline or main character, for example. |

## Export · import · print

| Command id | Default shortcut | What it does |
|---|---|---|
| `compile` | `Ctrl+Alt+X` | Exports the manuscript through a workflow of steps you control — strip comments, merge chapters, add headings — before converting to the final file. |
| `export-blog` | `Ctrl+Shift+B` | Exports a single formatted HTML page ready to paste into a blog or website. |
| `export-hub` | `Ctrl+Shift+E` | Every way to export in one dialog: pick a destination, adjust the settings, and preview before saving. |
| `export-pdf` | `Ctrl+Alt+Shift+P` | Opens the export hub to make a PDF, with a preview before you save. |
| `import-scrivener` | `Ctrl+Alt+Shift+I` | Imports a Scrivener (.scriv) project as a Killian project, keeping its chapters and scenes. |
| `print` | `Ctrl+P` | Prints the open document with your page settings. If checking before printing is on, the script is checked first. |
| `export-draft` |  | Exports the whole draft as a single Markdown file. |
| `export-fdx` |  | Exports the screenplay as a Final Draft (.fdx) file to continue in other screenwriting software. |
| `export-json` |  | Exports all project data as one JSON file — for backup or for other tools. |
| `export-language-csv` |  | Exports the app’s text as a CSV table (key · Thai · English) so translators can work in a spreadsheet. |
| `export-panel` |  | Export a panel's content (timeline · map · boards · graphs, etc.) in the chosen format |
| `export-panel-layout` |  | Saves the current panel layout as a JSON file, to keep as a reference or attach to a panel bug report. |
| `export-pdf-builtin` |  | Exports a PDF directly with the built-in PDF generator, bypassing the export hub. |
| `export-rtf` |  | Exports the screenplay as an RTF file that opens in Word and most word processors. |
| `export-watermark` |  | Sets a watermark printed across every page of exported files — a recipient’s name, or the word DRAFT. |
| `export-zip` |  | Packs the whole project folder into one ZIP file, for backup or sharing. |
| `import-docx-comments` |  | Bring the comments and replies an editor wrote in a Word file (.docx) back into your scenes, merged with existing comments without duplicates; threads resolved in Word are closed. Scene text is not changed. |
| `import-language-csv` |  | Imports translations from an edited CSV file, merging them into the project’s language files with immediate effect. |
| `import-manuscript` |  | Bring existing work from Word (.docx), Markdown (.md) or pasted text into the project as a new book. Chapters and scenes are split from headings or chapter lines, and you see the structure before importing. |
| `import-script` |  | Imports a screenplay from Fountain, Final Draft (FDX), Celtx, Fade In or Adobe Story, with a preview first. |

## Edit · search · navigate

| Command id | Default shortcut | What it does |
|---|---|---|
| `delete-line` | `Ctrl+Shift+Delete` | Deletes the whole line the cursor is on in one go — no need to select it first. |
| `editor-redo` | `Ctrl+Shift+Z / Ctrl+Y` | Reapply what you just undid — handy for flipping between two versions of a sentence. |
| `editor-undo` | `Ctrl+Z` | Step back through your edits, one change at a time, all the way to when you opened this scene. |
| `find` | `Ctrl+F` | Finds and replaces inside the document you have open right now. |
| `global-search` | `Ctrl+Shift+F` | Searches every scene, chapter and wiki page in the project at once. Supports AND, OR, NOT and field-specific queries. |
| `goto` | `Ctrl+G` | Opens a box where you type a page or scene number, then jumps straight there. Handy in long documents. |
| `goto-page` | `Ctrl+Shift+.` | Jumps to a given page in the open document, using the page numbers of the page view. |
| `goto-scene` | `Ctrl+Shift+,` | Jumps to a given scene by its number — useful in screenplays with many scene headings in one file. |
| `insert-image` | `Ctrl+Shift+I` | Inserts a picture at the cursor. The file is copied into the project's Images folder for you. |
| `nbsp` | `Ctrl+Shift+Space` | Inserts a space that never breaks across lines — keeps things like a number and its unit together. |
| `project-replace` | `Ctrl+Alt+Shift+H` | Replaces text in every scene and note of the project at once, with a preview first, skipping locked scenes |
| `quick-open` | `Ctrl+Shift+O` | Find any file in the project by typing part of its name and open it — no digging through the tree. |
| `replace` | `Ctrl+H` | Opens the find bar with the cursor already in the replace box. Applies to the document you have open right now. |
| `select-scene` | `Ctrl+Shift+A` | Selects the whole scene the cursor is in, from its heading up to the next one — for copying or moving scenes in a screenplay. |
| `thesaurus` | `Ctrl+Alt+Shift+T` | Looks up synonyms and antonyms for the selected word, to help you avoid repeating yourself. |
| `reveal-active` | `Ctrl+Shift+1` | Scroll the project tree to the open file, expand collapsed chapters/books and flash the row |
| `all-notes` |  | Lists the quick notes from every scene in one place; click one to go to its scene. |
| `char-map` |  | Insert special characters that aren’t on your keyboard, such as typographic punctuation or symbols. |
| `comments` |  | Opens comments for the current scene — attach notes to text, reply, and resolve them. |
| `goto:page` |  | Opens a box to type a page number, then jumps to that page. |
| `goto-page:1` |  | Jumps back to the first page of the document. |
| `goto:scene` |  | Opens a box to type a scene number, then jumps to that scene. |
| `insert-shortcode` |  | Inserts a shortcode that is replaced by a real value on export — the title, chapter name or date. |
| `smart-manage` |  | Review and remove words SmartType has learned — like a misspelled character name it picked up. |
| `ui:find-close` |  | Closes the find bar. |
| `ui:find-next` |  | Goes to the next match. |
| `ui:find-prev` |  | Goes to the previous match. |
| `ui:find-rep1` |  | Replaces the current match, then moves to the next one. |
| `ui:find-repall` |  | Replaces every match in this document at once. Can be undone. |
| `word-history` |  | Finds frequently repeated words and shows word-usage statistics, to catch your verbal tics. |

## Text formatting

| Command id | Default shortcut | What it does |
|---|---|---|
| `fmt:align:center` | `Ctrl+Shift+K` | Centres the text. Good for titles, dedications and short verse — poor for long body text. |
| `fmt:align:justify` | `Ctrl+Shift+J` | Stretches each line to touch both margins for a clean book-like edge — but can open wide gaps on lines with long words. |
| `fmt:align:left` | `Ctrl+Shift+L` | Aligns text to the left margin. This is the default for body text: every line starts in the same place, so the eye finds the next line quickly. |
| `fmt:align:right` | `Ctrl+Shift+R` | Aligns text to the right margin — typically for dates, bylines, or screenplay transitions. |
| `fmt:bold` | `Ctrl+B` | Makes the selected text bold. Use it to stress a key word — overuse it and nothing stands out. |
| `fmt:clear` | `Ctrl+Space / Ctrl+Alt+Space` | Removes bold, italic, underline and colour from the selected text, leaving plain text. |
| `fmt:heading:1` | `Ctrl+1` | Makes this paragraph a level-1 heading — the largest, usually a title or part name. In a screenplay the same key makes a scene heading. |
| `fmt:heading:2` | `Ctrl+2` | Makes this paragraph a level-2 heading — usually a chapter title. |
| `fmt:heading:3` | `Ctrl+3` | Makes this paragraph a level-3 heading — usually a section inside a chapter. |
| `fmt:italic` | `Ctrl+I` | Italicises the selected text — commonly used for inner thoughts, titles of works, and foreign words. |
| `fmt:ol` | `Ctrl+Shift+7` | Turns the selected paragraphs into a numbered list — for steps or anything with a required order. |
| `fmt:paragraph` | `Ctrl+0` | Turns the paragraph back into body text, removing a heading or quote style. |
| `fmt:strike` | `Ctrl+Shift+X` | Strikes through the selected text — shows that something was cut while keeping it visible. |
| `fmt:sub` | `Ctrl+Alt+-` | Lowers the selected text — for chemical formulas and subscripts. |
| `fmt:sup` | `Ctrl+Alt+=` | Raises the selected text — for exponents and footnote reference numbers. |
| `fmt:ul` | `Ctrl+Shift+8` | Turns the selected paragraphs into a bulleted list — for items whose order does not matter. |
| `fmt:underline` | `Ctrl+U` | Underlines the selected text. Use sparingly in print — it reads harder than bold or italic. |
| `text-case-cycle` | `Ctrl+Alt+U` | Cycles the selected text through letter-case styles; press again until you get the one you want. Affects Latin letters. |
| `fmtbar-align` | `Ctrl+Shift+;` | Snaps the floating format bar to the top or bottom edge of the writing area; press again to switch. |
| `fmtbar-here` | `Ctrl+Shift+/` | Brings the floating format bar to where your mouse is, so you don’t have to look for it. |
| `fmtbar-lock` | `Ctrl+Shift+=` | Locks the floating format bar in place so it can’t be dragged by accident; press again to unlock. |
| `fmtbar-opacity` | `Ctrl+Shift+'` | Cycles the floating format bar through 100%, 50% and 5% opacity. A faded bar becomes solid again when you point at it. |
| `fmt` |  | Text formatting — bold, headings, lists and so on; each button says which style it applies. |
| `fmt:code` |  | Turns the paragraph into a code block, shown in a monospaced font with no formatting inside. |
| `fmt:heading:4` |  | Makes this paragraph a level-4 heading — the deepest level that still appears in the outline. |
| `fmt:hr` |  | Inserts a horizontal rule — for a time skip or a change of viewpoint within a scene. |
| `fmt:quote` |  | Turns this paragraph into a block quote, indented with a bar on the left — good for letters or quoted passages. |
| `prose-indent` |  | Turns automatic first-line paragraph indents in prose on or off. |
| `prose-setup` |  | Sets prose formatting — indents, line spacing, heading styles — on screen and in exported files. |
| `text-case` |  | Changes the selected text to a given letter case. Affects Latin letters. |
| `text-case:aC` |  | Alternates lower and upper case letter by letter — for a mocking or odd-sounding effect. |
| `text-case:CC` |  | Capitalises the first letter of every word. |
| `text-case:iC` |  | Swaps lower and upper case — fixes text typed with Caps Lock on by mistake. |
| `text-case:lc` |  | Changes the selected text to all lower case. |
| `text-case:SC` |  | Capitalises the start of each sentence and lower-cases the rest. |
| `text-case:TC` |  | Title case: capitalises the important words and leaves small words like of and the in lower case. |
| `text-case:UC` |  | Changes the selected text to all upper case. |
| `ui:tb-case` |  | Changes the case of the selected text (all caps, all lowercase, sentence case) without retyping it. |
| `ui:tb-color` |  | Changes the colour of the selected text. Offers presets, a colour wheel, and the colours you used recently. |
| `ui:tb-highlight` |  | Paints a highlight behind the selected text — good for marking spots to come back to. It is saved with the file. |
| `ui:tb-indent` |  | Toggles the automatic first-line indent. This is the book-style way of separating paragraphs, instead of blank lines. |
| `ui:tb-quote` |  | Wraps the selected paragraphs as a block quote — indented with a rule, marking text taken from elsewhere. |
| `ui:tb-source` |  | Shows this scene's raw markdown — exactly what is written to the file, which you can also edit outside the app. |

## Screenplay

| Command id | Default shortcut | What it does |
|---|---|---|
| `sp-element:act-break` | `Ctrl+8` | Turns this line into an act break, marking a major division of the story. |
| `sp-element:dialogue` | `Ctrl+5` | Turns this line into dialogue, placed under the character name with standard script margins. |
| `sp-element:note` | `Ctrl+9` | Turns this line into a writer’s note — a reminder to yourself, not part of the script the actors read. |
| `sp-element:parenthetical` | `Ctrl+4` | Turns this line into a parenthetical such as (whispering), placed between the character name and the dialogue. |
| `sp-element:shot` | `Ctrl+7` | Turns this line into a shot, such as CLOSE ON — for when the camera angle genuinely matters. |
| `sp-element:transition` | `Ctrl+6` | Turns this line into a transition such as CUT TO:, right-aligned in standard script format. |
| `sp-find-error` | `Ctrl+Shift+U` | Jumps to the next place the script checker flags as incorrectly formatted. |
| `toggle-format` | `Ctrl+Shift+M` | Switch this file between prose and screenplay. The text is converted to the other format's grammar. |
| `onset-toggle` | `Ctrl+Alt+Shift+O` | For a "problem scene": switch between the original (read-only) and the revised version — colour bands and a ! in the margin mark what differs · print/export always use the revised version |
| `page-headers` |  | Sets the header printed on every page — title, author, or draft number. |
| `page-numbers` |  | Shows or hides page numbers in the top-right corner of screenplay pages. |
| `page-setup` |  | Sets paper size, margins and script format — affecting both the screen and exported files. |
| `remove-elements` |  | Removes every line of the chosen element types from the script at once — such as all notes before sending it out. Can be undone. |
| `roster` |  | Builds a cast-of-characters page for the book from the characters in the Wiki. |
| `scene-numbers` |  | Shows or hides scene numbers on both sides of screenplay scene headings, on screen and in exports. |
| `set-format` |  | Switches the document between prose and screenplay mode. |
| `set-format:prose` |  | Switches this document to prose mode — paragraphs, headings and lists. |
| `set-format:screenplay` |  | Switches this document to screenplay mode — scene headings, action, characters and dialogue. |
| `sp-auto-capitalize` |  | Automatically capitalises the first letter of each sentence as you type in a screenplay. |
| `sp-auto-correct-i` |  | Automatically corrects a lone i to I in English screenplays. |
| `sp-check-all` |  | Checks the whole script’s formatting and lists every problem; click one to jump to that line. |
| `sp-check-toggle` |  | Checks script formatting before every print or export, asking before continuing if problems are found. |
| `sp-compare` |  | Compares two open documents line by line, showing what was added, removed or changed between versions. |
| `sp-continued` |  | Adds continuation marks (CONTINUED · MORE · CONT'D) automatically when a scene or speech breaks across pages. |
| `sp-element` |  | Changes the element type of a screenplay line — scene heading, action, character, dialogue and so on. |
| `sp-element-caps` |  | Choose which element types are forced to upper case, such as scene headings or character names. |
| `sp-extension` |  | Adds an extension after a character name, such as (V.O.) for voice-over or (O.S.) for off-screen. |
| `sp-force-case` |  | Forces standard upper case on scene headings, character names and transitions. Turn off to type as you like. |
| `sp-report` |  | Opens a screenplay report — characters, locations, or the dialogue chart. |
| `sp-report:character` |  | Reports which scenes each character appears in and how much they speak. |
| `sp-report:chart` |  | A chart of how much each character speaks on every page. |
| `sp-report:location` |  | Reports which scenes use each location — handy for planning a shoot. |
| `sp-show-format` |  | Shows element outlines and end-of-line marks, so you can see what type each line is. |
| `sp-thai-font` |  | Switches screenplays to a Thai font instead of the standard monospaced script font. |
| `sp-view` |  | Changes how the document is displayed — normal, draft, layout, side by side, or overview. |
| `sp-view:draft` |  | Draft view: plain text with no pages or scene numbers — for writing fast. |
| `sp-view:layout` |  | Layout view: shows the real page breaks, exactly as in the exported file. |
| `sp-view:normal` |  | Normal view: write on one continuous page without page breaks. |
| `sp-view:overview1` |  | Tightest overview, 1px per character — see the shape of the story and how dense each page is. |
| `sp-view:overview4` |  | Overview at 4px per character — still shows page structure and scene headings. |
| `sp-view:side` |  | Shows pages in pairs, like an open book. |
| `title-pages` |  | Create or edit title pages for scripts and books, placed at the front of exported files. |
| `ui:tb-sp-cont` |  | Toggles the screenplay's automatic continuation marks — (CONTINUED) at page ends and (MORE) when dialogue crosses a page. |
| `ui:tb-sp-ext` |  | Adds an extension after a character name — (V.O.) voice-over, (O.S.) off-screen, (cont'd) continuing. |

## View · zoom · modes

| Command id | Default shortcut | What it does |
|---|---|---|
| `focus-mode` | `Ctrl+Shift+D` | Hides everything around the writing area, leaving only the page, so you can write without distraction. |
| `line-numbers` | `Ctrl+Alt+R` | Shows line numbers in the left gutter — useful when discussing or applying notes to specific lines. |
| `read-book` | `Ctrl+Alt+Shift+R` | Reads the whole book as one continuous, read-only document — good for a full read-through. |
| `reading-mode` | `Ctrl+Shift+H` | Enters full-screen reading mode — hides every toolbar and panel, leaving only the page. |
| `split-view` | `Ctrl+Shift+\` | Splits the writing area in two, to compare two documents or view two places in the same scene. |
| `typewriter` | `Ctrl+Shift+T` | Keeps the line you are typing pinned to the middle of the screen — the page scrolls up to meet it, so your eyes stay in one place. |
| `zoom:0` | `Ctrl+Shift+0` | Resets page zoom to 100%. |
| `zoom:1` | `Ctrl+=` | Zooms the page in one step. The actual font size in your file does not change. |
| `zoom:-1` | `Ctrl+-` | Zooms the page out one step. The actual font size in your file does not change. |
| `auto-fit-width` |  | Turns automatic fitting on or off: the page shrinks to fit when the document panel is narrower than the page, and grows back when it widens (never above the zoom you set yourself). |
| `markdown-codes` |  | Shows or hides the leading markdown codes (# > . @). Hidden reads cleaner; shown reveals the real structure stored in the file. |
| `page-guides` |  | Shows dashed margin guides on all four sides, so you can see where text will sit on the printed page. |
| `split-add` |  | Adds another split pane; you can nest several, both side by side and stacked. |
| `split-close` |  | Merges the split panes back into a single writing area. |
| `split-view:down` |  | Splits the writing area into top and bottom panes. |
| `split-view:right` |  | Splits the writing area into left and right panes. |
| `toggle-fab` |  | Shows or hides the floating button in the bottom-right corner that gathers the create-new commands. |
| `toggle-home-always` |  | Shows the home screen every time the app starts, even if a project was open last time. |
| `toggle-open-last` |  | Opens your most recent project straight away when the app starts, skipping the home screen. |
| `toggle-theme` |  | Changes the app colour theme for bars, panels and dialogs — not the page or exported files. |
| `toolbar-config` |  | Choose which buttons appear on the toolbar; changes take effect as you tick. |
| `ui:filter-archive-toggle` |  | Hides or shows archived scenes in the project tree. They are still there, just out of the way. |
| `ui-scale` |  | Changes the size of toolbars, panels and dialogs, without affecting the page. |
| `ui-scale:0` |  | Resets toolbars, panels and dialogs to their normal 100% size. |
| `ui-scale:1` |  | Makes toolbars, panels and dialogs one step larger — helpful on high-resolution screens. |
| `ui-scale:-1` |  | Makes toolbars, panels and dialogs one step smaller, leaving more room to write. |
| `zoom` |  | Page zoom — in, out, reset, or fit to width. |
| `zoom:fit` |  | Zooms so the page width exactly fits the writing area. |

## Panels and workspaces

| Command id | Default shortcut | What it does |
|---|---|---|
| `sprint` | `Ctrl+Alt+Shift+S` | Times a writing sprint, counts the words you write during it, supports a word goal and keeps the stats in the project |
| `gallery` | `Ctrl+Shift+G` | Opens the project image library: organise albums, see where each image is used, and use images in scenes or the Wiki. |
| `kanban` | `Ctrl+K` | Opens a Kanban board of scenes by status. Drag a card to another column to change its status. |
| `toggle-panel:ai-analyzer` | `Ctrl+Alt+A` | AI manuscript analysis — pacing, character arcs, repeats, conflict, scene length, plot holes, continuity, shipping, scoring, screentime. |
| `toggle-panel:ai-chat` | `Ctrl+Alt+W` | Chat with AI about your writing — separate sessions like opencode · choose a mode (plan/co-write) · choose a model · decide how much it can see (project/book/chapter/scene) |
| `toggle-panel:ai-hub` | `Ctrl+Alt+Q` | One door into every AI feature · shows at a glance whether it is set up |
| `toggle-panel:backlinks` | `Ctrl+Alt+Shift+B` | Every scene that mentions each entity |
| `toggle-panel:books` | `Ctrl+Alt+K` | Manage books and drafts — covers · blurbs · status · per-book stats · drag to reorder books |
| `toggle-panel:branch` | `Ctrl+Alt+B` | Branching story chart — scene boxes joined by choice lines · drag cards around · pick card/line colours · warns about dead ends, loops and choices without a target · export as HTML/Markdown/JSON/image |
| `toggle-panel:chapters` | `Ctrl+Alt+Shift+K` | Chapter covers, order and stats for every chapter in a book |
| `toggle-panel:codex` | `Ctrl+Alt+C` | All the book's Wiki entities as an encyclopedia — browse by category, search by name/nickname · export as a Fandom/Wikia-style website that works fully offline |
| `toggle-panel:comments` | `Ctrl+Alt+O` | Opens the comments panel — every note left inside the text in one list. Click an entry to jump to it. |
| `toggle-panel:dashboard` | `Ctrl+Alt+D` | Progress overview — word count against goals · share of scenes by status · length of each chapter |
| `toggle-panel:dialogue` | `Ctrl+Alt+L` | All dialogue in the project — filter, jump, edit inline |
| `toggle-panel:dlgb` | `Ctrl+Alt+V` | Let AI play your Wiki characters turn by turn, then drop the lines you like into the script at the cursor — open it when you are stuck on dialogue |
| `toggle-panel:floorplan` | `Ctrl+Alt+F` | Top-down set plan — Wiki characters with facing and sight lines · cameras (body/lens/support/track) · lights · shapes · beats tied to lines of the scene |
| `toggle-panel:gallery` |  | Every image in the project's Images folder — drag into a document to insert, or choose as a cover/portrait in the Wiki |
| `toggle-panel:gallery-board` | `Ctrl+Alt+G` | A canvas for each album's reference images — open it beside the image library and drag images on · move/resize/zoom freely · removing from the board doesn't delete files |
| `toggle-panel:history` | `Ctrl+Alt+H` | A timeline of what was done to the project's files, with a way back to any point · how many are kept is set at Settings → Project info (default 32) |
| `toggle-panel:kanban` |  | Scene board by status — drag a card to another column to change that scene's status at once |
| `toggle-panel:log` | `Ctrl+Alt+9` | The app's activity log — for tracking down causes when something doesn't behave as expected |
| `toggle-panel:maps` | `Ctrl+Alt+M` | Maps of the story world — drop pins on an image, link pins to scenes/locations · portal pins lead into sub-maps |
| `toggle-panel:network` | `Ctrl+Alt+N` | Relationship chart of characters/locations/items — drag nodes to arrange them · line colours show the relationship type · double-click to open that Wiki page |
| `toggle-panel:notes` | `Ctrl+Alt+8` | A place to jot down passing ideas without touching the manuscript — notes are linked to the scene open when you write them |
| `toggle-panel:outline` | `Ctrl+Alt+7` | Heading outline of "the open file" — click a heading to jump to that place in the document |
| `toggle-panel:planner` | `Ctrl+Alt+P` | A free-form card board — place notes, images and links to scenes anywhere on the canvas · for piecing the plot together before writing |
| `toggle-panel:planner-props` |  | Properties of the card or connector selected on the Planner board — name · summary · colour · status · tags · size · line style |
| `toggle-panel:player` | `Ctrl+Alt+Y` | Read the story as a player — scene text is read-only; press choice buttons to keep going · you can go back · each run's path is kept to review later |
| `toggle-panel:plugins` | `Ctrl+Alt+E` | Manage installed plugins — enable, reload, run commands |
| `toggle-panel:props` | `Ctrl+Alt+I` | Properties of the selected scene — synopsis · point of view · mood · conflict · status · colour · tags · saved automatically as you type |
| `toggle-panel:record` | `Ctrl+Alt+J` | Log what you did today — mood, word count, time spent, tags · export as CSV for further summaries |
| `toggle-panel:search` | `Ctrl+Alt+0` | Search text across the whole project — every scene, every book and the Wiki pages · click a result to open the file at that line |
| `toggle-panel:starter` | `Ctrl+Alt+Z` | Create a story, characters and opening scenes, then play it episode by episode with AI |
| `toggle-panel:timeline` | `Ctrl+Alt+T` | Events in "story time" order — switch between card and Gantt views · scenes with a storyDate appear on their own |
| `toggle-panel:tree` | `Ctrl+Alt+6` | Table of contents for the whole work — book → chapter → scene, plus the Wiki, image library and trash · drag to reorder · the search box at the top filters by name, tag and status |
| `panels-hide-all` | `Ctrl+\` | Temporarily hides every panel, leaving just the writing area. Press again to bring them back where they were. |
| `panels-hide-left` | `Ctrl+Shift+[` | Temporarily hides the panels on the left; press again to restore them. |
| `panels-hide-right` | `Ctrl+Shift+]` | Temporarily hides the panels on the right; press again to restore them. |
| `workspace-menu` | `Ctrl+Shift+Y` | Switch between saved panel layouts, or save the current one as a new set — say, one for writing and one for planning. |
| `books` |  | Manage books and drafts — covers, blurbs, status, and drag to reorder. |
| `branching` |  | Opens the branching story map, showing where each scene’s choices lead — for visual novels and story games. |
| `branch-sync` |  | Reads the choices written in this scene as [text] in square brackets and turns them into paths on the branch map. |
| `chapters` |  | Opens the chapter manager — chapter covers, order, and statistics for every chapter in the book. |
| `dashboard` |  | Opens the project dashboard — word count against your goal, scene status, and chapter lengths. |
| `floorplan` |  | Opens the floor plan — a top-down set plan: place characters, set up cameras/lenses and lights, then block beats against the scene's lines |
| `gallery-board` |  | Opens an album’s mood board; drag images from the library to build the look and feel of the story. |
| `gallery-dups` |  | Finds duplicate images in the library, to clean up files imported twice. |
| `gallery-export-used` |  | Exports only the images actually used in scenes or the Wiki to a folder you choose. |
| `gallery-new-album` |  | Creates a new album in the image library, to group images — by character or location, say. |
| `gallery-unused` |  | Shows images in the library that aren’t used anywhere yet. |
| `maps` |  | Opens your story-world maps: pin characters and places, and nest maps from world down to city and room. |
| `network` |  | Opens the Story Network — a relationship map of characters, places and items, in 2D or 3D. |
| `panels-side-bottom` |  | Hide panels docked below the writing area; press again to bring them back |
| `panels-side-left` |  | Hide every panel docked left of the writing area; press again to bring them back |
| `panels-side-right` |  | Hide every panel docked right of the writing area; press again to bring them back |
| `panels-side-top` |  | Hide panels docked above the writing area; press again to bring them back |
| `panel-system` |  | Choose which panels to show or hide, and see what each one is for. |
| `planner` |  | Opens the free-form planning board — lay out scene cards, notes and images, and connect them. |
| `planner-align` |  | Aligns text inside planner cards left, centre or right. |
| `planner-valign` |  | Aligns text inside planner cards to the top, middle or bottom. |
| `player-history` |  | Shows the sequence of choices made while play-testing a branching story. |
| `player-mode` |  | Play-test a branching story as a reader, choosing at each scene to check every path actually works. |
| `reset-panels` |  | Resets the panel layout to the app default — for when panels go missing or the layout gets muddled. |
| `show-panel` |  | Opens the specified panel, or brings it into view if it is already open. |
| `timeline` |  | Opens the story timeline, ordering events and scenes by in-story time, as cards or a Gantt chart. |
| `toggle-panel` |  | Opens or closes the specified panel. |
| `workspace` |  | Switches to the specified panel layout. |

## AI

| Command id | Default shortcut | What it does |
|---|---|---|
| `ai-assistant` | `Ctrl+Alt+Shift+A` | Lets AI expand, summarise or rewrite the selected text; you decide whether to use the result. |
| `ai-analyzer` |  | Opens the AI analysis panel — pacing, character arcs, repeated words and more. |
| `ai-chat` |  | Opens the AI chat panel to talk about your writing. Each conversation is kept as a session in the project. |
| `ai-chat-dialog` |  | Opens the older AI chat dialog (from before the chat panel); it can answer questions about the project too. |
| `ai-chat-new` |  | Starts a new AI chat session. Earlier conversations stay in the session list. |
| `ai-chat-toggle` |  | Opens or closes the AI writing assistant panel; press again to close. |
| `ai-consistency` |  | Has AI check whether characters speak and act consistently with the Wiki and earlier scenes. |
| `ai-dialogue` |  | Has AI draft a conversation between characters for a situation you describe, for you to rework. |
| `ai-menu` |  | Opens one menu with every AI tool: AI Hub, writing assistant, chat, analyzer and Story Starter. |
| `ai-plot` |  | Has AI look for contradictions and gaps in logic (plot holes), pointing to the scenes involved. |
| `ai-settings` |  | Sets the AI provider, key, model and parameters shared by every AI feature. |
| `ai-summary` |  | Has AI summarise the whole project — for a refresher or a starting point for a synopsis. |
| `ai-title` |  | Has AI suggest titles from your content; pick one to set it as the project title. |
| `ai-world` |  | Has AI build out your story world — geography, culture, history — and save the result as Wiki pages. |
| `story-starter` |  | Opens Story Starter: set up a story, characters and opening scene step by step, then play it out in episodes with AI. |
| `story-starter-toggle` |  | Opens or closes Story Starter — set a story up step by step and play it out with AI. Press again to close. |

## Accessibility

| Command id | Default shortcut | What it does |
|---|---|---|
| `a11y-settings` |  | Opens the Accessibility page in Settings — vision themes, the pressed-key display, the cursor line highlight and typewriter mode. |
| `key-echo` |  | Shows each key you press in large type on screen, for anyone who cannot easily see the keyboard. Password fields are never shown. |
| `line-band` |  | Highlights the line the cursor is on so you can always find your place. Never printed or exported. |
| `osk` |  | Opens the operating system's on-screen keyboard so you can type with a mouse or touch screen. |
| `type-sound` |  | Plays a typewriter sound with every keystroke, for the feel of a real machine. |

## Help · system

| Command id | Default shortcut | What it does |
|---|---|---|
| `about` | `Ctrl+Alt+Shift+/` | Shows the app version, credits, and the licences of the components it uses. |
| `cheatsheet` | `Ctrl+Alt+/` | Shows every keyboard shortcut on one page, reflecting your own settings. |
| `dev-console` | `Ctrl+Shift+`` | Opens the Chromium developer tools, for tracking down why something misbehaves. |
| `auto-sync` |  | Turns the automatic tasks that keep project data up to date while you work on or off. |
| `auto-sync:false` |  | Turns off the automatic tasks that keep project data up to date. |
| `auto-sync:true` |  | Turns on the automatic tasks that keep project data up to date while you work. |
| `bug-report` |  | Write up a problem you found — or switch to a feature request — and send it to the developer straight from the app. |
| `bug-status` |  | Lists reported bugs and feature requests with their status, the version they were reported in, and the version that resolved them, with filters. |
| `changelog` |  | See what each version of the app added or fixed. |
| `check-update` |  | Checks for a newer version and always tells you the result, even when you are already up to date. |
| `extension-guide` |  | Opens the guide to writing plugins and other extensions inside the app. |
| `feature-request` |  | Describe a feature you would like and send the request to the developer straight from the app. |
| `quick-start` |  | A short tour of the basics: projects, writing, the Wiki, panels and exporting |
| `show-log` |  | Opens the app’s activity log, to look into errors or attach to a bug report. |
| `support` |  | Opens the project's support page in your browser, where you can buy the developer a coffee. |
| `sync-guide` |  | Opens the manual chapter on keeping a project in a synced folder (Google Drive, iCloud, Dropbox, OneDrive) so you can write on several computers, and on handling the copies a sync service makes when files clash. |
| `toggle-simple-mode` |  | Turns simple mode on or off: only the Explorer, the editor and the basic writing buttons stay on screen. Every other feature is still in the menus; turning it off brings your toolbar and panels back as they were. |
| `ui:tb-plug` |  | Commands added by plugins; click to pick one. |
| `ui:tb-visual` |  | Opens this scene’s storyboard, to tell it through a sequence of images. |
| `user-manual` |  | Opens the full user manual inside the app — every chapter, in English or Thai, with no internet needed. |

---

See also: [Appendix A — Menus](A-menus.md) · [Appendix B — Shortcuts](B-shortcuts.md)
