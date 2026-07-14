# Supabase setup

1. Create a Supabase project.
2. Copy Project URL, anon key, and service role key into `.env.local`.
3. Run the SQL migration in `supabase/migrations/`.
4. Confirm Auth email provider settings (confirmations optional for local).
5. Create a private Storage bucket for recordings when enabling recording storage.
6. Never expose the service role key to the browser.
