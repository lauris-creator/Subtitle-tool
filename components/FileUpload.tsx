
import React, { useCallback, useState } from 'react';
import { UploadIcon } from './icons/Icons';

interface FileUploadProps {
  label: string;
  onFileUpload: (content: string, name: string) => void;
  multiple?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ label, onFileUpload, multiple = false }) => {
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

  const handleFiles = (files: FileList) => {
    const srtFiles = Array.from(files).filter(file => file.name.endsWith('.srt'));
    
    if (srtFiles.length === 0) {
      alert('Please upload valid .srt files.');
      return;
    }

    if (srtFiles.length !== files.length) {
      alert(`Only ${srtFiles.length} of ${files.length} files were valid .srt files.`);
    }

    srtFiles.forEach(file => handleFile(file));
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (multiple) {
        handleFiles(e.dataTransfer.files);
      } else {
        handleFile(e.dataTransfer.files[0]);
      }
    }
  }, [onFileUpload, multiple]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (multiple) {
        handleFiles(e.target.files);
      } else {
        handleFile(e.target.files[0]);
      }
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
        multiple={multiple}
      />
      <div className="text-center">
        <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
        <p className="mt-2 text-sm text-gray-400">
          <span className="font-semibold text-sky-400">{label}</span> or drag and drop
        </p>
        <p className="text-xs text-gray-500">
          {multiple ? 'Multiple SRT files' : 'SRT files only'}
        </p>
      </div>
    </div>
  );
};

export default FileUpload;
