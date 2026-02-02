import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { mainDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

// POST /api/erp/profile/picture - Upload profile picture
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('profilePicture') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 2MB' }, { status: 400 });
    }

    // Convert image to base64 and create data URI
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64String = buffer.toString('base64');
    const dataUri = `data:${file.type};base64,${base64String}`;

    // Update user profile picture using sql
    await mainDb.execute(sql`
      UPDATE users
      SET profile_picture_url = ${dataUri}, updated_at = NOW()
      WHERE id = ${decoded.id}
    `);

    return NextResponse.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profilePicture: dataUri,
    });
  } catch (error: any) {
    console.error('Error uploading profile picture:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/erp/profile/picture - Remove profile picture
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Remove profile picture using sql
    await mainDb.execute(sql`
      UPDATE users
      SET profile_picture_url = NULL, updated_at = NOW()
      WHERE id = ${decoded.id}
    `);

    return NextResponse.json({
      success: true,
      message: 'Profile picture removed successfully',
    });
  } catch (error: any) {
    console.error('Error removing profile picture:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
