# Desk research: what public sources say, and what AnyPay does about it

Compiled on 2026-10-16 by Claude Code from public sources (links at the end). This is
**secondary research**: it frames the problem and the questions. It does not replace the team's
interviews with spaza owners (see [interview-guide.md](interview-guide.md)). Before a number
goes on a slide, open its source: several are estimates by interested parties (operators,
banks, industry bodies), and each is labelled as such below.

## Findings, and what AnyPay does about each

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                               | What AnyPay does                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Card acceptance has a cost per sale and a device cost.** Yoco lists 2.30% (excl. VAT) per in-person sale on its no-fee plan for turnover up to R40 000 a month, and machines from R699 [1]. SnapScan's card machine is a flat 2.5% excl. VAT [2]. On a R25 loaf at 2.30% + VAT, the shop pays about **66c**.                                                                        | No hardware: a printed QR poster, and the shop's own phone is the till. AnyPay adds no fee of its own in this prototype; what the customer's and the shop's wallets charge (including exchange) is shown as an exact amount **before** the customer approves (the quote sheet).                                                          |
| 2   | **Data is bought in small, expensive bundles.** A 30-day 1 GB prepaid bundle costs about R79 and 500 MB about R69, and small bundles barely got cheaper since 2020 [3]. 500 MB at R69 is about **14c per MB**.                                                                                                                                                                        | A strict data budget. The first visit to a pay screen downloads about 175 KB (about 2c), then the rest of the app in the background for offline use (about 330 KB in all, about 5c). Repeat visits cost almost nothing (cached), and the shop's live feed is pushed (SSE), so phones never poll. Trade-off noted under "Open questions". |
| 3   | **The signal drops when the power does.** Cell-tower batteries last about 6–12 hours and need 12–18 hours to recharge, which stage 3–4 load-shedding doesn't allow; towers are also vandalised during blackouts [4][5]. (Operator statements; the ITU has a technical report on power outages and network availability [6].)                                                          | Designed for no signal. The **Offline Digital Tab** (Feature 4) completes a sale with both phones offline, with signed QR vouchers that settle by themselves, exactly once, when either phone reconnects. The shop's profile and today's feed are cached, and every screen says when it is offline instead of spinning.                  |
| 4   | **Cash is still preferred at spazas, and cash is risky.** A SARB-linked survey reports 66% of South Africans prefer cash at spaza shops (68% with informal traders) [7]. One estimate puts retailers' and informal businesses' share of the cost of cash robberies at R4.3 billion a year (a single report; treat as rough) [7].                                                      | AnyPay doesn't try to replace cash; it adds a cheap option next to it. Trust signals were designed in: the payment is announced out loud ("Payment received, R25"), appears live on the shop's phone, and the customer approves in their **own** wallet, never typing credentials into AnyPay.                                           |
| 5   | **Spazas give regular customers credit.** Township research describes spazas offering items on credit for a few days before grant or pay day, something big retailers don't do [8][9]. This is qualitative: we found no survey that measures how common it is or how often it isn't paid back.                                                                                        | The Offline Digital Tab is a **capped, digital credit book**: the customer approves a weekly limit in their own wallet once; after that the shop sells against it, even offline, and the money moves by itself. The risk is capped by the wallet's spending limit, not by trust alone. Interviews must confirm how the book works today. |
| 6   | **Instant small payments are becoming normal.** PayShap (operated by PayInc, formerly BankservAfrica) reached about 45 million transactions a month by late 2025, 80% of them under R500 [10]. (Reported by a payments company; cumulative totals differ between sources.)                                                                                                            | AnyPay is complementary, not competing: it works with **any** Open Payments wallet, across currencies, and offline. As the challenge brief notes, South Africa's instant payments use ISO 20022, which lines up with Interledger at the edges.                                                                                           |
| 7   | **Spaza shops had to register.** After a foodborne-illness crisis, government required spaza shops to register with their municipality by 28 February 2025 [11].                                                                                                                                                                                                                      | Onboarding asks only for a wallet address and a shop name (under two minutes). The daily CSV export gives a registered shop simple records for its bookkeeper.                                                                                                                                                                           |
| 8   | **Home languages.** Census 2022: isiZulu 24.4%, isiXhosa 16.3%, Afrikaans 10.6%, Sepedi 10.0%, English 8.7% [12].                                                                                                                                                                                                                                                                     | AnyPay ships English, isiZulu, isiXhosa and Sepedi: together the home language of about 59% of people. Afrikaans, the third most common home language, was added on 2026-10-24 as a direct result of this finding: the five languages cover about 70%.                                                                                   |
| 9   | **Phones are how people get online.** For 72.6% of households, mobile is the main way to the internet (GHS 2023) [13].                                                                                                                                                                                                                                                                | A phone-first web app (PWA): opens from a QR code with no app store, installs to the home screen, works offline.                                                                                                                                                                                                                         |
| 10  | **Most adults are banked.** The FSCA reported about 37.4 million banked adults, with about 2% (roughly 7 million people) excluded (reported February 2025; reference year not stated) [14].                                                                                                                                                                                           | The customer needs an Open Payments wallet. Few production wallets support Open Payments yet (Rafiki is the reference implementation for regulated providers; the test wallet is for developers) [15][16]: a dependency, stated in the README's known limitations.                                                                       |
| 11  | **Stokvels are huge.** About 800 000 groups, 11 million+ members and about R50 billion a year (NASASA's own estimates) [17].                                                                                                                                                                                                                                                          | The stretch goal: a stokvel group pot with recurring Open Payments grants.                                                                                                                                                                                                                                                               |
| 12  | **Precedents abroad validate two design choices.** India's Paytm Soundbox (a speaker that announces each QR payment, in 11 languages) had 5.8 million payment devices in the field (card terminals and soundboxes together) by late 2022 [18]. India's UPI Lite allows small payments with no connectivity, capped at INR 1 000 each and INR 5 000 in all, settling once online [19]. | AnyPay's **voice confirmation** is the soundbox without the box (the shop's phone speaks). The **Offline Digital Tab** follows the same idea as UPI Lite (small offline payments within a hard cap, settled later), but across any wallet and currency via Open Payments.                                                                |

