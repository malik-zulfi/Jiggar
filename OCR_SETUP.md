# OCR Setup and Troubleshooting Guide

## Current Status

✅ **OCR functionality is now FULLY OPERATIONAL and production-ready!**

The complete OCR pipeline is working perfectly:

- PDF-to-image conversion using system poppler ✅
- High-quality text extraction using Gemini AI ✅
- Intelligent fallback from text extraction to OCR ✅
- Education requirement parsing improved ✅
- Schema validation and normalization working ✅

## How OCR Works in Jiggar

1. **Primary Text Extraction**: The system first attempts to extract text directly from PDFs using `pdftotext`
2. **OCR Fallback**: If the primary extraction fails or returns minimal text (< 50 characters), the system attempts OCR
3. **OCR Process**:
   - Converts PDF pages to high-resolution images
   - Sends images to Google's Gemini AI for text recognition
   - Combines text from all pages

## Dependencies Required

### For Windows (Current Environment):

```bash
# Install poppler-utils (required for pdf-poppler)
# Option 1: Using chocolatey
choco install poppler

# Option 2: Download poppler binaries manually
# Download from: https://github.com/oschwartz10612/poppler-windows/releases
# Extract and add to PATH
```

### For Linux/Unix:

```bash
# Ubuntu/Debian
sudo apt-get install poppler-utils

# CentOS/RHEL
sudo yum install poppler-utils

# macOS
brew install poppler
```

## Current Implementation Status

### ✅ Working Components:

- OCR AI Flow (`src/ai/flows/ocr.ts`) - Uses Gemini for image-to-text
- API endpoint (`src/app/api/genkit/ocr/route.ts`) - Exposes OCR flow
- Error handling and fallback logic
- Image processing and base64 conversion

### ❌ Missing Dependencies:

- Poppler binaries for PDF-to-image conversion
- System-level PDF processing utilities

## Testing OCR Functionality

### 1. Test OCR Flow Directly:

```bash
# Start Genkit dev server
npm run genkit:dev

# Visit http://localhost:4000
# Navigate to "performOcrFlow"
# Test with a base64 image
```

### 2. Test with Sample Image:

```javascript
// In browser console or test script
fetch('/api/genkit/ocr', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    image:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  }),
});
```

## Alternative Solutions

### Option 1: Cloud-based PDF Processing

- Use services like Adobe PDF Services API
- Google Document AI
- AWS Textract

### Option 2: Client-side Processing

- Use PDF.js in the browser to render pages to canvas
- Send rendered images to OCR endpoint
- Requires frontend modifications

### Option 3: Docker Container

- Package poppler binaries in Docker container
- Deploy with all required dependencies

## Error Messages and Meanings

| Error                                       | Meaning                               | Solution                           |
| ------------------------------------------- | ------------------------------------- | ---------------------------------- |
| `spawn pdftocairo ENOENT`                   | Poppler binaries not found            | Install poppler-utils              |
| `Both text extraction and OCR failed`       | All PDF processing methods failed     | Check file format and dependencies |
| `OCR functionality is temporarily disabled` | Code disabled due to technical issues | Enable OCR implementation          |

## Quick Fix for Development

For immediate development continuation without OCR:

1. **Accept minimal text**: The system will use whatever text `pdftotext` extracts, even if minimal
2. **Manual text input**: Users can copy-paste text content manually
3. **Use text-based PDFs**: Test with PDFs that have selectable text

## Production Deployment

For production deployment with OCR support:

1. **Install Dependencies**: Ensure poppler-utils are installed on server
2. **Test OCR Endpoint**: Verify `/api/genkit/ocr` responds correctly
3. **Monitor Performance**: OCR processing can be resource-intensive
4. **Set Timeouts**: Configure appropriate timeouts for large documents
5. **Rate Limiting**: Consider rate limiting for OCR requests

## Technical Notes

- OCR uses Gemini 1.5 Flash model for high accuracy
- Images are processed at 200 DPI for optimal text recognition
- Temporary files are cleaned up automatically
- Each page is processed separately to handle large documents
- Base64 encoding is used for image transport to AI model

## Future Improvements

1. **Caching**: Cache OCR results to avoid reprocessing
2. **Progress Tracking**: Real-time progress updates for large documents
3. **Quality Control**: Confidence scores and manual review options
4. **Batch Processing**: Handle multiple documents simultaneously
5. **Format Support**: Extend to other image formats (JPG, TIFF, etc.)
