export interface OCRProgress {
  status: string;
  progress: number;
  userJobId: string;
}

export interface OCRResult {
  text: string;
  confidence: number;
  processingTime: number;
}

export interface ReceiptData {
  store: string;
  date: string;
  amount: number;
  items: string[];
  rawText: string;
  confidence: number;
}

export interface N8NPayload {
  extractedData: ReceiptData;
  ocrText: string;
  imageBase64: string;
  metadata: {
    timestamp: string;
    userId: string;
    source: string;
  };
}

export interface ProcessingState {
  isProcessing: boolean;
  progress: OCRProgress | null;
  error: string | null;
  result: ReceiptData | null;
}

export type FileValidationResult = 
  | { valid: true }
  | { valid: false; error: string };

export type OCRWorkerConfig = {
  languages: string[];
  options: {
    logger?: (progress: OCRProgress) => void;
  };
};