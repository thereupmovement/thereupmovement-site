# Maintaining the ReUp app

For whoever keeps thereupmovement.org, the volunteer page and the Team Hub running. You do not need
to be a developer for most of this. The plain-language, step-by-step version with links to every sheet
and folder is the **ReUp Hub - Fix-It Guide** Google Doc in the ReUp app folder in Drive; ask the
coordinator for access. This file is the technical companion to it.

**This is a living document.** The app is still being built. Every change to the app updates this
file, the Fix-It Guide, the ReUp Hub Admin Guide and the ReUp App Build-Out Plan in the same pass.

## How the app fits together

Three doors, three parts.

| Door | Address | Who |
|---|---|---|
| Community page | `/` (index.html) | The public |
| Volunteer page | `/volunteer/` | Each volunteer (email and password, or the link in their confirmation email) |
| Team Hub | `/hub/` | The team (personal link or email and password, plus a 4-number PIN per phone) |

| Part | Where | What it does |
|---|---|---|
| Pages | This repository, published by GitHub Pages to thereupmovement.org (see `CNAME`) | Everything people see |
| Server | Google Apps Script project "ReUp Hub" | Reads and writes the Sheets, sends email. The pages call it with `fetch` POST `{fn, args}`; `doPost` in Code.gs runs only functions listed on `API_` |
| Data | Google Sheets "ReUp Hub - Access and Data" and "ReUp — Volunteer Sign-Up (Events and Roster)", Drive folder "ReUp Hub uploads" | All records. There is no other database (a move to one is planned for January 2027) |

## This repository

- `index.html`: the community page. Shop items and photos are written in this file. Its dates come from the
  Hub Schedule and its Houston numbers from the Hub server (`?public=1`), so neither is edited here.
- `hub/index.html`: the Team Hub. One file. The app itself is inside `<script type="text/plain" id="app">`
  and runs only after the loader at the bottom of the file has checked the person's link and PIN.
- `hub/version.json` and `var BUILD` in `hub/index.html`: the Hub's build number (see below).
- `hub/sw.js`: keeps the Hub working with a weak signal. It never stores server responses.
- `volunteer/index.html`, `volunteer/reset.html`, `hub/reset.html`: the volunteer page and the two
  password set/reset pages.
- `assets/`: images. `plan-img/`: sample-data screenshots only.
- `.github/check-pages.js`: the automatic check (below).

Nothing in this repository is private. It is public on GitHub. **Never put a password, key, token,
email address, phone number, home address or any community guest's or volunteer's details here.**
All team data comes from the server, only to people signed in.

## Publishing a change

**Pages:** commit to `main`. GitHub Pages publishes about a minute later.

- Hub change: raise the build number in **both** `hub/version.json` and `var BUILD = "..."` in
  `hub/index.html`, to the same value (date and time, `YYYYMMDDHHMMSS`). Phones with the Hub already
  open check `version.json` every minute and reload when it changes. Without this, an open Hub keeps
  running the old version.
- Check in a real browser at phone width (390px) and desktop width (1280px), with no sideways
  scrolling. Every screen must work on both.

