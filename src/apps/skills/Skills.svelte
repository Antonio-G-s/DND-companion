<!-- ============================================
     Skills.svelte — Ability Scores & Skills
     
     Ability scores with modifiers.
     Skills grouped by ability.
     Proficiency & expertise toggles.
     Click any skill/save to roll d20+modifier
     via the Dice Roller event bus.
     Import/export JSON.
     ============================================ -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { eventBus } from "../../lib/eventBus";
  import type { BusMessage } from "../../lib/types";

  // ---- Types ----

  type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

  type ProfLevel = "none" | "proficient" | "expertise";

  interface SkillEntry {
    name: string;
    proficiency: ProfLevel;
  }

  interface AbilityBlock {
    key: AbilityKey;
    label: string;
    fullName: string;
    value: number;
    saveProficiency: boolean;
    skills: SkillEntry[];
  }

  interface SkillsData {
    level: number;
    abilities: AbilityBlock[];
  }

  // ---- Constants ----

  const ABILITY_SKILLS: Record<AbilityKey, string[]> = {
    str: ["Athletics"],
    dex: ["Acrobatics", "Sleight of Hand", "Stealth"],
    con: [],
    int: ["Arcana", "History", "Investigation", "Nature", "Religion"],
    wis: ["Animal Handling", "Insight", "Medicine", "Perception", "Survival"],
    cha: ["Deception", "Intimidation", "Performance", "Persuasion"],
  };

  const ABILITY_ORDER: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

  const ABILITY_LABELS: Record<AbilityKey, string> = {
    str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
  };

  const ABILITY_FULL: Record<AbilityKey, string> = {
    str: "Strength", dex: "Dexterity", con: "Constitution",
    int: "Intelligence", wis: "Wisdom", cha: "Charisma",
  };

  // ---- State ----

  let level = 1;
  let abilities: AbilityBlock[] = [];
  let lastRoll: { label: string; total: number; d20: number; mod: number } | null = null;
  let showConfig = false;

  // ---- Lifecycle ----

  let unsubscribe: () => void;

  onMount(() => {
    loadFromStorage();

    unsubscribe = eventBus.subscribe("skills", (msg: BusMessage) => {
      if (msg.action === "rollResult") {
        // Could show roll result inline if desired
      }
    });
  });

  onDestroy(() => { if (unsubscribe) unsubscribe(); });

  // ============ INIT ============

  function buildDefaults(): AbilityBlock[] {
    return ABILITY_ORDER.map((key) => ({
      key,
      label: ABILITY_LABELS[key],
      fullName: ABILITY_FULL[key],
      value: 10,
      saveProficiency: false,
      skills: ABILITY_SKILLS[key].map((name) => ({
        name,
        proficiency: "none" as ProfLevel,
      })),
    }));
  }

  // ============ CALCULATIONS ============

  /** Ability modifier: floor((score - 10) / 2) */
  function abilityMod(score: number): number {
    return Math.floor((score - 10) / 2);
  }

  /** Proficiency bonus by level */
  function profBonus(lvl: number): number {
    if (lvl <= 4) return 2;
    if (lvl <= 8) return 3;
    if (lvl <= 12) return 4;
    if (lvl <= 16) return 5;
    return 6;
  }

  /** Skill total modifier */
  function skillMod(abilityScore: number, prof: ProfLevel): number {
    const base = abilityMod(abilityScore);
    const pb = profBonus(level);
    if (prof === "expertise") return base + pb * 2;
    if (prof === "proficient") return base + pb;
    return base;
  }

  /** Save modifier */
  function saveMod(abilityScore: number, proficient: boolean): number {
    const base = abilityMod(abilityScore);
    return proficient ? base + profBonus(level) : base;
  }

  /** Format modifier as +X or -X */
  function fmtMod(mod: number): string {
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  $: pb = profBonus(level);

  // ============ DICE INTEGRATION ============

  /** Roll d20 + modifier via the Dice Roller */
  function rollCheck(label: string, modifier: number) {
    // Generate the roll locally for immediate feedback
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + modifier;

    lastRoll = { label, total, d20, mod: modifier };

    // Also send to dice roller for history
    eventBus.send({
      target: "diceRoller",
      source: "skills",
      action: "roll",
      dice: modifier >= 0 ? `1D20+${modifier}` : `1D20${modifier}`,
    });

    // Clear after a few seconds
    setTimeout(() => { lastRoll = null; }, 4000);
  }

  function rollAbility(ab: AbilityBlock) {
    const mod = abilityMod(ab.value);
    rollCheck(`${ab.fullName} Check`, mod);
  }

  function rollSave(ab: AbilityBlock) {
    const mod = saveMod(ab.value, ab.saveProficiency);
    rollCheck(`${ab.fullName} Save`, mod);
  }

  function rollSkill(ab: AbilityBlock, skill: SkillEntry) {
    const mod = skillMod(ab.value, skill.proficiency);
    rollCheck(skill.name, mod);
  }

  // ============ PROFICIENCY CYCLING ============

  /** Cycle: none → proficient → expertise → none */
  function cycleProf(ab: AbilityBlock, skillIdx: number) {
    const skill = ab.skills[skillIdx];
    if (skill.proficiency === "none") skill.proficiency = "proficient";
    else if (skill.proficiency === "proficient") skill.proficiency = "expertise";
    else skill.proficiency = "none";
    abilities = abilities;
    saveToStorage();
  }

  function toggleSaveProf(ab: AbilityBlock) {
    ab.saveProficiency = !ab.saveProficiency;
    abilities = abilities;
    saveToStorage();
  }

  // ============ SAVE / LOAD ============

  function saveToStorage() {
    try {
      const data: SkillsData = { level, abilities };
      window.localStorage.setItem("dnd-skills", JSON.stringify(data));
    } catch {}
  }

  function loadFromStorage() {
    try {
      const raw = window.localStorage.getItem("dnd-skills");
      if (raw) {
        const data: SkillsData = JSON.parse(raw);
        level = data.level || 1;
        abilities = data.abilities || buildDefaults();
        // Ensure all skills exist (in case new ones were added)
        for (const ab of abilities) {
          const expected = ABILITY_SKILLS[ab.key] || [];
          for (const skillName of expected) {
            if (!ab.skills.find((s) => s.name === skillName)) {
              ab.skills.push({ name: skillName, proficiency: "none" });
            }
          }
        }
        return;
      }
    } catch {}
    abilities = buildDefaults();
  }

  function onValueChange() {
    abilities = abilities;
    saveToStorage();
  }

  function onLevelChange() {
    saveToStorage();
  }

  // ============ IMPORT / EXPORT ============

  function exportSkills() {
    const data: SkillsData = { level, abilities };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skills.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importSkills() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data: SkillsData = JSON.parse(text);
        if (data.abilities) {
          level = data.level || 1;
          abilities = data.abilities;
          saveToStorage();
        }
      } catch {
        console.error("Invalid skills JSON");
      }
    };
    input.click();
  }

  // ---- Proficiency dot display ----
  function profDot(p: ProfLevel): string {
    if (p === "expertise") return "◆";
    if (p === "proficient") return "●";
    return "○";
  }

  function profColor(p: ProfLevel): string {
    if (p === "expertise") return "var(--accent)";
    if (p === "proficient") return "var(--text)";
    return "var(--text-dim)";
  }

  function profTitle(p: ProfLevel): string {
    if (p === "expertise") return "Expertise (double proficiency)";
    if (p === "proficient") return "Proficient";
    return "Not proficient — click to cycle";
  }
