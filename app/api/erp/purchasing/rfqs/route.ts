import { NextRequest, NextResponse } from 'next/server';

// This is an alias/redirect to maintain backward compatibility
// Admin uses /rfqs, actual route is at /rfq
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  url.pathname = url.pathname.replace('/rfqs', '/rfq');
  
  return fetch(url.toString(), {
    method: 'GET',
    headers: req.headers,
  });
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  url.pathname = url.pathname.replace('/rfqs', '/rfq');
  
  const body = await req.text();
  
  return fetch(url.toString(), {
    method: 'POST',
    headers: req.headers,
    body: body,
  });
}
