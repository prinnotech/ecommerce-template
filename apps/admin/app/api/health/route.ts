import { NextResponse } from "next/server";

// For the host's health check (Railway, uptime monitors): the app is up and serving requests.
export function GET() {
  return NextResponse.json({ ok: true });
}
