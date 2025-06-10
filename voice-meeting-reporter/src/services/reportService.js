const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const reportTemplate = require('../templates/reportTemplate');

class ReportService {
  async generateReport(data) {
    try {
      const timestamp = moment().format('YYYYMMDD_HHmmss');
      const filename = `회의록_${data.title.replace(/[^\w가-힣]/g, '_')}_${timestamp}.txt`;
      const filePath = path.join('./reports', filename);
      
      const reportContent = reportTemplate.generateReport(data);
      
      await fs.writeFile(filePath, reportContent, 'utf8');
      
      return {
        filename,
        filePath: path.resolve(filePath),
        content: reportContent
      };
    } catch (error) {
      console.error('보고서 생성 오류:', error);
      throw new Error(`보고서 생성 실패: ${error.message}`);
    }
  }
}

module.exports = new ReportService();