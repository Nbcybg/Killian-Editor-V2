# Killian 2 Roadmap

*Oct 2026 – Jan 2028 · [ภาษาไทย](ROADMAP.th.md)*

Killian 2 is in **public test**. It is already usable day to day, and your files are plain Markdown + JSON you can always open without the app.
Everything below is **planned, not built yet**. It is listed in priority order, at most two things run at once, and dates can move. Tell us what matters to you through **Help → Report a bug / Request a feature** inside the app.

```mermaid
gantt
    title Killian 2 — Oct 2026 to Jan 2028
    dateFormat YYYY-MM-DD
    axisFormat %b %y
    todayMarker off

    section 1 Trust
    Safety of your work made visible    :tr1, 2026-10-26, 2026-11-15

    section 2 Drag and drop
    Drop from desktop and other apps    :dd1, 2026-11-16, 2026-12-31

    section 3 Modern UI
    New look, panel by panel            :ui1, 2026-11-01, 2027-03-31

    section 4 Passion system
    Goals and a reason to come back     :ps1, 2027-01-01, 2027-02-28

    section 5 Planner v2
    Story-flow planner                  :pl1, 2027-03-01, 2027-05-31

    section 6 Mobile app
    Companion app                       :mb1, 2027-04-01, 2027-07-31

    section 7 Ren'Py
    Screenplay to Ren'Py, live link     :rp1, 2027-08-01, 2027-10-31

    section 8 Call sheet
    Call sheet editor                   :cs1, 2027-08-01, 2027-09-30

    section 9 Image editor
    Node-based image editor             :im1, 2027-11-01, 2028-01-31
```

## Where we are

**Public test → Beta → Stable.** We are in public test now. We will call it Beta when the basics feel dependable for everyone (for example: installers that do not trigger warnings, and no known bugs that lose work). There is no date for that yet.

## The plan, in priority order

1. **Trust** — Oct → mid Nov 2026. Make it obvious that your work is safe: automatic backups, version history and the recycle bin up front, a plain "your files stay Markdown" message, and a clear explanation of the installer warning.
2. **Drag and drop from outside the app** — mid Nov → Dec 2026. Drag files straight into Killian from the desktop, a file manager or another program. Folders, images and chapter files already work; we will extend this to more file types and every place that can sensibly accept a drop.
3. **A more modern UI** — Nov 2026 → Mar 2027. Refreshed layout, spacing, icons and themes, rolled out panel by panel so your layout and habits keep working.
4. **Passion system** — Jan → Feb 2027. Help you keep writing. Ten minutes a day, kept up, beats an occasional ten-hour marathon, so Killian will help you build the habit: set a goal and what it is for, see your progress, and get a gentle reason to come back tomorrow.
5. **Planner v2** — Mar → May 2027. A planner built around **story flow** rather than a free-form whiteboard: see how scenes and plot threads lead into each other.
6. **Mobile app** — Apr → Jul 2027. A companion app for reading, quick edits and notes on the go, using the same project files (works with Drive, iCloud, Dropbox or OneDrive folders — see the manual's *Using several computers* chapter). Until then you can already edit the same folder with any Markdown app on your phone.
7. **Ren'Py integration** — Aug → Oct 2027. Convert your screenplay into a **Ren'Py script**, then connect to Ren'Py and play it, with changes made in Killian showing up **live** in the running game.
8. **Call sheet editor** — Aug → Sep 2027. A call sheet that lists **who is needed in each scene**, built from your script so the cast list stays in step with the writing.
9. **Node-based image editor** — Nov 2027 → Jan 2028. Edit images with a node graph inside the app. The graph is saved as an **XML** file, so your original image is never touched, and you can export a new image whenever you like.

## Later (no date yet)

- **Signed installers** for Windows and macOS.
- **Beta**, once the basics above are dependable.

---
*Last updated: 2026-10-25. Shipped changes are listed in [CHANGELOG.md](CHANGELOG.md).*
