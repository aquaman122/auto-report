const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow, HeadingLevel } = require('docx');
const logger = require('../utils/logger');

class DocumentService {
  constructor() {
    this.ensureDirectories();
  }

  // 필요한 디렉토리 생성
  ensureDirectories() {
    const dirs = ['summaries', 'logs'];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // 회의록 문서 생성 (메인 함수)
  async generateMeetingDocument(structuredData, meetingMinutes, format = 'all') {
    try {
      const results = {};
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseName = `meeting_minutes_${timestamp}`;

      if (format === 'all' || format === 'html') {
        results.html = await this.generateHtmlDocument(structuredData, meetingMinutes, baseName);
      }

      if (format === 'all' || format === 'docx') {
        results.docx = await this.generateDocxDocument(structuredData, meetingMinutes, baseName);
      }

      if (format === 'all' || format === 'json') {
        results.json = await this.generateJsonDocument(structuredData, meetingMinutes, baseName);
      }

      logger.info(`문서 생성 완료: ${Object.keys(results).join(', ')}`);
      return results;

    } catch (error) {
      logger.error('문서 생성 실패:', error);
      throw new Error(`문서 생성 실패: ${error.message}`);
    }
  }

  // HTML 문서 생성
  async generateHtmlDocument(structuredData, meetingMinutes, baseName) {
    try {
      const meetingInfo = structuredData.meeting_info || {};
      const participants = structuredData.participants || [];
      const agendas = structuredData.agendas || [];
      const outcomes = structuredData.key_outcomes || {};

      const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${meetingInfo.title || '회의록'}</title>
    <style>
        body {
            font-family: '맑은 고딕', 'Malgun Gothic', Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 40px;
            background-color: #f8f9fa;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 40px;
        }
        .header h1 {
            color: #007bff;
            margin: 0;
            font-size: 28px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            background: #007bff;
            color: white;
            padding: 10px 15px;
            margin: 0 0 15px 0;
            font-size: 16px;
            font-weight: bold;
            border-radius: 4px;
        }
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .info-table th,
        .info-table td {
            border: 1px solid #dee2e6;
            padding: 12px;
            text-align: left;
        }
        .info-table th {
            background-color: #f8f9fa;
            font-weight: bold;
            width: 150px;
        }
        .participant {
            background: #f8f9fa;
            padding: 8px 12px;
            margin: 5px 0;
            border-radius: 4px;
            border-left: 4px solid #007bff;
        }
        .agenda {
            background: #ffffff;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin: 15px 0;
        }
        .agenda-title {
            color: #007bff;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .agenda-content {
            margin: 10px 0;
        }
        .action-item {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            padding: 10px;
            margin: 8px 0;
        }
        .action-item strong {
            color: #856404;
        }
        .decision-item {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 4px;
            padding: 10px;
            margin: 8px 0;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            text-align: right;
            color: #6c757d;
            font-size: 14px;
        }
        .print-only {
            display: none;
        }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
            .print-only { display: block; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${meetingInfo.title || '회의록'}</h1>
            <p class="print-only">생성일: ${new Date().toLocaleDateString('ko-KR')}</p>
        </div>

        <div class="section">
            <h2 class="section-title">■ 회의 개요</h2>
            <table class="info-table">
                <tr>
                    <th>회의 주제</th>
                    <td>${meetingInfo.title || '(제목 없음)'}</td>
                </tr>
                <tr>
                    <th>일시</th>
                    <td>${meetingInfo.estimated_date || new Date().toLocaleDateString('ko-KR')} ${meetingInfo.estimated_start_time || ''}${meetingInfo.estimated_end_time ? '~' + meetingInfo.estimated_end_time : ''}</td>
                </tr>
                <tr>
                    <th>장소</th>
                    <td>${meetingInfo.location || '(장소 미기재)'}</td>
                </tr>
                <tr>
                    <th>회의 유형</th>
                    <td>${meetingInfo.meeting_type || '일반회의'}</td>
                </tr>
            </table>
        </div>

        <div class="section">
            <h2 class="section-title">■ 참석자</h2>
            ${participants.map(p => `
                <div class="participant">
                    <strong>${p.name}</strong>${p.department ? ' (' + p.department + ')' : ''}${p.role ? ' - ' + p.role : ''}
                    ${p.key_contributions ? '<br><small>주요 발언: ' + p.key_contributions.slice(0, 2).join(', ') + '</small>' : ''}
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2 class="section-title">■ 회의 내용</h2>
            ${agendas.map((agenda, index) => `
                <div class="agenda">
                    <div class="agenda-title">${index + 1}. ${agenda.title}</div>
                    
                    <div class="agenda-content">
                        <strong>논의 내용:</strong><br>
                        ${agenda.discussion || '논의 내용 없음'}
                    </div>
                    
                    ${agenda.key_points && agenda.key_points.length > 0 ? `
                    <div class="agenda-content">
                        <strong>핵심 포인트:</strong><br>
                        <ul>
                            ${agenda.key_points.map(point => `<li>${point}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    
                    ${agenda.decisions ? `
                    <div class="decision-item">
                        <strong>결정 사항:</strong> ${agenda.decisions}
                    </div>
                    ` : ''}
                    
                    ${agenda.action_items && agenda.action_items.length > 0 ? `
                    <div class="agenda-content">
                        <strong>액션 아이템:</strong>
                        ${agenda.action_items.map(item => `
                        <div class="action-item">
                            <strong>📋 ${item.task}</strong><br>
                            ${item.assignee ? '👤 담당자: ' + item.assignee : ''} 
                            ${item.deadline ? ' | 📅 기한: ' + item.deadline : ''} 
                            ${item.priority ? ' | 🔥 우선순위: ' + item.priority : ''}
                        </div>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2 class="section-title">■ 주요 결과</h2>
            ${outcomes.main_decisions && outcomes.main_decisions.length > 0 ? `
            <div class="agenda-content">
                <strong>주요 결정사항:</strong>
                <ul>
                    ${outcomes.main_decisions.map(decision => `<li>${decision}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${outcomes.unresolved_issues && outcomes.unresolved_issues.length > 0 ? `
            <div class="agenda-content">
                <strong>미해결 사항:</strong>
                <ul>
                    ${outcomes.unresolved_issues.map(issue => `<li>${issue}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${outcomes.next_meeting_items && outcomes.next_meeting_items.length > 0 ? `
            <div class="agenda-content">
                <strong>다음 회의 안건:</strong>
                <ul>
                    ${outcomes.next_meeting_items.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
        </div>

        <div class="footer">
            <p>작성일: ${new Date().toLocaleDateString('ko-KR')}</p>
            <p>작성자: AI 자동생성 시스템 v1.0</p>
        </div>
    </div>

    <script>
        // 인쇄 기능
        function printDocument() {
            window.print();
        }
        
        // 키보드 단축키 (Ctrl+P)
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                printDocument();
            }
        });
    </script>
</body>
</html>
      `;

      const fileName = `${baseName}.html`;
      const filePath = path.join('summaries', fileName);
      
      fs.writeFileSync(filePath, htmlContent, 'utf8');

      return {
        fileName,
        filePath,
        format: 'html',
        url: `/summaries/${fileName}`
      };

    } catch (error) {
      logger.error('HTML 문서 생성 실패:', error);
      throw error;
    }
  }

  // DOCX 문서 생성
  async generateDocxDocument(structuredData, meetingMinutes, baseName) {
    try {
      const meetingInfo = structuredData.meeting_info || {};
      const participants = structuredData.participants || [];
      const agendas = structuredData.agendas || [];

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // 제목
            new Paragraph({
              children: [
                new TextRun({
                  text: meetingInfo.title || '회의록',
                  bold: true,
                  size: 32,
                  font: '맑은 고딕'
                })
              ],
              heading: HeadingLevel.TITLE,
              alignment: 'center',
              spacing: { after: 400 }
            }),

            // 회의 개요
            new Paragraph({
              children: [
                new TextRun({
                  text: '■ 회의 개요',
                  bold: true,
                  size: 24,
                  font: '맑은 고딕'
                })
              ],
              spacing: { before: 200, after: 200 }
            }),

            // 회의 정보 테이블
            new Table({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: '회의 주제', bold: true })] })],
                      width: { size: 2000, type: 'dxa' }
                    }),
                    new TableCell({
                      children: [new Paragraph(meetingInfo.title || '(제목 없음)')]
                    })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: '일시', bold: true })] })]
                    }),
                    new TableCell({
                      children: [new Paragraph(`${meetingInfo.estimated_date || new Date().toLocaleDateString('ko-KR')} ${meetingInfo.estimated_start_time || ''}${meetingInfo.estimated_end_time ? '~' + meetingInfo.estimated_end_time : ''}`)]
                    })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: '장소', bold: true })] })]
                    }),
                    new TableCell({
                      children: [new Paragraph(meetingInfo.location || '(장소 미기재)')]
                    })
                  ]
                })
              ]
            }),

            // 참석자
            new Paragraph({
              children: [
                new TextRun({
                  text: '■ 참석자',
                  bold: true,
                  size: 24,
                  font: '맑은 고딕'
                })
              ],
              spacing: { before: 400, after: 200 }
            }),

            ...participants.map(p => 
              new Paragraph({
                children: [
                  new TextRun({
                    text: `• ${p.name}${p.department ? ' (' + p.department + ')' : ''}${p.role ? ' - ' + p.role : ''}`,
                    font: '맑은 고딕'
                  })
                ],
                spacing: { after: 100 }
              })
            ),

            // 회의 내용
            new Paragraph({
              children: [
                new TextRun({
                  text: '■ 회의 내용',
                  bold: true,
                  size: 24,
                  font: '맑은 고딕'
                })
              ],
              spacing: { before: 400, after: 200 }
            }),

            ...agendas.flatMap((agenda, index) => [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${index + 1}. ${agenda.title}`,
                    bold: true,
                    size: 22,
                    font: '맑은 고딕'
                  })
                ],
                spacing: { before: 200, after: 100 }
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `논의내용: ${agenda.discussion || '논의 내용 없음'}`,
                    font: '맑은 고딕'
                  })
                ],
                spacing: { after: 100 }
              }),
              ...(agenda.decisions ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `결정사항: ${agenda.decisions}`,
                      font: '맑은 고딕'
                    })
                  ],
                  spacing: { after: 100 }
                })
              ] : []),
              ...(agenda.action_items && agenda.action_items.length > 0 ? 
                agenda.action_items.map(item => 
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `  • ${item.task}${item.assignee ? ' (담당: ' + item.assignee + ')' : ''}${item.deadline ? ' [기한: ' + item.deadline + ']' : ''}`,
                        font: '맑은 고딕'
                      })
                    ],
                    spacing: { after: 100 }
                  })
                ) : []
              )
            ]),

            // 작성 정보
            new Paragraph({
              children: [
                new TextRun({
                  text: `작성일: ${new Date().toLocaleDateString('ko-KR')}`,
                  font: '맑은 고딕',
                  size: 18
                })
              ],
              spacing: { before: 400 },
              alignment: 'right'
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: '작성자: AI 자동생성 시스템',
                  font: '맑은 고딕',
                  size: 18
                })
              ],
              alignment: 'right'
            })
          ]
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      const fileName = `${baseName}.docx`;
      const filePath = path.join('summaries', fileName);
      
      fs.writeFileSync(filePath, buffer);

      return {
        fileName,
        filePath,
        format: 'docx',
        url: `/summaries/${fileName}`
      };

    } catch (error) {
      logger.error('DOCX 문서 생성 실패:', error);
      throw error;
    }
  }

  // JSON 문서 생성 (백업 및 API 사용)
  async generateJsonDocument(structuredData, meetingMinutes, baseName) {
    try {
      const jsonData = {
        metadata: {
          generated_at: new Date().toISOString(),
          generator: 'voice-meeting-automation-v1.0',
          format_version: '1.0'
        },
        meeting_info: structuredData.meeting_info,
        participants: structuredData.participants,
        agendas: structuredData.agendas,
        key_outcomes: structuredData.key_outcomes,
        analysis_metadata: structuredData.analysis_metadata,
        generated_minutes: meetingMinutes
      };

      const fileName = `${baseName}.json`;
      const filePath = path.join('summaries', fileName);
      
      fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');

      return {
        fileName,
        filePath,
        format: 'json',
        url: `/summaries/${fileName}`
      };

    } catch (error) {
      logger.error('JSON 문서 생성 실패:', error);
      throw error;
    }
  }

  // 파일 삭제
  async deleteDocument(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`문서 삭제 완료: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('문서 삭제 실패:', error);
      return false;
    }
  }

  // 파일 목록 조회
  getDocumentList(directory = 'summaries') {
    try {
      if (!fs.existsSync(directory)) {
        return [];
      }

      const files = fs.readdirSync(directory)
        .filter(file => !file.startsWith('.'))
        .map(file => {
          const filePath = path.join(directory, file);
          const stats = fs.statSync(filePath);
          const ext = path.extname(file).toLowerCase();

          return {
            fileName: file,
            filePath,
            fileSize: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            format: ext.replace('.', ''),
            url: `/${directory}/${file}`
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);

      return files;

    } catch (error) {
      logger.error('문서 목록 조회 실패:', error);
      return [];
    }
  }
}

module.exports = new DocumentService();