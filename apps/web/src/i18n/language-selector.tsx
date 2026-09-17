import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from './i18n-context';
import type { SupportedLanguage } from './types';

export function LanguageSelector({ compact = true }: { compact?: boolean }) {
  const { language, setLanguage, supportedLanguages, currentLanguageInfo } =
    useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (code: SupportedLanguage) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="language-selector-wrapper"
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        type="button"
        className="language-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Dil seçimi: ${currentLanguageInfo.nativeName}`}
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 10px',
          borderRadius: '20px',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          color: 'var(--text)',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s ease',
        }}
      >
        <span style={{ fontSize: '13px' }}>{currentLanguageInfo.flag}</span>
        <span>{currentLanguageInfo.code.toUpperCase()}</span>
      </button>

      {isOpen && (
        <div
          className="language-dropdown-menu"
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 9999,
            minWidth: '130px',
            background: 'var(--surface-raised, #1c2230)',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {supportedLanguages.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(lang.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: isSelected
                    ? 'rgba(225, 180, 126, 0.18)'
                    : 'transparent',
                  border: 'none',
                  color: isSelected ? 'var(--accent, #e1b47e)' : 'var(--text)',
                  fontWeight: isSelected ? '700' : '500',
                  fontSize: '13px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <span>{lang.flag}</span>
                <span>{lang.nativeName}</span>
                {isSelected && (
                  <span style={{ marginLeft: 'auto', fontSize: '11px' }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
