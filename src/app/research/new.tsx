import { usePreferences } from "@/components/preferences-context";
import { useResearch } from "@/components/research/research-context";
import { ServerForm } from "@/components/research/server-form";

export default function NewServerScreen() {
  const { t } = usePreferences();
  const { addServer } = useResearch();

  return (
    <ServerForm
      title={t("Add server")}
      onSave={async (draft) => {
        await addServer(draft);
      }}
    />
  );
}
