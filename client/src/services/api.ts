import type { N8NPayload, ReceiptData } from "../types/receipt";

const API_CONFIG = {
  n8nWebhook: import.meta.env.VITE_N8N_WEBHOOK_URL || '',
  timeout: 30000,
  retryAttempts: 3,
  defaultHeaders: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
} as const;

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

interface FetchOptions extends RequestInit {
  timeout?: number;
}

const fetchWithTimeout = async (url: string, options: FetchOptions = {}): Promise<Response> => {
  const { timeout = API_CONFIG.timeout, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const getErrorMessage = (error: unknown): any => {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return ' 요청 시간 초과';
    }
    if (error.message.includes('Failed to fetch')) {
      return '네트워크 연결 연결확인해';
    }
    return error.message;
  }
  return '오류 발생 이유 모름';
};

const parseResponse = async (response: Response): Promise<any> => {
  const contentType = response.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text || { message: 'Success' };
};

export const postRequest = async <T = any>(
url: string, 
  data: any, 
  options: FetchOptions = {}
): Promise<ApiResponse<T>> => {
  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        ...API_CONFIG.defaultHeaders,
        ...options.headers,
      },
      body: JSON.stringify(data),
      ...options,
    });

    const responseData = await parseResponse(response);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      };
    }

    return {
      success: true,
      data: responseData,
      status: response.status,
    };

  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
};

export const getRequest = async <T = any>(
  url: string, 
  options: FetchOptions = {}
): Promise<ApiResponse<T>> => {
  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        ...API_CONFIG.defaultHeaders,
        ...options.headers,
      },
      ...options,
    });

    const responseData = await parseResponse(response);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      };
    }

    return {
      success: true,
      data: responseData,
      status: response.status,
    };

  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
};

export const n8nApi = {
  async sendReceipt(payload: N8NPayload): Promise<ApiResponse> {
    if (!API_CONFIG.n8nWebhook) {
      return {
        success: false,
        error: 'N8N Webhook URL이 설정되지 않았습니다. 환경변수를 확인해주세요.',
      };
    }

    return postRequest(API_CONFIG.n8nWebhook, payload);
  },

  async testConnection(): Promise<ApiResponse> {
    if (!API_CONFIG.n8nWebhook) {
      return {
        success: false,
        error: 'Webhook URL이 설정되지 않았습니다.',
      };
    }

    const testPayload = {
      test: true,
      timestamp: new Date().toISOString(),
    };

    return postRequest(API_CONFIG.n8nWebhook, testPayload);
  },

  async sendReceiptWithRetry(
    payload: N8NPayload, 
    maxRetries = API_CONFIG.retryAttempts
  ): Promise<ApiResponse> {
    let lastError: string = '';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      
      const response = await this.sendReceipt(payload);
      
      if (response.success) {
        return response;
      }
      
      lastError = response.error || '전송 실패';
      
      if (attempt < maxRetries) {
        const delay = 1000 * attempt;
        console.log(`${delay}ms 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return {
      success: false,
      error: `${maxRetries}번 시도 후 실패: ${lastError}`,
    };
  },

  // 인증 필요 시
  async sendReceiptWithAuth(
    payload: N8NPayload, 
    authToken?: string
  ): Promise<ApiResponse> {
    if (!API_CONFIG.n8nWebhook) {
      return {
        success: false,
        error: 'N8N Webhook URL이 설정되지 않았습니다.',
      };
    }

    const headers: Record<string, string> = {};
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    return postRequest(API_CONFIG.n8nWebhook, payload, { headers });
  },
};

export const apiUtils = {
  checkConfiguration(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    if (!API_CONFIG.n8nWebhook) {
      missing.push('VITE_N8N_WEBHOOK_URL');
    }
    
    return {
      valid: missing.length === 0,
      missing,
    };
  },

  async healthCheck(): Promise<{ n8n: boolean; errors: string[] }> {
    const errors: string[] = [];
    let n8nStatus = false;
    
    try {
      const response = await n8nApi.testConnection();
      n8nStatus = response.success;
      if (!response.success) {
        errors.push(`n8n: ${response.error}`);
      }
    } catch (error) {
      errors.push(`n8n: ${getErrorMessage(error)}`);
    }
    
    return {
      n8n: n8nStatus,
      errors,
    };
  },

  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  getConfig() {
    return {
      webhookUrl: API_CONFIG.n8nWebhook,
      timeout: API_CONFIG.timeout,
      retryAttempts: API_CONFIG.retryAttempts,
      hasValidConfig: !!API_CONFIG.n8nWebhook,
    };
  },
};

// 타입 가드
export const typeGuards = {
  isValidReceiptData(data: any): data is ReceiptData {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.store === 'string' &&
      typeof data.date === 'string' &&
      typeof data.amount === 'number' &&
      Array.isArray(data.items) &&
      typeof data.rawText === 'string' &&
      typeof data.confidence === 'number'
    );
  },

  isValidN8NPayload(data: any): data is N8NPayload {
    return (
      typeof data === 'object' &&
      data !== null &&
      this.isValidReceiptData(data.extractedData) &&
      typeof data.ocrText === 'string' &&
      typeof data.imageBase64 === 'string' &&
      typeof data.metadata === 'object' &&
      data.metadata !== null
    );
  },

  isApiResponse(data: any): data is ApiResponse {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.success === 'boolean'
    );
  },
};

export const quickApi = {
  // 에러 무시 전송
  async quickSendToN8N(payload: N8NPayload): Promise<boolean> {
    try {
      const response = await n8nApi.sendReceipt(payload);
      return response.success;
    } catch {
      return false;
    }
  },

  // Promise 기반 간단한 전송
  sendReceiptPromise(payload: N8NPayload): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const response = await n8nApi.sendReceipt(payload);
      if (response.success) {
        resolve(response.data);
      } else {
        reject(new Error(response.error || '전송 실패'));
      }
    });
  },
};