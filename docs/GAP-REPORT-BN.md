# IDEEZA Manufacturing — ফাঁক ও অসঙ্গতির রিপোর্ট

তারিখ: ২৭ আগস্ট ২০২৬ · শাখা: `feature/two-panel-platform`

এই রিপোর্ট তিনটি জিনিস পাশাপাশি রেখে তৈরি: **Figma ফাইল দুটি** (Buyer V3 এবং
Manufacturer V3), **ব্যবসায়িক নিয়মের দলিল** (`docs/DOMAIN.md`,
`docs/USER-JOURNEY.md` — PDF থেকে নেওয়া মডেল), আর **যা আসলে তৈরি হয়েছে**
(দুই panel, ১৪+১৫ ধাপ, ৮৩৫ unit/database টেস্ট, ২৯১ browser check)।

উদ্দেশ্য দোষ খোঁজা নয় — কোন জায়গায় ডিজাইন, ব্যবসায়িক নিয়ম আর বাস্তব জগৎ একে
অন্যের সাথে মেলে না, সেটা লিখে রাখা, যাতে সিদ্ধান্তগুলো সচেতনভাবে নেওয়া যায়।

---

## এক নজরে

| শ্রেণি | সংখ্যা | কেন গুরুত্বপূর্ণ |
| --- | --- | --- |
| ১. ব্যবসায়িক সিদ্ধান্ত এখনো নেওয়া হয়নি | ৮ | কোড লেখা যাচ্ছে না — মান বসানো মানে ব্যবসার হয়ে সিদ্ধান্ত নেওয়া |
| ২. Figma ডিজাইন ব্যবসায়িক নিয়মের সাথে মেলে না | ৩৮ | layout রাখা হয়েছে, data সংশোধন করা হয়েছে — client যদি হুবহু ডিজাইন চায়, আলোচনা দরকার |
| ৩. Platform-এ যে অংশ এখনো নেই | ১১ | পর্দা আছে, পেছনের টেবিল/সেবা নেই — লেবেল দিয়ে সৎভাবে বলা আছে |
| ৪. বাস্তবে চালু করলে যা ভাঙবে | ৭ | টাকা, আইন আর দায়িত্ব সংক্রান্ত — এগুলো ছাড়া লাইভ করা যাবে না |
| ৫. আজ ঠিক করা হয়েছে | ৫ | নিচে ধাপ ৫-এ তালিকা |

---

## ১. ব্যবসায়িক সিদ্ধান্ত এখনো নেওয়া হয়নি (৮টি)

এগুলো ব্যবসায়িক দলিলে সংজ্ঞায়িত নয়। প্রতিটির জন্য ডেটাবেজে ঘর আছে, কিন্তু
কোনো ডিফল্ট মান বসানো হয়নি — কারণ এখানে একটা সংখ্যা বসানো মানে ব্যবসার হয়ে
সিদ্ধান্ত নিয়ে ফেলা।

| # | বিষয় | এখন কী আছে | কেন সমস্যা |
| --- | --- | --- | --- |
| ১.১ | **Platform fee** — কত, কে দেয় | `Payment.platformFee` ঘরটি আছে, হার নেই | payout-এর নিট টাকা এই হারের ওপর নির্ভর করে। হার ছাড়া manufacturer-কে "তুমি কত পাবে" বলা যাচ্ছে না, অথচ quote দেওয়ার সময় সেটাই সে জানতে চায় |
| ১.২ | **Review window** কত দিন | `reviewWindowEndsAt` আছে; কোডে `REVIEW_WINDOW_DAYS = 7` platform সেটিং হিসেবে | ৭ দিন আমার বসানো সংখ্যা, ব্যবসার নয়। এই সময়ই ঠিক করে কখন টাকা ছাড়া হবে — অর্থাৎ manufacturer কত দিন পর টাকা পাবে |
| ১.৩ | **Tax ও merchant-of-record** | `Payment.taxAmount` ঘর আছে, কোনো নিয়ম নেই | কে invoice দেবে, কোন দেশের VAT/GST প্রযোজ্য — এটা আইনি প্রশ্ন। ডিজাইনে "Tax 8.75%" লেখা ছিল, সেটা কোন দেশের কেউ জানে না |
| ১.৪ | **স্তরভিত্তিক cancellation নীতি ও জরিমানা** | order-এর অবস্থা অনুযায়ী cancel-এর অধিকার আছে, কিন্তু কোনো জরিমানা/ফি নেই | production অর্ধেক হয়ে গেলে বাতিল হলে material-এর খরচ কে দেয়? এখন উত্তর নেই, তাই dispute-এ গিয়ে দাঁড়াবে |
| ১.৫ | **Manufacturer-এর refund জবাব দেওয়ার সময়সীমা** | claim খোলা যায়, জবাবের সময়সীমা নেই | শপ চুপ করে থাকলে ক্রেতার টাকা অনির্দিষ্টকাল আটকে থাকবে |
| ১.৬ | **Crypto/token payment** escrow, refund, dispute-এ কীভাবে চলবে | কিছুই নেই | Figma-র settings-এ "$IDZ pay" আছে, অর্থাৎ ব্যবসার পরিকল্পনায় আছে; নিয়ম নেই বলে বানানো হয়নি |
| ১.৭ | **প্রতিদ্বন্দ্বী শপগুলোর মধ্যে quote গোপনীয়তা** | কোডে জোর করে আলাদা রাখা হয়েছে (`access.ts`) | ধরে নেওয়া হয়েছে গোপন — ব্যবসা নিশ্চিত করলে ভালো, কারণ এর ওপর comparison স্ক্রিনের নকশা নির্ভর করে |
| ১.৮ | **ডিজাইন ফাইল / IP সুরক্ষা** একাধিক শপের মধ্যে | একটি request ১০টি শপে যায়, প্রত্যেকে ফাইলের হ্যাশ ও স্পেসিফিকেশন দেখে | ক্রেতার গোপন ডিজাইন ১০ জন প্রতিযোগীর হাতে যাচ্ছে। NDA/watermark/সীমিত প্রকাশ — কোনো নিয়ম নেই |

