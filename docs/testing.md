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

> **Heads-up (2026-10-09, 22:40):** the local database was reset. Your `npm run dev` and Claude's
> preview server both used `.data/pglite` at the same time, which corrupted it (now prevented: a
> second API stops with a clear message). Shops made before 22:16 are gone: restart
> `npm run dev`, and the shop page will say "signed out" → **Set up again**. The old data is kept
> in `.data/pglite-damaged-2026-10-09` (safe to delete once you're happy).

- [x] **Set up a shop**: <http://localhost:5173> → **Set up my shop** → shop wallet → **Check
      wallet** → it says COP → type a name → **Create my shop**. Under 2 minutes?
- [x] **Poster**: the QR shows; **Print poster** (Ctrl+P) previews one A5 page with no app
      buttons on it. Scan the QR on screen with your phone camera: it should show the pay link
- [x] **Live feed**: **Go to my shop** shows a green **Live** dot, **COP 0,00** and "No payments yet"
- [x] **Voice**: turn on **Read payments out loud** (keep the shop window's sound on)
- [x] **Pay, approved** (the main demo): in the customer window open the link under the QR →
      type an amount on the keypad (e.g. 50) → customer wallet → **Continue** → the sheet shows
      what the customer pays in **R** and what the shop gets in **COP** → **Approve in my
      wallet** → sign in to the test wallet as the customer → **Approve**. Expect: back on the
      receipt with a green tick and "Paid"; in the shop window the payment appears as **Received**
      without refreshing, the total goes up, and the phone says "Payment received, …"
- [x] **Pay, declined**: same, but press **Decline** in the wallet. Receipt: "declined in the
      wallet. No money was taken"; the shop window shows **Failed**, total unchanged
- [x] **Pay again** on the receipt goes back to the pay screen with the wallet already filled in
- [x] **Export CSV** (shop window) after an approved payment: opens in Excel/Sheets with one row
      per received payment
- [x] **Quote expired** (optional): press **Continue**, wait until after the "Price held until"
      time on the sheet, then approve. Expect a clear "price expired, try again" message
- [x] **Wrong wallet**: on setup, try `$ilp.interledger-test.dev/doesnotexist` and `hello`.
      Expect a plain message, not a crash
- [x] **Languages**: switch to isiZulu / isiXhosa / Sepedi on the start page, then walk through
      setup, pay and the feed. Note any wording that is wrong or too long (native speaker)
- [x] **Dark mode**: Settings → Dark. Everything readable, poster still prints black on white
- [x] **Demo sign-in link**: `npm run seed` prints a "Shop phone" link. Open it in a private
      window: it should land on the Demo Spaza feed

- [x] **Feed survives an API restart** (new): with the shop feed open, stop `npm run dev`
      (Ctrl+C) and start it again. The feed shows **Not connected**, then **Live** again within
      about 30 seconds, without reloading the page
- [x] **Old shop link after a reset** (new): a phone whose shop no longer exists shows "This
      phone is signed out of the shop" and **Set up again**, not an endless "Connecting…"

- [x] **Wallet name only** (new): on setup type just `merchanttest`; on the pay screen just
      `southtest`. The grey `$ilp.interledger-test.dev/` in front is filled in for you
- [x] **Pasting a whole address** (new): paste `$ilp.interledger-test.dev/southtest` into the
      name box: it keeps only `southtest`
- [x] **Another provider** (new): tap **Wallet from another provider?**, the full address shows
      and can be edited; **Use a ilp.interledger-test.dev wallet** goes back

### Phase 2: deployed (Render)

- [x] After fixing `VITE_API_URL` (with `.com`) and redeploying the web service: set up a shop
      on <https://anypay-web.onrender.com> without "No connection"
- [x] In the Render logs of anypay-api, a minute after a deploy: "PUBLIC_API_URL reaches the API"
      (a warning instead means it has a typo)
- [x] Two phones: one shows the shop feed, the other scans the poster and pays. The shop phone
      shows **Received** and says "Payment received" within seconds (Phase 2's "Done when")

### Phase 2: on a real phone (same Wi-Fi as the PC)

1. Find the PC's address: run `ipconfig`, look for **IPv4 Address** (e.g. `10.0.0.4`). It
   changes when you change networks, so check it each time.
2. In `.env` set **both** `WEB_ORIGIN=http://10.0.0.4:5173` and
   `PUBLIC_API_URL=http://10.0.0.4:5173` (your address; the web app forwards `/api`). With only
   `WEB_ORIGIN`, phones can't come back from the wallet; the API now warns about that at start.
3. Run `npm run dev:lan`. If Windows asks about the firewall, allow Node on **private** networks.
4. On the PC open `http://10.0.0.4:5173/merchant/new` (not localhost, so the poster QR uses
   the address the phone can reach) and set up the shop there, or use `npm run seed`.

Or simply test on the deployed app (<https://anypay-web.onrender.com>): no setup at all.

- [x] Phone camera scans the poster QR and opens the pay screen
- [x] Keypad is easy to hit with a thumb; the amount is big and readable in sunlight
- [x] After approving in the wallet on the phone, it comes back to the receipt
- [x] The PC (shop) announces the payment out loud
- [x] Phone with the shop feed open: lock the screen for a minute, unlock, pay again: the
      feed reconnects (**Live**) and shows the new payment
- [x] Phone text size at maximum (Android Settings → Display → Font size): nothing cut off

### Phase 2: getting around and safety (2026-10-14)

Best on a phone, and once more with the app **installed** (browser menu → Add to Home screen),
because an installed app on iPhone has no browser Back button.

- [x] **Back everywhere**: set-up, poster, Pay a shop, the pay screen and the "connecting" page
      all have **‹ Back** at the top. Opened from a QR code or link, Back goes somewhere sensible
      (Pay a shop, your shop, the start page) instead of leaving the app
- [x] **Start page knows your shop**: on a phone that runs a shop it says **Open <shop>**, not
      "Set up my shop". The installed app opens straight into the live feed
- [x] **No accidental second shop**: go to set-up on the shop's phone. It says "This phone already
      runs …" with **Open** as the main button; the old shop is only replaced if you choose
      **Set up a new shop instead** and finish
- [x] **I'm a customer** opens **Pay a shop**: camera instructions, plus a box for the shop code.
      Typing the code from the poster (any case, with or without the space) opens the pay screen
- [x] **Poster shows the shop code** under the QR (new shops get codes like `7KQM 4XPA`: no 0/O
      or 1/I/L mix-ups). Shops made before today keep their old code
- [x] **Poster → Go to my shop → Back** doesn't bounce between the poster and the feed
- [x] **Back from the wallet**: tap **Approve in my wallet**, then the phone's Back button before
      approving. The price sheet is usable again (not stuck on "Opening your wallet…")
- [x] **Receipt**: after paying there is **Done** (to Pay a shop) and **Pay again**
- [x] **Hidden characters**: copy a name with an invisible character (e.g. from a web page) into
      the shop name: it says to remove hidden or special characters
- [x] **Deployed site still works** after this update is live (the new security policy blocks
      anything not from AnyPay itself; a blank page or "No connection" would mean it's too strict)

### Phase 2 wrap-up: short links and remembering (2026-10-14)

- [x] <https://anypay-api.onrender.com/> (the API's own address) opens the app instead of an error
- [x] <https://anypay-web.onrender.com/start> opens shop set-up
- [x] A newly printed poster's QR opens `…/s/<code>` and lands on the pay screen; old posters
      (`…/shop/<code>/pay`) still work
- [x] Pay at a shop once, then turn on airplane mode and scan its poster again: the pay screen
      still opens (paying itself needs signal, and says so)
- [x] Open the shop feed, close the app, turn off data, open it again: today's payments and total
      are still there while it says **Connecting…**

### Phase 3: the Offline Digital Tab (2026-10-15)

You need two phones (or a phone and the PC): one runs the shop, one is the customer. Use the live
app once `phase-3-offline-tab` is merged, or `npm run dev:lan` (see "on a real phone" above).
Claude checked in a browser: opening a tab reaches the test wallet's approval (the wallet accepts
the weekly limit), the key is stored on the phone, tab sale, scanner fallback and Simulate offline.
**The approvals, real cameras and the two-phone sale are yours.**

**Open a tab (online, once)**

- [x] Customer phone: open the shop's poster link → **Open a tab at this shop** → wallet name
      (`southtest`), your name for the shop, a weekly limit (in rand) → **Approve in my wallet**
      → approve in the test wallet. You land on the tab: **Left this week** shows the limit in the
      shop's currency
- [x] Shop phone: **Tab sale** says **Customer tabs on this phone: 1**

**The sale, both phones offline** (airplane mode, or Settings → **Simulate offline (demo)**)

- [x] Shop: **Tab sale** → type an amount → **Show QR to customer**
- [x] Customer: **My tabs** → the tab → **Scan the shop's QR** (or the phone's camera app) → it
      shows the shop and amount → **Approve** → a QR appears
- [x] Shop: **Scan the customer's QR** → **Saved – settles when online**; the feed shows it
      under **Tab sales waiting to settle**
- [x] Turn signal back on (or Simulate offline off) on **either** phone: within seconds it says
      **Settled**, the payment joins the feed with a **Tab** label and is read out loud
- [x] Then the other phone too: it also shows **Settled**, and the shop got paid **once**
      (check the feed and the merchant wallet) — this is Phase 3's "Done when"

**Things that must be refused**

- [x] Scan the same customer QR twice: **Already saved: this sale won't be paid twice**
- [x] A sale bigger than what's left this week: refused on the customer's phone
- [x] Customer phone with no tab at that shop: "You don't have a tab at this shop…"

**Good to know:** an installed app on iPhone can't receive links from the camera app (they open
in Safari, which doesn't have the tab's key): use the in-app scanner there.

### Phase 4: polish (2026-10-15)

**Your shop on another phone** (two phones; the first already runs a shop)

- [x] Shop phone: **Settings → Use on another phone → Show sign-in code**; scan it with the
      second phone's camera: the second phone opens the shop's live feed
- [x] Take a test payment: it appears on **both** phones
- [ ] First phone: **Sign out other phones** → confirm. Within seconds the second phone says
      **This phone is signed out of the shop**; the first keeps its feed (it reconnects by
      itself) and the next payment still appears there
- [ ] The sign-in code shown before no longer works on a third phone; a newly shown one does

**Calmer edges**

- [x] Receipt with the API asleep or down (stop it, or wait for Render to sleep): **Can't reach
      AnyPay right now**, not "receipt not found"; it updates by itself once the API is back
- [ ] On a slow connection (Chrome DevTools → Network → Slow 4G) the AnyPay mark shows at once
      instead of a blank screen, and disappears as the page appears (no jump)
- [x] Start page and **Settings → Privacy** open the privacy notice; it reads well in every
      language (drafts need the native-speaker review)

**Real phones, bad networks (2026-10-16)**

- [ ] With Render asleep (no visits for 15+ minutes), open a shop's pay screen: after a few seconds
      a grey **Still working…** bar says AnyPay may be waking up, and the page then loads by
      itself
- [ ] Shop feed: switch on **Keep the screen on**, put the phone down for 5 minutes: the screen
      stays on, and a test payment is still spoken
- [ ] Set the shop phone's clock 2 hours wrong (turn off automatic time), open the app once with
      signal, then **Tab sale**: a warning asks to fix the clock, and the tab sale still settles
- [ ] Open a tab on the laptop's LAN address (`http://192.168.…`): the app says offline tabs need
      a secure connection, instead of a blank screen (payments still work there)
- [ ] Phone set to reduce motion (Android: Settings → Accessibility → Remove animations; iPhone:
      Reduce Motion): the success tick and the price sheet appear without animating
- [ ] Shop phone A shows its feed; phone B (signed in with the sign-in code) signs out other
      phones: A says **This phone is signed out of the shop** within seconds

## Problems found

<!-- Example: "Poster: QR too small to scan from 1 m on my phone (Samsung A05)" -->
