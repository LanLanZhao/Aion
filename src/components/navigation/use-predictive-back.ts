import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { BackHandler } from "react-native";
import { predictiveBack, type BackDestination } from "./predictive-back";

/** Register only the focused screen; cancelling a native gesture emits no navigation. */
export function usePredictiveBack(destination: BackDestination, onBack: () => void) {
  const currentBack = useRef(onBack);
  useEffect(() => { currentBack.current = onBack; }, [onBack]);

  useFocusEffect(useCallback(() => {
    if (process.env.EXPO_OS !== "android") return;
    if (!predictiveBack) {
      const listener = BackHandler.addEventListener("hardwareBackPress", () => { currentBack.current(); return true; });
      return () => listener.remove();
    }
    const native = predictiveBack;
    const owner = `${destination}-${Date.now()}-${Math.random()}`;
    let handled = false;
    const listener = native.addListener("onBackCommitted", event => {
      if (event.owner !== owner || handled) return;
      handled = true;
      currentBack.current();
      requestAnimationFrame(() => requestAnimationFrame(() => { void native.complete(owner); }));
    });
    void native.enable(owner, destination);
    return () => {
      listener.remove();
      void native.disable(owner);
    };
  }, [destination]));
}