**কেন এই আটটাই সবচেয়ে জরুরি:** বাকি সব ফাঁক প্রকৌশলের কাজ। এই আটটা ব্যবসার
সিদ্ধান্ত — সিদ্ধান্ত না এলে কোড লিখলে সেটা অনুমানের ওপর দাঁড়াবে, আর টাকা ও
আইন নিয়ে অনুমান পরে বদলানো সবচেয়ে ব্যয়বহুল।

---

## ২. Figma ডিজাইন ব্যবসায়িক নিয়মের সাথে মেলে না (৩৮টি)

নিয়ম ছিল: **layout ১০০% Figma থেকে, data মডেল থেকে**, আর প্রতিটি বিচ্যুতি লিখে
রাখা। নিচে সেই তালিকা — এগুলো ইতিমধ্যেই সংশোধিত অবস্থায় তৈরি, কিন্তু client
যদি হুবহু ডিজাইন ফেরত চায় তবে প্রতিটির জন্য আলোচনা দরকার।

### ২ক. ডিজাইনের ভেতরেই ভুল/অসঙ্গত ডেটা (৯টি)

| # | কোথায় | ডিজাইনে কী | কেন সমস্যা |
| --- | --- | --- | --- |
| ২ক.১ | Manufacturer → quote form | "$12 × 20 Units = $220" | সাধারণ গুণই ভুল (হবে $240)। শপ এই সংখ্যা দেখে দাম দিলে ভুল দাম যাবে |
| ২ক.২ | Manufacturer → specification tab | "PCB Qty: HASL", "Different Design: ENIG", "PCB Thickness: 8:1" | মান আর ঘর মিলছে না — HASL একটি ফিনিশ, পরিমাণ নয়। এভাবে দেখালে শপ ভুল বুঝে quote দেবে |
| ২ক.৩ | Manufacturer → specification tab | অন্য একটি fabricator-এর লোগো/নাম দেখানো | IDEEZA-র প্ল্যাটফর্মে প্রতিযোগীর ব্র্যান্ড দেখানো যাবে না |
| ২ক.৪ | Buyer → তিনটি স্ট্রিং | "Bear board", "Parts Scouring", "Meets Board Spece" | বানান ভুল ("Bare board", "Sourcing", "Spec") — শিল্পের পরিভাষা ভুল হলে বিশ্বাসযোগ্যতা নষ্ট হয় |
| ২ক.৫ | Buyer → production timeline | চিহ্নগুলো ৫টার পর ৭, ৮ | ধারাবাহিকতা ভাঙা; ক্রেতা ভাববে একটা ধাপ হারিয়ে গেছে |
| ২ক.৬ | Manufacturer → orders তালিকা | শিরোনাম "Quotes", আর গণনাগুলোও quote-এর | order-এর পর্দায় quote-এর সংখ্যা — শপ ভুল সিদ্ধান্ত নেবে |
| ২ক.৭ | Manufacturer → inventory rail | কোথাও "Transactions", কোথাও "Payouts & Earnings" | একই জায়গার দুই নাম |
| ২ক.৮ | Buyer → order detail | তৃতীয় ট্যাব একবার "Production Progress", একবার "Production Activity" | দুই নামে দুই ট্যাব বানালে একই ঘটনা দুবার দেখাত |
| ২ক.৯ | Manufacturer → dashboard | "On-time delivery 98%" স্থির লেখা | কোনো order না থাকলেও ৯৮% দেখাত — এটা মিথ্যা সুনাম |

