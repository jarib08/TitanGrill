# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Create .env file with Supabase credentials
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN echo "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}" > .env && \
    echo "VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}" >> .env && \
    cat .env

RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
