// app/src/utils/copyToClipboard.ts

export const copyToClipboard = (text: string): Promise<void> => {
    // Use the modern clipboard API if available (and in a secure context)
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    } else {
      // Fallback for older browsers or insecure contexts
      return new Promise((resolve, reject) => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // Make the textarea out of sight
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
  
        try {
          const successful = document.execCommand('copy');
          if (successful) {
            resolve();
          } else {
            reject(new Error('Copy command was not successful.'));
          }
        } catch (err) {
          reject(err);
        } finally {
          document.body.removeChild(textArea);
        }
      });
    }
  };
  