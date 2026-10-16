# Interviewing spaza owners: a guide for the team

For the research track in [ROADMAP.md](../../ROADMAP.md): 3–5 owners, about 20 minutes each,
with consent. The questions come from the open questions in
[desk-research.md](desk-research.md). Write up each interview with the template at the end, in
`docs/research/interviews/` (one file per owner, no names: "Owner A, Khayelitsha").

## Before you go

- Two people: one asks, one writes. Bring the printed AnyPay poster and a phone with the app.
- Go at a quiet time (mid-morning, not month-end or lunch). Buy something; it's their business.
- Offer the conversation in the owner's language. If none of you speaks it, bring someone who
  does, and note which language the interview was in.
- Don't record audio unless the owner agrees to that separately.

## Consent (read it out, in the owner's language)

> We're students building a free phone app to help spaza shops take digital payments, for a
> competition. We'd like to ask you some questions about how you get paid, for about 20 minutes.
> We won't write down your name or your shop's name, and we won't take photos of you, your shop
> or your customers unless you say yes. You can skip any question or stop at any time. What you
> tell us goes into our project notes and presentation, without your name. Is that OK?

Note "consent: yes" (and whether photos or quotes were allowed) at the top of the write-up. If the
answer is no, thank them and leave: write nothing down.

POPIA: don't collect what you don't need. No ID numbers, phone numbers or exact addresses; the
area is enough.

## The questions

Ask openly ("tell me about…"), then follow up. Don't pitch AnyPay until the last section.

**The shop**

1. How long have you had the shop? Who works in it? What are your busiest times?
2. What do people buy most, and what is a typical amount?

**Getting paid today**

3. How do customers pay you? Roughly how much is cash?
4. Have you used a card machine, SnapScan, Zapper, PayShap or similar? What did it cost? Why did
   you start, or stop?
5. What worries you about cash? (Let them raise safety; don't lead.)

**Credit for regulars ("the book")**

6. Do you let some customers pay later? Who, how much, and for how long?
7. How do you keep track? What happens when someone doesn't pay?
8. If a customer could set their own weekly limit in a payment app, and you could sell to them up
   to it even with no signal, would that help or worry you?

**Signal, power and data**

9. How often is there no signal or no power here? For how long?
10. How do you buy data? How much a month, roughly? What do you use it for?

**Trust**

11. When someone pays digitally, how do you know the money really came? What would make you sure?
12. Has anyone ever shown you a fake payment message?

**Show AnyPay (last)**

13. Show the poster and make a test payment on your phone while the owner watches theirs. What
    did they notice first? What confused them? Did the spoken "Payment received" help?
14. Which language should the phone speak in this shop?
15. Anything you would want it to do that it doesn't?

## What we think, and which question tests it

These are our assumptions. Interviews confirm or overturn them; write down which.

| Assumption                                                               | Questions  |
| ------------------------------------------------------------------------ | ---------- |
| Card fees and device cost put owners off digital payments                | 4          |
| Many shops give credit, and unpaid credit is a real loss                 | 6, 7       |
| A customer-set weekly cap makes credit safer for both sides              | 8          |
| No signal is common enough that offline sales matter                     | 9          |
| Owners trust a spoken confirmation and a live list more than an SMS      | 11, 12, 13 |
| Data cost makes a heavy app unacceptable                                 | 10         |
| Owners would rather the phone speak isiZulu/isiXhosa/Sepedi than English | 14         |

## Write-up template

Copy into `docs/research/interviews/owner-a.md`:

```markdown
# Owner A, <area>, <date>

- Consent: yes (quotes: yes/no, photos: yes/no). Language: <language>
- Shop: <years open, people, busy times, typical sale>

## What we heard

- Paying today: …
- Cost of card/QR (if any): …
- Credit book: …
- Signal and power: …
- Data: …
- Trust: …
- Reaction to AnyPay: …

## Quotes (only if allowed, in their words)

> …

## Assumptions

- Confirmed: …
- Overturned: …
- Surprises: …

## What we'll change in AnyPay because of this

- … (also log it in docs/decisions.md)
```

Afterwards, update the assumptions table above and the open questions in
[desk-research.md](desk-research.md), and add slide-ready quotes to `docs/slides.md`.
