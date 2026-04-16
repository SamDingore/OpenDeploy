/**
 * One site block per validated hostname — no user-supplied raw Caddy config.
 */
export function buildCaddyfile(input: {
  routes: { host: string; upstreamDial: string }[];
  email?: string;
}): string {
  const global = input.email
    ? `{
	email ${input.email}
}

`
    : '';
  const sites = input.routes.map((r) => {
    const host = r.host.trim();
    const dial = r.upstreamDial.trim();
    return `${host} {
	reverse_proxy ${dial}
}`;
  });
  return `${global}${sites.join('\n\n')}`.trim();
}
