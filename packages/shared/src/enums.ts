export enum WorkspaceRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export enum DeploymentStatus {
  created = 'created',
  queued = 'queued',
  assigned = 'assigned',
  fetching_source = 'fetching_source',
  preparing_context = 'preparing_context',
  building_image = 'building_image',
  pushing_image = 'pushing_image',
  build_succeeded = 'build_succeeded',
  build_failed = 'build_failed',
  cancelled = 'cancelled',
}

export enum BuildFailureCode {
  github_webhook_invalid = 'github_webhook_invalid',
  github_api_transient = 'github_api_transient',
  github_api_forbidden = 'github_api_forbidden',
  repo_fetch_failed = 'repo_fetch_failed',
  repo_not_found = 'repo_not_found',
  dockerfile_invalid = 'dockerfile_invalid',
  build_failed = 'build_failed',
  registry_push_failed = 'registry_push_failed',
  timeout = 'timeout',
  worker_internal_error = 'worker_internal_error',
}

export enum EnvironmentType {
  preview = 'preview',
  production = 'production',
}

export enum WorkerStatus {
  online = 'online',
  offline = 'offline',
  draining = 'draining',
  error = 'error',
}

export enum WebhookProvider {
  github = 'github',
  clerk = 'clerk',
}
