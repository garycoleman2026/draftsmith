import { runDueWiseOldManSyncs } from '@/lib/bingo-wom-scheduler';
import { ensureSchema, json } from '@/lib/db';

async function run() {
  try {
    await ensureSchema();
    return json(await runDueWiseOldManSyncs(2));
  } catch (error) {
    console.error('scheduled WOM sync failed', error);
    return json({ error: 'Scheduled sync could not run.' }, { status: 500 });
  }
}

export async function GET() { return run(); }
export async function POST() { return run(); }
