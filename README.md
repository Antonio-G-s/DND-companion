# D&D Companion

A lightweight, modular Dungeons & Dragons companion app built with **Tauri v2**, **Svelte**, **TypeScript**, and **Rust**.

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

### Spell List
- Spell cards loaded from JSON
- Add / edit / delete spells
- Import / export spell JSON files
- Clickable damage dice → sends roll request to Dice Roller
- School-colored card accents
- Cantrip upgrade display for level 0 spells

### Other Sub Apps
- **HP Tracker** — current / max HP with temp HP and death saves
- **Spell Slots** — track spell slot usage per level
- **Spellcasting** — spellcasting ability, save DC, and attack bonus
- **Skills** — skill list with proficiency toggles
- **Weapons & Cantrips** — attack actions with roll integration
- **Inventory** — general equipment list
- **Magic Items** — attunement-aware magic item tracker
- **Gold Purse** — multi-denomination currency tracker (GP/SP/CP)
- **Traits** — personality traits, ideals, bonds, flaws
- **Proficiencies** — armor, weapon, tool, and language proficiencies
- **Notes** — freeform session notes
- **Character Profile** — name, race, class, background, and stats
