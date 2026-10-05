import type { ClientCommand, ServerEvent } from "@lacc/shared";

type Handler = (event: ServerEvent) => void;
type ConnectionHandler = (connected: boolean) => void;

class WsClient {
  private socket: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private connectionHandlers = new Set<ConnectionHandler>();
  private reconnectDelay = 500;
  private queue: ClientCommand[] = [];
  private connected = false;

  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
    this.socket = socket;

    socket.onopen = () => {
      this.connected = true;
      this.reconnectDelay = 500;
      this.connectionHandlers.forEach((h) => h(true));
      while (this.queue.length) {
        const cmd = this.queue.shift();
        if (cmd) socket.send(JSON.stringify(cmd));
      }
    };

    socket.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data) as ServerEvent;
        this.handlers.forEach((h) => h(event));
      } catch {
        /* ignore malformed frame */
      }
    };

    socket.onclose = () => {
      this.connected = false;
      this.connectionHandlers.forEach((h) => h(false));
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.6, 10_000);
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  send(command: ClientCommand): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(command));
    } else {
      this.queue.push(command);
      this.connect();
    }
  }

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }
}

export const wsClient = new WsClient();
