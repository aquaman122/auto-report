import { useCallback, useEffect, useRef, useState } from "react";
import Tesseract, { type RecognizeResult } from 'tesseract.js'
import type { OCRProgress, OCRResult, ProcessingState, ReceiptData } from "../types/receipt";
import { validateImageFile } from "../utils/fileHelpers";
import { parseReceiptText } from "../utils/ocrParser";

interface UseOCRConfig {
  languages?: string[];
  onProgress?: (progress: OCRProgress) => void;
  onSuccess?: (data: ReceiptData) => void;
  onError?: (error: string) => void;
}

interface UseOCRReturn {
  // 상태
  state: ProcessingState;
  
  // 액션
  processImage: (file: File) => Promise<ReceiptData | null>;
  reset: () => void;
  
  // 워커 관리
  initializeWorker: () => Promise<void>;
  terminateWorker: () => Promise<void>;
}

export const useOCR = (config: UseOCRConfig = {}): UseOCRReturn => {
  const {
    languages = ['kor', 'eng'],
    onProgress,
    onSuccess,
    onError
  } = config;

  // 상태 관리
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: null,
    error: null,
    result: null,
  });

  // 워커 참조
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const isInitializedRef = useRef(false);

  // 상태 업데이트 헬퍼들
  const setProcessing = useCallback((isProcessing: boolean) => {
    setState(prev => ({ ...prev, isProcessing }));
  }, []);

  const setProgress = useCallback((progress: OCRProgress | null) => {
    setState(prev => ({ ...prev, progress }));
    onProgress?.(progress!);
  }, [onProgress]);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
    if (error) onError?.(error);
  }, [onError]);

  const setResult = useCallback((result: ReceiptData | null) => {
    setState(prev => ({ ...prev, result }));
    if (result) onSuccess?.(result);
  }, [onSuccess]);

  // 워커 초기화
  const initializeWorker = useCallback(async (): Promise<void> => {
    if (isInitializedRef.current && workerRef.current) {
      return;
    }

    try {
      const progressCallback = (m: any) => {
        const progress: OCRProgress = {
          status: m.status || 'processing',
          progress: m.progress || 0,
          userJobId: m.userJobId || 'ocr-worker'
        };
        setProgress(progress);
      };

      const worker = await Tesseract.createWorker(languages, 1, {
        logger: progressCallback
      });

      // 한국어 영수증 최적화 설정
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzㄱ-ㅎㅏ-ㅣ가-힣 .,:-()[]/',
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
      });

      workerRef.current = worker;
      isInitializedRef.current = true;
      
    } catch (error) {
      console.error('OCR 워커 초기화 실패:', error);
      throw new Error('OCR 초기화에 실패했습니다.');
    }
  }, [languages, setProgress]);

  // 워커 종료
  const terminateWorker = useCallback(async (): Promise<void> => {
    if (workerRef.current) {
      try {
        await workerRef.current.terminate();
        workerRef.current = null;
        isInitializedRef.current = false;
      } catch (error) {
        console.error('워커 종료 오류:', error);
      }
    }
  }, []);

  // 이미지 처리 메인 함수
  const processImage = useCallback(async (file: File): Promise<ReceiptData | null> => {
    // 파일 검증
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error);
      return null;
    }

    setProcessing(true);
    setError(null);
    setProgress(null);
    setResult(null);

    try {
      await initializeWorker();

      if (!workerRef.current) {
        throw new Error('OCR 워커가 초기화되지 않았습니다.');
      }

      const startTime = Date.now();

      // 수동 진행 상황 업데이트
      setProgress({ status: '이미지 분석 시작', progress: 0.1, userJobId: 'ocr-job' });

      // 짧은 지연 후 OCR 시작
      await new Promise(resolve => setTimeout(resolve, 100));
      setProgress({ status: '텍스트 인식 중', progress: 0.3, userJobId: 'ocr-job' });

      // OCR 실행
      const result: RecognizeResult = await workerRef.current.recognize(file);

      setProgress({ status: '텍스트 처리 중', progress: 0.8, userJobId: 'ocr-job' });

      const processingTime = Date.now() - startTime;

      // 텍스트 파싱
      const ocrResult: OCRResult = {
        text: result.data.text.trim(),
        confidence: result.data.confidence,
        processingTime
      };

      const receiptData = parseReceiptText(ocrResult.text, ocrResult.confidence);
      
      setResult(receiptData);
      setProgress(null);
      
      return receiptData;

    } catch (error) {
      console.error('OCR 처리 오류:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : '텍스트 추출에 실패했습니다.';
      setError(errorMessage);
      return null;
    } finally {
      setProcessing(false);
    }
  }, [initializeWorker, setProcessing, setError, setProgress, setResult]);

  // 상태 초기화
  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      progress: null,
      error: null,
      result: null,
    });
  }, []);

  useEffect(() => {
    return () => {
      terminateWorker();
    };
  }, [terminateWorker]);

  return {
    state,
    processImage,
    reset,
    initializeWorker,
    terminateWorker,
  };
};

// 간편 사용을 위한 래퍼 훅
export const useSimpleOCR = () => {
  const { state, processImage, reset } = useOCR();
  
  const processFile = useCallback(async (file: File): Promise<boolean> => {
    const result = await processImage(file);
    return result !== null;
  }, [processImage]);

  return {
    isProcessing: state.isProcessing,
    progress: state.progress,
    error: state.error,
    result: state.result,
    processFile,
    reset,
  };
};