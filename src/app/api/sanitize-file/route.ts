import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import { createCanvas } from 'canvas';
import { performOcr } from '@/ai/flows/ocr';
// Helper function to extract text from PDF using OCR
async function extractTextFromPdfWithOcr(buffer: Buffer): Promise<string> {
  const tempPdfPath = os.tmpdir() + '/ocr-input-' + Date.now() + '.pdf';
  const tempDir = os.tmpdir() + '/pdf-images-' + Date.now();

  try {
    // Write PDF to temporary file
    await fs.writeFile(tempPdfPath, buffer);

    // Create temporary directory for images
    await fs.mkdir(tempDir, { recursive: true });

    console.log(`Converting PDF to images using pdftocairo...`);

    // Use pdftocairo directly to convert PDF to PNG images
    const outputPattern = `${tempDir}/page`;
    const pdftocairoCmd = `pdftocairo -png -r 200 "${tempPdfPath}" "${outputPattern}"`;

    await new Promise<void>((resolve, reject) => {
      exec(pdftocairoCmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`pdftocairo error: ${error.message}`);
          return reject(error);
        }
        if (stderr) {
          console.warn(`pdftocairo stderr: ${stderr}`);
        }
        console.log('PDF to image conversion completed');
        resolve();
      });
    });

    // Find all generated PNG files
    const files = await fs.readdir(tempDir);
    const imageFiles = files
      .filter((file) => file.endsWith('.png'))
      .sort() // Sort to maintain page order
      .map((file) => `${tempDir}/${file}`);

    if (imageFiles.length === 0) {
      throw new Error('No images were generated from PDF');
    }

    const extractedTexts: string[] = [];
    console.log(`Processing ${imageFiles.length} pages with OCR...`);

    // Process each image with OCR
    for (let i = 0; i < imageFiles.length; i++) {
      const imagePath = imageFiles[i];
      try {
        // Read the image file and convert to base64
        const imageBuffer = await fs.readFile(imagePath);
        const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

        // Run OCR on the image
        const ocrResult = await performOcr({ image: base64Image });
        extractedTexts.push(ocrResult.text);
        console.log(`OCR completed for page ${i + 1}/${imageFiles.length}`);
      } catch (error) {
        console.error(`OCR failed for page ${i + 1}:`, error);
        extractedTexts.push(''); // Add empty string to maintain page order
      }
    }

    return extractedTexts.join('\n\n');
  } finally {
    // Clean up temporary files
    await fs
      .unlink(tempPdfPath)
      .catch((err) => console.error(`Error deleting ${tempPdfPath}:`, err));

    // Clean up temporary images directory
    try {
      const files = await fs.readdir(tempDir).catch(() => []);
      await Promise.all(
        files.map((file) =>
          fs
            .unlink(`${tempDir}/${file}`)
            .catch((err) => console.error(`Error deleting ${file}:`, err))
        )
      );
      await fs
        .rmdir(tempDir)
        .catch((err) =>
          console.error(`Error removing directory ${tempDir}:`, err)
        );
    } catch (error) {
      console.error('Error cleaning up temporary directory:', error);
    }
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText: string = '';
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'pdf') {
      // First, try traditional text extraction with pdftotext
      const tempPdfPath = os.tmpdir() + '/upload-' + Date.now() + '.pdf';
      const tempTxtPath = os.tmpdir() + '/extracted-' + Date.now() + '.txt';
      let usePdfToText = true;

      try {
        await fs.writeFile(tempPdfPath, buffer);

        await new Promise<void>((resolve, reject) => {
          exec(
            `pdftotext ${tempPdfPath} ${tempTxtPath}`,
            (error, stdout, stderr) => {
              if (error) {
                console.warn(`pdftotext failed: ${error.message}`);
                usePdfToText = false;
                return resolve(); // Don't reject, fall back to OCR
              }
              if (stderr) {
                console.error(`stderr: ${stderr}`);
              }
              resolve();
            }
          );
        });

        if (usePdfToText) {
          extractedText = await fs.readFile(tempTxtPath, 'utf8');
        }
      } catch (error) {
        console.warn(`PDF text extraction failed, falling back to OCR:`, error);
        usePdfToText = false;
      } finally {
        // Clean up temporary files
        await fs
          .unlink(tempPdfPath)
          .catch((err) => console.error(`Error deleting ${tempPdfPath}:`, err));
        await fs
          .unlink(tempTxtPath)
          .catch((err) => console.error(`Error deleting ${tempTxtPath}:`, err));
      }

      // If pdftotext failed or extracted very little text, use OCR
      if (!usePdfToText || extractedText.trim().length < 50) {
        console.log(
          'Text extraction yielded minimal results, attempting OCR...'
        );
        try {
          extractedText = await extractTextFromPdfWithOcr(buffer);
          if (extractedText.trim().length === 0) {
            throw new Error(
              'OCR completed but extracted no text - the PDF may be empty or corrupted'
            );
          }
        } catch (ocrError: any) {
          console.error('OCR extraction failed:', ocrError);

          // Provide more specific error messages based on the error type
          if (
            ocrError.message?.includes('poppler') ||
            ocrError.message?.includes('pdftocairo')
          ) {
            return NextResponse.json(
              {
                error:
                  'PDF processing requires system dependencies (poppler-utils) to be installed. Please contact administrator.',
              },
              { status: 500 }
            );
          }

          // If we have some text from pdftotext, use it even if it's minimal
          if (extractedText.trim().length > 0) {
            console.warn(
              'Using minimal text extraction results due to OCR failure'
            );
            return NextResponse.json({ sanitizedText: extractedText });
          }

          // Otherwise, provide a helpful error message
          return NextResponse.json(
            {
              error:
                'This appears to be a scanned PDF that requires OCR processing. Please ensure the document contains selectable text or contact administrator for OCR support.',
            },
            { status: 400 }
          );
        }
      }
    } else if (
      file.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      // For DOCX, use mammoth to extract text
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );
      const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      extractedText = result.value; // The raw text
      // You might want to handle result.messages for warnings/errors from mammoth
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type.' },
        { status: 400 }
      );
    }

    console.log('Extracted Text:', extractedText);
    return NextResponse.json({ sanitizedText: extractedText });
  } catch (error) {
    console.error('File sanitization error:', error);
    return NextResponse.json(
      { error: 'Failed to sanitize file.' },
      { status: 500 }
    );
  }
}
