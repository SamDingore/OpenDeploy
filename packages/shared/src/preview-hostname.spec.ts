import { describe, expect, it } from 'vitest';
import {
  isPlatformManagedHostname,
  previewHostname,
  productionHostname,
  slugToDnsLabel,
} from './preview-hostname';

describe('previewHostname', () => {
  it('builds pr host', () => {
    expect(previewHostname({ pullRequestNumber: 42, projectSlug: 'My App!', platformDomain: 'deploy.local' })).toBe(
      'pr-42.my-app.deploy.local',
    );
  });

  it('production host', () => {
    expect(productionHostname({ projectSlug: 'demo', platformDomain: 'deploy.local' })).toBe('demo.deploy.local');
  });

  it('slugToDnsLabel', () => {
    expect(slugToDnsLabel('')).toBe('project');
  });
});

describe('isPlatformManagedHostname', () => {
  it('accepts prod and preview patterns', () => {
    expect(isPlatformManagedHostname('demo.deploy.local', 'deploy.local')).toBe(true);
    expect(isPlatformManagedHostname('pr-1.demo.deploy.local', 'deploy.local')).toBe(true);
  });

  it('rejects foreign domains', () => {
    expect(isPlatformManagedHostname('evil.com', 'deploy.local')).toBe(false);
  });
});
