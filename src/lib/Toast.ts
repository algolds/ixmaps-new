interface ToastOptions {
  message: string;
  type?: string;
  duration?: number;
}

// Client-side only functions
const isClient = typeof window !== 'undefined';

export const initToasts = (): void => {
  // Only run on client-side
  if (!isClient) return;
  
  // Create toast container if it doesn't exist
  if (!document.getElementById('toast-container')) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      max-width: 80%;
    `;
    document.body.appendChild(container);
  }
};

export const showToast = (message: string, type: string = 'info', duration: number = 3000): string => {
  // Only run on client-side
  if (!isClient) return '';
  
  const container = document.getElementById('toast-container');
  if (!container) return '';

  const toast = document.createElement('div');
  const toastId = Math.random().toString(36).substr(2, 9);
  toast.id = `toast-${toastId}`;
 // Determine color based on type
 let bgColor;
 const textColor = 'white';
 let icon = '';
  
  switch (type) {
    case 'error':
      bgColor = '#ff4444';
      icon = '❌ ';
      break;
    case 'success':
      bgColor = '#00C851';
      icon = '✅ ';
      break;
    case 'warning':
      bgColor = '#FF8800';
      icon = '⚠️ ';
      break;
    case 'info':
    default:
      bgColor = '#33b5e5';
      icon = 'ℹ️ ';
      break;
  }
  
  toast.style.cssText = `
    background: ${bgColor};
    color: ${textColor};
    padding: 12px 24px;
    border-radius: 4px;
    margin-bottom: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    transition: all 0.3s ease-in-out;
    min-width: 200px;
    max-width: 100%;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  toast.innerHTML = `
    <div style="margin-right: 8px; font-size: 16px;">${icon}</div>
    <div>${message}</div>
  `;
  
  container.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  }, 10);

  if (duration > 0) {
    setTimeout(() => {
      hideToast(toastId);
    }, duration);
  }

  return toastId;
};

export const hideToast = (toastId: string): void => {
  // Only run on client-side
  if (!isClient) return;
  
  const toast = document.getElementById(`toast-${toastId}`);
  if (toast) {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  }
};