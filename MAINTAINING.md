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
- `404.html`: the "page isn't here" page GitHub Pages shows for any address that does not exist. Its links and
  images start with `/` because it can be shown from any folder.
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

## Ask a question (server version 61, 3 Nov 2026)

**Answers:** the "ReUp Answers" Google Doc (ReUp Drive folder). Each question is a Heading 2 with its answer under it;
a Heading 1 containing "Team only" starts the part volunteers do not see. `answers_` in Code.gs reads it (cached 10
minutes). The Hub's Ask screen and the volunteer page's Questions tab search it on the phone. To change an answer,
edit the doc.

**AI answers (team only):** `askTeam_` in Code.gs sends the question, plus the text of the docs in `AI_DOCS` (ReUp
Answers, Message Guide, Admin Guide, Event Lead Guide, Fix-It Guide), to Google's free Gemini, and answers only from
them. Current Status is left out on purpose. The key is the Script Property `GEMINI_KEY`, never in code. On the free
tier Google may read what is sent, so the box tells the team never to type a community guest's details. Limit: 40
questions per person per hour.
- Model: picked once into the Script Property `GEMINI_MODEL`; delete it to pick again.
- When Google says the model is busy (503) or it takes over a minute, `aiAlts_` tries up to three other free "flash"
  models. The one that answers is remembered for 6 hours (cache `aigood`), and a busy main model is skipped for 10
  minutes (`aibusy`), so most answers take seconds.
- Answers use short thinking (`thinkingLevel: 'low'`), dropped automatically if a model refuses it.
- Test from the editor with `checkAI`: it logs each doc's size, the models, and one test answer.
- If the docs disagree, the AI says so. That is a sign to fix the docs, not the code.

## Writing past the end of a tab

Tabs fed by a Google Form (the Item Log, the volunteer Responses tab) end exactly at their last entry, and writing one
row past a tab's end fails. `room_(sheet, rows)` in Code.gs adds the missing rows first. Call it before any new
`getRange(sheet.getLastRow() + 1, ...)` write on a tab that could be full. (This is what broke "We got more of this"
on 3 Nov 2026.) When a save fails, the Hub now shows the server's reason after "That didn't save:".

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


## Search everything logged, and new stock of a past item (server version 52, 2 Nov 2026)

The Inventory search covers the whole Item Log, not only what is in storage. `inventory_` sends `past`: one line per
product already given out (newest row wins; Belize count-only and damaged rows are left out). Tapping a past item
opens "We got more of this". `restock` in Code.gs copies that Item Log row to a new row at the bottom (same product,
price, photos and pricing notes), then sets the new count, location, pickup ID, expiry, timestamp and sorter, and marks
it Still in storage. The old row is not touched. It also writes one line on I6 Count Changes.

## Turning work in, and the simpler Work tab (server version 53, 2 Nov 2026)

Tasks have a fifth status, `review` ("Turned in"), in `WORK_STATUS` in Code.gs. The people on a task turn it in
with a file or a note; the person in its "Created by" column (col 9), or any leader, approves it (status `done`) or
sends it back (status `doing`, a note is required). While it waits, the person who turned it in can take it back
(`takeBack`). Someone who assigned a task to themselves, or a Hub admin, marks it done directly. `saveWork` enforces
this, and each step adds a line to the task's updates ("Turned in for review: ...", "Sent back: ...", "Approved").

On the page (hub/index.html): My work shows at most 5 tasks for now (stuck, late, or due within 7 days) as plain
cards (`wplain`), with the rest in folds. A task opens as 1. What to do, 2. Turn it in, 3. Updates; the review
block (`reviewHtml`) shows to whoever reviews it. Status buttons are only in the leaders' "more" fold. Cards on
the Teams view have no buttons. Overview (`overviewTop` and `overviewCards`, shared by Work and Leadership) shows
"Your numbers" picked from the person's role, then needs a decision or help, waiting for review, finished this week,
and Late by person. Event pages have a "For the team" section (`evTeamHTML`) that reads Volunteers and storage once
those have been opened. Nothing here is a separate server report.

## Hand-offs, tags and the Events screen (server version 56, 3 Nov 2026)

Anyone on the team can add a task (`saveWork` with no id); a teammate's task is theirs unless they name someone,
and only leaders can make one leaders-only. When a task is created for someone else, they get an Inbox message.
On the task page: "What's next, and who does it?" makes a follow-up task for a teammate (with the files as links and
the note) when the task is turned in or marked done; "Pass this task to someone" sends `handTo`, which moves the same
task to them with a note. `@Name` in an update (`workUpdate`) messages that person. All notices go through
`workNotice_`, which posts a direct message from the person acting and sends the usual email.
Events is its own screen (`drawEvents`, under More). Hub admins change any date with Add a date (Schedule tab) or
Change this date (on the date's page), both through `schedEdit`. Past results come from `liveStats_().recent`,
passed on as `impact.recent`.

## Group sign-up (server version 59, 3 Nov 2026)

The volunteer form asks "Who is coming?". A group leader adds the group's name and how many people in all. They do
orientation for the group and answer the standards and photo questions for it, but agree to the liability release only
for themselves. Their sign-up saves as usual, then `grpSave_` (volunteer.gs) adds a row to the Hub sheet's **Groups**
tab and returns the group's link, `thereupmovement.org/?group=CODE`. Each person in the group opens that link
(`grpGet`, `grpJoin`, public, on `TP_OPEN`) and agrees to the release themselves; a parent or guardian agrees for anyone
under 18. Those agreements go on the **Group members** tab. In the Hub (`grpForHub_`, added to `volData_` in Code.gs),
the leader's row counts as the whole group toward volunteers needed (`vHeads` in hub/index.html), and shows
"Release needed" until everyone has agreed, with a button to copy the group's link again.
Not built yet: a group asking for its own service day, and the group on the leader's volunteer page.

## Open handoff work

- Move ownership of the Sheets, uploads folder and Apps Script project to ReUp's own Google account
  once its mailbox works, and redeploy from there.
- Move the server code into a private repository so it has history like the pages. Move the secret
  written in Portal.gs into Script Properties first.
- Name a second maintainer.
- Database move, planned for January 2027.
