import { useEffect } from "react";
import { useDrawer } from "./drawer-content";

/**
 * Reopens the drawer when the screen using this hook is popped back to the
 * chat.
 *
 * The drawer is a custom overlay rather than a navigator, so it is closed
 * before navigating and the destination has to put it back. Doing that on
 * unmount is the reliable signal: animated stacks unmount the popped screen
 * only after the transition finishes, while a chat screen's focus effect runs
 * before that. Navigating deeper keeps this screen mounted, so it does not
 * fire there.
 */
export function useRestoreDrawerOnClose() {
  const { openDrawer } = useDrawer();

  useEffect(() => {
    return () => openDrawer();
  }, [openDrawer]);
}
