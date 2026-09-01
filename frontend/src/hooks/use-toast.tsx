import { toast as sonnerToast } from "sonner";

/**
 * The one toast entry point for the whole app.
 *
 * `sonner` owns the queue and the stacking/dismiss timing itself now; this
 * file exists only so call sites keep saying `useToast().success(...)` and
 * never import a toast library directly - if the library ever changes again,
 * this is the only file that has to.
 */
export function useToast(): { success: (message: string) => void; error: (message: string) => void } {
  return {
    success: (message: string) => sonnerToast.success(message),
    error: (message: string) => sonnerToast.error(message),
  };
}
