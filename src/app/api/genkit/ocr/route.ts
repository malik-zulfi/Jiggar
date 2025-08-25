'use server';

import { performOcrFlow } from '../../../../ai/flows/ocr';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { image } = await req.json();

  try {
    const result = await performOcrFlow({ image });
    return NextResponse.json(result);
  } catch (error) {
    console.error('OCR API error:', error);
    return NextResponse.json(
      { error: 'Failed to process image with OCR.' },
      { status: 500 }
    );
  }
}
