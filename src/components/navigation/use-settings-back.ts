import { useDrawer } from "@/components/drawer-content";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { usePredictiveBack } from "./use-predictive-back";

export function useSettingsBack(destination: "drawer" | "settings") {
  const router = useRouter();
  const { openDrawerImmediately } = useDrawer();
  const goBack = useCallback(() => {
    if (destination === "drawer") {
      router.dismissTo("/");
      // Restore the drawer after the pop commits, so it never floats above the
      // closing screen.
      requestAnimationFrame(() => requestAnimationFrame(() => openDrawerImmediately()));
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(settings)/settings");
    }
  }, [destination, router, openDrawerImmediately]);
  usePredictiveBack(destination, goBack);
  return goBack;
}
