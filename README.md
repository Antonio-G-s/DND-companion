# D&D Companion

A lightweight, modular Dungeons & Dragons companion app built with **Tauri v2**, **Svelte**, **TypeScript**, and **Rust**.

> **Windows installer** → [`releases/DnD-Companion-0.3.0-setup.exe`](releases/DnD-Companion-0.3.0-setup.exe) (2 MB, requires WebView2 — installed automatically on Windows 10/11)

See [CHANGELOG.md](CHANGELOG.md) for what's new.

---

## Architecture

The app is a black workspace where **sub apps** open as draggable internal windows. Sub apps communicate through a **JSON event bus**.

```
┌─────────────────────────────────────────┐
│  Toolbar  [Dice Roller] [Spell List]    │
├─────────────────────────────────────────┤
│                                         │
│   ┌─ Dice Roller ──┐  ┌─ Spell List ─┐ │
│   │                 │  │              │ │
│   │   [D20] → 17   │  │  Fire Bolt   │ │
│   │                 │  │  🎲 1D10 ──────── eventBus ──→ Dice Roller
│   │   History...    │  │              │ │
│   └─────────────────┘  └──────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Event Bus

Sub apps send JSON messages to each other:

```json
{ "target": "diceRoller", "source": "spellList", "action": "roll", "dice": "1D10" }
```

Response:

```json
{ "target": "spellList", "source": "diceRoller", "action": "rollResult", "dice": "1D10", "result": 7 }
```

### Adding a New Sub App

1. Create `src/apps/yourApp/YourApp.svelte`
2. Add entry to `configs/registry.json`
3. Subscribe to the event bus in `onMount`
4. Add the component route in `App.svelte`

## Documentation

- [JSON Reference & AI Prompts](docs/JSON_REFERENCE.md) — full schema for every sub app, worked examples, and copy-paste AI prompts to generate character data
- [Character Import Guide](docs/CHARACTER_IMPORT_GUIDE.md) — per-app JSON formats and the full-character export schema
- [Changelog](CHANGELOG.md) — version history and release notes

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [Rust](https://rustup.rs/) (latest stable)
- Tauri v2 prerequisites: https://v2.tauri.app/start/prerequisites/

### Install & Run

```bash
# Install JS dependencies
npm install

# Run in development mode (opens desktop window)
npm run tauri dev

# Build for production
npm run tauri build
```

### Development (frontend only, no Tauri)

```bash
npm run dev
# Open http://localhost:1420
```

## Folder Structure

```
src/
  main.ts                        # Entry point
  App.svelte                     # Workspace manager
  lib/
    types.ts                     # Shared TypeScript types
    eventBus.ts                  # JSON message bus
    appRegistry.ts               # Sub app registry
    dice.ts                      # Dice parsing & rolling engine
  apps/
    diceRoller/
      DiceRoller.svelte          # Dice Roller UI
    spellList/
      SpellList.svelte           # Spell List UI
    spellSlots/
      SpellSlots.svelte          # Spell Slot tracker
    spellcasting/
      Spellcasting.svelte        # Spellcasting stats
    magicItems/
      MagicItems.svelte          # Magic item inventory
    goldPurse/
      GoldPurse.svelte           # Currency tracker
    inventory/
      Inventory.svelte           # Equipment & items
    weaponsCantrips/
      WeaponsCantrips.svelte     # Weapons & cantrips
    hpTracker/
      HpTracker.svelte           # Hit point tracker
    skills/
      Skills.svelte              # Skill proficiencies
    traits/
      Traits.svelte              # Character traits
    proficiencies/
      Proficiencies.svelte       # Proficiency list
    notes/
      Notes.svelte               # Session notes
    characterProfile/
      CharacterProfile.svelte    # Character overview
  components/
    WindowFrame.svelte           # Draggable window wrapper
    Toolbar.svelte               # Top toolbar
    MobileNav.svelte             # Mobile navigation
    SettingsPanel.svelte         # App settings
src-tauri/
  src/
    lib.rs                       # Rust commands (dice, config I/O)
    main.rs                      # Desktop entry point
  tauri.conf.json                # Tauri config
configs/
  registry.json                  # Sub app registry
  diceRoller.json                # Dice Roller saved state
  spellList.json                 # Spell data
```

## Sub Apps

### Dice Roller
- Quick-pick: D2, D3, D4, D6, D8, D10, D12, D20, D100
- Custom input: `2D8+3`, `1D20-1`
- Roll history
- Listens on the bus for roll requests

### Spell List *(legacy)*
- Spell cards with school-colored accents
- Add / edit / delete spells; import / export JSON
- Shows **Cantrip** / **Level X** and **Conc** badge per spell
- Clickable damage dice → sends roll request to Dice Roller

### Spellcasting *(recommended)*
- Full spellcasting manager: spell list + slot pools + caster config
- Prepared / always-prepared / readied spell tracking with limit
- Spell attack bonus and save DC per caster class
- Upcasting with per-level effect text
- Short rest (Pact Magic) and long rest slot recovery
- Concentration and ritual tags; free-use tracking
- Migrates data from legacy Spell List and Spell Slots on first open

### Character Profile
- Multi-character switcher — each character stores all sub-app data separately
- Selective export: choose which sections to include in the JSON
- Full import with drag-and-drop, file picker, path input, and paste-JSON — works on both desktop and mobile

### Other Sub Apps
- **HP Tracker** — current / max / temp HP, AC component list
- **Spell Slots** *(legacy)* — standalone slot tracker; migrates into Spellcasting
- **Skills** — six ability scores, skill proficiencies, saving throws
- **Weapons & Cantrips** — attack actions with roll integration
- **Inventory** — equipment, items, and crafting materials with weapon stats
- **Magic Items** — attunement-aware tracker with charges and linked spells
- **Gold Purse** — PP / GP / EP / SP / CP with transaction log
- **Traits & Feats** — class features, species traits, feats with use tracking
- **Proficiencies** — armor, weapon, tool, and language lists
- **Notes** — per-session freeform notes with image attachments