### ২খ. ডিজাইন যেখানে ব্যবসায়িক নিয়ম ভাঙে (১১টি)

| # | কোথায় | ডিজাইনে কী | কেন সমস্যা |
| --- | --- | --- | --- |
| ২খ.১ | Buyer → order row menu | প্রতিটি order-এ "Cancel Order" | নিয়ম: টাকা আটকে থাকা order শুধু IDEEZA বাতিল করতে পারে। বোতামটা থাকলে ক্রেতা ভাববে সে পারে |
| ২খ.২ | Manufacturer → order | শপের জন্য "Cancel order" | শপ কখনোই বাতিল করতে পারে না — যে পক্ষ কাজ ধরে রেখেছে সে বাতিল করলে ক্রেতা মাল ও টাকা দুটোই হারায় |
| ২খ.৩ | Manufacturer → dispute | শপের জন্য "Resolve dispute" | নিজের মামলা নিজে নিষ্পত্তি করা মানে escrow-র অর্থ হারানো |
| ২খ.৪ | Buyer → message-এর ভেতর quote card | "Accept / Reject / Request Revise" | quote গ্রহণ মানেই order খোলা — invariant ও নিশ্চিতকরণ লাগে। চ্যাটের বুদবুদে এটা রাখা বিপজ্জনক |
| ২খ.৫ | Buyer → production timeline | ৮টি ধাপ | অনুমোদিত মডেলে ১০টি canonical ধাপ। কম দেখালে দুই পক্ষ ভিন্ন ধাপ গুনবে |
| ২খ.৬ | Buyer → checkout | "Build Time — 2 days / 24 hours" রেডিও | lead time গৃহীত quote-এর অংশ, জমে যাওয়া (immutable) — checkout-এ বদলানো যাবে না |
| ২খ.৭ | Buyer → draft | প্রতিটি আইটেমে আলাদা "Assembly" টগল ও "Edit Specification" | এক package = এক production run = একটি স্পেসিফিকেশন। আলাদা হলে dispute-এ কোন দলিল প্রযোজ্য বোঝা যাবে না |
| ২খ.৮ | Manufacturer → BOM | "Proceed to Proposal" | "proposal" পরিত্যক্ত পরিভাষা; আর এই বোতাম আসলে শুধু সাজেশন সেভ করে |
| ২খ.৯ | Manufacturer → quote list | "Pending" / "Rejected" | ৫টা quote-এর একটা বেছে নেওয়া মানে বাকি ৪টি শপ "প্রত্যাখ্যাত" নয় |
| ২খ.১০ | Buyer → history | প্রতিটি সারিতে "Delivered" | বাতিল, refund, dispute-এ নিষ্পত্তি — সব একই লেখা দেখাত |
| ২খ.১১ | Buyer → refund modal | "Amount $50" মুক্ত ঘর | দাবি কখনো প্রদত্ত অর্থের বেশি হতে পারে না |

### ২গ. ডিজাইনে যে ডেটা প্ল্যাটফর্মে নেই (১৮টি — সংক্ষেপে)

এগুলোর জন্য ডিজাইনে ঘর আছে, কিন্তু প্ল্যাটফর্মে সেই তথ্যই রাখা হয় না। বানিয়ে
দেখানো যেত, কিন্তু সেটা কল্পনা — আর quote/dispute এই তথ্যের ওপর দাঁড়ায়।

