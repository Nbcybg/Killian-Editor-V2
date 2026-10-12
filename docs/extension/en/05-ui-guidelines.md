# 5. Look and feel

**Language:** English · [ภาษาไทย](../th/05-ui-guidelines.md)

[← 4. Hooks and lifecycle](04-hooks-lifecycle.md) · [Overview](README.md) · Next: [6. Working with project files and data →](06-data-and-files.md)

---

A good plugin looks like part of the app: it follows the theme · follows the UI size the user chose · works from the keyboard · and does not get in the way of writing.

## 5.1 Six principles

1. **The writing area belongs to the writer.** Never make anything appear by itself while they type (a dialog · a panel · something floating). Everything happens because the user asked.
2. **Never touch the editor's DOM** (`.ProseMirror` and its descendants). The paginator measures the real DOM; adding a class/element/style throws off page breaks for the whole document, and what you added vanishes when the document is redrawn.
3. **Use the theme's colour variables.** The app has 28 themes (dark/light/high contrast/colour-blind safe/monochrome). A fixed colour will be unreadable in some of them.
4. **Multiply sizes by `var(--ui-scale, 1)`.** Users can scale the UI from 75% to 200%.
5. **Text from the user/a file/the network always goes in with `textContent`.** Never `innerHTML`.
6. **Behave like a desktop program, not a web page.** No hand cursor on buttons · UI text is not selectable · no bouncy animation.

## 5.2 Theme colour variables

The variables are set on `<body>` (class `theme-<id>`). They are available to every element your plugin puts in the page, and change by themselves when the user changes theme.

### Surfaces

| Variable | Used for |
|---|---|
| `--bg` | The main background of the workspace |
| `--side` | Side-panel background |
| `--bar` | Toolbar / status-bar background |
| `--panel-head` | Panel headers |
| `--input-bg` | Input fields |
| `--sunken` | Sunken surfaces — code blocks · result boxes · tooltips |
| `--chip` | The background of labels (pills) |
| `--hover` | Background when hovering a button |
| `--hover-soft` | Background when hovering a row in a list |
| `--sel` | Background of whatever is selected |
| `--curline` | Background of the current line/row |
| `--border` | General borders |

### Text

| Variable | Used for |
|---|---|
| `--fg` | Main text |
| `--bright` | The most prominent text (headings) |
| `--dim` | Secondary text / descriptions |
| `--muted-strong` | Secondary text that must stay readable on a dark surface |
| `--link` | Links / clickable names |

### Accent and semantic colours

| Variable | Used for | Text on this background |
|---|---|---|
| `--accent` | The main accent (confirm buttons) | **`--on-accent`** |
| `--accent-hi` | The secondary accent (highlights · things that are on) | **`--on-accent-hi`** |
| `--st-warn` | Warnings | — |
| `--st-danger` | Danger / errors | — |
| `--danger-soft` | Hover background of a danger button | — |
| `--find-hit` | Search-result highlight | — |

Rules:

- **Pair backgrounds and text correctly**: text on `--accent` must be `--on-accent` (not `--fg`, not `#fff`).
- Always give a fallback: `color: var(--fg, #ddd)`.
- **Never signal a state by colour alone** — add an icon or text (there are colour-blind and monochrome themes).
- For translucent/mixed colours use `color-mix()` on the variables: `background: color-mix(in srgb, var(--accent) 18%, transparent)`.
- **Never touch the `--paper-*` family** or the colours of the page. The page does not follow the theme.
- Never override the theme's variables (`body { --bg: … }`). They belong to the user.

### A sample card

```css
.wcs-card {
  background: var(--side, #222);
  color: var(--fg, #ddd);
  border: 1px solid var(--border, #444);
  border-radius: calc(8px * var(--ui-scale, 1));
  padding: calc(10px * var(--ui-scale, 1)) calc(12px * var(--ui-scale, 1));
  font-size: calc(13px * var(--ui-scale, 1));
}
.wcs-card h3 { color: var(--bright, #fff); font-size: calc(14px * var(--ui-scale, 1)); margin: 0 0 6px; }
.wcs-card .wcs-sub { color: var(--dim, #999); }
.wcs-btn {
  background: var(--accent); color: var(--on-accent);
  border: 0; border-radius: calc(6px * var(--ui-scale, 1));
  padding: calc(4px * var(--ui-scale, 1)) calc(10px * var(--ui-scale, 1));
  cursor: default;                              /* no hand cursor */
}
.wcs-btn:hover { filter: brightness(1.08); }    /* a slight colour change — never move/grow on hover */
.wcs-btn:active { filter: brightness(0.92); }   /* a button must have a pressed state */
.wcs-btn:focus-visible { outline: 2px solid var(--accent-hi); outline-offset: 2px; }
```

