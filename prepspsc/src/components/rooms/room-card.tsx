"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useRoomStore } from "@/stores/room-store";
import { toast } from "sonner";
import type { RoomCategory } from "@/types/database.types";
import {
  Users,
  BookOpen,
  Landmark,
  Newspaper,
  Briefcase,
  MessageCircle,
  Crown,
  Lock,
  Star,
  StarOff,
  Bell,
  BellOff,
  Check,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

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

interface RoomCardProps {
  room: Room;
  onlineCount?: number;
  isSubscribed?: boolean;
  isFavorite?: boolean;
  unreadCount?: number;
  showActions?: boolean;
  categories?: RoomCategory[];
  userId?: string;
  onRoomUpdated?: (roomId: number, newName: string) => void;
  onRoomDeleted?: (roomId: number) => void;
}

// Icon mapping
const iconMap: Record<string, typeof Users> = {
  Users,
  BookOpen,
  Landmark,
  Newspaper,
  Briefcase,
  Crown,
};

// Color mapping for Tailwind classes
const colorMap: Record<string, { icon: typeof Users; color: string; bg: string }> = {
  teal: {
    icon: Users,
    color: "text-teal-400",
    bg: "bg-teal-500/20 border-teal-500/30",
  },
  blue: {
    icon: BookOpen,
    color: "text-blue-400",
    bg: "bg-blue-500/20 border-blue-500/30",
  },
  amber: {
    icon: Landmark,
    color: "text-amber-400",
    bg: "bg-amber-500/20 border-amber-500/30",
  },
  cyan: {
    icon: Newspaper,
    color: "text-cyan-400",
    bg: "bg-cyan-500/20 border-cyan-500/30",
  },
  rose: {
    icon: Briefcase,
    color: "text-rose-400",
    bg: "bg-rose-500/20 border-rose-500/30",
  },
  purple: {
    icon: Users,
    color: "text-purple-400",
    bg: "bg-purple-500/20 border-purple-500/30",
  },
  green: {
    icon: Users,
    color: "text-green-400",
    bg: "bg-green-500/20 border-green-500/30",
  },
  orange: {
    icon: Crown,
    color: "text-orange-400",
    bg: "bg-orange-500/20 border-orange-500/30",
  },
};

// Default fallback config
const defaultConfig = {
  icon: Users,
  color: "text-teal-400",
  bg: "bg-teal-500/20 border-teal-500/30",
};

export function RoomCard({
  room,
  onlineCount: providedOnlineCount,
  isSubscribed = false,
  isFavorite = false,
  unreadCount = 0,
  showActions = true,
  categories = [],
  userId,
  onRoomUpdated,
  onRoomDeleted,
}: RoomCardProps) {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { subscribeToRoom, unsubscribeFromRoom, toggleFavorite } = useRoomStore();
  const [isLoading, setIsLoading] = useState(false);

  // Edit/Delete state (for room owners)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState(room.name);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);

  const isOwner = userId && room.owner_id && userId === room.owner_id;

  // Get category config from database categories or fallback to color map
  const getCategoryConfig = () => {
    if (room.category_id && categories.length > 0) {
      const category = categories.find((c) => c.id === room.category_id);
      if (category) {
        const colorConfig = colorMap[category.color] || defaultConfig;
        return {
          icon: iconMap[category.icon] || Users,
          color: colorConfig.color,
          bg: colorConfig.bg,
          label: category.label,
        };
      }
    }

    // Fallback to slug-based lookup for backward compatibility
    if (room.category) {
      const category = categories.find((c) => c.slug === room.category);
      if (category) {
        const colorConfig = colorMap[category.color] || defaultConfig;
        return {
          icon: iconMap[category.icon] || Users,
          color: colorConfig.color,
          bg: colorConfig.bg,
          label: category.label,
        };
      }
    }

    return { ...defaultConfig, label: "General" };
  };

  const config = getCategoryConfig();
  const Icon = config.icon;
  const onlineCount = providedOnlineCount ?? 0;

  const isPremiumRoom = room.privacy_level === "premium";
  const canAccess = !isPremiumRoom || profile?.is_pro_member;

  const handleRename = async () => {
    if (!newRoomName.trim() || newRoomName.trim() === room.name) {
      setRenameDialogOpen(false);
      return;
    }

    setIsRenaming(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("rooms")
        .update({ name: newRoomName.trim() })
        .eq("id", room.id);

      if (error) {
        toast.error("Failed to rename room: " + error.message);
      } else {
        toast.success("Room renamed successfully");
        onRoomUpdated?.(room.id, newRoomName.trim());
        setRenameDialogOpen(false);
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("rooms")
        .delete()
        .eq("id", room.id);

      if (error) {
        toast.error("Failed to delete room: " + error.message);
      } else {
        toast.success("Room deleted");
        onRoomDeleted?.(room.id);
        setDeleteDialogOpen(false);
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleJoin = () => {
    if (isPremiumRoom && !canAccess) {
      toast.error("This is a premium room. Upgrade to Pro to access.");
      router.push("/pricing");
      return;
    }
    router.push(`/room/${room.id}`);
  };

  const handleSubscribe = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Please sign in to subscribe to rooms");
      return;
    }

    setIsLoading(true);
    try {
      if (isSubscribed) {
        await unsubscribeFromRoom(user.id, room.id);
        toast.success("Unsubscribed from room");
      } else {
        await subscribeToRoom(user.id, room.id);
        toast.success("Subscribed to room");
      }
    } catch {
      toast.error("Failed to update subscription");
    }
    setIsLoading(false);
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !isSubscribed) return;

    try {
      await toggleFavorite(user.id, room.id);
      toast.success(isFavorite ? "Removed from favorites" : "Added to favorites");
    } catch {
      toast.error("Failed to update favorite");
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={cn(
        "widget-glass p-5 rounded-xl cursor-pointer transition-all duration-300 relative",
        "border hover:border-primary/30",
        isPremiumRoom && !canAccess && "opacity-75"
      )}
      onClick={handleJoin}
    >
      {/* Unread Badge */}
      {unreadCount > 0 && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-medium">
          {unreadCount > 9 ? "9+" : unreadCount}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2.5 rounded-xl border", config.bg)}>
          <Icon className={cn("w-5 h-5", config.color)} />
        </div>
        <div className="flex items-center gap-2">
          {/* Privacy Badge */}
          {isPremiumRoom && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs border border-orange-500/30">
              <Crown className="w-3 h-3" />
              Pro
            </div>
          )}
          {/* Online Count */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 text-white/60 text-xs">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {onlineCount} online
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-base font-semibold text-white">{room.name}</h3>
        {isFavorite && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
      </div>
      {room.description && (
        <p className="text-sm text-white/50 line-clamp-2 mb-4">
          {room.description}
        </p>
      )}

      {/* Tags */}
      {room.tags && room.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {room.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/40"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Category Badge & Actions */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "px-2 py-1 rounded-full text-xs border",
            config.bg,
            config.color
          )}
        >
          {config.label}
        </span>

        <div className="flex items-center gap-2">
          {/* Subscription Actions */}
          {showActions && user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 p-0",
                    isSubscribed ? "text-primary" : "text-white/50"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isSubscribed ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Users className="w-4 h-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="widget-glass border-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem onClick={handleSubscribe} disabled={isLoading}>
                  {isSubscribed ? (
                    <>
                      <Users className="w-4 h-4 mr-2" />
                      Leave Room
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4 mr-2" />
                      Join Room
                    </>
                  )}
                </DropdownMenuItem>
                {isSubscribed && (
                  <>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={handleToggleFavorite}>
                      {isFavorite ? (
                        <>
                          <StarOff className="w-4 h-4 mr-2" />
                          Remove Favorite
                        </>
                      ) : (
                        <>
                          <Star className="w-4 h-4 mr-2" />
                          Add Favorite
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Bell className="w-4 h-4 mr-2" />
                      Notification Settings
                    </DropdownMenuItem>
                  </>
                )}
                {isOwner && (
                  <>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewRoomName(room.name);
                        setRenameDialogOpen(true);
                      }}
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Rename Room
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteDialogOpen(true);
                      }}
                      className="text-red-400 focus:text-red-400"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Room
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Join Button */}
          <Button
            size="sm"
            className={cn(
              isPremiumRoom && !canAccess
                ? "bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30"
                : "bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleJoin();
            }}
            onMouseEnter={() => setIsButtonHovered(true)}
            onMouseLeave={() => setIsButtonHovered(false)}
            onTouchStart={() => setIsButtonHovered(true)}
            onTouchEnd={() => setIsButtonHovered(false)}
          >
            {isPremiumRoom && !canAccess ? (
              <>
                <Lock className="w-4 h-4 mr-1" />
                Upgrade
              </>
            ) : (
              <span className="relative inline-flex items-center justify-center overflow-hidden w-12 h-5">
                <motion.span
                  className="absolute inset-0 flex items-center justify-center"
                  animate={{ opacity: isButtonHovered ? 0 : 1 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  Peek
                </motion.span>
                <motion.span
                  className="absolute inset-0 flex items-center justify-center"
                  animate={{ opacity: isButtonHovered ? 1 : 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  Enter
                </motion.span>
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Chat Preview Indicator */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-white/40">
        <MessageCircle className="w-3.5 h-3.5" />
        <span>Real-time chat + Study timer</span>
      </div>

      {/* Rename Dialog */}
      {isOwner && (
        <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
          <DialogContent
            className="widget-glass border-white/10 sm:max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-primary" />
                Rename Room
              </DialogTitle>
              <DialogDescription className="text-white/60">
                Enter a new name for your room.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Input
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                maxLength={50}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                }}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRenameDialogOpen(false)}
                disabled={isRenaming}
                className="bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRename}
                disabled={isRenaming || !newRoomName.trim()}
                className="primary-glow"
              >
                {isRenaming ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Pencil className="w-4 h-4 mr-2" />
                )}
                Rename
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {isOwner && (
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent
            className="widget-glass border-white/10 sm:max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-400" />
                Delete Room
              </DialogTitle>
              <DialogDescription className="text-white/60">
                Are you sure you want to delete &quot;{room.name}&quot;? This action
                cannot be undone. All messages and members will be removed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
                className="bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  );
}
