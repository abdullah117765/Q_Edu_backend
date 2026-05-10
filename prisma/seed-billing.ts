/* eslint-disable no-console */
/**
 * Billing seed: creates default credit packages and subscription plans,
 * syncs them to Stripe (when keys are present), and inserts a small set of
 * sample Payment / Subscription rows so the super-admin analytics views have
 * something to render in development.
 *
 * Run with:  npx ts-node -r tsconfig-paths/register prisma/seed-billing.ts
 */
import { Prisma, PrismaClient, SubscriptionInterval, SubscriptionStatus, ZoomCreditPackageBillingType } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();

const PACKAGES: Array<{
  slug: string;
  name: string;
  description: string;
  credits: number;
  bonusCredits: number;
  priceCents: number;
  highlight: boolean;
  sortOrder: number;
}> = [
  { slug: 'starter', name: 'Starter Pack', description: '100 credits — ideal for trying classes out.', credits: 100, bonusCredits: 0, priceCents: 1000, highlight: false, sortOrder: 1 },
  { slug: 'pro', name: 'Pro Pack', description: '500 credits + 50 bonus. Great for active academies.', credits: 500, bonusCredits: 50, priceCents: 4500, highlight: true, sortOrder: 2 },
  { slug: 'scale', name: 'Scale Pack', description: '1,000 credits + 150 bonus. Best per-credit value.', credits: 1000, bonusCredits: 150, priceCents: 8000, highlight: false, sortOrder: 3 },
  { slug: 'enterprise', name: 'Enterprise Pack', description: '5,000 credits + 1,000 bonus for large academies.', credits: 5000, bonusCredits: 1000, priceCents: 35000, highlight: false, sortOrder: 4 },
];

const PLANS: Array<{
  tier: string;
  name: string;
  description: string;
  priceCents: number;
  interval: SubscriptionInterval;
  monthlyClassMinutes: number;
  monthlyCredits: number;
  maxTeachers: number | null;
  maxStudents: number | null;
  highlight: boolean;
  sortOrder: number;
}> = [
  { tier: 'free', name: 'Free', description: 'Get started. Pay-as-you-go credits.', priceCents: 0, interval: SubscriptionInterval.MONTHLY, monthlyClassMinutes: 0, monthlyCredits: 0, maxTeachers: 1, maxStudents: 10, highlight: false, sortOrder: 1 },
  { tier: 'pro_monthly', name: 'Pro (Monthly)', description: '600 minutes + 50 credits per month.', priceCents: 2900, interval: SubscriptionInterval.MONTHLY, monthlyClassMinutes: 600, monthlyCredits: 50, maxTeachers: 5, maxStudents: 100, highlight: true, sortOrder: 2 },
  { tier: 'pro_yearly', name: 'Pro (Yearly)', description: 'Pro tier billed yearly — 2 months free.', priceCents: 29000, interval: SubscriptionInterval.YEARLY, monthlyClassMinutes: 600, monthlyCredits: 50, maxTeachers: 5, maxStudents: 100, highlight: false, sortOrder: 3 },
  { tier: 'scale_monthly', name: 'Scale (Monthly)', description: '2,000 minutes + 200 credits per month.', priceCents: 9900, interval: SubscriptionInterval.MONTHLY, monthlyClassMinutes: 2000, monthlyCredits: 200, maxTeachers: 25, maxStudents: 500, highlight: false, sortOrder: 4 },
  { tier: 'scale_yearly', name: 'Scale (Yearly)', description: 'Scale tier billed yearly — 2 months free.', priceCents: 99000, interval: SubscriptionInterval.YEARLY, monthlyClassMinutes: 2000, monthlyCredits: 200, maxTeachers: 25, maxStudents: 500, highlight: false, sortOrder: 5 },
];

