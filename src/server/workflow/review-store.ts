import { randomUUID } from "node:crypto";
import type { JSONValue, Sql } from "postgres";

import type { AgreementIntent } from "@/core/agreement/intent";
import type { ReviewSnapshot } from "@/core/agreement/review";
import { createReviewSnapshot, diffReviewSnapshots } from "@/core/agreement/review";

type WorkflowRow = {
  workflow_id: string;
  tenant_id: string;
  owner_principal_id: string;
  state: string;
  active_intent_version: number;
};

export class ReviewStore {
  constructor(private readonly sql: Sql) {}

  async createWorkflow(tenantId: string, ownerPrincipalId: string, intent: AgreementIntent): Promise<string> {
    const workflowId = randomUUID();
    await this.sql.begin(async (tx) => {
      await tx`insert into agreement_workflows (workflow_id, tenant_id, owner_principal_id) values (${workflowId}, ${tenantId}, ${ownerPrincipalId})`;
      await tx`
        insert into agreement_intents (workflow_id, version, payload, source_request_sha256, unresolved_facts)
        values (${workflowId}, 1, ${tx.json(intent as unknown as JSONValue)}, ${intent.sourceRequestSha256}, ${intent.unresolvedFacts})
      `;
    });
    return workflowId;
  }

  async listOwnedWorkflows(tenantId: string, ownerPrincipalId: string, limit = 10): Promise<Array<{
    workflowId: string;
    state: string;
    supplierName: string;
    recipientEmail: string | null;
    updatedAt: Date;
  }>> {
    const boundedLimit = Math.max(1, Math.min(limit, 25));
    const rows = await this.sql<Array<{
      workflow_id: string;
      state: string;
      supplier_name: string;
      recipient_email: string | null;
      updated_at: Date;
    }>>`
      select w.workflow_id, w.state,
        i.payload->'supplier'->>'name' as supplier_name,
        r.snapshot_payload->'recipients'->0->>'email' as recipient_email,
        w.updated_at
      from agreement_workflows w
      join agreement_intents i on i.workflow_id = w.workflow_id and i.version = w.active_intent_version
      left join review_snapshots r on r.workflow_id = w.workflow_id and r.version = w.active_review_version
      where w.tenant_id = ${tenantId} and w.owner_principal_id = ${ownerPrincipalId}
        and w.active_review_version is not null
      order by w.updated_at desc
      limit ${boundedLimit}
    `;
    return rows.map((row) => ({
      workflowId: row.workflow_id,
      state: row.state,
      supplierName: row.supplier_name,
      recipientEmail: row.recipient_email,
      updatedAt: row.updated_at,
    }));
  }

  async getOwnedIntent(workflowId: string, tenantId: string): Promise<{ workflow: WorkflowRow; intent: AgreementIntent } | null> {
    const rows = await this.sql<Array<WorkflowRow & { payload: AgreementIntent }>>`
      select w.workflow_id, w.tenant_id, w.owner_principal_id, w.state,
        w.active_intent_version, i.payload
      from agreement_workflows w join agreement_intents i
        on i.workflow_id = w.workflow_id and i.version = w.active_intent_version
      where w.workflow_id = ${workflowId} and w.tenant_id = ${tenantId}
    `;
    return rows[0] ? { workflow: rows[0], intent: rows[0].payload } : null;
  }

  async savePreparedReview(input: {
    workflowId: string;
    tenantId: string;
    artifactSha256: string;
    actualSize: number;
    provenanceSha256: string;
    snapshot: ReviewSnapshot;
  }): Promise<number> {
    return this.sql.begin(async (tx) => {
      const locked = await tx<Array<{ active_document_version: number | null; active_review_version: number | null }>>`
        select active_document_version, active_review_version from agreement_workflows
        where workflow_id = ${input.workflowId} and tenant_id = ${input.tenantId} for update
      `;
      if (!locked[0]) throw new Error("Workflow not found");
      const documentVersion = (locked[0].active_document_version ?? 0) + 1;
      const reviewVersion = (locked[0].active_review_version ?? 0) + 1;
      await tx`
        insert into document_versions (workflow_id, version, artifact_sha256, actual_size, structural_validator, provenance_sha256)
        values (${input.workflowId}, ${documentVersion}, ${input.artifactSha256}, ${input.actualSize}, 'qpdf-v1', ${input.provenanceSha256})
      `;
      await tx`
        insert into review_snapshots (workflow_id, version, document_version, snapshot_digest, snapshot_payload)
        values (${input.workflowId}, ${reviewVersion}, ${documentVersion}, ${input.snapshot.digest}, ${tx.json(input.snapshot.input as unknown as JSONValue)})
      `;
      await tx`
        update agreement_workflows set state = 'review', active_document_version = ${documentVersion},
          active_review_version = ${reviewVersion}, updated_at = now()
        where workflow_id = ${input.workflowId}
      `;
      return reviewVersion;
    });
  }

