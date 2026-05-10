<!-- ============================================
     Spellcasting.svelte — Unified Spellcasting Manager
     
     Merges Spell List + Spell Slots into one app.
     Tabs: Readied | All Spells | Spell Slots | Config
     
     Features:
     - Spells sorted by level with full D&D fields
     - Spell origins (class, subclass, feat, species, item)
     - Prepared/readied spell management with limit
     - Spell slot tracking with rest recovery
     - Upcasting with per-level effect text
     - Multiclass spellcasting support
     - Spell attack / Save DC from Skills app
     - Dice roller integration
     ============================================ -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { eventBus } from "../../lib/eventBus";
  import type { BusMessage } from "../../lib/types";

  // ============ TYPES ============

  type SpellOrigin = "class" | "subclass" | "feat" | "species" | "magicItem" | "other";
  type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

  interface SpellComponents {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialText: string;
  }

  interface UpcastLevel {
    level: number;
    effect: string;  // e.g. "3D8 radiant" or "heal 4D8+4"
  }

  interface FullSpell {
    id: string;
    name: string;
    level: number;           // 0=cantrip, 1-9
    castingTime: string;
    range: string;
    duration: string;
    school: string;
    components: SpellComponents;
    description: string;
    // Damage / healing
    damageDice: string;
    damageType: string;
    healingDice: string;
    effectSummary: string;
    // Mechanics
    savingThrow: string;     // "" or "DEX", "WIS", etc.
    spellAttack: boolean;    // true = uses spell attack roll
    concentration: boolean;
    ritual: boolean;
    cantripUpgrade: string;
    // Origin & slots
    origin: SpellOrigin;
    originSource: string;    // e.g. "Wizard", "Eldritch Adept", "Wand of Fireballs"
    usesSlot: boolean;       // does casting consume a slot?
    freeUses: number;        // per long rest free casts before needing a slot
    freeUsesRemaining: number;
    // Prepared
    alwaysPrepared: boolean; // domain spells, etc.
    prepared: boolean;       // user toggled
    // Upcasting
    upcastLevels: UpcastLevel[];
  }

  interface CasterClass {
    name: string;
    ability: AbilityKey;
  }

  interface SlotPool {
    name: string;            // "Spell Slots" or "Pact Magic"
    recovery: "longRest" | "shortRest";
    levels: number[];        // slots per level, index 0 = level 1
    used: boolean[][];       // used[levelIdx][slotIdx]
  }

  interface SpellcastingData {
    spells: FullSpell[];
    slotPools: SlotPool[];
    casterClasses: CasterClass[];
    preparedLimit: number;   // 0 = unlimited
    characterLevel: number;
  }

  // ============ CONSTANTS ============

  const SCHOOLS = ["Abjuration","Conjuration","Divination","Enchantment","Evocation","Illusion","Necromancy","Transmutation"];
  const DAMAGE_TYPES = ["Acid","Bludgeoning","Cold","Fire","Force","Lightning","Necrotic","Piercing","Poison","Psychic","Radiant","Slashing","Thunder"];
  const SAVE_TYPES = ["", "STR", "DEX", "CON", "INT", "WIS", "CHA"];
  const ORIGINS: { value: SpellOrigin; label: string }[] = [
    { value: "class", label: "Class" },
    { value: "subclass", label: "Subclass" },
    { value: "feat", label: "Feat" },
    { value: "species", label: "Species Trait" },
    { value: "magicItem", label: "Magic Item" },
    { value: "other", label: "Other" },
  ];
  const ORIGIN_COLORS: Record<SpellOrigin, string> = {
    class: "#cc8833", subclass: "#cc8833", feat: "#8866cc",
    species: "#44aa88", magicItem: "#cc44cc", other: "#888888",
  };
  const ABILITY_LABELS: Record<AbilityKey, string> = {
    str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
  };
  const LEVEL_NAMES = ["Cantrip","1st","2nd","3rd","4th","5th","6th","7th","8th","9th"];

  // ============ STATE ============

  let data: SpellcastingData = {
    spells: [], slotPools: [], casterClasses: [{ name: "Wizard", ability: "int" }],
    preparedLimit: 0, characterLevel: 1,
  };

  let activeTab: "readied" | "all" | "slots" | "config" = "readied";
  let filterLevel: number | null = null;
  let searchQuery = "";
  let showSpellForm = false;
  let editingSpellId: string | null = null;
  let form: FullSpell = blankSpell();

  // Casting dialog
  let castingSpell: FullSpell | null = null;
  let castLevel: number = 1;

  // Skills data
  let abilityMods: Record<AbilityKey, number> = { str:0, dex:0, con:0, int:0, wis:0, cha:0 };
  let profBonus = 2;

  // Roll feedback
  let lastRoll: { label: string; value: number } | null = null;

  let unsubscribe: () => void;

  onMount(() => {
    loadFromStorage();
    loadSkillsData();
    unsubscribe = eventBus.subscribe("spellcasting", (msg: BusMessage) => {
      if (msg.action === "rollResult") {
        lastRoll = { label: msg.dice as string, value: msg.result as number };
        setTimeout(() => { lastRoll = null; }, 3000);
      }
    });
  });

  onDestroy(() => { if (unsubscribe) unsubscribe(); });

  // ============ BLANK / ID ============

  function genId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function blankSpell(): FullSpell {
    return {
      id: genId(), name: "", level: 0, castingTime: "Action",
      range: "30 ft", duration: "Instantaneous", school: "Evocation",
      components: { verbal: true, somatic: false, material: false, materialText: "" },
      description: "", damageDice: "", damageType: "", healingDice: "",
      effectSummary: "", savingThrow: "", spellAttack: false,
      concentration: false, ritual: false, cantripUpgrade: "",
      origin: "class", originSource: data.casterClasses[0]?.name || "",
      usesSlot: true, freeUses: 0, freeUsesRemaining: 0,
      alwaysPrepared: false, prepared: false,
      upcastLevels: [],
    };
  }

  function blankSlotPool(): SlotPool {
    return {
      name: "Spell Slots", recovery: "longRest",
      levels: [0,0,0,0,0,0,0,0,0],
      used: [[],[],[],[],[],[],[],[],[]],
    };
  }

  // ============ SAVE / LOAD ============

  function save() {
    try {
      window.localStorage.setItem("dnd-spellcasting", JSON.stringify(data));
    } catch {}
  }

  function loadFromStorage() {
    try {
      const raw = window.localStorage.getItem("dnd-spellcasting");
      if (raw) {
        const parsed = JSON.parse(raw);
        data = {
          spells: parsed.spells || [],
          slotPools: parsed.slotPools || [],
          casterClasses: parsed.casterClasses || [{ name: "Wizard", ability: "int" }],
          preparedLimit: parsed.preparedLimit ?? 0,
          characterLevel: parsed.characterLevel ?? 1,
        };
        return;
      }
    } catch {}
    // Try migrating from old apps
    migrateOldData();
  }

  function migrateOldData() {
    // Migrate old Spell List
    try {
      const raw = window.localStorage.getItem("dnd-spelllist");
      if (raw) {
        const oldSpells = JSON.parse(raw);
        data.spells = oldSpells.map((s: any) => ({
          ...blankSpell(),
          id: genId(),
          name: s.name || "",
          level: s.level ?? 0,
          castingTime: s.castingTime || "Action",
          range: s.range || "30 ft",
          duration: "Instantaneous",
          school: s.school || "Evocation",
          components: s.components || { verbal: true, somatic: false, material: false, materialText: "" },
          description: s.description || "",
          damageDice: s.damage?.dice || "",
          damageType: s.damage?.type || "",
          cantripUpgrade: s.cantripUpgrade || "",
          origin: "class",
          usesSlot: s.level > 0,
          prepared: true,
        }));
      }
    } catch {}
    // Migrate old Spell Slots
    try {
      const raw = window.localStorage.getItem("dnd-spellslots");
      if (raw) {
        const old = JSON.parse(raw);
        if (old.groups) {
          data.slotPools = old.groups.map((g: any) => ({
            name: g.name || "Spell Slots",
            recovery: g.recovery || "longRest",
            levels: g.levels || [0,0,0,0,0,0,0,0,0],
            used: g.used || g.levels.map((c: number) => new Array(c).fill(false)),
          }));
        }
      }
    } catch {}
    // Load level from skills
    try {
      const raw = window.localStorage.getItem("dnd-skills");
      if (raw) { data.characterLevel = JSON.parse(raw).level || 1; }
    } catch {}
    if (data.spells.length > 0 || data.slotPools.length > 0) save();
  }

  function loadSkillsData() {
    try {
      const raw = window.localStorage.getItem("dnd-skills");
      if (!raw) return;
      const sd = JSON.parse(raw);
      data.characterLevel = sd.level || 1;
      profBonus = calcProfBonus(data.characterLevel);
      if (sd.abilities) {
        for (const ab of sd.abilities) {
          if (ab.key in abilityMods) {
            abilityMods[ab.key as AbilityKey] = Math.floor((ab.value - 10) / 2);
          }
        }
      }
    } catch {}
  }

  function calcProfBonus(lvl: number): number {
    if (lvl <= 4) return 2; if (lvl <= 8) return 3;
    if (lvl <= 12) return 4; if (lvl <= 16) return 5; return 6;
  }

  // ============ IMPORT / EXPORT ============

  function exportData() {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "spellcasting.json"; a.click();
    URL.revokeObjectURL(url);
  }

  function importData() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (parsed.spells) { data = { ...data, ...parsed }; save(); }
      } catch {}
    };
    input.click();
  }

  // ============ SPELL CRUD ============

  function openAddSpell() {
    form = blankSpell(); editingSpellId = null; showSpellForm = true;
  }

  function openEditSpell(spell: FullSpell) {
    form = JSON.parse(JSON.stringify(spell));
    editingSpellId = spell.id; showSpellForm = true;
  }

  function saveSpell() {
    if (!form.name.trim()) return;
    if (editingSpellId) {
      const idx = data.spells.findIndex(s => s.id === editingSpellId);
      if (idx !== -1) data.spells[idx] = { ...form };
    } else {
      form.id = genId();
      data.spells = [...data.spells, { ...form }];
    }
    showSpellForm = false; data = data; save();
  }

  function deleteSpell(id: string) {
    data.spells = data.spells.filter(s => s.id !== id); save();
  }

  function cancelForm() { showSpellForm = false; }

  function togglePrepared(spell: FullSpell) {
    if (spell.alwaysPrepared) return;
    if (spell.level === 0) return; // cantrips always ready
    spell.prepared = !spell.prepared;
    data = data; save();
  }

  // ---- Upcast form helpers ----
  let upcastLevel = 1;
  let upcastEffect = "";

  function addUpcast() {
    if (!upcastEffect.trim()) return;
    form.upcastLevels = [...form.upcastLevels, { level: upcastLevel, effect: upcastEffect.trim() }];
    form.upcastLevels.sort((a, b) => a.level - b.level);
    upcastEffect = ""; upcastLevel = Math.min(9, upcastLevel + 1);
  }

  function removeUpcast(idx: number) {
    form.upcastLevels = form.upcastLevels.filter((_, i) => i !== idx);
  }

  // ============ SPELL SLOTS ============

  function toggleSlot(poolIdx: number, levelIdx: number, slotIdx: number) {
    data.slotPools[poolIdx].used[levelIdx][slotIdx] =
      !data.slotPools[poolIdx].used[levelIdx][slotIdx];
    data = data; save();
  }

  function longRest() {
    for (const pool of data.slotPools) {
      pool.used = pool.levels.map(c => new Array(c).fill(false));
    }
    // Restore free uses
    for (const spell of data.spells) {
      spell.freeUsesRemaining = spell.freeUses;
    }
    data = data; save();
  }

  function shortRest() {
    for (const pool of data.slotPools) {
      if (pool.recovery === "shortRest") {
        pool.used = pool.levels.map(c => new Array(c).fill(false));
      }
    }
    data = data; save();
  }

  function addSlotPool() {
    data.slotPools = [...data.slotPools, blankSlotPool()];
    data = data; save();
  }

  function removeSlotPool(idx: number) {
    data.slotPools = data.slotPools.filter((_, i) => i !== idx);
    data = data; save();
  }

  function updatePoolSlots(poolIdx: number) {
    const pool = data.slotPools[poolIdx];
    pool.used = pool.levels.map(c => new Array(c).fill(false));
    data = data; save();
  }

  /** Count available slots at a given level across all pools */
  function availableSlots(level: number): number {
    let count = 0;
    for (const pool of data.slotPools) {
      const li = level - 1;
      if (li >= 0 && li < pool.levels.length) {
        for (let s = 0; s < pool.levels[li]; s++) {
          if (!pool.used[li][s]) count++;
        }
      }
    }
    return count;
  }

  /** Check if character can cast a spell (has slot or free use) */
  function canCast(spell: FullSpell): boolean {
    if (spell.level === 0) return true; // cantrips
    if (!spell.usesSlot) return true;
    if (spell.freeUsesRemaining > 0) return true;
    // Check slots at spell level or higher
    for (let l = spell.level; l <= 9; l++) {
      if (availableSlots(l) > 0) return true;
    }
    return false;
  }

  // ============ CASTING ============

  function openCastDialog(spell: FullSpell) {
    if (spell.level === 0) {
      // Cantrips: just roll directly
      rollSpell(spell, 0);
      return;
    }
    castingSpell = spell;
    castLevel = spell.level;
  }

  function confirmCast() {
    if (!castingSpell) return;
    const spell = castingSpell;

    // Consume resource
    if (spell.usesSlot) {
      if (spell.freeUsesRemaining > 0) {
        spell.freeUsesRemaining--;
      } else {
        // Spend a slot at castLevel
        spendSlot(castLevel);
      }
    }

    rollSpell(spell, castLevel);
    castingSpell = null;
    data = data; save();
  }

  function cancelCast() { castingSpell = null; }

  function spendSlot(level: number) {
    const li = level - 1;
    for (const pool of data.slotPools) {
      if (li >= 0 && li < pool.levels.length) {
        for (let s = 0; s < pool.levels[li]; s++) {
          if (!pool.used[li][s]) {
            pool.used[li][s] = true;
            return;
          }
        }
      }
    }
  }

  function rollSpell(spell: FullSpell, level: number) {
    // Determine dice
    let dice = spell.damageDice || spell.healingDice;

    // Check upcast
    if (level > 0) {
      const upcast = spell.upcastLevels.find(u => u.level === level);
      if (upcast) dice = upcast.effect;
      // If no specific upcast, use base dice for level >= spell level
    }

    // Scale cantrip
    if (spell.level === 0 && dice) {
      dice = scaleCantripDice(dice);
    }

    if (dice) {
      eventBus.send({
        target: "diceRoller", source: "spellcasting",
        action: "roll", dice,
      });
    }

    // If spell attack, also roll attack
    if (spell.spellAttack) {
      const castClass = data.casterClasses.find(c => c.name === spell.originSource) || data.casterClasses[0];
      const mod = castClass ? abilityMods[castClass.ability] : 0;
      const bonus = mod + profBonus;
      eventBus.send({
        target: "diceRoller", source: "spellcasting",
        action: "roll", dice: `1D20+${bonus}`,
      });
    }
  }

  function scaleCantripDice(baseDice: string): string {
    const match = baseDice.match(/^(\d*)D(\d+)(.*)$/i);
    if (!match) return baseDice;
    const sides = match[2]; const suffix = match[3] || "";
    let count = 1;
    if (data.characterLevel >= 17) count = 4;
    else if (data.characterLevel >= 11) count = 3;
    else if (data.characterLevel >= 5) count = 2;
    return `${count}D${sides}${suffix}`;
  }

  // ============ CALCULATIONS ============

  function spellAttackBonus(ability: AbilityKey): number {
    return abilityMods[ability] + profBonus;
  }

  function spellSaveDC(ability: AbilityKey): number {
    return 8 + abilityMods[ability] + profBonus;
  }

  function fmtMod(n: number): string { return n >= 0 ? `+${n}` : `${n}`; }

  // ============ CASTER CLASS MANAGEMENT ============

  function addCasterClass() {
    data.casterClasses = [...data.casterClasses, { name: "New Class", ability: "int" }];
    data = data; save();
  }

  function removeCasterClass(idx: number) {
    data.casterClasses = data.casterClasses.filter((_, i) => i !== idx);
    data = data; save();
  }

  // ============ COMPUTED ============

  $: allSpellsSorted = [...data.spells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  $: filteredSpells = (() => {
    let list = allSpellsSorted;
    if (filterLevel !== null) list = list.filter(s => s.level === filterLevel);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) ||
        s.school.toLowerCase().includes(q) || s.originSource.toLowerCase().includes(q)
      );
    }
    return list;
  })();

  $: readiedSpells = data.spells.filter(s => {
    if (s.level === 0) return true; // cantrips always
    if (s.alwaysPrepared) return true;
    if (s.origin !== "class" && s.origin !== "subclass") return true; // non-class = auto
    return s.prepared;
  }).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  $: castableSpells = readiedSpells.filter(s => canCast(s));

  $: preparedCount = data.spells.filter(s =>
    s.prepared && !s.alwaysPrepared && s.level > 0 &&
    (s.origin === "class" || s.origin === "subclass")
  ).length;

  $: spellCountByLevel = (() => {
    const counts: Record<number, number> = {};
    for (let i = 0; i <= 9; i++) counts[i] = data.spells.filter(s => s.level === i).length;
    return counts;
  })();

  function schoolColor(school: string): string {
    const m: Record<string, string> = {
      Abjuration:"#6699cc", Conjuration:"#cc9933", Divination:"#9966cc",
      Enchantment:"#cc6699", Evocation:"#cc4444", Illusion:"#6699ff",
      Necromancy:"#669966", Transmutation:"#cc9966",
    };
    return m[school] || "#888";
  }

  // Slot pool presets
  function presetFullCaster() {
    if (data.slotPools.length === 0) data.slotPools = [blankSlotPool()];
    data.slotPools[0].levels = [4,3,3,3,3,2,2,1,1];
    updatePoolSlots(0); data = data; save();
  }
  function presetHalfCaster() {
    if (data.slotPools.length === 0) data.slotPools = [blankSlotPool()];
    data.slotPools[0].levels = [4,3,3,2,1,0,0,0,0];
    updatePoolSlots(0); data = data; save();
  }
  function presetWarlock() {
    const pool: SlotPool = {
      name: "Pact Magic", recovery: "shortRest",
      levels: [0,0,2,0,0,0,0,0,0], used: [[],[],[],[],[],[],[],[],[]],
    };
    pool.used = pool.levels.map(c => new Array(c).fill(false));
    data.slotPools = [...data.slotPools, pool]; data = data; save();
  }
