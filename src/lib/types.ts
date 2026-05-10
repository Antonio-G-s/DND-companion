/* ============================================
   types.ts — Shared type definitions
   All sub apps communicate via these types.
   ============================================ */

/** A JSON message sent between sub apps via the event bus. */
export interface BusMessage {
  /** Target sub app id (or "*" for broadcast) */
  target: string;
  /** Source sub app id */
  source?: string;
  /** Action name */
  action: string;
  /** Arbitrary payload — kept as a loose record for flexibility */
  [key: string]: unknown;
}

/** Descriptor for a registered sub app. */
export interface SubAppEntry {
  id: string;
  name: string;
  enabled: boolean;
  configPath: string;
}

/** The top-level app registry stored in configs/registry.json. */
export interface AppRegistry {
  apps: SubAppEntry[];
}

/** Spell component flags. */
export interface SpellComponents {
  verbal: boolean;
  somatic: boolean;
  material: boolean;
  materialText: string;
}

/** Spell damage block. */
export interface SpellDamage {
  dice: string;
  type: string;
}

/** A single spell definition loaded from JSON. */
export interface Spell {
  name: string;
  level: number;
  castingTime: string;
  school: string;
  range: string;
  components: SpellComponents;
  damage: SpellDamage;
  description: string;
  cantripUpgrade: string;
  backgroundImage: string;
  textColor: string;
}

/** Dice roller config (saved preferences). */
export interface DiceRollerConfig {
  lastDice: string;
  history: Array<{ dice: string; result: number; timestamp: number }>;
  maxHistory: number;
}

/** Spell list config. */
export interface SpellListConfig {
  spells: Spell[];
}

/** Represents a single opened window on the workspace. */
export interface WindowState {
  appId: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  zIndex: number;
}
