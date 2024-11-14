const API_BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export const fetchFiles = async () => {
  const response = await fetch(`${API_BASE_URL}/files`);

  if (!response.ok) {
    throw new Error("Failed to fetch files");
  }

  return response.json();
};

export const uploadFile = async (formData) => {
  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to upload file");
  }

  return response.json();
};

export const getDownloadUrl = (fileId) => `${API_BASE_URL}/download/${fileId}`;
