"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MessageSquare,
  Trash2,
  Search,
  AlertTriangle,
  Flag,
  Eye,
  Filter,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Room, Profile, Message } from "@/types/database.types";

interface MessageWithDetails extends Message {
  profile?: Profile;
  room?: Room;
}

export default function AdminChatModerationPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [messages, setMessages] = useState<MessageWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [roomFilter, setRoomFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const [roomsResult, messagesResult] = await Promise.all([
        supabase.from("rooms").select("*").order("name"),
        supabase
          .from("messages")
          .select(`*, profile:profiles!messages_user_id_fkey(*), room:rooms(*)`)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (roomsResult.error) {
        console.error("Failed to fetch rooms:", roomsResult.error.message);
      }
      if (messagesResult.error) {
        console.error("Failed to fetch messages:", messagesResult.error.message);
      }

      setRooms(roomsResult.data || []);
      setMessages(messagesResult.data || []);
      setIsLoading(false);
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteMessage = async (message: MessageWithDetails) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error } = await supabase
      .from("messages")
      .update({ is_deleted: true, deleted_by: userData.user.id })
      .eq("id", message.id);

    if (error) {
      toast.error("Failed to delete message");
      return;
    }

    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    toast.success("Message deleted");
  };

  const handleFlagMessage = (message: MessageWithDetails) => {
    toast.info(`Message flagged for review`);
  };

  const filteredMessages = messages.filter((m) => {
    if (roomFilter !== "all" && m.room_id.toString() !== roomFilter) {
      return false;
    }
    if (searchQuery && !m.content?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const getInitials = (name?: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="w-6 h-6" />
          Chat Moderation
        </h1>
        <p className="text-muted-foreground">
          Monitor and moderate chat messages across all study halls
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{messages.length}</p>
              <p className="text-sm text-muted-foreground">Total Messages</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Eye className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rooms.length}</p>
              <p className="text-sm text-muted-foreground">Active Rooms</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Flagged Messages</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roomFilter} onValueChange={setRoomFilter}>
          <SelectTrigger className="w-[200px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by room" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rooms</SelectItem>
            {rooms.map((room) => (
              <SelectItem key={room.id} value={room.id.toString()}>
                {room.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Messages Table */}
      <div className="glass-card overflow-hidden rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Time</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMessages.map((message) => (
              <TableRow key={message.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={message.profile?.avatar_url || ""} />
                      <AvatarFallback>
                        {getInitials(
                          message.profile?.full_name || message.profile?.username
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="font-medium text-sm">
                        {message.profile?.full_name ||
                          message.profile?.username ||
                          "Unknown"}
                      </span>
                      {message.profile?.is_pro_member && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          Pro
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-md">
                  <p className="truncate text-sm">{message.content}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{message.room?.name}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDistanceToNow(new Date(message.created_at), {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleFlagMessage(message)}
                      title="Flag message"
                    >
                      <Flag className="w-4 h-4 text-orange-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteMessage(message)}
                      title="Delete message"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredMessages.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  No messages found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
