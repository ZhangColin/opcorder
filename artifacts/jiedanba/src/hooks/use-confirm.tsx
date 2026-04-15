import { useState, useCallback } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: "default" | "destructive";
  onConfirm: () => void;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const askConfirm = useCallback((opts: ConfirmOptions) => {
    setState({ ...opts, open: true });
  }, []);

  const handleConfirm = () => {
    if (state) state.onConfirm();
    setState(null);
  };

  const handleCancel = () => setState(null);

  const confirmDialog = state ? (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      confirmVariant={state.confirmVariant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { askConfirm, confirmDialog };
}
