/**
 * DEV-ONLY route — runs the full database reset + seed in-process.
 * Remove before deploying to production.
 * Accessible at POST /api/v1/dev/reset-seed
 */
import { Router, Request, Response } from 'express';
import { execSync } from 'child_process';
import path from 'path';

const router = Router();

router.post('/reset-seed', async (_req: Request, res: Response) => {
  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const send = (msg: string) => {
      res.write(`data: ${msg}\n\n`);
    };

    send('🔧 Step 1/3 — Pushing schema and generating client...');
    const prismaCmd = path.join(process.cwd(), 'node_modules', '.bin', 'prisma');
    try {
      execSync(`"${prismaCmd}" db push --force-reset`, {
        cwd: process.cwd(),
        timeout: 120000,
        env: process.env,
        stdio: 'pipe',
      });
      send('✅ Schema pushed and client generated successfully');
    } catch (e: unknown) {
      const err = e as { stderr?: Buffer; message?: string };
      send(`⚠️ Schema push: ${err?.stderr?.toString() || err?.message || 'unknown error'}`);
    }

    send('🌱 Step 2/3 — Executing database seed...');
    
    // Clear Node's require cache to reload the newly generated Prisma Client
    Object.keys(require.cache).forEach((key) => {
      if (
        key.includes('@prisma/client') ||
        key.includes('.prisma/client') ||
        key.includes('seed.ts') ||
        key.includes('seed.js')
      ) {
        delete require.cache[key];
      }
    });

    // Dynamically load the fresh client and the seeding function
    const { PrismaClient: FreshPrismaClient } = require('@prisma/client');
    const freshPrisma = new FreshPrismaClient();
    const { setPrisma, runSeed } = require('../../prisma/seed');

    // Link the fresh prisma client instance
    setPrisma(freshPrisma);

    // Run seed
    await runSeed();
    await freshPrisma.$disconnect();

    send('✅ Database seeded successfully');

    send('🏁 Step 3/3 — Preparing final output...');
    send('');
    send('✅ SEED COMPLETE');
    send('');
    send('Login credentials:');
    send('  admin@charusat.edu.in         / Admin@123');
    send('  admin.cspit@charusat.edu.in   / Admin@123');
    send('  admin.depstar@charusat.edu.in / Admin@123');
    send('  timetable@charusat.edu.in     / Scheduler@123');
    send('  prof1.cse.cspit@charusat.edu.in / Faculty@123');
    send('  23cse001@charusat.edu.in       / Student@123');
    send('  23ce001@charusat.edu.in        / Student@123');
    send('DONE');
    res.end();
  } catch (err: unknown) {
    const e = err as Error;
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    } else {
      res.write(`data: ❌ ERROR: ${e.message}\n\n`);
      res.end();
    }
  }
});

export default router;
