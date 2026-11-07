"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Profile, StudyTable, TableMember } from "@/types/database.types";
import { notificationHelpers } from "@/stores/notification-store";

// Extended types with relations
export interface TableMemberWithProfile extends TableMember {
  profile?: Profile;
}

export interface TableWithMembers extends StudyTable {
  members: TableMemberWithProfile[];
}

type ChatScope = "room" | "table";

interface TableState {
  // Data
  tables: TableWithMembers[];
  currentTableId: number | null;
  chatScope: ChatScope;

  // Loading states
  isLoading: boolean;
  isJoining: boolean;
  isCreating: boolean;
  isLeaving: boolean;

  // Error state
  error: string | null;

  // Actions - Tables
  fetchTables: (roomId: number) => Promise<void>;
  createTable: (
    roomId: number,
    name: string,
    userId: string,
    roomName?: string
  ) => Promise<{ success: boolean; error?: string; tableId?: number }>;
  joinTable: (
    tableId: number,
    userId: string
  ) => Promise<{ success: boolean; error?: string }>;
  leaveTable: (userId: string) => Promise<void>;

  // Actions - Chat scope
  setChatScope: (scope: ChatScope) => void;

  // Computed helpers
  getTableById: (tableId: number) => TableWithMembers | undefined;
  getUserTable: (userId: string) => TableWithMembers | undefined;
  isTableFull: (tableId: number) => boolean;
  getTableMemberCount: (tableId: number) => number;

  // Realtime subscriptions
  subscribeToTables: (roomId: number) => () => void;

  // Reset
  reset: () => void;
  clearError: () => void;
}