  async getReview(workflowId: string, tenantId: string): Promise<Record<string, unknown> | null> {
    const rows = await this.sql<Array<Record<string, unknown>>>`
      select w.workflow_id, w.state, r.version, r.snapshot_digest, r.snapshot_payload,
        r.material_diff, d.artifact_sha256, d.actual_size, d.provenance_sha256,
        a.expires_at as approval_expires_at, a.consumed_at as approval_consumed_at,
        a.invalidated_at as approval_invalidated_at,
        (a.expires_at > now() and a.consumed_at is null and a.invalidated_at is null) as approval_is_fresh
      from agreement_workflows w
      join review_snapshots r on r.workflow_id = w.workflow_id and r.version = w.active_review_version
      join document_versions d on d.workflow_id = w.workflow_id and d.version = w.active_document_version
      left join exact_approvals a on a.approval_id = w.active_approval_id
      where w.workflow_id = ${workflowId} and w.tenant_id = ${tenantId}
    `;
    return rows[0] ?? null;
  }

  async retryFailedWorkflow(workflowId: string, tenantId: string, ownerPrincipalId: string): Promise<string> {
    return this.sql.begin(async (tx) => {
      const rows = await tx<Array<{
        payload: AgreementIntent;
        source_request_sha256: string;
        unresolved_facts: string[];
        artifact_sha256: string;
        actual_size: number;
        structural_validator: string;
        provenance_sha256: string;
        snapshot_payload: ReviewSnapshot["input"];
        retry_workflow_id: string | null;
      }>>`
        select i.payload,i.source_request_sha256,i.unresolved_facts,
          d.artifact_sha256,d.actual_size,d.structural_validator,d.provenance_sha256,
          r.snapshot_payload,retry.workflow_id as retry_workflow_id
        from agreement_workflows w
        join agreement_intents i on i.workflow_id=w.workflow_id and i.version=w.active_intent_version
        join document_versions d on d.workflow_id=w.workflow_id and d.version=w.active_document_version
        join review_snapshots r on r.workflow_id=w.workflow_id and r.version=w.active_review_version
        left join agreement_workflows retry on retry.retry_of_workflow_id=w.workflow_id
        where w.workflow_id=${workflowId} and w.tenant_id=${tenantId}
          and w.owner_principal_id=${ownerPrincipalId} and w.state='failed'
        for update of w
      `;
      const source = rows[0];
      if (!source) throw new Error("Only an owned failed workflow can be retried");
      if (source.retry_workflow_id) return source.retry_workflow_id;
      const retryWorkflowId = randomUUID();
      const snapshot = createReviewSnapshot({ ...source.snapshot_payload, workflowId: retryWorkflowId });
      await tx`
        insert into agreement_workflows (workflow_id,tenant_id,owner_principal_id,state,
          active_intent_version,active_document_version,active_review_version,retry_of_workflow_id)
        values (${retryWorkflowId},${tenantId},${ownerPrincipalId},'review',1,1,1,${workflowId})
      `;
      await tx`
        insert into agreement_intents (workflow_id,version,payload,source_request_sha256,unresolved_facts)
        values (${retryWorkflowId},1,${tx.json(source.payload as unknown as JSONValue)},
          ${source.source_request_sha256},${source.unresolved_facts})
      `;
      await tx`
        insert into document_versions (workflow_id,version,artifact_sha256,actual_size,structural_validator,provenance_sha256)
        values (${retryWorkflowId},1,${source.artifact_sha256},${source.actual_size},
          ${source.structural_validator},${source.provenance_sha256})
      `;
      await tx`
        insert into review_snapshots (workflow_id,version,document_version,snapshot_digest,snapshot_payload)
        values (${retryWorkflowId},1,1,${snapshot.digest},${tx.json(snapshot.input as unknown as JSONValue)})
      `;
      return retryWorkflowId;
    });
  }

  async createMutation(workflowId: string, tenantId: string, mutate: (input: ReviewSnapshot["input"]) => ReviewSnapshot["input"]): Promise<ReviewSnapshot> {
    return this.sql.begin(async (tx) => {
      const rows = await tx<Array<{ active_review_version: number; snapshot_digest: string; snapshot_payload: ReviewSnapshot["input"] }>>`
        select w.active_review_version, r.snapshot_digest, r.snapshot_payload
        from agreement_workflows w join review_snapshots r
          on r.workflow_id = w.workflow_id and r.version = w.active_review_version
        where w.workflow_id = ${workflowId} and w.tenant_id = ${tenantId} for update of w
      `;
      const current = rows[0];
      if (!current) throw new Error("Workflow not found");
      const before: ReviewSnapshot = { digest: current.snapshot_digest, input: current.snapshot_payload };
      const after = createReviewSnapshot(mutate(structuredClone(before.input)));
      if (after.digest === before.digest) throw new Error("Mutation produced no material change");
      const version = current.active_review_version + 1;
      await tx`
        insert into review_snapshots (workflow_id, version, document_version, snapshot_digest,
          snapshot_payload, prior_version, material_diff)
        select ${workflowId}, ${version}, document_version, ${after.digest},
          ${tx.json(after.input as unknown as JSONValue)}, ${current.active_review_version},
          ${tx.json(diffReviewSnapshots(before, after) as unknown as JSONValue)}
        from review_snapshots where workflow_id = ${workflowId} and version = ${current.active_review_version}
      `;
      await tx`
        update agreement_workflows set state = 'review', active_review_version = ${version},
          active_approval_id = null, updated_at = now() where workflow_id = ${workflowId}
      `;
      await tx`update exact_approvals set invalidated_at = coalesce(invalidated_at, now()) where workflow_id = ${workflowId} and consumed_at is null`;
      return after;
    });
  }
}
