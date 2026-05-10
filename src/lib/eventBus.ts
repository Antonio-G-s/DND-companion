/* ============================================
   eventBus.ts — Internal message bus
   
   Sub apps subscribe by their id.
   Messages are routed by the "target" field.
   Use target "*" to broadcast to all listeners.
   ============================================ */

import type { BusMessage } from "./types";

type MessageHandler = (msg: BusMessage) => void;

class EventBus {
  /** Map of appId → array of handler functions */
  private listeners: Map<string, MessageHandler[]> = new Map();

  /** Log for debugging — stores last N messages */
  private log: BusMessage[] = [];
  private maxLog = 50;

  /**
   * Subscribe a handler for a given app id.
   * Returns an unsubscribe function.
   */
  subscribe(appId: string, handler: MessageHandler): () => void {
    if (!this.listeners.has(appId)) {
      this.listeners.set(appId, []);
    }
    this.listeners.get(appId)!.push(handler);

    // Return cleanup function
    return () => {
      const handlers = this.listeners.get(appId);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx !== -1) handlers.splice(idx, 1);
      }
    };
  }

  /**
   * Send a message. Routes to the target app id,
   * or broadcasts to all if target is "*".
   */
  send(msg: BusMessage): void {
    // Push to debug log
    this.log.push(msg);
    if (this.log.length > this.maxLog) this.log.shift();

    if (msg.target === "*") {
      // Broadcast to every listener
      for (const [, handlers] of this.listeners) {
        for (const handler of handlers) {
          handler(msg);
        }
      }
    } else {
      const handlers = this.listeners.get(msg.target);
      if (handlers) {
        for (const handler of handlers) {
          handler(msg);
        }
      }
    }
  }

  /** Get recent messages for debugging. */
  getLog(): BusMessage[] {
    return [...this.log];
  }

  /** Clear all listeners (useful for hot-reload). */
  clear(): void {
    this.listeners.clear();
    this.log = [];
  }
}

/** Singleton event bus instance shared across the app. */
export const eventBus = new EventBus();