- **ক্রেতার প্রোফাইলে** job title, skill list, project count (freelancing-এর ধাঁচ) — ক্রেতার হিসাব বদলে দেওয়া হয়েছে: কতটা request, কত order সম্পন্ন, এই শপের সাথে কত
- **Manufacturer card-এ** "≤ ১২ layer", "৪ mil trace", "৫০ Ω", "ENIG" ইত্যাদি সক্ষমতা — কেউ প্রকাশ করেনি, তাই তুলনাটা কল্পনা হয়ে যেত
- **Substitute part-এর hover card-এ** datasheet, EasyEDA footprint, ECCN, প্রতিযোগীর part number — parts-catalogue integration নেই
- **তুলনা টেবিলে** packaging, NDA, engineering support, monthly capacity — কোনো ডেটা নেই
- **3D আইটেমে** volume, surface area, build time — এগুলো slicer-এর ফল, ক্রেতার ইনপুট নয়
- **PCB spec modal-এ** ~৩০টি fabrication-house ঘর (Gerber, stackup, gold fingers, JLCPCB packaging) — এই প্ল্যাটফর্ম যেটুকু রাখে তা-ই দেখানো হয়েছে
- **Draft row-এ** "Cost" — quote-এর আগে যেকোনো সংখ্যা অনুমান
- **Dashboard-এ** "+12% vs last month" — মাসিক প্রবণতা কোথাও মাপা হয় না
- **Profile-এ** follower count, profile view count — মাপা হয় না
- **Attachment/upload বোতাম** (৬ জায়গায়: message, refund, dispute, inventory part, blog, evidence) — ফাইলের bytes রাখার সেবা নেই
- **"Unit Type"** inventory-তে — সব হিসাব parts-এর সংখ্যায়, নইলে BOM মেলানো ভাঙবে
- **Notification-এর লেখা** "Proposal Rejected", "Offer Accepted" — freelancing marketplace-এর ভাষা
- **"All Private Messages" + "নতুন কথা শুরু" বোতাম** — এখানে প্রতিটি thread কোনো request/quote/order/dispute নিয়ে, শূন্য থেকে শুরু করার কিছু নেই
- **Blog-এ** thumbnail upload, rich text — টেবিলই নেই
- **Settings-এ** security question, two-step, session list — auth প্যাকেজে নেই
- **Settings-এ** "$IDZ pay" — এমন মুদ্রা প্ল্যাটফর্মে নেই
- **Equipment ও per-process parameter sheet** (৫১টি profile frame-এর একটি বড় অংশ) — টেবিল নেই
- **Language/region preference** — টেবিল নেই

---

## ৩. Platform-এ যে অংশ এখনো নেই (১১টি)

| # | কী নেই | ফলে কী হয় | এখন পর্দায় কী বলা আছে |
| --- | --- | --- | --- |
| ৩.১ | **ফাইল স্টোরেজ (bytes)** | ফাইলের নাম, revision, hash আছে; আসল ফাইল ডাউনলোড/দেখা যায় না | "contents are not served here" — hash দিয়ে মেলানোর কথা বলা আছে |
| ৩.২ | **Ops / admin panel** | dispute নিষ্পত্তি, cancellation মঞ্জুর, payout ছাড়, blog অনুমোদন — কেউ করতে পারে না | দুই panel সঠিকভাবে "IDEEZA সিদ্ধান্ত নেবে" বলে, কিন্তু IDEEZA-র পর্দা নেই |
| ৩.৩ | **Payment provider (PSP)** | কার্ড চার্জ হয় না; `Payment` রেকর্ড হয়, escrow-র হিসাব চলে | "নথিভুক্ত হচ্ছে, provider deployment-এ যুক্ত হবে" |
| ৩.৪ | **Bank rail / withdrawal** | শপ টাকা তুলতে পারবে না | "No bank rail in this build" |
| ৩.5 | **Courier integration** | tracking নম্বর evidence হিসেবে লেখা হয়, courier API নেই | shipment রেকর্ড হিসেবে দেখানো হয় |
| ৩.৬ | **KYC ও tax verification** | verified দেখানো হয় না, কিছু faked নেই | "no provider connected, no document upload" |
| ৩.৭ | **Equipment + per-process capability টেবিল** | buyer-এর fit verdict এই তথ্য ছাড়াই হিসাব হয় | "laid out, not yet stored" |
| ৩.৮ | **Blog টেবিল** | লেখা reload-এ হারায় | পর্দায় স্পষ্ট বলা আছে |
| ৩.৯ | **Preferences (language/region/notification switch)** | সেটিং সেভ হয় না | prototype হিসেবে চিহ্নিত |
| ৩.১০ | **Security (password change, 2FA, session)** | auth-এ email+password ছাড়া কিছু নেই | পর্দায় বলা আছে |
| ৩.১১ | **Parts catalogue integration** | substitute বাছাই শুধু শপের নিজের inventory থেকে | hover card-এর বাইরের তথ্য বাদ |

---

## ৪. বাস্তবে চালু করলে যা ভাঙবে (৭টি)

এগুলো "feature নেই" নয় — এগুলো **ব্যবসা চালাতে গেলে আটকে যাবে**।

