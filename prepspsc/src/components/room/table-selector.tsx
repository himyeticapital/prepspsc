"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTableStore, type TableWithMembers } from "@/stores/table-store";
import { TableCard } from "./table-card";
import { TABLE_CONSTANTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Plus, Loader2, Users, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface TableSelectorProps {
  roomId: number;
  roomName: string;
  userId: string;
  maxTables?: number;
}

export function TableSelector({
  roomId,
  roomName,
  userId,
  maxTables = TABLE_CONSTANTS.DEFAULT_MAX_TABLES_PER_ROOM,
}: TableSelectorProps) {
  const {
    tables,
    currentTableId,
    isLoading,
    isCreating,
    isJoining,
    isLeaving,
    error,
    createTable,
    joinTable,
    leaveTable,
    clearError,
  } = useTableStore();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tableName, setTableName] = useState("");

  const canCreateTable = tables.length < maxTables;

  const handleCreateTable = async () => {
    if (!userId || !tableName.trim()) return;

    const trimmedName = tableName.trim();
    if (trimmedName.length < TABLE_CONSTANTS.TABLE_NAME_MIN_LENGTH) {
      toast.error(`Table name must be at least ${TABLE_CONSTANTS.TABLE_NAME_MIN_LENGTH} characters`);
      return;
    }

    if (trimmedName.length > TABLE_CONSTANTS.TABLE_NAME_MAX_LENGTH) {
      toast.error(`Table name must be less than ${TABLE_CONSTANTS.TABLE_NAME_MAX_LENGTH} characters`);
      return;
    }

    const result = await createTable(roomId, trimmedName, userId, roomName);

    if (result.success) {
      setIsDialogOpen(false);
      setTableName("");
      toast.success(`Table created! Welcome to "${trimmedName}"`);
    } else {
      toast.error(result.error || "Failed to create table. Please try again.");
    }
  };

  const handleJoinTable = async (tableId: number) => {
    if (!userId) return;

    const result = await joinTable(tableId, userId);

    if (result.success) {
      const table = tables.find((t) => t.id === tableId);
      toast.success(`Joined table! You're now at "${table?.name}"`);
    } else {
      toast.error(result.error || "Failed to join table. Please try again.");
    }
  };

  const handleLeaveTable = async () => {
    if (!userId) return;

    try {
      await leaveTable(userId);
      toast.success("Left table. You're now in the main room.");
    } catch (err) {
      console.error("Error in handleLeaveTable:", err);
      toast.error("Failed to leave table. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="widget-glass p-6 rounded-xl">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <span className="text-sm text-white/60">Loading tables...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="widget-glass p-4 rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-white">Study Tables</h3>
          <span className="text-xs text-white/40">
            ({tables.length}/{maxTables})
          </span>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              disabled={!canCreateTable || !userId}
              className={cn(
                "h-8",
                canCreateTable
                  ? "bg-primary hover:bg-primary/90"
                  : "bg-white/10 text-white/40"
              )}
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Table
            </Button>
          </DialogTrigger>
          <DialogContent className="widget-glass border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white">Create a Study Table</DialogTitle>
              <DialogDescription className="text-white/60">
                Create a table for you and up to 3 friends to study together.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="e.g., Priya's Focus Corner"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                maxLength={TABLE_CONSTANTS.TABLE_NAME_MAX_LENGTH}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/40 mt-2">
                {tableName.length}/{TABLE_CONSTANTS.TABLE_NAME_MAX_LENGTH} characters
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTable}
                disabled={
                  isCreating ||
                  tableName.trim().length < TABLE_CONSTANTS.TABLE_NAME_MIN_LENGTH
                }
                className="bg-primary hover:bg-primary/90"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Table"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20"
        >
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
          <button
            onClick={clearError}
            className="ml-auto text-xs text-red-400 hover:text-red-300"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Tables Grid */}
      {tables.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/50 mb-1">No tables yet</p>
          <p className="text-xs text-white/30">
            Create a table to start studying with friends
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {tables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                isUserTable={table.id === currentTableId}
                isJoining={isJoining}
                isLeaving={isLeaving}
                onJoin={() => handleJoinTable(table.id)}
                onLeave={handleLeaveTable}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Max tables reached warning */}
      {!canCreateTable && (
        <p className="text-xs text-amber-400/80 text-center mt-4">
          Maximum tables reached. Join an existing table or wait for one to free up.
        </p>
      )}
    </div>
  );
}
