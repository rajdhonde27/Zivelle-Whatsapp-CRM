"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Count of unread notifications for the current user. Used by the
 * sidebar and other navigation surfaces to surface a badge.
 *
 * Uses a shared singleton subscriber store to avoid duplicate Supabase
 * channels and prevent "cannot add callbacks after subscribe()" errors.
 */

let globalCount = 0;
let hasLoaded = false;
let isFetching = false;
const listeners = new Set<(count: number) => void>();
let globalChannel: RealtimeChannel | null = null;

function notifyListeners() {
  for (const listener of listeners) {
    listener(globalCount);
  }
}

export function useUnreadNotifications(): number {
  const [count, setCount] = useState(globalCount);

  useEffect(() => {
    listeners.add(setCount);

    if (hasLoaded) {
      setCount(globalCount);
    }

    const supabase = createClient();

    if (!hasLoaded && !isFetching) {
      isFetching = true;
      (async () => {
        try {
          const { count: unreadCount, error } = await supabase
            .from("notifications")
            .select("*", { count: "exact", head: true })
            .is("read_at", null);
          if (!error) {
            globalCount = unreadCount ?? 0;
            hasLoaded = true;
            notifyListeners();
          }
        } finally {
          isFetching = false;
        }
      })();
    }

    if (!globalChannel) {
      const channelTopic = `notifications-unread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      globalChannel = supabase
        .channel(channelTopic)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications" },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Notification;
              if (!row.read_at) {
                globalCount += 1;
                notifyListeners();
              }
            } else if (payload.eventType === "UPDATE") {
              const newRow = payload.new as Notification;
              if (newRow.read_at) {
                globalCount = Math.max(0, globalCount - 1);
                notifyListeners();
              }
            } else if (payload.eventType === "DELETE") {
              const oldRow = payload.old as Partial<Notification>;
              if (!oldRow.read_at) {
                globalCount = Math.max(0, globalCount - 1);
                notifyListeners();
              }
            }
          },
        )
        .subscribe();
    }

    return () => {
      listeners.delete(setCount);
      if (listeners.size === 0 && globalChannel) {
        supabase.removeChannel(globalChannel);
        globalChannel = null;
        hasLoaded = false;
      }
    };
  }, []);

  return count;
}
