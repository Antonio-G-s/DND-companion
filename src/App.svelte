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
  const SETTINGS_KEY = "dnd-app-settings";
  const WINDOW_LAYOUT_KEY = "dnd-window-layout";
  const MOBILE_LAYOUT_KEY = "dnd-mobile-layout";
  const MIN_WINDOW_WIDTH = 240;
  const MIN_WINDOW_HEIGHT = 160;
  const EDGE_SWIPE_START = 24;
  const EDGE_SWIPE_TRIGGER = 64;

  type SavedWindowBounds = Pick<WindowState, "x" | "y" | "width" | "height" | "minimized">;

  interface SavedWindowLayout {
    windows: WindowState[];
    bounds: Record<string, SavedWindowBounds>;
    zCounter: number;
  }

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
  let windowLayoutReady = false;
  let windowLayoutSaveTimer: number | undefined;
  let rememberedWindowBounds: Record<string, SavedWindowBounds> = {};
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
  let mobileAppHistory: string[] = [];
  let mobileMenuOpen = false;
  let mobileLayoutReady = false;
  let edgeSwipeTracking = false;
  let edgeSwipePointerId: number | null = null;
  let edgeSwipeStartX = 0;
  let edgeSwipeStartY = 0;

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
    loadWindowLayout();
    loadMobileLayout();
    loadCharName();
    applyTheme();

    const onResize = () => { screenWidth = window.innerWidth; };
    window.addEventListener("resize", onResize);

    eventBus.subscribe("*", (msg) => {
      if (msg.action === "openApp" && typeof msg.appId === "string") {
        if (isMobile) {
          openMobileApp(msg.appId);
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
      if (windowLayoutSaveTimer !== undefined) window.clearTimeout(windowLayoutSaveTimer);
    };
  });

  $: if (windowLayoutReady) {
    windows;
    zCounter;
    scheduleWindowLayoutSave();
  }

  $: if (mobileLayoutReady) {
    mobileActiveAppId;
    mobileAppHistory;
    saveMobileLayout();
  }

  function loadCharName() {
    try {
      const raw = window.localStorage.getItem("dnd-profile");
      if (raw) characterName = JSON.parse(raw).name || "";
    } catch {}
  }

  // ============ SETTINGS ============

  function loadSettings() {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
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
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({
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

  // ============ WINDOW LAYOUT PERSISTENCE ============

  function loadWindowLayout() {
    try {
      const raw = window.localStorage.getItem(WINDOW_LAYOUT_KEY);
      if (!raw) {
        windowLayoutReady = true;
        return;
      }

      const saved = JSON.parse(raw) as Partial<SavedWindowLayout>;
      const restored = Array.isArray(saved.windows)
        ? saved.windows.map(normalizeSavedWindow).filter(Boolean) as WindowState[]
        : [];

      rememberedWindowBounds = normalizeSavedBounds(saved.bounds);
      restored.forEach((win) => rememberWindowBounds(win));

      windows = restored;
      const highestZ = restored.reduce((max, win) => Math.max(max, win.zIndex), 1);
      zCounter = Math.max(saved.zCounter ?? 1, highestZ);
    } catch {}

    windowLayoutReady = true;
  }

  function normalizeSavedBounds(bounds: unknown): Record<string, SavedWindowBounds> {
    if (!bounds || typeof bounds !== "object") return {};
    const next: Record<string, SavedWindowBounds> = {};

    for (const [appId, value] of Object.entries(bounds as Record<string, Partial<SavedWindowBounds>>)) {
      const app = apps.find((entry) => entry.id === appId);
      if (!app || !value) continue;
      const def = defaults[appId] || {};
      next[appId] = {
        x: finiteNumber(value.x, def.x ?? 40),
        y: finiteNumber(value.y, def.y ?? 60),
        width: Math.max(MIN_WINDOW_WIDTH, finiteNumber(value.width, def.width ?? 360)),
        height: Math.max(MIN_WINDOW_HEIGHT, finiteNumber(value.height, def.height ?? 400)),
        minimized: Boolean(value.minimized),
      };
    }

    return next;
  }

  function normalizeSavedWindow(value: Partial<WindowState>): WindowState | null {
    if (!value?.appId) return null;
    const app = apps.find((entry) => entry.id === value.appId);
    if (!app) return null;
    const def = defaults[value.appId] || {};

    return {
      appId: app.id,
      title: app.name,
      x: finiteNumber(value.x, def.x ?? 40),
      y: finiteNumber(value.y, def.y ?? 60),
      width: Math.max(MIN_WINDOW_WIDTH, finiteNumber(value.width, def.width ?? 360)),
      height: Math.max(MIN_WINDOW_HEIGHT, finiteNumber(value.height, def.height ?? 400)),
      minimized: Boolean(value.minimized),
      zIndex: Math.max(1, Math.round(finiteNumber(value.zIndex, 1))),
    };
  }

  function finiteNumber(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  function rememberWindowBounds(win: WindowState) {
    rememberedWindowBounds = {
      ...rememberedWindowBounds,
      [win.appId]: {
        x: win.x,
        y: win.y,
        width: win.width,
        height: win.height,
        minimized: win.minimized,
      },
    };
  }

  function rememberOpenWindowBounds() {
    windows.forEach((win) => rememberWindowBounds(win));
  }

  function scheduleWindowLayoutSave() {
    if (windowLayoutSaveTimer !== undefined) window.clearTimeout(windowLayoutSaveTimer);
    windowLayoutSaveTimer = window.setTimeout(saveWindowLayout, 120);
  }

  function saveWindowLayout() {
    try {
      rememberOpenWindowBounds();
      const payload: SavedWindowLayout = {
        windows: windows.map((win) => ({ ...win })),
        bounds: rememberedWindowBounds,
        zCounter,
      };
      window.localStorage.setItem(WINDOW_LAYOUT_KEY, JSON.stringify(payload));
    } catch {}
  }

  function persistWindowLayoutNow() {
    if (windowLayoutReady) saveWindowLayout();
  }

  // ============ MOBILE LAYOUT PERSISTENCE ============

  function loadMobileLayout() {
    try {
      const raw = window.localStorage.getItem(MOBILE_LAYOUT_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        mobileActiveAppId = validMobileAppId(saved.activeAppId) ? saved.activeAppId : "";
        mobileAppHistory = Array.isArray(saved.history)
          ? saved.history.filter(validMobileAppId).filter((id: string) => id !== mobileActiveAppId).slice(-20)
          : [];
      }
    } catch {}

    mobileLayoutReady = true;
  }

  function saveMobileLayout() {
    try {
      window.localStorage.setItem(MOBILE_LAYOUT_KEY, JSON.stringify({
        activeAppId: mobileActiveAppId,
        history: mobileAppHistory.slice(-20),
      }));
    } catch {}
  }

  function persistMobileLayoutNow() {
    if (mobileLayoutReady) saveMobileLayout();
  }

  function validMobileAppId(appId: unknown): appId is string {
    return typeof appId === "string" && appId !== "characterProfile" && apps.some((app) => app.id === appId);
  }

  // ============ DESKTOP WINDOW MANAGEMENT ============

  function toggleApp(e: CustomEvent<{ appId: string }>) {
    const { appId } = e.detail;
    if (windows.find((w) => w.appId === appId)) {
      const closing = windows.find((w) => w.appId === appId);
      if (closing) rememberWindowBounds(closing);
      windows = windows.filter((w) => w.appId !== appId);
      persistWindowLayoutNow();
    } else {
      openApp(appId);
    }
  }

  function openApp(appId: string) {
    if (windows.find((w) => w.appId === appId)) {
      zCounter++;
      windows = windows.map((w) => w.appId === appId ? { ...w, zIndex: zCounter } : w);
      persistWindowLayoutNow();
      return;
    }
    const app = apps.find((a) => a.id === appId);
    if (!app) return;
    const def = defaults[appId] || {};
    const savedBounds = rememberedWindowBounds[appId];
    zCounter++;
    const vpX = -panX / zoom; const vpY = -panY / zoom;
    windows = [...windows, {
      appId, title: app.name,
      x: savedBounds ? savedBounds.x : (def.x ?? 40) + vpX,
      y: savedBounds ? savedBounds.y : (def.y ?? 60) + vpY,
      width: savedBounds?.width ?? def.width ?? 360,
      height: savedBounds?.height ?? def.height ?? 400,
      minimized: savedBounds?.minimized ?? false, zIndex: zCounter,
    }];
    persistWindowLayoutNow();
  }

  function focusWindow(e: CustomEvent<{ appId: string }>) {
    zCounter++;
    windows = windows.map((w) => w.appId === e.detail.appId ? { ...w, zIndex: zCounter } : w);
    persistWindowLayoutNow();
  }

  function closeWindow(e: CustomEvent<{ appId: string }>) {
    const closing = windows.find((w) => w.appId === e.detail.appId);
    if (closing) rememberWindowBounds(closing);
    windows = windows.filter((w) => w.appId !== e.detail.appId);
    persistWindowLayoutNow();
  }

  function onWindowLayoutChange() {
    rememberOpenWindowBounds();
    saveWindowLayout();
  }

  // ============ MOBILE NAV ============

  function onMobileOpen(e: CustomEvent<{ appId: string }>) {
    openMobileApp(e.detail.appId);
  }

  function onMobileClose() {
    goMobileBack();
  }

  function openMobileApp(appId: string) {
    mobileMenuOpen = false;
    if (appId === "characterProfile") {
      mobileActiveAppId = "";
      mobileAppHistory = [];
      persistMobileLayoutNow();
      return;
    }
    if (!apps.some((app) => app.id === appId)) return;
    if (mobileActiveAppId && mobileActiveAppId !== appId) {
      mobileAppHistory = [...mobileAppHistory, mobileActiveAppId].slice(-20);
    }
    mobileActiveAppId = appId;
    persistMobileLayoutNow();
  }

  function goMobileBack() {
    if (mobileAppHistory.length > 0) {
      const previous = mobileAppHistory[mobileAppHistory.length - 1];
      mobileAppHistory = mobileAppHistory.slice(0, -1);
      mobileActiveAppId = previous;
      persistMobileLayoutNow();
      return;
    }
    mobileActiveAppId = "";
    persistMobileLayoutNow();
  }

  function onMobileRootTouchStart(e: TouchEvent) {
    if (!isMobile || showSettings || e.touches.length !== 1) return;
    const touch = e.touches[0];
    startEdgeSwipe(touch.clientX, touch.clientY);
  }

  function onMobileRootTouchMove(e: TouchEvent) {
    if (!edgeSwipeTracking || e.touches.length !== 1) return;
    const touch = e.touches[0];
    moveEdgeSwipe(touch.clientX, touch.clientY, () => e.preventDefault());
  }

  function onMobileRootTouchEnd() {
    endEdgeSwipe();
  }

  function onMobileRootPointerDown(e: PointerEvent) {
    if (!isMobile || showSettings || e.clientX > EDGE_SWIPE_START) return;
    edgeSwipePointerId = e.pointerId;
    startEdgeSwipe(e.clientX, e.clientY);
  }

  function onMobileRootPointerMove(e: PointerEvent) {
    if (edgeSwipePointerId !== e.pointerId) return;
    moveEdgeSwipe(e.clientX, e.clientY, () => e.preventDefault());
  }

  function onMobileRootPointerEnd(e: PointerEvent) {
    if (edgeSwipePointerId !== e.pointerId) return;
    endEdgeSwipe();
  }

  function startEdgeSwipe(clientX: number, clientY: number) {
    if (clientX > EDGE_SWIPE_START) return;
    edgeSwipeTracking = true;
    edgeSwipeStartX = clientX;
    edgeSwipeStartY = clientY;
  }

  function moveEdgeSwipe(clientX: number, clientY: number, preventDefault: () => void) {
    if (!edgeSwipeTracking) return;
    const dx = clientX - edgeSwipeStartX;
    const dy = Math.abs(clientY - edgeSwipeStartY);
    if (dx > 12 && dx > dy) preventDefault();
    if (dx >= EDGE_SWIPE_TRIGGER && dy < 80) {
      mobileMenuOpen = true;
      endEdgeSwipe();
    }
  }

  function endEdgeSwipe() {
    edgeSwipeTracking = false;
    edgeSwipePointerId = null;
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
<div
  class="app-root"
  class:mobile={isMobile}
  on:touchstart={onMobileRootTouchStart}
  on:touchmove|nonpassive={onMobileRootTouchMove}
  on:touchend={onMobileRootTouchEnd}
  on:touchcancel={onMobileRootTouchEnd}
  on:pointerdown={onMobileRootPointerDown}
  on:pointermove={onMobileRootPointerMove}
  on:pointerup={onMobileRootPointerEnd}
  on:pointercancel={onMobileRootPointerEnd}
>

  <!-- DESKTOP: left app rail + canvas workspace -->
  {#if !isMobile}
    <div class="desktop-shell">
    <Toolbar {apps} {openAppIds} {zoom} {characterName}
      on:toggle={toggleApp}
      on:settings={() => { showSettings = true; }}
      on:resetView={resetView}
    />

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
            on:focus={focusWindow} on:close={closeWindow} on:layoutChange={onWindowLayoutChange}
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
            <span>Click a sub app in the left rail to open it.</span>
            <span class="hint-sub">Space + drag to pan · Ctrl + scroll to zoom</span>
          </div>
        {/if}
      </div>
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
      bind:drawerOpen={mobileMenuOpen}
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

  .desktop-shell {
    flex: 1;
    min-height: 0;
    display: flex;
    overflow: hidden;
  }

  /* ---- Desktop viewport ---- */
  .viewport {
    flex: 1; min-width: 0; position: relative; overflow: hidden;
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
