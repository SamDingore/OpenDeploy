import { describe, expect, it } from 'vitest';
import {
  collidesWithPlatformDomain,
  isApexHostname,
  isValidCustomHostnameShape,
  normalizeCustomHostname,
  verificationTxtRecordName,
} from './custom-hostname';

describe('normalizeCustomHostname', () => {
  it('lowercases and strips trailing dot', () => {
    expect(normalizeCustomHostname(' App.Example.COM. ')).toBe('app.example.com');
  });
});

describe('isValidCustomHostnameShape', () => {
  it('requires at least three labels (subdomain MVP)', () => {
    expect(isValidCustomHostnameShape('example.com')).toBe(false);
    expect(isValidCustomHostnameShape('app.example.com')).toBe(true);
  });
});

describe('isApexHostname', () => {
  it('detects two-label hostnames', () => {
    expect(isApexHostname('example.com')).toBe(true);
    expect(isApexHostname('app.example.com')).toBe(false);
  });
});

describe('collidesWithPlatformDomain', () => {
  it('reuses platform hostname rules', () => {
    expect(collidesWithPlatformDomain('myproj.deploy.local', 'deploy.local')).toBe(true);
    expect(collidesWithPlatformDomain('app.customer.com', 'deploy.local')).toBe(false);
  });
});

describe('verificationTxtRecordName', () => {
  it('prefixes _opendeploy', () => {
    expect(verificationTxtRecordName('app.example.com')).toBe('_opendeploy.app.example.com');
  });
});
