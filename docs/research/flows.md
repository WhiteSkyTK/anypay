# Screens and user flows (as built)

What the app does today, screen by screen, for the "information architecture" and "user flows"
items in the research track. They describe the product, not users: pain points and emotions per
step come from the interviews and usability tests ([interview-guide.md](interview-guide.md),
[usability-test.md](usability-test.md)). The system architecture and the Open Payments sequence
diagrams are in the [README](../../README.md#how-it-works).

## Screen map

Three kinds of screen: the start page; the shop's screens, with a tab bar (Shop · Tab ·
Settings); and focused screens opened from a QR code or link, with no tab bar so nothing
distracts from paying.

```mermaid
flowchart TB
  start["Start page /"]
  privacy["Privacy /privacy"]

  subgraph shop["The shop's phone"]
    setup["Set up your shop /merchant/new"]
    poster["QR poster /merchant/poster"]
    feed["Shop: live feed /merchant"]
    tabsale["Tab sale /merchant/tab-sale"]
    receive["Tab payment (voucher scanned) /v/…"]
    settings["Settings /settings"]
    phones["Your shop on other phones /merchant/phones"]
    connect["Sign-in link /merchant/connect"]
  end

  subgraph customer["The customer's phone"]
    paystart["Pay a shop /pay"]
    scan["Scan a QR code /scan"]
    pay["Pay screen /shop/CODE/pay"]
    receipt["Receipt /receipt/ID"]
    opentab["Open a tab /shop/CODE/tab"]
    mytabs["My tabs /tab"]
    tabdetail["One tab /tab/ID"]
    approve["Pay with your tab /t/…"]
  end

  start --> setup --> poster --> feed
  start --> paystart
  start --> privacy
  feed --> tabsale
  feed --> poster
  feed --> settings --> phones
  settings --> privacy
  phones -. "QR scanned by another phone" .-> connect --> feed
  paystart --> scan
  paystart --> pay
  scan --> pay
  poster -. "QR on the wall: /s/CODE" .-> pay
  pay --> receipt
  pay --> opentab --> tabdetail
  mytabs --> tabdetail --> approve
  tabsale -. "sale QR" .-> approve
  approve -. "voucher QR" .-> receive
```

## Feature 1: setting up a shop (under two minutes)

```mermaid
flowchart LR
  a["Start page: Set up my shop"] --> b["Type the wallet name<br/>(the part after the slash)"]
  b --> c{"Wallet found?"}
  c -- "No: says why<br/>(typo, other provider, no signal)" --> b
  c -- "Yes: shows its currency" --> d["Type the shop name"]
  d --> e["Shop created<br/>(sign-in kept on this phone)"]
  e --> f["A5 poster: print or show"]
  f --> g["Go to my shop: live feed"]
```

## Feature 2: paying a shop online

```mermaid
flowchart LR
  a["Scan the poster<br/>(phone camera or in-app)"] --> b["Pay screen: shop name"]
  b --> c["Amount on the keypad<br/>+ own wallet name (remembered)"]
  c --> d["Price sheet: exactly what leaves<br/>your wallet, fees and exchange included"]
  d -- "Cancel" --> c
  d -- "Approve in my wallet" --> e["Customer's own wallet:<br/>approve or decline"]
  e -- "Declined" --> f["Receipt: not paid, why,<br/>Pay again"]
  e -- "Approved" --> g["Receipt: Sending…"]
  g --> h["Receipt: Paid ✓<br/>shop hears 'Payment received'"]
  b -. "no signal" .-> i["Says paying needs signal;<br/>suggests a tab"]
```

## Feature 3: the shop's live feed

```mermaid
flowchart LR
  a["Open the app"] --> b["Today's feed at once<br/>(from this phone)"]
  b --> c["Live: each payment appears<br/>and is spoken"]
  c --> d["Taken today: total"]
  c --> e["Export CSV for the bookkeeper"]
  b -. "no signal / server asleep" .-> f["Not connected: keeps trying,<br/>catches up when back"]
  f --> c
```

## Feature 4: the Offline Digital Tab

Once, with signal, the customer opens a tab and approves a weekly limit in their own wallet.
After that, a sale needs no signal on either phone.

```mermaid
flowchart TB
  subgraph once["Once, online (customer)"]
    o1["Pay screen: Open a tab at this shop"] --> o2["Wallet name, your name for the shop,<br/>weekly limit"]
    o2 --> o3["Approve the limit in your own wallet"]
    o3 --> o4["Tab ready: left this week<br/>(device key stays on this phone)"]
  end
  subgraph sale["Every sale, offline is fine"]
    s1["Shop: Tab sale → amount → sale QR"] --> s2["Customer scans it: shop and amount"]
    s2 --> s3{"Within this week's limit?"}
    s3 -- "No" --> s4["Refused: over the limit"]
    s3 -- "Yes: Approve" --> s5["Customer's phone signs a voucher QR"]
    s5 --> s6["Shop scans it:<br/>Saved – settles when online"]
  end
  subgraph settle["When either phone has signal"]
    t1["Voucher sent (both phones may send it)"] --> t2["Server checks the signature,<br/>age and limit, once per voucher"]
    t2 --> t3["Paid with the tab's grant:<br/>Settled on both phones, spoken in the feed"]
    t2 -- "expired / over limit / grant refused" --> t4["Failed, with the reason"]
  end
  once --> sale --> settle
```
