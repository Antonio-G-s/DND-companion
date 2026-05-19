<!-- ============================================
     CharacterProfile.svelte — Character Hub

     Multi-character switcher (dropdown).
     Each character has its own data blob.
     Switching writes the selected character's
     data to the fixed dnd-* keys then reloads
     — no sub-app changes required.
     ============================================ -->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import { invoke, isTauri } from "@tauri-apps/api/core";
  import { eventBus } from "../../lib/eventBus";
  import { getEnabledApps } from "../../lib/appRegistry";

  // ============ TYPES ============

  interface CharacterProfile {
    name: string;
    subtitle: string;
    alignment: string;
    species: string;
    classes: string;
    level: number;
    description: string;
    backstory: string;
    profileImage: string;
    partyLogo: string;
    partyName: string;
    tags: string[];
    version: string;
    lastSaved: number;
  }

  interface CharacterSnapshot {
    id: string;
    name: string;
    classes: string;
    species: string;
    level: number;
    lastSaved: number;
    // blobs are stored separately in dnd-char-{id}, NOT in this list
  }

  interface ImportPreview {
    profile: boolean;
    skills: boolean;
    hpTracker: boolean;
    inventory: boolean;
    goldPurse: boolean;
    spellcasting: boolean;
    magicItems: boolean;
    traits: boolean;
    proficiencies: boolean;
    notes: boolean;
    spellList: boolean;
    spellSlots: boolean;
    weaponsCantripsPref: boolean;
  }

  interface ImportSummary {
    characterName: string;
    meta: Record<string, any> | null;
  }

  // ============ CONSTANTS ============

  const ALIGNMENTS = [
    "Lawful Good", "Neutral Good", "Chaotic Good",
    "Lawful Neutral", "True Neutral", "Chaotic Neutral",
    "Lawful Evil", "Neutral Evil", "Chaotic Evil", "Unaligned",
  ];

  const ALL_STORAGE_KEYS = [
    "dnd-profile", "dnd-skills", "dnd-hptracker", "dnd-inventory",
    "dnd-goldpurse", "dnd-spellcasting", "dnd-magicitems", "dnd-traits",
    "dnd-proficiencies", "dnd-notes", "dnd-spelllist", "dnd-spellslots",
    "dnd-weaponscantrips-pref",
  ];

  const STORAGE_MAP: Record<string, string> = {
    "dnd-skills": "skills",
    "dnd-hptracker": "hpTracker",
    "dnd-inventory": "inventory",
    "dnd-goldpurse": "goldPurse",
    "dnd-spellcasting": "spellcasting",
    "dnd-magicitems": "magicItems",
    "dnd-traits": "traits",
    "dnd-proficiencies": "proficiencies",
    "dnd-notes": "notes",
    "dnd-spelllist": "spellList",
    "dnd-spellslots": "spellSlots",
    "dnd-weaponscantrips-pref": "weaponsCantripsPref",
  };

  const SECTION_LABELS: Record<string, string> = {
    profile: "Character Profile",
    skills: "Skills & Abilities",
    hpTracker: "HP Tracker",
    inventory: "Inventory",
    goldPurse: "Gold Purse",
    spellcasting: "Spellcasting",
    magicItems: "Magic Items",
    traits: "Traits & Feats",
    proficiencies: "Proficiencies",
    notes: "Session Notes",
    spellList: "Spell List (legacy)",
    spellSlots: "Spell Slots (legacy)",
    weaponsCantripsPref: "Attacks Preferences",
  };

  // ============ EXAMPLE CHARACTER ============

  const EXAMPLE_CHARACTER = {
    profile: {
      name: "John Smith",
      subtitle: "The Reliable Sword",
      alignment: "Lawful Good",
      species: "Human",
      classes: "Fighter 5",
      level: 5,
      description: "A broad-shouldered human warrior with a weathered face and a calm demeanor. John carries himself with the quiet confidence of someone who has survived more battles than he can count. His armor is dented but well-maintained — much like the man himself.",
      backstory: "Born to a blacksmith father, John learned the value of hard work and honest steel early in life. After his village was raided by bandits, he joined the local militia and discovered a natural talent for combat. He fought in two wars before becoming a mercenary. Now he takes contracts for good causes — and occasionally for good coin.",
      profileImage: "",
      partyLogo: "",
      partyName: "The Iron Wolves",
      tags: [],
      version: "1.0.0",
      lastSaved: Date.now(),
    },
    skills: {
      level: 5,
      abilities: [
        { key: "str", label: "STR", fullName: "Strength", value: 16, saveProficiency: true,
          skills: [{ name: "Athletics", proficiency: "proficient" }] },
        { key: "dex", label: "DEX", fullName: "Dexterity", value: 14, saveProficiency: false,
          skills: [{ name: "Acrobatics", proficiency: "none" }, { name: "Sleight of Hand", proficiency: "none" }, { name: "Stealth", proficiency: "none" }] },
        { key: "con", label: "CON", fullName: "Constitution", value: 14, saveProficiency: true, skills: [] },
        { key: "int", label: "INT", fullName: "Intelligence", value: 10, saveProficiency: false,
          skills: [{ name: "Arcana", proficiency: "none" }, { name: "History", proficiency: "proficient" }, { name: "Investigation", proficiency: "none" }, { name: "Nature", proficiency: "none" }, { name: "Religion", proficiency: "none" }] },
        { key: "wis", label: "WIS", fullName: "Wisdom", value: 12, saveProficiency: false,
          skills: [{ name: "Animal Handling", proficiency: "none" }, { name: "Insight", proficiency: "proficient" }, { name: "Medicine", proficiency: "none" }, { name: "Perception", proficiency: "proficient" }, { name: "Survival", proficiency: "none" }] },
        { key: "cha", label: "CHA", fullName: "Charisma", value: 8, saveProficiency: false,
          skills: [{ name: "Deception", proficiency: "none" }, { name: "Intimidation", proficiency: "none" }, { name: "Performance", proficiency: "none" }, { name: "Persuasion", proficiency: "none" }] },
      ],
    },
    hpTracker: { maxHp: 44, currentHp: 44, tempHp: 0, acEffects: [{ name: "Chain Mail", value: 16 }, { name: "Shield", value: 2 }] },
    inventory: {
      items: [
        { name: "Longsword", category: "equipment", equipmentType: "weapon", description: "Versatile martial weapon.", weight: 3, valueGP: 15, quantity: 1, attuned: false, linkedMagicItem: "", weapon: { attackAbility: "str", damageDice: "1d8", damageType: "Slashing", properties: "Versatile (1d10)", magicBonus: 0, range: "5 ft" } },
        { name: "Handaxe", category: "equipment", equipmentType: "weapon", description: "Light, thrown weapon.", weight: 2, valueGP: 5, quantity: 2, attuned: false, linkedMagicItem: "", weapon: { attackAbility: "str", damageDice: "1d6", damageType: "Slashing", properties: "Light, Thrown (20/60)", magicBonus: 0, range: "20/60 ft" } },
        { name: "Chain Mail", category: "equipment", equipmentType: "armor", description: "Heavy armor. AC 16.", weight: 55, valueGP: 75, quantity: 1, attuned: false, linkedMagicItem: "", weapon: null },
        { name: "Shield", category: "equipment", equipmentType: "general", description: "+2 AC while wielded.", weight: 6, valueGP: 10, quantity: 1, attuned: false, linkedMagicItem: "", weapon: null },
        { name: "Healing Potion", category: "items", equipmentType: "general", description: "Regain 2d4+2 HP.", weight: 0.5, valueGP: 50, quantity: 3, attuned: false, linkedMagicItem: "", weapon: null },
        { name: "Rations (1 day)", category: "items", equipmentType: "general", description: "Dry food for travel.", weight: 2, valueGP: 0.5, quantity: 5, attuned: false, linkedMagicItem: "", weapon: null },
        { name: "Rope, Hempen (50 ft)", category: "items", equipmentType: "general", description: "50 feet of hempen rope.", weight: 10, valueGP: 1, quantity: 1, attuned: false, linkedMagicItem: "", weapon: null },
        { name: "Tinderbox", category: "items", equipmentType: "general", description: "Flint, fire steel, tinder.", weight: 1, valueGP: 0.5, quantity: 1, attuned: false, linkedMagicItem: "", weapon: null },
        { name: "Torch", category: "items", equipmentType: "general", description: "Bright light 20 ft. Burns 1 hour.", weight: 1, valueGP: 0.01, quantity: 5, attuned: false, linkedMagicItem: "", weapon: null },
      ],
      maxAttunement: 3,
    },
    goldPurse: { purse: { pp: 0, gp: 75, ep: 0, sp: 30, cp: 50 }, transactions: [] },
    traits: [
      { id: "ex1", category: "classFeature", title: "Second Wind", description: "Bonus action: regain 1d10 + Fighter level HP.", source: "Fighter 1", levelObtained: 1, uses: { max: 1, current: 1, recharge: "Short Rest" }, linkedSkills: [], linkedSpells: [], passive: false },
      { id: "ex2", category: "classFeature", title: "Action Surge", description: "Take one additional action on your turn.", source: "Fighter 2", levelObtained: 2, uses: { max: 1, current: 1, recharge: "Short Rest" }, linkedSkills: [], linkedSpells: [], passive: false },
      { id: "ex3", category: "classFeature", title: "Battle Master", description: "Gain combat maneuvers using Superiority Dice.", source: "Fighter 3", levelObtained: 3, uses: { max: 0, current: 0, recharge: "" }, linkedSkills: [], linkedSpells: [], passive: true },
      { id: "ex4", category: "classFeature", title: "Superiority Dice (4d8)", description: "Spend to fuel Battle Master maneuvers. Regain all on short or long rest.", source: "Fighter 3", levelObtained: 3, uses: { max: 4, current: 4, recharge: "Short Rest" }, linkedSkills: [], linkedSpells: [], passive: false },
      { id: "ex5", category: "classFeature", title: "Extra Attack", description: "Attack twice whenever you take the Attack action.", source: "Fighter 5", levelObtained: 5, uses: { max: 0, current: 0, recharge: "" }, linkedSkills: [], linkedSpells: [], passive: true },
      { id: "ex6", category: "speciesTrait", title: "Human Versatility", description: "Proficiency in one extra skill and a feat at 1st level.", source: "Human", levelObtained: 0, uses: { max: 0, current: 0, recharge: "" }, linkedSkills: [], linkedSpells: [], passive: true },
      { id: "ex7", category: "feat", title: "Alert", description: "+5 to initiative. Cannot be surprised while conscious.", source: "Feat (Level 4)", levelObtained: 4, uses: { max: 0, current: 0, recharge: "" }, linkedSkills: [], linkedSpells: [], passive: true },
    ],
    proficiencies: {
      languages: ["Common", "Dwarvish"],
      tools: ["Smith's Tools"],
      armor: ["Light Armor", "Medium Armor", "Heavy Armor", "Shields"],
      weapons: ["Simple Weapons", "Martial Weapons"],
    },
    notes: [] as any[],
  };

  // ============ CHARACTER LIST HELPERS ============
  // dnd-characters = slim metadata only [{id,name,classes,species,level,lastSaved}]
  // dnd-char-{id}  = full blob data   {blobs: Record<string,string>}

  function genId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function loadCharacterBlobs(id: string): Record<string, string> {
    try {
      const raw = window.localStorage.getItem(`dnd-char-${id}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  }

  function saveCharacterBlobs(id: string, blobs: Record<string, string>): boolean {
    try {
      window.localStorage.setItem(`dnd-char-${id}`, JSON.stringify(blobs));
      return true;
    } catch (e: any) {
      log('saveCharacterBlobs FAILED for', id, ':', e?.message);
      return false;
    }
  }

  function deleteCharacterBlobs(id: string) {
    window.localStorage.removeItem(`dnd-char-${id}`);
  }

  function loadCharacterList(): CharacterSnapshot[] {
    try {
      const raw = window.localStorage.getItem("dnd-characters");
      if (!raw) return [];
      const list = JSON.parse(raw) as Array<CharacterSnapshot & { blobs?: Record<string, string> }>;
      // Migration: old format stored blobs inside the list entry — extract them
      let needsSave = false;
      for (const char of list) {
        if (char.blobs && Object.keys(char.blobs).length > 0) {
          log('migrating blobs for', char.id, char.name);
          saveCharacterBlobs(char.id, char.blobs);
          delete char.blobs;
          needsSave = true;
        }
      }
      const slim = list.map(({ id, name, classes, species, level, lastSaved }) => ({ id, name, classes, species, level, lastSaved }));
      if (needsSave) {
        log('saving migrated slim list');
        window.localStorage.setItem("dnd-characters", JSON.stringify(slim));
      }
      return slim;
    } catch {}
    return [];
  }

  function saveCharacterList(list: CharacterSnapshot[]) {
    // Strip any accidental blob data — keep it tiny
    const slim = list.map(({ id, name, classes, species, level, lastSaved }) => ({ id, name, classes, species, level, lastSaved }));
    window.localStorage.setItem("dnd-characters", JSON.stringify(slim));
  }

  function getActiveId(): string {
    return window.localStorage.getItem("dnd-active-character-id") ?? "";
  }

  function setActiveId(id: string) {
    window.localStorage.setItem("dnd-active-character-id", id);
  }

  function snapshotBlobs(): Record<string, string> {
    const blobs: Record<string, string> = {};
    for (const key of ALL_STORAGE_KEYS) {
      const val = window.localStorage.getItem(key);
      if (val !== null) blobs[key] = val;
    }
    return blobs;
  }

  function writeBlobs(blobs: Record<string, string>) {
    for (const key of ALL_STORAGE_KEYS) window.localStorage.removeItem(key);
    for (const [key, val] of Object.entries(blobs)) {
      try { window.localStorage.setItem(key, val); } catch (e: any) { log('writeBlobs failed for', key, ':', e?.message); }
    }
  }

  function writeBlobsStrict(blobs: Record<string, string>, restoreBlobs: Record<string, string>): string[] {
    const failedKeys: string[] = [];
    for (const key of ALL_STORAGE_KEYS) window.localStorage.removeItem(key);

    for (const [key, val] of Object.entries(blobs)) {
      try {
        window.localStorage.setItem(key, val);
        log('  wrote', key, 'OK');
      } catch (storageErr: any) {
        log('  FAILED to write', key, ':', storageErr?.message);
        failedKeys.push(key);
      }
    }

    if (failedKeys.length > 0) {
      log('restoring previous active character data after failed import');
      writeBlobs(restoreBlobs);
    }

    return failedKeys;
  }

  function slotInfoFromBlobs(blobs: Record<string, string>): { name: string; classes: string; species: string; level: number } {
    try {
      const p = JSON.parse(blobs["dnd-profile"] ?? "{}");
      return { name: p.name || "New Character", classes: p.classes || "", species: p.species || "", level: p.level || 1 };
    } catch {
      return { name: "New Character", classes: "", species: "", level: 1 };
    }
  }

  function initCharacterSystem(): { list: CharacterSnapshot[]; activeId: string } {
    log('initCharacterSystem start');
    let list = loadCharacterList(); // migration runs here if needed
    let activeId = getActiveId();
    log('loaded list:', list.length, 'chars, activeId:', activeId);

    if (list.length === 0) {
      log('no chars found — wrapping existing data into slot 1');
      const id = genId();
      const blobs = snapshotBlobs();
      const info = slotInfoFromBlobs(blobs);
      log('slot info:', info, 'blob keys:', Object.keys(blobs));
      const slot: CharacterSnapshot = { id, ...info, lastSaved: Date.now() };
      list = [slot];
      saveCharacterBlobs(id, blobs);
      saveCharacterList(list);
      setActiveId(id);
      return { list, activeId: id };
    }

    if (!activeId || !list.find(c => c.id === activeId)) {
      log('activeId missing/invalid, defaulting to', list[0].id);
      activeId = list[0].id;
      setActiveId(activeId);
    }

    log('initCharacterSystem done, active:', activeId);
    return { list, activeId };
  }

  // ============ LOGGING ============

  function log(...args: any[]) {
    const ts = new Date().toISOString().substr(11, 12);
    console.log(`[CharProfile ${ts}]`, ...args);
    importLog = [...importLog.slice(-49), `[${ts}] ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')];
  }

  // ============ STATE ============

  // Bound to hidden <input type="file"> for image uploads only
  let imageFileInputEl!: HTMLInputElement;
  let imageInputTarget: "profile" | "party" = "profile";

  let profile: CharacterProfile = blankProfile();
  let editMode = false;
  let characterList: CharacterSnapshot[] = [];
  let activeCharacterId = "";
  let selectedCharId = "";

  // Import state
  let showImport = false;
  let importBlobs: Record<string, string> | null = null;
  let importSummary: ImportSummary | null = null;
  let importPreview: ImportPreview | null = null;
  let importMode: "new" | "replace" = "new";
  let importError = "";
  let importFileName = "";
  let importStatus = "";
  let importText = "";
  let importPath = "";
  let importLog: string[] = [];
  let showImportLog = false;
  let importBusy = false;
  let dragActive = false;

  // UI feedback / confirmations
  let exportStatus = "";
  let showDeleteConfirm = false;

  // Export dialog state
  let showExport = false;
  let exportSelections: Record<string, boolean> = {};

  // Quick stats from sub-apps
  let charLevel = 0;
  let charHp = "";
  let charAc = 0;

  onMount(() => {
    const { list, activeId } = initCharacterSystem();
    characterList = list;
    activeCharacterId = activeId;
    selectedCharId = activeId;
    loadProfile();
    loadQuickStats();
  });

  function blankProfile(): CharacterProfile {
    return {
      name: "New Character",
      subtitle: "",
      alignment: "True Neutral",
      species: "",
      classes: "",
      level: 1,
      description: "",
      backstory: "",
      profileImage: "",
      partyLogo: "",
      partyName: "",
      tags: [],
      version: "1.0.0",
      lastSaved: Date.now(),
    };
  }

  // ============ SAVE / LOAD ============

  function saveProfile() {
    profile.lastSaved = Date.now();
    try {
      window.localStorage.setItem("dnd-profile", JSON.stringify(profile));
      updateCurrentSlotMeta();
    } catch {}
  }

  function updateCurrentSlotMeta() {
    const list = loadCharacterList();
    const idx = list.findIndex(c => c.id === activeCharacterId);
    if (idx >= 0) {
      list[idx].name = profile.name || list[idx].name;
      list[idx].classes = profile.classes || list[idx].classes;
      list[idx].species = profile.species || list[idx].species;
      list[idx].level = profile.level || list[idx].level;
      list[idx].lastSaved = Date.now();
      saveCharacterList(list);
      characterList = list;
    }
  }

  function loadProfile() {
    try {
      const raw = window.localStorage.getItem("dnd-profile");
      if (raw) { profile = { ...blankProfile(), ...JSON.parse(raw) }; return; }
    } catch {}
    try {
      const sk = window.localStorage.getItem("dnd-skills");
      if (sk) profile.level = JSON.parse(sk).level || 1;
    } catch {}
  }

  function loadQuickStats() {
    try {
      const sk = window.localStorage.getItem("dnd-skills");
      if (sk) charLevel = JSON.parse(sk).level || 0;
    } catch {}
    try {
      const hp = window.localStorage.getItem("dnd-hptracker");
      if (hp) {
        const d = JSON.parse(hp);
        charHp = `${d.currentHp}/${d.maxHp}`;
        charAc = (d.acEffects || []).reduce((s: number, e: any) => s + (e.value || 0), 0);
      }
    } catch {}
  }

  function autoSave() { saveProfile(); }

  // ============ CHARACTER SWITCHING ============

  function switchToCharacter(targetId: string) {
    if (targetId === activeCharacterId) { log('switchToCharacter: same id, no-op'); return; }
    log('switchToCharacter:', activeCharacterId, '→', targetId);

    // Snapshot current character into its own key
    const currentBlobs = snapshotBlobs();
    const info = slotInfoFromBlobs(currentBlobs);
    log('snapshotted current, blob keys:', Object.keys(currentBlobs));
    saveCharacterBlobs(activeCharacterId, currentBlobs);

    let list = loadCharacterList();
    const currentIdx = list.findIndex(c => c.id === activeCharacterId);
    if (currentIdx >= 0) list[currentIdx] = { ...list[currentIdx], ...info, lastSaved: Date.now() };

    const target = list.find(c => c.id === targetId);
    if (!target) { log('target slot not found!'); selectedCharId = activeCharacterId; return; }

    const targetBlobs = loadCharacterBlobs(targetId);
    log('target slot:', target.name, 'blob keys:', Object.keys(targetBlobs));
    writeBlobs(targetBlobs);
    saveCharacterList(list);
    setActiveId(targetId);
    log('reloading...');
    window.location.reload();
  }

  function createNewCharacter() {
    // Snapshot current before leaving
    const currentBlobs = snapshotBlobs();
    const info = slotInfoFromBlobs(currentBlobs);
    saveCharacterBlobs(activeCharacterId, currentBlobs);

    let list = loadCharacterList();
    const currentIdx = list.findIndex(c => c.id === activeCharacterId);
    if (currentIdx >= 0) list[currentIdx] = { ...list[currentIdx], ...info, lastSaved: Date.now() };

    const id = genId();
    list.push({ id, name: "New Character", classes: "", species: "", level: 1, lastSaved: Date.now() });
    saveCharacterBlobs(id, {}); // empty blobs — sub-apps use their own defaults

    for (const key of ALL_STORAGE_KEYS) window.localStorage.removeItem(key);
    saveCharacterList(list);
    setActiveId(id);
    window.location.reload();
  }

  function deleteCurrentCharacter() {
    let list = loadCharacterList();
    const remaining = list.filter(c => c.id !== activeCharacterId);
    deleteCharacterBlobs(activeCharacterId);

    if (remaining.length === 0) {
      for (const key of ALL_STORAGE_KEYS) window.localStorage.removeItem(key);
      window.localStorage.removeItem("dnd-characters");
      window.localStorage.removeItem("dnd-active-character-id");
    } else {
      const next = remaining[0];
      const nextBlobs = loadCharacterBlobs(next.id);
      writeBlobs(nextBlobs);
      saveCharacterList(remaining);
      setActiveId(next.id);
    }

    window.location.reload();
  }

  // ============ IMAGE HANDLING ============

  function uploadImage(target: "profile" | "party") {
    imageInputTarget = target;
    imageFileInputEl.value = "";
    imageFileInputEl.click();
  }

  function handleImageFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { alert("Image too large (max 3MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (imageInputTarget === "profile") profile.profileImage = reader.result as string;
      else profile.partyLogo = reader.result as string;
      profile = profile; saveProfile();
    };
    reader.readAsDataURL(file);
  }

  function removeImage(target: "profile" | "party") {
    if (target === "profile") profile.profileImage = "";
    else profile.partyLogo = "";
    profile = profile; saveProfile();
  }

  // ============ EXPORT ============

  function openExportDialog() {
    exportSelections = {};
    for (const fieldName of Object.values(STORAGE_MAP)) {
      exportSelections[fieldName] = true;
    }
    showExport = true;
  }

  function confirmExport() {
    const exportObj: Record<string, any> = {
      _meta: {
        version: "1.0.0",
        exportDate: new Date().toISOString(),
        appName: "D&D Companion",
        characterName: profile.name,
      },
      profile: profile,
    };

    for (const [storageKey, fieldName] of Object.entries(STORAGE_MAP)) {
      if (!exportSelections[fieldName]) continue;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) exportObj[fieldName] = JSON.parse(raw);
      } catch {}
    }

    const json = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = profile.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    a.href = url;
    a.download = `${safeName}_character.json`;
    a.style.cssText = "position:fixed;top:-9999px;left:-9999px;";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showExport = false;
    exportStatus = "Exported!";
    setTimeout(() => { exportStatus = ""; }, 2000);
  }

  function cancelExport() {
    showExport = false;
  }

  // ============ IMPORT ============

  function openImportDialog() {
    importLog = [];
    log('openImportDialog: showing import dialog');
    importError = "";
    importStatus = "";
    importBlobs = null;
    importSummary = null;
    importPreview = null;
    importBusy = false;
    importText = "";
    importPath = "";
    dragActive = false;
    importFileName = "";
    showImport = true;
  }

  async function processFile(file: File) {
    importLog = [];
    log('processFile:', file.name, 'size:', file.size, 'bytes (~', Math.round(file.size / 1024), 'KB)');
    importFileName = file.name;
    importError = "";
    importStatus = "Reading file...";
    importPreview = null;
    importBlobs = null;
    importSummary = null;
    importBusy = false;
    showImport = true;
    try {
      log('reading file text...');
      const text = await file.text();
      log('read done, length:', text.length, '(~', Math.round(text.length / 1024), 'KB)');
      processImportText(text, file.name);
    } catch (e: any) {
      log('unexpected error:', e?.message, e);
      importError = `Unexpected error: ${e?.message || String(e)}`;
      importStatus = "";
    }
  }

  function triggerFileChooser() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;";
    document.body.appendChild(input);
    input.addEventListener("change", async () => {
      if (document.body.contains(input)) document.body.removeChild(input);
      const file = input.files?.[0];
      if (file) await processFile(file);
    });
    input.click();
  }

  // Moves the overlay node to document.body so position:fixed works correctly
  // even when the component is rendered inside a CSS-transformed canvas.
  function bodyPortal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() {} };
  }

  function processImportText(text: string, sourceName: string) {
    importFileName = sourceName;
    importError = "";
    importStatus = "Parsing JSON...";
    importPreview = null;
    importBlobs = null;
    importSummary = null;
    importBusy = false;

    let data: Record<string, any>;
    try {
      data = JSON.parse(text);
    } catch (parseErr: any) {
      log('JSON.parse failed:', parseErr?.message);
      importError = `Invalid JSON: ${parseErr?.message || 'parse error'}`;
      importStatus = "";
      return;
    }

    log('parsed OK. keys:', Object.keys(data));
    log('  profile?', !!data.profile, 'character?', !!data.character, 'skills?', !!data.skills, 'hpTracker?', !!data.hpTracker);
    log('  inventory?', !!data.inventory, 'spellcasting?', !!data.spellcasting, 'magicItems?', !!data.magicItems);
    log('  traits?', !!data.traits, 'proficiencies?', !!data.proficiencies, 'notes?', !!data.notes);
    log('  spellList?', !!data.spellList, 'spellSlots?', !!data.spellSlots, 'weaponsCantripsPref?', !!data.weaponsCantripsPref);

    importStatus = "Analyzing data...";
    validateImport(data);
  }

  function importFromText() {
    importLog = [];
    log('importFromText called');
    const text = importText.trim();
    if (!text) {
      importError = "Paste exported character JSON first.";
      return;
    }
    showImport = true;
    processImportText(text, "Pasted JSON");
  }

  async function importFromPath() {
    importLog = [];
    log('importFromPath called');
    const path = importPath.trim();
    if (!path) {
      importError = "Enter a JSON file path first.";
      return;
    }
    if (!isTauri()) {
      importError = "Path import is only available in the desktop app. Use Choose File or Paste JSON in the browser.";
      return;
    }

    showImport = true;
    importError = "";
    importStatus = "Reading file path...";
    importPreview = null;
    importBlobs = null;
    importSummary = null;
    importBusy = false;

    try {
      const text = await invoke<string>("load_config", { path });
      log('path read done, length:', text.length, '(~', Math.round(text.length / 1024), 'KB)');
      processImportText(text, path.split(/[\\/]/).pop() || path);
    } catch (e: any) {
      log('path import failed:', e?.message || e);
      importError = `Could not read that file: ${e?.message || String(e)}`;
      importStatus = "";
    }
  }

  async function handleImportDrop(e: DragEvent) {
    e.preventDefault();
    dragActive = false;
    const file = e.dataTransfer?.files?.[0];
    if (!file) { importError = "No file was dropped."; return; }
    await processFile(file);
  }

  function validateImport(data: Record<string, any>) {
    log('validateImport called');
    const normalized = normalizeImportData(data);
    importBlobs = normalized.blobs;
    importSummary = normalized.summary;

    const foundCount = Object.values(normalized.preview).filter(v => v).length;
    log('preview built, found', foundCount, 'sections');

    if (foundCount === 0) {
      log('no recognised sections found');
      importError = "No recognized character data found in this file.";
      importPreview = null;
      importSummary = null;
      importStatus = "";
      return;
    }

    importPreview = normalized.preview;
    importStatus = "";
    // showImport is already true
    log('validateImport done');
  }

  function normalizeImportData(data: Record<string, any>): { blobs: Record<string, string>; preview: ImportPreview; summary: ImportSummary } {
    const blobs: Record<string, string> = {};

    const directBlobs = readBlobContainer(data);
    for (const [storageKey, value] of Object.entries(directBlobs)) {
      if (ALL_STORAGE_KEYS.includes(storageKey)) {
        const encoded = encodeStorageValue(value);
        if (encoded !== null) blobs[storageKey] = encoded;
      }
    }

    const profileData = normalizeImportedProfile(data);
    if (profileData && blobs["dnd-profile"] === undefined) {
      blobs["dnd-profile"] = JSON.stringify(profileData);
    }

    for (const [storageKey, fieldName] of Object.entries(STORAGE_MAP)) {
      if (blobs[storageKey] !== undefined) continue;
      const value = pickImportSection(data, fieldName, storageKey);
      const encoded = encodeStorageValue(value);
      if (encoded !== null) blobs[storageKey] = encoded;
    }

    const preview: ImportPreview = {
      profile: blobs["dnd-profile"] !== undefined,
      skills: blobs["dnd-skills"] !== undefined,
      hpTracker: blobs["dnd-hptracker"] !== undefined,
      inventory: blobs["dnd-inventory"] !== undefined,
      goldPurse: blobs["dnd-goldpurse"] !== undefined,
      spellcasting: blobs["dnd-spellcasting"] !== undefined,
      magicItems: blobs["dnd-magicitems"] !== undefined,
      traits: blobs["dnd-traits"] !== undefined,
      proficiencies: blobs["dnd-proficiencies"] !== undefined,
      notes: blobs["dnd-notes"] !== undefined,
      spellList: blobs["dnd-spelllist"] !== undefined,
      spellSlots: blobs["dnd-spellslots"] !== undefined,
      weaponsCantripsPref: blobs["dnd-weaponscantrips-pref"] !== undefined,
    };

    const info = slotInfoFromBlobs(blobs);
    return {
      blobs,
      preview,
      summary: {
        characterName: info.name,
        meta: data._meta && typeof data._meta === "object" ? data._meta : null,
      },
    };
  }

  function readBlobContainer(data: Record<string, any>): Record<string, any> {
    if (data.blobs && typeof data.blobs === "object") return data.blobs;
    if (data.storage && typeof data.storage === "object") return data.storage;
    if (data.localStorage && typeof data.localStorage === "object") return data.localStorage;
    return data;
  }

  function pickImportSection(data: Record<string, any>, fieldName: string, storageKey: string): unknown {
    if (data[fieldName] !== undefined) return data[fieldName];
    if (data[storageKey] !== undefined) return data[storageKey];
    if (data.character && typeof data.character === "object" && data.character[fieldName] !== undefined) {
      return data.character[fieldName];
    }
    return undefined;
  }

  function encodeStorageValue(value: unknown): string | null {
    if (value === undefined) return null;
    if (typeof value === "string") {
      try {
        JSON.parse(value);
        return value;
      } catch {
        return JSON.stringify(value);
      }
    }
    return JSON.stringify(value);
  }

  function normalizeImportedProfile(data: Record<string, any>): CharacterProfile | null {
    const rawProfile = data.profile ?? data["dnd-profile"];
    const parsedProfile = parseMaybeJson(rawProfile);
    if (parsedProfile && typeof parsedProfile === "object") {
      return { ...blankProfile(), ...(parsedProfile as Record<string, any>), lastSaved: Date.now() };
    }

    const character = data.character;
    if (!character || typeof character !== "object") return null;

    return {
      ...blankProfile(),
      name: stringValue(character.name, character.characterName, character.fullName) || "New Character",
      subtitle: stringValue(character.subtitle, character.title, character.background) || "",
      alignment: stringValue(character.alignment) || "True Neutral",
      species: stringValue(character.species, character.race, character.ancestry) || "",
      classes: stringValue(character.classes, character.class, character.className) || "",
      level: numberValue(character.level, character.totalLevel) || 1,
      description: stringValue(character.description, character.appearance) || "",
      backstory: stringValue(character.backstory, character.history, character.biography) || "",
      profileImage: stringValue(character.profileImage, character.image, character.portrait) || "",
      partyLogo: stringValue(character.partyLogo) || "",
      partyName: stringValue(character.partyName, character.party) || "",
      tags: Array.isArray(character.tags) ? character.tags.map(String) : [],
      version: stringValue(character.version) || "1.0.0",
      lastSaved: Date.now(),
    };
  }

  function parseMaybeJson(value: unknown): unknown {
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return null; }
  }

  function stringValue(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value;
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
    return "";
  }

  function numberValue(...values: unknown[]): number {
    for (const value of values) {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
    }
    return 0;
  }

  async function confirmImport() {
    log('confirmImport called, mode:', importMode);
    if (importBusy) return;
    if (!importBlobs || !importPreview) {
      log('ERROR: importBlobs or importPreview is null');
      return;
    }
    if (Object.keys(importBlobs).length === 0) {
      importError = "No recognized character data is ready to import.";
      log('ERROR: importBlobs is empty');
      return;
    }

    importBusy = true;
    importError = "";
    importStatus = "Importing character...";
    await tick();

    const importedBlobs = importBlobs;
    log('total blobs to write:', Object.keys(importedBlobs).length);
    for (const [key, val] of Object.entries(importedBlobs)) {
      log('  ', key, ':', Math.round(val.length / 1024), 'KB');
    }

    const info = slotInfoFromBlobs(importedBlobs);
    log('character info from blobs:', info);

    let list = loadCharacterList();
    const previousActiveBlobs = snapshotBlobs();

    // Snapshot current character to its own key before any change
    const currentIdx = list.findIndex(c => c.id === activeCharacterId);
    if (currentIdx >= 0) {
      log('snapshotting current character slot', currentIdx);
      const currentInfo = slotInfoFromBlobs(previousActiveBlobs);
      if (!saveCharacterBlobs(activeCharacterId, previousActiveBlobs)) {
        importError = "Could not save the current character before importing. Storage may be full.";
        importStatus = "";
        importBusy = false;
        return;
      }
      list[currentIdx] = { ...list[currentIdx], ...currentInfo, lastSaved: Date.now() };
    }

    const targetId = importMode === "new" ? genId() : activeCharacterId;
    if (!targetId) {
      importError = "No active character slot is available to replace.";
      importStatus = "";
      importBusy = false;
      return;
    }

    log('saving imported character slot...');
    if (!saveCharacterBlobs(targetId, importedBlobs)) {
      const msg = "Could not save the imported character. Storage may be full, usually because embedded images are very large.";
      log('IMPORT FAIL:', msg);
      importError = msg;
      importStatus = "";
      importBusy = false;
      return;
    }

    if (importMode === "new") {
      list.push({ id: targetId, ...info, lastSaved: Date.now() });
      log('new slot created, id:', targetId);
    } else {
      if (currentIdx >= 0) list[currentIdx] = { ...list[currentIdx], ...info, lastSaved: Date.now() };
      log('replaced current slot');
    }

    // Replace active localStorage keys. Missing sections are cleared so old data does not linger.
    log('writing imported blobs to active keys...');
    const failedKeys = writeBlobsStrict(importedBlobs, previousActiveBlobs);

    if (failedKeys.length > 0) {
      const msg = `Storage full writing: ${failedKeys.join(', ')}. Try removing the profile image first — base64 images can be very large.`;
      log('IMPORT FAIL:', msg);
      importError = msg;
      importStatus = "";
      importBusy = false;
      return;
    }

    try {
      saveCharacterList(list);
      setActiveId(targetId);
      characterList = list;
      activeCharacterId = targetId;
      selectedCharId = targetId;
    } catch (e: any) {
      log('IMPORT FAIL: character list save failed:', e?.message);
      importError = `Could not update the character list: ${e?.message || String(e)}`;
      importStatus = "";
      importBusy = false;
      return;
    }

    showImport = false;
    importBlobs = null;
    importSummary = null;
    importPreview = null;
    importStatus = "";
    importText = "";
    importPath = "";
    dragActive = false;
    importBusy = false;
    loadProfile();
    loadQuickStats();
    log('confirmImport done');
    exportStatus = "Imported!";
    setTimeout(() => { exportStatus = ""; }, 2000);
  }

  function cancelImport() {
    log('import cancelled');
    showImport = false;
    importBlobs = null;
    importSummary = null;
    importPreview = null;
    importError = "";
    importStatus = "";
    importText = "";
    importPath = "";
    importBusy = false;
    dragActive = false;
  }

  // ============ LOAD EXAMPLE ============

  function loadExampleCharacter() {
    const ex = EXAMPLE_CHARACTER;
    const blobs: Record<string, string> = {
      "dnd-profile": JSON.stringify(ex.profile),
      "dnd-skills": JSON.stringify(ex.skills),
      "dnd-hptracker": JSON.stringify(ex.hpTracker),
      "dnd-inventory": JSON.stringify(ex.inventory),
      "dnd-goldpurse": JSON.stringify(ex.goldPurse),
      "dnd-traits": JSON.stringify(ex.traits),
      "dnd-proficiencies": JSON.stringify(ex.proficiencies),
      "dnd-notes": JSON.stringify(ex.notes),
    };

    let list = loadCharacterList();

    // Snapshot current first
    const currentBlobs = snapshotBlobs();
    const currentInfo = slotInfoFromBlobs(currentBlobs);
    saveCharacterBlobs(activeCharacterId, currentBlobs);
    const currentIdx = list.findIndex(c => c.id === activeCharacterId);
    if (currentIdx >= 0) list[currentIdx] = { ...list[currentIdx], ...currentInfo, lastSaved: Date.now() };

    const id = genId();
    saveCharacterBlobs(id, blobs);
    list.push({ id, name: ex.profile.name, classes: ex.profile.classes, species: ex.profile.species, level: ex.profile.level, lastSaved: Date.now() });
    writeBlobs(blobs);
    saveCharacterList(list);
    setActiveId(id);
    window.location.reload();
  }

  // ============ APP LAUNCHING ============

  function openApp(appId: string) {
    eventBus.send({ target: "*", source: "characterProfile", action: "openApp", appId });
  }

  $: appLinks = getEnabledApps().filter(a => a.id !== "characterProfile");

  const APP_ICONS: Record<string, string> = {
    diceRoller: "🎲", spellList: "📖", spellSlots: "✦", magicItems: "✦",
    inventory: "🎒", goldPurse: "💰", notes: "📝", skills: "📊",
    hpTracker: "❤", traits: "⚔", proficiencies: "🛡", weaponsCantrips: "🗡",
    spellcasting: "🔮",
  };

  $: currentSlot = characterList.find(c => c.id === activeCharacterId);
