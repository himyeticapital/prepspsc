"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, getInitials } from "@/lib/utils";
import { Send, Trash2, User, Globe, Users, Reply, X, AtSign, Code2, Paperclip, FileText, Download, Loader2, Image as ImageIcon, Mic } from "lucide-react";
import { VoiceInput } from "@/components/ui/voice-input";
import { isBuilder } from "@/lib/builder";
import { UserProfileModal } from "@/components/rooms/user-profile-modal";
import { toast } from "sonner";
import { notificationHelpers } from "@/stores/notification-store";
import { useRoomStore } from "@/stores/room-store";
import type { Message, Profile, ProfileFrame } from "@/types/database.types";

interface ChatMessage extends Message {
  profile?: Profile;
}

type ChatScope = "room" | "table";

// Helper function to detect @mentions in a message
const detectMentions = (content: string): string[] => {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1].toLowerCase());
  }
  return mentions;
};

// Helper to render message content with highlighted @mentions
const renderMessageContent = (content: string, isOwnMessage: boolean = false) => {
  const parts = content.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span
          key={i}
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded-md font-semibold text-[13px] mx-0.5 border",
            isOwnMessage
              ? "bg-white/30 text-white border-white/40"
              : "bg-primary/30 text-primary border-primary/50"
          )}
        >
          {part}
        </span>
      );
    }
    return part;
  });
};

interface MentionUser {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
}

interface ChatRoomProps {
  roomId: number;
  userId: string;
  userRole: string;
  userProfile?: Profile | null;
  tableId?: number | null;
  messageScope?: ChatScope;
  roomName?: string;
  tableName?: string;
  readOnly?: boolean;
}

