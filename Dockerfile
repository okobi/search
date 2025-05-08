# 1. Use official Node.js image
FROM node:20-alpine

# 2. Set working directory
WORKDIR /app

# 3. Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# 4. Copy the rest of your app
COPY . .

# 5. Generate Prisma Client (important for dev + TypeScript)
RUN npx prisma generate

# 6. Expose Next.js dev port
EXPOSE 3000

# 7. Run in dev mode with TypeScript
CMD ["npm", "run", "dev"]
