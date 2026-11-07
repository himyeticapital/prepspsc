"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { PRESET_AVATARS, BUILDER_AVATAR, type AvatarOption } from "@/lib/avatars";
import { isBuilder } from "@/lib/builder";
import { Check, Code2 } from "lucide-react";

interface AvatarSelectorProps {
  currentAvatar: string | null;
  onSelect: (avatarSrc: string) => void;
  username?: string | null;
}

export function AvatarSelector({ currentAvatar, onSelect, username }: AvatarSelectorProps) {
  const handleSelect = (avatar: AvatarOption) => {
    onSelect(avatar.src);
  };

  // Include builder avatar if user is the builder
  const availableAvatars = isBuilder(username)
    ? [...PRESET_AVATARS, BUILDER_AVATAR]
    : PRESET_AVATARS;

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50 text-center">Choose your avatar</p>

      {/* Avatar Grid */}
      <div className="grid grid-cols-5 gap-2">
        {availableAvatars.map((avatar) => {
          const isSelected = currentAvatar === avatar.src;
          const isBuilderAvatar = avatar.id === "builder";

          return (
            <button
              key={avatar.id}
              onClick={() => handleSelect(avatar)}
              className={cn(
                "relative w-12 h-12 rounded-full overflow-hidden transition-all",
                "border-2 hover:scale-110",
                isSelected
                  ? "border-primary ring-2 ring-primary/30 ring-offset-2 ring-offset-zinc-900"
                  : isBuilderAvatar
                  ? "border-cyan-500/50 hover:border-cyan-400"
                  : "border-white/10 hover:border-white/30"
              )}
              title={avatar.label}
              type="button"
            >
              <Image
                src={avatar.src}
                alt={avatar.label}
                fill
                className="object-cover"
              />

              {/* Builder badge indicator */}
              {isBuilderAvatar && !isSelected && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-gradient-to-r from-primary to-cyan-500 rounded-full flex items-center justify-center">
                  <Code2 className="w-2.5 h-2.5 text-white" />
                </div>
              )}

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                  <Check className="w-5 h-5 text-white drop-shadow-lg" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Builder exclusive note */}
      {isBuilder(username) && (
        <p className="text-xs text-cyan-400/70 text-center flex items-center justify-center gap-1">
          <Code2 className="w-3 h-3" />
          Builder avatar is exclusive to you
        </p>
      )}
    </div>
  );
}
