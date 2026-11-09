# TODO: real Chapa payments (later)

Status: payments run in TEST MODE (DEV_FAKE_PAY=true). Nobody is really charged.

## Before going live
- [ ] Get a working Chapa secret key (CHASECK_TEST-... for test, CHASECK-... for live)
      Dashboard > Test mode > Settings > API Keys. Ask Chapa support if none is shown.
- [ ] Direct key test returns a checkout_url (the Invoke-RestMethod test from chat)
- [ ] Remove DEV_FAKE_PAY=true from .env  (anyone can publish for free while it is on)
- [ ] Put the real key in CHAPA_SECRET_KEY, restart with npm start
- [ ] Test with Chapa test card / test number, listing goes live after paying
- [ ] Optional: add the /callback and /recheck routes so payments confirm even if the user closes the page
- [ ] Complete Chapa account verification for live payments, use the live key (CHASECK-...)
- [ ] Deploy on public https, set BASE_URL to the real domain
- [ ] Set LISTING_FEE to the real price
- [ ] Regenerate the Chapa keys that were pasted in chat
- [ ] Optional: Chapa webhook with signature check
