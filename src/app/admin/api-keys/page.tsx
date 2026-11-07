"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Key,
  Plus,
  Loader2,
  Copy,
  AlertTriangle,
  BarChart3,
  Ban,
  RefreshCw,
  Globe,
  Users,
  BookmarkCheck,
  Zap,
  Clock,
  ExternalLink,
  Maximize2,
  Minimize2,
  Shield,
  X,
  Plus as PlusIcon,
} from "lucide-react";
import { generateApiKey, listApiKeys, revokeApiKey, getKeyStats, updateAllowedIps } from "./actions";

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  owner_email: string;
  tier: string;
  status: string;
  total_requests: number;
  rate_limit_rpm: number;
  monthly_quota: number;
  allowed_ips: string[];
  last_used_at: string | null;
  created_at: string;
  current_month_usage: number;
  app_name: string | null;
  website_url: string | null;
  phone_number: string | null;
  developer_email: string | null;
}

interface KeyStats {
  key: ApiKey & { rate_limit_rpm: number; monthly_quota: number };
  quotas: { month: string; request_count: number }[];
  recentUsage: {
    endpoint: string;
    query: string | null;
    status_code: number;
    response_time_ms: number | null;
    ip_address: string | null;
    results_count: number | null;
    error_message: string | null;
    created_at: string;
  }[];
  endpointBreakdown: {
    endpoint: string;
    count: number;
    errors: number;
    avgMs: number | null;
  }[];
  summary: {
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    avgResponseMs: number | null;
    uniqueIps: number;
    uniqueUsers: number;
    totalAnswered: number;
    correctAnswers: number;
    bookmarks: number;
  };
  developer: {
    name: string;
    email: string;
    app_name: string;
    app_description: string | null;
    website_url: string | null;
    created_at: string;
  } | null;
}

