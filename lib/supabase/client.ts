import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseConfig } from '@/lib/config/public'

export function createClient() {
  const config = getSupabaseConfig()
  return createBrowserClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
