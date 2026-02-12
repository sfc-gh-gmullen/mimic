import React from 'react';
import { useTheme } from '../ThemeContext';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  title, 
  message, 
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  onConfirm, 
  onCancel 
}) => {
  const { colors } = useTheme();
  
  if (!isOpen) return null;

  const getTypeColor = () => {
    switch (type) {
      case 'danger': return '#f44336';
      case 'warning': return '#ff9800';
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
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: colors.cardBg,
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '450px',
        width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '16px',
          borderBottom: `3px solid ${getTypeColor()}`,
          paddingBottom: '12px'
        }}>
          <span style={{ fontSize: '1.5em', marginRight: '10px' }}>
            {type === 'danger' ? '⚠️' : type === 'warning' ? '❓' : 'ℹ️'}
          </span>
          <h2 style={{ margin: 0, color: getTypeColor(), fontSize: '18px' }}>{title}</h2>
        </div>
        <p style={{ 
          margin: '16px 0', 
          fontSize: '15px', 
          lineHeight: '1.6',
          color: colors.text 
        }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              color: colors.textSecondary,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = colors.surface;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              backgroundColor: getTypeColor(),
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
