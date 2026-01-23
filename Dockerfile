# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Create .env file with Supabase credentials
RUN echo "VITE_SUPABASE_URL=https://mbyjehhplruoqlgphfvw.supabase.co" > .env && \
    echo "VITE_SUPABASE_ANON_KEY=sb_publishable_ouDY6PbVEx52C7TcxuQ8Ig_Xq7q6can" >> .env

RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
