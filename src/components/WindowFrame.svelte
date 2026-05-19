<!-- ============================================
     WindowFrame.svelte — Responsive window
     
     Desktop: draggable, resizable, floating.
     Mobile: full-screen card with back button.
     ============================================ -->
<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  export let title: string = "Window";
  export let appId: string = "";
  export let x: number = 40;
  export let y: number = 40;
  export let width: number = 360;
  export let height: number = 400;
  export let zIndex: number = 1;
  export let minimized: boolean = false;
  export let mobileMode: boolean = false;

  const MIN_W = 240;
  const MIN_H = 160;
  const dispatch = createEventDispatcher();

  let frameEl: HTMLDivElement;

  // Drag
  let dragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  // Resize
  type Edge = "" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
  let resizing: Edge = "";
  let rsX = 0; let rsY = 0; let rsW = 0; let rsH = 0; let rsL = 0; let rsT = 0;

  function bringToFront() { dispatch("focus", { appId }); }

  function startDrag(e: MouseEvent | TouchEvent) {
    if (mobileMode) return; // No dragging on mobile
    e.preventDefault();
    dragging = true;
    const pt = getPoint(e);
    dragOffsetX = pt.x - x; dragOffsetY = pt.y - y;
    bringToFront();
  }

  function startResize(edge: Edge, e: MouseEvent | TouchEvent) {
    if (mobileMode) return;
    e.preventDefault(); e.stopPropagation();
    resizing = edge;
    const pt = getPoint(e);
    rsX = pt.x; rsY = pt.y; rsW = width; rsH = height; rsL = x; rsT = y;
    bringToFront();
  }

  function onMove(e: MouseEvent | TouchEvent) {
    const pt = getPoint(e);
    if (dragging) {
      x = Math.max(0, pt.x - dragOffsetX);
      y = Math.max(0, pt.y - dragOffsetY);
      return;
    }
    if (resizing) {
      const dx = pt.x - rsX; const dy = pt.y - rsY;
      if (resizing.includes("e")) width = Math.max(MIN_W, rsW + dx);
      if (resizing.includes("w")) { const nw = Math.max(MIN_W, rsW - dx); x = rsL + (rsW - nw); width = nw; }
      if (resizing.includes("s")) height = Math.max(MIN_H, rsH + dy);
      if (resizing.includes("n")) { const nh = Math.max(MIN_H, rsH - dy); y = rsT + (rsH - nh); height = nh; }
    }
  }

  function stopAll() {
    const changed = dragging || resizing !== "";
    dragging = false;
    resizing = "";
    if (changed) dispatch("layoutChange", { appId });
  }

  function close() { dispatch("close", { appId }); }
  function toggleMinimize() {
    minimized = !minimized;
    dispatch("layoutChange", { appId });
  }

  function getPoint(e: MouseEvent | TouchEvent): { x: number; y: number } {
    if ("touches" in e && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if ("changedTouches" in e && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
  }

  onMount(() => {
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stopAll);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", stopAll);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", stopAll);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", stopAll);
    };
  });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
{#if mobileMode}
  <!-- MOBILE: full-screen card -->
  <div class="mobile-frame">
    <div class="mobile-header">
      <button class="mobile-back" on:click={close}>← Back</button>
      <span class="mobile-title">{title}</span>
      <div class="mobile-spacer"></div>
    </div>
    <div class="mobile-content">
      <slot />
    </div>
  </div>
{:else}
  <!-- DESKTOP: floating window -->
  <div
    class="window-frame"
    bind:this={frameEl}
    style="left:{x}px; top:{y}px; width:{width}px; height:{minimized ? 'auto' : height + 'px'}; z-index:{zIndex};"
    on:mousedown={bringToFront}
  >
    {#if !minimized}
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="rh rh-n" on:mousedown={(e) => startResize("n", e)}></div>
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="rh rh-s" on:mousedown={(e) => startResize("s", e)}></div>
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="rh rh-e" on:mousedown={(e) => startResize("e", e)}></div>
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="rh rh-w" on:mousedown={(e) => startResize("w", e)}></div>
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="rh rh-ne" on:mousedown={(e) => startResize("ne", e)}></div>
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="rh rh-nw" on:mousedown={(e) => startResize("nw", e)}></div>
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="rh rh-se" on:mousedown={(e) => startResize("se", e)}></div>
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="rh rh-sw" on:mousedown={(e) => startResize("sw", e)}></div>
    {/if}

    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="title-bar" on:mousedown={startDrag} on:touchstart={startDrag}>
      <span class="title-text">{title}</span>
      <div class="title-controls">
        <button class="ctrl-btn" on:click={toggleMinimize}>{minimized ? "▢" : "—"}</button>
        <button class="ctrl-btn close-btn" on:click={close}>✕</button>
      </div>
    </div>

    {#if !minimized}
      <div class="window-content">
        <slot />
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ======== DESKTOP FRAME ======== */
  .window-frame {
    position: absolute;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    display: flex; flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
    user-select: none;
    opacity: var(--panel-opacity, 1);
  }

  .title-bar {
    display: flex; align-items: center; justify-content: space-between;
    height: 32px; padding: 0 8px;
    background: var(--bg-raised);
    border-bottom: 1px solid var(--border);
    border-radius: var(--radius) var(--radius) 0 0;
    cursor: grab; flex-shrink: 0;
  }
  .title-bar:active { cursor: grabbing; }

  .title-text {
    font-family: var(--font-heading); font-size: 12px;
    color: var(--text-dim); letter-spacing: 0.5px;
    text-transform: uppercase; overflow: hidden;
    white-space: nowrap; text-overflow: ellipsis; flex: 1;
  }

  .title-controls { display: flex; gap: 2px; }

  .ctrl-btn {
    width: 24px; height: 24px; padding: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; border: none; background: transparent;
    color: var(--text-dim); border-radius: 2px; min-height: 0;
  }
  .ctrl-btn:hover { background: var(--border); color: var(--text-bright); }
  .close-btn:hover { background: var(--danger); color: var(--text-bright); }

  .window-content {
    overflow-y: auto; padding: 12px;
    flex: 1; user-select: text; min-height: 0;
  }

  /* Resize handles */
  .rh { position: absolute; z-index: 10; }
  .rh-n  { top: -3px; left: 8px; right: 8px; height: 6px; cursor: n-resize; }
  .rh-s  { bottom: -3px; left: 8px; right: 8px; height: 6px; cursor: s-resize; }
  .rh-e  { right: -3px; top: 8px; bottom: 8px; width: 6px; cursor: e-resize; }
  .rh-w  { left: -3px; top: 8px; bottom: 8px; width: 6px; cursor: w-resize; }
  .rh-ne { top: -3px; right: -3px; width: 12px; height: 12px; cursor: ne-resize; }
  .rh-nw { top: -3px; left: -3px; width: 12px; height: 12px; cursor: nw-resize; }
  .rh-se { bottom: -3px; right: -3px; width: 12px; height: 12px; cursor: se-resize; }
  .rh-sw { bottom: -3px; left: -3px; width: 12px; height: 12px; cursor: sw-resize; }

  .rh-se::after {
    content: ""; position: absolute; right: 3px; bottom: 3px;
    width: 8px; height: 8px;
    border-right: 2px solid var(--border); border-bottom: 2px solid var(--border);
    opacity: 0; transition: opacity 150ms;
  }
  .window-frame:hover .rh-se::after { opacity: 0.6; }

  /* ======== MOBILE FRAME ======== */
  .mobile-frame {
    position: fixed;
    inset: 0;
    bottom: var(--nav-height);
    background: var(--bg-panel);
    display: flex; flex-direction: column;
    z-index: 50;
    animation: slideIn 200ms ease;
  }

  @keyframes slideIn {
    from { transform: translateX(30px); opacity: 0.5; }
    to { transform: translateX(0); opacity: 1; }
  }

  .mobile-header {
    display: flex; align-items: center;
    height: 48px; padding: 0 12px;
    background: var(--bg-raised);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0; gap: 12px;
  }

  .mobile-back {
    font-size: 14px; padding: 6px 12px;
    color: var(--accent); background: transparent;
    border: 1px solid var(--accent-dim); border-radius: var(--radius);
    min-height: 36px;
  }
  .mobile-back:active { background: rgba(200,169,110,0.1); }

  .mobile-title {
    font-family: var(--font-heading);
    font-size: 14px; font-weight: 600;
    color: var(--text); flex: 1;
    text-align: center;
  }

  .mobile-spacer { width: 60px; }

  .mobile-content {
    flex: 1; overflow-y: auto;
    padding: 12px;
    -webkit-overflow-scrolling: touch;
  }
</style>
