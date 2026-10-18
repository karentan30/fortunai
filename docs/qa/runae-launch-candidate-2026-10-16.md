# Runae English site launch candidate — 2026-10-16

## Scope

English Runae acquisition flow, reading selection, membership, pricing, About, privacy, and refund pages, plus a production Vision model configuration repair discovered during live QA.

## Design and experience changes

- Unified membership with the dark jade and warm gold style used by the English home, selection, and reading pages.
- Unified the About page with that visual system and added the root `favicon.ico` fallback requested by browsers.
- Added an English pricing page using the same product keys as the checkout catalog. Fixed the English home footer link.
- Preserved a reading chosen from a home or pricing card through profile collection and into the selector; the primary selector button now starts that reading.
- Removed face and palm photo inputs from the general profile form. The chosen reading now requests its photo at the reading step and explains temporary browser-tab storage.
- Added an 18+ self-confirmation before profile submission and a separate age/ownership gate before face-photo upload.
- Changed face and palm payment-return photo copies from persistent `localStorage` to tab-scoped `sessionStorage`; the copy is cleared when restored after checkout or when the user resets the reading.
- Reconciled English refund and operator details with the existing legal page; removed obsolete ritual-service and unsubstantiated donation/team claims from the English pages.
- Replaced unsupported membership claims with the entitlements described in the product catalog and aligned the yearly billing text with recurring billing.

## Verification

- `node --test server/lib/displayed-price-matches-catalog.test.js`: **4/4 passed**, including six new English pricing-page SKU checks.
- `git diff --check`: passed.
- `favicon.ico` verified as a valid 32×32, 32-bit Windows icon resource.
- JavaScript parse checks passed for the ten edited or added English/flow pages.
- Browser flow on the local candidate: English Face Reading card → profile → age checkbox → selector with Face Reading retained → face report → 18+ photo gate.
- No horizontal overflow found at 320 px on profile collection, or at 390 px on home, reading selection, pricing, and membership pages.
- The local static preview returns 501 for `/api/ev` and other backend calls because it serves files only; these errors do not verify production API behavior.

## Release status

The English candidate pages and root favicon were deployed to production on 2026-10-16. Their previous versions were backed up under `/opt/shenyuan/.deploy-backups/runae-20261016/`.

Post-deploy checks against the production server returned HTTP 200 for `/`, all updated English pages, `/favicon.ico`, and `/api/health`. The live homepage and pricing page were opened in Chrome; the pricing page rendered the new products and membership prices. The API health response reported `status: ok` and Stripe `connected`.

Live image QA exposed that the server's Vision model setting (`qwen-vl-plus`) was no longer available in the configured DashScope catalog; Qwen returned HTTP 404 `model_not_found`. The server now uses the available `qwen3-vl-plus` model. Updated code and environment were backed up under `/opt/shenyuan/.deploy-backups/runae-vision-20261016/`, and PM2 restarted successfully. The active text-provider chain is **Qwen → DeepSeek**; users access it through server-side calls and do not need their own API keys.

The complete backend test suite passed **162/162** after the Vision fix. The targeted pricing test passed **4/4**. `node --check server/lib/vision.js` and `git diff --check` passed.

Production health returns HTTP 200, `status: ok`, and Stripe `connected`. Synthetic face and palm API requests each completed through Vision and produced a free-tier reading. The browser upload page and age gate were checked, but the browser file-picker selection and submit step were not completed; the successful image payloads were sent directly to the production API. The monthly membership CTA created a live Stripe Checkout Session and opened Stripe Checkout showing $9.90/month. No payment was submitted; paid fulfillment and refund remain unverified. The updated privacy/refund wording has not received legal review. The 9/10 design score remains a design-review judgment, not an objective benchmark.

## Follow-up production flow checks

On 2026-10-16, production browser checks used Chrome with a synthetic profile (1990-10-05, 12:30, Testville; no real person's details):

- The homepage's Start button opened `/collect.html?lang=en`; its Face Reading card opened `/collect.html?lang=en&method=face`.
- Submitting the profile without the 18+ confirmation displayed the age warning and blocked navigation. After test confirmation, the face selection was retained through `/pick.html?lang=en&method=face`, and the primary action opened `/report-face.html?lang=en`.
- The report page produced its deterministic BaZi chart and rendered in English. This page load did not request paid prose generation; the chart is a deterministic calculation.
- Tapping the face upload control opened an 18+ and photo-ownership gate. The test selected “Under 18 · Go back”; no file was chosen or transmitted. The palm upload control showed the equivalent biometric-data/18+ gate and was also dismissed without selecting a file.
- One production POST without image data to each of `/api/mianxiang` and `/api/shouxiang` returned HTTP 400 with `code: "need_photo"`, confirming the backend blocks fabricated readings before image analysis.
- One short English BaZi `pillars` chapter request for the synthetic profile returned HTTP 200 with streamed `meta`, `chunk`, and `done` events. No repeat was made.
- A synthetic face image returned HTTP 200 and a 3,322-character free-tier reading after the Vision model repair. A first decorative palm illustration was correctly rejected as `no_palm`; a separate photorealistic AI-generated synthetic palm then returned HTTP 200 and a 3,802-character basic reading.
- The two successful image payloads were sent directly to the production API. The browser upload page and adult gate were visible, but the browser's file-picker selection and final submit were not verified.
- Vision service logs before the repair contained the retired-model 404. After the repair, the successful image calls produced no new Vision errors.

The live monthly CTA was followed into Stripe Checkout, where Stripe initially displayed “Subscribe to ShenYuan Member Monthly 月度会员” at $9.90 per month. On 2026-10-16 the three active USD membership products attached to the fixed monthly, quarterly, and yearly Price IDs were renamed in the production API account to “Runae Monthly Membership,” “Runae Quarterly Membership,” and “Runae Yearly Membership.” Prices, billing intervals, active status, and Price IDs were unchanged. A fresh Checkout Session confirmed the product line now reads “Subscribe to Runae Monthly Membership” at $9.90 per month. The checkout header and Link authorization still show “LUMEE.” The production API key reports account `acct_1Q4uA5EAXrE2Ygcr`; the logged-in Stripe Dashboard was account `acct_1UQIDEIuJpiKahac`. The latter account was renamed to Runae and its public business name changed to Runae, but that did not update the production merchant profile. Updating the production account's own business profile through API is rejected by Stripe; its Dashboard must be accessed to change the public Doing Business As name. No payment was submitted, so webhook fulfillment, paid entitlements, cancellation, and refund remain unverified. The browser file-picker was not completed; do not treat direct API image checks as proof of the browser upload flow. Legal review is outstanding. The backend regression suite's mocked checkout coverage is not evidence that a live paid order has completed successfully.
