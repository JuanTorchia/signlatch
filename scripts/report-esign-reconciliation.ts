import { database } from "../src/server/database";
import { sanitizeProviderDiagnostic } from "../src/server/foxit/esign-adapter";

async function main() {
  const workflowId = process.argv.at(-1);
  if (!workflowId || !/^[0-9a-f-]{36}$/.test(workflowId)) throw new Error("Pass one workflow UUID");
  const sql = database();
  try {
    const rows = await sql<Array<{
      workflow_state: string;
      dispatch_status: string;
      attempt_count: number;
      operation_state: string;
      diagnostic: unknown;
      reserved_units: number;
      age_seconds: number;
      has_correlation: boolean;
      has_envelope: boolean;
    }>>`
      select w.state as workflow_state, d.status as dispatch_status,
        d.attempt_count, o.state as operation_state, o.result_payload as diagnostic,
        o.reserved_units, extract(epoch from (now() - d.updated_at))::integer as age_seconds,
        d.provider_correlation_id is not null as has_correlation,
        d.provider_envelope_id is not null as has_envelope
      from agreement_workflows w
      join esign_dispatches d using (workflow_id)
      join provider_operations o on o.operation_id=d.provider_operation_id
      where w.workflow_id=${workflowId}
      order by d.created_at desc limit 1
    `;
    const row = rows[0];
    if (!row) throw new Error("No eSign dispatch exists for this workflow");
    const payload = row.diagnostic && typeof row.diagnostic === "object" && !Array.isArray(row.diagnostic)
      ? row.diagnostic as Record<string, unknown> : {};
    console.log(JSON.stringify({
      schema: "signlatch.reconciliation-report.v1",
      workflowId,
      ...row,
      diagnostic: sanitizeProviderDiagnostic(payload.diagnostic),
    }, null, 2));
  } finally {
    await sql.end();
  }
}

void main();
