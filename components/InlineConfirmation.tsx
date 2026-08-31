'use client';

export function InlineConfirmation({
  title, description, confirmLabel, cancelLabel = 'Keep approval', busy = false, onConfirm, onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div aria-label={title} className="mt-3 rounded border border-[#cf8b45]/65 bg-[#2e1d12] p-3 text-left" role="alert">
      <p className="text-sm font-black text-[#f3d78b]">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[#d7c9a5]">{description}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="scroll-button px-3 py-2 text-xs" disabled={busy} onClick={onCancel} type="button">{cancelLabel}</button>
        <button className="gold-button px-3 py-2 text-xs" disabled={busy} onClick={onConfirm} type="button">{busy ? 'Working…' : confirmLabel}</button>
      </div>
    </div>
  );
}
