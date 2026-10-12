/**
 * Killian 2 — type definitions for the plugin API (`k2`)
 *
 * Matches `pluginApi()` in src/app.js as of version 2.0.0-alpha.169.
 * Full descriptions: docs/extension/en/03-sdk-reference.md (English) · docs/extension/th/03-sdk-reference.md (ไทย)
 *
 * How to use it (there is no package to install):
 *   1. Copy this file into your plugin's repository, e.g. `types/k2.d.ts`
 *   2. Plain JavaScript — put this on the first line of your plugin file:
 *        /// <reference path="./types/k2.d.ts" />
 *      and your editor will autocomplete and type-check `k2` (turn checking on with `// @ts-check`)
 *   3. TypeScript — add this file to "include" in tsconfig.json
 *
 * This file declares `k2` as a global variable for the type checker only.
 * At run time `k2` is a parameter of the function the app wraps your plugin's code in (one object per plugin);
 * it is not on `window`.
 *
 * Killian 2 maintainers: whenever `pluginApi()` changes, update this file together with 03-sdk-reference.md
 * (both languages).
 */

declare namespace K2 {
  // ───────────────────────────── Events ─────────────────────────────

  /** A project has opened, and that project's plugins have finished loading. */
  interface ProjectOpenEvent {
    /** The full path of the project folder (this machine's — never write it into a project file). */
    root: string;
    /** The project title. */
    title: string;
  }

  /** A project is about to close (files can still be read, but the app does not wait for Promises). */
  interface ProjectCloseEvent {
    root: string;
  }

  /** The kind of tab — `'wiki'` and `'other'` have no editor (`getMarkdown()` = `''` · `getEditorView()` = `null`). */
  type TabKind = 'prose' | 'screenplay' | 'wiki' | 'other';

  /** The selected tab changed to another tab (including the first tab opening · clicking the same tab again sends nothing). */
  interface TabActivateEvent {
    /** The full path of the file in the tab. */
    file: string;
    /** The title on the tab. */
    title: string;
    kind: TabKind;
  }

  /** A document (.md) was saved to disk successfully — including Save all and autosave. */
  interface TabSaveEvent {
    /** The full path of the file that was saved. */
    file: string;
    title: string;
    /** The number of characters of body text saved. */
    chars: number;
  }

  /** The plugin loader finished a pass. */
  interface PluginsLoadedEvent {
    /** Folder names of the plugins that are running. */
    loaded: string[];
  }

  /** The events the app sends. */
  interface AppEvents {
    'project:open': ProjectOpenEvent;
    'project:close': ProjectCloseEvent;
    'tab:activate': TabActivateEvent;
    'tab:save': TabSaveEvent;
    'plugins:loaded': PluginsLoadedEvent;
  }

  /** Why a plugin is being unloaded. */
  type UnloadReason =
    /** Disabled · uninstalled · its folder is gone · the project that carried it is closing. */
    | 'remove'
    /** Its file changed — the new copy runs immediately afterwards. */
    | 'reload'
    /** The code threw during its first run. */
    | 'error';

  // ───────────────────────────── Panels ─────────────────────────────

  interface PanelOptions {
    /** The name on the panel header (default = the id). */
    title?: string;
    /** The name of an icon from the app's registry, e.g. 'chart' 'note' 'timer' (default 'extension'). */
    icon?: string;
    /** The side it docks to the first time (default 'right'). */
    defaultSide?: 'left' | 'right' | 'bottom';
    /** The user can close the panel (default true). */
    closable?: boolean;
    /** The user can float the panel (default true). */
    floatable?: boolean;
    /**
     * Draws the panel's content into `host`. It can be called many times, and `host` may be a new element each time
     * (write it so that calling it again gives the same result · keep state in variables, not in the DOM).
     */
    render: (host: HTMLElement) => void;
  }

  // ───────────────────────────── Dialogs / menus ─────────────────────────────

