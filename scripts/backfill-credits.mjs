/**
 * One-time backfill: grants initial free credits to any ACADEMY_OWNER
 * who has no existing credit balance or initial-grant transaction.
 *
 * Run with:  node scripts/backfill-credits.mjs
 */
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const INITIAL_CREDITS = Number(
  process.env.ACADEMY_OWNER_INITIAL_FREE_CREDITS ?? 100,
);
const prisma = new PrismaClient();

async function main() {
  // Find all academy owners
  const owners = await prisma.user.findMany({
    where: { role: 'ACADEMY_OWNER' },
    select: { id: true, email: true },
  });

  console.log(`Found ${owners.length} academy owner(s).`);

  for (const owner of owners) {
    // Check if they already have an initial grant transaction
    const existing = await prisma.zoomCreditTransaction.findFirst({
      where: {
        userId: owner.id,
        reason: 'Initial academy owner credit grant',
      },
      select: { id: true },
    });

    if (existing) {
      console.log(`  SKIP  ${owner.email} — already has initial grant`);
      continue;
    }

    // Insert balance record + transaction in one transaction
    await prisma.$transaction(async (tx) => {
      const balance = await tx.zoomCreditBalance.upsert({
        where: { userId: owner.id },
        create: { userId: owner.id, balance: INITIAL_CREDITS },
        update: { balance: { increment: INITIAL_CREDITS } },
      });

      const transaction = await tx.zoomCreditTransaction.create({
        data: {
          userId: owner.id,
          type: 'CREDIT',
          amount: INITIAL_CREDITS,
          runningBalance: balance.balance,
          reason: 'Initial academy owner credit grant',
          metadata: {
            source: 'academy_owner.initial_grant',
            initialCredits: INITIAL_CREDITS,
            backfilled: true,
          },
        },
      });

      await tx.zoomCreditAuditLog.create({
        data: {
          transactionId: transaction.id,
          action: 'CREATED',
          details: {
            source: 'academy_owner.initial_grant',
            initialCredits: INITIAL_CREDITS,
            backfilled: true,
          },
        },
      });
    });

    console.log(
      `  GRANT ${owner.email} — credited ${INITIAL_CREDITS} free credits`,
    );
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
