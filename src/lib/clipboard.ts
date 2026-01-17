/**
 * Safari-compatible clipboard utility with fallback
 * 
 * Safari blocks navigator.clipboard.writeText when preceded by async operations.
 * This utility provides a fallback using textarea + execCommand('copy').
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern Clipboard API first
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    console.warn('[copyToClipboard] Clipboard API failed, trying fallback:', e);
  }

  // Fallback for Safari and older browsers
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (e) {
    console.error('[copyToClipboard] Fallback also failed:', e);
    return false;
  }
}
