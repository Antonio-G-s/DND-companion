<!-- ============================================
     SettingsPanel.svelte — App configuration
     
     Slide-out panel for workspace settings:
     background image, theme, grid, zoom, reset.
     ============================================ -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let show = false;

  // Settings bound to parent
  export let bgImage: string = "";
  export let bgDim: number = 0.6;
  export let panelOpacity: number = 1;
  export let gridSnap: boolean = false;
  export let gridSize: number = 20;
  export let showGrid: boolean = true;
  export let zoom: number = 1;
  export let accentColor: string = "#c8a96e";
  export let layoutPref: string = "auto";

  const dispatch = createEventDispatcher();

  function uploadBg() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024) { alert("Max 5MB"); return; }
      const reader = new FileReader();
      reader.onload = () => { bgImage = reader.result as string; save(); };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function removeBg() { bgImage = ""; save(); }

  function resetAll() {
    bgImage = "";
    bgDim = 0.6;
    panelOpacity = 1;
    gridSnap = false;
    gridSize = 20;
    showGrid = true;
    zoom = 1;
    accentColor = "#c8a96e";
    layoutPref = "auto";
    dispatch("reset");
    save();
  }

  function save() { dispatch("save"); }

  function setZoom(v: number) {
    zoom = Math.max(0.3, Math.min(2, v));
    save();
  }

  const ACCENT_PRESETS = [
    { label: "Gold", value: "#c8a96e" },
    { label: "Crimson", value: "#cc4444" },
    { label: "Azure", value: "#4488cc" },
    { label: "Emerald", value: "#44aa66" },
    { label: "Violet", value: "#9966cc" },
    { label: "Silver", value: "#aaaaaa" },
    { label: "Amber", value: "#cc8833" },
    { label: "Teal", value: "#44aaaa" },
  ];
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="overlay" on:click={() => { show = false; }}></div>

  <div class="settings-panel">
    <div class="sp-header">
      <span class="sp-title">Settings</span>
      <button class="sp-close" on:click={() => { show = false; }}>✕</button>
    </div>

    <!-- Layout mode -->
    <div class="sp-section">
      <span class="sp-label">Layout Mode</span>
      <label class="sp-check">
        <input type="radio" name="layout" value="auto" bind:group={layoutPref} on:change={save} />
        Auto (phone → single, desktop → canvas)
      </label>
      <label class="sp-check">
        <input type="radio" name="layout" value="canvas" bind:group={layoutPref} on:change={save} />
        Canvas (multi-window, draggable)
      </label>
      <label class="sp-check">
        <input type="radio" name="layout" value="single" bind:group={layoutPref} on:change={save} />
        Single app (one at a time, mobile-style)
      </label>
    </div>

    <!-- Background -->
    <div class="sp-section">
      <span class="sp-label">Background Image</span>
      <div class="sp-row">
        <button class="sp-btn" on:click={uploadBg}>{bgImage ? "Change" : "Upload"}</button>
        {#if bgImage}
          <button class="sp-btn danger" on:click={removeBg}>Remove</button>
        {/if}
      </div>
      {#if bgImage}
        <img src={bgImage} alt="bg preview" class="bg-preview" />
      {/if}
      <label class="sp-slider-label">
        Dimming: {Math.round(bgDim * 100)}%
        <input type="range" min="0" max="100" value={bgDim * 100}
               on:input={(e) => { bgDim = parseInt(e.currentTarget.value) / 100; save(); }}
               class="sp-slider" />
      </label>
    </div>

    <!-- Theme -->
    <div class="sp-section">
      <span class="sp-label">Accent Color</span>
      <div class="color-row">
        <input type="color" bind:value={accentColor} on:change={save} class="color-input" />
        <div class="color-presets">
          {#each ACCENT_PRESETS as preset}
            <button class="color-chip"
                    style="background:{preset.value};"
                    class:active={accentColor === preset.value}
                    on:click={() => { accentColor = preset.value; save(); }}
                    title={preset.label}></button>
          {/each}
        </div>
      </div>
    </div>

    <!-- Panel opacity -->
    <div class="sp-section">
      <label class="sp-slider-label">
        Panel Opacity: {Math.round(panelOpacity * 100)}%
        <input type="range" min="30" max="100" value={panelOpacity * 100}
               on:input={(e) => { panelOpacity = parseInt(e.currentTarget.value) / 100; save(); }}
               class="sp-slider" />
      </label>
    </div>

    <!-- Grid -->
    <div class="sp-section">
      <span class="sp-label">Grid</span>
      <label class="sp-check"><input type="checkbox" bind:checked={showGrid} on:change={save} /> Show grid dots</label>
      <label class="sp-check"><input type="checkbox" bind:checked={gridSnap} on:change={save} /> Snap windows to grid</label>
      {#if gridSnap}
        <label class="sp-slider-label">
          Grid size: {gridSize}px
          <input type="range" min="10" max="40" bind:value={gridSize} on:change={save} class="sp-slider" />
        </label>
      {/if}
    </div>

    <!-- Zoom -->
    <div class="sp-section">
      <span class="sp-label">Zoom: {Math.round(zoom * 100)}%</span>
      <div class="zoom-row">
        <button class="sp-btn" on:click={() => setZoom(zoom - 0.1)}>−</button>
        <input type="range" min="30" max="200" value={zoom * 100}
               on:input={(e) => setZoom(parseInt(e.currentTarget.value) / 100)}
               class="sp-slider zoom-slider" />
        <button class="sp-btn" on:click={() => setZoom(zoom + 0.1)}>+</button>
        <button class="sp-btn" on:click={() => setZoom(1)}>100%</button>
      </div>
    </div>

    <!-- Reset -->
    <div class="sp-section">
      <button class="sp-btn danger full" on:click={resetAll}>Reset All Settings</button>
    </div>

    <div class="sp-footer">
      <span class="sp-hint">Drag workspace: hold middle mouse or Space + drag</span>
      <span class="sp-hint">Zoom: Ctrl + scroll</span>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.3);
    z-index: 9998;
  }

  .settings-panel {
    position: fixed;
    top: 0; right: 0; bottom: 0;
    width: 280px;
    background: var(--bg-panel);
    border-left: 1px solid var(--border);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 0;
    overflow-y: auto;
    box-shadow: -4px 0 20px rgba(0,0,0,0.4);
  }

  .sp-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .sp-title {
    font-family: var(--font-heading);
    font-size: 13px; color: var(--text-dim);
    text-transform: uppercase; letter-spacing: 0.5px;
  }

  .sp-close {
    width: 24px; height: 24px; padding: 0; font-size: 11px;
    background: transparent; border: none; color: var(--text-dim);
    display: flex; align-items: center; justify-content: center;
  }
  .sp-close:hover { color: var(--danger); }

  .sp-section {
    display: flex; flex-direction: column; gap: 6px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
  }

  .sp-label {
    font-size: 10px; color: var(--text-dim);
    text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600;
  }

  .sp-row { display: flex; gap: 4px; }

  .sp-btn {
    font-size: 11px; padding: 4px 10px;
    color: var(--text-dim); background: var(--bg-input);
    border: 1px solid var(--border); cursor: pointer;
  }
  .sp-btn:hover { color: var(--text); border-color: var(--border-focus); }
  .sp-btn.danger { color: var(--danger); border-color: rgba(204,68,68,0.3); }
  .sp-btn.danger:hover { background: rgba(204,68,68,0.08); }
  .sp-btn.full { width: 100%; text-align: center; }

  .bg-preview {
    width: 100%; height: 60px;
    object-fit: cover; border-radius: var(--radius);
    border: 1px solid var(--border);
  }

  .sp-slider-label {
    display: flex; flex-direction: column; gap: 3px;
    font-size: 11px; color: var(--text-dim);
  }

  .sp-slider {
    width: 100%; height: 4px;
    -webkit-appearance: none; appearance: none;
    background: var(--border); border-radius: 2px;
    border: none; padding: 0;
    cursor: pointer;
  }
  .sp-slider::-webkit-slider-thumb {
    -webkit-appearance: none; width: 12px; height: 12px;
    border-radius: 50%; background: var(--accent);
    border: none; cursor: pointer;
  }

  .sp-check {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; color: var(--text); cursor: pointer;
  }

  .color-row { display: flex; gap: 8px; align-items: center; }

  .color-input {
    width: 32px; height: 28px; padding: 1px;
    border: 1px solid var(--border); border-radius: var(--radius);
    background: var(--bg-input); cursor: pointer;
  }
  .color-input::-webkit-color-swatch-wrapper { padding: 2px; }
  .color-input::-webkit-color-swatch { border: none; border-radius: 2px; }

  .color-presets { display: flex; gap: 3px; flex-wrap: wrap; }

  .color-chip {
    width: 18px; height: 18px; border-radius: 3px;
    border: 2px solid transparent; cursor: pointer;
    padding: 0; transition: border-color 100ms;
  }
  .color-chip:hover { border-color: var(--text-dim); }
  .color-chip.active { border-color: var(--text-bright); }

  .zoom-row { display: flex; gap: 4px; align-items: center; }
  .zoom-slider { flex: 1; }

  .sp-footer {
    padding: 12px 14px; display: flex; flex-direction: column; gap: 3px;
  }

  .sp-hint { font-size: 10px; color: var(--text-dim); opacity: 0.4; }
</style>
