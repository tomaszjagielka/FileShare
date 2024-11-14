import { useState, useEffect, useCallback } from "react";
import FileUpload from "./components/FileUpload";
import FileList from "./components/FileList";
import "./App.css";

function App() {
  const [files, setFiles] = useState([]);
  const serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

  const fetchFiles = useCallback(async () => {
    try {
      const response = await fetch(`${serverUrl}/files`);
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      console.error("Failed to fetch files:", error);
    }
  }, [serverUrl]);

  useEffect(() => {
    fetchFiles();
    const interval = setInterval(fetchFiles, 5000);
    return () => clearInterval(interval);
  }, [fetchFiles]);

  const handleFileUpload = (newFiles) => {
    setFiles((prev) => [...prev, ...newFiles]);
    fetchFiles();
  };

  return (
    <div className="container">
      <header>
        <h1>FileShare</h1>
        <p className="subtitle">Simple, secure file sharing</p>
      </header>

      <main>
        <FileUpload onUpload={handleFileUpload} serverUrl={serverUrl} />
        <FileList files={files} />
      </main>
    </div>
  );
}

export default App;
