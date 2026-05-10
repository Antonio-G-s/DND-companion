# D&D Companion — JSON Reference

Each sub app saves its state as JSON. Most apps support **Import / Export** buttons so you can load hand-crafted or AI-generated files. This document covers every app's schema, a worked example, and copy-paste AI prompts.

---

## Table of Contents

1. [Where data lives](#where-data-lives)
2. [Spell List](#1-spell-list)
3. [Spellcasting (unified)](#2-spellcasting-unified)
4. [Spell Slots](#3-spell-slots)
5. [HP Tracker](#4-hp-tracker)
6. [Skills & Ability Scores](#5-skills--ability-scores)
7. [Inventory](#6-inventory)
8. [Magic Items](#7-magic-items)
9. [Gold Purse](#8-gold-purse)
10. [Traits & Feats](#9-traits--feats)
11. [Proficiencies](#10-proficiencies)
12. [Notes](#11-notes)
13. [Character Profile (full export)](#12-character-profile-full-export)
14. [App Registry](#13-app-registry)
15. [How to write your own JSON](#how-to-write-your-own-json)
16. [AI prompts](#ai-prompts)

---

## Where data lives

| App | Storage key / file |
|---|---|
| Spell List | `localStorage: dnd-spelllist` · `configs/spellList.json` |
| Spellcasting | `localStorage: dnd-spellcasting` |
| Spell Slots | `localStorage: dnd-spellslots` |
| HP Tracker | `localStorage: dnd-hptracker` |
| Skills | `localStorage: dnd-skills` |
| Inventory | `localStorage: dnd-inventory` |
| Magic Items | `localStorage: dnd-magicitems` |
| Gold Purse | `localStorage: dnd-goldpurse` |
| Traits | `localStorage: dnd-traits` |
| Proficiencies | `localStorage: dnd-proficiencies` |
| Notes | `localStorage: dnd-notes` |
| App Registry | `configs/registry.json` |

Most apps expose an **Import** button — paste or select a `.json` file and the app loads it instantly.

---

## 1. Spell List

The legacy spell-card view. For a full spellcasting manager use [Spellcasting](#2-spellcasting-unified) instead.

### Schema

```ts
{
  spells: Spell[]
}

Spell {
  name:           string        // "Fireball"
  level:          number        // 0 = cantrip, 1–9 = spell level
  castingTime:    string        // "Action" | "Bonus Action" | "Reaction" | "1 Minute" …
  school:         string        // "Evocation" | "Abjuration" | "Conjuration" …
  range:          string        // "Self" | "Touch" | "60 ft" …
  components: {
    verbal:       boolean
    somatic:      boolean
    material:     boolean
    materialText: string        // "" if material is false
  }
  damage: {
    dice:         string        // "2D6" | "1D10+3" | "" (no damage)
    type:         string        // "Fire" | "Radiant" | "Force" | ""
  }
  description:    string
  cantripUpgrade: string        // "" for non-cantrips
  backgroundImage:string        // URL or "" for default
  textColor:      string        // "#FFFFFF"
}
```

### Example

```json
{
  "spells": [
    {
      "name": "Eldritch Blast",
      "level": 0,
      "castingTime": "Action",
      "school": "Evocation",
      "range": "120 ft",
      "components": { "verbal": true, "somatic": true, "material": false, "materialText": "" },
      "damage": { "dice": "1D10", "type": "Force" },
      "description": "A beam of crackling energy streaks toward a creature within range.",
      "cantripUpgrade": "Two beams at level 5, three at level 11, four at level 17.",
      "backgroundImage": "",
      "textColor": "#FFFFFF"
    },
    {
      "name": "Counterspell",
      "level": 3,
      "castingTime": "Reaction",
      "school": "Abjuration",
      "range": "60 ft",
      "components": { "verbal": false, "somatic": true, "material": false, "materialText": "" },
      "damage": { "dice": "", "type": "" },
      "description": "You attempt to interrupt a creature in the process of casting a spell.",
      "cantripUpgrade": "",
      "backgroundImage": "",
      "textColor": "#FFFFFF"
    }
  ]
}
```

---

## 2. Spellcasting (unified)

The full-featured spellcasting manager — spells, spell slots, and caster config in one JSON.

### Schema

```ts
{
  spells:         FullSpell[]
  slotPools:      SlotPool[]
  casterClasses:  CasterClass[]
  preparedLimit:  number        // 0 = unlimited prepared spells
  characterLevel: number
}

FullSpell {
  id:               string      // unique, e.g. "lp3k8a9f"
  name:             string
  level:            number      // 0–9
  castingTime:      string
  range:            string
  duration:         string      // "Instantaneous" | "1 minute" | "Concentration, up to 1 hour" …
  school:           string
  components: {
    verbal:         boolean
    somatic:        boolean
    material:       boolean
    materialText:   string
  }
  description:      string
  damageDice:       string      // "8D6" | ""
  damageType:       string      // "Fire" | ""
  healingDice:      string      // "2D4+2" | ""
  effectSummary:    string      // one-liner for the readied list
  savingThrow:      string      // "" | "DEX" | "WIS" | "CON" …
  spellAttack:      boolean
  concentration:    boolean
  ritual:           boolean
  cantripUpgrade:   string
  origin:           "class" | "subclass" | "feat" | "species" | "magicItem" | "other"
  originSource:     string      // "Wizard" | "Eldritch Adept" | "Wand of Fireballs" …
  usesSlot:         boolean
  freeUses:         number      // free casts per long rest before needing a slot
  freeUsesRemaining:number
  alwaysPrepared:   boolean     // domain / subclass spells
  prepared:         boolean
  upcastLevels: [               // optional upcasting text
    { level: number, effect: string }
  ]
}

SlotPool {
  name:     string              // "Spell Slots" | "Pact Magic"
  recovery: "longRest" | "shortRest"
  levels:   number[]            // [4,3,3,3,3,2,2,1,1,0] — index 0 = level 1
  used:     boolean[][]         // used[levelIndex][slotIndex]
}

CasterClass {
  name:    string               // "Wizard"
  ability: "str"|"dex"|"con"|"int"|"wis"|"cha"
}
```

### Example (Level 5 Wizard)

```json
{
  "characterLevel": 5,
  "preparedLimit": 8,
  "casterClasses": [{ "name": "Wizard", "ability": "int" }],
  "slotPools": [
    {
      "name": "Spell Slots",
      "recovery": "longRest",
      "levels": [4, 3, 2, 1, 0, 0, 0, 0, 0, 0],
      "used":   [[false,false,false,false],[false,false,false],[false,false],[false],[],[],[],[],[],[]]
    }
  ],
  "spells": [
    {
      "id": "abc123",
      "name": "Fireball",
      "level": 3,
      "castingTime": "Action",
      "range": "150 ft",
      "duration": "Instantaneous",
      "school": "Evocation",
      "components": { "verbal": true, "somatic": true, "material": true, "materialText": "A tiny ball of bat guano and sulfur" },
      "description": "A bright streak flashes from your pointing finger to a point you choose and then blossoms with a low roar into an explosion of flame.",
      "damageDice": "8D6",
      "damageType": "Fire",
      "healingDice": "",
      "effectSummary": "8D6 fire, 20-ft radius, DEX save",
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
        { "level": 4, "effect": "9D6 fire" },
        { "level": 5, "effect": "10D6 fire" }
      ]
    }
  ]
}
```

---

## 3. Spell Slots

Standalone slot tracker (useful for classes with no spell list, or multiclass configs).

### Schema

```ts
{
  groups: SlotGroup[]
  customTrackers: CustomTracker[]
  multiclass: boolean
}

SlotGroup {
  name:     string              // "Spell Slots" | "Pact Magic" | "Paladin"
  recovery: "longRest" | "shortRest"
  levels:   number[]            // 10 entries, index 0 = spell level 1
  used:     boolean[][]         // used[levelIndex][slotIndex]
}

CustomTracker {
  name:     string              // "Channel Divinity" | "Ki Points"
  total:    number
  used:     boolean[]           // length === total
  color:    string              // hex, e.g. "#44aacc"
  recovery: "longRest" | "shortRest"
}
```

### Example (Warlock 5 / Paladin 3)

```json
{
  "multiclass": true,
  "groups": [
    {
      "name": "Pact Magic",
      "recovery": "shortRest",
      "levels": [0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
      "used":   [[],[false,false],[],[],[],[],[],[],[],[]]
    },
    {
      "name": "Paladin",
      "recovery": "longRest",
      "levels": [4, 2, 0, 0, 0, 0, 0, 0, 0, 0],
      "used":   [[false,false,false,false],[false,false],[],[],[],[],[],[],[],[]]
    }
  ],
  "customTrackers": [
    {
      "name": "Channel Divinity",
      "total": 2,
      "used": [false, false],
      "color": "#c8a96e",
      "recovery": "shortRest"
    }
  ]
}
```

---

## 4. HP Tracker

### Schema

```ts
{
  maxHp:     number
  currentHp: number
  tempHp:    number
  acEffects: AcEffect[]
}

AcEffect {
  name:  string    // "Base" | "Chain Mail" | "Shield" | "Ring of Protection"
  value: number    // AC contribution
}
```

### Example

```json
{
  "maxHp": 52,
  "currentHp": 38,
  "tempHp": 0,
  "acEffects": [
    { "name": "Base",         "value": 10 },
    { "name": "DEX mod",      "value": 2 },
    { "name": "Chain Mail",   "value": 4 },
    { "name": "Shield",       "value": 2 }
  ]
}
```

> `totalAC` is the sum of all `acEffects[].value` — 18 in this example.

---

## 5. Skills & Ability Scores

### Schema

```ts
{
  level:     number
  abilities: AbilityBlock[]
}

AbilityBlock {
  key:             "str"|"dex"|"con"|"int"|"wis"|"cha"
  label:           string       // "STR"
  fullName:        string       // "Strength"
  value:           number       // 1–30 ability score
  saveProficiency: boolean
  skills:          SkillEntry[]
}

SkillEntry {
  name:        string           // "Athletics" | "Perception" …
  proficiency: "none" | "proficient" | "expertise"
}
```

### Example (Rogue 5, DEX-focused)

```json
{
  "level": 5,
  "abilities": [
    {
      "key": "str", "label": "STR", "fullName": "Strength",
      "value": 10, "saveProficiency": false,
      "skills": [{ "name": "Athletics", "proficiency": "none" }]
    },
    {
      "key": "dex", "label": "DEX", "fullName": "Dexterity",
      "value": 18, "saveProficiency": true,
      "skills": [
        { "name": "Acrobatics",    "proficiency": "expertise" },
        { "name": "Sleight of Hand","proficiency": "proficient" },
        { "name": "Stealth",       "proficiency": "expertise" }
      ]
    },
    {
      "key": "con", "label": "CON", "fullName": "Constitution",
      "value": 14, "saveProficiency": false, "skills": []
    },
    {
      "key": "int", "label": "INT", "fullName": "Intelligence",
      "value": 12, "saveProficiency": false,
      "skills": [
        { "name": "Arcana",       "proficiency": "none" },
        { "name": "History",      "proficiency": "none" },
        { "name": "Investigation","proficiency": "proficient" },
        { "name": "Nature",       "proficiency": "none" },
        { "name": "Religion",     "proficiency": "none" }
      ]
    },
    {
      "key": "wis", "label": "WIS", "fullName": "Wisdom",
      "value": 12, "saveProficiency": false,
      "skills": [
        { "name": "Animal Handling","proficiency": "none" },
        { "name": "Insight",        "proficiency": "proficient" },
        { "name": "Medicine",       "proficiency": "none" },
        { "name": "Perception",     "proficiency": "proficient" },
        { "name": "Survival",       "proficiency": "none" }
      ]
    },
    {
      "key": "cha", "label": "CHA", "fullName": "Charisma",
      "value": 14, "saveProficiency": false,
      "skills": [
        { "name": "Deception",    "proficiency": "expertise" },
        { "name": "Intimidation", "proficiency": "none" },
        { "name": "Performance",  "proficiency": "none" },
        { "name": "Persuasion",   "proficiency": "none" }
      ]
    }
  ]
}
```

---

## 6. Inventory

### Schema

```ts
{
  items:          InventoryItem[]
  maxAttunement:  number         // default 3
}

InventoryItem {
  name:            string
  category:        "equipment" | "items" | "crafting"
  equipmentType:   "general" | "weapon" | "armor" | "magicWeapon" | "magicArmor" | "magicEquipment"
  description:     string
  weight:          number        // lbs
  valueGP:         number        // gold pieces (use 0.1 for 1sp, 0.01 for 1cp)
  quantity:        number
  attuned:         boolean
  linkedMagicItem: string        // name of entry in Magic Items app, or ""
  weapon:          WeaponStats | null   // null unless equipmentType is "weapon" or "magicWeapon"
}

WeaponStats {
  attackAbility: "str" | "dex" | "finesse"
  damageDice:    string           // "1D8" | "2D6"
  damageType:    string           // "Slashing" | "Piercing" | "Bludgeoning" | "Fire" …
  properties:    string           // "Versatile (1D10), Light"
  magicBonus:    number           // 0 for mundane, 1/2/3 for +1/+2/+3
  range:         string           // "5 ft" | "20/60 ft"
}
```

### Example

```json
{
  "maxAttunement": 3,
  "items": [
    {
      "name": "Rapier +1",
      "category": "equipment",
      "equipmentType": "magicWeapon",
      "description": "A finely balanced magic rapier.",
      "weight": 2,
      "valueGP": 1000,
      "quantity": 1,
      "attuned": false,
      "linkedMagicItem": "",
      "weapon": {
        "attackAbility": "finesse",
        "damageDice": "1D8",
        "damageType": "Piercing",
        "properties": "Finesse, Light",
        "magicBonus": 1,
        "range": "5 ft"
      }
    },
    {
      "name": "Healing Potion",
      "category": "items",
      "equipmentType": "general",
      "description": "Regain 2D4+2 HP when you drink this.",
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

---

## 7. Magic Items

### Schema

```ts
// The file is an array of ItemState objects
ItemState[] where:

ItemState {
  item:        MagicItem
  chargesUsed: boolean[]     // length === item.charges.max; true = charge spent
}

MagicItem {
  name:                string
  description:         string
  rarity:              "Common" | "Uncommon" | "Rare" | "Very Rare" | "Legendary" | "Artifact"
  attunement:          boolean
  charges: {
    max:               number    // 0 = no charges
    recovery:          string    // "1d6+1 at dawn" | "all at dawn" | "1 per short rest" | ""
  }
  isArtificerInfusion: boolean
  image:               string    // URL, base64 data URI, or ""
  spells: ItemSpell[]
}

ItemSpell {
  name:        string    // "Fireball"
  chargesUsed: number    // charges consumed to cast (typically 1)
}
```

### Example

```json
[
  {
    "item": {
      "name": "Staff of Healing",
      "description": "This staff has 10 charges. While holding it, you can use an action to expend 1 or more charges to cast Cure Wounds (1 charge per spell level, up to 4th) or Lesser Restoration (2 charges). The staff regains 1d6+4 charges daily at dawn.",
      "rarity": "Rare",
      "attunement": true,
      "charges": { "max": 10, "recovery": "1d6+4 at dawn" },
      "isArtificerInfusion": false,
      "image": "",
      "spells": [
        { "name": "Cure Wounds",      "chargesUsed": 1 },
        { "name": "Lesser Restoration","chargesUsed": 2 }
      ]
    },
    "chargesUsed": [false, false, false, false, true, true, false, false, false, false]
  },
  {
    "item": {
      "name": "Cloak of Elvenkind",
      "description": "While you wear this cloak with its hood up, Wisdom (Perception) checks made to see you have disadvantage, and you have advantage on Dexterity (Stealth) checks made to hide.",
      "rarity": "Uncommon",
      "attunement": true,
      "charges": { "max": 0, "recovery": "" },
      "isArtificerInfusion": false,
      "image": "",
      "spells": []
    },
    "chargesUsed": []
  }
]
```

---

## 8. Gold Purse

### Schema

```ts
{
  pp: number    // platinum (1 pp = 10 gp)
  gp: number    // gold
  ep: number    // electrum (1 ep = 0.5 gp)
  sp: number    // silver (1 sp = 0.1 gp)
  cp: number    // copper (1 cp = 0.01 gp)
}
```

### Example

```json
{
  "pp": 2,
  "gp": 154,
  "ep": 0,
  "sp": 37,
  "cp": 12
}
```

---

## 9. Traits & Feats

### Schema

```ts
// The file is a Trait array
Trait[] where:

Trait {
  id:            string          // unique ID, e.g. "lq2f9x"
  category:      "classFeature" | "speciesTrait" | "feat"
  title:         string
  description:   string
  source:        string          // "Fighter 3" | "Half-Elf" | "Alert"
  levelObtained: number          // 0 = species trait / feat chosen at character creation
  uses: {
    max:      number             // 0 = passive / unlimited
    current:  number
    recharge: string             // "Long Rest" | "Short Rest" | ""
  }
  linkedSkills:  string[]        // future use — skill names
  linkedSpells:  string[]        // future use — spell names
  passive:       boolean
}
```

### Example

```json
[
  {
    "id": "cf001",
    "category": "classFeature",
    "title": "Action Surge",
    "description": "On your turn, you can push yourself beyond your normal limits. You gain one additional action this turn.",
    "source": "Fighter 2",
    "levelObtained": 2,
    "uses": { "max": 1, "current": 1, "recharge": "Short Rest" },
    "linkedSkills": [],
    "linkedSpells": [],
    "passive": false
  },
  {
    "id": "st001",
    "category": "speciesTrait",
    "title": "Darkvision",
    "description": "You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.",
    "source": "Half-Elf",
    "levelObtained": 0,
    "uses": { "max": 0, "current": 0, "recharge": "" },
    "linkedSkills": [],
    "linkedSpells": [],
    "passive": true
  },
  {
    "id": "ft001",
    "category": "feat",
    "title": "Sentinel",
    "description": "You have mastered techniques to take advantage of every drop in any enemy's guard. Attacks of opportunity don't suffer disadvantage. When you hit a creature with an opportunity attack, its speed becomes 0. Creatures within 5 ft provoke opportunity attacks even when taking the Disengage action.",
    "source": "Feat — Level 4",
    "levelObtained": 4,
    "uses": { "max": 0, "current": 0, "recharge": "" },
    "linkedSkills": [],
    "linkedSpells": [],
    "passive": true
  }
]
```

---

## 10. Proficiencies

### Schema

```ts
{
  languages: string[]
  tools:     string[]
  armor:     string[]
  weapons:   string[]
}
```

### Example

```json
{
  "languages": ["Common", "Elvish", "Thieves' Cant"],
  "tools":     ["Thieves' Tools", "Poisoner's Kit", "Lute"],
  "armor":     ["Light Armor", "Medium Armor", "Shields"],
  "weapons":   ["Simple Weapons", "Martial Weapons", "Hand Crossbow"]
}
```

---

## 11. Notes

### Schema

```ts
// The file is a Note array
Note[] where:

Note {
  id:        string          // unique ID
  date:      string          // "YYYY-MM-DD"
  title:     string
  content:   string          // plain text, newlines preserved
  images:    NoteImage[]
  createdAt: number          // Unix timestamp ms
  updatedAt: number          // Unix timestamp ms
}

NoteImage {
  data: string               // base64 data URI ("data:image/png;base64,...")
  name: string               // filename
}
```

### Example

```json
[
  {
    "id": "session01",
    "date": "2025-03-15",
    "title": "Session 1 — The Ruined Keep",
    "content": "The party arrived at Thornwall at dusk.\n\nKey events:\n- Met innkeeper Aldric who mentioned strange lights to the north\n- Found a note signed 'V' in the abandoned mill\n- Fought 4 skeletons, Kira went down to 3 HP\n\nLoot: 45 gp, a silver locket, a spell scroll of Detect Magic",
    "images": [],
    "createdAt": 1742000000000,
    "updatedAt": 1742003600000
  }
]
```

---

## 12. Character Profile (full export)

The Character Profile app can export and import **all apps at once** as a single JSON. This is the recommended way to back up or share a whole character.

### Schema

```ts
{
  profile: {
    name:         string
    subtitle:     string     // "Level 5 Rogue · Wood Elf"
    alignment:    string
    species:      string
    classes:      string
    level:        number
    description:  string
    backstory:    string
    profileImage: string     // base64 or URL
    partyLogo:    string
    partyName:    string
    tags:         string[]   // ["Assassin", "Face"]
    version:      string
    lastSaved:    number
  }
  skills:          object    // full skills JSON (see §5)
  hpTracker:       object    // full HP tracker JSON (see §4)
  inventory:       object    // full inventory JSON (see §6)
  goldPurse:       object    // full gold purse JSON (see §8)
  spellcasting:    object    // full spellcasting JSON (see §2)
  magicItems:      object    // full magic items JSON (see §7)
  traits:          object    // full traits JSON (see §9)
  proficiencies:   object    // full proficiencies JSON (see §10)
  notes:           object    // full notes JSON (see §11)
}
```

Use **Character Profile → Export** to generate this file for your character, then **Import** to restore it — or share it with another player so they can load a pre-built character sheet.

---

## 13. App Registry

`configs/registry.json` controls which sub apps appear in the toolbar.

### Schema

```ts
{
  apps: AppEntry[]
}

AppEntry {
  id:         string    // matches the app's event bus target ID
  name:       string    // display name in toolbar
  enabled:    boolean
  configPath: string    // relative path to the app's config file, or ""
}
```

### Example

```json
{
  "apps": [
    { "id": "diceRoller",  "name": "Dice Roller",  "enabled": true,  "configPath": "./configs/diceRoller.json" },
    { "id": "spellList",   "name": "Spell List",   "enabled": true,  "configPath": "./configs/spellList.json" },
    { "id": "hpTracker",   "name": "HP Tracker",   "enabled": true,  "configPath": "" },
    { "id": "inventory",   "name": "Inventory",    "enabled": true,  "configPath": "" },
    { "id": "spellSlots",  "name": "Spell Slots",  "enabled": false, "configPath": "" }
  ]
}
```

---

## How to write your own JSON

1. **Use the Export button** in any app as a starting template — it gives you a valid file with your current data.
2. Edit it in any text editor or paste it into an AI chat.
3. **Import** it back with the Import button. The app validates and migrates the file on load.

### Tips

- Dice strings follow the pattern `XDY` or `XDY+Z` / `XDY-Z`, e.g. `2D6`, `1D8+3`, `4D6-1`.
- All strings are case-sensitive where noted (e.g. ability keys must be lowercase: `"int"`, not `"INT"`).
- Unknown keys are ignored on import — safe to add comments as a separate `"_note"` key.
- `used` arrays in Spell Slots must match the `levels` array lengths — if `levels[2] = 3` then `used[2]` must have 3 booleans.
- Magic item `chargesUsed` length must equal `charges.max`.

---

## AI Prompts

Copy any of these prompts and paste them directly into Claude, ChatGPT, or your preferred AI. Ask it to return raw JSON with no extra explanation.

---

### Spell List — full character spell book

```
Generate a JSON spell list for a Level 7 Cleric (Life domain) in D&D 5e 2024.
Include 3 cantrips and 8 prepared spells covering healing, buffs, and crowd control.
Use this exact schema and return ONLY valid JSON, no explanation:

{
  "spells": [
    {
      "name": "",
      "level": 0,
      "castingTime": "",
      "school": "",
      "range": "",
      "components": { "verbal": true, "somatic": true, "material": false, "materialText": "" },
      "damage": { "dice": "", "type": "" },
      "description": "",
      "cantripUpgrade": "",
      "backgroundImage": "",
      "textColor": "#FFFFFF"
    }
  ]
}
```

---

### Spellcasting — full unified spellcaster

```
Generate a full spellcasting JSON for a Level 9 Wizard (School of Evocation) in D&D 5e 2024.
Include:
- 4 cantrips, 12 prepared spells (mix of evocation and utility)
- Correct spell slot counts for level 9 full caster
- Upcasting entries for Fireball and Magic Missile

Return ONLY valid JSON matching this schema (no explanation):
{
  "characterLevel": 9,
  "preparedLimit": 13,
  "casterClasses": [{ "name": "Wizard", "ability": "int" }],
  "slotPools": [...],
  "spells": [...]
}
Each spell must include: id (short random string), name, level, castingTime, range, duration, school, components, description, damageDice, damageType, healingDice, effectSummary, savingThrow, spellAttack, concentration, ritual, cantripUpgrade, origin, originSource, usesSlot, freeUses, freeUsesRemaining, alwaysPrepared, prepared, upcastLevels.
```

---

### Skills — full ability score block

```
Generate a skills JSON for a Level 6 Barbarian (Path of the Berserker) in D&D 5e 2024.
STR 20, DEX 14, CON 18, INT 8, WIS 12, CHA 10.
Proficient in: Athletics, Intimidation, Perception, Survival. STR and CON saves.
Return ONLY valid JSON with this structure:
{
  "level": 6,
  "abilities": [
    {
      "key": "str", "label": "STR", "fullName": "Strength",
      "value": 20, "saveProficiency": true,
      "skills": [{ "name": "Athletics", "proficiency": "proficient" }]
    },
    ... (all six abilities)
  ]
}
```

---

### Inventory — themed gear loadout

```
Generate an inventory JSON for a Level 5 Ranger in D&D 5e 2024 with a hunter/survivalist theme.
Include: 2 weapons, 1 set of armor, 4 consumables/items, 2 crafting materials.
Return ONLY valid JSON:
{
  "maxAttunement": 3,
  "items": [
    {
      "name": "", "category": "equipment", "equipmentType": "weapon",
      "description": "", "weight": 0, "valueGP": 0, "quantity": 1,
      "attuned": false, "linkedMagicItem": "",
      "weapon": {
        "attackAbility": "dex", "damageDice": "1D8", "damageType": "Piercing",
        "properties": "", "magicBonus": 0, "range": "5 ft"
      }
    }
  ]
}
Set weapon to null for non-weapon items. Use "items" category for consumables, "crafting" for materials.
```

---

### Magic Items — party loot drop

```
Generate a magic items JSON representing a treasure hoard for a Level 8 D&D 5e party.
Include 4 items: 1 legendary, 1 rare, 2 uncommon. At least 2 should have charges.
Return ONLY valid JSON as an array:
[
  {
    "item": {
      "name": "", "description": "", "rarity": "Rare", "attunement": true,
      "charges": { "max": 7, "recovery": "1d6+1 at dawn" },
      "isArtificerInfusion": false, "image": "",
      "spells": [{ "name": "", "chargesUsed": 1 }]
    },
    "chargesUsed": []
  }
]
chargesUsed must be a boolean array with length equal to charges.max (all false = full charges).
```

---

### Traits — class feature list

```
Generate a traits JSON for a Level 8 Paladin (Oath of Devotion) in D&D 5e 2024.
Include all class features gained by level 8, 2 species traits (Aasimar), and 1 feat (War Caster).
Return ONLY valid JSON as an array:
[
  {
    "id": "unique_short_id",
    "category": "classFeature",
    "title": "",
    "description": "",
    "source": "Paladin 2",
    "levelObtained": 2,
    "uses": { "max": 2, "current": 2, "recharge": "Short Rest" },
    "linkedSkills": [], "linkedSpells": [], "passive": false
  }
]
Set uses.max to 0 and passive to true for always-active traits.
```

---

### Full character export

```
Generate a complete D&D Companion character export JSON for:
- Name: Lyra Ashveil
- Level 7 Wood Elf Rogue (Arcane Trickster subclass)
- STR 10, DEX 20, CON 14, INT 16, WIS 12, CHA 13
- Alignment: Chaotic Good

Include profile, skills (with correct proficiencies and expertise), HP (52 max), AC 16,
inventory (thieves tools, shortbow, daggers, studded leather), gold purse, 5 known spells
(Mage Hand, Minor Illusion, Sleep, Shield, Misty Step), appropriate traits and feats,
Common + Elvish + Thieves' Cant proficiencies.

Return ONLY valid JSON using the full character export schema with top-level keys:
profile, skills, hpTracker, inventory, goldPurse, spellcasting, magicItems, traits, proficiencies, notes.
```
