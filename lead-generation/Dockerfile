# syntax=docker/dockerfile:1

# ==============================================================================
# Stage 1: The Cloud Builder (GraalVM Native Image Compiler for Java 25)
# ==============================================================================
ARG GRAALVM_IMAGE=ghcr.io/graalvm/native-image-community:25
FROM ${GRAALVM_IMAGE} AS builder

WORKDIR /build

# Copy Maven wrapper and POM first for optimal Docker layer caching
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

# Normalize line endings and ensure execution permission on Linux environments
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw

# Pre-fetch project dependencies to accelerate rebuilds
RUN ./mvnw dependency:go-offline -B -DskipTests || true

# Copy application source code
COPY src/ src/

# Build ahead-of-time (AOT) GraalVM native binary using the native profile
RUN ./mvnw -Pnative native:compile -DskipTests -B

# ==============================================================================
# Stage 2: The Tiny Runner (Lightweight clean runtime container)
# ==============================================================================
FROM ubuntu:latest AS runner

WORKDIR /app

# Install standard CA certificates and timezone data
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ca-certificates tzdata && \
    ln -fs /usr/share/zoneinfo/Asia/Kolkata /etc/localtime && \
    dpkg-reconfigure --frontend noninteractive tzdata && \
    rm -rf /var/lib/apt/lists/*

ENV TZ="Asia/Kolkata"

# Create a non-privileged system user and group for container security
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app -s /sbin/nologin appuser

# Copy only the compiled standalone native binary from the builder stage
COPY --from=builder --chown=appuser:appgroup /build/target/lead-generation /app/lead-generation

# Ensure native executable permissions
RUN chmod +x /app/lead-generation

USER appuser

EXPOSE 8080

ENTRYPOINT ["/app/lead-generation"]
