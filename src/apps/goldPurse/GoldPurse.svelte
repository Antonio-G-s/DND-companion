<!-- ============================================
     GoldPurse.svelte — Coin Tracker & Converter
     
     Tracks: Platinum, Gold, Electrum, Silver, Copper
     Converter between all denominations.
     Quick add/subtract buttons.
     Total value in GP always visible.
     ============================================ -->
<script lang="ts">
  import { onMount } from "svelte";

  /** Coin types in order of value */
  type CoinType = "pp" | "gp" | "ep" | "sp" | "cp";

  interface CoinPurse {
    pp: number;
    gp: number;
    ep: number;
    sp: number;
    cp: number;
  }

  interface Transaction {
    type: "add" | "sub";
    coin: CoinType;
    amount: number;
    timestamp: number;
  }

  /** Value of each coin in GP */
  const COIN_TO_GP: Record<CoinType, number> = {
    pp: 10,
    gp: 1,
    ep: 0.5,
    sp: 0.1,
    cp: 0.01,
  };

  const COIN_LABELS: Record<CoinType, string> = {
    pp: "Platinum",
    gp: "Gold",
    ep: "Electrum",
    sp: "Silver",
    cp: "Copper",
  };

  const COIN_SHORT: Record<CoinType, string> = {
    pp: "pp",
    gp: "gp",
    ep: "ep",
    sp: "sp",
    cp: "cp",
  };

  const COIN_COLORS: Record<CoinType, string> = {
    pp: "#b0b8c8",
    gp: "#c8a96e",
    ep: "#8899aa",
    sp: "#aaaaaa",
    cp: "#b87333",
  };

  const COINS: CoinType[] = ["pp", "gp", "ep", "sp", "cp"];

  // ---- State ----
  let purse: CoinPurse = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
  let transactions: Transaction[] = [];
  let maxLog = 30;

  // ---- Quick add/sub input per coin ----
  let amounts: Record<CoinType, number> = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };

  // ---- Converter ----
  let convertFrom: CoinType = "gp";
  let convertTo: CoinType = "sp";
  let convertAmount = 1;
  let convertResult = 0;
  $: {
    const gpValue = convertAmount * COIN_TO_GP[convertFrom];
    convertResult = Math.round((gpValue / COIN_TO_GP[convertTo]) * 100) / 100;
  }

  // ---- Bulk add/sub ----
  let bulkCoin: CoinType = "gp";
  let bulkAmount = 0;

  onMount(() => { loadFromStorage(); });

  // ============ SAVE / LOAD ============

  function saveToStorage() {
    try {
      window.localStorage.setItem("dnd-goldpurse", JSON.stringify({ purse, transactions }));
    } catch {}
  }

  function loadFromStorage() {
    try {
      const raw = window.localStorage.getItem("dnd-goldpurse");
      if (raw) {
        const data = JSON.parse(raw);
        purse = data.purse || { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
        transactions = data.transactions || [];
        return;
      }
    } catch {}
    // Default starting gold
    purse = { pp: 0, gp: 15, ep: 0, sp: 30, cp: 50 };
  }

  // ============ ACTIONS ============

  function addCoins(coin: CoinType, amount: number) {
    if (amount <= 0) return;
    purse[coin] += amount;
    purse = purse;
    logTx("add", coin, amount);
    saveToStorage();
  }

  function subCoins(coin: CoinType, amount: number) {
    if (amount <= 0) return;
    purse[coin] = Math.max(0, purse[coin] - amount);
    purse = purse;
    logTx("sub", coin, amount);
    saveToStorage();
  }

  function quickAdd(coin: CoinType) {
    const amt = amounts[coin];
    if (amt > 0) {
      addCoins(coin, amt);
      amounts[coin] = 0;
    }
  }

  function quickSub(coin: CoinType) {
    const amt = amounts[coin];
    if (amt > 0) {
      subCoins(coin, amt);
      amounts[coin] = 0;
    }
  }

  function handleCoinKey(e: KeyboardEvent, coin: CoinType) {
    if (e.key === "Enter") {
      quickAdd(coin);
    }
  }

  function bulkAdd() {
    if (bulkAmount > 0) addCoins(bulkCoin, bulkAmount);
    bulkAmount = 0;
  }

  function bulkSub() {
    if (bulkAmount > 0) subCoins(bulkCoin, bulkAmount);
    bulkAmount = 0;
  }

  /** Convert coins in purse: move value from one denomination to another */
  function doConvert() {
    if (convertAmount <= 0) return;
    // Check if we have enough of the source coin
    if (purse[convertFrom] < convertAmount) return;
    purse[convertFrom] -= convertAmount;
    // Add the GP value worth of the target coin
    const gpValue = convertAmount * COIN_TO_GP[convertFrom];
    const targetCoins = Math.floor(gpValue / COIN_TO_GP[convertTo]);
    purse[convertTo] += targetCoins;
    purse = purse;
    saveToStorage();
  }

  function clearPurse() {
    purse = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    transactions = [];
    saveToStorage();
  }

  function logTx(type: "add" | "sub", coin: CoinType, amount: number) {
    transactions = [{ type, coin, amount, timestamp: Date.now() }, ...transactions].slice(0, maxLog);
  }

  // ============ COMPUTED ============

  $: totalGP = COINS.reduce((sum, c) => sum + purse[c] * COIN_TO_GP[c], 0);

  $: totalWeight = COINS.reduce((sum, c) => sum + purse[c], 0) * 0.02; // 50 coins = 1 lb

  function fmtGP(v: number): string {
    return (Math.round(v * 100) / 100).toLocaleString();
  }

  function fmtWeight(w: number): string {
    return w % 1 === 0 ? `${w}` : `${w.toFixed(1)}`;
  }

  function timeAgo(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }
</script>

<div class="gold-purse">
  <!-- Total display -->
  <div class="total-display">
    <span class="total-gp">{fmtGP(totalGP)} gp</span>
    <span class="total-sub">Total Value · ⚖ {fmtWeight(totalWeight)} lb</span>
  </div>

  <!-- Coin rows -->
  <div class="coin-rows">
    {#each COINS as coin}
      <div class="coin-row">
        <div class="coin-info">
          <span class="coin-dot" style="background:{COIN_COLORS[coin]};"></span>
          <span class="coin-label">{COIN_LABELS[coin]}</span>
          <span class="coin-amount" style="color:{COIN_COLORS[coin]};">
            {purse[coin].toLocaleString()}
          </span>
          <span class="coin-gp-val">({fmtGP(purse[coin] * COIN_TO_GP[coin])} gp)</span>
        </div>
        <div class="coin-controls">
          <input
            type="number"
            min="0"
            bind:value={amounts[coin]}
            on:keydown={(e) => handleCoinKey(e, coin)}
            class="coin-input"
            placeholder="0"
          />
          <button class="coin-btn add" on:click={() => quickAdd(coin)} title="Add">+</button>
          <button class="coin-btn sub" on:click={() => quickSub(coin)} title="Subtract">−</button>
        </div>
      </div>
    {/each}
  </div>

  <!-- Converter -->
  <div class="section-block">
    <span class="section-label">Converter</span>
    <div class="converter-row">
      <input type="number" min="0" bind:value={convertAmount} class="conv-input" />
      <select bind:value={convertFrom} class="conv-select">
        {#each COINS as c}<option value={c}>{COIN_SHORT[c]}</option>{/each}
      </select>
      <span class="conv-arrow">→</span>
      <span class="conv-result" style="color:{COIN_COLORS[convertTo]};">
        {convertResult}
      </span>
      <select bind:value={convertTo} class="conv-select">
        {#each COINS as c}<option value={c}>{COIN_SHORT[c]}</option>{/each}
      </select>
    </div>
    <button class="action-btn convert-btn" on:click={doConvert}
      title="Actually convert coins in your purse"
    >
      Exchange in Purse
    </button>
  </div>

  <!-- Reference table -->
  <div class="section-block">
    <span class="section-label">Reference</span>
    <div class="ref-table">
      <div class="ref-row"><span class="ref-coin" style="color:{COIN_COLORS.pp}">1 pp</span><span>= 10 gp = 100 sp = 1,000 cp</span></div>
      <div class="ref-row"><span class="ref-coin" style="color:{COIN_COLORS.gp}">1 gp</span><span>= 10 sp = 100 cp</span></div>
      <div class="ref-row"><span class="ref-coin" style="color:{COIN_COLORS.ep}">1 ep</span><span>= 5 sp = 0.5 gp</span></div>
      <div class="ref-row"><span class="ref-coin" style="color:{COIN_COLORS.sp}">1 sp</span><span>= 10 cp = 0.1 gp</span></div>
      <div class="ref-row"><span class="ref-coin" style="color:{COIN_COLORS.cp}">1 cp</span><span>= 0.01 gp</span></div>
    </div>
  </div>

  <!-- Actions -->
  <div class="bottom-actions">
    <button class="action-btn danger-btn" on:click={clearPurse}>Empty Purse</button>
  </div>

  <!-- Transaction log -->
  {#if transactions.length > 0}
    <div class="section-block">
      <span class="section-label">Recent</span>
      <div class="tx-list">
        {#each transactions as tx (tx.timestamp)}
          <div class="tx-item">
            <span class="tx-sign" class:tx-add={tx.type === "add"} class:tx-sub={tx.type === "sub"}>
              {tx.type === "add" ? "+" : "−"}{tx.amount}
            </span>
            <span class="tx-coin" style="color:{COIN_COLORS[tx.coin]};">{COIN_SHORT[tx.coin]}</span>
            <span class="tx-time">{timeAgo(tx.timestamp)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .gold-purse {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* ---- Total ---- */
  .total-display {
    text-align: center;
    padding: 14px 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .total-gp {
    display: block;
    font-size: 36px;
    font-weight: 700;
    color: var(--accent);
    font-family: var(--font-heading);
    line-height: 1;
  }

  .total-sub {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    color: var(--text-dim);
  }

  /* ---- Coin rows ---- */
  .coin-rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .coin-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .coin-info {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .coin-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .coin-label {
    font-size: 12px;
    color: var(--text-dim);
    min-width: 56px;
  }

  .coin-amount {
    font-size: 16px;
    font-weight: 700;
    font-family: var(--font-heading);
    min-width: 40px;
  }

  .coin-gp-val {
    font-size: 10px;
    color: var(--text-dim);
    opacity: 0.6;
  }

  .coin-controls {
    display: flex;
    gap: 3px;
    align-items: center;
    flex-shrink: 0;
  }

  .coin-input {
    width: 52px;
    text-align: center;
    font-size: 12px;
    padding: 3px 4px;
  }

  .coin-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: 2px;
    cursor: pointer;
    background: var(--bg-input);
    color: var(--text-dim);
    transition: all var(--transition);
  }

  .coin-btn.add:hover {
    color: var(--success);
    border-color: var(--success);
  }

  .coin-btn.sub:hover {
    color: var(--danger);
    border-color: var(--danger);
  }

  /* ---- Sections ---- */
  .section-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .section-label {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* ---- Converter ---- */
  .converter-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .conv-input {
    width: 56px;
    text-align: center;
    font-size: 13px;
    padding: 4px;
  }

  .conv-select {
    font-size: 12px;
    padding: 3px 6px;
  }

  .conv-arrow {
    color: var(--text-dim);
    font-size: 14px;
  }

  .conv-result {
    font-size: 16px;
    font-weight: 700;
    font-family: var(--font-heading);
    min-width: 40px;
    text-align: center;
  }

  .convert-btn {
    font-size: 11px;
    padding: 4px 10px;
    color: var(--accent);
    border-color: var(--accent-dim);
    align-self: flex-start;
  }

  .convert-btn:hover {
    background: rgba(200, 169, 110, 0.1);
  }

  /* ---- Reference ---- */
  .ref-table {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ref-row {
    display: flex;
    gap: 8px;
    font-size: 11px;
    color: var(--text-dim);
  }

  .ref-coin {
    font-weight: 600;
    min-width: 32px;
  }

  /* ---- Actions ---- */
  .bottom-actions {
    display: flex;
    gap: 6px;
  }

  .action-btn {
    padding: 5px 12px;
    font-size: 12px;
    color: var(--text);
    border: 1px solid var(--border);
    background: var(--bg-input);
  }

  .danger-btn:hover {
    color: var(--danger);
    border-color: var(--danger);
  }

  /* ---- Transaction log ---- */
  .tx-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 120px;
    overflow-y: auto;
  }

  .tx-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
  }

  .tx-sign {
    font-weight: 700;
    min-width: 40px;
    text-align: right;
  }

  .tx-add { color: var(--success); }
  .tx-sub { color: var(--danger); }

  .tx-coin {
    font-weight: 600;
    min-width: 20px;
  }

  .tx-time {
    color: var(--text-dim);
    opacity: 0.5;
    margin-left: auto;
  }
</style>
