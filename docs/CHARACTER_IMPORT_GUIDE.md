# D&D Companion — Character Import Guide

This document describes the JSON format for each sub-app, enabling a future
**bulk "Import Character"** feature that loads a single JSON file and distributes
data to every sub-app at once.

---

## Planned Bulk Import Format

```json
{
  "character": {
    "name": "Thorn Ironbark",
    "class": "Fighter 5 / Wizard 2",
    "species": "Half-Elf",
    "background": "Soldier"
  },
  "skills": { ... },
  "hpTracker": { ... },
  "inventory": { ... },
  "goldPurse": { ... },
  "spellcasting": { ... },
  "magicItems": [ ... ],
  "traits": [ ... ],
  "proficiencies": { ... },
  "notes": [ ... ]
}
```

The import function will parse each top-level key and write it to the
corresponding localStorage slot. Missing keys are skipped (existing data kept).

---

## Per-App JSON Formats

### 1. Skills (`dnd-skills`)

```json
{
  "level": 5,
  "abilities": [
    {
      "key": "str",
      "label": "STR",
      "fullName": "Strength",
      "value": 16,
      "saveProficiency": true,
      "skills": [
        { "name": "Athletics", "proficiency": "proficient" }
      ]
    },
    {
      "key": "dex",
      "label": "DEX",
      "fullName": "Dexterity",
      "value": 14,
      "saveProficiency": false,
      "skills": [
        { "name": "Acrobatics", "proficiency": "none" },
        { "name": "Sleight of Hand", "proficiency": "none" },
        { "name": "Stealth", "proficiency": "expertise" }
      ]
    }
  ]
}
```

**Proficiency values:** `"none"` | `"proficient"` | `"expertise"`

Ability keys: `str`, `dex`, `con`, `int`, `wis`, `cha`

Skills per ability:
- STR: Athletics
- DEX: Acrobatics, Sleight of Hand, Stealth
- CON: (none)
- INT: Arcana, History, Investigation, Nature, Religion
- WIS: Animal Handling, Insight, Medicine, Perception, Survival
- CHA: Deception, Intimidation, Performance, Persuasion

---

### 2. HP Tracker (`dnd-hptracker`)

```json
{
  "maxHp": 45,
  "currentHp": 45,
  "tempHp": 0,
  "acEffects": [
    { "name": "Base", "value": 10 },
    { "name": "DEX", "value": 2 },
    { "name": "Chain Mail", "value": 6 },
    { "name": "Shield", "value": 2 }
  ]
}
```

---

### 3. Inventory (`dnd-inventory`)

```json
{
  "maxAttunement": 3,
  "items": [
    {
      "name": "Longsword",
      "category": "equipment",
      "equipmentType": "weapon",
      "description": "Versatile martial weapon.",
      "weight": 3,
      "valueGP": 15,
      "quantity": 1,
      "attuned": false,
      "linkedMagicItem": "",
      "weapon": {
        "attackAbility": "str",
        "damageDice": "1D8",
        "damageType": "Slashing",
        "properties": "Versatile (1D10)",
        "magicBonus": 0,
        "range": "5 ft"
      }
    },
    {
      "name": "Chain Mail",
      "category": "equipment",
      "equipmentType": "armor",
      "description": "Heavy armor. AC 16.",
      "weight": 55,
      "valueGP": 75,
      "quantity": 1,
      "attuned": false,
      "linkedMagicItem": "",
      "weapon": null
    },
    {
      "name": "Healing Potion",
      "category": "items",
      "equipmentType": "general",
      "description": "Regain 2d4+2 hit points.",
      "weight": 0.5,
      "valueGP": 50,
      "quantity": 3,
      "attuned": false,
      "linkedMagicItem": "",
      "weapon": null
    }
  ]
}
```

**Categories:** `"equipment"` | `"items"` | `"crafting"`

**Equipment types:** `"general"` | `"weapon"` | `"armor"` | `"magicWeapon"` | `"magicArmor"` | `"magicEquipment"`

**Attack ability:** `"str"` | `"dex"` | `"finesse"`

**`weapon`** is `null` for non-weapon items.

---

### 4. Gold Purse (`dnd-goldpurse`)

```json
{
  "purse": {
    "pp": 0,
    "gp": 150,
    "ep": 0,
    "sp": 30,
    "cp": 50
  },
  "transactions": []
}
```

---

### 5. Spellcasting (`dnd-spellcasting`)

