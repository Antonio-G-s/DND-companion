# Changelog

All notable changes are listed here. Installers are in the [`releases/`](releases/) folder.

---

## [0.3.0] — 2026-05-19

### Added

- **Spells — Level & Concentration**: Both Spell List and Spellcasting now store `level` (0–9) and `concentration` (boolean) on every spell.
  - Spell cards display **Cantrip** / **Level X** and a **Conc** badge when applicable.
  - The spell form has a Concentration checkbox and the level field is capped to 0–9.
  - Old saved spells without these fields default to level 0 / concentration false on load.

- **Character Profile — Selective Export**: Clicking *Export Character* now opens a checklist dialog instead of immediately downloading. Every data section is checked by default; uncheck any section to exclude it from the JSON. Character Profile is always included. **All** and **None** quick-select links are provided.

- **Character Profile — Desktop Import dialog**: The import dialog (drag-and-drop zone, Choose File button, file path input, paste-JSON textarea) now opens correctly in the desktop canvas mode. The dialog was previously rendered off-screen due to `position: fixed` being relative to the CSS-transformed canvas ancestor — fixed by portalling the overlay to `document.body`.

- **Import / Export reliability (all apps)**: File open/save dialogs in SpellList, Spellcasting, and Character Profile now attach the `<input type="file">` / `<a>` element to `document.body` before triggering the click. This prevents freezes in Tauri's WebView2 on Windows when DOM elements are not attached.

### Fixed

- `importSpells` (SpellList) and `importData` (Spellcasting) froze on desktop because the dynamically created file input was never added to the DOM.
- Export anchors in SpellList and Spellcasting silently failed on desktop for the same reason.
- Character Profile import overlay was invisible on desktop (canvas `transform` breaks `position: fixed`).
- Spells loaded from localStorage or imported from a file without `concentration` no longer cause undefined-checkbox bugs in the form.

---

## [0.2.0] — initial public build

- Multi-character switcher with per-character localStorage blobs; character switching reloads all sub-apps automatically.
- Unified **Spellcasting** manager: spell list + slot pools + caster config + upcasting + prepared tracking.
- **Character Profile** with full single-file export/import (all sub-apps at once), drag-and-drop, paste-JSON, and file-path input for Tauri desktop.
- Responsive layout: desktop canvas (pannable/zoomable floating windows) and mobile single-app mode with bottom nav.
- Sub-apps: Dice Roller, HP Tracker, Spell List (legacy), Spell Slots (legacy), Spellcasting, Skills, Inventory, Magic Items, Gold Purse, Traits & Feats, Proficiencies, Notes, Weapons & Cantrips, Character Profile.