export const useTableStore = create<TableState>((set, get) => ({
  // Initial state
  tables: [],
  currentTableId: null,
  chatScope: "room",
  isLoading: false,
  isJoining: false,
  isCreating: false,
  isLeaving: false,
  error: null,

  // Fetch tables for a room
  fetchTables: async (roomId: number) => {
    set({ isLoading: true, error: null });

    const supabase = createClient();

    try {
      const { data: tables, error } = await supabase
        .from("study_tables")
        .select(
          `
          *,
          members:table_members(
            *,
            profile:profiles!table_members_user_id_fkey(*)
          )
        `
        )
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (error) {
        // Ignore AbortError from React StrictMode
        if (error.message?.includes("aborted") || error.message?.includes("AbortError")) {
          set({ isLoading: false });
          return;
        }
        console.error("Tables fetch error:", error.message);
        set({
          tables: [],
          currentTableId: null,
          chatScope: "room",
          isLoading: false,
        });
        return;
      }

      // Check if current user is at any table
      const userId = (await supabase.auth.getUser()).data.user?.id;
      let currentTableId: number | null = null;

      if (userId && tables) {
        for (const table of tables) {
          const isMember = (table.members as TableMemberWithProfile[])?.some(
            (m) => m.user_id === userId
          );
          if (isMember) {
            currentTableId = table.id;
            break;
          }
        }
      }

      set({
        tables: (tables as TableWithMembers[]) || [],
        currentTableId,
        chatScope: currentTableId ? "table" : "room",
        isLoading: false,
      });
    } catch (error: any) {
      // Ignore AbortError from React StrictMode
      if (error?.name === "AbortError" || error?.message?.includes("aborted")) {
        set({ isLoading: false });
        return;
      }
      console.error("Error fetching tables:", error);
      set({ tables: [], error: "Failed to load tables", isLoading: false });
    }
  },

  // Create a new table
  createTable: async (roomId, name, userId, roomName?: string) => {
    set({ isCreating: true, error: null });

    const supabase = createClient();

    try {
      const { data, error } = await supabase.rpc("create_study_table", {
        p_room_id: roomId,
        p_name: name.trim(),
        p_user_id: userId,
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        error?: string;
        table_id?: number;
      };

      if (result.success && result.table_id) {
        set({ currentTableId: result.table_id, chatScope: "table" });
        await get().fetchTables(roomId);
        // Trigger notification for new table creation
        if (roomName) {
          notificationHelpers.tableCreated(name.trim(), roomName, result.table_id, roomId);
        }
        return { success: true, tableId: result.table_id };
      }

      set({ error: result.error || "Failed to create table" });
      return { success: false, error: result.error };
    } catch (error: any) {
      const errorMsg = error.message || "Failed to create table";
      set({ error: errorMsg });
      return { success: false, error: errorMsg };
    } finally {
      set({ isCreating: false });
    }
  },

  // Join existing table
  joinTable: async (tableId, userId) => {
    set({ isJoining: true, error: null });

    const supabase = createClient();

    try {
      const { data, error } = await supabase.rpc("join_table", {
        p_user_id: userId,
        p_table_id: tableId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };

      if (result.success) {
        // Get the room_id from the table to refresh
        const table = get().getTableById(tableId);
        if (table) {
          set({ currentTableId: tableId, chatScope: "table" });
          await get().fetchTables(table.room_id);
        }
        return { success: true };
      }

      set({ error: result.error || "Failed to join table" });
      return { success: false, error: result.error };
    } catch (error: any) {
      const errorMsg = error.message || "Failed to join table";
      set({ error: errorMsg });
      return { success: false, error: errorMsg };
    } finally {
      set({ isJoining: false });
    }
  },

  // Leave current table
  leaveTable: async (userId) => {
    set({ isLeaving: true, error: null });

    const currentTableId = get().currentTableId;
    const supabase = createClient();

    // Get the room_id before leaving
    const currentTable = get().tables.find((t) => t.id === currentTableId);
    const roomId = currentTable?.room_id;

    try {
      // Try RPC first
      const { error } = await supabase.rpc("leave_table", {
        p_user_id: userId,
      });

      if (error) {
        // Fallback: directly delete from table_members if RPC fails
        console.warn("leave_table RPC failed, trying direct delete:", error.message);
        const { error: deleteError } = await supabase
          .from("table_members")
          .delete()
          .eq("user_id", userId);

        if (deleteError) {
          throw deleteError;
        }
      }

      set({ currentTableId: null, chatScope: "room" });

      // Refresh tables if we have room_id
      if (roomId) {
        await get().fetchTables(roomId);
      }
    } catch (error: any) {
      // Ignore AbortError from React StrictMode
      if (error?.name === "AbortError" || error?.message?.includes("aborted")) {
        set({ isLeaving: false });
        return;
      }
      console.error("Error leaving table:", error);
      set({ error: "Failed to leave table" });
    } finally {
      set({ isLeaving: false });
    }
  },

  // Set chat scope
  setChatScope: (scope) => {
    // Can only set to 'table' if user is at a table
    if (scope === "table" && !get().currentTableId) {
      return;
    }
    set({ chatScope: scope });
  },

  // Get table by ID
  getTableById: (tableId) => {
    return get().tables.find((t) => t.id === tableId);
  },

  // Get user's current table
  getUserTable: (userId) => {
    return get().tables.find((t) =>
      t.members?.some((m) => m.user_id === userId)
    );
  },

  // Check if table is full
  isTableFull: (tableId) => {
    const table = get().getTableById(tableId);
    return table ? (table.members?.length || 0) >= table.max_capacity : true;
  },

  // Get member count for a table
  getTableMemberCount: (tableId) => {
    const table = get().getTableById(tableId);
    return table?.members?.length || 0;
  },

  // Subscribe to realtime updates
  subscribeToTables: (roomId) => {
    const supabase = createClient();

    // Debounce table fetches to avoid duplicate API calls
    let tableDebounceTimer: NodeJS.Timeout | null = null;
    const debouncedFetchTables = () => {
      if (tableDebounceTimer) {
        clearTimeout(tableDebounceTimer);
      }
      tableDebounceTimer = setTimeout(() => {
        get().fetchTables(roomId);
        tableDebounceTimer = null;
      }, 300);
    };

    const tablesChannel = supabase
      .channel(`room-${roomId}-tables`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_tables",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          // Refetch tables on any change (debounced)
          debouncedFetchTables();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table_members",
        },
        (payload) => {
          // Check if this affects our room's tables
          const tables = get().tables;
          const tableIds = tables.map((t) => t.id);

          // For INSERT/DELETE, check if the table_id is in our room
          const newTableId = payload.new && "table_id" in payload.new ? (payload.new as any).table_id : null;
          const oldTableId = payload.old && "table_id" in payload.old ? (payload.old as any).table_id : null;

          if ((newTableId && tableIds.includes(newTableId)) || (oldTableId && tableIds.includes(oldTableId))) {
            debouncedFetchTables();
          }
        }
      )
      .subscribe();

    return () => {
      if (tableDebounceTimer) {
        clearTimeout(tableDebounceTimer);
      }
      supabase.removeChannel(tablesChannel);
    };
  },

  // Reset store
  reset: () => {
    set({
      tables: [],
      currentTableId: null,
      chatScope: "room",
      isLoading: false,
      isJoining: false,
      isCreating: false,
      isLeaving: false,
      error: null,
    });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));
