export const PROCESSES_COMMAND = [
  "export LC_ALL=C",
  'echo "@@gpu"; nvidia-smi --query-gpu=index,uuid,name,memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null',
  'echo "@@apps"; nvidia-smi --query-compute-apps=pid,process_name,used_memory,gpu_uuid --format=csv,noheader,nounits 2>/dev/null',
  'echo "@@cmd"; for pid in $(nvidia-smi --query-compute-apps=pid --format=csv,noheader,nounits 2>/dev/null); do ps -ww -p "$pid" -o "pid=,user=,etime=,args=" 2>/dev/null; done',
  "true",
].join("; ");

function number(value) {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function sections(stdout) {
  const result = {};
  let current = null;
  for (const line of String(stdout ?? "").split(/\r?\n/)) {
    const marker = line.match(/^@@([a-z]+)\s*$/i);
    if (marker) {
      current = marker[1].toLowerCase();
      result[current] = [];
      continue;
    }
    if (current) result[current].push(line);
  }
  return result;
}

function percent(used, total) {
  if (used == null || !total) return null;
  return Math.min(100, Math.max(0, (used / total) * 100));
}

/** Parse the GPU inventory and per-process VRAM from one nvidia-smi snapshot. */
export function parseProcesses(stdout) {
  const parts = sections(stdout);
  const gpus = [];

  for (const line of parts.gpu ?? []) {
    const fields = line.trim().split(",").map((field) => field.trim());
    if (fields.length < 5 || !fields[1]) continue;
    const index = number(fields[0]);
    if (index == null) continue;
    gpus.push({
      index,
      uuid: fields[1],
      name: fields[2],
      memoryUsed: number(fields[3]),
      memoryTotal: number(fields[4]),
      processes: [],
    });
  }

  const byUuid = new Map(gpus.map((gpu) => [gpu.uuid, gpu]));
  let unknown = null;

  const details = new Map();
  for (const line of parts.cmd ?? []) {
    const match = line.trim().match(/^(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/);
    if (!match) continue;
    details.set(Number(match[1]), {
      user: match[2],
      elapsed: match[3],
      command: match[4].slice(0, 400),
    });
  }

  for (const line of parts.apps ?? []) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const fields = trimmed.split(",").map((field) => field.trim());
    if (fields.length < 4) continue;
    const pid = number(fields[0]);
    const memoryUsed = number(fields[fields.length - 2]);
    const uuid = fields[fields.length - 1];
    const name = fields.slice(1, -2).join(",").trim();
    if (pid == null || !name) continue;

    const gpu = byUuid.get(uuid);
    if (!gpu) {
      unknown ??= {
        index: null,
        uuid: "",
        name: "",
        memoryUsed: null,
        memoryTotal: null,
        processes: [],
      };
    }
    const target = gpu ?? unknown;
    const detail = details.get(pid);
    target.processes.push({
      pid,
      name,
      command: detail?.command ?? "",
      user: detail?.user ?? "",
      elapsed: detail?.elapsed ?? "",
      memoryUsed,
      memoryPercent: percent(memoryUsed, target.memoryTotal),
    });
  }

  if (unknown) gpus.push(unknown);
  for (const gpu of gpus) {
    gpu.processes.sort((a, b) => (b.memoryUsed ?? 0) - (a.memoryUsed ?? 0));
  }
  gpus.sort((a, b) => (a.index ?? 99) - (b.index ?? 99));

  return { gpus, collectedAt: Date.now() };
}
