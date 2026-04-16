'use client';

import { stripControlChars } from '@/lib/sanitize';
import { useEffect, useMemo, useState } from 'react';

type StreamEvent =
  | { type: 'status'; deploymentId: string; status: string; at: string }
  | { type: 'log'; deploymentId: string; seq: number; level: string; message: string; at: string };

export function DeploymentLive(props: { eventUrl: string; initialStatus: string }) {
  const [status, setStatus] = useState(props.initialStatus);
  const [logs, setLogs] = useState<{ seq: number; level: string; message: string }[]>([]);

  const sortedLogs = useMemo(() => [...logs].sort((a, b) => a.seq - b.seq), [logs]);

  useEffect(() => {
    const es = new EventSource(props.eventUrl);
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as StreamEvent;
        if (msg.type === 'status') {
          setStatus(msg.status);
        }
        if (msg.type === 'log') {
          setLogs((prev) => {
            if (prev.some((p) => p.seq === msg.seq)) {
              return prev;
            }
            return [...prev, { seq: msg.seq, level: msg.level, message: msg.message }];
          });
        }
      } catch {
        /* ignore malformed chunks */
      }
    };
    es.onerror = () => {
      /* browser will retry */
    };
    return () => es.close();
  }, [props.eventUrl]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
        <span className="text-zinc-600">Status:</span>{' '}
        <span className="font-mono font-medium">{status}</span>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-zinc-700">Logs</h3>
        <pre className="max-h-[480px] overflow-auto rounded-md border border-zinc-200 bg-black p-3 font-mono text-xs text-green-200">
          {sortedLogs.map((l) => (
            <div key={l.seq}>
              <span className="text-zinc-500">{l.seq}</span>{' '}
              <span className="text-zinc-400">{l.level}</span>{' '}
              <span>{stripControlChars(l.message)}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
