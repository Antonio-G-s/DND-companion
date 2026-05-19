# D&D Companion — Character Import / Export Guide

The **Character Profile** app can export and import the entire character state — every sub-app — as a single JSON file.

---

## How to Export

1. Open **Character Profile**.
2. Click **↓ Export Character**.
3. A checklist dialog appears with every data section checked. Uncheck any section you want to exclude. **Character Profile** (name, class, species, etc.) is always included.
4. Click **↓ Export** — a `<charactername>_character.json` file is downloaded.

Use **All** / **None** quick-links to check or clear all sections at once.

---

## How to Import

1. Open **Character Profile**.
2. Click **↑ Import Character**.
3. The import dialog offers four ways to load a file:
   - **Drag and drop** a `.json` file onto the drop zone.
   - **Choose File** — opens a native file picker.
   - **Read Path** — enter a full file path (desktop only, uses Tauri filesystem API).
   - **Paste JSON** — paste the exported JSON directly into the text area and click **Analyze Text**.
4. A preview shows which sections were found and which are missing.
5. Choose **New character slot** (keeps your current character) or **Replace current character**.
6. Click **Confirm Import**.

Missing sections in the imported file are simply skipped — existing sub-app data for those sections is cleared to avoid stale data.

---

## Full Export Format

```json
{
  "_meta": {
    "version": "1.0.0",
    "exportDate": "2026-05-19T12:00:00.000Z",
    "appName": "D&D Companion",
    "characterName": "Lyra Ashveil"
  },
  "profile":       { ... },
  "skills":        { ... },
  "hpTracker":     { ... },
  "inventory":     { ... },
  "goldPurse":     { ... },
  "spellcasting":  { ... },
  "magicItems":    [ ... ],
  "traits":        [ ... ],
  "proficiencies": { ... },
  "notes":         [ ... ],
  "spellList":     [ ... ],
  "spellSlots":    { ... },
  "weaponsCantripsPref": { ... }
}
```

`spellList` and `spellSlots` are the legacy apps — they are migrated automatically into `spellcasting` on first load of the Spellcasting app.

See [JSON_REFERENCE.md](JSON_REFERENCE.md) for the full schema of each section.

---

## Per-App JSON Formats

### Profile (`dnd-profile`)

```json
{
  "name": "Lyra Ashveil",
  "subtitle": "The Shadow Step",
  "alignment": "Chaotic Good",
  "species": "Wood Elf",
  "classes": "Rogue 7",
  "level": 7,
  "description": "...",
  "backstory": "...",
  "profileImage": "",
  "partyLogo": "",
  "partyName": "The Dusk Wardens",
  "tags": [],
  "version": "1.0.0",
  "lastSaved": 1716120000000
}
```

### Skills (`dnd-skills`)

```json
{
  "level": 7,
  "abilities": [
    {
      "key": "dex", "label": "DEX", "fullName": "Dexterity",
      "value": 20, "saveProficiency": true,
      "skills": [
        { "name": "Acrobatics",     "proficiency": "expertise" },
        { "name": "Sleight of Hand","proficiency": "proficient" },
        { "name": "Stealth",        "proficiency": "expertise" }
      ]
    }
  ]
}
```

**Proficiency values:** `"none"` | `"proficient"` | `"expertise"`

### HP Tracker (`dnd-hptracker`)

```json
{
  "maxHp": 52,
  "currentHp": 52,
  "tempHp": 0,
  "acEffects": [
    { "name": "Base",            "value": 10 },
    { "name": "DEX mod",         "value": 5 },
    { "name": "Studded Leather", "value": 1 }
  ]
}
```

`totalAC` is the sum of all `acEffects[].value`.

### Inventory (`dnd-inventory`)

```json
{
  "maxAttunement": 3,
  "items": [
    {
      "name": "Rapier",
      "category": "equipment",
      "equipmentType": "weapon",
      "description": "Finesse weapon.",
      "weight": 2, "valueGP": 25, "quantity": 1,
      "attuned": false, "linkedMagicItem": "",
      "weapon": {
        "attackAbility": "finesse",
        "damageDice": "1D8", "damageType": "Piercing",
        "properties": "Finesse", "magicBonus": 0, "range": "5 ft"
      }
    }
  ]
}
```

**`weapon` is `null` for non-weapon items.**

### Gold Purse (`dnd-goldpurse`)

```json
{
  "purse": { "pp": 0, "gp": 154, "ep": 0, "sp": 37, "cp": 12 },
  "transactions": []
}
```