async function ensureProductAndPrice(stripe: Stripe, params: {
  name: string;
  unitAmount: number;
  currency: string;
  recurring?: { interval: 'month' | 'year' };
  productId?: string | null;
  priceId?: string | null;
  metadata?: Record<string, string>;
}): Promise<{ productId: string; priceId: string }> {
  let product: Stripe.Product;
  if (params.productId) {
    try {
      product = await stripe.products.retrieve(params.productId);
    } catch {
      product = await stripe.products.create({ name: params.name, metadata: params.metadata });
    }
  } else {
    product = await stripe.products.create({ name: params.name, metadata: params.metadata });
  }
  // Reuse price if same amount/currency/recurring
  if (params.priceId) {
    try {
      const existing = await stripe.prices.retrieve(params.priceId);
      const sameAmount = existing.unit_amount === params.unitAmount;
      const sameCurrency = existing.currency === params.currency.toLowerCase();
      const sameRecurring = (existing.recurring?.interval ?? null) === (params.recurring?.interval ?? null);
      if (sameAmount && sameCurrency && sameRecurring && existing.active) {
        return { productId: product.id, priceId: existing.id };
      }
    } catch {
      // ignore, fall through to create new
    }
  }
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: params.unitAmount,
    currency: params.currency.toLowerCase(),
    recurring: params.recurring,
  });
  return { productId: product.id, priceId: price.id };
}

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY ?? '';
  const currency = (process.env.STRIPE_CURRENCY ?? 'usd').toLowerCase();
  const stripe = secret ? new Stripe(secret, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion }) : null;

  console.log(`[seed-billing] Stripe sync: ${stripe ? 'enabled' : 'disabled (no STRIPE_SECRET_KEY)'}`);

  // ---- Packages ----
  for (const p of PACKAGES) {
    const existing = await prisma.zoomCreditPackage.findFirst({ where: { name: p.name } });
    let stripeProductId: string | null = existing?.stripeProductId ?? null;
    let stripePriceId: string | null = existing?.stripePriceId ?? null;
    if (stripe) {
      const synced = await ensureProductAndPrice(stripe, {
        name: p.name,
        unitAmount: p.priceCents,
        currency,
        productId: stripeProductId,
        priceId: stripePriceId,
        metadata: { kind: 'package', slug: p.slug },
      });
      stripeProductId = synced.productId;
      stripePriceId = synced.priceId;
    }
    if (existing) {
      await prisma.zoomCreditPackage.update({
        where: { id: existing.id },
        data: {
          description: p.description,
          credits: p.credits,
          bonusCredits: p.bonusCredits,
          priceCents: p.priceCents,
          currency: currency.toUpperCase(),
          billingType: ZoomCreditPackageBillingType.ONE_TIME,
          highlight: p.highlight,
          sortOrder: p.sortOrder,
          active: true,
          stripeProductId,
          stripePriceId,
        },
      });
      console.log(`[seed-billing] updated package ${p.name}`);
    } else {
      await prisma.zoomCreditPackage.create({
        data: {
          name: p.name,
          description: p.description,
          credits: p.credits,
          bonusCredits: p.bonusCredits,
          priceCents: p.priceCents,
          currency: currency.toUpperCase(),
          billingType: ZoomCreditPackageBillingType.ONE_TIME,
          highlight: p.highlight,
          sortOrder: p.sortOrder,
          active: true,
          stripeProductId,
          stripePriceId,
        },
      });
      console.log(`[seed-billing] created package ${p.name}`);
    }
  }

  // ---- Plans ----
  for (const plan of PLANS) {
    const existing = await prisma.subscriptionPlan.findFirst({ where: { tier: plan.tier } });
    let stripeProductId: string | null = existing?.stripeProductId ?? null;
    let stripePriceId: string | null = existing?.stripePriceId ?? null;
    if (stripe && plan.priceCents > 0) {
      const synced = await ensureProductAndPrice(stripe, {
        name: plan.name,
        unitAmount: plan.priceCents,
        currency,
        productId: stripeProductId,
        priceId: stripePriceId,
        recurring: { interval: plan.interval === SubscriptionInterval.YEARLY ? 'year' : 'month' },
        metadata: { kind: 'plan', tier: plan.tier },
      });
      stripeProductId = synced.productId;
      stripePriceId = synced.priceId;
    }
    const data = {
      name: plan.name,
      description: plan.description,
      tier: plan.tier,
      priceCents: plan.priceCents,
      currency: currency.toUpperCase(),
      interval: plan.interval,
      monthlyClassMinutes: plan.monthlyClassMinutes,
      monthlyCredits: plan.monthlyCredits,
      maxTeachers: plan.maxTeachers ?? undefined,
      maxStudents: plan.maxStudents ?? undefined,
      highlight: plan.highlight,
      sortOrder: plan.sortOrder,
      active: true,
      stripeProductId,
      stripePriceId,
    };
    if (existing) {
      await prisma.subscriptionPlan.update({ where: { id: existing.id }, data });
      console.log(`[seed-billing] updated plan ${plan.name}`);
    } else {
      await prisma.subscriptionPlan.create({ data });
      console.log(`[seed-billing] created plan ${plan.name}`);
    }
  }

  // ---- Sample analytics data (development only) ----
  if (process.env.SEED_BILLING_SAMPLES === '1') {
    const users = await prisma.user.findMany({ take: 5, orderBy: { createdAt: 'asc' } });
    const pkgs = await prisma.zoomCreditPackage.findMany();
    const plans = await prisma.subscriptionPlan.findMany({ where: { priceCents: { gt: 0 } } });
    const feePct = Number(process.env.PLATFORM_FEE_PERCENT ?? '10');

    let count = 0;
    for (const u of users) {
      for (let i = 0; i < 4; i += 1) {
        const pkg = pkgs[(i + count) % pkgs.length];
        if (!pkg) continue;
        const fee = Math.round((pkg.priceCents * feePct) / 100);
        const net = pkg.priceCents - fee;
        await prisma.payment.create({
          data: {
            userId: u.id,
            amount: new Prisma.Decimal((pkg.priceCents / 100).toFixed(2)),
            platformFeeAmount: new Prisma.Decimal((fee / 100).toFixed(2)),
            netAmount: new Prisma.Decimal((net / 100).toFixed(2)),
            currency: pkg.currency,
            provider: 'stripe',
            status: 'completed',
            reference: `seed_${u.id.slice(0, 6)}_${count}`,
            description: `Seed: ${pkg.name}`,
            packageId: pkg.id,
          },
        });
        count += 1;
      }
      // attach a fake subscription to the first user
      if (u === users[0] && plans.length > 0) {
        const plan = plans.find((p) => p.interval === SubscriptionInterval.MONTHLY) ?? plans[0];
        const now = new Date();
        await prisma.subscription.create({
          data: {
            userId: u.id,
            planId: plan.id,
            status: SubscriptionStatus.ACTIVE,
            stripeSubscriptionId: `sub_seed_${u.id.slice(0, 6)}`,
            stripeCustomerId: `cus_seed_${u.id.slice(0, 6)}`,
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
          },
        });
      }
    }
    console.log(`[seed-billing] inserted ${count} sample payment rows`);
  }

  console.log('[seed-billing] done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
