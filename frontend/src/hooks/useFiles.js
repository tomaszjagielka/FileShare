import { useState, useEffect, useCallback } from "react";
import * as api from "../services/api";

/* Files hook - manages file list state and periodic refresh functionality. */

export const useFiles = (refreshInterval = 5000) => {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFiles = useCallback(async () => {
    try {
      const data = await api.fetchFiles();
      setFiles(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
    const interval = setInterval(fetchFiles, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchFiles, refreshInterval]);

  return { files, isLoading, error, refetch: fetchFiles };
};
