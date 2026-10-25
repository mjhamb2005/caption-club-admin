# Backstage — Caption Club admin

Staff-only admin area for Caption Club. Same Supabase database and Google sign-in as the main app.

- **Tonight's numbers**: votes over the last 14 days, when the crowd votes (day × hour), whether the AI's first caption idea wins, whether short captions score better, headliners, the most divisive captions, and the most active meme makers.
- **Memes**: create (upload a photo → the AI writes a description and five captions → edit → save), read, update and delete every AI-generated meme.
- **Users**: read every user/profile with their activity.
- **Votes**: read every upvote and downvote.
- **Pipeline health**: success rate, typical and p95 time per meme, where requests fail, how long each AI step takes, which model answered, latest failures.
- **Prompt chain**: read chains and their steps (prompts, models, settings); read/update the mix (each chain's weight and caption count); create/read/update/delete terms and AI generation examples, which are fed into the caption prompt.
- **Models**: create/read/update/delete LLM providers and LLM models. Steps fall back to a backup model, then to built-in prompts, so a bad edit never breaks meme making.
- **Logs**: read every generation request (one per meme attempt) and every LLM response (one per AI call: prompt, response, model, latency, tokens, errors).
- **Sign-up access**: create/read/update/delete allowed sign-up domains and whitelisted emails. A database trigger checks them whenever a new account is created.

## Who gets in
Every route is behind Google sign-in, and every page and API route also requires `profiles.is_superadmin = TRUE`. Signed-in users without the flag see a "staff only" page. The database enforces the same rule (row-level security), so the data stays protected even if someone calls Supabase directly.

## How to avoid locking yourself out
The flag can't be changed from inside any app: a trigger rejects changes to `is_superadmin` unless they come from the database owner. The Supabase **SQL Editor** runs as the database owner and bypasses row-level security, so the first superadmin is granted there (`supabase/admin-setup.sql`, step 2). Any additional admin is added the same way.

## Setup
1. Run `supabase/admin-setup.sql`, then `supabase/week7-setup.sql`, in the Supabase SQL Editor.
2. Vercel environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `GEMINI_API_KEY` (same values as Caption Club). Optional: `NEXT_PUBLIC_CAPTION_CLUB_URL` for the "Open Caption Club" link.
3. Add the deployment URL to the Google OAuth client (JavaScript origin, and the URL + `/auth/callback` as a redirect URI).
4. Turn off Vercel Deployment Protection.
