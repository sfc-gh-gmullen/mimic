import React from 'react';

interface MessageModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

const MessageModal: React.FC<MessageModalProps> = ({ isOpen, title, message, type = 'info', onClose }) => {
  if (!isOpen) return null;

  const getTypeColor = () => {
    switch (type) {
      case 'success': return '#4caf50';
      case 'error': return '#f44336';
      default: return '#2196f3';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '16px',
          borderBottom: `3px solid ${getTypeColor()}`,
          paddingBottom: '12px'
        }}>
          <h2 style={{ margin: 0, color: getTypeColor(), fontSize: '20px' }}>{title}</h2>
        </div>
        <p style={{ margin: '16px 0', fontSize: '16px', lineHeight: '1.5' }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              backgroundColor: getTypeColor(),
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageModal;
