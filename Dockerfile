# ==============================================================================
# Multi-Stage Docker Build for Pure Java Deployment (Zero Node.js Runtime in Production)
# ==============================================================================

# Stage 1: Build React Frontend Assets
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Build Spring Boot Executable Fat JAR
FROM maven:3.9.6-eclipse-temurin-21-alpine AS backend-builder
WORKDIR /app
COPY backend-spring-boot/pom.xml ./pom.xml
RUN mvn dependency:go-offline -B
COPY backend-spring-boot/src ./src
# Inject compiled frontend from Stage 1 into Spring Boot static resources
COPY --from=frontend-builder /app/dist/ ./src/main/resources/static/
RUN mvn clean package -DskipTests -B

# Stage 3: Lightweight Production JRE Container (Zero Node.js, Pure Java 21)
FROM eclipse-temurin:21-jre-alpine AS runner
WORKDIR /app

# Non-root unprivileged service account
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=backend-builder /app/target/*.jar app.jar

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
