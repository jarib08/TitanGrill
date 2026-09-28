# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# B5: antes el Dockerfile sobrescribia .env con credenciales hardcodeadas, lo
# que volvia decorativa toda la configuracion de entorno y dejaba la anon key
# en el historial de la imagen. Ahora se pasan como build args.
#
# En EasyPanel se configuran en la seccion de Build Args / Environment del
# servicio. Si faltan, el build FALLA a proposito en vez de producir una imagen
# que no puede conectarse a la base.
#
# Uso local:
#   docker build \
#     --build-arg VITE_SUPABASE_URL="https://<ref>.supabase.co" \
#     --build-arg VITE_SUPABASE_ANON_KEY="<anon key>" \
#     -t titan-grill .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# La validacion va ANTES de npm ci a proposito: un deploy mal configurado falla
# en segundos con un mensaje claro, no despues de varios minutos de instalacion.
RUN test -n "$VITE_SUPABASE_URL" || \
    (echo "ERROR: falta el build arg VITE_SUPABASE_URL. Configurelo en EasyPanel > Build Args." && exit 1)
RUN test -n "$VITE_SUPABASE_ANON_KEY" || \
    (echo "ERROR: falta el build arg VITE_SUPABASE_ANON_KEY. Configurelo en EasyPanel > Build Args." && exit 1)

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
