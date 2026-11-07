"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useBuddyStore } from "@/stores/buddy-store";
import { UserPlus, Search, Loader2, Link2, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SearchResult {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  xp_level: number;
}

interface AddBuddyDialogProps {
  userId: string;
}

export function AddBuddyDialog({ userId }: AddBuddyDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { fetchMatches } = useBuddyStore();

  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/buddies?invite=${userId}`
      : "";

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);
    if (searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const supabase = createClient();
      const cleanQuery = searchQuery.replace("@", "").trim();

      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, xp_level")
        .neq("id", userId)
        .not("username", "is", null)
        .or(
          `username.ilike.%${cleanQuery}%,full_name.ilike.%${cleanQuery}%`
        )
        .limit(5);

      setResults(data || []);
    } catch {
      console.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = async (targetId: string) => {
    setAddingId(targetId);
    try {
      const res = await fetch("/api/buddy/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_user_id: targetId, source: "search" }),
      });
      const data = await res.json();

      if (data.matched) {
        toast.success("You're already matched!");
        fetchMatches(userId);
        setOpen(false);
      } else if (data.requestSent) {
        toast.success("Buddy request sent!");
        setOpen(false);
      } else {
        toast.error(data.error || "Failed to send request");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setAddingId(null);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Invite link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-pink-500/30 text-pink-400 hover:bg-pink-500/10"
        >
          <UserPlus className="w-4 h-4 mr-1.5" />
          Add Buddy
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Add a Study Buddy</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by @username or name"
              className="pl-10 border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500"
            />
          </div>

          {/* Results */}
          {isSearching ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {results.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                      {(
                        user.full_name ||
                        user.username ||
                        "?"
                      )[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {user.full_name || user.username}
                    </p>
                    {user.username && (
                      <p className="text-xs text-zinc-500">
                        @{user.username} · Lv.{user.xp_level}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAdd(user.id)}
                    disabled={addingId === user.id}
                    className="shrink-0 bg-pink-500 hover:bg-pink-600 text-white"
                  >
                    {addingId === user.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <p className="text-sm text-zinc-500 text-center py-3">
              No users found
            </p>
          ) : null}

          {/* Invite Link */}
          <div className="border-t border-zinc-800 pt-4">
            <p className="text-xs text-zinc-400 mb-2">
              Or share your invite link:
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={inviteLink}
                className="flex-1 text-xs border-zinc-700 bg-zinc-800/50 text-zinc-400"
              />
              <Button
                onClick={handleCopyLink}
                size="icon"
                variant="outline"
                className={cn(
                  "shrink-0 border-zinc-700",
                  copied && "border-green-500 text-green-400"
                )}
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
