"""Opt-in HTTP checks of compiled admin Nginx and the isolated public gateway."""

import http.client
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]


def docker(*arguments):
    return subprocess.run(["docker", *arguments], check=True, capture_output=True, text=True).stdout.strip()


def main():
    assert os.environ.get("JOURNALS_PROXY_SYNTHETIC") == "1", "Explicit isolated proxy opt-in required"
    image = os.environ.get("JOURNALS_PROXY_IMAGE", "mirror-admin:journals-stage5")
    public_config = Path(os.environ.get("JOURNALS_PUBLIC_NGINX_CONFIG", ROOT.parent / "mirror-deploy/nginx/default.conf"))
    assert public_config.is_file()
    suffix = uuid4().hex[:10]
    network = "journals-proxy-" + suffix
    ingress = network + "-ingress"
    names = [network + "-api", network + "-admin", network + "-public"]
    created = []
    counts = {"admin_allowed": 0, "admin_blocked": 0, "public_blocked": 0}
    with tempfile.TemporaryDirectory(prefix="journals-proxy-") as directory:
        script = Path(directory) / "upstream.py"
        script.write_text('''import json
from http.server import BaseHTTPRequestHandler, HTTPServer
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.rfile.read(int(self.headers.get('Content-Length',0)))
        body=json.dumps(dict(method=self.command,path=self.path,host=self.headers.get('Host'),key=self.headers.get('Idempotency-Key'),origin=self.headers.get('Origin'))).encode()
        self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers()
        if self.command != 'HEAD': self.wfile.write(body)
    do_POST=do_PATCH=do_PUT=do_DELETE=do_HEAD=do_OPTIONS=do_GET
    def log_message(self,*args): pass
HTTPServer(('0.0.0.0',8000),Handler).serve_forever()
''')
        try:
            docker("network", "create", "--internal", network)
            docker("network", "create", ingress)
            docker("run", "--rm", "-d", "--name", names[0], "--network", network, "--network-alias", "admin-api", "--network-alias", "api", "--mount", f"type=bind,source={script},target=/upstream.py,readonly", "python:3.14-slim", "python", "/upstream.py")
            created.append(names[0])
            docker("run", "--rm", "-d", "--name", names[1], "--network", ingress,
                   "--read-only", "--cap-drop", "ALL", "--tmpfs", "/tmp",
                   "--tmpfs", "/etc/nginx/conf.d:uid=101,gid=101,mode=0755",
                   "-e", "ADMIN_ALLOWED_HOSTS=localhost", "-p", "127.0.0.1::8080", image)
            created.append(names[1])
            docker("network", "connect", network, names[1])
            docker("run", "--rm", "-d", "--name", names[2], "--network", ingress,
                   "--read-only", "--tmpfs", "/var/cache/nginx",
                   "--tmpfs", "/var/run", "--mount", f"type=bind,source={public_config},target=/etc/nginx/conf.d/default.conf,readonly",
                   "-p", "127.0.0.1::80", "nginx:1.27-alpine")
            created.append(names[2])

            def port(name, internal):
                for _ in range(20):
                    mapping = json.loads(docker("inspect", "--format", "{{json .NetworkSettings.Ports}}", name))
                    binding = mapping.get(f"{internal}/tcp")
                    if binding:
                        return int(binding[0]["HostPort"])
                    time.sleep(.1)
                raise AssertionError("No published loopback port: " + docker("logs", name)[-1000:])

            admin_port, public_port = port(names[1], 8080), port(names[2], 80)

            def request(target, path, method="GET", host=None):
                connection = http.client.HTTPConnection("127.0.0.1", target, timeout=3)
                host = host or f"localhost:{target}"
                connection.request(method, path, body=b"{}" if method in {"POST", "PATCH", "PUT"} else None,
                                   headers={"Host": host, "Origin": f"http://{host}", "Idempotency-Key": "synthetic-proxy-key", "Content-Type": "application/json"})
                response = connection.getresponse()
                result = response.status, dict(response.getheaders()), response.read()
                connection.close()
                return result

            for _ in range(40):
                try:
                    if request(admin_port, "/api/admin/journals/templates")[0] == 200 and request(public_port, "/api/admin")[0] == 404:
                        break
                except (OSError, http.client.HTTPException):
                    pass
                time.sleep(.2)
            else:
                raise AssertionError("Isolated proxy containers did not become ready")

            assert docker("exec", names[1], "id", "-u") != "0"
            owner, run = str(uuid4()), str(uuid4())
            root = f"/api/admin/users/{owner}/journals"
            for path, method in [(root, "GET"), (root, "POST"), (root + "/preview-activation", "POST"),
                                 (root + "/" + run, "GET"), (root + "/" + run, "PATCH"),
                                 (root + "/" + run + "/preview", "POST"), (root + "/" + run + "/actions", "POST"),
                                 (root + "/" + run + "/revisions", "GET"), (f"/api/admin/users/{owner}/laboratory", "PATCH")]:
                status, headers, body = request(admin_port, path, method)
                assert status == 200, (path, method, status)
                value = json.loads(body)
                assert value["path"] == path and value["method"] == method
                assert value["host"] == f"localhost:{admin_port}"
                assert value["origin"] == f"http://localhost:{admin_port}"
                assert value["key"] == "synthetic-proxy-key"
                assert headers["Cache-Control"] == "no-store"
                counts["admin_allowed"] += 1
            for path, method in [(root, "PATCH"), (root, "DELETE"), (root + "/" + run, "POST"),
                                 (root + "/" + run, "DELETE"), (root + "/preview-activation", "PATCH"),
                                 (root + "/" + run + "/actions", "PATCH"), (root + "/" + run + "/revisions", "POST"),
                                 ("/api/admin/journals/templates", "POST"), ("/api/admin/users", "POST")]:
                assert request(admin_port, path, method)[0] == 405, (path, method)
                counts["admin_blocked"] += 1
            for path in ["/api/admin", "/api/admin/journals/templates", root, root + "/" + run, "/api/%61dmin/journals/templates", "/admin/"]:
                for method in ["GET", "POST", "PATCH", "DELETE"]:
                    assert request(public_port, path, method)[0] == 404, (path, method)
                    counts["public_blocked"] += 1
            assert request(admin_port, "/")[0] == 200
            print(json.dumps({"passed": True, **counts, "host_and_idempotency_preserved": True, "runtime_non_root": True}))
        finally:
            for name in reversed(created):
                subprocess.run(["docker", "rm", "-f", name], capture_output=True)
            subprocess.run(["docker", "network", "rm", network], capture_output=True)
            subprocess.run(["docker", "network", "rm", ingress], capture_output=True)


if __name__ == "__main__":
    main()