const TIER_BADGE: Record<string, string> = {
  free: "bg-muted text-muted-foreground border-border",
  paid: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  enterprise: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  suspended: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  revoked: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function AdminApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [tier, setTier] = useState("free");

  // Key reveal dialog
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState("");

  // Revoke confirm dialog
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  // Stats dialog
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState<KeyStats | null>(null);
  const [statsExpanded, setStatsExpanded] = useState(false);

  // IP allowlist dialog
  const [ipDialogOpen, setIpDialogOpen] = useState(false);
  const [ipTarget, setIpTarget] = useState<ApiKey | null>(null);
  const [ipList, setIpList] = useState<string[]>([]);
  const [newIp, setNewIp] = useState("");
  const [savingIps, setSavingIps] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    setIsLoading(true);
    try {
      const data = await listApiKeys();
      setKeys(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load keys");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!email || !name) {
      toast.error("Email and name are required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    setCreating(true);
    try {
      const result = await generateApiKey({ email, name, tier });
      setRevealedKey(result.key);
      setCreateOpen(false);
      setRevealOpen(true);
      setEmail("");
      setName("");
      setTier("free");
      fetchKeys();
      toast.success("API key created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokeApiKey(revokeTarget.id);
      setRevokeOpen(false);
      setRevokeTarget(null);
      fetchKeys();
      toast.success("Key revoked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke key");
    } finally {
      setRevoking(false);
    }
  };

  const openIpDialog = (key: ApiKey) => {
    setIpTarget(key);
    setIpList(key.allowed_ips || []);
    setNewIp("");
    setIpDialogOpen(true);
  };

  const handleSaveIps = async () => {
    if (!ipTarget) return;
    setSavingIps(true);
    try {
      await updateAllowedIps(ipTarget.id, ipList);
      toast.success("IP allowlist updated");
      setIpDialogOpen(false);
      fetchKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update IPs");
    } finally {
      setSavingIps(false);
    }
  };

  const addIp = () => {
    const trimmed = newIp.trim();
    if (!trimmed) return;
    if (ipList.includes(trimmed)) {
      toast.error("IP already in list");
      return;
    }
    setIpList([...ipList, trimmed]);
    setNewIp("");
  };

  const openStats = async (key: ApiKey) => {
    setStatsOpen(true);
    setStatsLoading(true);
    setStats(null);
    setStatsExpanded(false);
    try {
      const data = await getKeyStats(key.id);
      setStats(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load stats");
      setStatsOpen(false);
    } finally {
      setStatsLoading(false);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const maxQuotaCount = stats?.quotas.length
    ? Math.max(...stats.quotas.map((q) => q.request_count), 1)
    : 1;

  const maxEndpointCount = stats?.endpointBreakdown.length
    ? Math.max(...stats.endpointBreakdown.map((e) => e.count), 1)
    : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Key className="w-6 h-6" />
            API Keys
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage external API keys and monitor usage
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchKeys} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Create Key
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card border border-border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>This Month</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Loading keys...</p>
                </TableCell>
              </TableRow>
            ) : keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Key className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No API keys yet</p>
                </TableCell>
              </TableRow>
            ) : (
              keys.map((k) => {
                const quotaPercent = k.monthly_quota > 0
                  ? Math.min((k.current_month_usage / k.monthly_quota) * 100, 100)
                  : 0;
                const quotaColor = quotaPercent > 90 ? "bg-red-500" : quotaPercent > 70 ? "bg-yellow-500" : "bg-primary";

                return (
                  <TableRow key={k.id}>
                    <TableCell>
                      <div>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {k.key_prefix}
                        </code>
                        <div className="font-medium mt-1 text-sm">{k.name}</div>
                        {k.app_name && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Globe className="w-3 h-3" />
                            {k.app_name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{k.owner_email}</div>
                      {k.phone_number && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">{k.phone_number}</div>
                      )}
                      {k.website_url && (
                        <a
                          href={k.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-primary hover:underline flex items-center gap-0.5 mt-0.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {new URL(k.website_url).hostname}
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TIER_BADGE[k.tier] || ""}>
                        {k.tier}
                      </Badge>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {k.rate_limit_rpm} RPM
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGE[k.status] || ""}>
                        {k.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {k.current_month_usage.toLocaleString()}
                        <span className="text-muted-foreground font-normal">
                          {k.monthly_quota > 0 ? ` / ${k.monthly_quota.toLocaleString()}` : ""}
                        </span>
                      </div>
                      {k.monthly_quota > 0 && (
                        <div className="w-20 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${quotaColor}`}
                            style={{ width: `${quotaPercent}%` }}
                          />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {k.total_requests.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {k.last_used_at ? formatDate(k.last_used_at) : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openStats(k)}
                        >
                          <BarChart3 className="w-4 h-4 mr-1" />
                          Stats
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openIpDialog(k)}
                          title="IP Allowlist"
                          className={k.allowed_ips?.length > 0 ? "text-green-500 border-green-500/30" : ""}
                        >
                          <Shield className="w-4 h-4" />
                          {k.allowed_ips?.length > 0 && (
                            <span className="ml-1 text-xs">{k.allowed_ips.length}</span>
                          )}
                        </Button>
                        {k.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRevokeTarget(k);
                              setRevokeOpen(true);
                            }}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Ban className="w-4 h-4 mr-1" />
                            Revoke
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Key Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Generate a new external API key for a user or application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Owner Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Key Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Application"
              />
            </div>
            <div className="space-y-2">
              <Label>Tier</Label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free (10 RPM / 1K monthly)</SelectItem>
                  <SelectItem value="paid">Paid (60 RPM / 50K monthly)</SelectItem>
                  <SelectItem value="enterprise">Enterprise (500 RPM / Unlimited)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Key"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Key Reveal Dialog */}
      <Dialog open={revealOpen} onOpenChange={setRevealOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy the key below. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                This key will only be displayed once. Make sure to copy it now.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-muted px-3 py-2 rounded break-all">
                {revealedKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(revealedKey);
                  toast.success("Key copied to clipboard");
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirm Dialog */}
      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke{" "}
              <strong>{revokeTarget?.name}</strong> ({revokeTarget?.key_prefix})?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Revoking...
                </>
              ) : (
                "Revoke Key"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Dialog */}
      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogContent className={`max-h-[90vh] overflow-y-auto transition-all duration-200 ${statsExpanded ? "max-w-[95vw] w-[95vw]" : "max-w-3xl"}`}>
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Key Statistics
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setStatsExpanded(!statsExpanded)}
                title={statsExpanded ? "Collapse" : "Expand"}
              >
                {statsExpanded ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
            </div>
            {stats && (
              <DialogDescription>
                {stats.key.name} ({stats.key.key_prefix}) &mdash;{" "}
                {stats.key.tier} tier
              </DialogDescription>
            )}
          </DialogHeader>

          {statsLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">Loading stats...</p>
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Developer Info */}
              {stats.developer && (
                <div className="p-3 bg-muted/50 rounded-lg border border-border">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Developer</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> {stats.developer.name}</div>
                    <div><span className="text-muted-foreground">Email:</span> {stats.developer.email}</div>
                    <div><span className="text-muted-foreground">App:</span> {stats.developer.app_name}</div>
                    {stats.developer.website_url && (
                      <div>
                        <span className="text-muted-foreground">Site:</span>{" "}
                        <a href={stats.developer.website_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {new URL(stats.developer.website_url).hostname}
                        </a>
                      </div>
                    )}
                    {stats.developer.app_description && (
                      <div className="col-span-2 text-muted-foreground text-xs mt-1">
                        {stats.developer.app_description}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Overview Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Total Requests
                  </p>
                  <p className="text-lg font-bold">
                    {stats.summary.totalRequests.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Error Rate
                  </p>
                  <p className={`text-lg font-bold ${stats.summary.errorRate > 10 ? "text-red-500" : ""}`}>
                    {stats.summary.errorRate}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">{stats.summary.totalErrors} errors</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Avg Response
                  </p>
                  <p className="text-lg font-bold">
                    {stats.summary.avgResponseMs != null ? `${stats.summary.avgResponseMs}ms` : "—"}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Unique IPs
                  </p>
                  <p className="text-lg font-bold">{stats.summary.uniqueIps}</p>
                </div>
              </div>

              {/* Engagement Stats */}
              {(stats.summary.uniqueUsers > 0 || stats.summary.bookmarks > 0) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> End Users
                    </p>
                    <p className="text-lg font-bold">{stats.summary.uniqueUsers}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Questions Answered</p>
                    <p className="text-lg font-bold">{stats.summary.totalAnswered.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Accuracy</p>
                    <p className="text-lg font-bold">
                      {stats.summary.totalAnswered > 0
                        ? `${Math.round((stats.summary.correctAnswers / stats.summary.totalAnswered) * 100)}%`
                        : "—"}
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <BookmarkCheck className="w-3 h-3" /> Bookmarks
                    </p>
                    <p className="text-lg font-bold">{stats.summary.bookmarks}</p>
                  </div>
                </div>
              )}

              {/* Quota + Limits */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Rate Limit</p>
                  <p className="text-lg font-bold">{stats.key.rate_limit_rpm} RPM</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Monthly Quota</p>
                  <p className="text-lg font-bold">
                    {stats.key.monthly_quota === 0
                      ? "Unlimited"
                      : stats.key.monthly_quota.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={STATUS_BADGE[stats.key.status] || ""}
                  >
                    {stats.key.status}
                  </Badge>
                </div>
              </div>

              {/* Endpoint Breakdown */}
              {stats.endpointBreakdown.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3">Endpoint Breakdown</h4>
                  <div className="space-y-2">
                    {stats.endpointBreakdown.map((ep) => (
                      <div key={ep.endpoint} className="flex items-center gap-3">
                        <code className="text-xs text-muted-foreground w-32 shrink-0 truncate" title={ep.endpoint}>
                          {ep.endpoint}
                        </code>
                        <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                          <div
                            className="h-full bg-primary rounded transition-all"
                            style={{ width: `${(ep.count / maxEndpointCount) * 100}%` }}
                          />
                        </div>
                        <div className="text-xs text-right w-28 shrink-0 flex items-center gap-2 justify-end">
                          <span className="font-medium">{ep.count}</span>
                          {ep.errors > 0 && (
                            <span className="text-red-500">{ep.errors} err</span>
                          )}
                          {ep.avgMs != null && (
                            <span className="text-muted-foreground">{ep.avgMs}ms</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly Usage Chart */}
              <div>
                <h4 className="text-sm font-medium mb-3">Monthly Usage</h4>
                {stats.quotas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No monthly data yet.</p>
                ) : (
                  <div className="space-y-2">
                    {stats.quotas
                      .slice()
                      .reverse()
                      .map((q) => (
                        <div key={q.month} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-16 shrink-0">
                            {q.month}
                          </span>
                          <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                            <div
                              className="h-full bg-primary rounded transition-all"
                              style={{
                                width: `${(q.request_count / maxQuotaCount) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium w-16 text-right">
                            {q.request_count.toLocaleString()}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Recent Requests */}
              <div>
                <h4 className="text-sm font-medium mb-3">
                  Recent Requests ({stats.recentUsage.length})
                </h4>
                {stats.recentUsage.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No usage data yet.</p>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Endpoint</TableHead>
                          <TableHead>Query</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>IP</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.recentUsage.map((u, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-mono">
                              {u.endpoint}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate" title={u.query || ""}>
                              {u.query || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  u.status_code < 400
                                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                                    : "bg-red-500/10 text-red-500 border-red-500/20"
                                }
                              >
                                {u.status_code}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {u.response_time_ms != null
                                ? `${u.response_time_ms}ms`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {u.ip_address || "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(u.created_at).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* IP Allowlist Dialog */}
      <Dialog open={ipDialogOpen} onOpenChange={setIpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              IP Allowlist
            </DialogTitle>
            <DialogDescription>
              Restrict <strong>{ipTarget?.name}</strong> to specific IP addresses.
              Leave empty to allow all IPs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current IPs */}
            {ipList.length > 0 ? (
              <div className="space-y-2">
                {ipList.map((ip, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg"
                  >
                    <code className="text-sm">{ip}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-red-500"
                      onClick={() =>
                        setIpList(ipList.filter((_, idx) => idx !== i))
                      }
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-3">
                No IP restrictions — all IPs allowed
              </p>
            )}

            {/* Add IP */}
            <div className="flex gap-2">
              <Input
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                placeholder="e.g. 203.0.113.50"
                onKeyDown={(e) => e.key === "Enter" && addIp()}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={addIp}>
                <PlusIcon className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIpDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveIps} disabled={savingIps}>
              {savingIps ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
