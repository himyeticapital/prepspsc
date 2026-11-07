"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Users, ChevronDown, Check, Star, Crown, Lock, ExternalLink, Reply, Trash2, X, AtSign, User, Trophy, Zap, Flame, Target } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useWidgetStore } from "@/stores/widget-store";
import { useRoomStore } from "@/stores/room-store";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ProfileFrame } from "@/types/database.types";

interface Message {
  id: string;
  user: {
    id: string;
    name: string;
    color: string;
    avatar_url?: string | null;
    profile_frame?: string | null;
  };
  content: string;
  timestamp: string;
  isMe: boolean;
  reply_to?: {
    id: string;
    user_name: string;
    content: string;
  } | null;
}

interface RoomMember {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface UserProfile {
  id: string;
  full_name: string;
  username: string;
  avatar_url?: string | null;
  profile_frame?: string | null;
  xp_points: number;
  xp_level: number;
  current_streak: number;
  total_minutes_all_time: number;
}

export function ChatWidget() {
  const router = useRouter();
  const { currentChatRoomId, setChatRoom } = useWidgetStore();
  const { user, profile } = useAuthStore();
  const { rooms, subscriptions, onlineCountByRoom, fetchRooms, fetchSubscriptions } = useRoomStore();
  const [messagesByRoom, setMessagesByRoom] = useState<Record<number, Message[]>>({});
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const [profileFrames, setProfileFrames] = useState<ProfileFrame[]>([]);

  const isSubscribedToCurrentRoom = subscriptions.some((s) => s.room_id === currentChatRoomId);
  const currentRoomData = rooms.find((r) => r.id === currentChatRoomId);
  const isPremiumLocked = currentRoomData?.privacy_level === "premium" && !profile?.is_pro_member;

  // Helper to get frame CSS class from slug
  const getFrameClass = (frameSlug?: string | null) => {
    if (!frameSlug || profileFrames.length === 0) return "ring-2 ring-white/20";
    const frame = profileFrames.find((f) => f.slug === frameSlug);
    return frame?.css_class || "ring-2 ring-white/20";
  };

  // Fetch profile frames (small static table)
  useEffect(() => {
    const fetchFrames = async () => {
      const { data } = await supabase
        .from("profile_frames")
        .select("*")
        .order("sort_order", { ascending: true });
      if (data) setProfileFrames(data);
    };
    fetchFrames();
  }, [supabase]);

  // Fetch rooms and subscriptions if logged in
  useEffect(() => {
    fetchRooms();
    if (user) {
      fetchSubscriptions(user.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Fetch room members for mentions
  useEffect(() => {
    const fetchRoomMembers = async () => {
      if (!currentChatRoomId) return;

      try {
        // First try to get members from room_presence
        const { data: presenceData, error: presenceError } = await supabase
          .from("room_presence")
          .select(`
            user_id,
            profiles!inner(id, username, full_name, avatar_url)
          `)
          .eq("room_id", currentChatRoomId)
          .order("last_seen_at", { ascending: false })
          .limit(50);

        if (presenceData && presenceData.length > 0) {
          const members: RoomMember[] = presenceData.map((item: any) => ({
            id: item.profiles?.id || item.user_id || "",
            name: item.profiles?.full_name || item.profiles?.username || "",
            avatar_url: item.profiles?.avatar_url,
          })).filter((m: RoomMember) => m.id && m.name);

          setRoomMembers(members);
          return;
        }

        // Fallback: Get members from recent messages in this room
        const { data: messageData } = await supabase
          .from("messages")
          .select(`
            user_id,
            profile:profiles!messages_user_id_fkey(id, username, full_name, avatar_url)
          `)
          .eq("room_id", currentChatRoomId)
          .order("created_at", { ascending: false })
          .limit(100);

        if (messageData) {
          // Get unique users from messages
          const uniqueUsers = new Map<string, RoomMember>();
          messageData.forEach((item: any) => {
            const userId = item.user_id;
            if (userId && !uniqueUsers.has(userId)) {
              uniqueUsers.set(userId, {
                id: item.profile?.id || userId,
                name: item.profile?.full_name || item.profile?.username || "",
                avatar_url: item.profile?.avatar_url,
              });
            }
          });
          setRoomMembers(Array.from(uniqueUsers.values()));
        }
      } catch (err) {
        console.error("Error fetching room members:", err);
      }
    };

    fetchRoomMembers();
  }, [currentChatRoomId, supabase]);

  // Fetch messages for current room
  useEffect(() => {
    let isCancelled = false;

    const fetchMessages = async () => {
      if (!currentChatRoomId) {
        console.log("❌ No room ID selected");
        return;
      }

      // Skip if we already have messages for this room
      if (messagesByRoom[currentChatRoomId]) {
        console.log("✓ Using cached messages for room:", currentChatRoomId);
        return;
      }

      console.log("📡 Fetching messages for room:", currentChatRoomId);
      setIsLoadingMessages(true);

      try {
        // Try fetching messages - handle case where reply_to FK might have different name
        let data: any = null;
        let error: any = null;

        // First attempt: try with standard FK naming
        try {
          const result = await supabase
            .from("messages")
            .select(`
              *,
              profile:profiles!messages_user_id_fkey(*),
              reply_message:messages!reply_to(
                id,
                content,
                user_id,
                profile:profiles!messages_user_id_fkey(*)
              )
            `)
            .eq("room_id", currentChatRoomId)
            .eq("is_deleted", false)
            .eq("message_scope", "room")
            .order("created_at", { ascending: true })
            .limit(50);

          data = result.data;
          error = result.error;
        } catch (err) {
          console.error("Query error:", err);
          error = err;
        }

        if (isCancelled) return;

        if (error) {
          if (error?.message?.includes("aborted") || error?.message?.includes("AbortError")) {
            return;
          }
          console.error("Failed to fetch messages:", error);
          console.error("Room ID:", currentChatRoomId);
          console.error("User ID:", user?.id);
        } else if (data) {
          console.log("✅ Fetched messages successfully:", data.length);
          console.log("Room ID:", currentChatRoomId);
          const formattedMessages: Message[] = data.map((msg: any) => ({
            id: msg.id.toString(),
            user: {
              id: msg.user_id,
              name: msg.profile?.full_name || msg.profile?.username || "",
              color: "bg-primary",
              avatar_url: msg.profile?.avatar_url,
              profile_frame: msg.profile?.profile_frame,
            },
            content: msg.content || "",
            timestamp: new Date(msg.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isMe: msg.user_id === user?.id,
            reply_to: msg.reply_message ? {
              id: msg.reply_message.id,
              user_name: msg.reply_message.profile?.full_name || msg.reply_message.profile?.username || "",
              content: msg.reply_message.content,
            } : null,
          }));

          setMessagesByRoom((prev) => ({
            ...prev,
            [currentChatRoomId]: formattedMessages,
          }));
        }
      } catch (err: any) {
        if (isCancelled) return;
        if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
          return;
        }
        console.error("Error fetching messages:", err);
      } finally {
        if (!isCancelled) {
          setIsLoadingMessages(false);
        }
      }
    };

    fetchMessages();

    return () => {
      isCancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChatRoomId, user?.id]);

  // Use real rooms from store
  const displayRooms = useMemo(() => {
    return rooms.map((r) => ({
      id: r.id,
      name: r.name,
      online: onlineCountByRoom[r.id] || 0,
      isFavorite: subscriptions.find((s) => s.room_id === r.id)?.is_favorite || false,
      isSubscribed: subscriptions.some((s) => s.room_id === r.id),
      isPremium: r.privacy_level === "premium",
    }));
  }, [rooms, subscriptions, onlineCountByRoom]);

  // Sort: favorites first, then subscribed, then others
  const sortedRooms = useMemo(() => {
    return [...displayRooms].sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      if (a.isSubscribed && !b.isSubscribed) return -1;
      if (!a.isSubscribed && b.isSubscribed) return 1;
      return 0;
    });
  }, [displayRooms]);

  const currentRoom = displayRooms.find((r) => r.id === currentChatRoomId) || displayRooms[0] || null;
  const effectiveRoomId = currentRoom?.id || currentChatRoomId;
  const messages = messagesByRoom[effectiveRoomId] || [];

  // Set initial room when rooms load
  useEffect(() => {
    if (displayRooms.length > 0 && !currentChatRoomId) {
      setChatRoom(displayRooms[0].id);
    }
  }, [displayRooms, currentChatRoomId, setChatRoom]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentChatRoomId]);

  // Handle @ mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    // Check for @ mention
    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
      setShowMentions(true);
      setMentionQuery("");
    } else if (lastAtIndex !== -1) {
      const afterAt = value.slice(lastAtIndex + 1);
      if (!afterAt.includes(" ") && !afterAt.includes("\n")) {
        setShowMentions(true);
        setMentionQuery(afterAt.toLowerCase());
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const filteredMembers = useMemo(() => {
    if (!mentionQuery) return roomMembers;
    return roomMembers.filter((m) =>
      m.name.toLowerCase().includes(mentionQuery)
    );
  }, [roomMembers, mentionQuery]);

  const insertMention = (member: RoomMember) => {
    const lastAtIndex = newMessage.lastIndexOf("@");
    const beforeAt = newMessage.slice(0, lastAtIndex);
    setNewMessage(`${beforeAt}@${member.name} `);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;

    const content = newMessage.trim();
    setNewMessage("");
    setReplyingTo(null);

    // Optimistically add message to UI
    const optimisticMessage: Message = {
      id: Date.now().toString(),
      user: {
        id: user.id,
        name: profile?.full_name || profile?.username || "You",
        color: "bg-primary",
        avatar_url: profile?.avatar_url,
        profile_frame: profile?.profile_frame,
      },
      content,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isMe: true,
      reply_to: replyingTo?.reply_to || null,
    };

    setMessagesByRoom((prev) => ({
      ...prev,
      [currentChatRoomId]: [...(prev[currentChatRoomId] || []), optimisticMessage],
    }));

    // Send to database
    const messageData: any = {
      room_id: currentChatRoomId,
      user_id: user.id,
      content,
      type: "text",
      message_scope: "room",
    };

    // Add reply_to if replying to a message
    if (replyingTo) {
      messageData.reply_to = parseInt(replyingTo.id);
    }

    const { error } = await supabase.from("messages").insert(messageData);

    if (error) {
      console.error("Failed to send message:", error.message);
      // Remove optimistic message on error
      setMessagesByRoom((prev) => ({
        ...prev,
        [currentChatRoomId]: (prev[currentChatRoomId] || []).filter(
          (m) => m.id !== optimisticMessage.id
        ),
      }));
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    // Optimistically remove from UI
    setMessagesByRoom((prev) => ({
      ...prev,
      [currentChatRoomId]: (prev[currentChatRoomId] || []).filter((m) => m.id !== messageId),
    }));

    // Soft delete in database
    const { error } = await supabase
      .from("messages")
      .update({ is_deleted: true })
      .eq("id", parseInt(messageId));

    if (error) {
      console.error("Failed to delete message:", error.message);
      // Restore message on error (would need to refetch)
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape") {
      setReplyingTo(null);
    }
    // Shift+Enter will create a new line (default textarea behavior)
  };

  const fetchUserProfile = async (userId: string) => {
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, profile_frame, xp_points, xp_level, current_streak, total_minutes_all_time")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Failed to fetch user profile:", error);
        return;
      }

      setSelectedProfile(data);
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleOpenRoom = () => {
    router.push(`/room/${currentChatRoomId}`);
  };

  const forceRefreshMessages = () => {
    // Clear cached messages and refetch
    setMessagesByRoom((prev) => {
      const newState = { ...prev };
      delete newState[currentChatRoomId];
      return newState;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Room Header with Dropdown */}
      <div className="px-4 py-2 border-b border-white/10">
        {displayRooms.length === 0 ? (
          <div className="p-2 text-center">
            <p className="text-sm text-white/50">No study halls available</p>
          </div>
        ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
              <div className="text-left flex items-center gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-medium text-white">{currentRoom?.name || "Select a room"}</h4>
                    {currentRoom?.isFavorite && (
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    )}
                    {currentRoom?.isPremium && (
                      <Crown className="w-3 h-3 text-orange-400" />
                    )}
                  </div>
                  <p className="text-xs text-white/50">Click to switch rooms</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <Users className="w-3 h-3" />
                  <span>{currentRoom?.online || 0}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-white/50" />
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-72 widget-glass border-white/10"
          >
            {/* Favorites Section */}
            {sortedRooms.some((r) => r.isFavorite) && (
              <>
                <p className="px-2 py-1 text-[10px] text-white/40 uppercase tracking-wider">
                  Favorites
                </p>
                {sortedRooms
                  .filter((r) => r.isFavorite)
                  .map((room) => (
                    <DropdownMenuItem
                      key={room.id}
                      onClick={() => setChatRoom(room.id)}
                      className={cn(
                        "flex items-center justify-between cursor-pointer",
                        currentChatRoomId === room.id && "bg-primary/20"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <div>
                          <p className="text-sm text-white">{room.name}</p>
                          <p className="text-xs text-white/50">{room.online} online</p>
                        </div>
                      </div>
                      {currentChatRoomId === room.id && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuSeparator className="bg-white/10" />
              </>
            )}

            {/* All Rooms */}
            <p className="px-2 py-1 text-[10px] text-white/40 uppercase tracking-wider">
              All Rooms
            </p>
            {sortedRooms
              .filter((r) => !r.isFavorite)
              .map((room) => (
                <DropdownMenuItem
                  key={room.id}
                  onClick={() => setChatRoom(room.id)}
                  className={cn(
                    "flex items-center justify-between cursor-pointer",
                    currentChatRoomId === room.id && "bg-primary/20"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {room.isPremium ? (
                      <Crown className="w-3 h-3 text-orange-400" />
                    ) : room.isSubscribed ? (
                      <Check className="w-3 h-3 text-primary" />
                    ) : (
                      <Users className="w-3 h-3 text-white/30" />
                    )}
                    <div>
                      <p className="text-sm text-white">{room.name}</p>
                      <p className="text-xs text-white/50">{room.online} online</p>
                    </div>
                  </div>
                  {currentChatRoomId === room.id && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}

            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={handleOpenRoom}
              className="cursor-pointer text-primary"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Full Room
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar" style={{ maxHeight: "280px" }}>
        <div className="p-4 space-y-3 pr-1">
          {displayRooms.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/40">No study halls available</p>
              <p className="text-xs text-white/30">Check back later</p>
            </div>
          ) : isPremiumLocked ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-orange-400" />
              </div>
              <p className="text-sm font-medium text-white mb-1">Premium Room</p>
              <p className="text-xs text-white/50 mb-3">Upgrade to Pro to access this room&apos;s chat</p>
              <Button
                size="sm"
                onClick={() => router.push("/pricing")}
                className="bg-orange-500 hover:bg-orange-600 text-white text-xs"
              >
                <Crown className="w-3 h-3 mr-1" />
                Upgrade to Pro
              </Button>
            </div>
          ) : isLoadingMessages ? (
            <div className="text-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-white/40">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/40">No messages yet</p>
              <p className="text-xs text-white/30">Be the first to say hello!</p>
            </div>
          ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex gap-2 group", msg.isMe && "flex-row-reverse")}
            >
              <Popover onOpenChange={(open) => {
                if (open && !msg.isMe) {
                  fetchUserProfile(msg.user.id);
                } else if (!open) {
                  setSelectedProfile(null);
                }
              }}>
                <PopoverTrigger asChild>
                  <button className="flex-shrink-0">
                    <Avatar className={cn("w-7 h-7 cursor-pointer hover:ring-primary transition-all", getFrameClass(msg.user.profile_frame))}>
                      {msg.user.avatar_url && (
                        <AvatarImage src={msg.user.avatar_url} alt={msg.user.name} />
                      )}
                      <AvatarFallback className={cn("text-[10px] text-white", msg.user.color)}>
                        {msg.user.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="right"
                  className="w-72 p-4 widget-glass border-white/10"
                >
                  {loadingProfile ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                  ) : msg.isMe ? (
                    <div className="text-center py-4">
                      <Avatar className={cn("w-16 h-16 mx-auto mb-3", getFrameClass(msg.user.profile_frame))}>
                        {msg.user.avatar_url && (
                          <AvatarImage src={msg.user.avatar_url} alt={msg.user.name} />
                        )}
                        <AvatarFallback className="bg-primary/20 text-primary text-lg">
                          {msg.user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-base font-semibold text-white mb-1">{msg.user.name}</p>
                      <p className="text-xs text-white/50">This is you!</p>
                    </div>
                  ) : selectedProfile ? (
                    <div>
                      {/* Profile Header */}
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
                        <Avatar className={cn("w-14 h-14", getFrameClass(selectedProfile.profile_frame))}>
                          {selectedProfile.avatar_url && (
                            <AvatarImage src={selectedProfile.avatar_url} alt={selectedProfile.full_name} />
                          )}
                          <AvatarFallback className="bg-primary/20 text-primary text-base">
                            {selectedProfile.full_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-semibold text-white truncate">
                            {selectedProfile.full_name}
                          </p>
                          <p className="text-xs text-white/50">
                            @{selectedProfile.username}
                          </p>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {/* Level */}
                        <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Trophy className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[10px] text-white/50 uppercase tracking-wide">Level</span>
                          </div>
                          <p className="text-lg font-bold text-white">{selectedProfile.xp_level}</p>
                        </div>

                        {/* XP */}
                        <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Zap className="w-3.5 h-3.5 text-orange-400" />
                            <span className="text-[10px] text-white/50 uppercase tracking-wide">XP</span>
                          </div>
                          <p className="text-lg font-bold text-white">{selectedProfile.xp_points.toLocaleString()}</p>
                        </div>

                        {/* Streak */}
                        <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Flame className="w-3.5 h-3.5 text-orange-500" />
                            <span className="text-[10px] text-white/50 uppercase tracking-wide">Streak</span>
                          </div>
                          <p className="text-lg font-bold text-white">{selectedProfile.current_streak} days</p>
                        </div>

                        {/* Study Time */}
                        <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Target className="w-3.5 h-3.5 text-green-400" />
                            <span className="text-[10px] text-white/50 uppercase tracking-wide">Study</span>
                          </div>
                          <p className="text-lg font-bold text-white">{Math.floor((selectedProfile.total_minutes_all_time || 0) / 60)}h</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-white/40">Failed to load profile</p>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-2 relative",
                    msg.isMe
                      ? "bg-primary text-primary-foreground rounded-tr-sm ml-auto"
                      : "bg-white/10 text-white rounded-tl-sm"
                  )}
                >
                  {!msg.isMe && msg.user.name && (
                    <p className="text-[10px] font-medium opacity-70 mb-0.5">
                      {msg.user.name}
                    </p>
                  )}

                  {/* Reply indicator */}
                  {msg.reply_to && (
                    <div className={cn(
                      "text-[10px] mb-1 pb-1 border-l-2 pl-2 opacity-70",
                      msg.isMe ? "border-primary-foreground/30" : "border-white/30"
                    )}>
                      {msg.reply_to.user_name && <p className="font-medium">{msg.reply_to.user_name}</p>}
                      <p className="truncate">{msg.reply_to.content}</p>
                    </div>
                  )}

                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <p
                    className={cn(
                      "text-[10px] mt-1",
                      msg.isMe ? "text-primary-foreground/60" : "text-white/40"
                    )}
                  >
                    {msg.timestamp}
                  </p>

                  {/* Message actions */}
                  <div className={cn(
                    "absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1",
                    msg.isMe ? "left-1" : "right-1"
                  )}>
                    {user && isSubscribedToCurrentRoom && (
                      <button
                        onClick={() => setReplyingTo(msg)}
                        className="p-1 rounded bg-black/20 hover:bg-black/40 transition-colors"
                        title="Reply"
                      >
                        <Reply className="w-3 h-3" />
                      </button>
                    )}
                    {msg.isMe && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1 rounded bg-black/20 hover:bg-red-500/80 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        {!user ? (
          <p className="text-center text-sm text-white/40">
            Sign in to chat
          </p>
        ) : isPremiumLocked ? (
          <div className="flex items-center justify-center gap-2 py-2 px-3 bg-orange-500/10 rounded-lg text-orange-400/80 text-xs">
            <Lock className="w-3.5 h-3.5" />
            <span>Pro members only</span>
          </div>
        ) : !isSubscribedToCurrentRoom ? (
          <div className="flex items-center justify-center gap-2 py-2 px-3 bg-white/5 rounded-lg text-white/50 text-xs">
            <Users className="w-3.5 h-3.5" />
            <span>Subscribe to this room to chat</span>
          </div>
        ) : (
          <>
            {/* Reply indicator */}
            {replyingTo && (
              <div className="mb-2 p-2 rounded-lg bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Reply className="w-3 h-3 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-white/60">Replying to {replyingTo.user.name}</p>
                    <p className="text-xs text-white truncate">{replyingTo.content}</p>
                  </div>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                >
                  <X className="w-3 h-3 text-white/50" />
                </button>
              </div>
            )}

            <div className="flex gap-2 relative items-end">
              <Popover open={showMentions} onOpenChange={(open) => {
                  if (!open) setShowMentions(false);
                }}>
                <PopoverTrigger asChild>
                  <div className="flex-1 relative">
                    <Textarea
                      ref={textareaRef}
                      value={newMessage}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Type @ to mention, Shift+Enter for new line..."
                      className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/40 pr-8 min-h-[40px] max-h-[120px] resize-none"
                      rows={1}
                    />
                    <AtSign className="w-4 h-4 text-white/30 absolute right-2 top-3 pointer-events-none" />
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="top"
                  className="w-64 p-1 widget-glass border-white/10"
                >
                  <ScrollArea className="max-h-48">
                    {filteredMembers.length === 0 ? (
                      <div className="p-2 text-center text-xs text-white/40">
                        No members found
                      </div>
                    ) : (
                      filteredMembers.map((member) => (
                        <button
                          key={member.id}
                          onClick={() => insertMention(member)}
                          className="w-full flex items-center gap-2 p-2 rounded hover:bg-white/10 transition-colors text-left"
                        >
                          <Avatar className="w-6 h-6">
                            {member.avatar_url && (
                              <AvatarImage src={member.avatar_url} alt={member.name} />
                            )}
                            <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                              {member.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-white">{member.name}</span>
                        </button>
                      ))
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!newMessage.trim()}
                className="bg-primary hover:bg-primary/90"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
