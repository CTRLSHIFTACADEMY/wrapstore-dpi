import { createClient } from '@supabase/supabase-js'
import { mockSupabase } from './mockSupabase'

const rawUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// ----------------------------------------------------------------
// URL GUARD
// Detect the common mistake of pasting the Supabase dashboard URL
// (https://supabase.com/dashboard/project/...) instead of the
// actual project API URL (https://<ref>.supabase.co).
// ----------------------------------------------------------------
const isDashboardUrl = rawUrl.includes('supabase.com/dashboard')

if (isDashboardUrl) {
  console.error(
    '%c[WrapStore] WRONG SUPABASE URL detected in VITE_SUPABASE_URL.\n' +
    'You pasted the dashboard browser URL, not the project API URL.\n' +
    'Correct format: https://<project-ref>.supabase.co\n' +
    'Example: https://otjgivbtqfwqcnqvomlx.supabase.co',
    'background:#7f1d1d;color:#fca5a5;padding:6px 10px;border-radius:4px;font-weight:bold'
  )
}

const supabaseUrl = isDashboardUrl ? '' : rawUrl

// ----------------------------------------------------------------
// SERVICE ROLE KEY GUARD
// Prevent the service-role key from being used in the browser.
// The anon key JWT payload has "role":"anon".
// The service-role key JWT payload has "role":"service_role".
// ----------------------------------------------------------------
if (supabaseAnonKey) {
  try {
    const payload = JSON.parse(atob(supabaseAnonKey.split('.')[1]))
    if (payload?.role === 'service_role') {
      console.error(
        '%c[WrapStore] SECURITY: VITE_SUPABASE_ANON_KEY contains a SERVICE ROLE KEY.\n' +
        'This key bypasses RLS and must NEVER be used in the browser.\n' +
        'Use the public anon key instead.',
        'background:#7f1d1d;color:#fca5a5;padding:6px 10px;border-radius:4px;font-weight:bold'
      )
    }
  } catch {
    // Malformed key — will fail gracefully on first API call
  }
}

// ----------------------------------------------------------------
// CONNECTION STATE
// ----------------------------------------------------------------
export const supabaseConfigured = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder') &&
  !isDashboardUrl
)

export const isDemoMode = !supabaseConfigured

if (isDemoMode) {
  console.info(
    '%c[WrapStore DEMO MODE] Running with mock data. ' +
    (isDashboardUrl
      ? 'Fix VITE_SUPABASE_URL in .env — it must be https://<ref>.supabase.co'
      : 'Add .env to connect Supabase.'),
    'background:#111827;color:white;padding:4px 8px;border-radius:4px;font-weight:bold'
  )
}

// ----------------------------------------------------------------
// CLIENT
// Auto-switches: real Supabase when .env is set, mock for demo/testing
// ----------------------------------------------------------------
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