  interface AskOptions {
    /** The starting value in the box. */
    value?: string;
    placeholder?: string;
    /** The label of the primary button. */
    okLabel?: string;
    /** true = OK may be pressed while the box is empty (returns ''). */
    allowEmpty?: boolean;
    /** A multi-line box — Enter starts a new line · Ctrl+Enter = OK. */
    multiline?: boolean;
  }

  interface MenuItem {
    /** The label as plain text — always use this when the text comes from the user/a file/the network. */
    text?: string;
    /** The label as **HTML** — only for strings the plugin author wrote entirely (outside text = an XSS hole). */
    label?: string;
    click?: () => void;
    disabled?: boolean;
    /** Giving it a value makes the item a tick item. */
    checked?: boolean;
    /** The danger colour. */
    danger?: boolean;
    /** A colour swatch at the end of the row (a colour code · '' = no colour). */
    swatch?: string;
    /** A submenu — it must be a function that returns the items (not an array). */
    sub?: () => MenuEntry[];
    /** A tooltip. */
    title?: string;
  }

  /** `'-'` = a divider. */
  type MenuEntry = MenuItem | '-';

  // ───────────────────────────── Network ─────────────────────────────

  interface FetchOptions {
    /** Default 'GET'. */
    method?: string;
    headers?: Record<string, string>;
    /** The request body as a string, e.g. JSON.stringify(...). */
    body?: string;
  }

  /** The result of `k2.fetch` — it never throws; look at `ok`. */
  interface FetchResult {
    /** true when the status is 2xx. */
    ok: boolean;
    /** The HTTP status code · 0 = the server was never reached. */
    status: number;
    /** The response body, always as text (convert it yourself: JSON.parse) · on a network failure = the error detail. */
    body: string;
    /** A short cause on failure, e.g. 'fetch failed'. */
    error?: string;
    /** It failed at the network level (no internet · host not found · bad certificate). */
    netError?: boolean;
    /** It timed out (the default is 3 minutes). */
    timedOut?: boolean;
    aborted?: boolean;
  }

  // ───────────────────────────── The editor (ProseMirror) ─────────────────────────────
  //
  // Abbreviated types for the parts plugins use most — incomplete, and not a contract.
  // For the full types: `npm i -D prosemirror-view prosemirror-state prosemirror-model`
  // and replace with  type EditorView = import('prosemirror-view').EditorView;
  //
  // The schemas in alpha.169 (internal names that can change with any release — always test for existence first):
  //   novel        nodes: doc paragraph heading blockquote bullet_list ordered_list list_item
  //                       figure horizontal_rule hard_break image page_break code_block text
  //   screenplay   nodes: doc sp(attrs.el = the element) spimage text
  //   both         marks: strong em underline strike sup sub color highlight

  interface PMNode {
    readonly type: { readonly name: string };
    readonly attrs: Record<string, any>;
    readonly text?: string;
    readonly isText: boolean;
    readonly isBlock: boolean;
    readonly textContent: string;
    readonly nodeSize: number;
    readonly childCount: number;
    readonly content: { readonly size: number };
    readonly firstChild: PMNode | null;
    forEach(fn: (node: PMNode, offset: number, index: number) => void): void;
    /** Returning false from the callback = do not descend into that node. */
    descendants(fn: (node: PMNode, pos: number, parent: PMNode | null, index: number) => boolean | void): void;
    nodesBetween(from: number, to: number, fn: (node: PMNode, pos: number) => boolean | void): void;
    textBetween(from: number, to: number, blockSeparator?: string, leafText?: string): string;
    resolve(pos: number): PMResolvedPos;
  }

  interface PMResolvedPos {
    readonly pos: number;
    readonly depth: number;
    readonly parent: PMNode;
    before(depth?: number): number;
    after(depth?: number): number;
    start(depth?: number): number;
    end(depth?: number): number;
  }

  interface PMSelection {
    readonly from: number;
    readonly to: number;
    readonly anchor: number;
    readonly head: number;
    readonly empty: boolean;
    readonly $from: PMResolvedPos;
    readonly $to: PMResolvedPos;
  }