| # | সমস্যা | কেন ভাঙবে |
| --- | --- | --- |
| ৪.১ | **escrow-র টাকা ছাড়ার কেউ নেই** | delivery নিশ্চিত হলে বা review window শেষ হলে payout ছাড়ে — কিন্তু dispute হলে সিদ্ধান্ত নেওয়ার পর্দা (ops) নেই। অর্থাৎ একটি বিতর্ক মানেই টাকা অনির্দিষ্টকাল আটকে |
| ৪.২ | **ফাইলের bytes ছাড়া উৎপাদন অসম্ভব** | শপ Gerber/STEP ফাইল না পেলে বোর্ড বানাতে পারবে না। এখন শুধু hash আছে — অর্থাৎ আসল কাজ শুরুই করা যাবে না |
| ৪.৩ | **KYC ছাড়া payout আইনত ঝুঁকিপূর্ণ** | টাকা পাঠানোর আগে গ্রহীতা যাচাই বাধ্যতামূলক (অনেক দেশে)। এখন কোনো যাচাই নেই |
| ৪.৪ | **Invoice/tax দলিল নেই** | B2B ক্রেতা VAT invoice চাইবে; কে issuer সেটাও ঠিক হয়নি (১.৩) |
| ৪.৫ | **ডিজাইন ফাইল ১০ প্রতিযোগীর কাছে যায়, NDA নেই** | ক্রেতা তার পণ্যের ডিজাইন হারানোর ভয়ে request পাঠাবে না। এটি সরাসরি ব্যবসায়িক ঝুঁকি |
| ৪.৬ | **শপের নীরবতার কোনো শাস্তি/সময়সীমা নেই** | refund claim-এ জবাব না দিলে, বা production আটকে রাখলে — কোনো স্বয়ংক্রিয় ব্যবস্থা নেই |
| ৪.৭ | **Notification শুধু in-app** | email/SMS নেই। শপ panel না খুললে request-এর deadline চলে যাবে, ক্রেতা quote পড়বে না |

---

## ৫. আজ যা ঠিক করা হয়েছে (৫টি)

| # | কী ছিল | কী করা হলো |
| --- | --- | --- |
| ৫.১ | Deploy-এ install ব্যর্থ: pnpm-এর `allowBuilds` তালিকায় শুধু Windows-এর embedded-postgres ছিল | সব platform (Linux সহ) যোগ করা হলো — এখন Linux/CI/Mac-এ install চলবে। এটাই Vercel build ভাঙার আসল কারণ ছিল |
| ৫.২ | Prisma-র Linux query engine তৈরি হচ্ছিল না | `binaryTargets`-এ `rhel-openssl-3.0.x` — নইলে deploy-এ প্রতিটি পেজ runtime-এ ভাঙত |
| ৫.৩ | Quote পর্দায় "Open the order" একটি **মৃত বোতাম** ছিল, আর tooltip বলত "orders stage পরে আসবে" (অথচ M08 শেষ) | আসল order-এ লিংক করা হলো |
| ৫.৪ | Navbar-এর ঘণ্টা (bell) disabled, কিন্তু গণনা দেখাত; manufacturer-এর notifications পর্দা ছিল না | পুরো notifications পর্দা তৈরি (All/Unread, mark read, deep link), fixture ও ৩টি browser check সহ |
| ৫.৫ | তিনটি জায়গায় অচল কোড ও বাসি বাক্য ("Inventory arrives with the inventory stage") | সরানো হলো — ওই ধাপগুলো অনেক আগেই শেষ |

---

## অগ্রাধিকার — আমার প্রস্তাব

**P0 (ব্যবসার সিদ্ধান্ত, কোডের আগে):** ১.১ platform fee · ১.২ review window ·
১.৩ tax/invoice দায়িত্ব · ১.৮ ডিজাইন IP সুরক্ষা।
এই চারটি ছাড়া প্ল্যাটফর্ম টাকা ও দলিল নিয়ে সঠিকভাবে চলতে পারে না।

**P1 (প্রকৌশল, সবচেয়ে বড় ফাঁক):** ৩.২ ops panel · ৩.১ ফাইল স্টোরেজ ·
৪.৭ email notification।
ops panel ছাড়া বিতর্ক-refund-payout কোনোটাই শেষ হয় না; ফাইল ছাড়া উৎপাদন হয় না।

**P2 (logic pass):** ৩.৭ equipment/capability (buyer-এর fit হিসাবে যায়) ·
৩.৬ KYC · ৩.৪ withdrawal · ৩.৯ preferences · ৩.১০ security · ৩.৮ blog।

**P3 (সিদ্ধান্তসাপেক্ষ):** ১.৪ cancellation জরিমানা · ১.৫ শপের জবাবের সময়সীমা ·
১.৬ crypto payment · ৩.১১ parts catalogue।
