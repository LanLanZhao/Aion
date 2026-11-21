import { NativeModule, requireOptionalNativeModule } from "expo";
import { Keyboard } from "react-native";

export type BackDestination = "drawer" | "projects" | "settings" | "research" | "chat";

type BackEvents = { onBackCommitted: (event: { owner: string }) => void };
declare class PredictiveBackModule extends NativeModule<BackEvents> {
  captureDestination(key: string): Promise<boolean>;
  enable(owner: string, destination: string): Promise<void>;
  disable(owner: string): Promise<void>;
  complete(owner: string): Promise<void>;
}

export const predictiveBack = process.env.EXPO_OS === "android"
  ? requireOptionalNativeModule<PredictiveBackModule>("QuestPredictiveBack") : null;

/** A failed preview capture must never prevent ordinary navigation. */
export async function captureBackDestination(key: BackDestination) {
  try {
    // A settings search can leave the IME open. Capture the restored full-size
    // page, rather than stretching a keyboard-resized preview behind its child.
    if (process.env.EXPO_OS === "android" && Keyboard.isVisible()) {
      await new Promise<void>(resolve => {
        const finish = () => { clearTimeout(timeout); subscription.remove(); resolve(); };
        const subscription = Keyboard.addListener("keyboardDidHide", finish);
        const timeout = setTimeout(finish, 500);
        Keyboard.dismiss();
      });
    }
    await predictiveBack?.captureDestination(key);
  } catch { /* Navigation still works without a preview. */ }
}
