const response = await fetch("http://127.0.0.1:3000/api/health");
if (!response.ok) process.exit(1);
const body = (await response.json().catch(() => null)) as { success?: boolean } | null;
if (!body?.success) process.exit(1);
process.exit(0);

export {};
