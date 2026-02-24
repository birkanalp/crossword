// =============================================================================
// Edge Runtime — Main Router
//
// Routes requests to individual function workers.
// This file is the --main-service entry point for the Supabase edge-runtime.
// =============================================================================

// deno-lint-ignore-file no-explicit-any

const FUNCTIONS_ROOT = "/home/deno/functions";

const createWorker = async (servicePath: string) => {
  const envVarsObj = Deno.env.toObject();
  const envVars = Object.keys(envVarsObj).map((k) => [k, envVarsObj[k]]);

  // @ts-ignore EdgeRuntime global is provided by supabase/edge-runtime
  return await EdgeRuntime.userWorkers.create({
    servicePath,
    memoryLimitMb: 150,
    workerTimeoutMs: 5 * 60 * 1000,
    noModuleCache: false,
    envVars,
    forceCreate: false,
    cpuTimeSoftLimitMs: 10000,
    cpuTimeHardLimitMs: 20000,
  });
};

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  // Health check
  if (url.pathname === "/_internal/health") {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Extract function name from path: /getLevel → "getLevel"
  const segments = url.pathname.split("/").filter(Boolean);
  const funcName = segments[0] ?? "";

  if (!funcName || funcName === "main") {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const servicePath = `${FUNCTIONS_ROOT}/${funcName}`;

  const callWorker = async (): Promise<Response> => {
    try {
      const worker = await createWorker(servicePath);
      return await worker.fetch(req);
    } catch (err) {
      // Retry once if worker was already retired
      if (err instanceof Deno.errors.WorkerAlreadyRetired) {
        return callWorker();
      }
      return new Response(
        JSON.stringify({ error: "Function not found", detail: String(err) }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  };

  return callWorker();
});
