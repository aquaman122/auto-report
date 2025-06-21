import { useState } from "react";

interface UploadResponse {
  success: boolean;
  message: string;
  data?: any;
}

export const ReceiptUpload = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);

  // 파일을 Base64로 변환
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // "data:image/jpeg;base64," 부분 제거하고 base64 데이터만 추출
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 파일 크기 체크 (10MB 제한)
      if (file.size > 10 * 1024 * 1024) {
        alert('파일 크기는 10MB 이하여야 합니다.');
        return;
      }

      // 이미지 파일 체크
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드 가능합니다.');
        return;
      }

      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('파일을 선택해주세요.');
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      // 이미지를 Base64로 변환
      const base64Image = await fileToBase64(selectedFile);
      
      // N8N 웹훅으로 전송할 페이로드
      const payload = {
        image: {
          data: base64Image,
          mimeType: selectedFile.type,
          filename: selectedFile.name,
          size: selectedFile.size
        },
        metadata: {
          timestamp: new Date().toISOString(),
          userId: 'user-001',
          source: 'web-upload'
        }
      };

      const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/receipt-upload';
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`업로드 실패: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();

      setResult({
        success: true,
        message: '영수증이 성공적으로 처리되어 Google Sheets에 저장되었습니다!',
        data: responseData
      });

      // 성공 시 폼 초기화
      setSelectedFile(null);
      setPreviewUrl(null);

    } catch (error) {
      console.error('업로드 오류:', error);
      
      setResult({
        success: false,
        message: error instanceof Error ? error.message : '업로드 중 오류가 발생했습니다.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
        AI 영수증 자동 처리
      </h1>

      {/* 파일 선택 영역 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          영수증 이미지 선택
        </label>
        
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="hidden"
            id="file-input"
          />
          
          <label
            htmlFor="file-input"
            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              isUploading 
                ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
                : 'border-blue-300 bg-blue-50 hover:bg-blue-100'
            }`}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg className="w-8 h-8 mb-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">클릭해서 업로드</span> 또는 드래그 & 드롭
              </p>
              <p className="text-xs text-gray-500">PNG, JPG, JPEG (최대 10MB)</p>
            </div>
          </label>
        </div>
      </div>

      {/* 선택된 파일 정보 */}
      {selectedFile && (
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              onClick={resetForm}
              disabled={isUploading}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              제거
            </button>
          </div>
        </div>
      )}

      {/* 이미지 미리보기 */}
      {previewUrl && (
        <div className="mb-6">
          <img 
            src={previewUrl} 
            alt="영수증 미리보기" 
            className="w-full h-auto rounded border max-h-64 object-contain"
          />
        </div>
      )}

      {/* 업로드 버튼 */}
      <button
        onClick={handleUpload}
        disabled={!selectedFile || isUploading}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          !selectedFile || isUploading
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isUploading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            처리 중... (OCR → AI 분석 → 저장)
          </div>
        ) : (
          '🚀 영수증 처리하기'
        )}
      </button>

      {/* 결과 메시지 */}
      {result && (
        <div className={`mt-4 p-4 rounded-lg ${
          result.success 
            ? 'bg-green-100 border border-green-400 text-green-700'
            : 'bg-red-100 border border-red-400 text-red-700'
        }`}>
          <div className="flex items-start">
            <span className="mr-2">
              {result.success ? '✅' : '❌'}
            </span>
            <div>
              <p className="font-medium">{result.message}</p>
              {result.data && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer">처리 결과 보기</summary>
                  <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 사용법 안내 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900 mb-2">💡 사용법</h3>
        <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
          <li>영수증 이미지를 선택하세요</li>
          <li>"영수증 처리하기" 버튼을 클릭하세요</li>
          <li>서버에서 자동으로 OCR → AI 분석 → Google Sheets 저장</li>
          <li>완료되면 결과를 확인하세요</li>
        </ol>
        
        <div className="mt-3 text-xs text-gray-500">
          <p>🔒 모든 처리는 서버에서 안전하게 진행됩니다</p>
          <p>⚡ Google Vision API + Gemini AI로 최고 정확도 보장</p>
        </div>
      </div>
    </div>
  );
};