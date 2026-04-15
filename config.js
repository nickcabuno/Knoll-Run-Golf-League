/* Public Supabase config — the anon key is safe to expose; RLS
 * policies restrict writes to authenticated sessions only.
 */
window.KR_CONFIG = {
  SUPABASE_URL: 'https://qhkumihsmjwlppdvmyqr.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoa3VtaWhzbWp3bHBwZHZteXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDQ4MzcsImV4cCI6MjA5MTc4MDgzN30.hbebbm7I5Y_jMoS88r1cn5nN9mJ5IJY6ExR_P1pGFA0',
  // Shared admin account — create this user in Supabase Auth.
  // Its password is the league's shared passcode.
  ADMIN_EMAIL: 'admin@knollrun.golf'
};
