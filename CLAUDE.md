# Instructions for Claude (and anyone else) working in this repository

Read `MAINTAINING.md` first: how the pages, the Apps Script server and the Sheets fit together, how to
publish, and how to undo.

## Who this is for

The ReUp Movement, a Houston nonprofit. The team is not technical, and the app must stay easy to hand
to a new maintainer. Prefer the simplest change that works, explain changes in plain words, and leave
things more obvious than you found them.

## Rules for every change

- **Phone and desktop.** Every screen works at 390px and 1280px wide, with no sideways scrolling.
  Check both in a real browser before calling something done.
- **Plain words, big buttons, one clear action per screen.** Write for every education level.
- **No emojis** anywhere in the app or its copy.
- **Public repository.** Never commit secrets, tokens, email addresses, phone numbers, home
  addresses, or details about community guests, volunteers or staff. Team data only ever comes from
  the server to signed-in people.
- **Hub build number.** Any change to `hub/index.html` raises `hub/version.json` and `var BUILD`
  together. Run `node .github/check-pages.js` before committing.
- **One source of truth.** A summary screen reads the same data as the screen people act on (the
  Work Overview is built from the live Work list for this reason). Do not add a second server report
  for something the page already has.
- **Server changes** are made in the Apps Script editor and only go live after Deploy, Manage
  deployments, New version. Saving is not publishing. Never create a new deployment.
- **Commit messages** say what changed and why, in plain words. They are the change history the next
  maintainer reads.

## Living documents: update them with every change

These are never final. Whenever the app changes, update all of them in the same pass:

- `MAINTAINING.md` (this repository)
- "ReUp Hub - Fix-It Guide" (Google Doc, ReUp app folder): the plain-language fixes and steps,
  plus its update log
- "ReUp Hub - Admin Guide" (Google Doc): how the team runs the Hub day to day
- "ReUp App Build-Out Plan" (Google Doc): status, decisions and change log

## Brand and wording

Follow the ReUp Message Guide for any words people read. "The ReUp Movement" on first reference,
"ReUp" after. Say "community guests", never "the homeless", "the needy", "recipients" or
"beneficiaries". Black is the base color, with red and white accents; the logo and its gold arrow are
never redrawn or stretched.
