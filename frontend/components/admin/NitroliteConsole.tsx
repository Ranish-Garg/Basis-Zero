"use client";

import { useEffect, useState, useRef } from 'react';
import { yellowEvents, YellowEvent } from '@/lib/events';
import { Terminal, Copy, X, Minimize2, Maximize2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export function NitroliteConsole() {
    const [logs, setLogs] = useState<YellowEvent[]>([]);
    const [isOpen, setIsOpen] = useState(false); // Start minimized to not block view
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = yellowEvents.subscribe((event) => {
            setLogs(prev => [...prev, event]);
            // Also toast it for "briefly appearing" requirement
            if (event.type === 'SIGNATURE') {
                toast.success('✍️ Session Signed Off-Chain', {
                    description: `Hash: ${event.hash?.slice(0, 10)}...`,
                    action: {
                        label: 'Copy',
                        onClick: () => navigator.clipboard.writeText(event.hash || '')
                    }
                });
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (isOpen) {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isOpen]);

    const copyLog = (log: YellowEvent) => {
        const text = JSON.stringify(log, null, 2);
        navigator.clipboard.writeText(text);
        toast.success('Log copied to clipboard');
    };

    const clearLogs = () => setLogs([]);

    if (logs.length === 0 && !isOpen) return null; // Hide if empty and closed

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end pointer-events-none">
            <div className="pointer-events-auto">
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            className="w-[500px] h-[300px] bg-black/90 border border-yellow-500/30 rounded-lg shadow-2xl backdrop-blur-md flex flex-col overflow-hidden mb-2"
                        >
                            <div className="flex items-center justify-between p-2 border-b border-yellow-500/20 bg-yellow-950/20">
                                <div className="flex items-center gap-2 text-yellow-500">
                                    <Terminal size={14} />
                                    <span className="text-xs font-mono font-bold">NITROLITE SESSION LOG</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={clearLogs} className="text-zinc-500 hover:text-white transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                    <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-2 scrollbar-thin scrollbar-thumb-yellow-900 scrollbar-track-transparent">
                                {logs.map((log, i) => (
                                    <div key={i} className="group relative p-2 rounded bg-white/5 hover:bg-white/10 transition-colors border-l-2 border-yellow-500/50">
                                        <div className="flex justify-between text-zinc-400 mb-1">
                                            <span className="text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                            <span className={`text-[10px] font-bold ${
                                                log.type === 'SIGNATURE' ? 'text-green-400' : 
                                                log.type === 'ERROR' ? 'text-red-400' : 'text-blue-400'
                                            }`}>{log.type}</span>
                                        </div>
                                        <div className="text-zinc-300 break-all">{log.message}</div>
                                        {log.hash && (
                                            <div className="mt-1 p-1 bg-black/50 rounded text-yellow-200/80 break-all text-[10px] select-all cursor-pointer"
                                                 onClick={() => {
                                                     navigator.clipboard.writeText(log.hash || '');
                                                     toast.success('Hash copied');
                                                 }}>
                                                {log.hash}
                                            </div>
                                        )}
                                        {log.data && (
                                            <pre className="mt-1 text-[9px] text-zinc-500 overflow-hidden text-ellipsis">
                                                {JSON.stringify(log.data)}
                                            </pre>
                                        )}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); copyLog(log); }}
                                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-yellow-500/20 hover:bg-yellow-500/40 rounded text-yellow-500 transition-all"
                                        >
                                            <Copy size={12} />
                                        </button>
                                    </div>
                                ))}
                                <div ref={endRef} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border backdrop-blur-md transition-colors ${
                        isOpen 
                            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                >
                    <Terminal size={16} className={logs.some(l => l.type === 'SIGNATURE' && Date.now() - l.timestamp < 5000) ? "animate-pulse text-yellow-400" : ""} />
                    {!isOpen && logs.length > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] font-bold text-black">
                            {logs.length}
                        </span>
                    )}
                    <span className="text-xs font-medium">Nitrolite Logs</span>
                </motion.button>
            </div>
        </div>
    );
}
