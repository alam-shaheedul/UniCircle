"""TLS/authenticated capture-only SMTP fixture; no relay or external delivery.

Only mounted in the isolated Compose smoke project, never shipped in images.
Uses a temporary trusted test certificate, not disabled TLS verification.
"""

import base64
import hashlib
import json
import os
import re
import socketserver
import ssl
import subprocess
from pathlib import Path

mail_dir = Path(os.environ["MAIL_DIR"])
cert = mail_dir / "cert.pem"
key = mail_dir / "key.pem"
subprocess.run(
    [
        "openssl",
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-sha256",
        "-nodes",
        "-keyout",
        str(key),
        "-out",
        str(cert),
        "-days",
        "1",
        "-subj",
        "/CN=smtp",
        "-addext",
        "subjectAltName=DNS:smtp",
    ],
    check=True,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
key.chmod(0o600)
tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
tls.minimum_version = ssl.TLSVersion.TLSv1_2
tls.load_cert_chain(cert, key)


class Handler(socketserver.StreamRequestHandler):
    def reply(self, value: str) -> None:
        self.wfile.write((value + "\r\n").encode())
        self.wfile.flush()

    def handle(self) -> None:
        self.reply("220 smtp Compose test capture")
        authenticated = False
        recipient = ""
        while line := self.rfile.readline(8192):
            command = line.decode("ascii", errors="replace").strip()
            verb = command.split(" ", 1)[0].upper()
            if verb in {"EHLO", "HELO"}:
                self.reply("250-smtp")
                self.reply("250-AUTH PLAIN")
                self.reply("250 SIZE 16384")
            elif verb == "AUTH":
                try:
                    values = base64.b64decode(command.split(" ")[-1]).split(b"\0")
                    authenticated = values[-2:] == [
                        b"compose-smoke",
                        b"synthetic-smoke-password",
                    ]
                except (ValueError, IndexError):
                    authenticated = False
                self.reply("235 Authenticated" if authenticated else "535 Denied")
            elif verb in {"MAIL", "RCPT", "DATA"} and not authenticated:
                self.reply("530 Authenticate first")
            elif verb == "MAIL":
                self.reply("250 Sender accepted")
            elif verb == "RCPT":
                match = re.search(r"<([^>]+)>", command)
                recipient = match.group(1) if match else ""
                # Never accept arbitrary real recipients; fixture-only addresses.
                self.reply(
                    "250 Recipient accepted"
                    if recipient.startswith("docker.registration")
                    else "550 Fixture address required"
                )
            elif verb == "DATA":
                self.reply("354 End with a single dot")
                chunks = []
                while part := self.rfile.readline(16384):
                    if part == b".\r\n":
                        break
                    chunks.append(part)
                    if sum(map(len, chunks)) > 16384:
                        return
                code = re.search(rb"verification code is (\d{6})", b"".join(chunks))
                if not code or not recipient.startswith("docker.registration"):
                    self.reply("550 Not a fixture verification email")
                    continue
                name = hashlib.sha256(recipient.encode()).hexdigest()
                (mail_dir / f"{name}.json").write_text(
                    json.dumps({"code": code.group(1).decode()}), encoding="utf-8"
                )
                self.reply("250 Captured, never relayed")
            elif verb == "QUIT":
                self.reply("221 Bye")
                return
            elif verb in {"RSET", "NOOP"}:
                self.reply("250 OK")
            else:
                self.reply("502 Unsupported fixture command")


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def get_request(self):
        connection, address = super().get_request()
        connection.settimeout(10)
        return tls.wrap_socket(connection, server_side=True), address


with Server(("0.0.0.0", 15465), Handler) as server:
    print(
        "TLS-only capture SMTP fixture ready; no external email delivery.", flush=True
    )
    server.serve_forever()
