export class ArtifactNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super("Artifact not found");
    this.name = "ArtifactNotFoundError";
  }
}

export class ArtifactIntegrityError extends Error {
  readonly status = 409;
  constructor() {
    super("Artifact failed integrity verification and is quarantined");
    this.name = "ArtifactIntegrityError";
  }
}