## Numbers worth a slide

Each with its source; check the source before using it.

- About 66c in card fees on a R25 sale (2.30% + VAT) [1], and R699 for the card machine [1].
- 1 GB of prepaid data: about R79; 500 MB: about R69 [3]. AnyPay's first visit: about 2c of data.
- Tower batteries: 6–12 hours; recharge: 12–18 hours [4].
- 66% prefer cash at spaza shops [7].
- PayShap: about 45 million payments a month, 80% under R500 [10].
- Stokvels: 11 million+ members, about R50 billion a year (NASASA estimate) [17].
- Soundbox precedent: Paytm had 5.8 million payment devices (terminals and soundboxes) in India by late 2022 [18].

## Open questions (for interviews and the team)

Desk research can't answer these; the [interview guide](interview-guide.md) asks them.

1. How does the credit book work today: who gets credit, how much, for how long, and how often
   isn't it paid back? Would a weekly cap the customer sets themselves feel fair to both sides?
2. What does the shop pay today to take card or QR payments, and what made them stop or start?
3. What makes an owner trust that a payment arrived: a sound, a screen, an SMS, the money in the
   bank?
4. How often is there no signal at the shop, and for how long?
5. Data: how much does the owner spend a month, and would 330 KB once (for offline use) be
   acceptable? If not, AnyPay could cache only the customer's screens on a customer's phone.
6. Language: which language does the owner want the phone to speak? Is Afrikaans needed in the
   team's test areas?
