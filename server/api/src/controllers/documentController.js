// documentController.js
const createDocument = async (meetingData) => {
  // 기존 문서 생성 로직
  const documentPath = await generateDocument(meetingData);
  
  // n8n 웹훅 호출 추가
  await axios.post('http://n8n:5678/webhook/wiki-upload', {
    documentPath: documentPath,
    meetingId: meetingData.id,
    title: meetingData.title,
    date: meetingData.date
  });
  
  return documentPath;
};