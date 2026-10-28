# M-Pesa subscription checkout setup

The application integrates Daraja M-Pesa Express (STK Push) for Pro and Enterprise subscriptions. The checkout is disabled until the required server-side environment variables are configured. The browser never receives Daraja credentials and never supplies the charge amount; the server derives KSh 3,999 / KSh 10,000 for Pro and KSh 5,999 / KSh 15,000 for Enterprise from the shared price map.

## Required environment variables

Set these in the Vercel project’s **server-side** Environment Variables. Do not prefix secrets with `VITE_`, do not commit them, and do not send them in chat.

| Variable | Purpose |
| --- | --- |
| `MPESA_ENABLED` | Set to `true` only when the chosen environment is ready. |
| `MPESA_ENVIRONMENT` | `sandbox` for testing or `production` for live Daraja. Production deployments refuse sandbox credentials. |
| `MPESA_CONSUMER_KEY` | Daraja app consumer key. |
| `MPESA_CONSUMER_SECRET` | Daraja app consumer secret. |
| `MPESA_SHORTCODE` | The PayBill/Till shortcode approved for the Daraja app. |
| `MPESA_PASSKEY` | The Daraja Lipa Na M-Pesa Online passkey for that shortcode. |
| `MPESA_CALLBACK_URL` | Public HTTPS callback URL with a high-entropy token in its path, as described below. |
| `MPESA_TRANSACTION_TYPE` | Optional: `CustomerPayBillOnline` (default) or `CustomerBuyGoodsOnline`, matching the shortcode configuration. |

The callback URL must have this shape, using the production domain and a newly generated URL-safe random token of at least 43 characters (for example, 32 random bytes encoded as base64url):

```text
https://<production-domain>/api/mpesa/stk-callback/<high-entropy-random-token>
```

Safaricom posts payment results to that URL. The callback endpoint uses the unguessable path token as a bearer secret; Daraja does not provide an independent signature in this integration. Keep the token private, restrict/redact request-path logs where possible, and rotate it by changing `MPESA_CALLBACK_URL` if it is ever exposed. Automated activation requires a stored checkout ID, matching merchant request ID, exact amount and phone, and a receipt. Mismatches are held for platform-admin review instead of being marked paid.

## Safe rollout

1. Create or select the Daraja app in Safaricom’s [Daraja portal](https://developer.safaricom.co.ke/) and test with sandbox credentials on a non-production deployment. The callback URL used for the test must be publicly reachable over HTTPS.
2. Apply the reviewed SQL migration `drizzle/migrations/0016_subscription_mpesa_payments.sql` to the production Neon branch before deploying code that queries the new columns/table.
3. Add the approved live Daraja credentials and tokenized production callback URL to Vercel’s **Production** environment. Use the `production` Daraja environment and set `MPESA_ENABLED=true` only after live credentials and callback reachability have been confirmed. Redeploy after changing environment variables.
4. Make a low-value controlled live test from a designated school admin account, confirm the prompt and receipt, then verify the subscription period and admin payment-history row. Do not use a customer’s M-Pesa PIN in the application; the customer enters it only in the Safaricom prompt.

M-Pesa checkout is a one-time payment for the selected period; it does not automatically renew. A same-plan renewal may be paid early and starts after the current recorded period. A different paid plan is blocked while the current paid period is active so that remaining time is not silently forfeited; manual platform-admin plan changes remain separately audited and do not claim a payment was collected. Stale or mismatched payment attempts can be resolved only by a designated platform admin: they must check Daraja before either entering a receipt to confirm payment or marking an attempt verified-unpaid. Unresolved payment attempts remain blocked to prevent duplicate prompts. Checkout remains disabled if any required configuration is missing.

Official portal reference: [Safaricom Daraja 3.0](https://developer.safaricom.co.ke/). The detailed API reference is rendered dynamically in the portal; use the Daraja app’s current account-specific instructions for live shortcode, passkey, and transaction-type settings.