</script>

<div class="sc-app">
  <!-- ======== HEADER ======== -->
  <div class="header">
    <div class="header-left">
      {#each data.casterClasses as cc}
        <span class="cast-pill">
          {cc.name}: Atk {fmtMod(spellAttackBonus(cc.ability))} · DC {spellSaveDC(cc.ability)}
        </span>
      {/each}
    </div>
    <div class="header-right">
      <span class="pill">Lvl {data.characterLevel}</span>
      <span class="pill">Prof {fmtMod(profBonus)}</span>
      {#if data.preparedLimit > 0}
        <span class="pill" class:over={preparedCount > data.preparedLimit}>
          {preparedCount}/{data.preparedLimit} prep
        </span>
      {/if}
    </div>
  </div>

  <!-- Roll toast -->
  {#if lastRoll}
    <div class="roll-toast">🎲 {lastRoll.label} → <strong>{lastRoll.value}</strong></div>
  {/if}

  <!-- ======== TABS ======== -->
  <div class="tabs">
    <button class="tab" class:active={activeTab==="readied"} on:click={()=>activeTab="readied"}>
      Readied <span class="tc">{castableSpells.length}</span>
    </button>
    <button class="tab" class:active={activeTab==="all"} on:click={()=>activeTab="all"}>
      All Spells <span class="tc">{data.spells.length}</span>
    </button>
    <button class="tab" class:active={activeTab==="slots"} on:click={()=>activeTab="slots"}>
      Slots
    </button>
    <button class="tab" class:active={activeTab==="config"} on:click={()=>activeTab="config"}>
      Config
    </button>
  </div>

  <!-- ======== CASTING DIALOG ======== -->
  {#if castingSpell}
    {@const sp = castingSpell}
    <div class="cast-dialog">
      <div class="cd-title">Cast {sp.name}</div>
      <div class="cd-body">
        <div class="cd-slot-pick">
          <span class="cd-label">Spell Slot Level:</span>
          <div class="cd-levels">
            {#each {length: 10 - sp.level} as _, i}
              {@const lvl = sp.level + i}
              {@const avail = availableSlots(lvl)}
              <button class="cd-lvl" class:active={castLevel === lvl}
                      class:empty={avail === 0 && !(sp.freeUsesRemaining > 0 && lvl === sp.level)}
                      on:click={() => { castLevel = lvl; }}>
                {LEVEL_NAMES[lvl]}
                <span class="cd-avail">{avail}</span>
              </button>
            {/each}
          </div>
        </div>
        {#if sp.freeUsesRemaining > 0}
          <div class="cd-free">Free cast available ({sp.freeUsesRemaining} remaining)</div>
        {/if}
        <!-- Show upcast effect -->
        {#if castLevel > sp.level}
          {@const up = sp.upcastLevels.find(u => u.level === castLevel)}
          {#if up}
            <div class="cd-upcast">At {LEVEL_NAMES[castLevel]}: {up.effect}</div>
          {:else}
            <div class="cd-upcast dim">No special upcast effect defined for this level</div>
          {/if}
        {/if}
      </div>
      <div class="cd-actions">
        <button class="action-btn primary" on:click={confirmCast}
                disabled={!canCast(sp) && sp.freeUsesRemaining <= 0}>
          Cast at {LEVEL_NAMES[castLevel]}
        </button>
        <button class="action-btn" on:click={cancelCast}>Cancel</button>
      </div>
    </div>
  {/if}

  <!-- ======== READIED TAB ======== -->
  {#if activeTab === "readied"}
    <div class="spell-controls">
      <button class="sm-btn" on:click={longRest}>Long Rest</button>
      <button class="sm-btn sr" on:click={shortRest}>Short Rest</button>
      <!-- Quick slot summary -->
      <div class="slot-summary">
        {#each {length: 9} as _, i}
          {@const avail = availableSlots(i + 1)}
          {@const total = data.slotPools.reduce((s, p) => s + (p.levels[i] || 0), 0)}
          {#if total > 0}
            <span class="ss-pip" class:depleted={avail === 0}>{i+1}:{avail}</span>
          {/if}
        {/each}
      </div>
    </div>

    <div class="spell-list">
      {#each castableSpells as spell (spell.id)}
        {@const castClass = data.casterClasses.find(c => c.name === spell.originSource) || data.casterClasses[0]}
        <div class="spell-card readied-card" style="border-left-color:{schoolColor(spell.school)};">
          <div class="sc-top">
            <button class="cast-btn" on:click={() => openCastDialog(spell)} title="Cast this spell">
              ⚡
            </button>
            <div class="sc-info">
              <span class="sc-name">{spell.name}</span>
              <div class="sc-meta">
                <span>{LEVEL_NAMES[spell.level]}</span>
                <span>·</span>
                <span>{spell.school}</span>
                <span>·</span>
                <span>{spell.castingTime}</span>
                {#if spell.concentration}<span class="conc-tag">C</span>{/if}
                {#if spell.ritual}<span class="rit-tag">R</span>{/if}
              </div>
            </div>
            <div class="sc-right">
              {#if spell.damageDice}
                <button class="dice-btn" on:click={() => {
                  const dice = spell.level === 0 ? scaleCantripDice(spell.damageDice) : spell.damageDice;
                  eventBus.send({target:"diceRoller",source:"spellcasting",action:"roll",dice});
                }} title="Roll damage">
                  🎲 {spell.level === 0 ? scaleCantripDice(spell.damageDice) : spell.damageDice}
                </button>
              {/if}
              {#if spell.spellAttack && castClass}
                <span class="atk-mod">Atk {fmtMod(spellAttackBonus(castClass.ability))}</span>
              {/if}
              {#if spell.savingThrow}
                <span class="save-info">{spell.savingThrow} DC {castClass ? spellSaveDC(castClass.ability) : '?'}</span>
              {/if}
            </div>
          </div>
          {#if spell.damageType || spell.range !== "30 ft"}
            <div class="sc-detail">
              {#if spell.damageType}<span class="dt-tag">{spell.damageType}</span>{/if}
              <span class="range-tag">{spell.range}</span>
              {#if spell.duration !== "Instantaneous"}<span class="dur-tag">{spell.duration}</span>{/if}
            </div>
          {/if}
        </div>
      {/each}
      {#if castableSpells.length === 0}
        <div class="empty">No spells readied. Go to All Spells to prepare some.</div>
      {/if}
    </div>
  {/if}

  <!-- ======== ALL SPELLS TAB ======== -->
  {#if activeTab === "all"}
    <div class="spell-controls">
      <button class="sm-btn primary" on:click={openAddSpell}>+ Add</button>
      <button class="sm-btn" on:click={importData}>Import</button>
      <button class="sm-btn" on:click={exportData}>Export</button>
    </div>

    <!-- Level filter -->
    <div class="level-filter">
      <button class="lf-btn" class:active={filterLevel === null}
              on:click={() => filterLevel = null}>All</button>
      {#each {length: 10} as _, i}
        {#if spellCountByLevel[i] > 0}
          <button class="lf-btn" class:active={filterLevel === i}
                  on:click={() => filterLevel = i}>
            {i === 0 ? "C" : i} <span class="lf-count">{spellCountByLevel[i]}</span>
          </button>
        {/if}
      {/each}
    </div>

    <input type="text" class="search-input" bind:value={searchQuery} placeholder="Search spells..." />

    <!-- Spell form -->
    {#if showSpellForm}
      <div class="spell-form">
        <div class="form-title">{editingSpellId ? "Edit" : "Add"} Spell</div>

        <div class="fr"><label class="fl">Name <input type="text" bind:value={form.name} /></label></div>

        <div class="fr">
          <label class="fl narrow">Level <input type="number" min="0" max="9" bind:value={form.level} /></label>
          <label class="fl">School
            <select bind:value={form.school}>{#each SCHOOLS as s}<option>{s}</option>{/each}</select>
          </label>
        </div>

        <div class="fr">
          <label class="fl">Casting Time <input type="text" bind:value={form.castingTime} /></label>
          <label class="fl">Range <input type="text" bind:value={form.range} /></label>
          <label class="fl">Duration <input type="text" bind:value={form.duration} /></label>
        </div>

        <div class="fr check-row">
          <label class="ck"><input type="checkbox" bind:checked={form.components.verbal} /> V</label>
          <label class="ck"><input type="checkbox" bind:checked={form.components.somatic} /> S</label>
          <label class="ck"><input type="checkbox" bind:checked={form.components.material} /> M</label>
          {#if form.components.material}
            <input type="text" bind:value={form.components.materialText} placeholder="Material" class="mat-input" />
          {/if}
        </div>

        <div class="fr">
          <label class="fl">Damage Dice <input type="text" bind:value={form.damageDice} placeholder="2D6" /></label>
          <label class="fl">Damage Type
            <select bind:value={form.damageType}><option value="">None</option>{#each DAMAGE_TYPES as d}<option>{d}</option>{/each}</select>
          </label>
        </div>

        <div class="fr">
          <label class="fl">Healing Dice <input type="text" bind:value={form.healingDice} placeholder="1D8+3" /></label>
          <label class="fl">Effect Summary <input type="text" bind:value={form.effectSummary} /></label>
        </div>

        <div class="fr">
          <label class="fl">Saving Throw
            <select bind:value={form.savingThrow}>{#each SAVE_TYPES as s}<option value={s}>{s || "None"}</option>{/each}</select>
          </label>
          <label class="ck"><input type="checkbox" bind:checked={form.spellAttack} /> Spell Attack</label>
          <label class="ck"><input type="checkbox" bind:checked={form.concentration} /> Concentration</label>
          <label class="ck"><input type="checkbox" bind:checked={form.ritual} /> Ritual</label>
        </div>

        <label class="fl">Description <textarea bind:value={form.description} rows="2"></textarea></label>

        {#if form.level === 0}
          <label class="fl">Cantrip Upgrade <input type="text" bind:value={form.cantripUpgrade} /></label>
        {/if}

        <div class="fr">
          <label class="fl">Origin
            <select bind:value={form.origin}>{#each ORIGINS as o}<option value={o.value}>{o.label}</option>{/each}</select>
          </label>
          <label class="fl">Source <input type="text" bind:value={form.originSource} placeholder="Wizard, Alert..." /></label>
        </div>

        <div class="fr check-row">
          <label class="ck"><input type="checkbox" bind:checked={form.usesSlot} /> Uses Spell Slot</label>
          <label class="ck"><input type="checkbox" bind:checked={form.alwaysPrepared} /> Always Prepared</label>
        </div>

        {#if form.usesSlot}
          <div class="fr">
            <label class="fl narrow">Free Uses/Day <input type="number" min="0" max="10" bind:value={form.freeUses}
              on:change={() => { form.freeUsesRemaining = form.freeUses; }} /></label>
          </div>
        {/if}

        <!-- Upcast levels -->
        {#if form.level >= 1}
          <div class="upcast-section">
            <span class="sub-title">Upcast Effects</span>
            {#each form.upcastLevels as up, ui}
              <div class="up-row">
                <span class="up-lvl">{LEVEL_NAMES[up.level]}:</span>
                <span class="up-effect">{up.effect}</span>
                <button class="rem-btn" on:click={() => removeUpcast(ui)}>✕</button>
              </div>
            {/each}
            <div class="up-add">
              <select bind:value={upcastLevel} class="up-sel">
                {#each {length: 9 - form.level} as _, i}
                  <option value={form.level + i + 1}>{LEVEL_NAMES[form.level + i + 1]}</option>
                {/each}
              </select>
              <input type="text" bind:value={upcastEffect} placeholder="e.g. 3D8 radiant" class="up-input" />
              <button class="add-btn" on:click={addUpcast}>+</button>
            </div>
          </div>
        {/if}

        <div class="form-actions">
          <button class="action-btn primary" on:click={saveSpell}>Save</button>
          <button class="action-btn" on:click={cancelForm}>Cancel</button>
        </div>
      </div>
    {/if}

    <!-- Spell list -->
    <div class="spell-list">
      {#each filteredSpells as spell (spell.id)}
        <div class="spell-card" style="border-left-color:{schoolColor(spell.school)};">
          <div class="sc-top">
            <!-- Prepare toggle -->
            {#if spell.level > 0 && (spell.origin === "class" || spell.origin === "subclass")}
              <button class="prep-btn" class:prepped={spell.prepared || spell.alwaysPrepared}
                      on:click={() => togglePrepared(spell)}
                      title={spell.alwaysPrepared ? "Always prepared" : (spell.prepared ? "Unprepare" : "Prepare")}>
                {spell.alwaysPrepared ? "★" : (spell.prepared ? "●" : "○")}
              </button>
            {:else}
              <span class="prep-dot auto">✦</span>
            {/if}
            <div class="sc-info">
              <span class="sc-name">{spell.name}</span>
              <div class="sc-meta">
                <span>{LEVEL_NAMES[spell.level]}</span>
                <span>·</span>
                <span>{spell.school}</span>
                <span>·</span>
                <span style="color:{ORIGIN_COLORS[spell.origin]}">{spell.originSource || spell.origin}</span>
                {#if spell.concentration}<span class="conc-tag">C</span>{/if}
                {#if spell.ritual}<span class="rit-tag">R</span>{/if}
                {#if !spell.usesSlot}<span class="free-tag">Free</span>{/if}
              </div>
            </div>
            <div class="sc-actions">
              <button class="sm-btn" on:click={() => openEditSpell(spell)}>Edit</button>
              <button class="sm-btn danger" on:click={() => deleteSpell(spell.id)}>Del</button>
            </div>
          </div>
          {#if spell.description}
            <p class="sc-desc">{spell.description}</p>
          {/if}
        </div>
      {/each}
      {#if filteredSpells.length === 0}
        <div class="empty">{searchQuery || filterLevel !== null ? "No matches." : "No spells added."}</div>
      {/if}
    </div>
  {/if}

  <!-- ======== SLOTS TAB ======== -->
  {#if activeTab === "slots"}
    <div class="spell-controls">
      <button class="sm-btn" on:click={longRest}>Long Rest</button>
      <button class="sm-btn sr" on:click={shortRest}>Short Rest</button>
      <button class="sm-btn" on:click={addSlotPool}>+ Pool</button>
    </div>

    {#each data.slotPools as pool, pi (pi)}
      <div class="slot-pool">
        <div class="pool-header">
          <input type="text" bind:value={pool.name} on:change={save} class="pool-name-input" />
          <select bind:value={pool.recovery} on:change={save} class="pool-rec-sel">
            <option value="longRest">Long Rest</option>
            <option value="shortRest">Short Rest</option>
          </select>
          {#if pool.recovery === "shortRest"}
            <span class="sr-badge">SR</span>
          {/if}
          <button class="rem-btn" on:click={() => removeSlotPool(pi)}>✕</button>
        </div>

        <div class="slot-grid">
          {#each pool.levels as count, li}
            <div class="slot-row">
              <span class="slot-lvl">{li + 1}</span>
              <input type="number" min="0" max="10" bind:value={pool.levels[li]}
                     on:change={() => updatePoolSlots(pi)} class="slot-count-input" />
              <div class="slot-dots">
                {#each pool.used[li] || [] as isUsed, si}
                  <button class="slot-dot" class:used={isUsed} class:avail={!isUsed}
                          class:pact={pool.recovery === "shortRest"}
                          on:click={() => toggleSlot(pi, li, si)}>
                    <span class="dot-inner"></span>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}

    <!-- Presets -->
    <div class="presets-row">
      <span class="preset-label">Presets:</span>
      <button class="sm-btn" on:click={presetFullCaster}>Full Caster</button>
      <button class="sm-btn" on:click={presetHalfCaster}>Half Caster</button>
      <button class="sm-btn" on:click={presetWarlock}>+ Pact Magic</button>
    </div>

    {#if data.slotPools.length === 0}
      <div class="empty">No spell slot pools. Click + Pool or use a preset above.</div>
    {/if}
  {/if}

  <!-- ======== CONFIG TAB ======== -->
  {#if activeTab === "config"}
    <div class="config-section">
      <span class="cfg-title">Spellcasting Classes</span>
      {#each data.casterClasses as cc, ci}
        <div class="cfg-row">
          <input type="text" bind:value={cc.name} on:change={save} placeholder="Class" class="cfg-input" />
          <select bind:value={cc.ability} on:change={save} class="cfg-sel">
            <option value="int">Intelligence</option>
            <option value="wis">Wisdom</option>
            <option value="cha">Charisma</option>
          </select>
          <span class="cfg-stats">
            Atk {fmtMod(spellAttackBonus(cc.ability))} · DC {spellSaveDC(cc.ability)}
          </span>
          <button class="rem-btn" on:click={() => removeCasterClass(ci)}>✕</button>
        </div>
      {/each}
      <button class="sm-btn" on:click={addCasterClass}>+ Add Class</button>
    </div>

    <div class="config-section">
      <span class="cfg-title">Prepared Spell Limit</span>
      <div class="cfg-row">
        <input type="number" min="0" max="50" bind:value={data.preparedLimit} on:change={save}
               class="cfg-input narrow" />
        <span class="cfg-hint">(0 = unlimited)</span>
        <span class="cfg-hint">Currently: {preparedCount} prepared</span>
      </div>
    </div>

    <div class="config-section">
      <span class="cfg-title">Import / Export</span>
      <div class="cfg-row">
        <button class="sm-btn" on:click={importData}>Import JSON</button>
        <button class="sm-btn" on:click={exportData}>Export JSON</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .sc-app { display: flex; flex-direction: column; gap: 8px; }

  /* ---- Header ---- */
  .header { display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap; }
  .header-left { display: flex; gap: 4px; flex-wrap: wrap; }
  .header-right { display: flex; gap: 4px; }
  .cast-pill {
    font-size: 10px; padding: 2px 7px; background: var(--bg);
    border: 1px solid var(--accent-dim); border-radius: 2px;
    color: var(--accent); font-weight: 600;
  }
  .pill {
    font-size: 10px; font-weight: 600; padding: 2px 6px;
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 2px; color: var(--text-dim);
  }
  .pill.over { color: var(--danger); border-color: var(--danger); }

  .roll-toast {
    padding: 5px 10px; text-align: center; font-size: 12px;
    background: rgba(200,169,110,0.08); border: 1px solid var(--accent-dim);
    border-radius: var(--radius); color: var(--accent);
  }

  /* ---- Tabs ---- */
  .tabs { display: flex; gap: 2px; }
  .tab {
    flex: 1; padding: 6px; font-size: 11px; text-align: center;
    color: var(--text-dim); background: var(--bg);
    border: 1px solid var(--border); border-radius: var(--radius);
    cursor: pointer; transition: all var(--transition);
  }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--accent); border-color: var(--accent-dim); background: rgba(200,169,110,0.05); }
  .tc { font-size: 9px; opacity: 0.5; }

  /* ---- Controls ---- */
  .spell-controls { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; }
  .sm-btn {
    font-size: 11px; padding: 3px 10px; color: var(--text-dim);
    background: transparent; border: 1px solid var(--border); cursor: pointer;
  }
  .sm-btn:hover { color: var(--text); border-color: var(--border-focus); }
  .sm-btn.primary { color: var(--accent); border-color: var(--accent-dim); }
  .sm-btn.sr { color: #64b4ff; border-color: rgba(100,180,255,0.3); }
  .sm-btn.danger:hover { color: var(--danger); }

  .slot-summary { display: flex; gap: 4px; margin-left: auto; }
  .ss-pip {
    font-size: 10px; font-weight: 600; padding: 1px 5px;
    background: rgba(200,169,110,0.08); border: 1px solid var(--accent-dim);
    border-radius: 2px; color: var(--accent);
  }
  .ss-pip.depleted { color: var(--text-dim); border-color: var(--border); background: var(--bg); opacity: 0.5; }

  /* ---- Level filter ---- */
  .level-filter { display: flex; gap: 2px; flex-wrap: wrap; }
  .lf-btn {
    padding: 3px 8px; font-size: 11px; color: var(--text-dim);
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 2px; cursor: pointer;
  }
  .lf-btn:hover { border-color: var(--border-focus); }
  .lf-btn.active { color: var(--accent); border-color: var(--accent-dim); background: rgba(200,169,110,0.06); }
  .lf-count { font-size: 9px; opacity: 0.5; }

  .search-input { font-size: 12px; padding: 5px 10px; }

  /* ---- Cast dialog ---- */
  .cast-dialog {
    padding: 12px; background: var(--bg);
    border: 2px solid var(--accent-dim); border-radius: var(--radius);
  }
  .cd-title { font-family: var(--font-heading); font-size: 14px; font-weight: 600; color: var(--accent); margin-bottom: 8px; }
  .cd-body { display: flex; flex-direction: column; gap: 6px; }
  .cd-label { font-size: 11px; color: var(--text-dim); }
  .cd-levels { display: flex; gap: 3px; flex-wrap: wrap; margin-top: 4px; }
  .cd-lvl {
    padding: 4px 10px; font-size: 11px; color: var(--text-dim);
    background: var(--bg-input); border: 1px solid var(--border);
    border-radius: 2px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 1px;
  }
  .cd-lvl:hover { border-color: var(--border-focus); }
  .cd-lvl.active { color: var(--accent); border-color: var(--accent-dim); background: rgba(200,169,110,0.1); }
  .cd-lvl.empty { opacity: 0.3; }
  .cd-avail { font-size: 9px; opacity: 0.5; }
  .cd-free { font-size: 11px; color: #44aa44; }
  .cd-upcast { font-size: 12px; color: var(--accent); padding: 4px 8px; background: rgba(200,169,110,0.06); border-radius: 2px; }
  .cd-upcast.dim { color: var(--text-dim); opacity: 0.5; }
  .cd-actions { display: flex; gap: 6px; margin-top: 8px; }
  .action-btn {
    padding: 6px 14px; font-size: 12px; color: var(--text);
    border: 1px solid var(--border); background: var(--bg-input); cursor: pointer;
  }
  .action-btn.primary { color: var(--accent); border-color: var(--accent-dim); }
  .action-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  /* ---- Spell cards ---- */
  .spell-list { display: flex; flex-direction: column; gap: 4px; }
  .spell-card {
    padding: 8px 10px; background: var(--bg);
    border: 1px solid var(--border); border-left: 3px solid var(--text-dim);
    border-radius: var(--radius); display: flex; flex-direction: column; gap: 4px;
  }
  .readied-card { cursor: default; }

  .sc-top { display: flex; align-items: center; gap: 6px; }
  .sc-info { flex: 1; min-width: 0; }
  .sc-name { font-size: 13px; font-weight: 600; color: var(--text-bright); }
  .sc-meta { display: flex; gap: 4px; font-size: 10px; color: var(--text-dim); flex-wrap: wrap; align-items: center; }

  .conc-tag {
    font-size: 8px; font-weight: 700; padding: 0 3px;
    background: rgba(204,136,51,0.15); color: #cc8833;
    border-radius: 2px;
  }
  .rit-tag {
    font-size: 8px; font-weight: 700; padding: 0 3px;
    background: rgba(102,153,204,0.15); color: #6699cc;
    border-radius: 2px;
  }
  .free-tag {
    font-size: 8px; font-weight: 700; padding: 0 3px;
    background: rgba(68,170,68,0.15); color: #44aa44;
    border-radius: 2px;
  }

  .sc-right { display: flex; gap: 6px; align-items: center; flex-shrink: 0; flex-wrap: wrap; }
  .sc-actions { display: flex; gap: 3px; flex-shrink: 0; }

  .sc-desc { font-size: 11px; color: var(--text-dim); line-height: 1.4; }
  .sc-detail { display: flex; gap: 6px; font-size: 10px; color: var(--text-dim); }
  .dt-tag { color: var(--accent); font-weight: 600; }

  /* Prepare button */
  .prep-btn {
    width: 22px; height: 22px; padding: 0; font-size: 12px;
    background: none; border: none; cursor: pointer;
    color: var(--text-dim); display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .prep-btn.prepped { color: var(--accent); }
  .prep-btn:hover { transform: scale(1.2); }
  .prep-dot { width: 22px; text-align: center; font-size: 10px; color: var(--text-dim); flex-shrink: 0; }
  .prep-dot.auto { color: #44aa88; }

  /* Cast button */
  .cast-btn {
    width: 28px; height: 28px; padding: 0; font-size: 14px;
    background: rgba(200,169,110,0.08); border: 1px solid var(--accent-dim);
    border-radius: 4px; cursor: pointer; color: var(--accent);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: all 120ms;
  }
  .cast-btn:hover { background: rgba(200,169,110,0.2); transform: scale(1.1); }

  .dice-btn {
    font-size: 11px; padding: 2px 8px; color: var(--accent);
    background: rgba(200,169,110,0.06); border: 1px solid var(--accent-dim);
    border-radius: 2px; cursor: pointer;
  }
  .dice-btn:hover { background: rgba(200,169,110,0.15); }
  .atk-mod { font-size: 10px; color: #44aa88; font-weight: 600; }
  .save-info { font-size: 10px; color: #cc8833; font-weight: 600; }

  /* ---- Spell form ---- */
  .spell-form {
    display: flex; flex-direction: column; gap: 6px;
    padding: 12px; background: var(--bg);
    border: 1px solid var(--border); border-radius: var(--radius);
  }
  .form-title { font-family: var(--font-heading); font-size: 12px; color: var(--text-dim); text-transform: uppercase; }
  .fl {
    display: flex; flex-direction: column; gap: 2px;
    font-size: 10px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.2px;
  }
  .fl input, .fl select, .fl textarea { font-size: 12px; text-transform: none; }
  .fl.narrow { flex: 0 0 80px; }
  .fr { display: flex; gap: 6px; flex-wrap: wrap; }
  .fr .fl { flex: 1; }
  .form-actions { display: flex; gap: 6px; margin-top: 4px; }

  .check-row { align-items: center; }
  .ck {
    display: flex; align-items: center; gap: 3px;
    font-size: 11px; color: var(--text); cursor: pointer; white-space: nowrap;
  }
  .mat-input { flex: 1; font-size: 11px; min-width: 80px; }

  .sub-title { font-size: 10px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.3px; }

  .upcast-section { display: flex; flex-direction: column; gap: 4px; padding: 6px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius); }
  .up-row { display: flex; gap: 6px; align-items: center; font-size: 11px; }
  .up-lvl { color: var(--text-dim); font-weight: 600; min-width: 32px; }
  .up-effect { color: var(--accent); flex: 1; }
  .rem-btn { width: 18px; height: 18px; padding: 0; font-size: 10px; background: none; border: none; color: var(--text-dim); cursor: pointer; }
  .rem-btn:hover { color: var(--danger); }
  .up-add { display: flex; gap: 4px; }
  .up-sel { font-size: 11px; padding: 2px 4px; width: 56px; }
  .up-input { flex: 1; font-size: 11px; }
  .add-btn { width: 24px; font-size: 13px; font-weight: 700; padding: 0; color: var(--accent); border: 1px solid var(--accent-dim); background: transparent; border-radius: 2px; cursor: pointer; }

  /* ---- Slot pools ---- */
  .slot-pool {
    padding: 10px; background: var(--bg);
    border: 1px solid var(--border); border-radius: var(--radius);
    display: flex; flex-direction: column; gap: 6px;
  }
  .pool-header { display: flex; gap: 6px; align-items: center; }
  .pool-name-input { font-size: 12px; font-weight: 600; padding: 3px 6px; flex: 1; }
  .pool-rec-sel { font-size: 11px; padding: 2px 4px; }
  .sr-badge { font-size: 9px; font-weight: 700; padding: 1px 4px; background: rgba(100,180,255,0.15); color: #64b4ff; border-radius: 2px; }

  .slot-grid { display: flex; flex-direction: column; gap: 3px; }
  .slot-row { display: flex; align-items: center; gap: 6px; }
  .slot-lvl { font-size: 11px; color: var(--text-dim); font-weight: 600; min-width: 14px; text-align: right; }
  .slot-count-input { width: 36px; text-align: center; font-size: 12px; padding: 2px; }
  .slot-dots { display: flex; gap: 4px; flex-wrap: wrap; }
  .slot-dot {
    width: 24px; height: 16px; padding: 0;
    border: 1px solid var(--border); border-radius: 2px;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: all 150ms;
  }
  .dot-inner { width: 14px; height: 8px; border-radius: 1px; transition: all 150ms; }
  .slot-dot.avail { border-color: var(--accent-dim); box-shadow: 0 0 4px rgba(200,169,110,0.2); }
  .slot-dot.avail .dot-inner { background: var(--accent); box-shadow: 0 0 3px rgba(200,169,110,0.4); }
  .slot-dot.avail:hover { box-shadow: 0 0 8px rgba(200,169,110,0.4); transform: scale(1.1); }
  .slot-dot.pact.avail { border-color: rgba(100,180,255,0.4); box-shadow: 0 0 4px rgba(100,180,255,0.2); }
  .slot-dot.pact.avail .dot-inner { background: #64b4ff; box-shadow: 0 0 3px rgba(100,180,255,0.4); }
  .slot-dot.used { border-color: var(--border); }
  .slot-dot.used .dot-inner { background: var(--bg-input); }
  .slot-dot.used:hover { border-color: var(--border-focus); transform: scale(1.05); }

  .presets-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .preset-label { font-size: 10px; color: var(--text-dim); }

  /* ---- Config ---- */
  .config-section {
    display: flex; flex-direction: column; gap: 6px;
    padding: 10px; background: var(--bg);
    border: 1px solid var(--border); border-radius: var(--radius);
  }
  .cfg-title { font-size: 10px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.4px; }
  .cfg-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .cfg-input { font-size: 12px; padding: 3px 8px; }
  .cfg-input.narrow { width: 56px; text-align: center; }
  .cfg-sel { font-size: 12px; padding: 3px 6px; }
  .cfg-stats { font-size: 11px; color: var(--accent); font-weight: 600; }
  .cfg-hint { font-size: 10px; color: var(--text-dim); opacity: 0.6; }

  .empty { text-align: center; padding: 20px; font-size: 12px; color: var(--text-dim); opacity: 0.4; }
</style>
