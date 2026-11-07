"use client";

import { hasProAccess, isAllFeaturesFree } from "@/lib/access";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { RoomCard } from "@/components/rooms/room-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { useRoomStore } from "@/stores/room-store";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { RoomCategory } from "@/types/database.types";
import {
  Users,
  Sparkles,
  Search,
  Star,
  Crown,
  Filter,
  X,
  BookOpen,
  Landmark,
  Newspaper,
  Briefcase,
  Loader2,
  Plus,
  UserPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

interface Room {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  category_id: number | null;
  is_active: boolean;
  created_at: string;
  privacy_level?: "public" | "private" | "premium";
  owner_id?: string | null;
  icon?: string | null;
  color?: string;
  tags?: string[];
}

interface RoomsClientProps {
  rooms: Room[];
}

// Icon mapping for dynamic categories
const iconMap: Record<string, typeof Users> = {
  Users,
  BookOpen,
  Landmark,
  Newspaper,
  Briefcase,
  Crown,
};

// Color mapping for Tailwind classes
const colorMap: Record<string, { text: string; bg: string }> = {
  teal: { text: "text-teal-400", bg: "bg-teal-500/20 border-teal-500/30" },
  blue: { text: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30" },
  amber: { text: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/30" },
  cyan: { text: "text-cyan-400", bg: "bg-cyan-500/20 border-cyan-500/30" },
  rose: { text: "text-rose-400", bg: "bg-rose-500/20 border-rose-500/30" },
  purple: { text: "text-purple-400", bg: "bg-purple-500/20 border-purple-500/30" },
  green: { text: "text-green-400", bg: "bg-green-500/20 border-green-500/30" },
  orange: { text: "text-orange-400", bg: "bg-orange-500/20 border-orange-500/30" },
};

interface ProMember {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export function RoomsClient({ rooms: initialRooms }: RoomsClientProps) {
  const { user, profile } = useAuthStore();
  const { subscriptions, fetchSubscriptions, onlineCountByRoom } = useRoomStore();
  const supabase = createClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showSubscribedOnly, setShowSubscribedOnly] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);

  // Create room state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteResults, setInviteResults] = useState<ProMember[]>([]);
  const [invitedMembers, setInvitedMembers] = useState<ProMember[]>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);

  // Fetch categories from database
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch("/api/room-categories");
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setIsCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Fetch subscriptions when user is logged in
  useEffect(() => {
    if (user) {
      fetchSubscriptions(user.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Fetch user's subscribed private rooms (not included in the public listing)
  useEffect(() => {
    if (!subscriptions.length) return;

    const subscribedRoomIds = subscriptions.map((s) => s.room_id);
    const alreadyLoaded = new Set(rooms.map((r) => r.id));
    const missingIds = subscribedRoomIds.filter((id) => !alreadyLoaded.has(id));

    if (missingIds.length === 0) return;

    const fetchPrivateRooms = async () => {
      const { data } = await supabase
        .from("rooms")
        .select("*")
        .in("id", missingIds)
        .eq("is_active", true);

      if (data?.length) {
        setRooms((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const newRooms = data.filter((r) => !existingIds.has(r.id));
          return newRooms.length ? [...prev, ...newRooms] : prev;
        });
      }
    };

    fetchPrivateRooms();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptions]);

  // Search Pro members for invite (by name or @username)
  useEffect(() => {
    if (!inviteSearch.trim() || inviteSearch.length < 2) {
      setInviteResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearchingMembers(true);
      try {
        const searchTerm = inviteSearch.startsWith("@")
          ? inviteSearch.slice(1)
          : inviteSearch;

        let memberQuery = supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url");
        if (!isAllFeaturesFree()) {
          memberQuery = memberQuery.eq("is_pro_member", true);
        }
        const { data, error } = await memberQuery
          .neq("id", user?.id || "")
          .or(`full_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`)
          .limit(5);

        if (!error && data) {
          // Filter out already invited members
          const filtered = data.filter(
            (m) => !invitedMembers.some((inv) => inv.id === m.id)
          );
          setInviteResults(filtered as ProMember[]);
        }
      } catch {
        console.error("Error searching members");
      } finally {
        setIsSearchingMembers(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [inviteSearch, user?.id, invitedMembers, supabase]);

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      toast.error("Room name is required");
      return;
    }
    if (!user) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from("rooms")
        .insert({
          name: roomName.trim(),
          description: roomDescription.trim() || null,
          privacy_level: "premium",
          owner_id: user.id,
          is_active: true,
          max_tables: 10,
        })
        .select()
        .single();

      if (error) {
        toast.error("Failed to create room: " + error.message);
        return;
      }

      if (data) {
        // Subscribe invited members to the room
        if (invitedMembers.length > 0) {
          const subscriptionRows = invitedMembers.map((member) => ({
            user_id: member.id,
            room_id: data.id,
            is_favorite: false,
            notification_level: "normal" as const,
          }));

          await supabase
            .from("user_room_subscriptions")
            .insert(subscriptionRows);

          // Notify invited members
          const notificationRows = invitedMembers.map((member) => ({
            user_id: member.id,
            room_id: data.id,
            type: "room_update" as const,
            title: "Room Invitation",
            message: `${profile?.full_name || "Someone"} invited you to "${data.name}"`,
            metadata: { invitedBy: user.id, roomName: data.name },
          }));

          await supabase.from("room_notifications").insert(notificationRows);
        }

        // Also subscribe the creator
        await supabase
          .from("user_room_subscriptions")
          .insert({
            user_id: user.id,
            room_id: data.id,
            is_favorite: false,
            notification_level: "normal",
          });

        setRooms((prev) => [data, ...prev]);
        toast.success("Room created! Invited members can now join.");
        setCreateDialogOpen(false);
        setRoomName("");
        setRoomDescription("");
        setInvitedMembers([]);
        setInviteSearch("");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  const addInvitedMember = (member: ProMember) => {
    setInvitedMembers((prev) => [...prev, member]);
    setInviteResults((prev) => prev.filter((m) => m.id !== member.id));
    setInviteSearch("");
  };

  const removeInvitedMember = (memberId: string) => {
    setInvitedMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  // Create subscription lookup maps
  const subscriptionMap = useMemo(() => {
    const map: Record<number, { isSubscribed: boolean; isFavorite: boolean }> = {};
    subscriptions.forEach((sub) => {
      map[sub.room_id] = {
        isSubscribed: true,
        isFavorite: sub.is_favorite,
      };
    });
    return map;
  }, [subscriptions]);

  // Build category filters from database categories
  const categoryFilters = useMemo(() => {
    const filters: { id: string; label: string; icon: typeof Users; color?: string }[] = [
      { id: "all", label: "All Halls", icon: Users },
    ];

    categories.forEach((cat) => {
      filters.push({
        id: cat.slug,
        label: cat.label,
        icon: iconMap[cat.icon] || Users,
        color: cat.color,
      });
    });

    // Always add Premium filter
    filters.push({ id: "premium", label: "Premium", icon: Crown, color: "orange" });

    return filters;
  }, [categories]);

  // Filter rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          room.name.toLowerCase().includes(query) ||
          room.description?.toLowerCase().includes(query) ||
          room.category?.toLowerCase().includes(query) ||
          room.tags?.some((tag) => tag.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Category filter
      if (selectedCategory !== "all") {
        if (selectedCategory === "premium") {
          if (room.privacy_level !== "premium") return false;
        } else if (room.category !== selectedCategory) {
          return false;
        }
      }

      // Subscribed only filter
      if (showSubscribedOnly && !subscriptionMap[room.id]?.isSubscribed) {
        return false;
      }

      // Favorites only filter
      if (showFavoritesOnly && !subscriptionMap[room.id]?.isFavorite) {
        return false;
      }

      return true;
    });
  }, [rooms, searchQuery, selectedCategory, showSubscribedOnly, showFavoritesOnly, subscriptionMap]);

  // Count stats
  const subscribedCount = subscriptions.length;
  const favoritesCount = subscriptions.filter((s) => s.is_favorite).length;

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setShowSubscribedOnly(false);
    setShowFavoritesOnly(false);
  };

  const hasActiveFilters = searchQuery || selectedCategory !== "all" || showSubscribedOnly || showFavoritesOnly;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="widget-glass p-6 rounded-2xl"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">
                Study Halls
              </h1>
              <p className="text-white/60 text-sm">
                Join a hall to study with fellow aspirants. Create tables to study in small groups!
              </p>
            </div>
          </div>

          {/* Quick Stats & Create Room */}
          {user && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSubscribedOnly(!showSubscribedOnly)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-colors",
                  showSubscribedOnly
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                {subscribedCount} Joined
              </button>
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-colors",
                  showFavoritesOnly
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                )}
              >
                <Star className="w-3.5 h-3.5" />
                {favoritesCount} Favorites
              </button>

              {/* Create Room - Pro only */}
              {hasProAccess(profile) && (
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="primary-glow">
                      <Plus className="w-4 h-4 mr-1" />
                      Create Room
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="widget-glass border-white/10 sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-white flex items-center gap-2">
                        <Crown className="w-5 h-5 text-orange-400" />
                        Create Premium Room
                      </DialogTitle>
                      <DialogDescription className="text-white/60">
                        Create a premium room for Pro members only. You can invite other Pro members to join.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                      {/* Room Name */}
                      <div className="space-y-2">
                        <Label className="text-white/80">Room Name</Label>
                        <Input
                          value={roomName}
                          onChange={(e) => setRoomName(e.target.value)}
                          placeholder="e.g., SPSC Prelims Strategy"
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                          maxLength={50}
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <Label className="text-white/80">Description (optional)</Label>
                        <Input
                          value={roomDescription}
                          onChange={(e) => setRoomDescription(e.target.value)}
                          placeholder="What's this room about?"
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                          maxLength={150}
                        />
                      </div>

                      {/* Invite Pro Members */}
                      <div className="space-y-2">
                        <Label className="text-white/80 flex items-center gap-1.5">
                          <UserPlus className="w-3.5 h-3.5" />
                          Invite Pro Members
                        </Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                          <Input
                            value={inviteSearch}
                            onChange={(e) => setInviteSearch(e.target.value)}
                            placeholder="Search by name or @username..."
                            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40 text-sm"
                          />
                          {isSearchingMembers && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 animate-spin" />
                          )}
                        </div>

                        {/* Search Results */}
                        {inviteResults.length > 0 && (
                          <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                            {inviteResults.map((member) => (
                              <button
                                key={member.id}
                                onClick={() => addInvitedMember(member)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
                              >
                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary">
                                  {member.full_name?.charAt(0)?.toUpperCase() || "?"}
                                </div>
                                <div className="flex flex-col items-start">
                                  <span>{member.full_name || "Unknown"}</span>
                                  {member.username && (
                                    <span className="text-xs text-white/40">@{member.username}</span>
                                  )}
                                </div>
                                <Crown className="w-3 h-3 text-orange-400 ml-auto" />
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Invited Members List */}
                        {invitedMembers.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {invitedMembers.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary"
                              >
                                <span>
                                  {member.username
                                    ? `@${member.username}`
                                    : member.full_name || "Unknown"}
                                </span>
                                <button
                                  onClick={() => removeInvitedMember(member.id)}
                                  className="hover:text-red-400 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <p className="text-xs text-white/40">
                          Only Pro members can be invited. Search by name or @username.
                        </p>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setCreateDialogOpen(false)}
                        className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateRoom}
                        disabled={!roomName.trim() || isCreating}
                        className="primary-glow"
                      >
                        {isCreating ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        Create Room
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rooms by name, description, or tags..."
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Filter Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "bg-white/5 border-white/10 text-white hover:bg-white/10",
                selectedCategory !== "all" && "border-primary/30 text-primary"
              )}
            >
              {isCategoriesLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Filter className="w-4 h-4 mr-2" />
              )}
              {categoryFilters.find((c) => c.id === selectedCategory)?.label || "Filter"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="widget-glass border-white/10 w-48">
            {categoryFilters.map((category) => {
              const Icon = category.icon;
              return (
                <DropdownMenuItem
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    "cursor-pointer",
                    selectedCategory === category.id && "bg-primary/20 text-primary"
                  )}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {category.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={clearFilters}
            className="text-white/50 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </motion.div>

      {/* Category Pills (Desktop) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="hidden md:flex flex-wrap gap-2"
      >
        {isCategoriesLoading ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 text-white/40 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading categories...
          </div>
        ) : (
          categoryFilters.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors",
                  selectedCategory === category.id
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-white/5 text-white/60 hover:bg-white/10 border border-transparent"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {category.label}
              </button>
            );
          })
        )}
      </motion.div>

      {/* Results Count */}
      {hasActiveFilters && (
        <p className="text-sm text-white/50">
          Showing {filteredRooms.length} of {rooms.length} rooms
        </p>
      )}

      {/* Rooms Grid */}
      {filteredRooms.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map((room, index) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <RoomCard
                room={room}
                onlineCount={onlineCountByRoom[room.id]}
                isSubscribed={subscriptionMap[room.id]?.isSubscribed || false}
                isFavorite={subscriptionMap[room.id]?.isFavorite || false}
                showActions={!!user}
                categories={categories}
                userId={user?.id}
                onRoomUpdated={(roomId, newName) => {
                  setRooms((prev) =>
                    prev.map((r) =>
                      r.id === roomId ? { ...r, name: newName } : r
                    )
                  );
                }}
                onRoomDeleted={(roomId) => {
                  setRooms((prev) => prev.filter((r) => r.id !== roomId));
                }}
              />
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="widget-glass p-12 rounded-xl text-center"
        >
          <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No study halls found</h3>
          <p className="text-sm text-white/50 mb-4">
            {hasActiveFilters
              ? "Try adjusting your search or filters"
              : "No study halls available at the moment"}
          </p>
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={clearFilters}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10"
            >
              Clear Filters
            </Button>
          )}
        </motion.div>
      )}

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="widget-glass p-4 rounded-xl flex items-center gap-3"
      >
        <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
        <p className="text-sm text-white/60">
          Study halls include timers, real-time chat, and tables for small group study (up to 4 people).
          Your study time is logged automatically.
          {user && " Subscribe to halls to receive notifications and track your favorites."}
        </p>
      </motion.div>
    </div>
  );
}