</script>

<div class="profile-app">

  <!-- Hidden input for image uploads only -->
  <input type="file" accept="image/*" bind:this={imageFileInputEl}
         on:change={handleImageFileChange}
         style="position:absolute;opacity:0;pointer-events:none;width:0;height:0;overflow:hidden" />

  <!-- ======== CHARACTER SWITCHER ======== -->
  {#if characterList.length > 0}
    <div class="char-switcher">
      <div class="cs-left">
        <span class="cs-label">Character</span>
        <select
          class="cs-select"
          bind:value={selectedCharId}
          on:change={() => switchToCharacter(selectedCharId)}
        >
          {#each characterList as char}
            <option value={char.id}>
              {char.name}{char.classes ? ` — ${char.classes}` : ""}
            </option>
          {/each}
        </select>
      </div>
      <div class="cs-right">
        <button class="cs-btn" title="New character" on:click={createNewCharacter}>+ New</button>
        {#if showDeleteConfirm}
          <div class="cs-delete-confirm">
            <span>Delete "{currentSlot?.name}"?</span>
            <button class="cs-btn danger" on:click={deleteCurrentCharacter}>Delete</button>
            <button class="cs-btn" on:click={() => showDeleteConfirm = false}>Cancel</button>
          </div>
        {:else}
          <button class="cs-btn danger-soft" title="Delete this character" on:click={() => showDeleteConfirm = true}>✕</button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- ======== PROFILE CARD ======== -->
  <div class="profile-card">
    <!-- Party logo (top-right) -->
    {#if profile.partyLogo || editMode}
      <div class="party-section">
        {#if profile.partyLogo}
          <img src={profile.partyLogo} alt="Party" class="party-logo" />
        {/if}
        {#if editMode}
          <div class="img-actions small">
            <button class="img-btn" on:click={() => uploadImage("party")}>
              {profile.partyLogo ? "Change" : "Add Logo"}
            </button>
            {#if profile.partyLogo}
              <button class="img-btn danger" on:click={() => removeImage("party")}>✕</button>
            {/if}
          </div>
        {/if}
        {#if editMode}
          <input type="text" bind:value={profile.partyName} on:change={autoSave}
                 placeholder="Party name" class="party-name-input" />
        {:else if profile.partyName}
          <span class="party-name">{profile.partyName}</span>
        {/if}
      </div>
    {/if}

    <!-- Profile image -->
    <div class="portrait-area">
      {#if profile.profileImage}
        <img src={profile.profileImage} alt={profile.name} class="portrait" />
      {:else}
        <div class="portrait-placeholder">
          <span class="portrait-initial">{profile.name.charAt(0).toUpperCase()}</span>
        </div>
      {/if}
      {#if editMode}
        <div class="img-actions">
          <button class="img-btn" on:click={() => uploadImage("profile")}>
            {profile.profileImage ? "Change" : "Upload"}
          </button>
          {#if profile.profileImage}
            <button class="img-btn danger" on:click={() => removeImage("profile")}>Remove</button>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Name & subtitle -->
    {#if editMode}
      <input type="text" bind:value={profile.name} on:change={autoSave}
             class="name-input" placeholder="Character Name" />
      <input type="text" bind:value={profile.subtitle} on:change={autoSave}
             class="subtitle-input" placeholder="Title, nickname, or tagline" />
    {:else}
      <h1 class="char-name">{profile.name}</h1>
      {#if profile.subtitle}
        <p class="char-subtitle">{profile.subtitle}</p>
      {/if}
    {/if}

    <!-- Quick stats row -->
    <div class="quick-stats">
      {#if charLevel}
        <span class="qs">Lvl {charLevel}</span>
      {/if}
      {#if charHp}
        <span class="qs hp">❤ {charHp}</span>
      {/if}
      {#if charAc}
        <span class="qs ac">🛡 {charAc}</span>
      {/if}
    </div>

    <!-- Core info -->
    <div class="core-info">
      {#if editMode}
        <div class="ci-row">
          <label class="ci-label">Species <input type="text" bind:value={profile.species} on:change={autoSave} /></label>
          <label class="ci-label">Class(es) <input type="text" bind:value={profile.classes} on:change={autoSave} placeholder="Fighter 5 / Wizard 2" /></label>
        </div>
        <div class="ci-row">
          <label class="ci-label">Level <input type="number" min="1" max="20" bind:value={profile.level} on:change={autoSave} class="level-inp" /></label>
          <label class="ci-label">Alignment
            <select bind:value={profile.alignment} on:change={autoSave}>
              {#each ALIGNMENTS as a}<option>{a}</option>{/each}
            </select>
          </label>
        </div>
      {:else}
        <div class="info-tags">
          {#if profile.species}<span class="info-tag">{profile.species}</span>{/if}
          {#if profile.classes}<span class="info-tag">{profile.classes}</span>{/if}
          <span class="info-tag">{profile.alignment}</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Edit toggle -->
  <div class="edit-bar">
    <button class="edit-toggle" on:click={() => { editMode = !editMode; if (!editMode) saveProfile(); }}>
      {editMode ? "✓ Done Editing" : "✎ Edit Profile"}
    </button>
    {#if exportStatus}
      <span class="export-status">{exportStatus}</span>
    {/if}
  </div>

  <!-- ======== DESCRIPTION ======== -->
  {#if editMode || profile.description}
    <div class="text-section">
      <span class="section-label">Description</span>
      {#if editMode}
        <textarea bind:value={profile.description} on:change={autoSave} rows="4"
                  placeholder="Appearance, personality, mannerisms..." class="big-textarea"></textarea>
      {:else}
        <p class="text-body">{profile.description}</p>
      {/if}
    </div>
  {/if}

  <!-- ======== BACKSTORY ======== -->
  {#if editMode || profile.backstory}
    <div class="text-section">
      <span class="section-label">Backstory</span>
      {#if editMode}
        <textarea bind:value={profile.backstory} on:change={autoSave} rows="6"
                  placeholder="Character history, motivations, key events..." class="big-textarea"></textarea>
      {:else}
        <p class="text-body backstory">{profile.backstory}</p>
      {/if}
    </div>
  {/if}

  <!-- ======== QUICK LINKS ======== -->
  <div class="app-links">
    <span class="section-label">Sub Apps</span>
    <div class="link-grid">
      {#each appLinks as app}
        <button class="app-link" on:click={() => openApp(app.id)}>
          <span class="al-icon">{APP_ICONS[app.id] || "◆"}</span>
          <span class="al-name">{app.name}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- ======== DATA MANAGEMENT ======== -->
  <div class="data-section">
    <span class="section-label">Data Management</span>
    <div class="data-actions">
      <button class="data-btn export" on:click={openExportDialog}>
        ↓ Export Character
      </button>
      <button class="data-btn import" on:click={openImportDialog}>
        ↑ Import Character
      </button>
    </div>
    <div class="data-actions">
      <button class="data-btn example" on:click={loadExampleCharacter}>
        ✦ Load John Smith (Example)
      </button>
    </div>
    <p class="data-hint">
      Export saves all sub-app data to a JSON file. Import creates a new character slot from the file. Switch characters using the dropdown above.
    </p>
  </div>

  <!-- ======== EXPORT DIALOG ======== -->
  {#if showExport}
    <div class="import-overlay" use:bodyPortal>
      <div class="import-dialog">
        <div class="id-header">
          <span class="id-title">Export Character</span>
          <button class="id-close" on:click={cancelExport}>✕</button>
        </div>

        <div class="id-char-name">Exporting: <strong>{profile.name}</strong></div>

        <div class="id-preview">
          <span class="id-label">Always included</span>
          <div class="id-sections">
            <span class="id-section found">✓ {SECTION_LABELS.profile}</span>
          </div>
        </div>

        <div class="id-preview">
          <span class="id-label">Select sections to include</span>
          <div class="export-checks">
            {#each Object.entries(STORAGE_MAP) as [, fieldName]}
              <label class="export-check-row">
                <input type="checkbox" bind:checked={exportSelections[fieldName]} />
                {SECTION_LABELS[fieldName] || fieldName}
              </label>
            {/each}
          </div>
        </div>

        <div class="export-check-actions">
          <button class="data-btn-text" on:click={() => { for (const k of Object.keys(exportSelections)) exportSelections[k] = true; exportSelections = exportSelections; }}>All</button>
          <button class="data-btn-text" on:click={() => { for (const k of Object.keys(exportSelections)) exportSelections[k] = false; exportSelections = exportSelections; }}>None</button>
        </div>

        <div class="id-actions">
          <button class="data-btn export" on:click={confirmExport}>↓ Export</button>
          <button class="data-btn" on:click={cancelExport}>Cancel</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- ======== IMPORT DIALOG ======== -->
  {#if showImport}
    <div class="import-overlay" use:bodyPortal>
      <div class="import-dialog">
        <div class="id-header">
          <span class="id-title">Import Character</span>
          <button class="id-close" on:click={cancelImport}>✕</button>
        </div>

        {#if importError}
          <div class="id-error">{importError}</div>
        {/if}

        {#if !importPreview}
          <div
            role="region"
            aria-label="Drop JSON file"
            class:active={dragActive}
            class="id-drop-zone"
            on:dragover|preventDefault={() => dragActive = true}
            on:dragleave={() => dragActive = false}
            on:drop={handleImportDrop}
          >
            Drop JSON Here
          </div>

          <div class="id-import-sources">
            <button class="data-btn import" on:click={triggerFileChooser}>Choose File</button>
          </div>

          <div class="id-path">
            <input
              type="text"
              bind:value={importPath}
              placeholder="C:\Users\...\character.json"
              class="id-path-input"
            />
            <button class="data-btn" on:click={importFromPath}>Read Path</button>
          </div>

          <textarea
            bind:value={importText}
            placeholder="Paste exported character JSON"
            class="id-paste"
            rows="5"
          ></textarea>
          <button class="data-btn" on:click={importFromText}>Analyze Text</button>
        {/if}

        {#if importPreview && importSummary}
          <div class="id-file">📄 {importFileName}</div>

          {#if importSummary.characterName}
            <div class="id-char-name">Character: <strong>{importSummary.characterName}</strong></div>
          {/if}

          {#if importSummary.meta}
            <div class="id-meta">
              {#if importSummary.meta.exportDate}
                Exported: {new Date(importSummary.meta.exportDate).toLocaleString()}
              {/if}
              {#if importSummary.meta.version}
                · v{importSummary.meta.version}
              {/if}
            </div>
          {/if}

          <div class="id-preview">
            <span class="id-label">Data found:</span>
            <div class="id-sections">
              {#each Object.entries(importPreview) as [key, present]}
                {#if present}
                  <span class="id-section found">✓ {SECTION_LABELS[key] || key}</span>
                {/if}
              {/each}
              {#each Object.entries(importPreview) as [key, present]}
                {#if !present}
                  <span class="id-section missing">— {SECTION_LABELS[key] || key}</span>
                {/if}
              {/each}
            </div>
          </div>

          <div class="id-mode">
            <span class="id-label">Import as:</span>
            <label class="id-radio">
              <input type="radio" bind:group={importMode} value="new" />
              New character slot (keeps current character)
            </label>
            <label class="id-radio">
              <input type="radio" bind:group={importMode} value="replace" />
              Replace current character
            </label>
          </div>

          <div class="id-actions">
            <button class="data-btn export" on:click={confirmImport} disabled={importBusy || !!importError}>
              {importBusy ? "Importing..." : "Confirm Import"}
            </button>
            <button class="data-btn" on:click={cancelImport} disabled={importBusy}>Cancel</button>
          </div>
        {:else if importStatus}
          <div class="id-loading">{importStatus}</div>
        {:else if !importError}
          <div class="id-loading">Processing file...</div>
        {/if}

        <!-- Debug log panel -->
        {#if importLog.length > 0}
          <div class="id-log-toggle">
            <button class="data-btn-text" on:click={() => showImportLog = !showImportLog}>
              {showImportLog ? "▲ Hide" : "▼ Show"} debug log ({importLog.length} lines)
            </button>
          </div>
          {#if showImportLog}
            <div class="id-log">
              {#each importLog as line}
                <div class="id-log-line">{line}</div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .profile-app {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* ======== CHARACTER SWITCHER ======== */
  .char-switcher {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .cs-left {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }

  .cs-label {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    white-space: nowrap;
    font-weight: 600;
  }

  .cs-select {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-bright);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 4px 6px;
    cursor: pointer;
  }

  .cs-right {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .cs-btn {
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    cursor: pointer;
    border-radius: var(--radius);
    white-space: nowrap;
    transition: all var(--transition);
  }

  .cs-btn:hover { color: var(--text); border-color: var(--border-focus); }
  .cs-btn.danger { color: var(--danger); border-color: rgba(204,68,68,0.4); }
  .cs-btn.danger:hover { background: rgba(204,68,68,0.1); }
  .cs-btn.danger-soft { color: var(--text-dim); opacity: 0.4; border-color: transparent; }
  .cs-btn.danger-soft:hover { color: var(--danger); opacity: 1; border-color: rgba(204,68,68,0.3); }

  .cs-delete-confirm {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: rgba(204,68,68,0.08);
    border: 1px solid rgba(204,68,68,0.2);
    border-radius: var(--radius);
    font-size: 11px;
    color: var(--danger);
  }

  /* ======== PROFILE CARD ======== */
  .profile-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px 16px 16px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    position: relative;
  }

  .party-section {
    position: absolute;
    top: 8px;
    right: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }

  .party-logo {
    width: 36px;
    height: 36px;
    border-radius: 4px;
    border: 1px solid var(--border);
    object-fit: cover;
  }

  .party-name {
    font-size: 9px;
    color: var(--text-dim);
    text-align: center;
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .party-name-input {
    font-size: 9px;
    width: 70px;
    padding: 1px 4px;
    text-align: center;
  }

  .portrait-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .portrait {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    border: 3px solid var(--border);
    object-fit: cover;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.4);
  }

  .portrait-placeholder {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    border: 3px solid var(--border);
    background: var(--bg-panel);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .portrait-initial {
    font-size: 40px;
    font-family: var(--font-heading);
    color: var(--accent);
    font-weight: 700;
  }

  .img-actions { display: flex; gap: 4px; }
  .img-actions.small { margin-top: 2px; }

  .img-btn {
    font-size: 10px;
    padding: 2px 8px;
    color: var(--text-dim);
    background: transparent;
    border: 1px solid var(--border);
    cursor: pointer;
    border-radius: 2px;
  }

  .img-btn:hover { color: var(--text); border-color: var(--border-focus); }
  .img-btn.danger:hover { color: var(--danger); border-color: var(--danger); }

  .char-name {
    font-family: var(--font-heading);
    font-size: 24px;
    font-weight: 700;
    color: var(--text-bright);
    text-align: center;
    margin: 0;
    line-height: 1.2;
  }

  .char-subtitle {
    font-size: 13px;
    color: var(--text-dim);
    font-style: italic;
    text-align: center;
    margin: 0;
  }

  .name-input {
    font-size: 20px;
    font-weight: 700;
    font-family: var(--font-heading);
    text-align: center;
    padding: 4px 12px;
    color: var(--text-bright);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    width: 100%;
    max-width: 280px;
  }

  .subtitle-input {
    font-size: 12px;
    text-align: center;
    padding: 3px 12px;
    font-style: italic;
    width: 100%;
    max-width: 280px;
  }

  .quick-stats {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .qs {
    font-size: 12px;
    font-weight: 600;
    padding: 2px 8px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 2px;
    color: var(--text-dim);
  }

  .qs.hp { color: #cc3333; border-color: rgba(204, 51, 51, 0.3); }
  .qs.ac { color: #6688bb; border-color: rgba(102, 136, 187, 0.3); }

  .core-info { width: 100%; }

  .ci-row {
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
  }

  .ci-label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .ci-label input, .ci-label select { font-size: 12px; text-transform: none; }
  .level-inp { width: 56px; }

  .info-tags {
    display: flex;
    gap: 6px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .info-tag {
    font-size: 11px;
    padding: 2px 10px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 2px;
    color: var(--text-dim);
  }

  /* ======== EDIT BAR ======== */
  .edit-bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .edit-toggle {
    font-size: 12px;
    padding: 5px 14px;
    color: var(--accent);
    background: transparent;
    border: 1px solid var(--accent-dim);
    cursor: pointer;
    border-radius: var(--radius);
    transition: all var(--transition);
  }

  .edit-toggle:hover { background: rgba(200, 169, 110, 0.1); }

  .export-status {
    font-size: 11px;
    color: var(--success);
    font-weight: 600;
  }

  /* ======== TEXT SECTIONS ======== */
  .text-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .section-label {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }

  .big-textarea {
    font-size: 13px;
    font-family: var(--font-body);
    line-height: 1.6;
    padding: 8px;
    resize: vertical;
    min-height: 60px;
  }

  .text-body {
    font-size: 13px;
    color: var(--text);
    line-height: 1.6;
    margin: 0;
    white-space: pre-wrap;
  }

  .backstory { color: var(--text-dim); }

  /* ======== APP LINKS ======== */
  .app-links {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .link-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 4px;
  }

  .app-link {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 11px;
    color: var(--text-dim);
    transition: all var(--transition);
  }

  .app-link:hover {
    color: var(--accent);
    border-color: var(--accent-dim);
    background: rgba(200, 169, 110, 0.04);
  }

  .al-icon { font-size: 13px; }
  .al-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* ======== DATA MANAGEMENT ======== */
  .data-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .data-actions { display: flex; gap: 6px; }

  .data-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid var(--border);
    background: var(--bg-input);
    color: var(--text);
    cursor: pointer;
    border-radius: var(--radius);
    transition: all var(--transition);
    text-align: center;
  }

  .data-btn.export { color: var(--accent); border-color: var(--accent-dim); }
  .data-btn.export:hover { background: rgba(200, 169, 110, 0.1); }
  .data-btn.import { color: #64b4ff; border-color: rgba(100, 180, 255, 0.3); }
  .data-btn.import:hover { background: rgba(100, 180, 255, 0.06); }
  .data-btn.example { color: #88cc88; border-color: rgba(136, 204, 136, 0.3); }
  .data-btn.example:hover { background: rgba(136, 204, 136, 0.06); }

  .data-hint {
    font-size: 10px;
    color: var(--text-dim);
    opacity: 0.5;
    margin: 0;
    line-height: 1.4;
  }

  /* ======== IMPORT DIALOG ======== */
  .import-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
  }

  .import-dialog {
    width: 100%;
    max-width: 420px;
    max-height: 80vh;
    overflow-y: auto;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  }

  .id-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .id-title {
    font-family: var(--font-heading);
    font-size: 15px;
    font-weight: 600;
    color: var(--text-bright);
  }

  .id-close {
    width: 24px; height: 24px; padding: 0; font-size: 12px;
    background: transparent; border: none; color: var(--text-dim);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
  }

  .id-close:hover { color: var(--danger); }

  .id-error {
    padding: 8px;
    background: rgba(204, 68, 68, 0.1);
    border: 1px solid rgba(204, 68, 68, 0.3);
    border-radius: var(--radius);
    font-size: 12px;
    color: #cc4444;
  }

  .id-drop-zone {
    border: 1px dashed rgba(100, 180, 255, 0.35);
    background: rgba(100, 180, 255, 0.05);
    border-radius: var(--radius);
    min-height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8fc8ff;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .id-drop-zone.active {
    border-color: #64b4ff;
    background: rgba(100, 180, 255, 0.12);
    color: var(--text-bright);
  }

  .id-import-sources,
  .id-path {
    display: flex;
    gap: 6px;
  }

  .id-path-input,
  .id-paste {
    width: 100%;
    min-width: 0;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: var(--font-body);
    font-size: 12px;
    padding: 8px;
  }

  .id-path-input {
    flex: 2;
  }

  .id-paste {
    resize: vertical;
    min-height: 96px;
    line-height: 1.4;
  }

  .id-file { font-size: 12px; color: var(--text-dim); }
  .id-char-name { font-size: 14px; color: var(--text); }
  .id-meta { font-size: 10px; color: var(--text-dim); opacity: 0.6; }

  .id-preview { display: flex; flex-direction: column; gap: 4px; }

  .id-label {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .id-sections { display: flex; flex-direction: column; gap: 2px; }

  .id-section { font-size: 12px; padding: 2px 8px; border-radius: 2px; }
  .id-section.found { color: var(--success); background: rgba(68, 170, 68, 0.06); }
  .id-section.missing { color: var(--text-dim); opacity: 0.4; }

  .id-mode { display: flex; flex-direction: column; gap: 4px; }

  .id-radio {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text);
    cursor: pointer;
  }

  .id-actions { display: flex; gap: 6px; margin-top: 4px; }

  .id-loading {
    font-size: 12px;
    color: var(--text-dim);
    text-align: center;
    padding: 20px;
  }

  .export-checks {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .export-check-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text);
    cursor: pointer;
    padding: 3px 8px;
    border-radius: 2px;
  }

  .export-check-row:hover { background: var(--bg-input); }

  .export-check-actions {
    display: flex;
    gap: 6px;
    padding: 0 8px;
  }

  .data-btn-text {
    font-size: 11px;
    color: var(--text-dim);
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .data-btn-text:hover { color: var(--text); }

  .id-log-toggle { margin-top: 4px; }

  .id-log {
    max-height: 180px;
    overflow-y: auto;
    background: rgba(0,0,0,0.3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 6px;
  }

  .id-log-line {
    font-family: monospace;
    font-size: 10px;
    color: #8fbfff;
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
