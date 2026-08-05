import { NextResponse } from 'next/server'
import { db } from '@/db/connection'

/**
 * Health probe consumed by the Dockerfile HEALTHCHECK.
 *
 * It checks the database on purpose: an app answering 200 with the database
 * down is lying to the orchestrator, and the container stays marked healthy
 * while no screen works.
 */
export const dynamic = 'force-dynamic'

export async function GET (): Promise<NextResponse> {
  try {
    await db().query('SELECT 1')
    return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
  } catch {
    // The driver message never reaches the response: it carries host, user and
    // sometimes the query. The detail stays in the container log.
    return NextResponse.json(
      { ok: false, error: 'database unavailable' },
      { status: 503, headers: { 'cache-control': 'no-store' } }
    )
  }
}
