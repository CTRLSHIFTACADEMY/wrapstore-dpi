import { createClient } from '@supabase/supabase-js'
import { mockSupabase } from './mockSupabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder')
)

export const isDemoMode = !supabaseConfigured

if (isDemoMode) {
  console.info(
    '%c[WrapStore DEMO MODE] Running with mock data. Add .env to connect Supabase.',
    'background:#111827;color:white;padding:4px 8px;border-radius:4px;font-weight:bold'
  )
}

// Auto-switches: real Supabase when .env is set, mock data for demo/testing
export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : mockSupabase

export default supabase
