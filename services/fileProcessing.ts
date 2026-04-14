
// Access global PDF.js loaded via script tag in index.html
const getPdfLib = () => {
  const lib = (window as any).pdfjsLib;
  if (!lib) {
    throw new Error("PDF.js library not loaded. Please refresh the page.");
  }
  return lib;
};

export interface ProcessedFile {
  text: string;
  pageCount: number;
}

export async function extractTextFromFile(file: File): Promise<ProcessedFile> {
  const fileName = file.name.toLowerCase();
  const fileType = file.type;

  try {
    let result: ProcessedFile = { text: '', pageCount: 0 };

    // Check for PDF
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      result = await extractTextFromPDF(file);
    } 
    // Check for Text
    else if (fileName.endsWith('.txt') || fileType === 'text/plain') {
      const text = await file.text();
      result = { text, pageCount: 1 };
    } 
    // Fallback or Error
    else {
      throw new Error("Formato no soportado. Solo se aceptan archivos PDF y TXT.");
    }

    // Scanned PDF Check
    if (!result.text || result.text.trim().length < 50) {
        throw new Error("El documento parece estar vacío o ser una imagen escaneada. Por favor, usa un PDF con texto seleccionable.");
    }

    return result;

  } catch (error) {
    console.error(`Error extracting text from ${fileName}:`, error);
    throw error;
  }
}

async function extractTextFromPDF(file: File): Promise<ProcessedFile> {
  const pdfjsLib = getPdfLib();
  
  // Suppress PDF.js warnings and errors to avoid console spam
  const originalWarn = console.warn;
  const originalError = console.error;
  console.warn = () => {};
  console.error = () => {};

  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Use Uint8Array to be safe with all browser versions
    const uint8Array = new Uint8Array(arrayBuffer);

    // Load the document
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    const numPages = pdf.numPages;
    
    // Iterate over all pages
    for (let i = 1; i <= numPages; i++) {
      try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          // Extract text items safely
          const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');
          
          fullText += `--- Página ${i} ---\n${pageText}\n\n`;
      } catch (pageError) {
          // Ignore page errors silently
      }
    }
    
    return { text: fullText, pageCount: numPages };
  } finally {
    // Restore console
    console.warn = originalWarn;
    console.error = originalError;
  }
}