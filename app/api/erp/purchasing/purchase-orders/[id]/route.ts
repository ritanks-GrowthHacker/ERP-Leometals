import { NextRequest, NextResponse } from 'next/server';

// This is an alias/redirect to maintain backward compatibility
// Admin uses /purchase-orders, actual route is at /orders
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  url.pathname = url.pathname.replace('/purchase-orders', '/orders');
  
  return fetch(url.toString(), {
    method: 'GET',
    headers: req.headers,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  url.pathname = url.pathname.replace('/purchase-orders', '/orders');
  
  const body = await req.text();
  
  return fetch(url.toString(), {
    method: 'PUT',
    headers: req.headers,
    body: body,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  url.pathname = url.pathname.replace('/purchase-orders', '/orders');
  
  return fetch(url.toString(), {
    method: 'DELETE',
    headers: req.headers,
  });
}
