FROM node:22-bookworm AS cpp-builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends cmake g++ make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend ./backend

RUN cmake -S backend -B backend/build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build backend/build --target crisismesh_simulation_cli -j2

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY server ./server
COPY --from=cpp-builder /app/backend/build/crisismesh_simulation_cli /app/backend/build/crisismesh_simulation_cli

EXPOSE 8080

CMD ["node", "server/index.mjs"]
