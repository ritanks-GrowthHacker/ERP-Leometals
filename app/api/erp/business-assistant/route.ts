import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question } = body;

    if (!question) {
      return NextResponse.json(
        { success: false, error: 'Question is required' },
        { status: 400 }
      );
    }

    const aiApiUrl = process.env.AI_REPLIES;
    
    if (!aiApiUrl) {
      return NextResponse.json(
        { success: false, error: 'AI API URL not configured' },
        { status: 500 }
      );
    }

    // Make request to AI API using form-urlencoded format
    const formData = new URLSearchParams();
    formData.append('question', question);

    const response = await fetch(aiApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`AI API returned status ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      answer: data.answer || 'No response from AI',
    });
  } catch (error: any) {
    console.error('Error calling AI API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get AI response',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
