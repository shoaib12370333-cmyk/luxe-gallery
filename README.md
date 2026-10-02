# Luxe Gallery — Website + Admin Panel

A sculptural wall-art showcase website with a built-in admin panel to add/edit/delete gallery pieces and testimonials — no code editing needed after setup.

## What's inside
- **Public website** (`/`) — Hero, Gallery, About, Reviews, Contact (WhatsApp button)
- **Product detail view** — click any gallery piece to see its full price, description, and (optional) size/dimension options, plus a WhatsApp button pre-filled with the piece's details
- **Customer reviews** — visitors can submit their own review (name, star rating, and text) from the site; it only appears once you approve it from the admin panel
- **Announcement bar** — an optional scrolling bar at the very top of the site, fully controlled from the admin panel
- **Social links** — WhatsApp, Facebook, and Instagram icons in the header and footer, controlled from the admin panel
- **Admin panel** (`/admin`) — login-protected dashboard to manage everything, including the hero and about-section images
- **Backend** — Node.js + Express + SQLite (all data stored in one local file, no external database needed)
- **Mobile-friendly** — the layout adapts down to phone screens

## Handling customer reviews
1. A visitor scrolls to the Reviews section and fills in the "Share your review" form (name, star rating, review text)
2. Their submission is saved but does **not** appear on the site yet
3. Log into `/admin` — the **Pending reviews** section at the top shows anything awaiting your decision
4. Click **Approve** to publish it immediately, or **Reject** to discard it
5. Reviews you add yourself from the **Reviews** section below are published immediately, since you don't need to approve your own entries

## How pricing and sizes work
Each gallery piece has one price and an optional list of dimensions (e.g. `24x36 in, 30x40 in`).
- If you leave the **Dimensions** field empty when adding/editing a piece, no size selector shows on the site — just the price and an enquiry button.
- If you fill it in with a comma-separated list, visitors see it as a set of pill buttons on the product's detail view. Every size shares the same price — dimensions are for reference only, they don't change the price.
- There's no cart or checkout. When someone wants a piece, they tap **"Enquire on WhatsApp"**, which opens WhatsApp with a message pre-filled with the piece's name, selected size (if any), and price — you take it from there.

## How to run it (first time)

1. Make sure [Node.js](https://nodejs.org) is installed on your computer — **version 22.5 or newer** (this project uses Node's built-in SQLite support, so nothing needs to be compiled on your machine — no Python or build tools required).
2. Open a terminal in this folder and run:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open your browser:
   - Website: **http://localhost:3000**
   - Admin panel: **http://localhost:3000/admin**

## Default admin login
- **Username:** `admin`
- **Password:** `luxegallery123`

⚠️ **Change this password immediately** — log in, scroll to "Change password" on the dashboard, and set your own. The default is only meant for first setup.

You can also set your own initial credentials instead of the default ones: before your first deploy, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` as environment variables on your hosting provider (e.g. Railway/Render's "Variables" tab). These are only used the very first time the database is created — changing them later won't affect an admin account that already exists.

## If you can't log into the admin panel
If login fails with "Invalid username or password" and you're sure you're typing it correctly, visit `yourdomain.com/api/admin/status` in your browser. It shows how many admin accounts exist:
- `{"adminAccountCount":1,"usernames":["admin"]}` — an account exists; the password you're typing is simply wrong (or was changed before).
- `{"adminAccountCount":0,"usernames":[]}` — no admin account exists at all (this can happen if the database was reset or wiped by your host). Use the recovery steps below.

### Recovering access when no admin account exists
1. On your hosting provider, add an environment variable called `RESET_ADMIN_KEY` with a long random value only you know (e.g. a password generator's output). Redeploy so the server picks it up.
2. Send a request to reset or create the admin account. From your own computer's terminal (not the server console), run:
   ```
   curl -X POST https://yourdomain.com/api/admin/emergency-reset -H "Content-Type: application/json" -d "{\"key\":\"your-RESET_ADMIN_KEY-value\",\"username\":\"admin\",\"password\":\"your-new-password\"}"
   ```
   Replace the key, username, and password with your own values.
3. You should get back `{"success":true,...}`. Log in at `/admin` with the username and password you just set.
4. Afterward, remove the `RESET_ADMIN_KEY` environment variable (or change it to something else) so this recovery route can't be used by anyone else.

## Changing the hero and about-section images
1. Log into `/admin`
2. Go to **Site images** (the first section)
3. Choose a new file for the hero image, the about image, or both
4. Save — the site updates immediately, no code editing needed

## Setting up your WhatsApp, Facebook, and Instagram links
1. Log into `/admin`
2. Go to **Contact & social links**
3. Enter your WhatsApp number with country code, no `+` or spaces (e.g. `923001234567` for a Pakistani number), plus your Facebook and Instagram page URLs
4. Save — the icons appear in the site's header and footer, and the "Enquire on WhatsApp" buttons use this number

## Setting up the announcement bar
1. Log into `/admin`
2. Go to **Announcement bar**
3. Tick "Show announcement bar", type your message (e.g. "FLAT 20% OFF this week"), and save
4. Untick the box any time to hide it again — the text stays saved for next time

## Adding your gallery pieces
1. Log into `/admin`
2. Under **Gallery pieces**, fill in the title, category, price, and description
3. Optionally add **Dimensions** as a comma-separated list (e.g. `24x36 in, 30x40 in`) — leave it empty if the piece doesn't come in multiple sizes
4. Upload an image (JPG, PNG, or WEBP, up to 8MB)
5. Click **Add piece** — it appears on the live site immediately, and visitors can click it to see the full details and enquire on WhatsApp

The two images currently in `public/img/` (`hero-placeholder.jpg` and `about-placeholder.jpg`) are temporary — replace those files directly with your own hero and about-section photos whenever you're ready (keep the same filenames, or update the paths in `public/index.html`).

## Hosting it online
This is a full Node.js app (not just static files), so it needs hosting that runs Node — for example Railway, Render, or a VPS on Hostinger. Plain static hosts like GitHub Pages won't work since the admin panel needs a live server.

## Project structure
```
luxe-gallery/
├── public/           → the actual website files (HTML/CSS/JS)
│   ├── index.html    → main site
│   ├── admin/        → admin login + dashboard
│   ├── css/, js/, img/
├── server/
│   ├── server.js     → Express server + all API routes
│   └── db.js         → database setup
├── uploads/          → gallery images you upload get stored here
└── package.json
```
