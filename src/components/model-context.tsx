import React, { createContext, use, useState } from "react";
import { MODEL_IDS } from "@/utils/model-config";

export type Model = {
  id: string;
  label: string;
  subtitle?: string;
};

type ModelContextValue = {
  models: readonly Model[];
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  extendedThinking: boolean;
  setExtendedThinking: (value: boolean) => void;
};

const ModelContext = createContext<ModelContextValue | null>(null);

export function ModelProvider({
  children,
  models,
}: {
  children: React.ReactNode;
  models: readonly Model[];
}) {
  const [extendedThinking, setExtendedThinking] = useState(true);
  const [selectedModel, setSelected] = useState("sonnet-4.6");
  const setSelectedModel = (value: string) => {
    if (Object.hasOwn(MODEL_IDS, value)) setSelected(value);
  };

  return (
    <ModelContext
      value={{ models, selectedModel, setSelectedModel, extendedThinking, setExtendedThinking }}
    >
      {children}
    </ModelContext>
  );
}

export function useModel() {
  const context = use(ModelContext);
  if (!context) {
    throw new Error("useModel must be used within a ModelProvider");
  }
  return context;
}
