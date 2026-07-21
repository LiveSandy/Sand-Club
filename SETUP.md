# Getting Sand Club Academy onto GitHub + Supabase

This turns the Claude artifact into a real, deployable app with a real
database. Everything on the code side is already done — this guide is
just the account setup and clicking-through part, which only you can do.

Rough order: **GitHub first (so your code has a home), then Supabase
(the database), then a live URL.** About 30–45 minutes if this is your
first time doing any of this.

---

## 0. Before you start

You'll need [Node.js](https://nodejs.org) installed on your computer
(the LTS version). This lets you run the app locally to test it. If
`node -v` in a terminal shows a version number, you already have it.

---

## 1. Put the code on GitHub

1. Go to [github.com](https://github.com) and create a free account if
   you don't have one.
2. Click the **+** in the top right → **New repository**.
   - Name it something like `sand-club-academy-app`.
   - Keep it **Private** (this has real phone numbers and emails in the
     seed data — don't make it public).
   - Don't check "Add a README" — we already have files to upload.
3. On the new repo's page, click **uploading an existing file** and
   drag in every file from this project folder (keep the folder
   structure — `src/`, `supabase/`, etc. should stay as folders).
   - Alternative if you're comfortable with a terminal: `git init`,
     `git add .`, `git commit -m "initial commit"`, then follow GitHub's
     "push an existing repository" instructions on your new repo's page.

That's it — your code now has a permanent home and version history.

---

## 2. Set up Supabase (the database)

1. Go to [supabase.com](https://supabase.com) → **Start your project** →
   sign up (you can use your GitHub account to sign in, which is easiest).
2. Click **New project**.
   - Name it `sand-club-academy` (or anything).
   - Set a database password — save it somewhere, you likely won't need
     it again but it's good to have.
   - Pick the region closest to Arizona.
   - Click **Create new project** and wait ~2 minutes while it spins up.
3. Once it's ready, go to the **SQL Editor** in the left sidebar →
   **New query**.
4. Open `supabase/schema.sql` from this project, copy all of it, paste
   it into the SQL editor, and click **Run**.
   - You should see "Success. No rows returned." That means the table
     was created.
5. Go to **Project Settings** (gear icon, bottom of the left sidebar) →
   **API**. You'll need two things from this page:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (a long string under "Project API keys")

Keep this tab open — you'll paste both of these in the next step.

---

## 3. Connect the app to Supabase

1. In the project folder, find `.env.example`. Make a copy of it named
   exactly `.env` (same folder).
2. Open `.env` and paste in your Project URL and anon key from step 2:
   ```
   VITE_SUPABASE_URL=https://abcdefgh.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...(the long key)
   ```
3. Save the file. **Never upload `.env` to GitHub** — it's already
   listed in `.gitignore` so it won't be, but don't remove it from
   there.

---

## 4. Run it locally to test

In a terminal, inside the project folder:

```bash
npm install
npm run dev
```

This prints a `localhost` URL — open it in your browser.

### Signing in works differently now than in the Claude artifact

There are no more passcodes (1234, 9999, etc.). Instead:

1. Anyone — you, coaches, parents — creates their own account with a
   real email and password, right in the app ("New here? Create an
   account").
2. After signing up, they see a "waiting for approval" screen. They
   can't get into the app yet.
3. **The catch: on a brand new setup, nobody is approved yet — not even
   you.** So the very first time, you need to make yourself the
   Director manually:
   - Sign up in the app with your own email.
   - Go to Supabase → **Table Editor** → `profiles` table.
   - Find your row (matched by your email), and edit it directly:
     set `role` to `admin` and `approved` to `true`.
   - Sign out and back in — you're now the Director for real, and the
     app's own "People" tab works from here on for approving everyone
     else (coaches and parents), so you'll never need to touch the
     Supabase table directly again after this one-time step.
4. Once you're in as Director, go to **Coaches** and add Jasmine and
   Daisy's identity records (name, phone, email) if they're not there
   already. Then have Jasmine and Daisy each sign up in the app
   themselves. They'll show up under **People → Pending sign-ups**,
   where you pick "Coach" and link them to the right coach record.
5. Same idea for parents: they sign up, you see them in **People**,
   pick "Parent," and select which player is their child.

---

## 5. Get a real, shareable URL

The easiest option is **Vercel** (free for this kind of use):

1. Go to [vercel.com](https://vercel.com) → sign up with your GitHub
   account.
2. Click **Add New** → **Project**, and pick your `sand-club-academy-app`
   repo from GitHub.
3. Vercel will auto-detect it's a Vite project. Before clicking Deploy,
   open **Environment Variables** and add the same two values from your
   `.env` file:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy**. In about a minute you'll get a real URL like
   `sand-club-academy-app.vercel.app` that Jasmine, Daisy, and parents
   can actually use.

From now on, any time you push new changes to GitHub, Vercel
automatically rebuilds and updates the live site.

---

## What's different from the Claude artifact now

- **Data is permanent and shared for real** — everyone hitting the same
  URL sees the same live data, synced through Supabase instead of the
  artifact's per-session storage.
- **Login is now real** — actual email/password accounts through
  Supabase Auth, not shared passcodes. Nobody gets in without the
  Director approving them first.
- **One real gap to know about, honestly**: the database rule that lets
  the Director approve people currently just checks "is this person
  signed in," not "is this person specifically the Director." In
  practice that means the *app's own screens* only show approval
  controls to whoever's signed in as Director — but someone who knew
  what they were doing could theoretically call the Supabase API
  directly and approve themselves, bypassing the app entirely. For a
  small club running on trust, this is a reasonable place to start.
  Closing it fully means writing a small Postgres check that verifies
  the *calling* user's own profile already has `role = 'admin'` before
  allowing any profile changes — a well-defined follow-up, just not
  done here. I'm flagging it clearly rather than implying this is
  fully locked down when it isn't.

---

## If something breaks

- **Blank page after deploying**: almost always missing or mistyped
  environment variables. Double check `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` in Vercel's project settings match Supabase
  exactly.
- **Data not saving**: open your browser's dev console (right-click →
  Inspect → Console tab) and look for errors mentioning `app_storage`
  or `supabase` — that'll usually point at whether it's a schema
  problem (re-run `schema.sql`) or a key mismatch.
