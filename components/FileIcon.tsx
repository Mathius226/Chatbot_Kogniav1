import React from 'react';

interface FileIconProps {
  fileName: string;
  className?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({ fileName, className = "w-6 h-6" }) => {
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (extension === 'pdf') {
    return (
      <div className={`flex items-center justify-center bg-red-100 text-red-600 rounded-lg ${className}`}>
        <span className="text-[10px] font-bold">PDF</span>
      </div>
    );
  }
  
  // Default / Text
  return (
    <div className={`flex items-center justify-center bg-slate-100 text-slate-500 rounded-lg ${className}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    </div>
  );
};