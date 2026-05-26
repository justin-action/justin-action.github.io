# Justin Eitoku-Wong — Personal Website

## Project overview
A two-page static portfolio site. Plain HTML/CSS/JS, no build tools, no frameworks.
Preview server: `npx live-server --port=3456 --no-browser .` (configured in `.claude/launch.json`)
Preview URL: http://localhost:3456

## Pages
- `index.html` — Casting director facing: hero, reels, headshots, bio, contact
- `resources.html` — Instagram audience facing: guides, resources, Instagram posts

## Design system
- Dark cinematic aesthetic: `--bg: #0d0d0d`, `--accent: #c8102e` (red)
- Fonts: Bebas Neue (display) + Inter (body) via Google Fonts
- Max content width: 1160px

## index.html sections (in order)
1. Fixed nav — Acting & Stunt (active) | Action Resources | Contact | Resume pill
2. Hero — split-screen: text left, `Justin_Eitoku-Wong_feature.jpg` right
3. Reels — Acting reel + Stunt reel side by side (YouTube embeds)
4. Headshots — 3×2 grid, click to open lightbox, hover for download icon
5. Bio — short paragraph + "View Full Resume" link
6. Contact — email + Instagram / Backstage / Resume links
7. Footer

## resources.html sections (in order)
1. Fixed nav — Acting & Stunt | Action Resources (active) | Contact | Resume pill
2. Hero — "Answer the Call." heading + subtitle
3. Guides — doc-icon cards (first one links to Google Doc)
4. Resources — 2×2 grid, Free (green) + DM on Instagram (orange) tiers
5. Instagram — 5 portrait cards with cover images + titles + play icons
6. Footer

## Images
- `images/headshots/` — 9 headshot photos
- `images/instagram/` — 5 Instagram reel cover thumbnails (PNG)

## Headshot order (index.html)
1. Justin_Eitoku-Wong_feature.jpg (hero + slot 1)
2. Justin_Eitoku-Wong_grey_smile.jpg
3. Justin_Eitoku-Wong_chess_neutral.jpeg
4. Justin_Eitoku-Wong_blue_smiling.jpg
5. Justin_Eitoku-Wong_Martial_art.jpg
6. Justin_Eitoku-Wong_full.png

## Key decisions made
- No em dashes anywhere (user preference — sounds too AI)
- "Resume" not "Résumé" (no accents)
- Eyebrow: "Actor · Stunt Performer · Creator"
- Lightbox on headshot click; download only via hover ↓ icon
- Instagram cards: portrait 9:16 ratio with gradient overlay + title
- DM tier resources: followers DM a codeword, Justin replies with the link
- Instagram DM link: https://ig.me/m/justinwong

## Real links wired up
- Acting reel: https://www.youtube.com/watch?v=IpBlxTBztwg
- Stunt reel: https://www.youtube.com/watch?v=z_TpYWteL7M
- Resume: https://docs.google.com/document/d/1zSSFpt59khDpl0Y_AWTvvxLFbmAReRpw/edit
- Backstage: https://www.backstage.com/u/justin-eitoku-wong
- Instagram: https://www.instagram.com/justinwong/
- Guide 1 (Framework for micro action scenes): https://docs.google.com/document/d/13PjMFG7q1Egii6IGa2Bx_5WFpqiXVz60ozKpOjSRUJo/edit
- Resource (Filmmaking and action kit): https://docs.google.com/document/d/1H8myfVEZTmibLj77ITcVKrP7EbTSzqM369Yy4mDvJOM/edit
