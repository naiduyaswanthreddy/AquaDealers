export const canShareFiles = (): boolean => {
  return typeof navigator !== 'undefined' && 
         typeof navigator.canShare === 'function' && 
         typeof File !== 'undefined';
};

export const sharePdfViaWhatsApp = async (
  pdfBlob: Blob,
  filename: string,
  fallbackText: string,
  phoneNumber?: string
): Promise<void> => {
  try {
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });
    
    // Check if Web Share API is available and can share files.
    // If a specific phone number is provided, we bypass the generic Web Share API 
    // to directly open the WhatsApp chat via wa.me (fallback method).
    if (!phoneNumber && canShareFiles() && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: filename,
        // Some devices require text when sharing files to WhatsApp
        text: 'Please find the attached document.', 
      });
      return;
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('Error sharing via Web Share API:', error);
    }
    // If it's an AbortError (user cancelled), we might not want to fallback immediately, 
    // but for now, we'll let it fallback if the share failed for any other reason.
    // Actually, if user aborts, we should just return.
    if ((error as Error).name === 'AbortError') {
       return;
    }
  }

  // Fallback: Download the file and open WhatsApp text with instructions
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const encodedText = encodeURIComponent(fallbackText);
  const waUrl = phoneNumber 
    ? `https://wa.me/91${phoneNumber}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  // Small delay to allow download to start
  setTimeout(() => {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }, 500);
};
