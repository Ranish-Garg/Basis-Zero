export type YellowEvent = {
    type: 'SIGNATURE' | 'SETTLEMENT' | 'ERROR';
    hash?: string;
    data?: any;
    message: string;
    timestamp: number;
};

class EventBus {
    private listeners: ((event: YellowEvent) => void)[] = [];

    emit(event: Omit<YellowEvent, 'timestamp'>) {
        const fullEvent = { ...event, timestamp: Date.now() };
        this.listeners.forEach(l => l(fullEvent));
    }

    subscribe(listener: (event: YellowEvent) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
}

export const yellowEvents = new EventBus();
