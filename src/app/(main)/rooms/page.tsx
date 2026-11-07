"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { RoomsClient } from "./rooms-client";
import { createClient } from "@/lib/supabase/client";
import type { Room } from "@/types/database.types";

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    let isCancelled = false;

    const fetchRooms = async () => {
      setIsLoading(true);
      const supabase = createClient();

      try {
        const { data, error } = await supabase
          .from("rooms")
          .select("*")
          .eq("is_active", true)
          .neq("privacy_level", "private")
          .order("sort_order", { ascending: true });

        if (isCancelled) return;

        if (error) {
          // Ignore AbortError from React StrictMode
          if (error.message?.includes("aborted") || error.message?.includes("AbortError")) {
            return;
          }
          console.error("Failed to fetch rooms:", error.message);
          setRooms([]);
        } else {
          setRooms(data || []);
        }
      } catch (err: any) {
        if (isCancelled) return;
        // Ignore AbortError from React StrictMode
        if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
          return;
        }
        console.error("Error fetching rooms:", err);
        setRooms([]);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchRooms();

    return () => {
      isCancelled = true;
    };
  }, [pathname]); // Re-fetch when navigating back to this page

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return <RoomsClient rooms={rooms} />;
}
