import tls from 'node:tls';

export interface PeerCertSummary {
  notBefore: Date;
  notAfter: Date;
  serialMasked: string;
}

/**
 * Best-effort leaf certificate read (TLS handshake). Uses rejectUnauthorized: false — metadata only.
 */
export function probePeerCertificate(
  hostname: string,
  port = 443,
  timeoutMs = 12_000,
): Promise<PeerCertSummary | null> {
  return new Promise((resolve) => {
    const socket = tls.connect({
      host: hostname,
      port,
      servername: hostname,
      rejectUnauthorized: false,
      timeout: timeoutMs,
    });

    const finish = (v: PeerCertSummary | null) => {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(v);
    };

    socket.on('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      if (!cert?.valid_from || !cert.valid_to) {
        finish(null);
        return;
      }
      const serial = String(cert.serialNumber ?? '');
      const serialMasked =
        serial.length <= 8 ? '***' : `${serial.slice(0, 4)}…${serial.slice(-2)}`;
      finish({
        notBefore: new Date(cert.valid_from),
        notAfter: new Date(cert.valid_to),
        serialMasked,
      });
    });
    socket.on('error', () => finish(null));
    socket.on('timeout', () => finish(null));
  });
}