```json
{
  "characterLevel": 5,
  "preparedLimit": 8,
  "casterClasses": [
    { "name": "Wizard", "ability": "int" }
  ],
  "slotPools": [
    {
      "name": "Spell Slots",
      "recovery": "longRest",
      "levels": [4, 3, 2, 0, 0, 0, 0, 0, 0],
      "used": [
        [false, false, false, false],
        [false, false, false],
        [false, false],
        [], [], [], [], [], []
      ]
    }
  ],
  "spells": [
    {
      "id": "abc123",
      "name": "Fire Bolt",
      "level": 0,
      "castingTime": "Action",
      "range": "120 ft",
      "duration": "Instantaneous",
      "school": "Evocation",
      "components": {
        "verbal": true,
        "somatic": true,
        "material": false,
        "materialText": ""
      },
      "description": "You hurl a mote of fire at a creature or object.",
      "damageDice": "1D10",
      "damageType": "Fire",
      "healingDice": "",
      "effectSummary": "",
      "savingThrow": "",
      "spellAttack": true,
      "concentration": false,
      "ritual": false,
      "cantripUpgrade": "Damage increases by 1D10 at levels 5, 11, and 17.",
      "origin": "class",
      "originSource": "Wizard",
      "usesSlot": false,
      "freeUses": 0,
      "freeUsesRemaining": 0,
      "alwaysPrepared": false,
      "prepared": true,
      "upcastLevels": []
    },
    {
      "id": "def456",
      "name": "Fireball",
      "level": 3,
      "castingTime": "Action",
      "range": "150 ft",
      "duration": "Instantaneous",
      "school": "Evocation",
      "components": { "verbal": true, "somatic": true, "material": true, "materialText": "A tiny ball of bat guano and sulfur" },
      "description": "A bright streak flashes from your pointing finger to a point you choose...",
      "damageDice": "8D6",
      "damageType": "Fire",
      "healingDice": "",
      "effectSummary": "",
      "savingThrow": "DEX",
      "spellAttack": false,
      "concentration": false,
      "ritual": false,
      "cantripUpgrade": "",
      "origin": "class",
      "originSource": "Wizard",
      "usesSlot": true,
      "freeUses": 0,
      "freeUsesRemaining": 0,
      "alwaysPrepared": false,
      "prepared": true,
      "upcastLevels": [
        { "level": 4, "effect": "9D6" },
        { "level": 5, "effect": "10D6" },
        { "level": 6, "effect": "11D6" }
      ]
    }
  ]
}
```

**Spell origins:** `"class"` | `"subclass"` | `"feat"` | `"species"` | `"magicItem"` | `"other"`

**Spellcasting ability:** `"int"` | `"wis"` | `"cha"`

**Recovery:** `"longRest"` | `"shortRest"`

---

### 6. Magic Items (`dnd-magicitems`)

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
      "spells": [
        { "name": "Fireball", "chargesUsed": 1 }
      ]
    },
    "chargesUsed": [false, false, false, false, false, false, false]
  }
]
```

**Rarities:** `"Common"` | `"Uncommon"` | `"Rare"` | `"Very Rare"` | `"Legendary"` | `"Artifact"`

---

### 7. Traits & Feats (`dnd-traits`)

```json
[
  {
    "id": "xyz789",
    "category": "classFeature",
    "title": "Second Wind",
    "description": "Regain 1d10 + fighter level HP as a bonus action.",
    "source": "Fighter 1",
    "levelObtained": 1,
    "uses": { "max": 1, "current": 1, "recharge": "Short Rest" },
    "linkedSkills": [],
    "linkedSpells": [],
    "passive": false
  }
]
```

**Categories:** `"classFeature"` | `"speciesTrait"` | `"feat"`

**Recharge:** `""` | `"Short Rest"` | `"Long Rest"` | `"Dawn"`

---

### 8. Proficiencies (`dnd-proficiencies`)

```json
{
  "languages": ["Common", "Elvish", "Dwarvish"],
  "tools": ["Thieves' Tools"],
  "armor": ["Light Armor", "Medium Armor", "Shields"],
  "weapons": ["Simple Weapons", "Martial Weapons"]
}
```

---

### 9. Notes (`dnd-notes`)

```json
[
  {
    "id": "abc",
    "date": "2024-03-15",
    "title": "Session 1 — The Tavern",
    "content": "We met at the Prancing Pony...",
    "images": [],
    "createdAt": 1710500000000,
    "updatedAt": 1710500000000
  }
]
```

Images are stored as base64 data URIs: `{ "data": "data:image/png;base64,...", "name": "map.png" }`

---

### 10. Spell Slots (legacy, `dnd-spellslots`)

Migrated automatically into the Spellcasting app on first load.

### 11. Spell List (legacy, `dnd-spelllist`)

Migrated automatically into the Spellcasting app on first load.

---

## Future: Bulk Import Implementation

The import button will:

1. Accept a single `.json` file matching the format above
2. Parse each top-level key
3. Write to the corresponding `localStorage` key:
   - `character.skills` → `dnd-skills`
   - `character.hpTracker` → `dnd-hptracker`
   - `character.inventory` → `dnd-inventory`
   - `character.goldPurse` → `dnd-goldpurse`
   - `character.spellcasting` → `dnd-spellcasting`
   - `character.magicItems` → `dnd-magicitems`
   - `character.traits` → `dnd-traits`
   - `character.proficiencies` → `dnd-proficiencies`
   - `character.notes` → `dnd-notes`
4. Refresh all open sub-apps
5. Show a summary of what was imported

Missing keys are skipped. Existing data for present keys is overwritten.
