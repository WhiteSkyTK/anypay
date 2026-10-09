# What to test

Claude updates this file as features land. Anything under **Ready to test** works on the
current branch; pull it (or just look in VS Code) and try it while the next part is being built.
Tick what worked, and write what didn't under **Problems found**.

**How to run the app:** `npm run dev`, then open <http://localhost:5173>. The API runs on
<http://localhost:3000>. You need your `.env` (AnyPay app key) for anything that pays.

## Ready to test

### Phase 1 (done)

- [x] `npm run demo:pay -- --amount 25.00` completes a real payment (checked 2026-10-09)
- [ ] Insufficient funds: run `npm run demo:pay -- --amount 999999` (more than the customer
      holds), approve it, and check the script says the wallet does not have enough money
- [ ] Declined: run `npm run demo:pay -- --amount 5`, then press **Decline** on the approval
      page. The script should say the customer declined

### Phase 2

_Nothing new yet. The database and API come first; screens follow._

## Problems found

<!-- Example: "Poster: QR too small to scan from 1 m on my phone (Samsung A05)" -->
