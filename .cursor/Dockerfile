# Kinetix cloud agent: Node 22, pnpm 8, persistent store
FROM node:22-bookworm

# Enable Corepack and install pnpm 8.15.0
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Ensure store path exists and is writable (Cursor may run as root or ubuntu)
RUN mkdir -p /home/ubuntu/.pnpm-store && chmod -R 777 /home/ubuntu

ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN pnpm config set store-dir /home/ubuntu/.pnpm-store
