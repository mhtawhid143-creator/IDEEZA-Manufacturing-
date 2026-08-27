import { NextResponse } from 'next/server';

/** Liveness probe. Anonymous by design, and it touches nothing. */
export const GET = (): NextResponse =>
  NextResponse.json({
    status: 'ok',
    surface: 'manufacturer',
    at: new Date().toISOString(),
  });
