"use client";

import { useState, useEffect, useMemo } from "react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Search,
  Users,
  Shield,
  GraduationCap,
  User,
  Loader2,
  Crown,
  Calendar,
  RefreshCw,
  Settings,
  Check,
  X,
  Trash2,
  AlertTriangle,
  Mail,
  Phone,
  Copy,
  Download,
  Globe,
  ShieldAlert,
  Wifi,
  Sparkles,
} from "lucide-react";
import { PERMISSION_CATEGORIES, PERMISSION_PRESETS, type Permission } from "@/lib/permissions";
import { getExamLabel } from "@/lib/exam-options";

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: "user" | "teacher" | "admin";
  is_pro_member: boolean;
  created_at: string;
  permissions: string[] | null;
  email?: string;
  phone_number?: string;
  signup_ip?: string;
  is_vpn?: boolean;
  ip_location?: string;
  trial_ends_at?: string | null;
  preparing_for?: string[] | null;
}

const isTrialUser = (p: Profile) =>
  !!p.trial_ends_at && new Date(p.trial_ends_at) > new Date();
// Crown only for genuinely paid/admin-granted Pro (no trial_ends_at at all)
const isPaidPro = (p: Profile) =>
  p.is_pro_member && !p.trial_ends_at;

interface UserPermission {
  id: number;
  user_id: string;
  permission: string;
  granted_by: string;
  granted_at: string;
}