**Server:** edit in the Apps Script editor and save. **Saving does not publish.** Deploy, Manage
deployments, pencil icon, Version: New version, Deploy. Never "New deployment": that makes a new web
address, and the pages keep calling the old one (the address is the `API` constant near the top of each
page's script).

New server functions the pages call must be added to `API_` (see the end of Portal.gs or volunteer.gs
for the pattern). Portal.gs wraps every `API_` function that exists when it loads with the Hub PIN
check, except names in `TP_OPEN` (the public ones: volunteer page, sign-in). Files that load after
Portal.gs are not wrapped, so a Hub function added there must check the PIN itself, and a public one
should be added to `TP_OPEN` too (volunteer.gs does this).

The PIN check reads the **first argument as the person's key**, so every Hub call sends `KEY` first
(`run("fn", KEY, ...)`). If the server function itself doesn't need the key, its `API_` entry takes it and
drops it (see the `ci...` check-in entries in Code.gs). Never send someone's key to the page in a list:
the check-in roster uses row numbers for this reason.

**A new field on `boot`** (what the server tells the Hub about the person) must also be added to the
`window.BOOT = {...}` line in the loader at the bottom of `hub/index.html`. The loader copies only the
fields listed there, so anything else never reaches the app.

**Uploaded files** go to the "ReUp Hub uploads" folder and are shared, as viewers, with the task's
owners and helpers and the uploader (Leaders, for Goals), by the email on their Access row
(`shareUpload_` in Code.gs). `shareOldUploads` re-runs that for every file already on the Files tab.

**The numbers (households, people, goods, distributions):** nobody types them in. `liveStats_` in
Code.gs works them out from the records and caches them for 5 minutes; Hub Home (`liveImpact_`), the
Leadership tab (`liveLeaders_`, including the sentences under each goal) and the website
(`publicTotals_`, via `?public=1`) all read it. Sources:

- Households, people, ZIP codes: guest rows on "Form Responses 1" in the Needs sheet (the tablet form
  and the typed-in paper sign-ins), counted by the Event date column, plus the Hub's CheckIns tab.
  Counting starts at `COUNT_FROM` (2026-10-08).
- Volunteers: volunteer rows on the same sheet and the Hub's VolunteerHours tab, or the "Volunteers by
  event" tab of the Hub sheet when nobody checked them in.
- Goods given to families: LINE VALUE on the Item Log for rows with a "Date given out" this year.
- Q4 distributions: dates with `EVENT_MIN` (10) or more households, except `NOT_DISTRIBUTIONS`.

Run `checkNumbers` in the Apps Script editor to see every number each screen will show. The goal
targets and milestones stay hand-set in the Data tab (`impact`, `leaders`). The website's Belize City
figures are still written in `index.html` (`YEAR_TOTALS`).

**Logs:** every request writes its name, time taken and any error to Executions in the Apps Script
editor (`doPost` in Code.gs). Start there when a screen is slow or fails.

**Sign-in emails** (reset and setup links, team and volunteers) are limited to one per address per 30
minutes and 40 an hour in all (`mailOk_` in Code.gs). Sign-in failures give one message whether or not
the email has an account.

## The automatic check

`.github/workflows/check.yml` runs `.github/check-pages.js` on every change:

1. every inline script on every page is valid JavaScript (a syntax error blanks the whole page);
2. the Hub build number matches in both places;
3. a change to `hub/index.html` came with a new build number.

A red X next to a commit on GitHub means it failed; open it for a plain-language message. It flags a
problem, it does not stop publishing: the change is already live, so fix it or undo it. Run it yourself
before committing with `node .github/check-pages.js`.

## Undoing a change

- Pages: revert the commit on GitHub (`git revert <commit>` and push). Live again in about a minute.
- Server: Manage deployments, pencil, pick the last version that worked, Deploy. Instant, and nothing
  is deleted.
- Data: each Sheet's File, Version history.

## Things that break the app if changed by hand

- Sheet tab names and column order on the Hub and volunteer sheets: the server finds data by tab name
  and column position.
- The PIN, Password hash and Reset/setup columns on the Access tab: written by the server only.
- The deployment's web address (see above).
- On the Budget workbook's I2 Item Log: the headers Quantity, Notes, Total units, Line value, Handover and
  "Set aside for event". The Hub finds Item Log columns by these header words, so renaming one stops
  Inventory, Found more / Fix the count, and Set aside for an event.

## Set aside for an event (server version 51, 2 Nov 2026)

Optional. In Ops, Inventory, tap an item in storage and pick an upcoming distribution. `setAside` in Code.gs
writes only that row's "Set aside for event" cell (I2 column AB) and a dated line in its Notes. The label
is built by `eventLabel_` (for example "Sat Dec 12: Maternal Wellness event"); the page builds the same
label to show the choice. Totals per event, with the value usable in applications kept apart, are on the
I8 Event Goods tab of the Budget workbook; the Hub shows units and value per event from the same storage
list.

## Open handoff work

- Move ownership of the Sheets, uploads folder and Apps Script project to ReUp's own Google account
  once its mailbox works, and redeploy from there.
- Move the server code into a private repository so it has history like the pages. Move the secret
  written in Portal.gs into Script Properties first.
- Name a second maintainer.
- Database move, planned for January 2027.
