"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  MessageSquare,
  Bug,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  Crown,
  User,
  Monitor,
  Smartphone,
  ExternalLink,
  Star,
  Mail,
  Calendar,
  Image as ImageIcon,
} from "lucide-react";
import type {
  FeedbackReport,
  FeedbackReply,
  FeedbackStatus,
  Profile,
} from "@/types/database.types";

interface FeedbackWithUser extends FeedbackReport {
  profiles: Pick<
    Profile,
    "full_name" | "username" | "avatar_url" | "is_pro_member" | "created_at"
  > | null;
  user_email?: string;
}

interface ReplyWithAdmin extends FeedbackReply {
  admin_profile?: { full_name: string | null } | null;
}

const STATUS_CONFIG: Record<
  FeedbackStatus,
  {
    label: string;
    icon: React.ElementType;
    className: string;
  }
> = {
  new: {
    label: "New",
    icon: Clock,
    className: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  in_progress: {
    label: "In Progress",
    icon: Loader2,
    className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  },
  resolved: {
    label: "Resolved",
    icon: CheckCircle2,
    className: "bg-green-500/10 text-green-500 border-green-500/20",
  },
  closed: {
    label: "Closed",
    icon: XCircle,
    className: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  },
};

export default function AdminFeedbackPage() {
  const [feedbackList, setFeedbackList] = useState<FeedbackWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Detail dialog state
  const [selectedFeedback, setSelectedFeedback] =
    useState<FeedbackWithUser | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [replies, setReplies] = useState<ReplyWithAdmin[]>([]);
  const [newReply, setNewReply] = useState("");
  const [isReplyInternal, setIsReplyInternal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isTogglingVerified, setIsTogglingVerified] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const fetchFeedback = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch feedback reports
      const { data: feedbackData, error: feedbackError } = await supabase
        .from("feedback_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (feedbackError) {
        console.error("Supabase error:", feedbackError.message, feedbackError.code);
        throw new Error(feedbackError.message);
      }

      const data = feedbackData || [];

      // Get unique user IDs
      const userIds = [...new Set(data.map((fb) => fb.user_id))];

      // Fetch profiles for these users
      let profilesMap: Record<string, FeedbackWithUser["profiles"]> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url, is_pro_member, created_at")
          .in("id", userIds);

        if (profilesData) {
          profilesMap = Object.fromEntries(
            profilesData.map((p) => [p.id, p])
          );
        }
      }

      // Fetch user emails via API
      let emails: Record<string, string> = {};
      if (userIds.length > 0) {
        try {
          const response = await fetch("/api/admin/feedback-users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds }),
          });
          if (response.ok) {
            const result = await response.json();
            emails = result.emails || {};
          }
        } catch (emailErr) {
          console.error("Failed to fetch user emails:", emailErr);
        }
      }

      // Combine data
      const feedbackWithUsers = data.map((fb) => ({
        ...fb,
        profiles: profilesMap[fb.user_id] || null,
        user_email: emails[fb.user_id] || "Email not available",
      }));

      setFeedbackList(feedbackWithUsers);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Failed to load feedback:", message);
      toast.error(`Failed to load feedback: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const fetchReplies = async (feedbackId: number) => {
    // Fetch replies
    const { data: repliesData, error } = await supabase
      .from("feedback_replies")
      .select("*")
      .eq("feedback_id", feedbackId)
      .order("created_at", { ascending: true });

    if (error || !repliesData) {
      console.error("Failed to fetch replies:", error?.message);
      return;
    }

    // Get unique admin IDs
    const adminIds = [...new Set(repliesData.map((r) => r.admin_id))];

    // Fetch admin profiles separately
    let adminProfilesMap: Record<string, { full_name: string | null }> = {};
    if (adminIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", adminIds);

      if (profilesData) {
        adminProfilesMap = Object.fromEntries(
          profilesData.map((p) => [p.id, { full_name: p.full_name }])
        );
      }
    }

    // Combine data
    const repliesWithAdmin = repliesData.map((reply) => ({
      ...reply,
      admin_profile: adminProfilesMap[reply.admin_id] || null,
    }));

    setReplies(repliesWithAdmin as ReplyWithAdmin[]);
  };

  const openDetailDialog = (feedback: FeedbackWithUser) => {
    setSelectedFeedback(feedback);
    setDetailDialogOpen(true);
    setNewReply("");
    setIsReplyInternal(false);
    fetchReplies(feedback.id);
  };

  const handleStatusChange = async (newStatus: FeedbackStatus) => {
    if (!selectedFeedback) return;
    setIsUpdatingStatus(true);

    try {
      const { error } = await supabase
        .from("feedback_reports")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", selectedFeedback.id);

      if (error) throw error;

      // Update local state
      setSelectedFeedback({ ...selectedFeedback, status: newStatus });
      setFeedbackList((prev) =>
        prev.map((fb) =>
          fb.id === selectedFeedback.id ? { ...fb, status: newStatus } : fb
        )
      );

      // Create notification for user if status changed to resolved
      if (newStatus === "resolved") {
        await supabase.from("user_notifications").insert({
          user_id: selectedFeedback.user_id,
          type: "feedback_status",
          title: "Your feedback has been resolved",
          message: `Your report about "${selectedFeedback.description.slice(0, 50)}..." has been resolved.`,
          metadata: { feedback_id: selectedFeedback.id },
        });
      }

      toast.success(
        `Status updated to ${STATUS_CONFIG[newStatus].label}`
      );
    } catch {
      toast.error("Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleToggleVerified = async () => {
    if (!selectedFeedback) return;
    setIsTogglingVerified(true);

    const newValue = !selectedFeedback.is_verified_bug;

    try {
      const { error } = await supabase
        .from("feedback_reports")
        .update({
          is_verified_bug: newValue,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedFeedback.id);

      if (error) throw error;

      setSelectedFeedback({ ...selectedFeedback, is_verified_bug: newValue });
      setFeedbackList((prev) =>
        prev.map((fb) =>
          fb.id === selectedFeedback.id
            ? { ...fb, is_verified_bug: newValue }
            : fb
        )
      );

      toast.success(
        newValue ? "Marked as verified bug" : "Removed verified status"
      );
    } catch {
      toast.error("Failed to update verified status");
    } finally {
      setIsTogglingVerified(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedFeedback || !newReply.trim()) return;
    setIsSending(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("feedback_replies").insert({
        feedback_id: selectedFeedback.id,
        admin_id: user.id,
        message: newReply.trim(),
        is_internal: isReplyInternal,
      });

      if (error) throw error;

      // If not internal, create notification for user
      if (!isReplyInternal) {
        await supabase.from("user_notifications").insert({
          user_id: selectedFeedback.user_id,
          type: "feedback_reply",
          title: "New reply to your feedback",
          message:
            newReply.trim().slice(0, 100) +
            (newReply.length > 100 ? "..." : ""),
          metadata: { feedback_id: selectedFeedback.id },
        });
      }

      toast.success(
        isReplyInternal ? "Internal note added" : "Reply sent to user"
      );
      setNewReply("");
      setIsReplyInternal(false);

      // Close dialog and refresh the list
      setDetailDialogOpen(false);
      fetchFeedback();
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setIsSending(false);
    }
  };

  const filteredFeedback = useMemo(() => {
    return feedbackList.filter((fb) => {
      const matchesSearch =
        searchQuery === "" ||
        fb.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fb.profiles?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fb.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fb.user_email?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || fb.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [feedbackList, searchQuery, statusFilter]);

  const stats = useMemo(
    () => ({
      total: feedbackList.length,
      new: feedbackList.filter((fb) => fb.status === "new").length,
      inProgress: feedbackList.filter((fb) => fb.status === "in_progress")
        .length,
      resolved: feedbackList.filter((fb) => fb.status === "resolved").length,
      verified: feedbackList.filter((fb) => fb.is_verified_bug).length,
    }),
    [feedbackList]
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bug className="w-6 h-6" />
            Feedback & Bug Reports
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage user feedback and bug reports
          </p>
        </div>
        <Button onClick={fetchFeedback} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card p-4 border border-border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 border border-border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.new}</p>
              <p className="text-xs text-muted-foreground">New</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 border border-border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 border border-border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.resolved}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 border border-border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.verified}</p>
              <p className="text-xs text-muted-foreground">Verified Bugs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by description, user, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="glass-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Page</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredFeedback.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Bug className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No feedback found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredFeedback.map((fb) => {
                const statusConfig = STATUS_CONFIG[fb.status];
                const StatusIcon = statusConfig.icon;

                return (
                  <TableRow key={fb.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                          {fb.profiles?.avatar_url ? (
                            <img
                              src={fb.profiles.avatar_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-sm">
                              {fb.profiles?.full_name ||
                                fb.profiles?.username ||
                                "User"}
                            </span>
                            {fb.profiles?.is_pro_member && (
                              <Crown className="w-3 h-3 text-yellow-500" />
                            )}
                            {fb.is_verified_bug && (
                              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            @{fb.profiles?.username || "unknown"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm line-clamp-2 max-w-xs">
                        {fb.description}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {fb.page_feature || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusConfig.className}>
                        <StatusIcon
                          className={`w-3 h-3 mr-1 ${
                            fb.status === "in_progress" ? "animate-spin" : ""
                          }`}
                        />
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatShortDate(fb.created_at)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetailDialog(fb)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5" />
              Feedback Details
            </DialogTitle>
            <DialogDescription>
              Review and respond to this feedback report
            </DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-6">
              {/* User Info */}
              <div className="rounded-lg bg-muted/50 p-4">
                <h4 className="text-sm font-medium mb-3">User Information</h4>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {selectedFeedback.profiles?.avatar_url ? (
                      <img
                        src={selectedFeedback.profiles.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {selectedFeedback.profiles?.full_name || "Unknown User"}
                      </span>
                      {selectedFeedback.profiles?.is_pro_member && (
                        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                          <Crown className="w-3 h-3 mr-1" />
                          Pro
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      @{selectedFeedback.profiles?.username || "unknown"}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {selectedFeedback.user_email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Joined{" "}
                        {selectedFeedback.profiles?.created_at
                          ? formatShortDate(selectedFeedback.profiles.created_at)
                          : "Unknown"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Report Details */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Report Details</h4>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Description
                    </Label>
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {selectedFeedback.description}
                    </p>
                  </div>

                  {selectedFeedback.page_feature && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Page/Feature
                      </Label>
                      <p className="mt-1 text-sm">
                        {selectedFeedback.page_feature}
                      </p>
                    </div>
                  )}

                  {selectedFeedback.steps_to_reproduce && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Steps to Reproduce
                      </Label>
                      <p className="mt-1 text-sm whitespace-pre-wrap">
                        {selectedFeedback.steps_to_reproduce}
                      </p>
                    </div>
                  )}

                  {selectedFeedback.when_started && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        When Started
                      </Label>
                      <p className="mt-1 text-sm capitalize">
                        {selectedFeedback.when_started.replace("_", " ")}
                      </p>
                    </div>
                  )}

                  {selectedFeedback.device_info &&
                    typeof selectedFeedback.device_info === "object" && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Device Info
                        </Label>
                        <div className="mt-1 flex items-center gap-2 text-sm">
                          {(selectedFeedback.device_info as { deviceType?: string })
                            .deviceType === "mobile" ? (
                            <Smartphone className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Monitor className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="capitalize">
                            {(selectedFeedback.device_info as { deviceType?: string })
                              .deviceType || "Unknown"}
                          </span>
                          <span className="text-muted-foreground">|</span>
                          <span>
                            {(selectedFeedback.device_info as { browser?: string })
                              .browser || "Unknown Browser"}
                          </span>
                          <span className="text-muted-foreground">|</span>
                          <span className="text-muted-foreground text-xs">
                            {(
                              selectedFeedback.device_info as {
                                screenWidth?: number;
                                screenHeight?: number;
                              }
                            ).screenWidth || 0}
                            x
                            {(
                              selectedFeedback.device_info as {
                                screenWidth?: number;
                                screenHeight?: number;
                              }
                            ).screenHeight || 0}
                          </span>
                        </div>
                      </div>
                    )}

                  {selectedFeedback.screenshot_url && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Screenshot
                      </Label>
                      <div className="mt-2">
                        <a
                          href={selectedFeedback.screenshot_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={selectedFeedback.screenshot_url}
                            alt="Screenshot"
                            className="max-h-48 rounded-lg border border-border object-contain"
                          />
                        </a>
                        <a
                          href={selectedFeedback.screenshot_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open full size
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Submitted {formatDate(selectedFeedback.created_at)}
                  </div>
                </div>
              </div>

              {/* Admin Actions */}
              <div className="rounded-lg border border-border p-4 space-y-4">
                <h4 className="text-sm font-medium">Admin Actions</h4>

                <div className="flex flex-wrap gap-4">
                  {/* Status */}
                  <div className="space-y-2">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={selectedFeedback.status}
                      onValueChange={(val) =>
                        handleStatusChange(val as FeedbackStatus)
                      }
                      disabled={isUpdatingStatus}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Verified Bug Toggle */}
                  <div className="space-y-2">
                    <Label className="text-xs">Verified Bug</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch
                        checked={selectedFeedback.is_verified_bug}
                        onCheckedChange={handleToggleVerified}
                        disabled={isTogglingVerified}
                      />
                      <span className="text-sm">
                        {selectedFeedback.is_verified_bug ? (
                          <span className="flex items-center gap-1 text-yellow-500">
                            <Star className="w-4 h-4 fill-yellow-500" />
                            Verified
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Not verified
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Replies */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">
                  Replies ({replies.length})
                </h4>

                {replies.length > 0 && (
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {replies.map((reply) => (
                      <div
                        key={reply.id}
                        className={`rounded-lg p-3 text-sm ${
                          reply.is_internal
                            ? "bg-yellow-500/10 border border-yellow-500/20"
                            : "bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {reply.admin_profile?.full_name || "Admin"}
                            </span>
                            {reply.is_internal && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                              >
                                Internal
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(reply.created_at)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{reply.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* New Reply */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Switch
                      id="internal-note"
                      checked={isReplyInternal}
                      onCheckedChange={setIsReplyInternal}
                    />
                    <Label
                      htmlFor="internal-note"
                      className="text-sm cursor-pointer"
                    >
                      Internal note (not visible to user)
                    </Label>
                  </div>
                  <Textarea
                    value={newReply}
                    onChange={(e) => setNewReply(e.target.value)}
                    placeholder={isReplyInternal ? "Write an internal note..." : "Write a reply to the user..."}
                    rows={4}
                    className="resize-none border-2 focus:border-primary"
                  />
                  <div className="flex items-center justify-end">
                    <Button
                      onClick={handleSendReply}
                      disabled={isSending || !newReply.trim()}
                      size="sm"
                    >
                      {isSending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      {isReplyInternal ? "Add Note" : "Send Reply"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