  interface PMNodeType {
    readonly name: string;
    create(attrs?: Record<string, any> | null, content?: PMNode | PMNode[] | null, marks?: any[]): PMNode;
  }

  interface PMSchema {
    readonly nodes: Record<string, PMNodeType | undefined>;
    readonly marks: Record<string, any>;
    /** Throws when text is an empty string. */
    text(text: string, marks?: any[]): PMNode;
  }

  interface PMTransaction {
    readonly doc: PMNode;
    readonly docChanged: boolean;
    /** Replaces the range from..to with text (no from/to = the selection) · empty text = delete the range. */
    insertText(text: string, from?: number, to?: number): this;
    insert(pos: number, content: PMNode | PMNode[]): this;
    delete(from: number, to: number): this;
    replaceWith(from: number, to: number, content: PMNode | PMNode[]): this;
    setSelection(selection: PMSelection): this;
    scrollIntoView(): this;
  }

  interface PMEditorState {
    readonly doc: PMNode;
    readonly selection: PMSelection;
    readonly schema: PMSchema;
    /** A new transaction every time it is read. */
    readonly tr: PMTransaction;
  }

  /** ProseMirror's `EditorView` — change content only through `dispatch(tr)`; never touch the editor's DOM. */
  interface EditorView {
    readonly state: PMEditorState;
    /** The editor's element — you may read it (getComputedStyle, say) but never modify it. */
    readonly dom: HTMLElement;
    readonly editable: boolean;
    /** Applies a transaction: a content change marks the tab unsaved and is one undo step. */
    dispatch(tr: PMTransaction): void;
    focus(): void;
    hasFocus(): boolean;
    /** Screen coordinates of a document position. */
    coordsAtPos(pos: number): { left: number; right: number; top: number; bottom: number };
  }

  // ───────────────────────────── The API ─────────────────────────────

  interface Api {
    // ── Information ──

    /** This plugin's folder name. */
    readonly pluginName: string;
    /** The app's version, e.g. "2.0.0-alpha.169". */
    readonly appVersion: string;
    /** The full path of the open project's folder · null = no project is open (call it every time; do not keep the value). */
    projectRoot(): string | null;

    // ── Commands and shortcuts (the app removes them when the plugin is unloaded) ──

    /** Adds a command — it appears on the plugin's card and under the "Plugin Commands" toolbar button. */
    registerCommand(label: string, fn: () => void | Promise<void>): true;
    /** @deprecated The old name of registerCommand. */
    addMenuItem(label: string, fn: () => void | Promise<void>): true;
    /**
     * Reserves a shortcut. Returns the channel name `plugin:<plugin name>:<id>`.
     * @param id    The shortcut's name within this plugin (registering it again replaces the old one)
     * @param code  KeyboardEvent.code, e.g. 'KeyK' 'F8' 'Digit1'
     * @param ctrl  Must be true — a shortcut without Ctrl/⌘ never fires in this version (default true)
     * @param shift Shift must be held as well (default false)
     * A clash with one of the app's shortcuts = the app wins · Alt cannot be part of it.
     */
    registerShortcut(id: string, code: string, ctrl: boolean, shift: boolean, fn: () => void | Promise<void>): string;

    // ── The editor ──

    /** The Markdown of the document in the open tab (unsaved edits included) · no editor = ''. */
    getMarkdown(): string;
    /** Inserts plain text at the cursor (replacing the selection) · false = no editor · '\n' does not start a new paragraph. */
    insertText(text: string): boolean;
    /** The EditorView of the open tab · null = none (do not keep it over time — it changes when the tab is switched). */
    getEditorView(): EditorView | null;

    // ── Panels ──

    /** Registers a panel. Returns the real id `plugin-<plugin name>-<id>`, or null on failure. */
    registerPanel(id: string, opts: PanelOptions): string | null;
    /** Opens one of your own plugin's panels (pass the same id you gave registerPanel). */
    showPanel(id: string): void;
    hidePanel(id: string): void;

    // ── Events ──

