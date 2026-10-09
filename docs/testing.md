# What to test

Claude updates this file as features land. Anything under **Ready to test** works on the
current branch; pull it (or just look in VS Code) and try it while the next part is being built.
Tick what worked, and write what didn't under **Problems found**.

**How to run the app:** `npm run dev`, then open <http://localhost:5173>. The API runs on
<http://localhost:3000>. You need your `.env` (AnyPay app key) for anything that pays.

## Ready to test

### Phase 1 (done)

- [x] `npm run demo:pay -- --amount 25.00` completes a real payment (checked 2026-10-09)
- [x] Insufficient funds: run `npm run demo:pay -- --amount 999999` (more than the customer
      holds), approve it, and check the script says the wallet does not have enough money
- [x] Declined: run `npm run demo:pay -- --amount 5`, then press **Decline** on the approval
      page. The script should say the customer declined

### Phase 2: on your PC (start here)

Run `npm run dev`. Use two browser windows side by side: one is the **shop**, one is the
**customer**. Shop wallet: `$ilp.interledger-test.dev/merchanttest` (COP). Customer wallet:
`$ilp.interledger-test.dev/southtest` (ZAR).

Claude already checked these in the browser (2026-10-09): shop setup, poster QR, live feed,
quote sheet, opening the wallet's sign-in, a declined payment updating both screens live,
`npm run seed` sign-in link, bad link, unknown shop, CSV download. **The parts only you can do
are the real approvals in the test wallet, the voice, printing and a real phone.**

- [ ] **Set up a shop**: <http://localhost:5173> → **Set up my shop** → shop wallet → **Check
      wallet** → it says COP → type a name → **Create my shop**. Under 2 minutes?
- [ ] **Poster**: the QR shows; **Print poster** (Ctrl+P) previews one A5 page with no app
      buttons on it. Scan the QR on screen with your phone camera: it should show the pay link
- [ ] **Live feed**: **Go to my shop** shows a green **Live** dot, **COP 0,00** and "No payments yet"
- [ ] **Voice**: turn on **Read payments out loud** (keep the shop window's sound on)
- [ ] **Pay, approved** (the main demo): in the customer window open the link under the QR →
      type an amount on the keypad (e.g. 50) → customer wallet → **Continue** → the sheet shows
      what the customer pays in **R** and what the shop gets in **COP** → **Approve in my
      wallet** → sign in to the test wallet as the customer → **Approve**. Expect: back on the
      receipt with a green tick and "Paid"; in the shop window the payment appears as **Received**
      without refreshing, the total goes up, and the phone says "Payment received, …"
- [ ] **Pay, declined**: same, but press **Decline** in the wallet. Receipt: "declined in the
      wallet. No money was taken"; the shop window shows **Failed**, total unchanged
- [ ] **Pay again** on the receipt goes back to the pay screen with the wallet already filled in
- [ ] **Export CSV** (shop window) after an approved payment: opens in Excel/Sheets with one row
      per received payment
- [ ] **Quote expired** (optional): press **Continue**, wait until after the "Price held until"
      time on the sheet, then approve. Expect a clear "price expired, try again" message
- [ ] **Wrong wallet**: on setup, try `$ilp.interledger-test.dev/doesnotexist` and `hello`.
      Expect a plain message, not a crash
- [ ] **Languages**: switch to isiZulu / isiXhosa / Sepedi on the start page, then walk through
      setup, pay and the feed. Note any wording that is wrong or too long (native speaker)
- [ ] **Dark mode**: Settings → Dark. Everything readable, poster still prints black on white
- [ ] **Demo sign-in link**: `npm run seed` prints a "Shop phone" link. Open it in a private
      window: it should land on the Demo Spaza feed

### Phase 2: on a real phone (same Wi-Fi as the PC)

1. Find the PC's address: run `ipconfig`, look for **IPv4 Address** (e.g. `192.168.1.20`).
2. In `.env` set `WEB_ORIGIN=http://192.168.1.20:5173` and
   `PUBLIC_API_URL=http://192.168.1.20:5173` (your address; the web app forwards `/api`).
3. Run `npm run dev:lan`. If Windows asks about the firewall, allow Node on **private** networks.
4. On the PC open `http://192.168.1.20:5173/merchant/new` (not localhost, so the poster QR uses
   the address the phone can reach) and set up the shop there, or use `npm run seed`.

- [ ] Phone camera scans the poster QR and opens the pay screen
- [ ] Keypad is easy to hit with a thumb; the amount is big and readable in sunlight
- [ ] After approving in the wallet on the phone, it comes back to the receipt
- [ ] The PC (shop) announces the payment out loud
- [ ] Phone with the shop feed open: lock the screen for a minute, unlock, pay again: the
      feed reconnects (**Live**) and shows the new payment
- [ ] Phone text size at maximum (Android Settings → Display → Font size): nothing cut off

## Problems found

<!-- Example: "Poster: QR too small to scan from 1 m on my phone (Samsung A05)" -->
