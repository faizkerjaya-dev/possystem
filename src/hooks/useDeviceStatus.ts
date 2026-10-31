import { useEffect, useState } from 'react';
import { COL } from '@/config/collections';
import { colRef } from '@/services/db';
import type { AgentStatus } from '@/types/models';
import { useLiveQuery } from './useLive';
import { useNow } from './useNow';

/** Agent is "online" if it sent a heartbeat in the last 60 seconds. */
const AGENT_STALE_MS = 60_000;

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function usePrinterStatus() {
  const now = useNow(10_000);
  const agents = useLiveQuery<AgentStatus>(() => colRef(COL.agents), []);
  const agent = [...agents.data].sort((a, b) => b.lastSeen - a.lastSeen)[0] ?? null;
  const agentOnline = !!agent && now - agent.lastSeen < AGENT_STALE_MS;
  return {
    agent,
    agentOnline,
    printerOnline: agentOnline && !!agent?.printerOnline,
    label: !agent ? 'No print agent' : !agentOnline ? 'Print agent offline' : agent.printerOnline ? 'Printer' : 'Printer offline',
  };
}
