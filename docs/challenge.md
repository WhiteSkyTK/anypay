# The challenge, and how AnyPay answers it

Source: the [challenge brief](https://hackathon.devmeetup.capetown/docs/challenge) of the Cape Town
Software Development Meetup × Interledger Foundation hackathon. This page summarises it in our own
words and adds our team's research. Sections marked **TODO (team)** are for the team to fill in.

## The problem

Spaza shops are the corner stores of South African townships: food, household goods and everyday
services close to home. Most still run on cash. The digital options that exist often mean high
fees, card machines that cost money, slow onboarding, money that arrives days later, and systems
that only work with one provider. For a small shop that watches every rand, that is a bad deal.

### The numbers (from the brief)

| Figure                                          | Value                                                   |
| ----------------------------------------------- | ------------------------------------------------------- |
| Spaza shops in South Africa                     | about 150 000                                           |
| Share of GDP                                    | about 5.2%                                              |
| Livelihoods supported                           | about 2.6 million                                       |
| Informal retail's share of total retail         | about 30% (40–50% of township grocery sales)            |
| Transactions done in cash                       | 9 in 10 nationally, close to 90% in the informal sector |
| Sent from South Africa to SADC countries (2024) | R19.3 billion                                           |
| Average cost of sending it                      | about 12.7%, over four times the G20 target of 3%       |

### The hackathon question (paraphrased)

How can open, interoperable payment technology make digital payments more accessible, affordable
and practical for spaza shops?

## Why Open Payments fits

- **Any ledger, any currency.** Interledger moves value between banks, mobile wallets, prepaid
  balances and fintech accounts, across borders too.
- **One simple interface.** A wallet address works like an email address for money. Any Open
  Payments app can get a quote, ask for the payer's consent and send, without holding bank
  credentials or integrating with each bank.
- **Where local rails are heading.** South Africa's instant payments use ISO 20022, which lines up
  with what Interledger and Open Payments expect at the edges.

## What AnyPay focuses on

The brief lists areas teams might explore and says to pick one part and do it well. AnyPay covers:

| Area in the brief                                   | AnyPay feature                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Low-cost acceptance, no expensive POS hardware      | Printed QR poster; the shop's phone is the till (Feature 1)                          |
| Simple onboarding for shop owners                   | Wallet address → shop profile → poster in under 2 minutes (Feature 1)                |
| Interoperability between wallets and providers      | Customers pay from any Open Payments wallet (Feature 2)                              |
| Faster, more transparent settlement; better records | Live feed, spoken confirmation, daily totals, CSV export (Feature 3)                 |
| Offline or low-connectivity payments                | Offline Digital Tab: signed QR vouchers within a pre-approved weekly cap (Feature 4) |
| Community-based payment features (stretch)          | Stokvel group pot; "send home" cross-border payments                                 |

The innovation story is Feature 4: two phones in airplane mode complete a sale, and it settles by
itself, exactly once, when either phone reconnects. The risk is capped by an Open Payments
spending limit, so it's a safer digital version of the credit book many shops already keep.

## How we'll be judged

| Criterion                               | Weight | Where AnyPay earns it                                                        |
| --------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| Understanding the problem               | 20%    | Interviews with spaza owners, personas, this page                            |
| Solution design & innovation            | 20%    | Offline Digital Tab; design process in [decisions.md](decisions.md)          |
| Use of Open Payments & interoperability | 20%    | Full grant → quote → consent → payment flow; interval-capped grants for tabs |
| Technical implementation                | 15%    | Tested monorepo, CI on Ubuntu + Windows, SonarCloud, secure by default       |
| User experience & accessibility         | 10%    | Four languages, WCAG contrast tests, large targets, works offline            |
| Impact & feasibility                    | 10%    | No hardware, low data, any wallet: realistic for a real spaza                |
| Presentation & demo                     | 5%     | Airplane-mode demo, recorded walkthrough                                     |

## Submission (confirm the exact deadline in the team's Slack channel)

- **Build period:** 5 October – 5 November 2026
- **Submission and judging:** 6 – 20 November; the top five teams are invited to the in-person
  Grand Finale in Cape Town on 21 November
- **What to submit**, in a shared cloud folder (Google Drive, Dropbox or OneDrive) that anyone
  with the link can open, then post the link in the team's Slack channel:
  - a presentation (PDF or PowerPoint): problem and opportunity, research insights, user stories
    or journeys, user flows and architecture diagrams, design decisions and process, technical
    implementation and stack, key features, challenges and how we solved them, impact and
    future improvements
  - a 10–15 minute recorded walkthrough with a demo
  - a link to the live demo and the source repository
  - any supporting documents
- The project must make meaningful use of Interledger or Open Payments.
- A partial prototype is acceptable if its limitations and next steps are clear.
- AI tools used (Claude Code) must be acknowledged.

## Support

- Technical questions: the Interledger support channel on the Interledger Community Slack
- Announcements: the CTSD Meetup Hackathon WhatsApp group and our team's Slack channel
- Mentor check-in: optional mid-project review (see ROADMAP.md)
- Tell the organisers early about any team changes

## Our research

**TODO (team):** add findings from spaza owner interviews here (or in `docs/research/`). For each
interview, with consent, note:

- how customers pay today, and what card or QR options cost the shop
- how credit for regular customers works (the "book")
- data costs and signal quality at the shop
- what makes the owner trust that a payment really arrived
- quotes worth putting on a slide

**TODO (team):** personas (one merchant, one customer) and user journeys for Features 1–4.
