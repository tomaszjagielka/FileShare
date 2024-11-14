import { Header } from "./components/layout/Header";
import { FileUpload } from "./components/file/FileUpload";
import { FileList } from "./components/file/FileList";
import { useFiles } from "./hooks/useFiles";
import "./App.css";

function App() {
  const { files, isLoading, error, refetch } = useFiles();
  const serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

  return (
    <div className="container">
      <Header title="FileShare" subtitle="Simple, secure file sharing" />

      <main>
        <FileUpload onUpload={refetch} serverUrl={serverUrl} />
        {error && <div className="error-message">{error}</div>}
        {isLoading ? (
          <div className="loading">Loading...</div>
        ) : (
          <FileList files={files} />
        )}
      </main>
    </div>
  );
}

export default App;
