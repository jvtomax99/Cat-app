# App Store: what the wrapper app needs

Written 2026-11-14. Nothing here is built or bought. No Apple account
exists yet. Apple changes its pages: read them again before relying on a
quote. Rules: https://developer.apple.com/app-store/review/guidelines/

Order of risk, biggest first: rule 4.2, the name, offline inside a wrapper,
the licence gaps. The privacy page is done and is the smallest of them.

## 1. Not a repackaged website (rule 4.2): the one that can sink it
Apple: "Your app should include features, content, and UI that elevate it
beyond a repackaged website." A wrapper that only shows the web page is
the textbook rejection. What Mochi can add that only an app can do:
- A "she misses you" notification (local, set on the phone, no server).
  Needs the player's permission; ask after a good moment, not at launch.
- A buzz when she purrs (the phone's haptics; Safari on iPhone has none).
- The phone's own share sheet for photos and backup codes.
- Later: a home-screen widget with her mood. Strongest "this is an app"
  signal, also the most work.
Plan for at least the first two before submitting. Each one that sends
anything off the phone changes the privacy page first (see 4).

## 2. The name: "Pocket Kitten" is taken
Checked 2026-11-14 with Apple's store search (US): an app named exactly
"Pocket Kitten" is already listed (seller 雅雯 赵), and "Cute Pocket Cat
3D" sits next to it. Two apps cannot share a name on the store. Options:
a longer name ("Pocket Kitten: Mochi", "Mochi: Pocket Kitten"), or a new
one. Not checked: other countries' stores, trademarks. Merlin decides; the
logo is a Runway picture of the words, so a new name means a new logo.

## 3. Offline inside a wrapper: not confirmed
The offline copy (`sw.js`) is tested in a desktop browser only. Whether it
runs inside an iPhone wrapper has to be tried on an iPhone. The safer
route: ship the app's files inside the wrapper, so it opens with no signal
on the first launch and needs no offline copy at all. Then the save lives
in the wrapper's own storage: a player moving from the web app brings her
over with a backup code. Building a wrapper needs a Mac with Xcode (or a
paid cloud build service).

## 4. Privacy (rule 5.1.1): done on the preview
Apple: "All apps must include a link to their privacy policy in the App
Store Connect metadata field and within the app in an easily accessible
manner." It must say what is collected, how, every use, who it is shared
with, and how to ask for deletion.
- The page: `dist/privacy.html`, linked from the footer and the name card.
  Written from the code: the app asks only its own site for files, keeps
  everything on the phone, and sends something only when the player
  presses Share.
- Missing: a contact address (Merlin, 2026-11-14: a new address later).
  Until then the page stays on the preview. The listing also needs a
  support address, so one address can do both.
- The listing needs the page at a public address that stays put: the live
  site, so it needs a "Go live" first.
- The store's privacy questions: Apple counts data as collected when it is
  sent off the device and kept longer than answering the request needs;
  "Data that is processed only on device is not 'collected'". With the
  files inside the wrapper nothing is sent at all. Not confirmed: the
  exact answer wording Apple shows, and whether a web host's visitor
  records count while the app still loads from GitHub Pages
  (https://developer.apple.com/app-store/app-privacy-details/).
- No accounts, so the account-deletion rule (5.1.1 v) does not apply.

## 5. Children (rules 1.3 and 5.1.4)
Recommendation: do not join the Kids Category. Apple: once people expect
an app to follow its rules, "it will need to continue to meet these
guidelines ... even if you decide to deselect the category". Kids
Category apps "must not include links out of the app, purchasing
opportunities, or other distractions to kids unless reserved for a
designated area behind a parental gate". Take the 4+ age rating instead
and keep the app clean enough for children anyway: no ads, no visitor
counting, nothing to buy without a decision first. Mochi has three links
out today (Meshy, Creative Commons, the National Gallery, in the footer)
and one on the privacy page (GitHub); fine outside the Kids Category.

## 6. Money
- Apple Developer Program: $99 a year, open to individuals
  (https://developer.apple.com/programs/). As an individual the seller
  name shown on the store is the person's legal name.
- Free or paid: open in SPEC.md. Paid or in-app purchases mean Apple's
  payment system, tax forms and a bank account in the developer account.
  Free is the simplest first release.

## 7. Screenshots
Required today (checked 2026-11-14,
https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/):
- iPhone, one set: 1179 x 2556 or 1206 x 2622 (upright).
- iPad, only if the app runs on iPad: 2064 x 2752 or 2048 x 2732.
Up to 10 each, JPEG or PNG. They can be made here with the test browser at
those sizes (the photo button's picture without buttons is a good start).
Also needed: an icon at 1024 x 1024 with no transparency, a short
description, keywords, a support address.

## 8. Licences to settle before any store (see `CREDITS.md`)
- Mochi's model and the toys (Meshy): which plan made them. Free plan =
  CC BY 4.0, credit required (the footer has it; a store app needs the
  credit inside the app too). Paid plan = Merlin's to use.
- The film, its music, the logo and the icons (Runway): Merlin confirmed
  his plan allows a public site; check the same terms cover a store app,
  and keep the receipts.
- Two shelf paintings (`shelf-blue-pitcher.jpg`, `shelf-pears.jpg`):
  source unknown. Find it or replace them.
- App icons: source not recorded.
- Purrs (CC0), the de Heem painting (public domain), three.js (MIT): fine.

## 9. Before any of this
Phases 17, 17b, 18 and the camera fixes have not been tried on a real
phone. Apple's reviewers use real phones.
