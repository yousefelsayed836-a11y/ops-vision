# OpsVision on a shared DigitalOcean Droplet

This is a deployment plan, not evidence of a completed deployment. The existing websites must remain untouched. The provided Droplet screenshot shows Ubuntu 24.04, 1 vCPU and 1 GB RAM; check actual free RAM, disk and existing services before building or starting OpsVision. A production build, PostgreSQL and existing sites may exceed available resources.

## Access and discovery

DigitalOcean's **Web Console** on the Droplet page provides terminal access without a local SSH key. In the console, inspect `free -h`, `df -h`, `sudo ss -ltnp`, `docker compose version`, `sudo nginx -T` (if nginx is installed) and `sudo systemctl status nginx`. These are read-only checks. Do not replace the existing reverse proxy, stop containers or overwrite virtual hosts.

## Isolation

Use a dedicated hostname such as `opsvision.example.com` with an A record to the Droplet. The Compose project is explicitly named `opsvision`; its PostgreSQL volume and services stay separate from other Compose projects. The app binds only to `127.0.0.1:3100` by default, not to the public network and not to ports 80/443. Check that port 3100 is unused before starting. `OPSVISION_HOST_PORT` can select another unused loopback port if necessary, and the reverse-proxy target must match it.

Do not copy the local `.env` or `.data` directory to the server. Create fresh production secrets privately on the Droplet. Set `DATABASE_URL` to the internal Compose host `postgres`, and set `APP_URL` and `BETTER_AUTH_URL` to the same final `https://` origin. Keep credentials out of Git and terminal history. Use a separate managed database or increase capacity if the 1 GB Droplet cannot support a local PostgreSQL container plus existing sites.

## Release sequence

1. Confirm the exact GitHub repository has the desired commit and that the server can read it. Clone into a new directory, for example `/opt/opsvision`; never clone into an existing site's directory.
2. Create the private environment file and validate it with `docker compose config -q` (quiet mode avoids printing secret values). Run `docker compose up -d --build` only after checking free capacity, existing ports and a backup plan. Building the Next.js image on a 1 GB server may fail from memory pressure; build on a larger machine or publish a prebuilt image if needed.
3. Confirm `curl -fsS http://127.0.0.1:3100/api/health` on the Droplet reports the app and database healthy. Do not advertise the site before this check.
4. Add a *new* Nginx server block based on `infrastructure/nginx-opsvision.conf.example`, replacing its hostname. If a different proxy already owns 80/443, add an equivalent host rule there instead. Run `sudo nginx -t` before reloading Nginx. Do not edit or remove other sites' blocks.
5. Issue a valid TLS certificate for the dedicated hostname using the existing proxy's certificate workflow. Redirect HTTP to HTTPS. Verify login, dashboards, `/api/health`, PWA manifest/service worker and installation from the public HTTPS hostname.
6. Run the initial administrator setup privately on the server, then test a wash owner and assistant account. Configure backups, monitor the app/worker and perform a restore test before production use.

The public IP alone is not a suitable production login/PWA URL. A dedicated DNS name and HTTPS are needed. Camera IP registration remains metadata until an authorized, reachable stream and per-bay calibration are verified.
