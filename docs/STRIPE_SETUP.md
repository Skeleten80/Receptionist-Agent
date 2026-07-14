# Stripe setup

1. Create Products/Prices for Starter, Growth, Pro.
2. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER|GROWTH|PRO`, optional `STRIPE_TRIAL_DAYS`.
3. Forward webhooks: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
4. Checkout and Customer Portal are implemented in `src/lib/billing/stripe.ts`.
5. Subscription status is updated only from verified Stripe webhooks.
