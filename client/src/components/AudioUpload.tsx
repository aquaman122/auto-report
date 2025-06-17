import React, { useState, useRef, useEffect } from 'react';

interface AudioFile {
  filename: string;
  size: number;
  uploadDate: string;
  path: string;
}

interface ProcessingStatus {
  [filename: string]: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
}

const AudioUpload: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({});
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [reports, setReports] = useState<{[key: string]: any}>({});
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_BASE_URL = 'http://localhost:3001/api';

  useEffect(() => {
    loadAudioFiles();
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = [
        'audio/m4a',
        'audio/mp4',
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/flac',
        'audio/aac',
        'audio/ogg',
        'audio/x-m4a',
        'application/octet-stream'
      ];
      
      const allowedExtensions = /\.(m4a|mp3|wav|flac|aac|ogg)$/i;
      const hasValidExtension = allowedExtensions.test(file.name);
      const hasValidMimeType = allowedTypes.includes(file.type);
      
      if (!hasValidExtension && !hasValidMimeType) {
        setError('오디오 파일만 업로드 가능합니다. (m4a, mp3, wav, flac, aac, ogg)');
        return;
      }
      
      if (file.size > 100 * 1024 * 1024) {
        setError('파일 크기는 100MB를 초과할 수 없습니다.');
        return;
      }

      setSelectedFile(file);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('업로드할 파일을 선택해주세요.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError('');

    const formData = new FormData();
    formData.append('audio', selectedFile);

    try {
      // 파일 업로드 endpoint
      const response = await fetch(`${API_BASE_URL}/upload-audio`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('업로드에 실패했습니다.');
      }

      const result = await response.json();
      
      if (result.success) {
        setUploadProgress(100);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        await loadAudioFiles();
        
        await processAudio(result.file.filename);
      } else {
        throw new Error(result.error || '업로드에 실패했습니다.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const processAudio = async (filename: string) => {
    setProcessingStatus(prev => ({ ...prev, [filename]: 'processing' }));

    try {
      // 처리 시작 endpoint
      const response = await fetch(`${API_BASE_URL}/process-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename }),
      });

      if (!response.ok) {
        throw new Error('처리 요청에 실패했습니다.');
      }

      await pollProcessingStatus(filename);
      
    } catch (err) {
      setProcessingStatus(prev => ({ ...prev, [filename]: 'error' }));
      setError(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    }
  };

  const pollProcessingStatus = async (filename: string) => {
    const maxAttempts = 180;
    let attempts = 0;

    const poll = async () => {
      try {
        // 상태 확인 endpoint
        const response = await fetch(`${API_BASE_URL}/status/${filename}`);
        const result = await response.json();

        if (result.success && result.status === 'completed') {
          setProcessingStatus(prev => ({ ...prev, [filename]: 'completed' }));
          setReports(prev => ({ ...prev, [filename]: result.data }));
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 600000);
        } else {
          setProcessingStatus(prev => ({ ...prev, [filename]: 'error' }));
          setError('처리 시간이 초과되었습니다.');
        }
      } catch (err) {
        setProcessingStatus(prev => ({ ...prev, [filename]: 'error' }));
        setError('상태 확인 중 오류가 발생했습니다.');
      }
    };

    poll();
  };

  const loadAudioFiles = async () => {
    try {
      // 파일 목록 endpoint
      const response = await fetch(`${API_BASE_URL}/audio-files`);
      const result = await response.json();

      if (result.success) {
        setAudioFiles(result.files);
        
        result.files.forEach((file: AudioFile) => {
          checkFileStatus(file.filename);
        });
      }
    } catch (err) {
      console.error('파일 목록 로드 오류:', err);
    }
  };

  const checkFileStatus = async (filename: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/status/${filename}`);
      const result = await response.json();

      if (result.success) {
        setProcessingStatus(prev => ({ 
          ...prev, 
          [filename]: result.status === 'completed' ? 'completed' : 'idle' 
        }));
        
        if (result.status === 'completed') {
          setReports(prev => ({ ...prev, [filename]: result.data }));
        }
      }
    } catch (err) {
      console.error('파일 상태 확인 오류:', err);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          음성 파일 업로드
        </h2>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          
          {!selectedFile ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              음성 파일 선택
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-gray-600">
                선택된 파일: <span className="font-medium">{selectedFile.name}</span>
              </p>
              <p className="text-sm text-gray-500">
                크기: {formatFileSize(selectedFile.size)}
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isUploading ? '업로드 중...' : '업로드'}
                </button>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={isUploading}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

        {isUploading && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>업로드 진행률</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">
            업로드된 파일 목록
          </h3>
          <button
            onClick={loadAudioFiles}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            새로고침
          </button>
        </div>

        {audioFiles.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            업로드된 파일이 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {audioFiles.map((file) => (
              <div
                key={file.filename}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div>
                      <p className="font-medium text-gray-800">
                        {file.filename}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(file.size)} • {formatDate(file.uploadDate)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {processingStatus[file.filename] === 'idle' && (
                      <button
                        onClick={() => processAudio(file.filename)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                      >
                        처리 시작
                      </button>
                    )}
                    
                    {processingStatus[file.filename] === 'processing' && (
                      <span className="text-blue-500 text-sm font-medium">
                        처리 중...
                      </span>
                    )}
                    
                    {processingStatus[file.filename] === 'completed' && (
                      <span className="text-green-500 text-sm font-medium">
                        완료
                      </span>
                    )}
                    
                    {processingStatus[file.filename] === 'error' && (
                      <span className="text-red-500 text-sm font-medium">
                        오류
                      </span>
                    )}
                  </div>
                </div>

                {processingStatus[file.filename] === 'completed' && reports[file.filename] && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <h4 className="font-medium text-gray-800 mb-2">
                      생성된 보고서
                    </h4>
                    <div className="bg-gray-50 rounded p-3 text-sm">
                      <p className="text-gray-600">
                        <strong>제목:</strong> {reports[file.filename].json?.meeting_title || 'N/A'}
                      </p>
                      <p className="text-gray-600">
                        <strong>날짜:</strong> {reports[file.filename].json?.meeting_date_formatted || 'N/A'}
                      </p>
                      <p className="text-gray-600">
                        <strong>장소:</strong> {reports[file.filename].json?.meeting_place || 'N/A'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioUpload;