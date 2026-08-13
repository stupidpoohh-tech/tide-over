import { type ReactNode, useEffect, useRef } from 'react';

type Props = {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
};

/** 대화상자 껍데기. Esc·바깥 클릭으로 닫히고, 열려 있는 동안 뒤쪽 스크롤을 잠근다. */
export function Modal({ titleId, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current
      ?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea, button')
      ?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = bodyOverflow;
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      // 안에서 시작한 드래그가 바깥에서 끝나도 닫히지 않도록 mousedown 대상만 본다.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({
  badge,
  title,
  titleId,
  onClose,
}: {
  badge: string;
  title: string;
  titleId: string;
  onClose: () => void;
}) {
  return (
    <header className="modal__head">
      <h2 id={titleId} className="modal__title">
        <span className="modal__badge">{badge}</span>
        {title}
      </h2>
      <button type="button" className="icon-btn" aria-label="닫기" onClick={onClose}>
        ×
      </button>
    </header>
  );
}
