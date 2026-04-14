import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  confirmDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <AlertDialogContent className="max-w-sm rounded-2xl p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-extrabold text-blue-900">
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-sm text-slate-500 leading-relaxed">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2 gap-2 sm:gap-2">
          <AlertDialogCancel
            onClick={onCancel}
            className="rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              confirmDestructive
                ? "rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 border-0"
                : "rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 border-0"
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
