import { BuildFailureCode } from './enums';

export function isRetryableBuildFailure(code: BuildFailureCode): boolean {
  return (
    code === BuildFailureCode.github_api_transient ||
    code === BuildFailureCode.repo_fetch_failed ||
    code === BuildFailureCode.registry_push_failed ||
    code === BuildFailureCode.timeout
  );
}

