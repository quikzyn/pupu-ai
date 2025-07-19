import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { cookies } from "next/headers"

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)

    // Test authentication first
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { status: "error", message: `Authentication failed: ${authError?.message || "No user session"}` },
        { status: 401 },
      )
    }

    // Attempt a simple query to verify connection and RLS (if applied)
    // You might need to create a dummy table in your Supabase project, e.g., 'test_table'
    // CREATE TABLE test_table (id SERIAL PRIMARY KEY, name TEXT);
    const { data, error } = await supabase.from("test_table").select("id").limit(1)

    if (error) {
      console.error("Supabase test query error:", error)
      return NextResponse.json({ status: "error", message: `Supabase query failed: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ status: "success", message: `Supabase connection successful for user: ${user.email}` })
  } catch (e: any) {
    console.error("Supabase test exception:", e)
    return NextResponse.json({ status: "error", message: `Supabase connection failed: ${e.message}` }, { status: 500 })
  }
}
