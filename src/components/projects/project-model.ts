import { MAX_ATTACHMENTS, MAX_DRAFT_BYTES, validateAttachment } from "@/components/chat/attachments";

export type ProjectFile = {
  id: string;
  name: string;
  mediaType: string;
  size: number;
  uri: string;
};

export type Project = {
  id: string;
  name: string;
  instructions: string;
  files: ProjectFile[];
  createdAt: number;
};

export function validateProject(name: string, instructions: string, files: ProjectFile[]) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("请输入项目名称。");
  if (trimmed.length > 80) throw new Error("项目名称不能超过 80 个字符。");
  if (instructions.length > 4000) throw new Error("项目说明不能超过 4000 个字符。");
  if (files.length > MAX_ATTACHMENTS) throw new Error("每个项目最多添加 4 个文件。");
  for (const file of files) validateAttachment(file);
  if (files.reduce((total, file) => total + file.size, 0) > MAX_DRAFT_BYTES) {
    throw new Error("项目文件总大小不能超过 8 MB。");
  }
  return { name: trimmed, instructions: instructions.trim() };
}

export function parseProjects(raw: string | null): Project[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((item): item is Project =>
      !!item && typeof item === "object" && typeof item.id === "string" &&
      typeof item.name === "string" && typeof item.instructions === "string" &&
      typeof item.createdAt === "number" && Array.isArray(item.files) &&
      item.files.every((file: unknown) => !!file && typeof file === "object" &&
        typeof (file as ProjectFile).id === "string" && typeof (file as ProjectFile).name === "string" &&
        typeof (file as ProjectFile).mediaType === "string" && typeof (file as ProjectFile).uri === "string" &&
        typeof (file as ProjectFile).size === "number"));
  } catch { return []; }
}
