import { describe, expect, it } from 'vitest';
import { buildCaddyfile } from './caddy-config';

describe('buildCaddyfile', () => {
  it('emits site blocks', () => {
    const f = buildCaddyfile({
      routes: [{ host: 'pr-1.demo.deploy.local', upstreamDial: 'od-rt-abc:3000' }],
    });
    expect(f).toContain('pr-1.demo.deploy.local');
    expect(f).toContain('reverse_proxy od-rt-abc:3000');
  });
});
