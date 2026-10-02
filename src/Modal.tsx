import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({ title, subtitle, children, onClose, wide = false, className = '', initialFocus }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean; className?: string; initialFocus?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ((initialFocus ? ref.current?.querySelector<HTMLElement>(initialFocus) : null) || ref.current?.querySelector<HTMLElement>('input:not([type="file"]),select,textarea') || ref.current?.querySelector<HTMLElement>('button'))?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const controls = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') || [])].filter(el => el.offsetParent !== null);
        const first = controls[0], last = controls.at(-1);
        if (!ref.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); previous?.focus({ preventScroll: true }); };
  }, [onClose, initialFocus]);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className={`modal ${wide ? 'wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}><div className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" title="Fermer" onClick={onClose}><X size={20}/></button></div>{children}</div></div>;
}
