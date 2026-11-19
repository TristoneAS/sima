import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const puerto = 3443;
const destino = 3000;
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pfxPath = path.join(raiz, "certificates", "sima.pfx");

if (!fs.existsSync(pfxPath)) {
  console.error("Falta certificates/sima.pfx");
  process.exit(1);
}

const server = https.createServer(
  { pfx: fs.readFileSync(pfxPath), passphrase: "sima-local" },
  (req, res) => {
    const proxy = http.request(
      {
        hostname: "127.0.0.1",
        port: destino,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          "x-forwarded-proto": "https",
        },
      },
      (upstream) => {
        res.writeHead(upstream.statusCode || 502, upstream.headers);
        upstream.pipe(res);
      },
    );
    proxy.on("error", () => {
      if (res.headersSent) return;
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("SIMA no está disponible en este momento.");
    });
    req.pipe(proxy);
  },
);

server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(destino, "127.0.0.1", () => {
    const headers = Object.entries(req.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\r\n");
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`);
    if (head?.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(puerto, "0.0.0.0", () => {
  console.log(`SIMA seguro en https://10.56.107.127:${puerto}/dashboard/llenado`);
});
