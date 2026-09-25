"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Conversation } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Count of conversations with at least one unread inbound message for
 * the current user. Used by both the desktop Sidebar and MobileNav to
 * display an unread badge.
 *
 * Uses a shared singleton subscriber store so multiple components on the same
 * page (e.g. Sidebar + MobileNav) share a single Supabase Realtime channel
 * and single DB query, preventing duplicate subscriptions and the
 * "cannot add 'postgres_changes' callbacks after subscribe()" error.
 */

let globalTotal = 0;
let hasLoaded = false;
let isFetching = false;
const listeners = new Set<(total: number) => void>();
const countsMap = new Map<string, number>();
let globalChannel: RealtimeChannel | null = null;

function notifyListeners() {
  for (const listener of listeners) {
    listener(globalTotal);
  }
}

function recomputeTotal() {
  let sum = 0;
  for (const n of countsMap.values()) {
    if (n > 0) sum += 1;
  }
  globalTotal = sum;
  notifyListeners();
}

export function useTotalUnread(): number {
  const [total, setTotal] = useState(globalTotal);

  useEffect(() => {
    listeners.add(setTotal);

    // Sync immediately with the cached value if already loaded
    if (hasLoaded) {
      setTotal(globalTotal);
    }

    const supabase = createClient();

    // Fetch initial counts if not loaded yet
    if (!hasLoaded && !isFetching) {
      isFetching = true;
      (async () => {
        try {
          const { data, error } = await supabase
            .from("conversations")
            .select("id, unread_count");
          if (!error && data) {
            countsMap.clear();
            for (const row of data as { id: string; unread_count: number }[]) {
              countsMap.set(row.id, row.unread_count ?? 0);
            }
            hasLoaded = true;
            recomputeTotal();
          }
        } finally {
          isFetching = false;
        }
      })();
    }

    // Subscribe to realtime changes once for all listeners
    if (!globalChannel) {
      const channelTopic = `total-unread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      globalChannel = supabase
        .channel(channelTopic)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "conversations" },
          (payload) => {
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as Partial<Conversation>;
              if (oldRow.id) countsMap.delete(oldRow.id);
            } else {
              const row = payload.new as Conversation;
              countsMap.set(row.id, row.unread_count ?? 0);
            }
            recomputeTotal();
          },
        )
        .subscribe();
    }

    return () => {
      listeners.delete(setTotal);
      // When the last component unmounts, tear down the realtime channel
      if (listeners.size === 0 && globalChannel) {
        supabase.removeChannel(globalChannel);
        globalChannel = null;
        hasLoaded = false;
      }
    };
  }, []);

  return total;
}
