import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  type?: 'info' | 'success' | 'error' | 'warning' | 'prompt';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, type = 'info' }) => {
  if (!isOpen) return null;

  const getIconAndColor = () => {
    switch (type) {
      case 'success':
        return { icon: '✓', color: '#28a745', bgColor: '#d4edda' };
      case 'error':
        return { icon: '✗', color: '#dc3545', bgColor: '#f8d7da' };
      case 'warning':
        return { icon: '⚠', color: '#ffc107', bgColor: '#fff3cd' };
      case 'prompt':
        return { icon: '✏️', color: '#29B5E8', bgColor: '#e7e9fd' };
      default:
        return { icon: 'ℹ', color: '#17a2b8', bgColor: '#d1ecf1' };
    }
  };

  const { icon, color, bgColor } = getIconAndColor();

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '0',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          animation: 'modalSlideIn 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e9ecef',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: bgColor,
            borderRadius: '16px 16px 0 0'
          }}
        >
          <div
            style={{
              fontSize: '1.5em',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              backgroundColor: 'white',
              color: color
            }}
          >
            {icon}
          </div>
          <h3 style={{ margin: 0, color: '#212529', fontSize: '1.25em', fontWeight: '600' }}>
            {title}
          </h3>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {children}
        </div>
      </div>
      <style>{`
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default Modal;
