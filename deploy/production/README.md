# Q Edu Production Deploy

Server path: `/opt/qedu`

Required files on server:

- `docker-compose.yml`
- `nginx.conf`
- `.env`

The GitHub workflows upload `docker-compose.yml` and `nginx.conf`.
The backend workflow writes `.env` from GitHub Actions secrets.

Default public routes:

- Frontend: `http://161.97.163.157/`
- Backend API: `http://161.97.163.157/api/`
- Health check: `http://161.97.163.157/api/health`

Use domains by replacing `server_name _;` in `nginx.conf`, then add TLS with Certbot or a reverse proxy that manages certificates.
