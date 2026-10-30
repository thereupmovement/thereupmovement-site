# The ReUp Movement

The community page at thereupmovement.org: upcoming distributions, volunteer orientation, and ways to give or ask for help.

The page is one file, index.html. Event dates are updated by the ReUp team.

## hub/

Layout, code and images for the ReUp Hub, the team's private web app. This folder holds no team data:
the Hub's schedule, requests, inventory and goals are served by the app itself, only to people with a
personal link (hub/?k=...). Opening hub/ without one shows a short note and nothing else.

## Maintaining

See [MAINTAINING.md](MAINTAINING.md) for how the pages, the server and the data fit together, how to publish a
change, and how to undo one. Every change is checked automatically (`.github/check-pages.js`).
