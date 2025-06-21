import type { FileValidationResult } from "../types/receipt";


export const validateImageFile = (file: File): FileValidationResult => {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: '이미지 파일만 업로드 가능합니다.' };
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: '파일 크기는 10MB를 초과할 수 없습니다.' };
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'JPG, PNG, WebP 파일만 지원됩니다.' };
  }

  return { valid: true };
};

// 파일을 Base64로 변환
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // "data:image/jpeg;base64," 부분 제거
    };
    reader.onerror = () => reject(new Error('파일 읽기에 실패했습니다.'));
    reader.readAsDataURL(file);
  });
};

// 이미지 미리보기 URL 생성
export const createImagePreview = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('미리보기 생성에 실패했습니다.'));
    reader.readAsDataURL(file);
  });
};

// 파일 크기를 읽기 쉬운 형태로 변환
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// 파일 확장자 추출
export const getFileExtension = (filename: string): string => {
  return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
};

// 안전한 파일명 생성 (특수문자 제거)
export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100); // 최대 100자
};