
import React, { useCallback, useState } from 'react';
import { UploadIcon } from './icons/Icons';

interface FileUploadProps {
  label: string;
  onFileUpload: (content: string, name: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ label, onFileUpload }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (file && file.name.endsWith('.srt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onFileUpload(content, file.name);
      };
      reader.readAsText(file);
    } else {
      alert('Please upload a valid .srt file.');
    }
  };

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [onFileUpload]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative flex flex-col items-center justify-center w-full md:w-80 h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
        isDragging ? 'border-sky-400 bg-gray-700' : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
      }`}
    >
      <input
        type="file"
        id="file-upload"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={onFileChange}
        accept=".srt"
      />
      <div className="text-center">
        <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
        <p className="mt-2 text-sm text-gray-400">
          <span className="font-semibold text-sky-400">{label}</span> or drag and drop
        </p>
        <p className="text-xs text-gray-500">SRT files only</p>
      </div>
    </div>
  );
};

export default FileUpload;
