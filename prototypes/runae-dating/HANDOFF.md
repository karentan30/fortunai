# Runae dating prototype — 2026-11-03

## Continue here

- `share.html`: personal share card, Gregorian day-master entry, public-profile editor, PNG/copy actions, private date-plan simulation.
- `pair.html`: proposed two-person relationship-result layout. Copy examples, NOT calculated compatibility.
- `index.html`: earlier full application prototype, including profile, report, voice/date and activities screens.
- Open these files locally in a browser; no build or external dependency is required.

## Product decisions

Start with a useful personal tool, then acquire users through voluntary sharing and one-to-one invitations. Beijing is the first matching city. Two entry points: create my personal card; invite an existing romantic interest to a private two-person reading. Recipients can participate once without joining a public dating pool. Join-matching consent must be separate from birth-data processing.

Personal card: explicit find-partner/find-activity-companion intent, optional real photo, age, height AND weight, school/education, employer/job/sector, income range, individual vs family assets, housing/car, zodiac/MBTI/day master, interests, concrete personal strengths and proposed date activities. User controls disclosure. Schools are not intelligence measurements. Self-reports must not look verified. Asset labels A8/A9 require a clearly defined currency/range and ownership/net-assets basis. Never treat parents' assets as the person's own.

Prominent optional preference: “我是戊土，想认识丁火的你。” This is a self-selected preference, not a computed universal recommendation. Closing CTA: “想找五行互补的搭子或对象？输入你的出生信息，查日主，生成你的交友卡。” Also offer inviting a known partner. Current poster must not contain a fabricated working QR code.

Latest visual decision: remove animal avatars from the poster. Real photos are optional and can be unlocked later. “旺夫命” was discussed as a self-selected cultural expression, not an assessed/verified benefit; it is not currently included. 身强/身弱 belongs in optional detailed explanations, not the main public card.

Two-person result: attraction, bilateral support, possible friction, practical conversation suggestions. Distinguish traditional chart interpretation from explicitly supplied real-world agreement on marriage/children, money, city and family boundaries. No scientific predictive claims, guaranteed wealth/marriage/fertility dates, or fabricated compatibility probability.

Meeting flow: both agree → optional 15-minute voice/video → activity rather than only coffee/dinner → shortlist up to five places based on BOTH travel times and budget → mutual confirmation → genuine merchant availability check. No automatic booking or fake confirmation. Nearby metro/business district is enough; exact home address is not required or shared.

## Existing repository integration located

- Repository: `karentan30/fortunai`; site: `https://runae.app`.
- `server/bazi.js`: existing engine; this prototype copies ONLY `getDayGanZhi` for local Gregorian day calculation. The existing engine contains simplified solar-term boundaries; validate astronomical boundaries/timezones/day-boundary conventions before relying on a full reading.
- `pages/hehun.html`: existing two-person reading, report UI, invite functions and image-sharing routines. This prototype does NOT modify these production files.
- Source includes `POST /api/invite/save`, invite IDs and browser-local fallback. Their production accessibility, authorization, cross-device behavior, raw-birth exposure and failure handling are NOT verified. Do not advertise private two-party access until server controls are audited.

## What is implemented / limitations

- Local JS/CSS source and poster screenshots; all example identities and financial/educational attributes are fictional.
- No real registration, matching pool, access-controlled bilateral invitation, full-chart matching, profile certification, route API, merchant inventory, payment or reservation integration.
- Local private-location demo keeps values in browser memory, cleared on refresh. It does not provide security boundaries between real users. Do not send this local file as a live invite.
- Free day-master entry uses Gregorian dates, not lunar conversion; chart time calibration/full four pillars are not implemented. Birth input is not stored. Completing the form updates the sample card but does not create an account.
- Public-field editing currently confirms ALL entered fields as public; granular visibility controls remain to implement. Adult consent is present; actual backend age verification is absent.
- Age was requested and remains to add as an explicit editable/public field in `share.html`; current defaults do not include a profile-age field. Do not compute/publicize age without user's choice.
- Profile image upload and photo privacy controls remain to implement.
- Exported PNG uses a simplified canvas layout, while desktop poster screenshot reflects the HTML layout. Long content may overflow/truncate in export: unify both renderers and test edge cases.
- Desired day-master entry currently accepts free text; replace with validated multi-select/optional ten-stem selector. Test all dates, midnight cases and source-engine agreement against an independent trusted calendar.
- Public card still contains demo-only UI and sample labels. Keep them until real user consent, data storage and access rules work.
- Source snapshot excludes local browser profiles, logs, original portraits, secrets and real personal/birth/address data. Legacy avatar references in this repository snapshot use a generic SVG placeholder, not a person's image. Latest poster hides avatars.

## Pricing / growth decisions still pending

Free basic day master; optional 199 full cultural report was discussed. 99.9 tier content and monthly/per-person matchmaking pricing are NOT finalized. No purchasing in this demo. Remove internal pricing notes from any actual public release.

Growth test: see how many complete a card, voluntarily share, invite another person, accept an invitation, and agree to a short call. Start with known consenting singles or a real creator trial. No fake claims that elite/high-net-worth users already use the product. Do not import profiles from dating groups/platforms without permission. Review acquisition-platform policies before promotion.

## Suggested next session

1. Confirm poster wording and add age, photo upload, granular disclosure and asset-label definitions.
2. Audit existing invitation backend in `server/index.js` and existing hehun UI. Design isolated two-party records, explicit consent and revocable/unpredictable tokens. URLs must never embed raw birth data or home locations.
3. Verify day-master/full-chart calendar math and edge cases. Reuse checked existing functionality instead of introducing a second competing engine.
4. Wire real one-to-one invitation and report retrieval with truthful loading/error states; integrate chart-backed result copy.
5. Only then run a small Beijing invite/share pilot and measure real completion and two-sided interest.

## Validation performed

`node --check app.js` and `node --check share.js` passed. Desktop screenshots were reviewed in Edge; no browser-driven end-to-end form, multi-device invite, privacy/security or production payment tests were run. Saving this branch does not deploy the prototype.
