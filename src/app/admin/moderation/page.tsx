"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ShieldAlert,
  UserX,
  MessageSquareX,
  Ban,
  Trash2,
  Search,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Room, Profile, RoomBan, Message } from "@/types/database.types";

interface BanWithDetails extends RoomBan {
  profile?: Profile;
  room?: Room;
  banned_by_profile?: Profile;
}

interface MessageWithDetails extends Message {
  profile?: Profile;
  room?: Room;
}

export default function AdminModerationPage() {
  const [activeTab, setActiveTab] = useState("bans");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bans, setBans] = useState<BanWithDetails[]>([]);
  const [messages, setMessages] = useState<MessageWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Ban dialog state
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banUserId, setBanUserId] = useState("");
  const [banRoomId, setBanRoomId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState("permanent");

  // Message filter state
  const [messageRoomFilter, setMessageRoomFilter] = useState("all");
  const [messageSearch, setMessageSearch] = useState("");

  const supabase = createClient();

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      const [roomsResult, bansResult, messagesResult] = await Promise.all([
        supabase
          .from("rooms")
          .select("*")
          .order("name"),
        supabase
          .from("room_bans")
          .select(`
            *,
            profile:profiles!room_bans_user_id_fkey(*),
            room:rooms(*),
            banned_by_profile:profiles!room_bans_banned_by_fkey(*)
          `)
          .order("banned_at", { ascending: false }),
        supabase
          .from("messages")
          .select(`
            *,
            profile:profiles!messages_user_id_fkey(*),
            room:rooms(*)
          `)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (roomsResult.error) console.error("Failed to fetch rooms:", roomsResult.error.message);
      if (bansResult.error) console.error("Failed to fetch bans:", bansResult.error.message);
      if (messagesResult.error) console.error("Failed to fetch messages:", messagesResult.error.message);

      setRooms(roomsResult.data || []);
      setBans(bansResult.data || []);
      setMessages(messagesResult.data || []);
      setIsLoading(false);
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ban user
  const handleBanUser = async () => {
    if (!banUserId.trim() || !banRoomId) {
      toast.error("User ID and Room are required");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast.error("Not authenticated");
      return;
    }

    const durationHours =
      banDuration === "permanent"
        ? null
        : banDuration === "1h"
        ? 1
        : banDuration === "24h"
        ? 24
        : banDuration === "7d"
        ? 168
        : banDuration === "30d"
        ? 720
        : null;

    const { error } = await supabase.rpc("ban_user_from_room", {
      p_admin_id: userData.user.id,
      p_user_id: banUserId,
      p_room_id: parseInt(banRoomId),
      p_reason: banReason || null,
      p_duration_hours: durationHours,
    });

    if (error) {
      toast.error("Failed to ban user: " + error.message);
      return;
    }

    toast.success("User banned successfully");
    setBanDialogOpen(false);
    setBanUserId("");
    setBanRoomId("");
    setBanReason("");
    setBanDuration("permanent");

    // Refresh bans
    const { data } = await supabase
      .from("room_bans")
      .select(`
        *,
        profile:profiles!room_bans_user_id_fkey(*),
        room:rooms(*),
        banned_by_profile:profiles!room_bans_banned_by_fkey(*)
      `)
      .order("banned_at", { ascending: false });
    if (data) setBans(data);
  };

  // Unban user
  const handleUnban = async (ban: BanWithDetails) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error } = await supabase.rpc("unban_user_from_room", {
      p_admin_id: userData.user.id,
      p_user_id: ban.user_id,
      p_room_id: ban.room_id,
    });

    if (error) {
      toast.error("Failed to unban user");
      return;
    }

    setBans((prev) => prev.filter((b) => b.id !== ban.id));
    toast.success("User unbanned");
  };

  // Delete message
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

  // Filter messages
  const filteredMessages = messages.filter((m) => {
    if (messageRoomFilter !== "all" && m.room_id.toString() !== messageRoomFilter) {
      return false;
    }
    if (messageSearch && !m.content?.toLowerCase().includes(messageSearch.toLowerCase())) {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6" />
            Moderation
          </h1>
          <p className="text-muted-foreground">
            Manage bans, kick users, and moderate messages
          </p>
        </div>

        <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <Ban className="w-4 h-4 mr-2" />
              Ban User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ban User from Study Hall</DialogTitle>
              <DialogDescription>
                Enter the user's ID to ban them from a specific study hall.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userId">User ID *</Label>
                <Input
                  id="userId"
                  value={banUserId}
                  onChange={(e) => setBanUserId(e.target.value)}
                  placeholder="Enter user UUID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="room">Study Hall *</Label>
                <Select value={banRoomId} onValueChange={setBanRoomId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select study hall" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id.toString()}>
                        {room.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration</Label>
                <Select value={banDuration} onValueChange={setBanDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">1 Hour</SelectItem>
                    <SelectItem value="24h">24 Hours</SelectItem>
                    <SelectItem value="7d">7 Days</SelectItem>
                    <SelectItem value="30d">30 Days</SelectItem>
                    <SelectItem value="permanent">Permanent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Optional reason for the ban"
                />
              </div>

              <Button
                onClick={handleBanUser}
                variant="destructive"
                className="w-full"
              >
                Ban User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="bans" className="flex items-center gap-2">
            <UserX className="w-4 h-4" />
            Bans ({bans.length})
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquareX className="w-4 h-4" />
            Messages
          </TabsTrigger>
        </TabsList>

        {/* Bans Tab */}
        <TabsContent value="bans" className="mt-4">
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Study Hall</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Banned By</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bans.map((ban) => (
                  <TableRow key={ban.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={ban.profile?.avatar_url || ""} />
                          <AvatarFallback>
                            {getInitials(
                              ban.profile?.full_name || ban.profile?.username
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {ban.profile?.full_name ||
                              ban.profile?.username ||
                              "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ban.user_id.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{ban.room?.name || "-"}</TableCell>
                    <TableCell>
                      {ban.reason || (
                        <span className="text-muted-foreground">No reason</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {ban.banned_by_profile?.full_name ||
                        ban.banned_by_profile?.username ||
                        "-"}
                    </TableCell>
                    <TableCell>
                      {ban.expires_at ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(ban.expires_at), {
                            addSuffix: true,
                          })}
                        </div>
                      ) : (
                        <Badge variant="destructive">Permanent</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnban(ban)}
                      >
                        Unban
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {bans.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No bans recorded
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={messageSearch}
                onChange={(e) => setMessageSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={messageRoomFilter}
              onValueChange={setMessageRoomFilter}
            >
              <SelectTrigger className="w-[200px]">
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
          <div className="glass-card overflow-hidden">
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
                              message.profile?.full_name ||
                                message.profile?.username
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {message.profile?.full_name ||
                            message.profile?.username ||
                            "Unknown"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="truncate">{message.content}</p>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteMessage(message)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
