const MarkdownIt = require('markdown-it');
const TurndownService = require('turndown');

// 마크다운 파서 초기화
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

// HTML to Markdown 변환기
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

// 마크다운 포맷팅
const formatToMarkdown = (content) => {
  if (typeof content !== 'string') {
    return String(content);
  }

  // 이미 마크다운이면 그대로 반환
  if (isMarkdown(content)) {
    return content;
  }

  // HTML이면 마크다운으로 변환
  if (isHTML(content)) {
    return turndownService.turndown(content);
  }

  // 일반 텍스트면 기본 마크다운 포맷 적용
  return formatPlainText(content);
};

// 마크다운 여부 확인
const isMarkdown = (text) => {
  const markdownPatterns = [
    /^#{1,6}\s+/m,  // 헤더
    /\*\*.*?\*\*/,  // 볼드
    /\*.*?\*/,      // 이탤릭
    /\[.*?\]\(.*?\)/, // 링크
    /```/,          // 코드블록
    /^\s*[-*+]\s+/m // 리스트
  ];

  return markdownPatterns.some(pattern => pattern.test(text));
};

// HTML 여부 확인
const isHTML = (text) => {
  return /]+>/.test(text);
};

// 일반 텍스트를 마크다운으로 포맷팅
const formatPlainText = (text) => {
  return text
    .split('\n\n')
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0)
    .join('\n\n');
};

// Wiki 링크 포맷팅
const formatWikiLinks = (text, baseUrl) => {
  // [[페이지명]] 형태를 마크다운 링크로 변환
  return text.replace(/\[\[([^\]]+)\]\]/g, (match, pageName) => {
    const url = `${baseUrl}/pages/${encodeURIComponent(pageName)}`;
    return `[${pageName}](${url})`;
  });
};

// 테이블 포맷팅
const formatTable = (data) => {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const headerRow = `| ${headers.join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
  
  const dataRows = data.map(row => 
    `| ${headers.map(header => row[header] || '').join(' | ')} |`
  );

  return [headerRow, separatorRow, ...dataRows].join('\n');
};

module.exports = {
  formatToMarkdown,
  formatWikiLinks,
  formatTable,
  isMarkdown,
  isHTML
};