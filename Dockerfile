# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# B5: antes el Dockerfile sobrescribia .env con credenciales hardcodeadas, lo
# que volvia decorativa toda la configuracion de entorno y dejaba la anon key
# en el historial de la imagen. Ahora se pasan como build args.
#
# Uso:
#   docker build \
#     --build-arg VITE_SUPABASE_URL="https://<ref>.supabase.co" \
#     --build-arg VITE_SUPABASE_ANON_KEY="<anon key>" \
#     -t titan-grill .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Falla temprano y con mensaje claro si faltan, en vez de compilar una imagen
# que no puede conectarse.
RUN test -n "$VITE_SUPABASE_URL"      || (echo "ERROR: falta --build-arg VITE_SUPABASE_URL" && exit 1)
RUN test -n "$VITE_SUPABASE_ANON_KEY" || (echo "ERROR: falta --build-arg VITE_SUPABASE_ANON_KEY" && exit 1)

RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