    /** Listens for one of the app's events · returns a function that stops listening · handlers are called synchronously, and the app does not wait for Promises. */
    on<E extends keyof AppEvents>(event: E, handler: (payload: AppEvents[E], eventName: E) => void): () => void;
    /** Listens for every event (for debugging). */
    on(event: '*', handler: (payload: unknown, eventName: string) => void): () => void;
    /** Listens for a plugin's event (`<plugin name>:<topic>`) — the payload comes from another plugin; check its shape before using it. */
    on(event: string, handler: (payload: any, eventName: string) => void): () => void;
    off(event: string, handler: (...args: any[]) => void): void;
    /** Sends an event to every plugin. Returns the number of listeners called successfully — never use one of the app's event names. */
    emit(event: string, data?: unknown): number;
    /**
     * Registers a cleanup function — called in reverse order of registration · runs synchronously and does not wait for Promises.
     * Throwing = the app assumes the cleanup was incomplete and tells the user to restart the app.
     */
    onUnload(fn: (why: UnloadReason) => void): boolean;

    // ── Project files (paths relative to the project root, '/' separators · '..' is refused) ──

    /**
     * Reads a file as UTF-8 text · null = the path was refused / no project is open.
     * ⚠ A missing file = the Promise rejects — ask with listFiles first, or wrap in try/catch.
     */
    readFile(rel: string): Promise<string | null>;
    /** Overwrites the whole file (atomic · creates folders · recorded in the activity history) · false = the path was refused. */
    writeFile(rel: string, text: string): Promise<boolean>;
    /** Names of the sub-folders one level down · a folder that does not exist = []. */
    listDirs(rel: string): Promise<string[]>;
    /** Names of the files one level down · ext = filter by the end of the name, e.g. '.md' · a folder that does not exist = []. */
    listFiles(rel: string, ext?: string): Promise<string[]>;

    // ── Plugin settings (stored in the project file — never store secrets or full machine paths) ──

    /** A copy of the whole settings object. */
    getSettings(): Record<string, any>;
    /** The value of key · absent = def. */
    getSettings<T = any>(key: string, def?: T): T;
    setSettings(key: string, value: unknown): true;
    /** Several values at once (merged with what is there). */
    setSettings(values: Record<string, unknown>): true;

    // ── The screen ──

    /** A message on the status bar (it fades by itself). */
    setStatus(text: string): void;
    /** A text-prompt dialog · null = cancelled, or OK pressed on an empty box (when allowEmpty is not on). */
    ask(title: string, options?: AskOptions): Promise<string | null>;
    /** A confirmation dialog — always pass okLabel (the default is "Delete", styled as dangerous). */
    confirmBox(title: string, okLabel?: string): Promise<boolean>;
    /** A message dialog (alpha.169: it is a confirmation dialog whose primary button reads "Plugins"). */
    alertBox(text: string): Promise<boolean>;
    /** A pop-up menu at window coordinates (default 80, 80). */
    menuPopup(items: MenuEntry[], x?: number, y?: number): void;
    /** Writes a line to the app's Log, prefixed with `[plugin <name>]` (stringify objects yourself). */
    log(...args: unknown[]): void;

    // ── Network ──

    /** An HTTP request through the app (not subject to CORS) — text only, no streaming, never throws. */
    fetch(url: string, options?: FetchOptions): Promise<FetchResult>;
  }

  // ───────────────────────────── plugin.json ─────────────────────────────

  /** The shape of plugin.json (every field is optional) — details: 02-anatomy.md */
  interface Manifest {
    /** The plugin's name (alpha.169 shows the folder name on the card, not this value). */
    name?: string;
    /** The file to run — inside the plugin folder (default "main.js"). */
    entry?: string;
    version?: string;
    author?: string;
    description?: string;
    /** The minimum app version — only the numeric part is compared (alpha.N is not). */
    minAppVersion?: string;
    homepage?: string;
    /** A promise that onUnload cleans up completely → the plugin can be disabled/reloaded without restarting the app. */
    hotReload?: boolean;
  }
}

/** The plugin API — handed to your code by the app at run time (one object per plugin). */
declare const k2: K2.Api;
