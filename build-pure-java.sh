#!/usr/bin/env bash
set -e

echo "=========================================================="
echo " Building Pure Java Deployment (Zero Node.js in Production)"
echo "=========================================================="

# 1. Compile the React Frontend
echo "--> [1/3] Building React Frontend..."
npm run build

# 2. Synchronize built frontend into Spring Boot static resources
echo "--> [2/3] Embedding Frontend Assets into Spring Boot static resources..."
mkdir -p backend-spring-boot/src/main/resources/static
rm -rf backend-spring-boot/src/main/resources/static/*
cp -r dist/* backend-spring-boot/src/main/resources/static/

# 3. Package Spring Boot into Executable Fat JAR
echo "--> [3/3] Packaging Spring Boot Fat JAR..."
cd backend-spring-boot
mvn clean package -DskipTests

echo "=========================================================="
echo " SUCCESS! Standalone Pure Java Executable JAR ready:"
echo " backend-spring-boot/target/ado-architecture-mapper-backend-1.0.0-SNAPSHOT.jar"
echo ""
echo " Run with ZERO Node.js:"
echo "   java -jar backend-spring-boot/target/ado-architecture-mapper-backend-1.0.0-SNAPSHOT.jar"
echo "=========================================================="