export function ChatRoom({
  roomId,
  userId,
  userRole,
  userProfile = null,
  tableId = null,
  messageScope = "room",
  roomName = "Study Room",
  tableName = "Study Table",
  readOnly = false,
}: ChatRoomProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = useMemo(() => createClient(), []);
  const isAdmin = userRole === "admin" || userRole === "teacher";
  const [profileFrames, setProfileFrames] = useState<ProfileFrame[]>([]);

  // Helper to get frame CSS class from slug
  const getFrameClass = (frameSlug?: string | null) => {
    if (!frameSlug || profileFrames.length === 0) return "";
    const frame = profileFrames.find((f) => f.slug === frameSlug);
    return frame?.css_class || "";
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

  // Get presence from room store for @mention list
  const { presenceByRoom } = useRoomStore();
  const roomPresence = presenceByRoom[roomId] || [];

  // Fetch room members for @mention (combines presence + message senders)
  useEffect(() => {
    const fetchRoomMembers = async () => {
      // Get unique user IDs from presence
      const presenceUsers = roomPresence.map((p) => ({
        id: p.user_id,
        username: p.profile?.username || "",
        full_name: p.profile?.full_name || "",
        avatar_url: p.profile?.avatar_url || "",
      }));

      // Also get users who have sent messages in this room/table
      let query = supabase
        .from("messages")
        .select("user_id, profile:profiles!messages_user_id_fkey(id, username, full_name, avatar_url)")
        .eq("room_id", roomId)
        .eq("is_deleted", false);

      if (messageScope === "table" && tableId) {
        query = query.eq("table_id", tableId);
      }

      const { data: messageUsers } = await query;

      // Combine and deduplicate
      const allUsersMap = new Map<string, MentionUser>();

      presenceUsers.forEach((u) => {
        if (u.username && u.id !== userId) {
          allUsersMap.set(u.id, u);
        }
      });

      messageUsers?.forEach((m: any) => {
        const profile = m.profile;
        if (profile?.username && profile.id !== userId) {
          allUsersMap.set(profile.id, {
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name || "",
            avatar_url: profile.avatar_url || "",
          });
        }
      });

      setMentionUsers(Array.from(allUsersMap.values()));
    };

    fetchRoomMembers();
  }, [roomId, tableId, messageScope, roomPresence, userId, supabase]);

  // Filter mention users based on search
  const filteredMentionUsers = useMemo(() => {
    if (!mentionSearch) return mentionUsers;
    const search = mentionSearch.toLowerCase();
    return mentionUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(search) ||
        u.full_name?.toLowerCase().includes(search)
    );
  }, [mentionUsers, mentionSearch]);

  // Handle @ mention detection in input
  const handleInputChange = useCallback((value: string) => {
    setNewMessage(value);

    // Detect if user just typed @
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(atIndex + 1);
      // Check if we're in a mention context (no space after @)
      if (!textAfterAt.includes(" ")) {
        setMentionSearch(textAfterAt);
        setShowMentionList(true);
        setMentionIndex(0);
        return;
      }
    }

    setShowMentionList(false);
    setMentionSearch("");
  }, []);

  // Insert mention into message
  const insertMention = useCallback(
    (user: MentionUser) => {
      const cursorPos = textareaRef.current?.selectionStart || newMessage.length;
      const textBeforeCursor = newMessage.substring(0, cursorPos);
      const textAfterCursor = newMessage.substring(cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf("@");

      if (atIndex !== -1) {
        const newText =
          textBeforeCursor.substring(0, atIndex) +
          `@${user.username} ` +
          textAfterCursor;
        setNewMessage(newText);
      }

      setShowMentionList(false);
      setMentionSearch("");
      textareaRef.current?.focus();
    },
    [newMessage]
  );

  // Fetch initial messages based on scope
  useEffect(() => {
    let isCancelled = false;

    const fetchMessages = async () => {
      setIsLoading(true);

      try {
        let query = supabase
          .from("messages")
          .select(`
            *,
            profile:profiles!messages_user_id_fkey(*)
          `)
          .eq("room_id", roomId)
          .eq("is_deleted", false)
          .eq("message_scope", messageScope)
          .order("created_at", { ascending: true })
          .limit(100);

        // For table messages, also filter by table_id
        if (messageScope === "table" && tableId) {
          query = query.eq("table_id", tableId);
        }

        const { data, error } = await query;

        if (isCancelled) return;

        if (error) {
          // Ignore AbortError
          if (error.message?.includes("aborted") || error.message?.includes("AbortError")) {
            return;
          }
          console.error("Messages fetch error:", error.message);
          setMessages([]);
          setIsLoading(false);
          return;
        }

        setMessages(data || []);
      } catch (error: any) {
        if (isCancelled) return;
        // Ignore AbortError
        if (error?.name === "AbortError" || error?.message?.includes("aborted")) {
          return;
        }
        console.error("Error fetching messages:", error);
        setMessages([]);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchMessages();

    return () => {
      isCancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, tableId, messageScope]);

  // Subscribe to new messages based on scope
  useEffect(() => {
    // Build channel name based on scope
    const channelName =
      messageScope === "table" && tableId
        ? `table-${tableId}-messages`
        : `room-${roomId}-messages`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newMessageData = payload.new as ChatMessage;

          // Filter by scope and table_id for table messages
          if (newMessageData.message_scope !== messageScope) return;
          if (
            messageScope === "table" &&
            tableId &&
            newMessageData.table_id !== tableId
          ) {
            return;
          }

          // Fetch the profile for the new message
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", newMessageData.user_id)
            .single();

          const newMsg: ChatMessage = {
            ...newMessageData,
            profile: profile || undefined,
          };

          setMessages((prev) => [...prev, newMsg]);

          // Check for @mentions (only for messages from other users)
          if (newMessageData.user_id !== userId) {
            // Fetch current user's profile to check username
            const { data: currentUserProfile } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", userId)
              .single();

            if (currentUserProfile?.username && newMessageData.content) {
              const mentions = detectMentions(newMessageData.content);
              const myUsername = currentUserProfile.username.toLowerCase();

              if (mentions.includes(myUsername)) {
                // Trigger mention notification
                const senderName = profile?.full_name || profile?.username || "Someone";
                const messageContent = newMessageData.content;
                if (messageScope === "table" && tableId) {
                  notificationHelpers.mentionInTable(
                    senderName,
                    tableName,
                    tableId,
                    roomId,
                    messageContent
                  );
                } else {
                  notificationHelpers.mentionInRoom(
                    senderName,
                    roomName,
                    roomId,
                    messageContent
                  );
                }
              }
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          // Handle message deletion
          if (payload.new.is_deleted) {
            setMessages((prev) =>
              prev.filter((m) => m.id !== payload.new.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, tableId, messageScope]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // File handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only images (PNG, JPG, GIF, WebP) and PDFs are allowed");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setSelectedFile(file);

    // Generate preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      toast.error("Failed to download file");
    }
  };

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || isSending || isUploading) return;

    setIsSending(true);
    const content = newMessage.trim();
    setNewMessage("");
    const replyToId = replyingTo?.id || null;
    setReplyingTo(null);

    let fileData: {
      file_url?: string;
      file_name?: string;
      file_type?: string;
      file_size_bytes?: number;
    } = {};

    // Upload file if selected
    if (selectedFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("roomId", roomId.toString());

        const response = await fetch("/api/messages/upload", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Upload failed");
        }

        fileData = {
          file_url: result.fileUrl,
          file_name: result.fileName,
          file_type: result.fileType,
          file_size_bytes: result.fileSizeBytes,
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to upload file";
        toast.error(errorMessage);
        setIsSending(false);
        setIsUploading(false);
        setNewMessage(content);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    const { error } = await supabase.from("messages").insert({
      room_id: roomId,
      user_id: userId,
      content: content || null,
      type: selectedFile ? (fileData.file_type === "pdf" ? "pdf" : "image") : "text",
      message_scope: messageScope,
      table_id: messageScope === "table" ? tableId : null,
      reply_to_id: replyToId,
      ...fileData,
    });

    if (error) {
      console.error("Failed to send message:", error);
      setNewMessage(content);
    }

    clearSelectedFile();
    setIsSending(false);
  };

  // Handle keyboard events for textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle mention list navigation
    if (showMentionList && filteredMentionUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) =>
          prev < filteredMentionUsers.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) =>
          prev > 0 ? prev - 1 : filteredMentionUsers.length - 1
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredMentionUsers[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentionList(false);
        return;
      }
    }

    // Enter without shift sends message
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    // Shift+Enter adds new line (default behavior)
  };

  // Delete message (admin only)
  const handleDeleteMessage = async (messageId: number) => {
    if (!isAdmin) return;

    await supabase
      .from("messages")
      .update({ is_deleted: true, deleted_by: userId })
      .eq("id", messageId);
  };

  // Handle profile click
  const handleProfileClick = (messageUserId: string) => {
    // Don't show profile modal for own messages
    if (messageUserId === userId) return;
    setSelectedUserId(messageUserId);
  };

  // Handle reply click
  const handleReplyClick = (message: ChatMessage) => {
    setReplyingTo(message);
    textareaRef.current?.focus();
  };

  // Get replied message
  const getReplyMessage = (replyToId: number | null | undefined) => {
    if (!replyToId) return null;
    return messages.find((m) => m.id === replyToId);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full min-h-[400px] items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full min-h-[400px]">
        {/* Chat Header */}
        <div className="pb-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            {messageScope === "room" ? (
              <Globe className="w-4 h-4 text-primary" />
            ) : (
              <Users className="w-4 h-4 text-primary" />
            )}
            <h3 className="font-semibold text-white">
              {messageScope === "room" ? "Room Chat" : "Table Chat"}
            </h3>
          </div>
          <p className="text-sm text-white/50">
            {messages.length} messages • Click on a user to view their profile
          </p>
        </div>

        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 min-h-0 py-4">
          <div className="overflow-hidden pr-1">
          <AnimatePresence initial={false}>
            {messages.map((message) => {
              const isOwn = message.user_id === userId;
              const replyMessage = getReplyMessage(message.reply_to_id);

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cn(
                    "flex gap-2 mb-4",
                    isOwn && "flex-row-reverse"
                  )}
                >
                  {/* Clickable Avatar */}
                  <button
                    onClick={() => handleProfileClick(message.user_id)}
                    disabled={isOwn}
                    className={cn(
                      "flex-shrink-0 transition-transform",
                      !isOwn && "hover:scale-110 cursor-pointer"
                    )}
                  >
                    <Avatar className={cn("w-8 h-8", getFrameClass(message.profile?.profile_frame))}>
                      <AvatarImage src={message.profile?.avatar_url || ""} />
                      <AvatarFallback className="text-xs">
                        {getInitials(
                          message.profile?.full_name || message.profile?.username
                        )}
                      </AvatarFallback>
                    </Avatar>
                  </button>

                  <div
                    className={cn(
                      "max-w-[75%] min-w-0 group",
                      isOwn && "items-end"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {/* Clickable Username */}
                      <button
                        onClick={() => handleProfileClick(message.user_id)}
                        disabled={isOwn}
                        className={cn(
                          "text-xs font-medium",
                          !isOwn && "hover:text-primary hover:underline cursor-pointer"
                        )}
                      >
                        {isOwn
                          ? "You"
                          : message.profile?.full_name ||
                            message.profile?.username ||
                            "Anonymous"}
                      </button>
                      {isBuilder(message.profile?.username) && (
                        <span title="App Builder">
                          <Code2 className="w-3 h-3 text-cyan-400" />
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {/* Reply button */}
                      {!readOnly && (
                        <button
                          onClick={() => handleReplyClick(message)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                          title="Reply"
                        >
                          <Reply className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )}
                      {!isOwn && (
                        <button
                          onClick={() => handleProfileClick(message.user_id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                          title="View profile"
                        >
                          <User className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )}
                      {/* Delete button - show for own messages OR if admin */}
                      {(isOwn || isAdmin) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteMessage(message.id)}
                          title={isOwn ? "Delete your message" : "Delete message (admin)"}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      )}
                    </div>

                    {/* Reply Preview */}
                    {replyMessage && (
                      <div
                        className={cn(
                          "text-xs mb-1 px-2 py-1 rounded border-l-2 border-primary/50",
                          isOwn ? "bg-primary/10" : "bg-white/5"
                        )}
                      >
                        <span className="text-white/50">
                          Replying to{" "}
                          <span className="text-primary">
                            {replyMessage.profile?.username || "someone"}
                          </span>
                        </span>
                        <p className="text-white/40 truncate max-w-[200px]">
                          {replyMessage.content}
                        </p>
                      </div>
                    )}

                    <div
                      className={cn(
                        "rounded-lg px-3 py-2",
                        isOwn
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary"
                      )}
                    >
                      {/* File Attachment */}
                      {message.file_url && (
                        <div className="mb-2">
                          {message.file_type === "image" ? (
                            <div className="relative group/img">
                              <img
                                src={message.file_url}
                                alt={message.file_name || "Image"}
                                className="max-w-[300px] max-h-[200px] rounded-lg object-cover cursor-pointer"
                                onClick={() => window.open(message.file_url!, "_blank")}
                              />
                              <div className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(message.file_url!, message.file_name || "image");
                                  }}
                                  className={cn(
                                    "p-1.5 rounded-md backdrop-blur-sm",
                                    isOwn ? "bg-white/20 hover:bg-white/30" : "bg-black/40 hover:bg-black/60"
                                  )}
                                  title="Download"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                              {message.file_size_bytes && (
                                <p className={cn(
                                  "text-xs mt-1",
                                  isOwn ? "text-white/70" : "text-white/50"
                                )}>
                                  {formatFileSize(message.file_size_bytes)}
                                </p>
                              )}
                            </div>
                          ) : message.file_type === "pdf" ? (
                            <div className={cn(
                              "flex items-center gap-3 p-3 rounded-lg",
                              isOwn ? "bg-white/10" : "bg-white/5"
                            )}>
                              <FileText className={cn(
                                "w-10 h-10 flex-shrink-0",
                                isOwn ? "text-white/80" : "text-red-400"
                              )} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {message.file_name || "Document.pdf"}
                                </p>
                                {message.file_size_bytes && (
                                  <p className={cn(
                                    "text-xs",
                                    isOwn ? "text-white/60" : "text-white/40"
                                  )}>
                                    {formatFileSize(message.file_size_bytes)}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => window.open(message.file_url!, "_blank")}
                                  className={cn(
                                    "p-2 rounded-md transition-colors",
                                    isOwn
                                      ? "bg-white/20 hover:bg-white/30"
                                      : "bg-white/10 hover:bg-white/20"
                                  )}
                                  title="View"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDownload(message.file_url!, message.file_name || "document.pdf")}
                                  className={cn(
                                    "p-2 rounded-md transition-colors",
                                    isOwn
                                      ? "bg-white/20 hover:bg-white/30"
                                      : "bg-white/10 hover:bg-white/20"
                                  )}
                                  title="Download"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                      {message.content && (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {renderMessageContent(message.content, isOwn)}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              {readOnly
                ? "No messages yet."
                : "No messages yet. Start the conversation!"}
            </div>
          )}
          </div>
        </ScrollArea>

        {readOnly ? (
          <div className="pt-3 border-t border-white/10 flex-shrink-0">
            <div className="flex items-center justify-center gap-2 py-3 px-4 bg-white/5 rounded-lg text-white/50 text-sm">
              <Users className="w-4 h-4" />
              <span>Subscribe to this room to chat</span>
            </div>
          </div>
        ) : (
          <>
            {/* Reply Preview */}
            {replyingTo && (
              <div className="px-3 py-2 bg-white/5 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Reply className="w-4 h-4 text-primary" />
                  <span className="text-white/50">Replying to</span>
                  <span className="text-primary font-medium">
                    {replyingTo.profile?.username || "someone"}
                  </span>
                  <span className="text-white/30 truncate max-w-[150px]">
                    {replyingTo.content}
                  </span>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>
            )}

            {/* Message Input */}
            <div className="pt-3 border-t border-white/10 flex-shrink-0 relative">
              {/* Mention Dropdown */}
              <AnimatePresence>
                {showMentionList && filteredMentionUsers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-900 border border-white/10 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10"
                  >
                    <div className="p-2 border-b border-white/10 flex items-center gap-2 text-xs text-white/50">
                      <AtSign className="w-3 h-3" />
                      <span>Mention a user</span>
                    </div>
                    {filteredMentionUsers.map((user, index) => (
                      <button
                        key={user.id}
                        onClick={() => insertMention(user)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors",
                          index === mentionIndex && "bg-white/10"
                        )}
                      >
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={user.avatar_url || ""} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(user.full_name || user.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm text-white font-medium">
                            @{user.username}
                          </p>
                          {user.full_name && (
                            <p className="text-xs text-white/50">{user.full_name}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* File Preview */}
              {selectedFile && (
                <div className="mb-3 p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-3">
                    {filePreview ? (
                      <img
                        src={filePreview}
                        alt="Preview"
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-red-500/20 rounded-lg flex items-center justify-center">
                        <FileText className="w-8 h-8 text-red-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-white/50">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    <button
                      onClick={clearSelectedFile}
                      className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
                      title="Remove file"
                    >
                      <X className="w-4 h-4 text-white/60" />
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex gap-2 overflow-hidden">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/gif,image/webp,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Attachment button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending || isUploading}
                  className="self-end flex-shrink-0 text-white/60 hover:text-white hover:bg-white/10"
                  title="Attach file (images or PDF)"
                >
                  <Paperclip className="w-5 h-5" />
                </Button>

                <Textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message... (Shift+Enter for new line, @ to mention)"
                  className="flex-1 min-w-0 bg-white/5 border-white/10 text-white placeholder:text-white/40 min-h-[40px] max-h-[120px] resize-none"
                  disabled={isSending || isUploading}
                  rows={1}
                />
                <VoiceInput
                  onTranscript={(text) => setNewMessage(text)}
                  disabled={isSending || isUploading}
                  className="self-end flex-shrink-0 text-white/60 hover:text-white hover:bg-white/10"
                />
                <Button
                  type="submit"
                  disabled={(!newMessage.trim() && !selectedFile) || isSending || isUploading}
                  className="bg-primary hover:bg-primary/90 self-end flex-shrink-0"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* User Profile Modal */}
      <UserProfileModal
        userId={selectedUserId || ""}
        isOpen={!!selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />
    </>
  );
}
