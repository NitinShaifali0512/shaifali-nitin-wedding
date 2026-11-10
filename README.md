# Nitin & Shaifali: Wedding Invitation Website

A digital wedding invitation for **Nitin Kaushik** and **Shaifali Singh**, made to be shared on WhatsApp and opened on a phone. It comes with a private dashboard at `/admin`, where every word, date, address, photograph and the music can be changed without touching code.

- **Sagai:** Saturday, 21 November 2026, The Grand Paris Banquets
- **Sangeet:** Thursday, 3 December 2026, The Grand Paris Banquets
- **Wedding:** Saturday, 5 December 2026, Golden Moments Banquet

---

## Contents

1. [What you get](#1-what-you-get)
2. [Putting the website online](#2-putting-the-website-online) (about 30 minutes, no coding)
3. [Using the dashboard](#3-using-the-dashboard)
4. [Things worth knowing](#4-things-worth-knowing)
5. [If something does not work](#5-if-something-does-not-work)
6. [For developers](#6-for-developers)
7. [Credits and licences](#7-credits-and-licences)

---

## 1. What you get

**For guests**

| Part | What it does |
|---|---|
| Opening invitation | A gatefold cover in the wine and cream of your printed card, with Ganesh Ji, your monogram seal and an "Open Invitation" button. The doors swing open and the music begins. |
| Welcome | Your photograph in the arch from the card, a welcome note, the date and a live countdown to the wedding. |
| Events | Sagai, Sangeet and Wedding, each with its own look. Every event has its schedule, venue, full address, "Get Directions", "Add to Google Calendar" and a downloadable calendar file. |
| Gallery | A scrapbook of your photographs with polaroid, gold, taped and hand-drawn frames, and full-screen viewing with swipe. |
| RSVP | Name, mobile number, number of guests, events attending and an optional message. Guests can also say that they cannot come. |
| Footer | Your thank-you note, the RSVP phone numbers (tap to call or WhatsApp) and a "Share on WhatsApp" button. |
| Music | A soft saxophone instrumental with an on/off button, mute and a volume slider. |

**For the two of you**

A dashboard at `/admin` with sign-in, where you can edit everything above, add or remove events and sections, upload photographs and music, preview the result, publish it, and read, search and download the RSVP responses.

---

## 2. Putting the website online

You need two free accounts. **Supabase** stores your content, photographs, music and RSVPs. **Vercel** (or Netlify) serves the website to guests. You do not need to install anything on your computer.

> If you would rather not do this yourself, any developer can complete it in a few minutes from these steps. Nothing in the code needs to change.

### Step 1. Create the database (Supabase)

1. Go to **supabase.com**, sign up, and click **New project**.
2. Give it a name such as `shaifali-nitin-wedding`.
3. Choose a strong **database password** and keep it somewhere safe. The website never uses this password, but you may need it one day.
4. For **Region**, choose **South Asia (Mumbai)**, so that the website is quick for guests in India.
5. Click **Create new project** and wait about two minutes.

### Step 2. Set up the tables and security rules

1. In your Supabase project, open **SQL Editor** in the left menu and click **New query**.
2. Open the file [`supabase/schema.sql`](supabase/schema.sql) from this project, copy everything in it, and paste it into the editor.
3. Click **Run**. You should see "Success. No rows returned".

This creates the tables, the storage bucket for photographs and music, and all the security rules. It is safe to run again later.

### Step 3. Create your sign-in

1. In Supabase, open **Authentication**, then **Users**, and click **Add user**, then **Create new user**.
2. Enter your email address and a password, tick **Auto Confirm User**, and click **Create user**.
3. Go back to **SQL Editor**, start a **New query**, paste the line below with your own email address, and click **Run**:

   ```sql
   select public.grant_admin('you@example.com');
   ```

To give your partner a separate sign-in, repeat this step with their email address.

### Step 4. Two recommended safety settings

1. Open **Authentication**, then **Sign In / Providers** (in some versions this is under **Settings**), and switch off **Allow new users to sign up**. The website is already protected without this, because only accounts you approved in Step 3 can use the dashboard, but there is no reason to let strangers create accounts.
2. Open **Authentication**, then **URL Configuration**. Once you know your website address (after Step 6), enter it as the **Site URL**. This is what makes the "Forgot your password?" email link work.

### Step 5. Copy two values from Supabase

Click **Connect** at the top of your project page, or open **Project Settings**, then **API Keys**. You need:

| Value | What it looks like |
|---|---|
| **Project URL** | `https://abcdefghijklmnop.supabase.co` |
| **Publishable key** | starts with `sb_publishable_` |

> **Important.** Copy the **publishable** key only. Never use a key labelled **secret** or **service_role** in this website. If you paste a secret key by mistake, the dashboard refuses to start and tells you so. (Older Supabase projects show an "anon public" key instead of a publishable key. That one is fine too; see the note in `.env.example`.)

### Step 6. Put the website online (Vercel)

1. Create a free account at **github.com**. Click **New repository**, name it `wedding`, choose **Private**, and click **Create repository**.
2. On the new repository page, click **uploading an existing file**, drag in **all the files and folders of this project**, and click **Commit changes**. (If your computer shows a `node_modules` or `dist` folder, leave those out.)
3. Go to **vercel.com**, sign up with your GitHub account, click **Add New**, then **Project**, and **Import** the `wedding` repository.
4. Open **Environment Variables** and add these two:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | the Project URL from Step 5 |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | the publishable key from Step 5 |

5. Click **Deploy**. After about a minute Vercel shows your website address, for example `https://wedding-abc123.vercel.app`.

**Netlify works the same way:** choose **Add new project**, then **Import an existing project**, pick the repository, add the same two environment variables, and deploy. The file `netlify.toml` already contains the right settings.

**GitHub Pages works too, with no Vercel or Netlify account.** The project already contains the workflow for it in `.github/workflows/deploy-github-pages.yml`.

1. Upload the project to a GitHub repository as in points 1 and 2 above, and make sure the folder named `.github` is uploaded as well. On a free GitHub account the repository has to be **Public** for GitHub Pages to work.
2. In the repository, open **Settings**, then **Pages**, and under **Build and deployment** set **Source** to **GitHub Actions**.
3. Open the **Actions** tab, choose **Deploy to GitHub Pages**, and click **Run workflow**. After about two minutes your website is live at `https://your-username.github.io/your-repository-name/`.
4. To switch on RSVP saving and the dashboard, open **Settings**, then **Secrets and variables**, then **Actions**, then the **Variables** tab, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` with the values from Step 5, and run the workflow again.

**Your own web address (optional).** A name such as `shaifaliwedsnitin.in` costs a few hundred rupees a year and looks much nicer in WhatsApp. Buy it from any registrar, add it under **Domains** in Vercel, and then add one more environment variable, `VITE_SITE_URL`, with the full address (for example `https://shaifaliwedsnitin.in`), and redeploy.

### Step 7. Publish from the dashboard

1. Open `https://your-website-address/admin` and sign in with the email and password from Step 3.
2. Look through the pages, change anything you like, and press **Publish**.

Until you press Publish for the first time, guests see the content that ships with the website, which is the same content you see in the dashboard on day one.

### Step 8. Check the WhatsApp preview

Send the link to yourself on WhatsApp. You should see the invitation thumbnail, the title and the description. If WhatsApp shows an old or empty preview, see [Things worth knowing](#4-things-worth-knowing).

### What you still need to provide

| Item | Why | Where it goes |
|---|---|---|
| A Supabase account and project | Stores content, photographs, music and RSVPs | Steps 1 to 5 |
| A Vercel or Netlify account | Serves the website | Step 6 |
| Your email address and a password | Your dashboard sign-in | Step 3 |
| Original, full-size photographs | The printed card only held small copies | Upload in the dashboard under Gallery and Welcome |
| Optional: your own domain name | A nicer link for WhatsApp | Step 6 |
| Optional: your own music track | If you prefer a specific song you have permission to use | Dashboard, Music |

---

## 3. Using the dashboard

Open `/admin` on your website and sign in. It works on a phone as well as on a computer.

**The three buttons at the top**

| Button | What it does |
|---|---|
| **Preview** | Shows your draft exactly as guests would see it, including changes you have not saved yet. Only you can see it. |
| **Save Changes** | Stores your work as a private draft. Guests see nothing new yet. |
| **Publish** / **Update Website** | Makes the draft live. Guests see it within seconds. No technical step is needed. |

The coloured label beside them tells you where you stand: **Unsaved changes**, **Saved, not yet published**, or **Published**. If you try to close the page with unsaved changes, the browser asks you first.

**The pages**

| Page | What you can change |
|---|---|
| Names and Opening | Your names, parents' names (optional), monogram, the Ganesh symbol, invocation, heading, message and button of the first screen |
| Welcome and Countdown | Your photograph, welcome note, date and place, and the countdown (on or off, and the moment it counts down to) |
| Events | Add, edit, reorder, hide or delete events. Each has a name, date, schedule, venue, address, Google Maps link, dress code, a look, and whether it appears in the RSVP form |
| Gallery | Add several photographs at once, replace, caption, choose a frame, reorder or remove |
| RSVP Form | Open or close RSVPs, the largest party size, and all the wording |
| Music | Switch music on or off, upload an MP3, paste a link to an audio file, set the starting volume |
| Footer and Contact | Thank-you note, phone numbers, optional social links, share button |
| Page Sections | Show, hide, reorder and rename sections in the menu, and add your own sections (for example travel tips) |
| Sharing | The WhatsApp message, and the title, description and thumbnail of the link preview |
| RSVP Responses | Everyone who replied, with totals per event, search, filters, and download as CSV or Excel |
| Settings | Change your password, bring back an earlier published version, clear out unused uploads |

**A few tips**

- Dates are entered with a date picker, and the day of the week is worked out for you, so "Thursday, 3 December 2026" can never be mistyped.
- When an event has no timings, guests see the note "Timing to be announced" and nothing is invented. As soon as you add a timing, the note disappears.
- All dates and times are India Standard Time for every guest, wherever they are.
- If you and your partner edit at the same moment, the dashboard notices and asks which version to keep.
- Every time you publish, a copy is kept. Under **Settings** you can load any of the last 30 versions back into the editor.

---

## 4. Things worth knowing

**The link preview refreshes when the website is redeployed.** WhatsApp reads the title, description and thumbnail from the page itself and does not run the website's code. So this is the one thing that does not update the instant you press Publish. After changing it under **Sharing**, open your project in Vercel, go to **Deployments**, open the menu on the latest one and choose **Redeploy**. Everything else on the website updates instantly.

**WhatsApp remembers previews.** Once WhatsApp has shown a preview for a link, it keeps that preview for a long time. Settle your title and thumbnail before you send the invitation out. If you must refresh it, add `?v=2` to the end of the link you share.

**Music cannot start by itself.** Every browser blocks websites from playing sound until the visitor taps something. That is why the invitation opens with a button. If a phone is on silent, the music follows the phone.

**On iPhones the volume slider is replaced by a short note,** because Apple does not let websites change the volume. Guests use the buttons on the phone. The on/off and mute buttons work everywhere.

**The photographs in the gallery came from your PDF card,** which only contained small copies (about 300 to 500 pixels wide). They were enlarged carefully, without altering faces, and look good at the sizes used. For the sharpest result, upload your original photographs through the dashboard. Large photographs are resized automatically to keep the site fast.

**The website is hidden from Google.** It asks search engines not to list it, because it shows venue details and phone numbers. Anyone with the link can still open it, so share the link only with people you are inviting.

**Free plan limits are generous for a wedding.** Two points to remember about Supabase's free plan: a project that receives no visits at all for a week is paused, and you restore it with one click in Supabase. Guests' visits count as activity, so this will not happen while the invitation is in use. And if the database is ever unreachable, the invitation still opens with the content that ships with the website, so guests never see an error page.

**Keeping the built-in content in step.** The website carries a built-in copy of the starting content as a safety net. If you change something important, such as a venue, long before the wedding, it is worth asking a developer to update `src/content/defaults.ts` too, so the safety net matches. This is optional.

---

## 5. If something does not work

| What you see | What to do |
|---|---|
| The dashboard says it is "not connected to a database yet" | The two environment variables from Step 6 are missing or misspelt. Add them in Vercel and redeploy. |
| "The database has not been set up yet" | Run `supabase/schema.sql` in the Supabase SQL Editor (Step 2). |
| "This account is not an administrator" | Run the `grant_admin` line from Step 3 with the email you signed in with. |
| "The email address or password is not correct" | In Supabase, open Authentication, Users, find your user, and choose **Send password recovery** or set a new password. |
| A photograph will not upload | Use a JPG or PNG. Files over 25 MB are refused. |
| Music does not play for guests | Open **Music** in the dashboard and press play on the small player there. If it does not play there either, the file or link is the problem; upload an MP3 instead. |
| The WhatsApp preview is empty or old | See the two notes about the link preview in section 4. |
| A guest says RSVP is closed | Open **RSVP Form**, switch on **Accept RSVPs**, and press **Update Website**. |

---

## 6. For developers

### Stack

| Layer | Choice | Why |
|---|---|---|
| Interface | React 18, TypeScript, Vite | Small, fast, widely understood |
| Styling | Tailwind CSS 3.4 and one stylesheet | Version 3 is used on purpose: it supports older phones that version 4 leaves behind |
| Icons | Lucide | |
| Backend | Supabase: Postgres, Auth, Storage | Sign-in, Row Level Security and file storage without a server to run |
| Animation | CSS only | No animation library, so the guest bundle stays light on modest phones |
| Fonts | Cinzel Decorative, Cormorant Garamond, Montserrat, and a small Devanagari subset, all self-hosted | The same faces as the printed card; no third-party font requests |

Guests download about 90 KB of compressed JavaScript. The dashboard and the Supabase library are in a separate file that is only fetched at `/admin`.

### Run it locally

```bash
npm install
npm run dev            # http://127.0.0.1:5173
```

Without any settings the site runs in **preview mode**: it shows the built-in content, and the RSVP form says that responses are not being saved.

To work on the dashboard without a Supabase project, start the local test backend in a second terminal:

```bash
npm run backend        # prints two lines to put in .env.local, and a test sign-in
npm run dev
```

To work against your real project, copy `.env.example` to `.env.local` and fill in the values.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build into `dist/` |
| `npm run build:preview` | A single self-contained page in `dist-preview/` for showing the guest experience where there is no server. It leaves out the dashboard, the calendar-file download and the share buttons, and says so in its footer |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (dates, calendar files, content repair, exports) |
| `npm run test:security` | Loads `supabase/schema.sql` into a real PostgreSQL and tests the security rules as a guest, a stranger with an account, and an administrator |
| `npm run test:e2e` | Drives the whole website and dashboard in a real browser (needs Playwright; see the top of `tests/e2e/run.cjs`) |

### How it fits together

```
index.html                 link-preview tags are written in at build time (vite.config.ts)
src/
  content/                 the content model: types, built-in defaults, repair of saved documents
  lib/                     dates (IST), calendar links and .ics, maps, the small public API client
  hooks/                   published content, music, countdown, scroll reveal
  site/                    the guest website: Cover, Welcome, Events, Gallery, Rsvp, Footer, Nav, MusicControl
  art/                     line art and the arch outline taken from the printed card
  admin/                   the dashboard (loaded only at /admin)
supabase/schema.sql        tables, functions, storage bucket and every security policy
tests/unit                 Vitest
tests/backend              local stand-in for Supabase (real PostgreSQL via PGlite) and the security tests
tests/e2e                  browser test of the complete product
tools/music                the script that composed and rendered the built-in instrumental
```

**Content.** The whole website is one JSON document (`SiteContent` in `src/content/types.ts`). The table `site_content` holds two rows: `draft` and `published`. "Save Changes" writes the draft with a revision check; "Publish" calls the database function `publish_site`, which copies the draft to the published row and keeps a copy in `site_versions`. Guests read the published row with a single request, keep a copy on their device for instant repeat visits, and refresh it when they return to the tab. `normalizeContent` repairs anything missing or malformed, so an old or hand-edited document can never break the page.

**Dates.** Every date and time is stored as India Standard Time text (`2026-12-05`, `10:00`) and converted to an exact instant only for the countdown and for calendar entries. A guest abroad sees the same Indian date and time as a guest in Ghaziabad.

### Security model

The browser only ever holds the public key. Everything is decided by Row Level Security in the database.

| Who | Website content | RSVPs | Files |
|---|---|---|---|
| Guest (not signed in) | Read the published copy only | Add one response; cannot read, change or delete any | View public files; cannot upload, list or delete |
| Signed-in account that is **not** in `admins` | Same as a guest | Same as a guest | Same as a guest |
| Administrator | Read and write the draft, publish, read history | Read, delete, add a private note | Upload, list, replace, delete |

Further safeguards: the database itself validates every RSVP (name, mobile number, party size, the open/closed switch and the party-size limit from the dashboard), fixes the timestamp, and limits floods; uploads are restricted to pictures and audio of at most 25 MB; links typed into the dashboard are only rendered when they are ordinary `http` or `https` links; the built site carries a Content Security Policy; and exported spreadsheets neutralise cells that look like formulas.

### Tests that were run for this delivery

| Suite | Result |
|---|---|
| Unit tests | 51 of 51 passed |
| Database security tests | 39 of 39 passed |
| Browser tests of the whole product | 98 of 98 passed |

The browser tests ran against the local stand-in for Supabase in `tests/backend`. It executes every request against a real PostgreSQL database loaded with `supabase/schema.sql`, under the same `anon` and `authenticated` roles Supabase uses, so the security rules were genuinely enforced. It is still a stand-in: the first sign-in and upload on your real Supabase project are the final confirmation.

---

## 7. Credits and licences

- **Photographs and card artwork** (peonies, lattice, lotus border, mandala, monogram, Ganesh drawings, doodles and the two cats) were taken from your own Canva invitation, `BOTH SUU.pdf`, for use on your own wedding website. Canva's content licence applies to the illustrations.
- **Music.** "Saxophone Serenade" is an original piece written for this website; the notes and arrangement are in `tools/music/compose.py`. It was rendered with instrument samples from the GeneralUser GS SoundFont by S. Christian Collins, whose licence permits use in any music, private or commercial.
- **Fonts.** Cinzel Decorative, Cormorant Garamond, Montserrat and Tiro Devanagari Sanskrit, all under the SIL Open Font License 1.1.
- **Icons.** Lucide, ISC licence.
- **Photograph enlargement** used the open EDSR super-resolution model, which sharpens without inventing detail.
