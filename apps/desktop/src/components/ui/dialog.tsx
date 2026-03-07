import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60" />
        <Dialog.Content className="surface fixed left-1/2 top-1/2 z-10 w-[min(760px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl p-6">
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
            <div>
              <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-[var(--muted)]">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close className="rounded-md border border-[var(--border)] p-2 text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
