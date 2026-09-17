import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n/i18n-context';
import './arcade.css';

export interface ShareReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  referralLink: string;
  clanName?: string | undefined;
  clanTag?: string | undefined;
}

export function ShareReferralModal({
  isOpen,
  onClose,
  referralLink,
  clanName,
  clanTag,
}: ShareReferralModalProps) {
  const { t } = useI18n();
  const [selectedTemplate, setSelectedTemplate] = useState<string>('starter');
  const [copied, setCopied] = useState(false);

  const shareTemplates = [
    {
      id: 'starter',
      label: t('share_template_starter_label'),
      text: t('share_template_starter_text'),
    },
    {
      id: 'clan',
      label: t('share_template_clan_label'),
      text: t('share_template_clan_text'),
    },
    {
      id: 'whale',
      label: t('share_template_whale_label'),
      text: t('share_template_whale_text'),
    },
  ] as const;

  // Lock background scrolling when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentTemplate =
    shareTemplates.find((t) => t.id === selectedTemplate) ??
    shareTemplates[0]!;

  const fullShareText = `${currentTemplate.text}${referralLink}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullShareText);
      setCopied(true);
      if (window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleTelegramShare = () => {
    const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(currentTemplate.text)}`;

    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(telegramShareUrl);
    } else {
      window.open(telegramShareUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        minHeight: '100dvh',
        backgroundColor: 'rgba(5, 10, 18, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="panel"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '420px',
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          margin: 'auto',
          background: 'linear-gradient(180deg, #162032 0%, #0d1422 100%)',
          border: '1px solid rgba(241, 201, 154, 0.35)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '11px',
                color: '#f1c99a',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {t('friends_eyebrow')}
            </span>
            <h2
              id="share-modal-title"
              style={{
                margin: '4px 0 0 0',
                fontSize: '1.25rem',
                color: '#fff',
              }}
            >
              {t('share_modal_title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8e9aa8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '4px',
            }}
            aria-label={t('btn_close')}
          >
            ✕
          </button>
        </div>

        {clanName && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(241, 201, 154, 0.08)',
              border: '1px solid rgba(241, 201, 154, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '20px' }}>🛡️</span>
            <div>
              <strong
                style={{ fontSize: '13px', color: '#f1c99a', display: 'block' }}
              >
                {clanTag ? `[${clanTag}] ` : ''}
                {clanName}
              </strong>
              <small style={{ fontSize: '11px', opacity: 0.8 }}>
                {t('friends_tab_clans')}
              </small>
            </div>
          </div>
        )}

        <div
          style={{
            background:
              'linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(241, 201, 154, 0.1))',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🎁</span>
            <strong style={{ color: '#22c55e' }}>
              {t('friends_invite_card_title')}
            </strong>
          </div>
          <span style={{ opacity: 0.85, fontSize: '12px' }}>
            {t('share_modal_subtitle')}
          </span>
        </div>

        <div>
          <label
            style={{
              fontSize: '12px',
              opacity: 0.8,
              display: 'block',
              marginBottom: '6px',
            }}
          >
            {t('btn_share')}:
          </label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {shareTemplates.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => setSelectedTemplate(tmpl.id)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border:
                    selectedTemplate === tmpl.id
                      ? '1px solid #f1c99a'
                      : '1px solid rgba(255,255,255,0.1)',
                  background:
                    selectedTemplate === tmpl.id
                      ? 'rgba(241, 201, 154, 0.15)'
                      : 'rgba(255,255,255,0.03)',
                  color: selectedTemplate === tmpl.id ? '#f1c99a' : '#fff',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {tmpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Link strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.12)',
            padding: '4px 6px 4px 12px',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontFamily: 'monospace',
              color: '#d1d5db',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {referralLink}
          </span>
          <button
            type="button"
            className="button secondary"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              whiteSpace: 'nowrap',
            }}
            onClick={() => void handleCopy()}
          >
            {copied ? `✓ ${t('btn_copied')}` : t('btn_copy')}
          </button>
        </div>

        {/* Big Telegram Native Share Button */}
        <button
          type="button"
          className="button primary"
          style={{
            padding: '12px 16px',
            fontSize: '15px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            backgroundColor: '#0088cc',
            borderColor: '#0088cc',
            cursor: 'pointer',
          }}
          onClick={handleTelegramShare}
        >
          <span style={{ fontSize: '18px' }}>✈️</span>
          {t('share_btn_telegram')}
        </button>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}
