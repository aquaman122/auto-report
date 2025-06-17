import './App.css'
import AudioUpload from './components/AudioUpload'

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            스마트 음성 회의록 자동화
          </h1>
          <p className="text-gray-600">
            음성 파일을 업로드하면 AI가 자동으로 회의록을 생성합니다
          </p>
        </header>
        
        <AudioUpload />
      </div>
    </div>
  )
}

export default App
