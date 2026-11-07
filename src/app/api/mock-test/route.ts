import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function proxyMockTest(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mock-test`;
  const init: RequestInit = {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    },
  };

  if (request.method !== "GET") {
    init.body = await request.text();
  }

  const response = await fetch(functionUrl, init);
  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
    },
  });
}

export async function GET(request: Request) {
  return proxyMockTest(request);
}

export async function POST(request: Request) {
  return proxyMockTest(request);
}
