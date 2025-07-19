import { createClientComponentClient, createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import type { cookies } from "next/headers"

// Client-side Supabase client (for browser use in client components)
export const createClient = () => createClientComponentClient()

// Server-side Supabase client (for server components, route handlers, server actions)
export const createServerClient = (cookieStore: ReturnType<typeof cookies>) =>
  createServerComponentClient({ cookies: () => cookieStore })

// IMPORTANT: Ensure your Supabase URL and Anon Key are set as NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
// in your .env.local file and Vercel project settings.
// For server-side, also ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.
