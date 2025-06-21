import { useCallback, useState } from "react";
import type { N8NPayload, ReceiptData } from "../types/receipt";
import { fileToBase64 } from "../utils/fileHelpers";

interface UseN8NConfig {
  webhookUrl?: string;
  userId?: string;
  onSuccess?: (response: any) => void;
  onError?: (error: string) => void;
  timeout?: number;
}

interface UseN8NReturn {
  isSending: boolean;
  error: string | null;
  lastResponse: any;
  sendToN8N: (data: ReceiptData, file: File) => Promise<boolean>;
  reset: () => void;
}

export const useN8NIntegration = (config: UseN8NConfig = {}): UseN8NReturn => {
  const {
    webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || '',
    userId = 'test-user',
    onSuccess,
    onError,
    timeout = 30000
  } = config;

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<any>(null);

  // n8n으로 데이터 전송
  const sendToN8N = useCallback(async (data: ReceiptData, file: File): Promise<boolean> => {
    if (!webhookUrl) {
      const errorMsg = 'N8N Webhook URL이 설정되지 않았습니다.';
      setError(errorMsg);
      onError?.(errorMsg);
      return false;
    }

    setIsSending(true);
    setError(null);
    setLastResponse(null);

    try {

      // 이미지를 Base64로 변환
      const imageBase64 = await fileToBase64(file);

      // n8n 페이로드 구성
      const payload: N8NPayload = {
        extractedData: data,
        ocrText: data.rawText,
        imageBase64,
        metadata: {
          timestamp: new Date().toISOString(),
          userId,
          source: 'web-app'
        }
      };

      // AbortController로 타임아웃 처리
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let result;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        result = await response.json();
      } else {
        result = { message: await response.text() };
      }

      setLastResponse(result);
      onSuccess?.(result);
      
      return true;

    } catch (error) {
      let errorMessage: string;

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = '요청 시간이 초과되었습니다.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = '네트워크 연결을 확인해주세요.';
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = 'n8n 전송 중 알 수 없는 오류가 발생했습니다.';
      }

      setError(errorMessage);
      onError?.(errorMessage);
      return false;

    } finally {
      setIsSending(false);
    }
  }, [webhookUrl, userId, timeout, onSuccess, onError]);

  // 상태 초기화
  const reset = useCallback(() => {
    setIsSending(false);
    setError(null);
    setLastResponse(null);
  }, []);

  return {
    isSending,
    error,
    lastResponse,
    sendToN8N,
    reset,
  };
};

// 재시도 기능이 있는 향상된 훅
export const useN8NWithRetry = (config: UseN8NConfig & { maxRetries?: number } = {}) => {
  const { maxRetries = 3, ...n8nConfig } = config;
  const baseHook = useN8NIntegration(n8nConfig);
  
  const [retryCount, setRetryCount] = useState(0);

  const sendWithRetry = useCallback(async (data: ReceiptData, file: File): Promise<boolean> => {
    let attempt = 0;
    
    while (attempt <= maxRetries) {
      setRetryCount(attempt);
      
      const success = await baseHook.sendToN8N(data, file);
      if (success) {
        setRetryCount(0);
        return true;
      }
      
      attempt++;
      if (attempt <= maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 점진적 지연
      }
    }
    
    setRetryCount(0);
    return false;
  }, [baseHook, maxRetries]);

  return {
    ...baseHook,
    retryCount,
    sendToN8N: sendWithRetry,
  };
};