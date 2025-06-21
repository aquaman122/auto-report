import { useCallback, useRef, useState, type ChangeEvent } from "react";
import type { ReceiptData } from "../types/receipt";
import { useOCR } from "../hooks/useOCR";
import { useN8NIntegration } from "../hooks/useN8NIntegration";
import { createImagePreview, formatFileSize } from "../utils/fileHelpers";


interface ReceiptUploadProps {
  onDataExtracted?: (data: ReceiptData) => void;
  onSendComplete?: (success: boolean, data?: ReceiptData) => void;
  className?: string;
}


export const ReceiptUpload = ({
  onDataExtracted, 
  onSendComplete,
  className = ''
}: ReceiptUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const ocr = useOCR({
    onSuccess: (data) => {
      console.log('OCR 성공:', data);
      onDataExtracted?.(data);
    },
    onError: (error) => {
      console.error('OCR 실패:', error);
    }
  });

  const n8n = useN8NIntegration({
    onSuccess: (response) => {
      console.log('n8n 전송 성공:', response);
      onSendComplete?.(true, ocr.state.result || undefined);
    },
    onError: (error) => {
      console.error('n8n 전송 실패:', error);
      onSendComplete?.(false);
    }
  });

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    
    try {
      const preview = await createImagePreview(file);
      setImagePreview(preview);
      
      // 기존 상태 초기화
      ocr.reset();
      n8n.reset();
    } catch (error) {
      console.error('미리보기 생성 실패:', error);
    }
  }, [ocr, n8n]);

  const handleFileInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // OCR 처리
  const handleProcessOCR = useCallback(async () => {
    if (!selectedFile) return;
    await ocr.processImage(selectedFile);
  }, [selectedFile, ocr]);

  // n8n 전송
  const handleSendToN8N = useCallback(async () => {
    if (!ocr.state.result || !selectedFile) return;
    await n8n.sendToN8N(ocr.state.result, selectedFile);
  }, [ocr.state.result, selectedFile, n8n]);

  // 전체 초기화
  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setImagePreview('');
    ocr.reset();
    n8n.reset();
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [ocr, n8n]);

  // 파일 선택 트리거
  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 진행률 계산
  const getProgressPercentage = (): number => {
    if (!ocr.state.progress) return 0;
    return Math.round(ocr.state.progress.progress * 100);
  };

  // 업로드 존 동적 클래스
  const getUploadZoneClasses = (): string => {
    const baseClasses = "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 overflow-hidden";
    
    let stateClasses = "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50";
    
    if (dragActive) {
      stateClasses = "border-blue-500 bg-blue-100 transform scale-105 shadow-lg";
    } else if (ocr.state.error) {
      stateClasses = "border-red-400 bg-red-50";
    } else if (ocr.state.result) {
      stateClasses = "border-green-400 bg-green-50";
    } else if (selectedFile) {
      stateClasses = "border-green-300 bg-green-50";
    } else if (ocr.state.isProcessing) {
      stateClasses = "border-blue-400 bg-blue-50 pointer-events-none opacity-80";
    }
    
    return `${baseClasses} ${stateClasses}`;
  };

  return (
    <div className={`max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-xl ${className}`}>
      {/* 헤더 */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">📄 영수증 업로드</h2>
        <p className="text-gray-600 text-sm">영수증 사진을 업로드하면 자동으로 내용을 분석합니다</p>
      </div>

      {/* 파일 업로드 영역 */}
      <div 
        className={getUploadZoneClasses()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileSelect}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="camera"
          onChange={handleFileInputChange}
          className="absolute opacity-0 w-full h-full cursor-pointer"
        />
        
        {imagePreview ? (
          <div className="flex flex-col items-center gap-4">
            <img 
              src={imagePreview} 
              alt="영수증 미리보기" 
              className="max-w-full max-h-72 rounded-lg shadow-md object-contain"
            />
            <div className="flex flex-col gap-1 text-center">
              <span className="font-medium text-gray-700 text-sm">{selectedFile?.name}</span>
              <span className="text-gray-500 text-xs">
                {selectedFile && formatFileSize(selectedFile.size)}
              </span>
            </div>
          </div>
        ) : (
          <div className="pointer-events-none">
            <div className="text-5xl mb-4 opacity-70">📁</div>
            <p className="text-base font-medium text-gray-700 mb-2">
              클릭하거나 파일을 드래그해서 업로드
            </p>
            <small className="text-gray-500 text-sm">JPG, PNG, WebP 파일 (최대 10MB)</small>
          </div>
        )}
      </div>

      {/* 에러 메시지 */}
      {(ocr.state.error || n8n.error) && (
        <div className="flex items-center gap-2 p-3 mt-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <span className="text-base">⚠️</span>
          {ocr.state.error || n8n.error}
        </div>
      )}

      {/* OCR 진행 상황 */}
      {ocr.state.isProcessing && (
        <div className="mt-5 p-4 bg-gray-50 border-l-4 border-blue-500 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">🔍 텍스트 추출 중...</span>
            <span className="text-sm font-semibold text-blue-600">
              {getProgressPercentage()}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
          {ocr.state.progress && (
            <small className="text-gray-600 text-xs">{ocr.state.progress.status}</small>
          )}
        </div>
      )}

      {/* n8n 전송 상태 */}
      {n8n.isSending && (
        <div className="mt-5 p-4 bg-gray-50 border-l-4 border-blue-500 rounded-lg">
          <div className="flex items-center mb-2">
            <span className="text-sm font-medium text-gray-700">🚀 n8n으로 전송 중...</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-gradient-to-r from-transparent via-blue-500 to-transparent h-2 rounded-full animate-pulse" />
          </div>
        </div>
      )}

      {/* 액션 버튼들 */}
      <div className="flex gap-3 mt-6 flex-wrap">
        <button
          className="flex-1 min-w-32 flex items-center justify-center gap-2 px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 hover:transform hover:-translate-y-0.5"
          onClick={handleReset}
          disabled={ocr.state.isProcessing || n8n.isSending}
        >
          🔄 초기화
        </button>
        
        <button
          className="flex-1 min-w-32 flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 hover:transform hover:-translate-y-0.5"
          onClick={handleProcessOCR}
          disabled={!selectedFile || ocr.state.isProcessing || n8n.isSending}
        >
          {ocr.state.isProcessing ? '처리중...' : '🔍 텍스트 추출'}
        </button>
        
        {ocr.state.result && (
          <button
            className="flex-1 min-w-32 flex items-center justify-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 hover:transform hover:-translate-y-0.5"
            onClick={handleSendToN8N}
            disabled={n8n.isSending}
          >
            {n8n.isSending ? '전송중...' : '🚀 n8n으로 전송'}
          </button>
        )}
      </div>

      {/* 추출된 데이터 미리보기 */}
      {ocr.state.result && (
        <div className="mt-6 p-5 bg-gray-50 border border-gray-200 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 추출된 정보</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">상점명</label>
              <span className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-700">
                {ocr.state.result.store}
              </span>
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">날짜</label>
              <span className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-700">
                {ocr.state.result.date}
              </span>
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">금액</label>
              <span className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-semibold text-green-600">
                {ocr.state.result.amount.toLocaleString()}원
              </span>
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">신뢰도</label>
              <span className={`px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-semibold ${
                ocr.state.result.confidence > 80 ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {ocr.state.result.confidence.toFixed(1)}%
              </span>
            </div>
          </div>
          
          {ocr.state.result.items.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                구매 항목
              </label>
              <div className="flex flex-wrap gap-2">
                {ocr.state.result.items.map((item, index) => (
                  <span 
                    key={index} 
                    className="px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded-full"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          <details className="mt-4">
            <summary className="text-xs text-gray-600 cursor-pointer py-2 border-b border-gray-200 hover:text-gray-800">
              원본 텍스트 보기
            </summary>
            <pre className="mt-2 p-3 bg-white border border-gray-200 rounded-md text-xs text-gray-600 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
              {ocr.state.result.rawText}
            </pre>
          </details>
        </div>
      )}

      {/* 성공 메시지 */}
      {n8n.lastResponse && (
        <div className="flex items-center gap-2 p-3 mt-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm animate-in slide-in-from-top duration-300">
          <span className="text-base">✅</span>
          영수증이 성공적으로 처리되었습니다!
        </div>
      )}
    </div>
  );
};