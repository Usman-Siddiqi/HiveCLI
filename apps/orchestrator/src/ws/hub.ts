import type { Server as HttpServer } from "node:http";

import { WebSocketServer } from "ws";

import type { AgentEvent } from "@hive/shared";

export class EventHub {
  private server: WebSocketServer;

  constructor(httpServer: HttpServer) {
    this.server = new WebSocketServer({ server: httpServer, path: "/ws" });
  }

  broadcastEvent(event: AgentEvent) {
    const payload = JSON.stringify({ kind: "agent-event", data: event });
    for (const client of this.server.clients) {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    }
  }
}
