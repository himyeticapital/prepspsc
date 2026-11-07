"use client";

import {
  Volume2,
  Bell,
  BellOff,
  Users,
  BookOpen,
  AtSign,
  Timer,
  Moon,
  Coffee,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/stores/notification-store";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function SettingsWidget() {
  const { settings, toggleSetting } = useNotificationStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const isLofi = mounted ? theme === "lofi" : false;

  const toggleTheme = () => {
    setTheme(isLofi ? "dark" : "lofi");
  };

  return (
    <ScrollArea className="h-[420px]">
      <div className="p-4 space-y-4">
        {/* Master Notification Toggle */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Notifications
          </p>

          <SettingRow
            icon={settings.enabled ? Bell : BellOff}
            label="Enable Notifications"
            description="Master toggle for all notifications"
            checked={settings.enabled}
            onToggle={() => toggleSetting("enabled")}
            highlight
          />
        </div>

        {/* Notification Types */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Notification Types
          </p>

          <SettingRow
            icon={Users}
            label="New Study Rooms"
            description="When a new room is created"
            checked={settings.roomCreated}
            onToggle={() => toggleSetting("roomCreated")}
            disabled={!settings.enabled}
          />

          <SettingRow
            icon={BookOpen}
            label="New Tests"
            description="When a new test is added"
            checked={settings.testAdded}
            onToggle={() => toggleSetting("testAdded")}
            disabled={!settings.enabled}
          />

          <SettingRow
            icon={Timer}
            label="Timer Complete"
            description="When your timer finishes"
            checked={settings.timerComplete}
            onToggle={() => toggleSetting("timerComplete")}
            disabled={!settings.enabled}
          />

          <SettingRow
            icon={AtSign}
            label="@Mentions"
            description="When someone mentions you"
            checked={settings.mentions}
            onToggle={() => toggleSetting("mentions")}
            disabled={!settings.enabled}
          />
        </div>

        {/* Sound Settings */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Sound</p>

          <SettingRow
            icon={Volume2}
            label="Notification Sound"
            description="Play sound with notifications"
            checked={settings.soundEnabled}
            onToggle={() => toggleSetting("soundEnabled")}
            disabled={!settings.enabled}
          />
        </div>

        {/* Theme Toggle */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Vibe</p>

          <div
            className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary/70 transition-colors"
            onClick={toggleTheme}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg transition-colors",
                isLofi ? "bg-amber-500/20 text-amber-500" : "bg-primary/20 text-primary"
              )}>
                {mounted ? (
                  isLofi ? <Coffee className="w-4 h-4" /> : <Moon className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </div>
              <div>
                <p className="text-sm text-foreground">
                  {mounted ? (isLofi ? "Lofi Mode" : "Dark Mode") : "Dark Mode"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {mounted ? (isLofi ? "Cozy study vibes" : "Easy on the eyes") : "Easy on the eyes"}
                </p>
              </div>
            </div>
            <Switch
              checked={isLofi}
              onCheckedChange={() => toggleTheme()}
            />
          </div>
        </div>

        {/* Version Info */}
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            PrepSPSC v1.0.0 • Made with love for Sikkim aspirants
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}

interface SettingRowProps {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  highlight?: boolean;
}

function SettingRow({
  icon: Icon,
  label,
  description,
  checked,
  onToggle,
  disabled = false,
  highlight = false,
}: SettingRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-xl transition-all",
        highlight ? "bg-primary/10 border border-primary/20" : "bg-secondary/50",
        disabled && "opacity-50"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "p-2 rounded-lg transition-colors",
            checked ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <Label
            className={cn(
              "text-sm cursor-pointer",
              disabled ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {label}
          </Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onToggle}
        disabled={disabled}
      />
    </div>
  );
}
