/* ============================================
   dice.ts — Dice parsing and rolling engine
   
   Supports formats:
     D20        → 1D20
     1D6        → roll 1 six-sided die
     2D8        → roll 2 eight-sided dice, sum
     3D10+2     → roll 3 ten-sided dice, sum, add 2
     1D20-1     → roll 1 twenty-sided die, subtract 1
   ============================================ */

export interface DiceRoll {
  /** Number of dice to roll */
  count: number;
  /** Number of sides per die */
  sides: number;
  /** Flat modifier (can be negative) */
  modifier: number;
  /** Original input string */
  input: string;
}

export interface RollResult {
  /** The parsed roll definition */
  roll: DiceRoll;
  /** Individual die results */
  rolls: number[];
  /** Sum of individual rolls */
  subtotal: number;
  /** Final total including modifier */
  total: number;
}

/**
 * Parse a dice string into a DiceRoll.
 * Accepts: "D20", "1D6", "2D8+3", "3D10-1"
 * Returns null if the string is invalid.
 */
export function parseDice(input: string): DiceRoll | null {
  const cleaned = input.trim().toUpperCase();

  // Regex: optional count, D, sides, optional +/- modifier
  const match = cleaned.match(/^(\d*)D(\d+)([+-]\d+)?$/);
  if (!match) return null;

  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  // Sanity checks
  if (count < 1 || count > 100) return null;
  if (sides < 2 || sides > 1000) return null;

  return { count, sides, modifier, input: cleaned };
}

/**
 * Roll a single die with the given number of sides.
 * Returns an integer from 1 to sides (inclusive).
 */
function rollOne(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Execute a dice roll and return the full result.
 */
export function rollDice(roll: DiceRoll): RollResult {
  const rolls: number[] = [];
  for (let i = 0; i < roll.count; i++) {
    rolls.push(rollOne(roll.sides));
  }
  const subtotal = rolls.reduce((sum, r) => sum + r, 0);
  const total = subtotal + roll.modifier;

  return { roll, rolls, subtotal, total };
}

/**
 * Convenience: parse + roll in one step.
 * Returns null if the dice string is invalid.
 */
export function parseAndRoll(input: string): RollResult | null {
  const roll = parseDice(input);
  if (!roll) return null;
  return rollDice(roll);
}

/** Standard dice options for the quick-pick UI. */
export const STANDARD_DICE = [
  "D2", "D3", "D4", "D6", "D8", "D10", "D12", "D20", "D100",
] as const;
