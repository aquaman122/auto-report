import type { ReceiptData } from "../types/receipt";

// 상점명 추출
export const extractStoreName = (lines: string[]): string => {
  const firstLine = lines[0]?.trim();
  if (!firstLine) return '미확인';
  
  // 상점명 패턴들
  const storePatterns = [
    /^([가-힣A-Za-z\s]+)(?:점|마트|편의점|카페|스토어)?/,
    /([가-힣A-Za-z]+(?:마트|편의점|카페|스토어|치킨|피자|버거))/,
    /^([가-힣A-Za-z0-9\s]{2,20})/
  ];
  
  for (const pattern of storePatterns) {
    const match = firstLine.match(pattern);
    if (match) {
      const storeName = match[1].trim();
      if (storeName.length >= 2) {
        return storeName.length > 20 ? storeName.substring(0, 20) + '...' : storeName;
      }
    }
  }
  
  return firstLine.length > 20 ? firstLine.substring(0, 20) + '...' : firstLine;
};

// 날짜 추출 및 정규화
export const extractDate = (text: string): string => {
  const datePatterns = [
    /(\d{4}[-./]\d{2}[-./]\d{2})/,           // 2024-01-15, 2024.01.15
    /(\d{2}[-./]\d{2}[-./]\d{4})/,           // 15-01-2024
    /(\d{4}년\s*\d{1,2}월\s*\d{1,2}일)/,      // 2024년 1월 15일
    /(\d{1,2}월\s*\d{1,2}일)/,               // 1월 15일 (올해)
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return normalizeDate(match[1]);
    }
  }
  
  return new Date().toISOString().split('T')[0];
};

// 날짜 정규화 (YYYY-MM-DD 형식으로)
const normalizeDate = (dateStr: string): string => {
  const currentYear = new Date().getFullYear();
  
  // 한국어 날짜 처리
  if (dateStr.includes('년')) {
    const match = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (match) {
      const [, year, month, day] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  
  // 월일만 있는 경우 (올해로 가정)
  if (dateStr.includes('월')) {
    const match = dateStr.match(/(\d{1,2})월\s*(\d{1,2})일/);
    if (match) {
      const [, month, day] = match;
      return `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  
  // 구분자 통일 후 처리
  const cleaned = dateStr.replace(/[./]/g, '-');
  const parts = cleaned.split('-');
  
  if (parts.length === 3) {
    const [a, b, c] = parts;
    
    // YYYY-MM-DD 형식
    if (a.length === 4) {
      return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    }
    
    // DD-MM-YYYY 형식
    if (c.length === 4) {
      return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    }
  }
  
  return new Date().toISOString().split('T')[0];
};

// 금액 추출
export const extractAmount = (text: string): number => {
  const amountPatterns = [
    /합계[:\s]*([0-9,]+)원?/i,
    /총액[:\s]*([0-9,]+)원?/i,
    /결제[금액]*[:\s]*([0-9,]+)원?/i,
    /total[:\s]*([0-9,]+)/i,
    /받을금액[:\s]*([0-9,]+)원?/i,
    /([0-9,]+)원(?:\s*$)/m,                    // 줄 끝의 금액
    /\b([0-9]{1,3}(?:,[0-9]{3})+)\b/,         // 콤마가 있는 큰 금액
  ];
  
  const amounts: number[] = [];
  
  for (const pattern of amountPatterns) {
    const matches = [...text.matchAll(new RegExp(pattern, 'gi'))];
    for (const match of matches) {
      const amountStr = match[1].replace(/,/g, '');
      const amount = parseInt(amountStr);
      if (!isNaN(amount) && amount > 0 && amount < 10000000) { // 1천만원 미만
        amounts.push(amount);
      }
    }
  }
  
  if (amounts.length === 0) return 0;
  
  // 가장 큰 금액을 총액으로 가정 (보통 합계가 가장 크므로)
  return Math.max(...amounts);
};

// 상품 항목 추출
export const extractItems = (lines: string[]): string[] => {
  const items: string[] = [];
  const excludePatterns = [
    /^(TEL|전화|주소|사업자|대표)/,
    /^(합계|총액|받은금액|거스름돈|카드|현금|신용카드)/,
    /^(감사합니다|고맙습니다|또 오세요|재방문)/,
    /^\d{4}[-./]\d{2}[-./]\d{2}/,              // 날짜
    /^\d{2}:\d{2}/,                           // 시간
    /^(영수증|receipt|주문번호|order)/i,
    /^(부가세|tax|vat)/i,
  ];
  
  // 상품명-가격 패턴들
  const itemPatterns = [
    /^([가-힣A-Za-z0-9\s]{2,20})\s+([0-9,]+)원?$/,    // 상품명 + 가격
    /^([가-힣A-Za-z0-9\s]{2,15})\s*$/,                 // 상품명만
  ];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 2) continue;
    
    // 제외 패턴 체크
    if (excludePatterns.some(pattern => pattern.test(trimmed))) continue;
    
    // 상품 패턴 매칭
    for (const pattern of itemPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const itemName = match[1].trim();
        if (itemName.length >= 2 && itemName.length <= 20) {
          // 중복 제거
          if (!items.some(item => item.includes(itemName) || itemName.includes(item))) {
            items.push(itemName);
          }
        }
        break;
      }
    }
    
    if (items.length >= 10) break; // 최대 10개
  }
  
  return items;
};

// 자동 카테고리 분류
// 추후 우리가 사용할 SW 외부 서비스 등 추가
export const categorizeStore = (storeName: string): string => {
  const categories = {
    '편의점': ['CU', 'GS25', '세븐일레븐', 'Seven', '이마트24', 'emart24', '미니스톱'],
    '카페': ['스타벅스', 'Starbucks', '이디야', 'EDIYA', '카페베네', '투썸플레이스', '탐앤탐스', '커피빈', '할리스', '메가커피'],
    '마트': ['이마트', 'emart', '롯데마트', '홈플러스', '코스트코', 'Costco', '하나로마트'],
    '음식점': ['맥도날드', 'McDonald', 'KFC', '버거킹', 'BurgerKing', '치킨', '피자', '족발', '보쌈'],
    '주유소': ['GS칼텍스', 'SK에너지', 'S-Oil', '현대오일뱅크', '주유소'],
    '약국': ['온누리약국', '세이브존', '약국', 'pharmacy'],
    '베이커리': ['파리바게뜨', '뚜레쥬르', '베이커리', '빵집', 'bakery'],
    '의류': ['유니클로', 'UNIQLO', 'ZARA', 'H&M', '의류', '옷'],
  };
  
  const upperStoreName = storeName.toUpperCase();
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => upperStoreName.includes(keyword.toUpperCase()))) {
      return category;
    }
  }
  
  return '기타';
};

// 메인 파싱 함수
export const parseReceiptText = (text: string, confidence: number): ReceiptData => {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  const store = extractStoreName(lines);
  const date = extractDate(text);
  const amount = extractAmount(text);
  const items = extractItems(lines);
  
  return {
    store,
    date,
    amount,
    items,
    rawText: text,
    confidence,
  };
};