import React from 'react';
import { Document } from '../types';

interface DocumentSelectorProps {
  documents: Document[];
  currentDocumentId: string | null;
  onSelectDocument: (documentId: string) => void;
  onCloseDocument: (documentId: string) => void;
  onNewDocument: () => void;
}

const DocumentSelector: React.FC<DocumentSelectorProps> = ({
  documents,
  currentDocumentId,
  onSelectDocument,
  onCloseDocument,
  onNewDocument
}) => {
  return (
    <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden mb-4">
      <div className="p-4 bg-gray-800/50 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">Documents</h3>
          <button
            onClick={onNewDocument}
            className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white text-sm rounded transition-colors"
            title="Add new document"
          >
            + New
          </button>
        </div>
      </div>
      
      <div className="p-4">
        {documents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">No documents loaded</p>
            <button
              onClick={onNewDocument}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded transition-colors"
            >
              Upload First Document
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                  currentDocumentId === doc.id
                    ? 'bg-sky-600/20 border border-sky-500'
                    : 'bg-gray-700/50 hover:bg-gray-700'
                }`}
                onClick={() => onSelectDocument(doc.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium truncate">
                      {doc.name}
                    </span>
                    {currentDocumentId === doc.id && (
                      <span className="text-sky-400 text-xs">(current)</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {doc.translatedSubtitles.length} subtitles
                    {doc.originalSubtitles.length > 0 && 
                      ` • ${doc.originalSubtitles.length} originals`
                    }
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseDocument(doc.id);
                  }}
                  className="ml-2 p-1 text-gray-400 hover:text-red-400 transition-colors"
                  title="Close document"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentSelector;
