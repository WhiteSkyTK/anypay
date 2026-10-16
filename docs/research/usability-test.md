# Usability test: 2–3 spaza owners, about 30 minutes each

For the roadmap item "Usability test with 2–3 owners and what changed as a result". Use the
deployed app in demo mode (test money only), on the owner's own phone if they agree, otherwise
on a team phone. Read the consent script in [interview-guide.md](interview-guide.md) first, then
explain: "We're testing the app, not you. If something is hard, that's the app's fault. Please
think out loud."

## Setup

- Shop phone: the owner's (or a team phone). Customer phone: a team member with the test wallet
  (`southtest`).
- One person guides and stays quiet; one notes, with a stopwatch.
- Don't help unless the owner is stuck for over a minute; then note "helped" and how.

## Tasks

Read each task as written; don't name buttons.

| #   | Task (read out)                                                                    | Success looks like                                                                      | Note                                               |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | "Set up your shop so customers can pay you. Your wallet name is `merchanttest`."   | Shop created, poster on screen, under 2 minutes                                         | Time; where they hesitated; did they read the hint |
| 2   | "A customer wants to pay you R25. Show them how." (The customer scans the poster.) | Owner sees the payment arrive and hears it                                              | Did they notice the sound? Did they trust it?      |
| 3   | "How much have you taken today?"                                                   | Finds the total on the feed                                                             |                                                    |
| 4   | "Your regular customer has a tab. Sell them R15 of bread on it, with no signal."   | Tab sale QR shown, customer's voucher scanned, "Saved – settles when online" understood | Did "settles when online" make sense?              |
| 5   | "Turn the signal back on. Did the sale go through?"                                | Sees Settled, and the payment in the feed                                               |                                                    |
| 6   | "Your phone is lost. Make sure nobody else can see your sales."                    | Finds Settings → Use on another phone → Sign out other phones                           | Hardest task: note every place they looked         |
| 7   | "Make the app speak your language."                                                | Language changed in Settings                                                            | Which language? Did any words confuse them?        |

## After the tasks

Ask, and write down the answers word for word:

1. What was easiest? What was hardest?
2. Was anything on screen not clear, or in the wrong language?
3. Would you use this in your shop? What would stop you?
4. On a scale of 1–5, how sure were you that the money really arrived? Why?

## What to measure

- Task success: done alone / done with help / not done.
- Time for task 1 (target: under 2 minutes, CLAUDE.md Feature 1).
- Wrong taps or dead ends per task.
- Trust score (question 4).

## From findings to changes

For each problem: what happened, how many owners hit it, how bad it is (blocks / slows /
cosmetic), and the change. Log each change and its reason in [decisions.md](../decisions.md),
and tick it in ROADMAP.md's research track. These "we tested, we changed" notes are what the
design-process marks reward.
