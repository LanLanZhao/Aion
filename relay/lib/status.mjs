export const STATUS_COMMAND = [
  "export LC_ALL=C",
  'echo "@@host"; hostname 2>/dev/null',
  'echo "@@uptime"; uptime 2>/dev/null',
  'echo "@@cores"; nproc 2>/dev/null',
  'echo "@@mem"; free -b 2>/dev/null',
  'echo "@@disk"; df -PB1 / /home 2>/dev/null',
  'echo "@@cpu"; top -bn1 2>/dev/null | grep -E "Cpu\\(s\\)|^%Cpu" | head -1',
  'echo "@@gpu"; nvidia-smi --query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,power.limit --format=csv,noheader,nounits 2>/dev/null',
  "true",
].join("; ");

function number(value) {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function percent(used, total) {
  if (!total || used == null) return null;
  return Math.min(100, Math.max(0, (used / total) * 100));
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

export function parseStatus(stdout) {
  const parts = sections(stdout);

  const host = (parts.host ?? []).map((line) => line.trim()).find(Boolean) ?? "";

  const uptimeLine = (parts.uptime ?? []).map((line) => line.trim()).find(Boolean) ?? "";
  const uptimeMatch = uptimeLine.match(/up\s+(.*?),\s+load average:/);
  const loadMatch = uptimeLine.match(/load average:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/);

  const cores = number((parts.cores ?? []).map((line) => line.trim()).find(Boolean));

  let memory = null;
  const memLine = (parts.mem ?? []).map((line) => line.trim()).find((line) => line.startsWith("Mem:"));
  if (memLine) {
    const fields = memLine.split(/\s+/);
    const total = number(fields[1]);
    const used = number(fields[2]);
    const available = number(fields[6] ?? fields[3]);
    if (total) {
      memory = { total, used, available, percent: percent(used, total) };
    }
  }

  const disks = [];
  for (const line of parts.disk ?? []) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Filesystem")) continue;
    const fields = trimmed.split(/\s+/);
    if (fields.length < 6) continue;
    const total = number(fields[1]);
    const used = number(fields[2]);
    const mount = fields.slice(5).join(" ");
    if (total) disks.push({ mount, total, used, percent: percent(used, total) });
  }

  let cpu = { usagePercent: null, cores };
  const cpuLine = (parts.cpu ?? []).map((line) => line.trim()).find(Boolean);
  if (cpuLine) {
    const idle = cpuLine.match(/([\d.]+)\s*id/);
    const usage = idle ? Math.min(100, Math.max(0, 100 - Number(idle[1]))) : null;
    cpu = { usagePercent: usage, cores };
  }

  const gpus = [];
  for (const line of parts.gpu ?? []) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.includes("[N/A]") && trimmed.split(",").length < 8) continue;
    const fields = trimmed.split(",").map((field) => field.trim());
    if (fields.length < 8) continue;
    const memoryUsed = number(fields[3]);
    const memoryTotal = number(fields[4]);
    gpus.push({
      index: number(fields[0]),
      name: fields[1],
      utilization: number(fields[2]),
      memoryUsed,
      memoryTotal,
      memoryPercent: percent(memoryUsed, memoryTotal),
      temperature: number(fields[5]),
      power: number(fields[6]),
      powerLimit: number(fields[7]),
    });
  }

  return {
    host,
    uptime: uptimeMatch ? uptimeMatch[1].trim() : uptimeLine,
    load: loadMatch ? [Number(loadMatch[1]), Number(loadMatch[2]), Number(loadMatch[3])] : [],
    cores,
    cpu,
    memory,
    disks,
    gpus,
    collectedAt: Date.now(),
  };
}
