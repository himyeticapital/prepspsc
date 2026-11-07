import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { HeroWithCards } from "@/components/landing/hero-with-cards";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If logged in, redirect to dashboard
  if (user) {
    redirect("/dashboard");
  }

  return <HeroWithCards />;
}
