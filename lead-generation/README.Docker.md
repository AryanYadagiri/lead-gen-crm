# Docker Deployment Guide for Lead Generation Backend (GraalVM Native Image)

This service is configured to build ahead-of-time (AOT) into a high-performance **GraalVM Native Image** inside Docker.

---

## Option 1: Automated Cloud Build & Push (Recommended)

Since GraalVM Native Image compilation is memory-intensive and Docker is not required on your local machine, a GitHub Actions workflow is provided at [`.github/workflows/docker-publish.yml`](../.github/workflows/docker-publish.yml).

### Steps to activate:
1. Go to your GitHub repository: [AryanYadagiri/lead-gen-crm](https://github.com/AryanYadagiri/lead-gen-crm)
2. Navigate to **Settings** > **Secrets and variables** > **Actions**.
3. Add two repository secrets:
   - `DOCKERHUB_USERNAME`: your Docker Hub username (`aryanyadagiri`)
   - `DOCKERHUB_TOKEN`: your Docker Hub Personal Access Token (PAT from Docker Hub > Account Settings > Security)
4. Any push to `main` with changes in `lead-generation/` or manual trigger via the **Actions** tab will automatically build the GraalVM native image and push to:
   `aryanyadagiri/lead-generation:latest` (or your custom tag).

---

## Option 2: Local Docker Build & Push

If you install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/):

```bash
# 1. Log in to Docker Hub
docker login

# 2. Build the GraalVM Native Image container (specifying linux/amd64 for cloud compatibility)
docker build --platform=linux/amd64 -t aryanyadagiri/lead-generation:v1 ./lead-generation

# 3. Push to Docker Hub
docker push aryanyadagiri/lead-generation:v1
```

---

## Option 3: Direct Render Cloud Deployment

Render can build the Dockerfile directly from your GitHub repository:
1. In Render Dashboard, click **New +** > **Web Service**.
2. Connect `AryanYadagiri/lead-gen-crm`.
3. Set:
   - **Root Directory**: `lead-generation`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `Dockerfile`
4. Render will automatically build the GraalVM native image and bind to `$PORT`.