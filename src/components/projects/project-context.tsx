import { usePreferences } from "@/components/preferences-context";
import { Directory, File, Paths } from "expo-file-system";
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert } from "react-native";
import { parseProjects, validateProject, type Project, type ProjectFile } from "./project-model";

type NewProjectFile = ProjectFile;
type ProjectContextValue = {
  projects: Project[];
  ready: boolean;
  createProject: (name: string, instructions: string, files: NewProjectFile[]) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
};

const Context = createContext<ProjectContextValue | null>(null);
// Expo Router also evaluates route modules while exporting its server
// manifest. Resolve native document paths only inside client-side operations.
const projectRoot = () => new Directory(Paths.document, "quest-projects");
const projectIndex = () => new File(Paths.document, "quest-projects.json");

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { t } = usePreferences();
  const [projects, setProjects] = useState<Project[]>([]);
  const [ready, setReady] = useState(false);
  const saved = useRef<Project[]>([]);
  const loading = useRef<Promise<void> | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const ensureLoaded = useCallback(() => {
    loading.current ??= (async () => {
      const index = projectIndex();
      saved.current = index.exists ? parseProjects(await index.text()) : [];
      setProjects(saved.current);
      setReady(true);
    })().catch((error) => {
      setReady(true);
      Alert.alert(t("无法读取项目"), t("请稍后重试。"));
      throw error;
    });
    return loading.current;
  }, [t]);

  useEffect(() => { void ensureLoaded().catch(() => {}); }, [ensureLoaded]);

  const createProject = useCallback((name: string, instructions: string, files: NewProjectFile[]) => {
    const operation = queue.current.then(async () => {
      await ensureLoaded();
      const normalized = validateProject(name, instructions, files);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const directory = new Directory(projectRoot(), id);
      directory.create({ intermediates: true, idempotent: true });
      try {
        const storedFiles: ProjectFile[] = [];
        for (const file of files) {
          const source = new File(file.uri);
          if (!source.exists || source.size !== file.size) throw new Error("项目文件已不可用，请重新选择。");
          const destination = new File(directory, `${file.id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
          await source.copy(destination);
          storedFiles.push({ ...file, uri: destination.uri });
        }
        const project: Project = { id, ...normalized, files: storedFiles, createdAt: Date.now() };
        const next = [project, ...saved.current];
        projectIndex().write(JSON.stringify(next));
        saved.current = next;
        setProjects(next);
        return project;
      } catch (error) {
        if (directory.exists) directory.delete();
        throw error;
      }
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, [ensureLoaded]);

  const deleteProject = useCallback((id: string) => {
    const operation = queue.current.then(async () => {
      await ensureLoaded();
      const next = saved.current.filter(project => project.id !== id);
      projectIndex().write(JSON.stringify(next));
      saved.current = next;
      setProjects(next);
      const directory = new Directory(projectRoot(), id);
      if (directory.exists) directory.delete();
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, [ensureLoaded]);

  return <Context value={{ projects, ready, createProject, deleteProject }}>{children}</Context>;
}

export function useProjects() {
  const context = use(Context);
  if (!context) throw new Error("useProjects must be used within ProjectProvider");
  return context;
}
