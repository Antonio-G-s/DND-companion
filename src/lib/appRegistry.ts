/* ============================================
   appRegistry.ts — Sub app registry
   
   Loads the registry config and provides
   lookup functions for sub apps.
   ============================================ */

import type { SubAppEntry, AppRegistry } from "./types";

/** Default registry — hardcoded for now, will load from JSON later. */
const DEFAULT_REGISTRY: AppRegistry = {
  apps: [
    {
      id: "characterProfile",
      name: "Character",
      enabled: true,
      configPath: "./configs/profile.json",
    },
    {
      id: "diceRoller",
      name: "Dice Roller",
      enabled: true,
      configPath: "./configs/diceRoller.json",
    },
    {
      id: "spellList",
      name: "Spell List",
      enabled: true,
      configPath: "./configs/spellList.json",
    },
    {
      id: "spellSlots",
      name: "Spell Slots",
      enabled: true,
      configPath: "./configs/spellSlots.json",
    },
    {
      id: "magicItems",
      name: "Magic Items",
      enabled: true,
      configPath: "./configs/magicItems.json",
    },
    {
      id: "inventory",
      name: "Inventory",
      enabled: true,
      configPath: "./configs/inventory.json",
    },
    {
      id: "goldPurse",
      name: "Gold Purse",
      enabled: true,
      configPath: "./configs/goldPurse.json",
    },
    {
      id: "notes",
      name: "Notes",
      enabled: true,
      configPath: "./configs/notes.json",
    },
    {
      id: "skills",
      name: "Skills",
      enabled: true,
      configPath: "./configs/skills.json",
    },
    {
      id: "hpTracker",
      name: "HP Tracker",
      enabled: true,
      configPath: "./configs/hpTracker.json",
    },
    {
      id: "traits",
      name: "Traits & Feats",
      enabled: true,
      configPath: "./configs/traits.json",
    },
    {
      id: "proficiencies",
      name: "Proficiencies",
      enabled: true,
      configPath: "./configs/proficiencies.json",
    },
    {
      id: "weaponsCantrips",
      name: "Attacks",
      enabled: true,
      configPath: "./configs/weaponsCantrips.json",
    },
    {
      id: "spellcasting",
      name: "Spellcasting",
      enabled: true,
      configPath: "./configs/spellcasting.json",
    },
  ],
};

let registry: AppRegistry = DEFAULT_REGISTRY;

/** Get all registered apps. */
export function getApps(): SubAppEntry[] {
  return registry.apps;
}

/** Get only enabled apps. */
export function getEnabledApps(): SubAppEntry[] {
  return registry.apps.filter((a) => a.enabled);
}

/** Find an app by id. */
export function getAppById(id: string): SubAppEntry | undefined {
  return registry.apps.find((a) => a.id === id);
}

/** Replace the entire registry (e.g. after loading from disk). */
export function setRegistry(newRegistry: AppRegistry): void {
  registry = newRegistry;
}