</script>

<div class="skills-app">
  <!-- Top bar -->
  <div class="top-bar">
    <div class="level-row">
      <label class="level-label">
        Level
        <input type="number" min="1" max="20" bind:value={level} on:change={onLevelChange} class="level-input" />
      </label>
      <span class="pb-badge">Prof +{pb}</span>
    </div>
    <div class="top-actions">
      <button class="sm-btn" on:click={() => { showConfig = !showConfig; }}>
        {showConfig ? "Done" : "Edit"}
      </button>
      <button class="sm-btn" on:click={importSkills}>Import</button>
      <button class="sm-btn" on:click={exportSkills}>Export</button>
    </div>
  </div>

  <!-- Roll result toast -->
  {#if lastRoll}
    <div class="roll-toast">
      <span class="roll-label">{lastRoll.label}</span>
      <span class="roll-d20">d20: {lastRoll.d20}</span>
      <span class="roll-mod">{fmtMod(lastRoll.mod)}</span>
      <span class="roll-eq">=</span>
      <span class="roll-total">{lastRoll.total}</span>
    </div>
  {/if}

  <!-- Ability blocks -->
  <div class="ability-list">
    {#each abilities as ab (ab.key)}
      {@const mod = abilityMod(ab.value)}

      <div class="ability-block">
        <!-- Ability header -->
        <div class="ability-header">
          <div class="ability-left">
            {#if showConfig}
              <input
                type="number"
                min="1"
                max="30"
                bind:value={ab.value}
                on:change={onValueChange}
                class="score-input"
              />
            {:else}
              <button class="score-display" on:click={() => rollAbility(ab)} title="Roll {ab.fullName} check">
                {ab.value}
              </button>
            {/if}
            <div class="ability-info">
              <span class="ability-label">{ab.label}</span>
              <span class="ability-mod">{fmtMod(mod)}</span>
            </div>
          </div>

          <!-- Saving throw -->
          <button
            class="save-row"
            class:prof={ab.saveProficiency}
            on:click={() => { if (showConfig) toggleSaveProf(ab); else rollSave(ab); }}
            title={showConfig
              ? (ab.saveProficiency ? "Remove save proficiency" : "Add save proficiency")
              : `Roll ${ab.fullName} Save (${fmtMod(saveMod(ab.value, ab.saveProficiency))})`}
          >
            <span class="save-dot" style="color: {ab.saveProficiency ? 'var(--text)' : 'var(--text-dim)'}">
              {ab.saveProficiency ? "●" : "○"}
            </span>
            <span class="save-label">Save</span>
            <span class="save-mod">{fmtMod(saveMod(ab.value, ab.saveProficiency))}</span>
          </button>
        </div>

        <!-- Skills -->
        {#if ab.skills.length > 0}
          <div class="skill-list">
            {#each ab.skills as skill, si}
              {@const sm = skillMod(ab.value, skill.proficiency)}
              <div class="skill-row">
                <!-- Prof dot — click to cycle in edit mode -->
                <button
                  class="prof-dot"
                  style="color: {profColor(skill.proficiency)}"
                  on:click|stopPropagation={() => { if (showConfig) cycleProf(ab, si); }}
                  title={showConfig ? profTitle(skill.proficiency) : ""}
                  class:editable={showConfig}
                >
                  {profDot(skill.proficiency)}
                </button>

                <!-- Skill button — click to roll -->
                <button
                  class="skill-btn"
                  on:click={() => rollSkill(ab, skill)}
                  title="Roll {skill.name} ({fmtMod(sm)})"
                >
                  <span class="skill-name">{skill.name}</span>
                  <span class="skill-mod" class:positive={sm >= 0}>{fmtMod(sm)}</span>
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <div class="no-skills">No associated skills</div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Reference -->
  <div class="reference">
    <span class="ref-title">Proficiency Bonus by Level</span>
    <div class="ref-grid">
      <span>1–4: +2</span>
      <span>5–8: +3</span>
      <span>9–12: +4</span>
      <span>13–16: +5</span>
      <span>17–20: +6</span>
    </div>
    <div class="ref-legend">
      <span>○ Not proficient</span>
      <span>● Proficient (+PB)</span>
      <span style="color:var(--accent)">◆ Expertise (+PB×2)</span>
    </div>
  </div>
</div>

<style>
  .skills-app {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* ======== TOP BAR ======== */
  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .level-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .level-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .level-input {
    width: 48px;
    text-align: center;
    font-size: 14px;
    font-weight: 700;
    padding: 3px 4px;
  }

  .pb-badge {
    font-size: 12px;
    font-weight: 700;
    color: var(--accent);
    padding: 2px 8px;
    background: rgba(200, 169, 110, 0.1);
    border: 1px solid var(--accent-dim);
    border-radius: var(--radius);
  }

  .top-actions {
    display: flex;
    gap: 4px;
  }

  .sm-btn {
    font-size: 11px;
    padding: 3px 10px;
    color: var(--text-dim);
    background: transparent;
    border: 1px solid var(--border);
    cursor: pointer;
  }

  .sm-btn:hover { color: var(--text); border-color: var(--border-focus); }

  /* ======== ROLL TOAST ======== */
  .roll-toast {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(200, 169, 110, 0.08);
    border: 1px solid var(--accent-dim);
    border-radius: var(--radius);
    animation: toastIn 200ms ease;
  }

  @keyframes toastIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .roll-label {
    font-size: 12px;
    color: var(--text);
    font-weight: 600;
  }

  .roll-d20 {
    font-size: 11px;
    color: var(--text-dim);
  }

  .roll-mod {
    font-size: 11px;
    color: var(--text-dim);
  }

  .roll-eq {
    font-size: 11px;
    color: var(--text-dim);
  }

  .roll-total {
    font-size: 20px;
    font-weight: 700;
    color: var(--accent);
    font-family: var(--font-heading);
    min-width: 28px;
    text-align: center;
  }

  /* ======== ABILITY BLOCKS ======== */
  .ability-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ability-block {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ability-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .ability-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Score display — clickable to roll ability check */
  .score-display {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 700;
    font-family: var(--font-heading);
    color: var(--text-bright);
    background: var(--bg-panel);
    border: 2px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .score-display:hover {
    border-color: var(--accent-dim);
    color: var(--accent);
    box-shadow: 0 0 8px rgba(200, 169, 110, 0.2);
  }

  .score-input {
    width: 40px;
    height: 40px;
    text-align: center;
    font-size: 18px;
    font-weight: 700;
    font-family: var(--font-heading);
    padding: 0;
  }

  .ability-info {
    display: flex;
    flex-direction: column;
  }

  .ability-label {
    font-family: var(--font-heading);
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: 0.5px;
  }

  .ability-mod {
    font-size: 14px;
    font-weight: 700;
    color: var(--accent);
  }

  /* Saving throw row */
  .save-row {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 12px;
    color: var(--text-dim);
    transition: all 150ms ease;
  }

  .save-row:hover {
    border-color: var(--border-focus);
    color: var(--text);
  }

  .save-row.prof {
    border-color: var(--accent-dim);
    background: rgba(200, 169, 110, 0.04);
  }

  .save-dot { font-size: 10px; }

  .save-label { font-size: 11px; }

  .save-mod {
    font-weight: 700;
    color: var(--text);
    font-size: 13px;
  }

  /* ======== SKILLS ======== */
  .skill-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-left: 8px;
    padding-left: 8px;
    border-left: 1px solid var(--border);
  }

  .skill-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .prof-dot {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    background: none;
    border: none;
    padding: 0;
    cursor: default;
    flex-shrink: 0;
    transition: transform 100ms;
  }

  .prof-dot.editable {
    cursor: pointer;
  }

  .prof-dot.editable:hover {
    transform: scale(1.3);
  }

  .skill-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 1;
    padding: 3px 8px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 2px;
    cursor: pointer;
    transition: all 120ms ease;
    min-height: 26px;
  }

  .skill-btn:hover {
    background: rgba(200, 169, 110, 0.06);
    border-color: var(--border);
  }

  .skill-btn:active {
    background: rgba(200, 169, 110, 0.12);
  }

  .skill-name {
    font-size: 12px;
    color: var(--text);
  }

  .skill-mod {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-dim);
    min-width: 24px;
    text-align: right;
  }

  .skill-mod.positive { color: var(--text); }

  .no-skills {
    font-size: 11px;
    color: var(--text-dim);
    opacity: 0.4;
    padding: 2px 0 2px 16px;
    font-style: italic;
  }

  /* ======== REFERENCE ======== */
  .reference {
    padding: 8px 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ref-title {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .ref-grid {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 11px;
    color: var(--text-dim);
  }

  .ref-legend {
    display: flex;
    gap: 12px;
    font-size: 10px;
    color: var(--text-dim);
    margin-top: 2px;
  }
</style>
