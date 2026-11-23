# Phase 09: the small test group

Merlin, 2026-11-23. 10 to 20 people try Mochi on their own phones and tell
us what they think, before the group of about 1000.

## What they get
The live app as it is (build 543 or whatever is live when the invites go
out). No new features until testing ends (SPEC.md, Decisions).

## How they send feedback
"Send feedback" in the sheet with her name (tap her name chip) opens a
short Tally form in a new tab. Shown to everyone once `FEEDBACK_FORM` in
`dist/app.js` holds the form's link; empty hides it. Everyone, not only
testers with a special link, because an iPhone's Home Screen copy keeps
its own storage, so a flag set from a link in Safari would be lost when a
tester adds her to the Home Screen.

The app adds to the link, as Tally hidden fields: `build` (number and
commit), `phone` (system and browser, from the browser's own description),
`screen` (size and sharpness), `home` (yes when opened from the Home
Screen), `room` (where she is at the tap). Nothing else. `privacy.html`
"Sending feedback" says the same; change both together.

## The form (Merlin makes it at tally.so, free account)
1. "What confused you, or where did you get stuck?" (long text)
2. "What made you smile?" (long text)
3. "Would you open her again tomorrow?" (Yes / Maybe / No)
4. "Anything else?" (long text, optional)
5. "Your name or email, if you'd like an answer" (short text, optional)
6. Hidden fields, named exactly: `build`, `phone`, `screen`, `home`, `room`
   (type `/hidden` in the editor).
Settings: email notification on each answer. Publish, copy the link
(`https://tally.so/r/XXXXXX`), give it to Claude.

## Invite message (Merlin sends it)
> Hi! I've made a little virtual kitten called Mochi and I'd love you to
> try her before more people do. Open this on your phone:
> https://jvtomax99.github.io/Cat-app/
> Play with her for a few days, however you like. Please don't ask me how
> anything works; finding out on your own is what I want to learn about.
> When something confuses you, delights you or breaks, tap her name at the
> top and then "Send feedback". Thank you!

## Done when
A tester opens the invite link on their phone, finds Send feedback within
a minute without help, sends it, and Merlin sees it in Tally with build
and phone type within a minute.

## Not in v1
Screenshots with feedback, crash reports, usage counting, replying inside
the app, a tester-only link.

## Also worth doing (not code)
Watch one or two testers play in person without helping; where they get
stuck is the most useful thing to learn, and it rarely shows up in a form.
Check the questions with Lettuce first.
