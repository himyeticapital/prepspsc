# Scrapling Service - Deployment Guide

Lightweight web scraping microservice using Scrapling + FastAPI, designed to run alongside Open Notebook on an AWS EC2 t2.micro (1GB RAM).

## Deployment Steps

### 1. Launch EC2 Instance

- AMI: Ubuntu 22.04 LTS
- Instance type: t2.micro (1 vCPU, 1GB RAM)
- Security group: allow SSH (22), and optionally 8502/5055 for tunneled access
- Storage: 20GB gp3

### 2. Add Swap (required for 1GB RAM)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3. Install Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

### 4. Deploy

```bash
# Copy files to server
scp -r docker-compose.yml scrapling-service/ ubuntu@<your-ec2-ip>:~/prepspsc/

# SSH into server
ssh ubuntu@<your-ec2-ip>
cd ~/prepspsc

# Configure environment
cp scrapling-service/.env.example .env
# Edit .env and fill in real secrets
nano .env

# Start all services
docker compose up -d
```

### 5. Configure Open Notebook

Access the UI via SSH tunnel:

```bash
ssh -L 8502:localhost:8502 ubuntu@<your-ec2-ip>
```

Then visit http://localhost:8502 in your browser and set your Google Gemini API key in Settings.

## Services

| Service | Port | RAM Limit | Description |
|---------|------|-----------|-------------|
| SurrealDB | 8000 | 200MB | Database for Open Notebook |
| Open Notebook | 5055/8502 | 500MB | API + Streamlit UI |
| Scrapling | 8100 | 150MB | Web scraping microservice |

Total: ~850MB with swap headroom.