7. Do customers already have a wallet that could use Open Payments? If not, who would give them
   one (the shop's bank, a fintech, a retailer)?

## Sources

All accessed 2026-10-16.

1. Yoco, card machine pricing: <https://www.yoco.com/za/card-machines/pricing/>
2. Standard Bank, SnapScan card machine:
   <https://www.standardbank.co.za/southafrica/business/products-and-services/business-solutions/merchant-solutions/high-volume-payment-solutions/snapscan-card>
3. AllAfrica, "Government says data prices dropped but some costs barely moved" (Feb 2026):
   <https://allafrica.com/stories/202602120144.html>; ICASA bi-annual tariff analysis (2024):
   <https://icasa.org.za/uploads/files/2024-25FY-Q2-Bi-annual-Tariff-Analysis-Report-Abridged-Report-RSRU-For-Publication-30092024.pdf>
4. Creamer Media, "Network blackout looms as load-shedding has devastating effects on cell towers"
   (Sep 2022):
   <https://newsletter.po.creamermedia.com/article/network-blackout-looms-as-load-shedding-has-devastating-effects-on-cell-towers-across-sa-2022-09-21>
5. TimesLive, "Load-shedding double whammy for some areas as mobile networks black out" (Jan 2023):
   <https://www.timeslive.co.za/sunday-times-daily/news/2023-01-19-load-shedding-double-whammy-for-some-areas-as-mobile-networks-black-out/>
6. ITU-T workshop slides on the power-outage technical report (ESTR.POWER-OUT), South Africa case:
   <https://www.itu.int/en/ITU-T/Workshops-and-Seminars/qos/20260512/Documents/Eric%20NKOPODI.pdf>
7. BusinessTech, "South Africans pay a R1 billion 'robbery tax' every month":
   <https://businesstech.co.za/news/?p=877857>; Daily Investor, "Cash is king in South Africa":
   <https://dailyinvestor.com/finance/36735/cash-is-king-in-south-africa/>
8. BusinessDay, "Township residents spending more at spaza shops, poll shows" (Jun 2022):
   <https://www.businessday.co.za/bd/companies/retail-and-consumer/2022-06-29-township-residents-spending-more-at-spaza-shops-poll-shows/>
9. Sunday World, "Spaza shops have become a 'necessary evil' in townships":
   <https://sundayworld.co.za/news/spaza-shops-have-become-a-necessary-evil-in-townships/>
10. Stitch, "Real-time payments in South Africa: the state of PayShap in 2026" (Jul 2026):
    <https://stitch.money/blog/real-time-payments-in-south-africa-the-state-of-payshap-in-2026>
11. SAnews, "Deadline won't be extended for spaza shops to register":
    <https://www.sanews.gov.za/south-africa/deadline-wont-be-extended-spaza-shops-register>
12. BusinessTech, "These are the most spoken languages in South Africa" (Census 2022):
    <https://businesstech.co.za/news/lifestyle/724160/these-are-the-most-spoken-languages-in-south-africa/>
13. Engineering News, "More South African households getting connected to the internet" (GHS):
    <https://www.engineeringnews.co.za/article/south-african-households-have-become-more-connected-2024-06-14>
14. The Post, "Financial inclusion in South Africa: 37.3 million adults banked" (Feb 2025):
    <https://thepost.co.za/news/politics/2025-02-04-financial-inclusion-in-south-africa-37-3-million-adults-banked/>
15. Interledger Foundation, Rafiki: <https://interledger.org/tech/rafiki>
16. Open Payments guide, Open Payments-enabled wallets:
    <https://openpayments.guide/resources/op-wallets/>
17. EWN, "More than 11 million South Africans are members of stokvels – NASASA":
    <https://www.ewn.co.za/more-than-11-million-south-africans-are-members-of-stokvels-nasasa>
18. Business Insider India, "How Paytm Soundbox is fuelling growth":
    <https://www.businessinsider.in/business/news/how-paytm-soundbox-is-fuelling-growth/articleshow/96911126.cms>
19. Inc42, "RBI increases wallet limit for UPI Lite to INR 5,000":
    <https://inc42.com/buzz/rbi-increases-wallet-limit-for-upi-lite-to-inr-5000>
