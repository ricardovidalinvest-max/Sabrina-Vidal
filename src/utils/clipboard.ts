/**
 * Safe clipboard helper that works inside iframes and sandboxed environments.
 * If navigator.clipboard is unavailable or restricted by browser permissions,
 * falls back seamlessly to execCommand('copy') with zero crashes.
 */
export async function copyTextSafely(text: string): Promise<boolean> {
  if (!text) return false;

  // Attempt 1: Modern Async Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Intentionally fall through to fallback
    }
  }

  // Attempt 2: Document execCommand fallback for sandboxed iframes
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.warn('Could not copy text to clipboard:', err);
    return false;
  }
}
