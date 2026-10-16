# Slide-ready bullets

Short lines for the presentation, grouped in the order the submission asks for (see
[challenge.md](challenge.md#submission-confirm-the-exact-deadline-in-the-teams-slack-channel)).
Sources and detail: [research/desk-research.md](research/desk-research.md) and
[decisions.md](decisions.md). Slots marked **(team)** need the interviews.

## 1. Problem and opportunity

- About 150 000 spaza shops; about 9 in 10 informal-sector payments are cash (challenge brief).
- 66% of South Africans prefer cash at spazas, and cash makes shops a target.
- A card machine costs R699 up front, plus about 66c on every R25 sale (2.30% + VAT).
- Data comes in small, pricey bundles: about R69 for 500 MB, about 14c per MB.
- Load-shedding takes towers down: 6–12 h of battery, 12–18 h to recharge.

## 2. Research insights

- **(team)** 2–3 quotes from owners: how they're paid, the credit book, trust.
- Spazas give regulars credit before pay day: something big retailers don't do.
- India's soundbox: hearing "payment received" is what makes QR payments feel real to a trader.
- India's UPI Lite: small offline payments work when they are capped.
- Four languages in the app cover about 59% of home languages; Afrikaans (10.6%) is next.

## 3. User stories and journeys

- **Shop owner:** "I want to take a digital payment without buying a machine, and know it
  arrived without looking at my phone."
- **Customer:** "I want to pay my local shop from the wallet I already have, and see exactly what
  it costs before I approve."
- **Regular customer:** "I want to buy on my tab when there's no signal, without the shop having
  to trust me blindly."
- **(team)** Journeys with pain points, from interviews. Screen flows: [research/flows.md](research/flows.md).

## 4. User flows and architecture

- Use the screen map and the four flows in [research/flows.md](research/flows.md).
- Use the architecture and sequence diagrams in the README.
- One web app on any phone; an API that is the only Open Payments client; Postgres.

## 5. Design decisions and process

- A printed QR poster, not hardware: the shop's phone is the till.
- The wallet field asks for a name, not an address: fewer typos on a small phone.
- A custom keypad: big keys, the same on every phone, and it can't type an invalid amount.
- The price sheet shows exactly what leaves the customer's wallet, fees and exchange included.
- Voice confirmation in the shop's language: no box to buy.
- Text under every tab-bar icon: icons alone are guesswork for new users.
- Starts in English, remembers the choice: predictable on a shared shop phone.
- **(team)** What the usability test changed (one before/after slide).

## 6. Technical implementation and stack

- React PWA (works offline, installs from a link), Node API, Postgres, TypeScript end to end.
- Open Payments, end to end: incoming payment → quote → interactive grant capped at the exact
  debit → outgoing payment; tabs use interval grants (a weekly limit).
- The Offline Digital Tab: ECDSA-signed QR vouchers made with both phones offline. They settle
  once, whichever phone syncs first, guarded by a database key.
- Security: tokens and wallets are encrypted at rest. Wallet hosts are allowlisted (no SSRF).
  Wallet callbacks are verified, and every money move is idempotent. A CSP is in place, and the
  live feed opens with one-minute tickets.
- Quality: 600+ automated tests, CI on Windows and Ubuntu, and SonarCloud's quality gate passes.
  Lighthouse mobile scores 92–94, with accessibility at 100.
- Low data: every page's first load is under 200 KB (a customer's pay screen about 175 KB);
  repeat visits cost almost nothing.

## 7. Key features

1. Shop set-up in under two minutes, with a printable A5 poster.
2. Pay from any Open Payments wallet, with the exact price shown first.
3. A live feed with a spoken "Payment received", daily totals and a CSV export.
4. The Offline Digital Tab: sell with no signal, settled automatically, exactly once.
5. Use the shop on several phones, and sign them all out if one is lost.

## 8. Challenges and how we solved them

- **Phones offline at the moment of sale.** Signed vouchers within a pre-approved weekly cap,
  settled later; two phones syncing at once can't double-pay.
- **Currency mismatch** (rand wallet, peso test shop): the cap is approved in the customer's
  currency and converted once with a quote.
- **Wrong phone clocks** would expire vouchers. The phone learns the server's time and corrects
  its stamps.
- **Free servers sleep.** "Still working…" after 4 s, a clear "waking up" message, and every
  retry is safe.
- **A lost shop phone.** "Sign out other phones" with a token the phone chooses, so the shop
  can never lock itself out.
- **First load on prepaid data.** Splitting code, a smaller validation library and loading
  animation code only on the receipt took Lighthouse from 86 to 92.

## 9. Impact and future improvements

- No hardware, about 2c of data for a first payment, any wallet: realistic for a real spaza.
- A safer credit book: the customer sets the limit, and the money moves by itself.
- Next:
  - Afrikaans
  - a native-speaker review of every language
  - a payment retention schedule
  - a stokvel group pot (recurring grants)
  - "send home" cross-border payments (12.7% average cost today, per the brief)
  - production wallets beyond the test network
- Known limits: test money only; one API instance; free hosting sleeps.

## Acknowledgements (required)

- Built with Claude Code (AI pair programmer). Open Payments SDK and Interledger test wallet by
  the Interledger Foundation; libraries listed in the README.