const ROLE_CONFIG = {
  user: {
    label: "Student",
    icon: User,
    color: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  },
  teacher: {
    label: "Teacher",
    icon: GraduationCap,
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  admin: {
    label: "Admin",
    icon: Shield,
    color: "bg-primary/10 text-primary border-primary/20",
  },
};

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "teacher" | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Permission management state
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [pendingPermissions, setPendingPermissions] = useState<string[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  // Delete user state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const supabase = useMemo(() => createClient(), []);

  // Fetch current user's role
  useEffect(() => {
    const fetchCurrentUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile) {
          setCurrentUserRole(profile.role as "admin" | "teacher");
        }
      }
    };
    fetchCurrentUserRole();
  }, [supabase]);

  // Fetch all profiles
  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setIsLoading(true);
    try {
      // Fetch profiles and emails in parallel
      const [profilesRes, emailsRes, privateRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false }),
        fetch("/api/admin/user-emails").then(res => res.ok ? res.json() : { emails: {} }),
        // Phone and signup IP data are private; admins can read them
        supabase.from("profile_private").select("id, phone_number, signup_ip, ip_location, is_vpn"),
      ]);

      if (profilesRes.error) {
        toast.error("Failed to load users: " + profilesRes.error.message);
        return;
      }

      // Merge emails and phones into profiles
      const emailMap: Record<string, string> = emailsRes.emails || {};
      const phoneMap: Record<string, string> = emailsRes.phones || {};
      type PrivateFields = Pick<Profile, "id" | "phone_number" | "signup_ip" | "ip_location" | "is_vpn">;
      const privateMap = new Map<string, PrivateFields>(
        ((privateRes.data || []) as PrivateFields[]).map((p) => [p.id, p])
      );
      const profilesWithData = (profilesRes.data || []).map((profile: Profile) => {
        const priv = privateMap.get(profile.id);
        return {
          ...profile,
          email: emailMap[profile.id] || undefined,
          phone_number: priv?.phone_number || phoneMap[profile.id] || undefined,
          signup_ip: priv?.signup_ip || undefined,
          ip_location: priv?.ip_location || undefined,
          is_vpn: priv?.is_vpn ?? false,
        };
      });

      setProfiles(profilesWithData);
    } catch (err) {
      toast.error("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch permissions for selected user
  const fetchUserPermissions = async (userId: string) => {
    setLoadingPermissions(true);
    try {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("permission")
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching permissions:", error);
        setUserPermissions([]);
        setPendingPermissions([]);
        return;
      }

      const perms = data?.map((p) => p.permission) || [];
      setUserPermissions(perms);
      setPendingPermissions(perms);
    } catch (err) {
      console.error(err);
      setUserPermissions([]);
      setPendingPermissions([]);
    } finally {
      setLoadingPermissions(false);
    }
  };

  // Filter profiles based on search and role
  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      const matchesSearch =
        searchQuery === "" ||
        profile.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.phone_number?.includes(searchQuery);

      const matchesRole =
        roleFilter === "all" || profile.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [profiles, searchQuery, roleFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = profiles.length;
    const admins = profiles.filter((p) => p.role === "admin").length;
    const teachers = profiles.filter((p) => p.role === "teacher").length;
    const students = profiles.filter((p) => p.role === "user").length;
    const paidPro = profiles.filter((p) => isPaidPro(p)).length;
    const trialUsers = profiles.filter((p) => isTrialUser(p)).length;
    return { total, admins, teachers, students, paidPro, trialUsers };
  }, [profiles]);

  // Open user management dialog
  const openUserDialog = (profile: Profile) => {
    setSelectedUser(profile);
    setNewRole(profile.role);
    setDialogOpen(true);
    setShowDeleteConfirm(false);
    setDeleteConfirmText("");
    fetchUserPermissions(profile.id);
  };

  // Toggle permission
  const togglePermission = (permission: string) => {
    setPendingPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  // Apply preset permissions
  const applyPreset = (presetPermissions: string[]) => {
    setPendingPermissions(presetPermissions);
  };

  // Check if permissions changed
  const permissionsChanged = useMemo(() => {
    if (userPermissions.length !== pendingPermissions.length) return true;
    return !userPermissions.every((p) => pendingPermissions.includes(p));
  }, [userPermissions, pendingPermissions]);

  // Update user role
  const handleUpdateRole = async () => {
    if (!selectedUser || !newRole) return;
    if (currentUserRole !== "admin") {
      toast.error("Only admins can change user roles");
      return;
    }

    setIsUpdating(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", selectedUser.id)
        .select()
        .single();

      if (error) {
        toast.error("Failed to update role: " + error.message);
        console.error("Role update error:", error);
        return;
      }

      if (!data) {
        toast.error("Update failed - no data returned. Check RLS policies.");
        return;
      }

      // Update both profiles list and selected user
      const updatedRole = newRole as Profile["role"];
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === selectedUser.id ? { ...p, role: updatedRole } : p
        )
      );
      setSelectedUser({ ...selectedUser, role: updatedRole });

      toast.success(`Role updated to ${ROLE_CONFIG[newRole as keyof typeof ROLE_CONFIG].label}`);
    } catch (err) {
      toast.error("An unexpected error occurred");
      console.error("Role update exception:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Toggle Pro membership
  const handleToggleProStatus = async () => {
    if (!selectedUser) return;
    if (currentUserRole !== "admin") {
      toast.error("Only admins can manage Pro status");
      return;
    }

    const newProStatus = !selectedUser.is_pro_member;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_pro_member: newProStatus })
        .eq("id", selectedUser.id);

      if (error) {
        toast.error("Failed to update Pro status: " + error.message);
        return;
      }

      setSelectedUser({ ...selectedUser, is_pro_member: newProStatus });
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === selectedUser.id ? { ...p, is_pro_member: newProStatus } : p
        )
      );

      toast.success(
        newProStatus
          ? `${selectedUser.full_name || "User"} upgraded to Pro`
          : `${selectedUser.full_name || "User"} downgraded to Free`
      );
    } catch (err) {
      toast.error("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Save permissions
  const handleSavePermissions = async () => {
    if (!selectedUser || !currentUserId) return;
    if (currentUserRole !== "admin") {
      toast.error("Only admins can manage permissions");
      return;
    }

    setIsUpdating(true);
    try {
      // Find permissions to add and remove
      const toAdd = pendingPermissions.filter((p) => !userPermissions.includes(p));
      const toRemove = userPermissions.filter((p) => !pendingPermissions.includes(p));

      // Remove permissions
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("user_permissions")
          .delete()
          .eq("user_id", selectedUser.id)
          .in("permission", toRemove);

        if (error) throw error;
      }

      // Add permissions
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from("user_permissions")
          .insert(
            toAdd.map((permission) => ({
              user_id: selectedUser.id,
              permission,
              granted_by: currentUserId,
            }))
          );

        if (error) throw error;
      }

      // Update cached permissions in profile
      await supabase
        .from("profiles")
        .update({ permissions: pendingPermissions })
        .eq("id", selectedUser.id);

      setUserPermissions(pendingPermissions);
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === selectedUser.id ? { ...p, permissions: pendingPermissions } : p
        )
      );

      toast.success("Permissions updated successfully");
    } catch (err) {
      toast.error("Failed to update permissions");
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete user handler
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (currentUserRole !== "admin") {
      toast.error("Only admins can delete users");
      return;
    }

    // Verify confirmation text matches username
    const expectedText = selectedUser.username || selectedUser.id.slice(0, 8);
    if (deleteConfirmText !== expectedText) {
      toast.error(`Please type "${expectedText}" to confirm deletion`);
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to delete user");
        return;
      }

      // Remove user from local state
      setProfiles((prev) => prev.filter((p) => p.id !== selectedUser.id));
      setDialogOpen(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
      setSelectedUser(null);

      toast.success(data.message || "User deleted successfully");
    } catch (err) {
      toast.error("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Prepare export data
  const getExportData = () => {
    return filteredProfiles.map((profile) => ({
      "Full Name": profile.full_name || "",
      "Username": profile.username || "",
      "Email": profile.email || "",
      "Phone": profile.phone_number || "",
      "Role": ROLE_CONFIG[profile.role].label,
      "Preparing For": profile.preparing_for?.map(e => getExamLabel(e)).join(", ") || "",
      "Pro Member": profile.is_pro_member ? "Yes" : "No",
      "Joined Date": formatDate(profile.created_at),
      "Signup IP": profile.signup_ip || "",
      "VPN": profile.is_vpn ? "Yes" : "No",
      "Location": profile.ip_location || "",
    }));
  };

  // Export to CSV
  const handleExportCSV = () => {
    const dataToExport = getExportData();
    const headers = Object.keys(dataToExport[0] || {});
    const csvRows = [
      headers.join(","),
      ...dataToExport.map((row) =>
        headers
          .map((header) => {
            const value = row[header as keyof typeof row] || "";
            const escaped = String(value).replace(/"/g, '""');
            return escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")
              ? `"${escaped}"`
              : escaped;
          })
          .join(",")
      ),
    ];
    const csvContent = csvRows.join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `prepspsc-users-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${dataToExport.length} users to CSV`);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const dataToExport = getExportData();

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 25 }, // Full Name
      { wch: 20 }, // Username
      { wch: 30 }, // Email
      { wch: 15 }, // Phone
      { wch: 10 }, // Role
      { wch: 12 }, // Pro Member
      { wch: 15 }, // Joined Date
      { wch: 15 }, // Signup IP
      { wch: 6 },  // VPN
      { wch: 20 }, // Location
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");

    // Generate file and download
    XLSX.writeFile(workbook, `prepspsc-users-${new Date().toISOString().split("T")[0]}.xlsx`);

    toast.success(`Exported ${dataToExport.length} users to Excel`);
  };

  const isAdmin = currentUserRole === "admin";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? "Manage user roles and permissions" : "View users (Admin access required for changes)"}
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={filteredProfiles.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel}>
                <Download className="w-4 h-4 mr-2" />
                Export as Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export as CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={fetchProfiles} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.admins}</p>
              <p className="text-xs text-muted-foreground">Admins</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.teachers}</p>
              <p className="text-xs text-muted-foreground">Teachers</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center">
              <User className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.students}</p>
              <p className="text-xs text-muted-foreground">Students</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.paidPro}</p>
              <p className="text-xs text-muted-foreground">Pro Members</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.trialUsers}</p>
              <p className="text-xs text-muted-foreground">Trial Users</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, username, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
            <SelectItem value="teacher">Teachers</SelectItem>
            <SelectItem value="user">Students</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <div className="glass-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Preparing For</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Loading users...</p>
                </TableCell>
              </TableRow>
            ) : filteredProfiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No users found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredProfiles.map((profile) => {
                const roleConfig = ROLE_CONFIG[profile.role];
                const RoleIcon = roleConfig.icon;
                const permCount = profile.permissions?.length || 0;

                return (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                          {profile.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt={profile.full_name || "User"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium">
                              {profile.full_name || profile.username || "Unnamed User"}
                            </p>
                            {isTrialUser(profile) ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                                New
                              </Badge>
                            ) : isPaidPro(profile) ? (
                              <Crown className="w-3.5 h-3.5 text-yellow-500" />
                            ) : null}
                            {profile.is_vpn && (
                              <span title="VPN/Proxy detected at signup"><ShieldAlert className="w-3.5 h-3.5 text-red-500" /></span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            @{profile.username || profile.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {profile.email ? (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Mail className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[180px]" title={profile.email}>
                            {profile.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {profile.phone_number ? (
                        <a
                          href={`tel:${profile.phone_number}`}
                          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{profile.phone_number}</span>
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {profile.preparing_for && profile.preparing_for.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {profile.preparing_for.slice(0, 2).map((exam) => (
                            <Badge key={exam} variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-violet-500/10 text-violet-400 border-violet-500/20">
                              {getExamLabel(exam)}
                            </Badge>
                          ))}
                          {profile.preparing_for.length > 2 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
                              +{profile.preparing_for.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${roleConfig.color} flex items-center gap-1 w-fit`}
                      >
                        <RoleIcon className="w-3 h-3" />
                        {roleConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {profile.role === "admin" ? (
                        <Badge className="bg-primary/10 text-primary border-primary/20">
                          Full Access
                        </Badge>
                      ) : profile.role === "teacher" && permCount > 0 ? (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                          {permCount} permission{permCount !== 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {formatDate(profile.created_at)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openUserDialog(profile)}
                        >
                          <Settings className="w-4 h-4 mr-1" />
                          Manage
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          View Only
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* User Management Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setShowDeleteConfirm(false);
          setDeleteConfirmText("");
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage User</DialogTitle>
            <DialogDescription>
              Configure role and permissions for {selectedUser?.full_name || selectedUser?.username || "this user"}
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center overflow-hidden">
                  {selectedUser.avatar_url ? (
                    <img
                      src={selectedUser.avatar_url}
                      alt={selectedUser.full_name || "User"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    {selectedUser.full_name || selectedUser.username || "Unnamed User"}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm text-muted-foreground">
                      @{selectedUser.username || selectedUser.id.slice(0, 8)}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedUser.id);
                        toast.success("User ID copied to clipboard");
                      }}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title="Copy User ID"
                    >
                      <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                  {selectedUser.email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                      <Mail className="w-3 h-3" />
                      {selectedUser.email}
                    </p>
                  )}
                  {selectedUser.phone_number && (
                    <a
                      href={`tel:${selectedUser.phone_number}`}
                      className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 hover:text-primary transition-colors"
                    >
                      <Phone className="w-3 h-3" />
                      {selectedUser.phone_number}
                    </a>
                  )}
                  {/* Signup IP Info */}
                  {selectedUser.signup_ip && (
                    <div className="flex items-center gap-1 mt-1">
                      <Globe className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {selectedUser.signup_ip}
                      </span>
                      {selectedUser.ip_location && selectedUser.ip_location !== "Unknown" && (
                        <span className="text-xs text-muted-foreground">
                          ({selectedUser.ip_location})
                        </span>
                      )}
                      {selectedUser.is_vpn && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-500/10 text-red-500 border-red-500/20">
                          VPN
                        </Badge>
                      )}
                    </div>
                  )}
                  {/* Preparing For */}
                  {selectedUser.preparing_for && selectedUser.preparing_for.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {selectedUser.preparing_for.map((exam) => (
                        <Badge key={exam} variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-violet-500/10 text-violet-400 border-violet-500/20">
                          {getExamLabel(exam)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={ROLE_CONFIG[selectedUser.role].color}
                >
                  {ROLE_CONFIG[selectedUser.role].label}
                </Badge>
              </div>

              <Tabs defaultValue="role" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="role">Role</TabsTrigger>
                  <TabsTrigger value="permissions" disabled={selectedUser.role === "admin"}>
                    Permissions
                  </TabsTrigger>
                </TabsList>

                {/* Role Tab */}
                <TabsContent value="role" className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">User Role</label>
                    <Select value={newRole} onValueChange={setNewRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>Student</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="teacher">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="w-4 h-4" />
                            <span>Teacher</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            <span>Admin</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {newRole === "user" && "Students can take tests and use study features."}
                      {newRole === "teacher" && "Teachers can access admin panel with specific permissions you assign."}
                      {newRole === "admin" && "Admins have full access to all features."}
                    </p>
                  </div>

                  {newRole === "admin" && selectedUser.role !== "admin" && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        <strong>Warning:</strong> Admins have full access to everything including user management and system settings.
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleUpdateRole}
                    disabled={isUpdating || newRole === selectedUser.role}
                    className="w-full"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Role"
                    )}
                  </Button>

                  {/* Pro Membership Section */}
                  <div className="border-t pt-4 mt-4 space-y-3">
                    <label className="text-sm font-medium">Pro Membership</label>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${selectedUser.is_pro_member ? "bg-yellow-500/10" : "bg-muted"}`}>
                          <Crown className={`w-5 h-5 ${selectedUser.is_pro_member ? "text-yellow-500" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {selectedUser.is_pro_member ? "Pro Member" : "Free Member"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {selectedUser.is_pro_member
                              ? "This user has Pro access"
                              : "Upgrade to grant Pro features without payment"}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant={selectedUser.is_pro_member ? "outline" : "default"}
                        size="sm"
                        onClick={handleToggleProStatus}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : selectedUser.is_pro_member ? (
                          <>
                            <X className="w-3.5 h-3.5 mr-1" />
                            Remove Pro
                          </>
                        ) : (
                          <>
                            <Crown className="w-3.5 h-3.5 mr-1" />
                            Upgrade to Pro
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Delete User Section */}
                  {selectedUser.role !== "admin" && (
                    <div className="border-t pt-4 mt-4 space-y-3">
                      <label className="text-sm font-medium text-destructive">Danger Zone</label>
                      {!showDeleteConfirm ? (
                        <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                              <Trash2 className="w-5 h-5 text-destructive" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Delete User</p>
                              <p className="text-xs text-muted-foreground">
                                Permanently delete this user and all their data
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowDeleteConfirm(true)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Delete
                          </Button>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg border border-destructive bg-destructive/5 space-y-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                            <div>
                              <p className="font-medium text-destructive">Are you sure?</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                This will permanently delete the user account and all associated data including:
                              </p>
                              <ul className="text-sm text-muted-foreground mt-2 list-disc list-inside space-y-1">
                                <li>Test attempts and answers</li>
                                <li>Study sessions and progress</li>
                                <li>AI generations and study materials</li>
                                <li>XP, achievements, and streaks</li>
                                <li>Messages and room memberships</li>
                              </ul>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Type <span className="font-mono bg-muted px-1 rounded">{selectedUser.username || selectedUser.id.slice(0, 8)}</span> to confirm
                            </label>
                            <Input
                              value={deleteConfirmText}
                              onChange={(e) => setDeleteConfirmText(e.target.value)}
                              placeholder="Type username to confirm"
                              className="border-destructive/30"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowDeleteConfirm(false);
                                setDeleteConfirmText("");
                              }}
                              disabled={isDeleting}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={handleDeleteUser}
                              disabled={isDeleting || deleteConfirmText !== (selectedUser.username || selectedUser.id.slice(0, 8))}
                            >
                              {isDeleting ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Permanently Delete
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Permissions Tab */}
                <TabsContent value="permissions" className="space-y-4">
                  {selectedUser.role === "admin" ? (
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <Shield className="w-8 h-8 mx-auto text-primary mb-2" />
                      <p className="font-medium">Admins have full access</p>
                      <p className="text-sm text-muted-foreground">
                        No need to assign specific permissions
                      </p>
                    </div>
                  ) : loadingPermissions ? (
                    <div className="p-8 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mt-2">Loading permissions...</p>
                    </div>
                  ) : (
                    <>
                      {/* Presets */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Quick Presets</label>
                        <div className="flex flex-wrap gap-2">
                          {PERMISSION_PRESETS.map((preset) => (
                            <Button
                              key={preset.name}
                              variant="outline"
                              size="sm"
                              onClick={() => applyPreset(preset.permissions)}
                              className="text-xs"
                            >
                              {preset.name}
                            </Button>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPendingPermissions([])}
                            className="text-xs text-destructive"
                          >
                            Clear All
                          </Button>
                        </div>
                      </div>

                      {/* Permission Categories */}
                      <div className="space-y-4">
                        {PERMISSION_CATEGORIES.map((category) => (
                          <div key={category.name} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium">{category.name}</h4>
                              <span className="text-xs text-muted-foreground">
                                {category.description}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {category.permissions.map((perm) => (
                                <label
                                  key={perm.key}
                                  className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                                >
                                  <Checkbox
                                    checked={pendingPermissions.includes(perm.key)}
                                    onCheckedChange={() => togglePermission(perm.key)}
                                  />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">{perm.label}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {perm.description}
                                    </p>
                                  </div>
                                  {pendingPermissions.includes(perm.key) && (
                                    <Check className="w-4 h-4 text-green-500" />
                                  )}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Save Button */}
                      <Button
                        onClick={handleSavePermissions}
                        disabled={isUpdating || !permissionsChanged}
                        className="w-full"
                      >
                        {isUpdating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            Save Permissions
                            {permissionsChanged && (
                              <Badge className="ml-2 bg-primary text-primary-foreground">
                                {pendingPermissions.length} selected
                              </Badge>
                            )}
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
