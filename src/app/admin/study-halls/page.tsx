"use client";

import { useState, useEffect, useMemo } from "react";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Home,
  Users,
  Crown,
  Eye,
  X,
  Tag,
  Settings,
  Loader2,
  UserPlus,
  UserMinus,
  Search,
  Filter,
} from "lucide-react";
import type { Room, RoomCategory } from "@/types/database.types";
import { notificationHelpers } from "@/stores/notification-store";

interface RoomMember {
  user_id: string;
  full_name: string | null;
  is_pro_member: boolean;
  is_favorite: boolean;
}

export default function AdminStudyHallsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  // Privacy filter
  const [privacyFilter, setPrivacyFilter] = useState<"all" | "public" | "private" | "premium">("all");

  // Members management
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [membersRoom, setMembersRoom] = useState<Room | null>(null);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<RoomMember[]>([]);
  const [isMemberSearching, setIsMemberSearching] = useState(false);

  // Owner names cache
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});

  // New category form
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("teal");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [privacyLevel, setPrivacyLevel] = useState<
    "public" | "private" | "premium"
  >("public");
  const [maxTables, setMaxTables] = useState("20");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");

  const supabase = useMemo(() => createClient(), []);

  // Fetch categories from database
  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/room-categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      } else {
        console.error("Failed to fetch categories");
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  // Fetch rooms and categories
  useEffect(() => {
    const fetchData = async () => {
      // Fetch categories first
      await fetchCategories();

      // Fetch rooms
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Failed to fetch rooms:", error.message);
        toast.error("Failed to load study halls");
        setRooms([]);
        setIsLoading(false);
        return;
      }

      if (data) {
        setRooms(data);
      }
      setIsLoading(false);
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch owner names for user-created rooms
  useEffect(() => {
    const ownerIds = rooms
      .filter((r) => r.owner_id && !ownerNames[r.owner_id])
      .map((r) => r.owner_id!)
      .filter((id, i, arr) => arr.indexOf(id) === i);

    if (ownerIds.length === 0) return;

    const fetchOwners = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ownerIds);

      if (data) {
        const names: Record<string, string> = {};
        data.forEach((p) => {
          names[p.id] = p.full_name || "Unknown";
        });
        setOwnerNames((prev) => ({ ...prev, ...names }));
      }
    };

    fetchOwners();
  }, [rooms, supabase, ownerNames]);

  // Fetch members for a room
  const fetchRoomMembers = async (roomId: number) => {
    setIsMembersLoading(true);
    const { data, error } = await supabase
      .from("user_room_subscriptions")
      .select("user_id, is_favorite")
      .eq("room_id", roomId);

    if (error || !data) {
      setRoomMembers([]);
      setIsMembersLoading(false);
      return;
    }

    if (data.length === 0) {
      setRoomMembers([]);
      setIsMembersLoading(false);
      return;
    }

    // Fetch profile details for members
    const userIds = data.map((s) => s.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, is_pro_member")
      .in("id", userIds);

    const members: RoomMember[] = data.map((sub) => {
      const profile = profiles?.find((p) => p.id === sub.user_id);
      return {
        user_id: sub.user_id,
        full_name: profile?.full_name || "Unknown",
        is_pro_member: profile?.is_pro_member || false,
        is_favorite: sub.is_favorite,
      };
    });

    setRoomMembers(members);
    setIsMembersLoading(false);
  };

  // Open members dialog
  const handleManageMembers = (room: Room) => {
    setMembersRoom(room);
    setMembersDialogOpen(true);
    setMemberSearch("");
    setMemberSearchResults([]);
    fetchRoomMembers(room.id);
  };

  // Search users to add as members (only Pro users for premium rooms)
  const handleMemberSearch = async (query: string) => {
    setMemberSearch(query);
    if (query.length < 2) {
      setMemberSearchResults([]);
      return;
    }

    setIsMemberSearching(true);
    let queryBuilder = supabase
      .from("profiles")
      .select("id, full_name, is_pro_member")
      .ilike("full_name", `%${query}%`)
      .limit(5);

    // Premium rooms: only allow Pro members
    if (membersRoom?.privacy_level === "premium") {
      queryBuilder = queryBuilder.eq("is_pro_member", true);
    }

    const { data } = await queryBuilder;

    if (data) {
      const filtered = data
        .filter((p) => !roomMembers.some((m) => m.user_id === p.id))
        .map((p) => ({
          user_id: p.id,
          full_name: p.full_name,
          is_pro_member: p.is_pro_member || false,
          is_favorite: false,
        }));
      setMemberSearchResults(filtered);
    }
    setIsMemberSearching(false);
  };

  // Add member to room
  const handleAddMember = async (member: RoomMember) => {
    if (!membersRoom) return;

    const { error } = await supabase
      .from("user_room_subscriptions")
      .insert({
        user_id: member.user_id,
        room_id: membersRoom.id,
        is_favorite: false,
        notification_level: "normal",
      });

    if (error) {
      toast.error("Failed to add member: " + error.message);
      return;
    }

    // Send notification to the invited user
    await supabase.from("room_notifications").insert({
      user_id: member.user_id,
      room_id: membersRoom.id,
      type: "room_update",
      title: "Room Invitation",
      message: `You've been added to "${membersRoom.name}"`,
      metadata: { invitedBy: "admin", roomName: membersRoom.name },
    });

    setRoomMembers((prev) => [...prev, member]);
    setMemberSearchResults((prev) => prev.filter((m) => m.user_id !== member.user_id));
    setMemberSearch("");
    toast.success(`${member.full_name} added to room`);
  };

  // Remove member from room
  const handleRemoveMember = async (userId: string) => {
    if (!membersRoom) return;

    const { error } = await supabase
      .from("user_room_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("room_id", membersRoom.id);

    if (error) {
      toast.error("Failed to remove member");
      return;
    }

    setRoomMembers((prev) => prev.filter((m) => m.user_id !== userId));
    toast.success("Member removed");
  };

  // Filtered rooms by privacy level
  const filteredRooms = useMemo(() => {
    if (privacyFilter === "all") return rooms;
    return rooms.filter((r) => r.privacy_level === privacyFilter);
  }, [rooms, privacyFilter]);

  // Reset form
  const resetForm = () => {
    setName("");
    setDescription("");
    setCategoryId("");
    setPrivacyLevel("public");
    setMaxTables("20");
    setIsActive(true);
    setSortOrder("0");
    setEditingRoom(null);
  };

  // Open edit dialog
  const handleEdit = (room: Room) => {
    setEditingRoom(room);
    setName(room.name);
    setDescription(room.description || "");
    setCategoryId(room.category_id?.toString() || "");
    setPrivacyLevel(room.privacy_level);
    setMaxTables(room.max_tables?.toString() || "20");
    setIsActive(room.is_active);
    setSortOrder(room.sort_order?.toString() || "0");
    setDialogOpen(true);
  };

  // Save room
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    // Get slug from category
    const selectedCategory = categories.find(
      (c) => c.id === parseInt(categoryId)
    );

    const roomData = {
      name: name.trim(),
      description: description.trim() || null,
      category: selectedCategory?.slug || null,
      category_id: categoryId ? parseInt(categoryId) : null,
      privacy_level: privacyLevel,
      max_tables: parseInt(maxTables) || 20,
      is_active: isActive,
      sort_order: parseInt(sortOrder) || 0,
    };

    try {
      if (editingRoom) {
        const { error } = await supabase
          .from("rooms")
          .update(roomData)
          .eq("id", editingRoom.id);

        if (error) {
          toast.error("Failed to update study hall: " + error.message);
          return;
        }

        setRooms((prev) =>
          prev.map((r) =>
            r.id === editingRoom.id ? { ...r, ...roomData } : r
          )
        );
        toast.success("Study hall updated successfully");
      } else {
        const { data, error } = await supabase
          .from("rooms")
          .insert(roomData)
          .select()
          .single();

        if (error) {
          toast.error("Failed to create study hall: " + error.message);
          return;
        }

        if (data) {
          setRooms((prev) => [...prev, data]);
          toast.success("Study hall created successfully");
          notificationHelpers.newRoomCreated(data.name, data.id);
        }
      }

      setDialogOpen(false);
      resetForm();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      toast.error("An unexpected error occurred");
      console.error(err);
    }
  };

  // Delete room
  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Are you sure? This will delete all tables and messages in this study hall."
      )
    ) {
      return;
    }

    const { error } = await supabase.from("rooms").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete study hall: " + error.message);
      return;
    }

    setRooms((prev) => prev.filter((r) => r.id !== id));
    toast.success("Study hall deleted successfully");
  };

  // Toggle active status
  const handleToggleActive = async (room: Room) => {
    const { error } = await supabase
      .from("rooms")
      .update({ is_active: !room.is_active })
      .eq("id", room.id);

    if (error) {
      toast.error("Failed to update status");
      return;
    }

    setRooms((prev) =>
      prev.map((r) =>
        r.id === room.id ? { ...r, is_active: !r.is_active } : r
      )
    );
    toast.success(
      room.is_active ? "Study hall deactivated" : "Study hall activated"
    );
  };

  // Add new category
  const handleAddCategory = async () => {
    if (!newCategoryLabel.trim()) {
      toast.error("Category name is required");
      return;
    }

    const slug = newCategoryLabel.trim().toLowerCase().replace(/\s+/g, "-");

    if (categories.some((c) => c.slug === slug)) {
      toast.error("Category already exists");
      return;
    }

    setIsCategoryLoading(true);

    try {
      const res = await fetch("/api/room-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          label: newCategoryLabel.trim(),
          color: newCategoryColor,
          sort_order: categories.length,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to create category");
        return;
      }

      const newCategory = await res.json();
      setCategories((prev) => [...prev, newCategory]);
      setNewCategoryLabel("");
      setNewCategoryColor("teal");
      toast.success("Category added successfully");
    } catch (error) {
      console.error("Error creating category:", error);
      toast.error("Failed to create category");
    } finally {
      setIsCategoryLoading(false);
    }
  };

  // Delete category
  const handleDeleteCategory = async (id: number) => {
    const roomsWithCategory = rooms.filter((r) => r.category_id === id);
    if (roomsWithCategory.length > 0) {
      toast.error(
        `Cannot delete: ${roomsWithCategory.length} study hall(s) use this category`
      );
      return;
    }

    setIsCategoryLoading(true);

    try {
      const res = await fetch(`/api/room-categories?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete category");
        return;
      }

      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast.success("Category deleted");
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("Failed to delete category");
    } finally {
      setIsCategoryLoading(false);
    }
  };

  // Get category label
  const getCategoryLabel = (categoryId: number | null) => {
    if (!categoryId) return "-";
    const found = categories.find((c) => c.id === categoryId);
    return found?.label || "-";
  };

  const colorOptions = [
    { value: "teal", label: "Teal" },
    { value: "blue", label: "Blue" },
    { value: "amber", label: "Amber" },
    { value: "cyan", label: "Cyan" },
    { value: "rose", label: "Rose" },
    { value: "purple", label: "Purple" },
    { value: "green", label: "Green" },
    { value: "orange", label: "Orange" },
  ];

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
            <Home className="w-6 h-6" />
            Study Halls
          </h1>
          <p className="text-muted-foreground">
            Manage study halls where users can create tables and study together
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Category Management Dialog */}
          <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Tag className="w-4 h-4 mr-2" />
                Manage Categories
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Manage Categories
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Add new category */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="New category name..."
                      value={newCategoryLabel}
                      onChange={(e) => setNewCategoryLabel(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                    />
                    <Select
                      value={newCategoryColor}
                      onValueChange={setNewCategoryColor}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {colorOptions.map((color) => (
                          <SelectItem key={color.value} value={color.value}>
                            <span className="flex items-center gap-2">
                              <span
                                className={`w-3 h-3 rounded-full bg-${color.value}-500`}
                              />
                              {color.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleAddCategory}
                      size="icon"
                      disabled={isCategoryLoading}
                    >
                      {isCategoryLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Categories list */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No categories yet. Add your first category above.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground font-medium">
                        Categories ({categories.length})
                      </p>
                      {categories.map((cat) => {
                        const roomCount = rooms.filter(
                          (r) => r.category_id === cat.id
                        ).length;
                        return (
                          <div
                            key={cat.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-3 h-3 rounded-full bg-${cat.color}-500`}
                              />
                              <span className="text-sm">{cat.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {roomCount > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {roomCount} hall{roomCount !== 1 ? "s" : ""}
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleDeleteCategory(cat.id)}
                                disabled={roomCount > 0 || isCategoryLoading}
                                title={
                                  roomCount > 0
                                    ? "Cannot delete: category has study halls"
                                    : "Delete category"
                                }
                              >
                                <X
                                  className={`w-3 h-3 ${
                                    roomCount > 0
                                      ? "text-muted"
                                      : "text-destructive"
                                  }`}
                                />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Study Hall Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Add Study Hall
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingRoom ? "Edit Study Hall" : "Create New Study Hall"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., General Study Hall"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this study hall"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length === 0 ? (
                        <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                          No categories yet. Create one first.
                        </div>
                      ) : (
                        categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="privacy">Privacy Level</Label>
                  <Select
                    value={privacyLevel}
                    onValueChange={(v) =>
                      setPrivacyLevel(v as "public" | "premium")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">
                        <span className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Public - Open to all users
                        </span>
                      </SelectItem>
                      <SelectItem value="premium">
                        <span className="flex items-center gap-2">
                          <Crown className="w-4 h-4 text-orange-400" />
                          Premium - Pro members only
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxTables">Max Tables</Label>
                    <Input
                      id="maxTables"
                      type="number"
                      min="5"
                      max="50"
                      value={maxTables}
                      onChange={(e) => setMaxTables(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sortOrder">Sort Order</Label>
                    <Input
                      id="sortOrder"
                      type="number"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                  <Label htmlFor="active">Active</Label>
                </div>

                <Button onClick={handleSave} className="w-full">
                  {editingRoom ? "Update Study Hall" : "Create Study Hall"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Privacy Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filter:</span>
        {(["all", "public", "premium"] as const).map((level) => (
          <Button
            key={level}
            variant={privacyFilter === level ? "default" : "outline"}
            size="sm"
            onClick={() => setPrivacyFilter(level)}
            className="capitalize"
          >
            {level === "premium" && <Crown className="w-3 h-3 mr-1 text-orange-400" />}
            {level} {level !== "all" && `(${rooms.filter((r) => r.privacy_level === level).length})`}
          </Button>
        ))}
      </div>

      {/* Rooms Table */}
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Privacy</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRooms.map((room) => (
              <TableRow key={room.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {room.name}
                    {room.privacy_level === "premium" && (
                      <Crown className="w-4 h-4 text-orange-400" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {room.owner_id ? (
                    <span className="text-sm">
                      {ownerNames[room.owner_id] || "Loading..."}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Admin</span>
                  )}
                </TableCell>
                <TableCell>{getCategoryLabel(room.category_id)}</TableCell>
                <TableCell>
                  {room.privacy_level === "premium" ? (
                    <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                      Premium
                    </Badge>
                  ) : (
                    <Badge variant="outline">Public</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {room.privacy_level === "premium" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleManageMembers(room)}
                      className="text-xs"
                    >
                      <Users className="w-3.5 h-3.5 mr-1" />
                      Manage
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">Open</span>
                  )}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => handleToggleActive(room)}
                    className="flex items-center gap-1.5"
                  >
                    {room.is_active ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm text-green-500">Active</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-gray-400" />
                        <span className="text-sm text-gray-400">Inactive</span>
                      </>
                    )}
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" asChild>
                      <a href={`/room/${room.id}`} target="_blank">
                        <Eye className="w-4 h-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(room)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(room.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredRooms.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  {privacyFilter === "all"
                    ? "No study halls yet. Create your first study hall!"
                    : `No ${privacyFilter} study halls found.`}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Members Management Dialog */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Members - {membersRoom?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add Member Search */}
            <div className="space-y-2">
              <Label className="text-sm">Add Member</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={memberSearch}
                  onChange={(e) => handleMemberSearch(e.target.value)}
                  placeholder="Search users by name..."
                  className="pl-9"
                />
                {isMemberSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Search Results */}
              {memberSearchResults.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  {memberSearchResults.map((member) => (
                    <button
                      key={member.user_id}
                      onClick={() => handleAddMember(member)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <UserPlus className="w-4 h-4 text-primary" />
                      <span>{member.full_name || "Unknown"}</span>
                      {member.is_pro_member && (
                        <Crown className="w-3 h-3 text-orange-400 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Current Members */}
            <div className="space-y-2">
              <Label className="text-sm">
                Current Members ({roomMembers.length})
              </Label>
              {isMembersLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : roomMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No members yet. Add members using the search above.
                </p>
              ) : (
                <div className="space-y-1 max-h-[250px] overflow-y-auto">
                  {roomMembers.map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary font-medium">
                          {member.full_name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <span className="text-sm">{member.full_name || "Unknown"}</span>
                          <div className="flex items-center gap-1">
                            {member.is_pro_member && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-orange-400 border-orange-400/30">
                                Pro
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRemoveMember(member.user_id)}
                      >
                        <UserMinus className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
