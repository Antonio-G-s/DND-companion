<!-- ============================================
     App.svelte — Responsive Root v3
     
     Desktop: pannable/zoomable canvas workspace.
     Mobile: single sub-app at a time with bottom nav.
     Auto-detects screen size, user can override.
     ============================================ -->
<script lang="ts">
  import Toolbar from "./components/Toolbar.svelte";
  import MobileNav from "./components/MobileNav.svelte";
  import WindowFrame from "./components/WindowFrame.svelte";
  import SettingsPanel from "./components/SettingsPanel.svelte";
  import DiceRoller from "./apps/diceRoller/DiceRoller.svelte";
  import SpellList from "./apps/spellList/SpellList.svelte";
  import SpellSlots from "./apps/spellSlots/SpellSlots.svelte";
  import MagicItems from "./apps/magicItems/MagicItems.svelte";
  import Inventory from "./apps/inventory/Inventory.svelte";
  import GoldPurse from "./apps/goldPurse/GoldPurse.svelte";
  import Notes from "./apps/notes/Notes.svelte";
  import Skills from "./apps/skills/Skills.svelte";
  import HpTracker from "./apps/hpTracker/HpTracker.svelte";
  import Traits from "./apps/traits/Traits.svelte";
  import Proficiencies from "./apps/proficiencies/Proficiencies.svelte";
  import WeaponsCantrips from "./apps/weaponsCantrips/WeaponsCantrips.svelte";
  import Spellcasting from "./apps/spellcasting/Spellcasting.svelte";
  import CharacterProfile from "./apps/characterProfile/CharacterProfile.svelte";
  import { getEnabledApps } from "./lib/appRegistry";
  import { eventBus } from "./lib/eventBus";
  import { onMount } from "svelte";
  import type { WindowState } from "./lib/types";

  const apps = getEnabledApps();

  // ============ LAYOUT MODE ============

  type LayoutMode = "auto" | "canvas" | "single";

  let layoutPref: LayoutMode = "auto";
  let screenWidth = window.innerWidth;
  let isMobile = false;

  $: {
    if (layoutPref === "auto") {
      isMobile = screenWidth < 768;
    } else {
      isMobile = layoutPref === "single";
    }
  }

  // ============ WINDOWS (desktop) ============

  let windows: WindowState[] = [];
  let zCounter = 1;
  $: openAppIds = windows.map((w) => w.appId);

  const defaults: Record<string, Partial<WindowState>> = {
    characterProfile: { x: 80, y: 30, width: 420, height: 580 },
    diceRoller: { x: 20, y: 60, width: 340, height: 480 },
    spellList: { x: 380, y: 60, width: 420, height: 520 },
    spellSlots: { x: 200, y: 80, width: 380, height: 520 },
    magicItems: { x: 60, y: 70, width: 420, height: 540 },
    inventory: { x: 100, y: 50, width: 400, height: 500 },
    goldPurse: { x: 520, y: 80, width: 340, height: 520 },
    notes: { x: 140, y: 40, width: 440, height: 560 },
    skills: { x: 30, y: 50, width: 360, height: 580 },
    hpTracker: { x: 420, y: 50, width: 300, height: 420 },
    traits: { x: 80, y: 60, width: 420, height: 520 },
    proficiencies: { x: 520, y: 60, width: 360, height: 480 },
    weaponsCantrips: { x: 40, y: 40, width: 400, height: 540 },
    spellcasting: { x: 60, y: 30, width: 460, height: 600 },
  };

  // ============ MOBILE STATE ============

  let mobileActiveAppId: string = "";

  // ============ WORKSPACE SETTINGS ============

  let panX = 0; let panY = 0; let zoom = 1;
  let bgImage = ""; let bgDim = 0.6;
  let panelOpacity = 1;
  let gridSnap = false; let gridSize = 20; let showGrid = true;
  let accentColor = "#c8a96e";
  let showSettings = false;
  let characterName = "";

  // Pan state
  let isPanning = false;
  let panStartX = 0; let panStartY = 0;
  let panStartPanX = 0; let panStartPanY = 0;
  let spaceHeld = false;

  // Touch pan/pinch state
  let touchStartDist = 0;
  let touchStartZoom = 1;

  // ============ LIFECYCLE ============

  onMount(() => {
    loadSettings();
    loadCharName();
    applyTheme();

    const onResize = () => { screenWidth = window.innerWidth; };
    window.addEventListener("resize", onResize);

    eventBus.subscribe("*", (msg) => {
      if (msg.action === "openApp" && typeof msg.appId === "string") {
        if (isMobile) {
          mobileActiveAppId = msg.appId;
        } else {
          openApp(msg.appId);
        }
      }
    });

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  function loadCharName() {
    try {
      const raw = window.localStorage.getItem("dnd-profile");
      if (raw) characterName = JSON.parse(raw).name || "";
    } catch {}
  }

  // ============ SETTINGS ============

  function loadSettings() {
    try {
      const raw = window.localStorage.getItem("dnd-app-settings");
      if (!raw) return;
      const s = JSON.parse(raw);
      panX = s.panX ?? 0; panY = s.panY ?? 0; zoom = s.zoom ?? 1;
      bgImage = s.bgImage ?? ""; bgDim = s.bgDim ?? 0.6;
      panelOpacity = s.panelOpacity ?? 1;
      gridSnap = s.gridSnap ?? false; gridSize = s.gridSize ?? 20;
      showGrid = s.showGrid ?? true;
      accentColor = s.accentColor ?? "#c8a96e";
      layoutPref = s.layoutPref ?? "auto";
    } catch {}
  }

  function saveSettings() {
    try {
      window.localStorage.setItem("dnd-app-settings", JSON.stringify({
        panX, panY, zoom, bgImage, bgDim, panelOpacity,
        gridSnap, gridSize, showGrid, accentColor, layoutPref,
      }));
    } catch {}
    applyTheme();
  }

  function applyTheme() {
    const root = document.documentElement;
    root.style.setProperty("--accent", accentColor);
    const r = parseInt(accentColor.slice(1, 3), 16);
    const g = parseInt(accentColor.slice(3, 5), 16);
    const b = parseInt(accentColor.slice(5, 7), 16);
    root.style.setProperty("--accent-dim", `rgb(${Math.round(r*0.6)},${Math.round(g*0.6)},${Math.round(b*0.6)})`);
    root.style.setProperty("--panel-opacity", String(panelOpacity));
  }

  function onSettingsSave() { saveSettings(); }
  function onSettingsReset() { panX = 0; panY = 0; layoutPref = "auto"; saveSettings(); }
  function resetView() { panX = 0; panY = 0; zoom = 1; saveSettings(); }

  // ============ DESKTOP WINDOW MANAGEMENT ============

  function toggleApp(e: CustomEvent<{ appId: string }>) {
    const { appId } = e.detail;
    if (windows.find((w) => w.appId === appId)) {
      windows = windows.filter((w) => w.appId !== appId);
    } else {
      openApp(appId);
    }
  }

  function openApp(appId: string) {
    if (windows.find((w) => w.appId === appId)) {
      zCounter++;
      windows = windows.map((w) => w.appId === appId ? { ...w, zIndex: zCounter } : w);
      return;
    }
    const app = apps.find((a) => a.id === appId);
    if (!app) return;
    const def = defaults[appId] || {};
    zCounter++;
    const vpX = -panX / zoom; const vpY = -panY / zoom;
    windows = [...windows, {
      appId, title: app.name,
      x: (def.x ?? 40) + vpX, y: (def.y ?? 60) + vpY,
      width: def.width ?? 360, height: def.height ?? 400,
      minimized: false, zIndex: zCounter,
    }];
  }

  function focusWindow(e: CustomEvent<{ appId: string }>) {
    zCounter++;
    windows = windows.map((w) => w.appId === e.detail.appId ? { ...w, zIndex: zCounter } : w);
  }

  function closeWindow(e: CustomEvent<{ appId: string }>) {
    windows = windows.filter((w) => w.appId !== e.detail.appId);
  }

  // ============ MOBILE NAV ============

  function onMobileOpen(e: CustomEvent<{ appId: string }>) {
    mobileActiveAppId = e.detail.appId;
  }

  function onMobileClose() {
    mobileActiveAppId = "";
  }

  // ============ DESKTOP PAN ============

  function onWorkspaceDown(e: MouseEvent) {
    if (e.button === 1 || (spaceHeld && e.button === 0)) {
      e.preventDefault();
      isPanning = true;
      panStartX = e.clientX; panStartY = e.clientY;
      panStartPanX = panX; panStartPanY = panY;
    }
  }

  function onWorkspaceMove(e: MouseEvent) {
    if (!isPanning) return;
    panX = panStartPanX + (e.clientX - panStartX);
    panY = panStartPanY + (e.clientY - panStartY);
  }

  function onWorkspaceUp() {
    if (isPanning) { isPanning = false; saveSettings(); }
  }

  function onWheel(e: WheelEvent) {
    if (e.ctrlKey) {
      e.preventDefault();
      zoom = Math.max(0.3, Math.min(2, zoom + (e.deltaY > 0 ? -0.05 : 0.05)));
      saveSettings();
    }
  }

  // ============ TOUCH PAN/PINCH (canvas mode on tablet) ============

  function onTouchStart(e: TouchEvent) {
    if (isMobile) return; // Single-app mode handles its own touch
    if (e.touches.length === 2) {
      // Pinch start
      e.preventDefault();
      touchStartDist = getTouchDist(e);
      touchStartZoom = zoom;
    } else if (e.touches.length === 1 && spaceHeld) {
      isPanning = true;
      panStartX = e.touches[0].clientX; panStartY = e.touches[0].clientY;
      panStartPanX = panX; panStartPanY = panY;
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (isMobile) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDist(e);
      const scale = dist / touchStartDist;
      zoom = Math.max(0.3, Math.min(2, touchStartZoom * scale));
    } else if (isPanning && e.touches.length === 1) {
      panX = panStartPanX + (e.touches[0].clientX - panStartX);
      panY = panStartPanY + (e.touches[0].clientY - panStartY);
    }
  }

  function onTouchEnd(e: TouchEvent) {
    if (e.touches.length < 2 && touchStartDist > 0) {
      touchStartDist = 0;
      saveSettings();
    }
    if (isPanning && e.touches.length === 0) {
      isPanning = false; saveSettings();
    }
  }

  function getTouchDist(e: TouchEvent): number {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.code === "Space" && !isInputFocused()) { e.preventDefault(); spaceHeld = true; }
  }
  function onKeyUp(e: KeyboardEvent) { if (e.code === "Space") spaceHeld = false; }

  function isInputFocused(): boolean {
    const tag = document.activeElement?.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  $: canvasTransform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  $: gridBg = showGrid ? `radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)` : "none";

  // ============ APP COMPONENT RENDERER ============
  // Svelte can't do dynamic components easily, so we use if/else

  /** Render the component for a given appId inside a slot-like context */

</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="app-root" class:mobile={isMobile}>

  <!-- DESKTOP: top toolbar -->
  {#if !isMobile}
    <Toolbar {apps} {openAppIds} {zoom} {characterName}
      on:toggle={toggleApp}
      on:settings={() => { showSettings = true; }}
      on:resetView={resetView}
    />
  {/if}

  <!-- ======== DESKTOP: Canvas workspace ======== -->
  {#if !isMobile}
    <div
      class="viewport"
      class:panning={isPanning || spaceHeld}
      on:mousedown={onWorkspaceDown}
      on:mousemove={onWorkspaceMove}
      on:mouseup={onWorkspaceUp}
      on:mouseleave={onWorkspaceUp}
      on:wheel={onWheel}
      on:touchstart={onTouchStart}
      on:touchmove={onTouchMove}
      on:touchend={onTouchEnd}
    >
      {#if bgImage}
        <div class="bg-layer" style="background-image:url({bgImage}); opacity:{1 - bgDim};"></div>
        <div class="dim-layer" style="opacity:{bgDim};"></div>
      {/if}

      <div class="canvas" style="transform:{canvasTransform}; background-image:{gridBg}; background-size:{gridSize}px {gridSize}px;">
        {#each windows as win (win.appId)}
          <WindowFrame
            title={win.title} appId={win.appId}
            bind:x={win.x} bind:y={win.y}
            bind:width={win.width} bind:height={win.height}
            zIndex={win.zIndex} bind:minimized={win.minimized}
            mobileMode={false}
            on:focus={focusWindow} on:close={closeWindow}
          >
            {#if win.appId === "characterProfile"}<CharacterProfile />
            {:else if win.appId === "diceRoller"}<DiceRoller />
            {:else if win.appId === "spellList"}<SpellList />
            {:else if win.appId === "spellSlots"}<SpellSlots />
            {:else if win.appId === "magicItems"}<MagicItems />
            {:else if win.appId === "inventory"}<Inventory />
            {:else if win.appId === "goldPurse"}<GoldPurse />
            {:else if win.appId === "notes"}<Notes />
            {:else if win.appId === "skills"}<Skills />
            {:else if win.appId === "hpTracker"}<HpTracker />
            {:else if win.appId === "traits"}<Traits />
            {:else if win.appId === "proficiencies"}<Proficiencies />
            {:else if win.appId === "weaponsCantrips"}<WeaponsCantrips />
            {:else if win.appId === "spellcasting"}<Spellcasting />
            {/if}
          </WindowFrame>
        {/each}

        {#if windows.length === 0}
          <div class="empty-hint">
            <span>Click a sub app in the toolbar to open it.</span>
            <span class="hint-sub">Space + drag to pan · Ctrl + scroll to zoom</span>
          </div>
        {/if}
      </div>
    </div>

  {:else}
    <!-- ======== MOBILE: Single-app mode ======== -->
    {#if mobileActiveAppId}
      <WindowFrame
        title={apps.find(a => a.id === mobileActiveAppId)?.name || ""}
        appId={mobileActiveAppId}
        x={0} y={0} width={0} height={0} zIndex={1}
        minimized={false} mobileMode={true}
        on:close={onMobileClose}
      >
        {#if mobileActiveAppId === "characterProfile"}<CharacterProfile />
        {:else if mobileActiveAppId === "diceRoller"}<DiceRoller />
        {:else if mobileActiveAppId === "spellList"}<SpellList />
        {:else if mobileActiveAppId === "spellSlots"}<SpellSlots />
        {:else if mobileActiveAppId === "magicItems"}<MagicItems />
        {:else if mobileActiveAppId === "inventory"}<Inventory />
        {:else if mobileActiveAppId === "goldPurse"}<GoldPurse />
        {:else if mobileActiveAppId === "notes"}<Notes />
        {:else if mobileActiveAppId === "skills"}<Skills />
        {:else if mobileActiveAppId === "hpTracker"}<HpTracker />
        {:else if mobileActiveAppId === "traits"}<Traits />
        {:else if mobileActiveAppId === "proficiencies"}<Proficiencies />
        {:else if mobileActiveAppId === "weaponsCantrips"}<WeaponsCantrips />
        {:else if mobileActiveAppId === "spellcasting"}<Spellcasting />
        {/if}
      </WindowFrame>
    {:else}
      <!-- Mobile home: show character profile inline -->
      <div class="mobile-home">
        <CharacterProfile />
      </div>
    {/if}

    <!-- Bottom nav -->
    <MobileNav
      {apps}
      activeAppId={mobileActiveAppId}
      {characterName}
      on:open={onMobileOpen}
      on:settings={() => { showSettings = true; }}
    />
  {/if}

  <!-- Settings panel (shared) -->
  <SettingsPanel
    bind:show={showSettings}
    bind:bgImage bind:bgDim bind:panelOpacity
    bind:gridSnap bind:gridSize bind:showGrid
    bind:zoom bind:accentColor
    bind:layoutPref
    on:save={onSettingsSave}
    on:reset={onSettingsReset}
  />
</div>

<style>
  .app-root {
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    overflow: hidden;
  }

  /* ---- Desktop viewport ---- */
  .viewport {
    flex: 1; position: relative; overflow: hidden;
    cursor: default; background: var(--bg);
  }
  .viewport.panning { cursor: grab; }
  .viewport.panning:active { cursor: grabbing; }

  .bg-layer {
    position: absolute; inset: 0;
    background-size: cover; background-position: center;
    background-repeat: no-repeat; pointer-events: none; z-index: 0;
  }
  .dim-layer {
    position: absolute; inset: 0;
    background: #000; pointer-events: none; z-index: 0;
  }

  .canvas {
    position: absolute; top: 0; left: 0;
    width: 8000px; height: 6000px;
    transform-origin: 0 0; z-index: 1;
  }

  .empty-hint {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    pointer-events: none; z-index: 0;
  }
  .empty-hint span {
    font-size: 13px; color: var(--text-dim); opacity: 0.4;
    font-family: var(--font-heading);
  }
  .hint-sub { font-size: 11px !important; opacity: 0.25 !important; }

  /* ---- Mobile home (when no app open) ---- */
  .mobile-home {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    padding-bottom: calc(var(--nav-height) + var(--safe-bottom) + 12px);
    -webkit-overflow-scrolling: touch;
  }
</style>
