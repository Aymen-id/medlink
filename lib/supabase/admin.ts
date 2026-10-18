import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from '@/lib/config/public'
import { getServerConfig } from '@/lib/config/server'

export function createAdminClient() {
  return createSupabaseClient(
    getSupabaseConfig().NEXT_PUBLIC_SUPABASE_URL,
    getServerConfig('admin').SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
