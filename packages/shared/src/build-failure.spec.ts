import { describe, expect, it } from 'vitest';
import { BuildFailureCode } from './enums';
import { isRetryableBuildFailure } from './build-failure';

describe('isRetryableBuildFailure', () => {
  it('marks expected transient codes retryable', () => {
    expect(isRetryableBuildFailure(BuildFailureCode.github_api_transient)).toBe(true);
    expect(isRetryableBuildFailure(BuildFailureCode.repo_fetch_failed)).toBe(true);
    expect(isRetryableBuildFailure(BuildFailureCode.registry_push_failed)).toBe(true);
    expect(isRetryableBuildFailure(BuildFailureCode.timeout)).toBe(true);
  });

  it('marks non-transient codes non-retryable', () => {
    expect(isRetryableBuildFailure(BuildFailureCode.repo_not_found)).toBe(false);
    expect(isRetryableBuildFailure(BuildFailureCode.github_api_forbidden)).toBe(false);
    expect(isRetryableBuildFailure(BuildFailureCode.dockerfile_invalid)).toBe(false);
    expect(isRetryableBuildFailure(BuildFailureCode.build_failed)).toBe(false);
  });
});