## 5.3 Sizes, spacing and type

- Multiply every size by `var(--ui-scale, 1)`: `font-size: calc(13px * var(--ui-scale, 1))`
- The app's reference sizes: ordinary text 13px · headings inside panels 14px · descriptions 12px
- **Do not set `font-family`.** Inherit it from the app (the app's stack already includes fonts for non-Latin scripts and the icon font). If you really must set it, end the stack with `var(--thai-net)`.
- Numbers that change often (a timer · a counter): `font-variant-numeric: tabular-nums`, so the width does not jitter.
- Test at UI sizes 75% · 100% · 125% · 200%, and in languages with long words (German · French).

## 5.4 A plugin's panels

```js
k2.registerPanel('main', {
  title: 'A short name',
  icon: 'chart',
  defaultSide: 'right',
  render: (host) => { /* … */ },
});
```

- **A panel can be as narrow as ~200px** (docked at a side) and as wide as the screen (floating/torn off). The layout must flex: use flex/grid + `min-width: 0`, and cut long text with `overflow: hidden; text-overflow: ellipsis`.
- Use a **container query** if the layout has to change with the panel's width (not a media query on the window):

  ```css
  .myplug-root { container: myplug / inline-size; }
  @container myplug (max-width: 320px) { .myplug-row { flex-direction: column; } }
  ```
- The panel body scrolls by itself when it is too long — do not nest a second scroll bar.
- **The empty state** must say what to do next: short text + a button ("No data yet — press to scan"), not a blank surface.
- The panel header (name · collapse/float/close buttons) belongs to the app — do not build a second header in the body.
- `render` is called repeatedly: keep state in your plugin's variables and redraw the whole thing with `host.replaceChildren(...)`.
- Work that waits on I/O: draw the frame first, then fill in the data when it arrives. Do not clear the panel and leave it blank while waiting.

## 5.5 Keyboard and accessibility

- Use the right element: `<button>` for buttons · `<input>`/`<select>` for fields — **not `<div onclick>`** (it cannot be pressed from the keyboard, and a screen reader does not know it is a button).
- An icon-only button needs a `title` (tooltip) and an `aria-label`.
- A field with no label beside it needs a `placeholder` or an `aria-label`.
- A visible focus ring (`:focus-visible`) · `Tab` order follows visual order.
- Detect keys with **`e.code`** (`'KeyW'` · `'BracketRight'`), not `e.key` — on a Thai (or any non-Latin) layout `e.key` is a letter of that script. (Keys that do not depend on the layout, such as `Enter` `Escape` `ArrowUp` `Delete`, can use `e.key`.)
- **`Esc` must cancel** — a dialog · a menu · a drag in progress.
- Decoration drawn over the screen: `aria-hidden="true"` + `pointer-events: none`.
- Respect `prefers-reduced-motion`: animation is an extra and must be possible to turn off.

  ```css
  @media (prefers-reduced-motion: reduce) { .myplug-anim { animation: none; transition: none; } }
  ```
- Anything drawn over the screen must be hidden when printing: `@media print { .myplug-overlay { display: none; } }`
- Contrast between text and background ≥ 4.5:1 — you get it for free when you pair the theme variables correctly.

## 5.6 Multiple languages

The app has 7 languages, but `k2` **has no helper yet for translating a plugin's text**. Build your own table:

```js
// the interface language = <html lang="…"> (set by the app once the language has loaded)
const LANG = (document.documentElement.lang || 'en').slice(0, 2);
const STR = {
  en: { count: 'Count words in this scene', words: (n) => n + (n === 1 ? ' word' : ' words'), empty: 'No data yet' },
  th: { count: 'นับคำฉากนี้', words: (n) => n + ' คำ', empty: 'ยังไม่มีข้อมูล' },
};
const T = STR[LANG] || STR.en;                 // a language you do not have → English

k2.registerCommand(T.count, () => k2.setStatus(T.words(count())));
```

- When the user changes language, the app restarts — reading the language once when your plugin runs is enough.
- Dates/numbers: `new Intl.DateTimeFormat(document.documentElement.lang)` · `Number#toLocaleString(lang)`
- Sorting names people read: `new Intl.Collator(lang).compare`
- Segmenting words in languages without spaces (Thai, Japanese, Chinese): `new Intl.Segmenter(undefined, { granularity: 'word' })` — do not count words with `split(' ')`.
- **Data written to files must not be translated.** Store a code (`'done'`) and translate it when showing it; do not store "Done"/"เสร็จ".
- **Never compare against the app's on-screen text** (`textContent === 'Save'`). It breaks silently when the language changes.

## 5.7 A plugin's CSS

```js
const style = document.createElement('style');
style.dataset.plugin = k2.pluginName;
style.textContent = `
  .wcs-card { … }
`;
document.head.append(style);
k2.onUnload(() => style.remove());             // a style you inject, you remove
```

| Do | Do not |
|---|---|
| Give class names your plugin's prefix (`.wcs-…`) | Bare classes (`.card` `.row` `.btn`) — they collide with the app/other plugins |
| Write rules only for your own elements | Rules that match the app's elements (`button { … }` · `.k-panel { … }` · `body { … }`) |
| Use inline styles for one-off things | `!important` |
| | Rely on the app's internal classes (`.k-…`) for your look — they can change with any release |
| | `transform` in `:hover` (cards that lift/grow on hover) |
| | `scroll-behavior: smooth` |
| | Load fonts/CSS/images from the internet — the app works offline |

One of the app's classes is meant for outside use: **`k-selectable`**. Put it on read-only content the user should be able to select/copy (results · reports · logs), because UI text is not selectable by default.

## 5.8 Icons

- `registerPanel({ icon })` takes **the name of one of the app's icons** (the `icons/glyphs.csv` registry — the Material Design set from Nerd Fonts), e.g. `chart` `note` `timer` `book` `book-open` `image` `chat` `map` `user` `group` `tag` `search` `cog` `bug` `export` `refresh` `plus` `extension`. A name that does not exist = no icon.
- Inside the panel body: use your own inline SVG (`fill="currentColor"` so it follows the text colour), or text.
- **Do not use emoji as UI icons** — they render differently on each system and do not follow the theme.
- Do not copy the app's icon characters and use them directly. They are characters of an internal font; when the icon set changes they turn into boxes.

## 5.9 Messages to the user

| Channel | Use it when |
|---|---|
| `k2.setStatus(text)` | The result of what the user just asked for — one line, fades by itself |
| Inside your plugin's panel | Information that should stay · results · errors from work in that panel |
| `k2.confirmBox` | Before doing something that cannot be undone, or that overwrites |
| `k2.ask` | You need one piece of text from the user |
| `k2.log` | Detail for tracking down problems — ordinary users do not see it unless they open the Log panel |

- Write for people: "Could not build the report — open a project first", not "Error: root is null".
- Report both success and failure. Never stay silent.
- Work that takes longer than ~1 second: say that it is running and, if possible, let it be cancelled.
- Do not put one of the app's shortcuts into text as a fixed string (users can rebind them, and macOS uses `⌘`).

## 5.10 Look-and-feel checklist

- [ ] Dark theme (K2) · light theme (K2 Light) · High Contrast — readable in all of them
- [ ] UI size 75% and 200% — nothing overflows, nothing is cut off
- [ ] The panel at ~220px wide and floating wide — usable both ways
- [ ] Usable with the keyboard alone · the focus ring is visible
- [ ] Nothing appears by itself on load or while typing
- [ ] No plugin element/class/style inside `.ProseMirror`
- [ ] No fixed colours · no `font-family` · no `!important`
- [ ] Every piece of user text uses `textContent` / `text:` (for `menuPopup`)
- [ ] After disabling the plugin, no style/element is left in the page

---

Next: [6. Working with project files and data →](06-data-and-files.md)