### Spellcasting (`dnd-spellcasting`)

```json
{
  "characterLevel": 7,
  "preparedLimit": 0,
  "casterClasses": [{ "name": "Wizard", "ability": "int" }],
  "slotPools": [
    {
      "name": "Spell Slots",
      "recovery": "longRest",
      "levels": [4, 3, 3, 1, 0, 0, 0, 0, 0],
      "used": [[false,false,false,false],[false,false,false],[false,false,false],[false],[],[],[],[],[]]
    }
  ],
  "spells": [
    {
      "id": "abc123",
      "name": "Fireball",
      "level": 3,
      "concentration": false,
      "castingTime": "Action",
      "range": "150 ft",
      "duration": "Instantaneous",
      "school": "Evocation",
      "components": { "verbal": true, "somatic": true, "material": true, "materialText": "A tiny ball of bat guano and sulfur" },
      "description": "A bright streak flashes from your pointing finger...",
      "damageDice": "8D6", "damageType": "Fire",
      "healingDice": "", "effectSummary": "8D6 fire, DEX save",
      "savingThrow": "DEX", "spellAttack": false,
      "ritual": false, "cantripUpgrade": "",
      "origin": "class", "originSource": "Wizard",
      "usesSlot": true, "freeUses": 0, "freeUsesRemaining": 0,
      "alwaysPrepared": false, "prepared": true,
      "upcastLevels": [
        { "level": 4, "effect": "9D6 fire" },
        { "level": 5, "effect": "10D6 fire" }
      ]
    }
  ]
}
```

**Spell origins:** `"class"` | `"subclass"` | `"feat"` | `"species"` | `"magicItem"` | `"other"`

### Spell List — legacy (`dnd-spelllist`)

Auto-migrated into Spellcasting on first load.

```json
[
  {
    "name": "Fire Bolt",
    "level": 0,
    "concentration": false,
    "castingTime": "Action",
    "school": "Evocation",
    "range": "120 ft",
    "components": { "verbal": true, "somatic": true, "material": false, "materialText": "" },
    "damage": { "dice": "1D10", "type": "Fire" },
    "description": "You hurl a mote of fire at a creature or object.",
    "cantripUpgrade": "Damage increases by 1D10 at levels 5, 11, and 17.",
    "backgroundImage": "",
    "textColor": "#FFFFFF"
  }
]
```

### Magic Items (`dnd-magicitems`)

```json
[
  {
    "item": {
      "name": "Wand of Fireballs",
      "description": "This wand has 7 charges...",
      "rarity": "Rare",
      "attunement": true,
      "charges": { "max": 7, "recovery": "1d6+1 at dawn" },
      "isArtificerInfusion": false,
      "image": "",
      "spells": [{ "name": "Fireball", "chargesUsed": 1 }]
    },
    "chargesUsed": [false, false, false, false, false, false, false]
  }
]
```

### Traits & Feats (`dnd-traits`)

```json
[
  {
    "id": "cf001",
    "category": "classFeature",
    "title": "Sneak Attack",
    "description": "Once per turn, deal extra 4D6 damage when you have advantage on an attack roll.",
    "source": "Rogue 1",
    "levelObtained": 1,
    "uses": { "max": 0, "current": 0, "recharge": "" },
    "linkedSkills": [], "linkedSpells": [],
    "passive": true
  }
]
```

**Categories:** `"classFeature"` | `"speciesTrait"` | `"feat"`

### Proficiencies (`dnd-proficiencies`)

```json
{
  "languages": ["Common", "Elvish", "Thieves' Cant"],
  "tools":     ["Thieves' Tools", "Poisoner's Kit"],
  "armor":     ["Light Armor"],
  "weapons":   ["Simple Weapons", "Hand Crossbow", "Longsword", "Rapier", "Shortsword"]
}
```

### Notes (`dnd-notes`)

```json
[
  {
    "id": "session01",
    "date": "2026-05-15",
    "title": "Session 12 — The Ruined Keep",
    "content": "Party entered at dusk...",
    "images": [],
    "createdAt": 1747300000000,
    "updatedAt": 1747303600000
  }
]
```

---

## Partial Exports

The export dialog lets you choose which sections to include. A partial export is still a valid import file — missing sections are simply skipped on import.

Example minimal export (profile + spells only):
```json
{
  "_meta": { ... },
  "profile": { ... },
  "spellcasting": { ... }
}
```
