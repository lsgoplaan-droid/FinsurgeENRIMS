# FinsurgeENRIMS -- Production Infrastructure Guide

**Prepared by**: DevOps / SRE Team
**Date**: 08-Apr-2026
**Version**: 1.0
**Classification**: Confidential -- Operations

---

## Purpose

This guide covers the production infrastructure components that require real cloud services, certificates, and external tooling -- things that cannot be simulated in application code alone. Follow these instructions to deploy FinsurgeENRIMS in a production banking environment.

**Deployment target**: Azure Central India (per RBI data localization mandate)

---

## Table of Contents

1. [PostgreSQL Database](#1-postgresql-database)
2. [TLS / HTTPS](#2-tls--https)
3. [MFA / TOTP](#3-mfa--totp)
4. [Kubernetes Deployment](#4-kubernetes-deployment)
5. [Prometheus + Grafana](#5-prometheus--grafana)
6. [PagerDuty / OpsGenie Alerting](#6-pagerduty--opsgenie-alerting)
7. [Redis](#7-redis)
8. [WAF (Web Application Firewall)](#8-waf-web-application-firewall)
9. [HashiCorp Vault](#9-hashicorp-vault)

---

## 1. PostgreSQL Database

### 1.1 Managed Instance Setup

**Azure Database for PostgreSQL Flexible Server (Central India)**

```bash
# Create resource group
az group create --name finsurge-enrims-prod-rg --location centralindia

# Create Azure PostgreSQL Flexible Server in Central India
az postgres flexible-server create \
  --resource-group finsurge-enrims-prod-rg \
  --name finsurge-enrims-prod \
  --location centralindia \
  --admin-user enrims_admin \
  --admin-password "$(vault kv get -field=db_password secret/enrims/prod)" \
  --sku-name Standard_D4s_v3 \
  --tier GeneralPurpose \
  --storage-size 128 \
  --version 15 \
  --high-availability ZoneRedundant \
  --backup-retention 35 \
  --geo-redundant-backup Disabled \
  --tags Project=FinsurgeENRIMS Environment=production

# Create read replica for reporting queries
az postgres flexible-server replica create \
  --resource-group finsurge-enrims-prod-rg \
  --replica-name finsurge-enrims-prod-replica \
  --source-server finsurge-enrims-prod \
  --location centralindia
```

### 1.2 Connection String Format

Update the `DATABASE_URL` environment variable in the application config:

```bash
# Standard PostgreSQL connection string (Azure Flexible Server)
DATABASE_URL=postgresql://enrims_admin:<password>@finsurge-enrims-prod.postgres.database.azure.com:5432/enrims_prod?sslmode=require

# With PgBouncer (connection pooling proxy)
DATABASE_URL=postgresql://enrims_admin:<password>@localhost:6432/enrims_prod?sslmode=require
```

In the FastAPI application (`backend/app/database.py`), update the engine creation:

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=30,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True,
    connect_args={"sslmode": "require"},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

### 1.3 PgBouncer Configuration

Install and configure PgBouncer for connection pooling between the application and PostgreSQL:

```ini
; /etc/pgbouncer/pgbouncer.ini

[databases]
enrims_prod = host=finsurge-enrims-prod.postgres.database.azure.com port=5432 dbname=enrims_prod

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

; Pool settings
pool_mode = transaction
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3
max_client_conn = 200
max_db_connections = 50

; Timeouts
server_idle_timeout = 300
client_idle_timeout = 0
query_timeout = 30
query_wait_timeout = 60

; Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1

; TLS to RDS
server_tls_sslmode = require
server_tls_ca_file = /etc/ssl/certs/rds-combined-ca-bundle.pem

; Admin
admin_users = pgbouncer_admin
stats_users = pgbouncer_stats
```

```bash
# /etc/pgbouncer/userlist.txt
"enrims_admin" "SCRAM-SHA-256$4096:salt$stored_key:server_key"

# Start PgBouncer
sudo systemctl enable pgbouncer
sudo systemctl start pgbouncer
```

### 1.4 Backup Schedule (CRON)

```bash
# /etc/cron.d/enrims-backup

# Daily logical backup at 02:30 IST (21:00 UTC previous day)
0 21 * * * postgres pg_dump -Fc -h finsurge-enrims-prod.postgres.database.azure.com -U enrims_admin -d enrims_prod | az storage blob upload --account-name finsurgeenrimsbackups --container-name daily --name "enrims_$(date +\%Y\%m\%d_\%H\%M).dump" --file /dev/stdin --auth-mode login --overwrite

# Weekly full backup (Sunday 03:00 IST)
30 21 * * 0 postgres pg_dump -Fc -h finsurge-enrims-prod.postgres.database.azure.com -U enrims_admin -d enrims_prod | az storage blob upload --account-name finsurgeenrimsbackups --container-name weekly --name "enrims_$(date +\%Y\%m\%d).dump" --file /dev/stdin --auth-mode login --overwrite

# Cleanup: handled by Azure Blob Storage lifecycle management policy (30-day retention for daily, 1 year for weekly)

# Retain weekly backups for 1 year, monthly snapshots for 7 years (PMLA compliance)
```

### 1.5 Restore Procedure

```bash
# 1. List available backups
az storage blob list --account-name finsurgeenrimsbackups --container-name daily --output table | tail -10

# 2. Download the target backup
az storage blob download --account-name finsurgeenrimsbackups --container-name daily --name "enrims_20260408_2100.dump" --file /tmp/restore.dump --auth-mode login

# 3. Create a new database for restore (don't overwrite production directly)
psql -h finsurge-enrims-prod.postgres.database.azure.com -U enrims_admin -c "CREATE DATABASE enrims_restore;"

# 4. Restore into the new database
pg_restore -h finsurge-enrims-prod.postgres.database.azure.com -U enrims_admin -d enrims_restore -Fc /tmp/restore.dump

# 5. Validate the restored data
psql -h finsurge-enrims-prod.postgres.database.azure.com -U enrims_admin -d enrims_restore -c "
SELECT 'customers' AS table_name, COUNT(*) FROM customers
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'alerts', COUNT(*) FROM alerts
UNION ALL SELECT 'cases', COUNT(*) FROM cases;
"

# 6. Swap databases (maintenance window)
psql -h finsurge-enrims-prod.postgres.database.azure.com -U enrims_admin -c "
ALTER DATABASE enrims_prod RENAME TO enrims_prod_old;
ALTER DATABASE enrims_restore RENAME TO enrims_prod;
"

# 7. Point-in-Time Recovery (Azure native -- preferred for recent data loss)
az postgres flexible-server restore \
  --resource-group finsurge-enrims-prod-rg \
  --name finsurge-enrims-pitr \
  --source-server finsurge-enrims-prod \
  --restore-time "2026-04-08T15:30:00Z"
```

---

## 2. TLS / HTTPS

### 2.1 Let's Encrypt Certificate with Certbot

```bash
# Install certbot
sudo apt update && sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate for the domain
sudo certbot certonly --nginx \
  -d enrims.finsurge.in \
  -d api.enrims.finsurge.in \
  --email devops@finsurge.in \
  --agree-tos \
  --non-interactive

# Verify certificate
sudo certbot certificates

# Auto-renewal is set up by certbot, verify the timer
sudo systemctl status certbot.timer

# Test renewal
sudo certbot renew --dry-run
```

### 2.2 Nginx SSL Configuration

```nginx
# /etc/nginx/sites-available/enrims

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name enrims.finsurge.in api.enrims.finsurge.in;

    # ACME challenge for Let's Encrypt renewal
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# Frontend (React app)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name enrims.finsurge.in;

    # TLS configuration
    ssl_certificate /etc/letsencrypt/live/enrims.finsurge.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/enrims.finsurge.in/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/enrims.finsurge.in/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.enrims.finsurge.in; frame-ancestors 'none';" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # Serve React frontend
    root /var/www/enrims/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Request size limit
    client_max_body_size 10M;
}

# Backend API
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.enrims.finsurge.in;

    ssl_certificate /etc/letsencrypt/live/enrims.finsurge.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/enrims.finsurge.in/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Same security headers as frontend
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

    # API proxy
    location /api/v1/auth/login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # Health check (no rate limit)
    location /health {
        proxy_pass http://127.0.0.1:8000;
    }

    # Block Swagger/OpenAPI docs in production
    location ~ ^/(docs|redoc|openapi.json) {
        return 404;
    }

    client_max_body_size 1M;
}
```

```bash
# Enable the site and test
sudo ln -s /etc/nginx/sites-available/enrims /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Verify HSTS header
curl -I https://enrims.finsurge.in | grep Strict-Transport-Security
```

---

## 3. MFA / TOTP

### 3.1 Install Dependencies

```bash
pip install pyotp qrcode[pil]
```

### 3.2 TOTP Enrollment Flow

Add this to the backend auth service (`backend/app/services/auth_service.py`):

```python
import pyotp
import qrcode
import io
import base64
from typing import Optional


def generate_totp_secret() -> str:
    """Generate a new TOTP secret for a user."""
    return pyotp.random_base32()


def get_totp_provisioning_uri(secret: str, username: str) -> str:
    """Generate the otpauth:// URI for QR code enrollment."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(
        name=username,
        issuer_name="FinsurgeENRIMS"
    )


def generate_qr_code_base64(provisioning_uri: str) -> str:
    """Generate a QR code as a base64-encoded PNG for the frontend to display."""
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def verify_totp(secret: str, token: str) -> bool:
    """Verify a 6-digit TOTP token against the stored secret."""
    totp = pyotp.TOTP(secret)
    return totp.verify(token, valid_window=1)  # Allow 30-second clock drift


def generate_recovery_codes(count: int = 10) -> list[str]:
    """Generate one-time-use recovery codes for backup access."""
    import secrets
    return [f"{secrets.token_hex(4)}-{secrets.token_hex(4)}" for _ in range(count)]
```

### 3.3 MFA Enrollment API Endpoint

```python
# Add to backend/app/api/auth.py

@router.post("/mfa/enroll")
def enroll_mfa(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Start MFA enrollment: generate secret, return QR code."""
    from app.services.auth_service import generate_totp_secret, get_totp_provisioning_uri, generate_qr_code_base64, generate_recovery_codes

    secret = generate_totp_secret()
    provisioning_uri = get_totp_provisioning_uri(secret, current_user.username)
    qr_base64 = generate_qr_code_base64(provisioning_uri)
    recovery_codes = generate_recovery_codes(10)

    # Store secret temporarily (not activated until verified)
    current_user.totp_secret_pending = secret
    current_user.recovery_codes_pending = ",".join(recovery_codes)
    db.commit()

    return {
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "secret": secret,  # For manual entry in authenticator app
        "recovery_codes": recovery_codes,
        "message": "Scan the QR code with Google Authenticator or Authy, then verify with /mfa/verify"
    }


@router.post("/mfa/verify")
def verify_mfa_enrollment(token: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Verify a TOTP token to activate MFA for the account."""
    from app.services.auth_service import verify_totp

    if not current_user.totp_secret_pending:
        raise HTTPException(status_code=400, detail="No pending MFA enrollment")

    if not verify_totp(current_user.totp_secret_pending, token):
        raise HTTPException(status_code=401, detail="Invalid TOTP token")

    # Activate MFA
    current_user.totp_secret = current_user.totp_secret_pending
    current_user.recovery_codes = current_user.recovery_codes_pending
    current_user.mfa_enabled = True
    current_user.totp_secret_pending = None
    current_user.recovery_codes_pending = None
    db.commit()

    return {"status": "mfa_enabled", "message": "MFA is now active on your account"}


@router.post("/mfa/challenge")
def mfa_challenge(username: str, token: str, db: Session = Depends(get_db)):
    """Second step of login: verify TOTP after password authentication."""
    from app.services.auth_service import verify_totp

    user = db.query(User).filter(User.username == username).first()
    if not user or not user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA not enabled")

    if not verify_totp(user.totp_secret, token):
        # Check recovery codes
        recovery_list = (user.recovery_codes or "").split(",")
        if token in recovery_list:
            recovery_list.remove(token)
            user.recovery_codes = ",".join(recovery_list)
            db.commit()
        else:
            raise HTTPException(status_code=401, detail="Invalid MFA token")

    # Issue full access token
    access_token = create_access_token({"sub": user.id, "username": user.username, "mfa_verified": True})
    return {"access_token": access_token, "token_type": "bearer"}
```

### 3.4 Database Columns for User Model

```python
# Add to backend/app/models/user.py (User class)
totp_secret = Column(String, nullable=True)           # Active TOTP secret (encrypted at rest)
totp_secret_pending = Column(String, nullable=True)    # Pending enrollment secret
mfa_enabled = Column(Boolean, default=False)           # Whether MFA is active
recovery_codes = Column(Text, nullable=True)           # Comma-separated one-time recovery codes
recovery_codes_pending = Column(Text, nullable=True)   # Pending recovery codes
```

---

## 4. Kubernetes Deployment

### 4.1 Namespace and Secrets

```bash
# Create namespace
kubectl create namespace enrims-prod

# Create secrets from Vault (or manually)
kubectl create secret generic enrims-secrets -n enrims-prod \
  --from-literal=DATABASE_URL="postgresql://enrims_admin:password@rds-host:5432/enrims_prod?sslmode=require" \
  --from-literal=SECRET_KEY="$(openssl rand -hex 32)" \
  --from-literal=PII_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --from-literal=REDIS_URL="redis://redis-service:6379/0"

# Create Docker registry secret (for Azure Container Registry)
kubectl create secret docker-registry acr-secret -n enrims-prod \
  --docker-server=finsurgeenrimsacr.azurecr.io \
  --docker-username="$(az acr credential show --name finsurgeenrimsacr --query username -o tsv)" \
  --docker-password="$(az acr credential show --name finsurgeenrimsacr --query 'passwords[0].value' -o tsv)"
```

### 4.2 Backend Deployment

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: enrims-backend
  namespace: enrims-prod
  labels:
    app: enrims
    component: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: enrims
      component: backend
  template:
    metadata:
      labels:
        app: enrims
        component: backend
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8000"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: enrims-backend
      containers:
        - name: backend
          image: finsurgeenrimsacr.azurecr.io/enrims-backend:latest
          ports:
            - containerPort: 8000
              protocol: TCP
          envFrom:
            - secretRef:
                name: enrims-secrets
          env:
            - name: DEBUG
              value: "false"
            - name: CORS_ORIGINS
              value: "https://enrims.finsurge.in"
            - name: SEED_ON_STARTUP
              value: "false"
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "2000m"
              memory: "2Gi"
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 15
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 12
      imagePullSecrets:
        - name: acr-secret
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: enrims
              component: backend
```

### 4.3 Frontend Deployment

```yaml
# k8s/frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: enrims-frontend
  namespace: enrims-prod
  labels:
    app: enrims
    component: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: enrims
      component: frontend
  template:
    metadata:
      labels:
        app: enrims
        component: frontend
    spec:
      containers:
        - name: frontend
          image: finsurgeenrimsacr.azurecr.io/enrims-frontend:latest
          ports:
            - containerPort: 80
              protocol: TCP
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
          livenessProbe:
            httpGet:
              path: /
              port: 80
            periodSeconds: 30
      imagePullSecrets:
        - name: acr-secret
```

### 4.4 Services

```yaml
# k8s/backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: enrims-backend-svc
  namespace: enrims-prod
  labels:
    app: enrims
    component: backend
spec:
  type: ClusterIP
  selector:
    app: enrims
    component: backend
  ports:
    - name: http
      port: 8000
      targetPort: 8000
      protocol: TCP

---
# k8s/frontend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: enrims-frontend-svc
  namespace: enrims-prod
  labels:
    app: enrims
    component: frontend
spec:
  type: ClusterIP
  selector:
    app: enrims
    component: frontend
  ports:
    - name: http
      port: 80
      targetPort: 80
      protocol: TCP
```

### 4.5 Ingress with TLS

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: enrims-ingress
  namespace: enrims-prod
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      more_set_headers "Strict-Transport-Security: max-age=63072000; includeSubDomains; preload";
      more_set_headers "X-Frame-Options: DENY";
      more_set_headers "X-Content-Type-Options: nosniff";
spec:
  tls:
    - hosts:
        - enrims.finsurge.in
        - api.enrims.finsurge.in
      secretName: enrims-tls-cert
  rules:
    - host: enrims.finsurge.in
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: enrims-frontend-svc
                port:
                  number: 80
    - host: api.enrims.finsurge.in
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: enrims-backend-svc
                port:
                  number: 8000
```

### 4.6 Horizontal Pod Autoscaler (HPA)

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: enrims-backend-hpa
  namespace: enrims-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: enrims-backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
```

### 4.7 Apply All Resources

```bash
# Apply in order
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml

# Verify deployment
kubectl get pods -n enrims-prod
kubectl get svc -n enrims-prod
kubectl get ingress -n enrims-prod
kubectl describe hpa enrims-backend-hpa -n enrims-prod
```

---

## 5. Prometheus + Grafana

### 5.1 Install via Helm

```bash
# Add Helm repos
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=gp3 \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
  --set alertmanager.enabled=true \
  --set grafana.adminPassword="$(vault kv get -field=grafana_password secret/enrims/monitoring)"
```

### 5.2 FastAPI Metrics (Application Side)

Add Prometheus metrics middleware to the backend:

```bash
pip install prometheus-fastapi-instrumentator
```

```python
# Add to backend/main.py
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI(title="FinsurgeENRIMS")

# Instrument the app for Prometheus metrics
Instrumentator().instrument(app).expose(app, endpoint="/metrics")
```

### 5.3 Prometheus Scrape Config

```yaml
# Add to Prometheus scrape config (via ServiceMonitor CRD)
# k8s/servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: enrims-backend-monitor
  namespace: monitoring
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app: enrims
      component: backend
  namespaceSelector:
    matchNames:
      - enrims-prod
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
      scrapeTimeout: 10s
```

Or if using static Prometheus config:

```yaml
# prometheus.yml additional scrape config
scrape_configs:
  - job_name: 'enrims-backend'
    scrape_interval: 15s
    metrics_path: /metrics
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
            - enrims-prod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: enrims
        action: keep
      - source_labels: [__meta_kubernetes_pod_label_component]
        regex: backend
        action: keep
```

### 5.4 Grafana Dashboard JSON

Import this dashboard in Grafana (Dashboards > Import > Paste JSON):

```json
{
  "dashboard": {
    "title": "FinsurgeENRIMS - Application Metrics",
    "uid": "enrims-app-metrics",
    "timezone": "Asia/Kolkata",
    "panels": [
      {
        "title": "Request Rate (req/s)",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\"enrims-backend\"}[5m])",
            "legendFormat": "{{method}} {{handler}} {{status}}"
          }
        ]
      },
      {
        "title": "Request Latency (p95)",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=\"enrims-backend\"}[5m]))",
            "legendFormat": "p95 {{handler}}"
          }
        ]
      },
      {
        "title": "Error Rate (5xx)",
        "type": "stat",
        "gridPos": {"h": 4, "w": 6, "x": 0, "y": 8},
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{job=\"enrims-backend\", status=~\"5..\"}[5m])) / sum(rate(http_requests_total{job=\"enrims-backend\"}[5m])) * 100",
            "legendFormat": "Error %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                {"color": "green", "value": 0},
                {"color": "yellow", "value": 1},
                {"color": "red", "value": 5}
              ]
            }
          }
        }
      },
      {
        "title": "Active DB Connections",
        "type": "gauge",
        "gridPos": {"h": 4, "w": 6, "x": 6, "y": 8},
        "targets": [
          {
            "expr": "sqlalchemy_pool_checked_out{job=\"enrims-backend\"}",
            "legendFormat": "Active"
          }
        ]
      },
      {
        "title": "Alerts Generated (last 24h)",
        "type": "stat",
        "gridPos": {"h": 4, "w": 6, "x": 12, "y": 8},
        "targets": [
          {
            "expr": "increase(enrims_alerts_created_total[24h])",
            "legendFormat": "Alerts"
          }
        ]
      },
      {
        "title": "Rules Engine Evaluations (last 1h)",
        "type": "stat",
        "gridPos": {"h": 4, "w": 6, "x": 18, "y": 8},
        "targets": [
          {
            "expr": "increase(enrims_rules_evaluated_total[1h])",
            "legendFormat": "Evaluations"
          }
        ]
      },
      {
        "title": "Request Duration Heatmap",
        "type": "heatmap",
        "gridPos": {"h": 8, "w": 24, "x": 0, "y": 12},
        "targets": [
          {
            "expr": "rate(http_request_duration_seconds_bucket{job=\"enrims-backend\"}[5m])",
            "legendFormat": "{{le}}"
          }
        ]
      }
    ],
    "templating": {
      "list": [
        {
          "name": "namespace",
          "type": "constant",
          "current": {"value": "enrims-prod"}
        }
      ]
    },
    "refresh": "30s"
  }
}
```

### 5.5 Prometheus Alert Rules

```yaml
# k8s/prometheus-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: enrims-alerts
  namespace: monitoring
  labels:
    release: prometheus
spec:
  groups:
    - name: enrims.rules
      rules:
        - alert: HighErrorRate
          expr: sum(rate(http_requests_total{job="enrims-backend", status=~"5.."}[5m])) / sum(rate(http_requests_total{job="enrims-backend"}[5m])) > 0.05
          for: 5m
          labels:
            severity: critical
            team: enrims-sre
          annotations:
            summary: "ENRIMS backend error rate > 5%"
            description: "Error rate is {{ $value | humanizePercentage }} for the past 5 minutes."

        - alert: HighLatency
          expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="enrims-backend"}[5m])) > 0.5
          for: 10m
          labels:
            severity: warning
            team: enrims-sre
          annotations:
            summary: "ENRIMS p95 latency > 500ms"
            description: "95th percentile latency is {{ $value }}s."

        - alert: PodCrashLooping
          expr: rate(kube_pod_container_status_restarts_total{namespace="enrims-prod"}[15m]) > 0
          for: 5m
          labels:
            severity: critical
            team: enrims-sre
          annotations:
            summary: "ENRIMS pod {{ $labels.pod }} is crash-looping"

        - alert: DatabaseConnectionPoolExhausted
          expr: sqlalchemy_pool_checked_out{job="enrims-backend"} / sqlalchemy_pool_size{job="enrims-backend"} > 0.9
          for: 5m
          labels:
            severity: warning
            team: enrims-sre
          annotations:
            summary: "DB connection pool >90% utilized"

        - alert: HighMemoryUsage
          expr: container_memory_working_set_bytes{namespace="enrims-prod", container="backend"} / container_spec_memory_limit_bytes{namespace="enrims-prod", container="backend"} > 0.85
          for: 10m
          labels:
            severity: warning
            team: enrims-sre
          annotations:
            summary: "ENRIMS backend memory usage > 85%"
```

---

## 6. PagerDuty / OpsGenie Alerting

### 6.1 PagerDuty Integration

```yaml
# Alertmanager config for PagerDuty routing
# Add to Prometheus Alertmanager configmap or Helm values

alertmanager:
  config:
    global:
      resolve_timeout: 5m
    route:
      receiver: 'enrims-pagerduty'
      group_by: ['alertname', 'severity']
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 4h
      routes:
        - match:
            severity: critical
          receiver: 'enrims-pagerduty-critical'
          repeat_interval: 1h
        - match:
            severity: warning
          receiver: 'enrims-pagerduty-warning'
          repeat_interval: 4h

    receivers:
      - name: 'enrims-pagerduty-critical'
        pagerduty_configs:
          - routing_key: '<PAGERDUTY_INTEGRATION_KEY_CRITICAL>'
            severity: critical
            description: '{{ .CommonAnnotations.summary }}'
            details:
              alert: '{{ .CommonLabels.alertname }}'
              description: '{{ .CommonAnnotations.description }}'
              namespace: '{{ .CommonLabels.namespace }}'

      - name: 'enrims-pagerduty-warning'
        pagerduty_configs:
          - routing_key: '<PAGERDUTY_INTEGRATION_KEY_WARNING>'
            severity: warning
            description: '{{ .CommonAnnotations.summary }}'

      - name: 'enrims-pagerduty'
        pagerduty_configs:
          - routing_key: '<PAGERDUTY_INTEGRATION_KEY_DEFAULT>'
            severity: '{{ .CommonLabels.severity }}'
```

### 6.2 OpsGenie Integration (Alternative)

```yaml
receivers:
  - name: 'enrims-opsgenie'
    opsgenie_configs:
      - api_key: '<OPSGENIE_API_KEY>'
        message: '{{ .CommonAnnotations.summary }}'
        description: '{{ .CommonAnnotations.description }}'
        priority: '{{ if eq .CommonLabels.severity "critical" }}P1{{ else if eq .CommonLabels.severity "warning" }}P2{{ else }}P3{{ end }}'
        tags: 'enrims,{{ .CommonLabels.severity }}'
        responders:
          - type: team
            name: 'ENRIMS-SRE'
```

### 6.3 Escalation Policy Example

```
Level 1 (0 min):    On-call SRE engineer           → SMS + Push + Email
Level 2 (15 min):   SRE Team Lead                   → SMS + Push + Email
Level 3 (30 min):   Engineering Manager + CISO       → Phone call + SMS
Level 4 (60 min):   CTO + Compliance Head            → Phone call

Schedule: 24/7 rotation, 1-week shifts
On-call team: 4 SRE engineers rotating
Handoff: Monday 09:00 IST
```

---

## 7. Redis

### 7.1 Installation and Setup

**Azure Cache for Redis (Production)**

```bash
az redis create \
  --resource-group finsurge-enrims-prod-rg \
  --name finsurge-enrims-prod-redis \
  --location centralindia \
  --sku Standard \
  --vm-size c1 \
  --enable-non-ssl-port false \
  --minimum-tls-version 1.2 \
  --redis-configuration maxmemory-policy=allkeys-lru \
  --tags Project=FinsurgeENRIMS Environment=production
```

**Docker (Development/Staging)**

```bash
docker run -d --name enrims-redis \
  -p 6379:6379 \
  --restart unless-stopped \
  redis:7-alpine \
  redis-server --requirepass "$(vault kv get -field=redis_auth secret/enrims/staging)" \
  --maxmemory 512mb \
  --maxmemory-policy allkeys-lru
```

### 7.2 Application Connection Config

```python
# backend/app/config.py -- add Redis settings
REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", "")
```

```python
# backend/app/redis_client.py
import redis
from app.config import settings

redis_client = redis.Redis.from_url(
    settings.REDIS_URL,
    password=settings.REDIS_PASSWORD or None,
    decode_responses=True,
    socket_timeout=5,
    socket_connect_timeout=5,
    retry_on_timeout=True,
    health_check_interval=30,
)


def get_redis() -> redis.Redis:
    return redis_client
```

### 7.3 Rate Limiting with Redis

```python
# backend/app/middleware/rate_limit.py
import time
from fastapi import Request, HTTPException
from app.redis_client import get_redis


async def rate_limit_middleware(request: Request, call_next):
    """Redis-backed sliding window rate limiter."""
    redis = get_redis()
    client_ip = request.client.host
    path = request.url.path
    user_id = getattr(request.state, "user_id", "anonymous")

    # Different limits for different endpoints
    if "/auth/login" in path:
        key = f"rate:login:{client_ip}"
        limit = 5
        window = 60  # 5 per minute
    else:
        key = f"rate:api:{user_id}:{client_ip}"
        limit = 100
        window = 60  # 100 per minute

    now = time.time()
    pipe = redis.pipeline()
    pipe.zremrangebyscore(key, 0, now - window)  # Remove expired entries
    pipe.zadd(key, {str(now): now})              # Add current request
    pipe.zcard(key)                               # Count requests in window
    pipe.expire(key, window)                      # Set TTL
    results = pipe.execute()
    request_count = results[2]

    if request_count > limit:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Max {limit} requests per {window}s.",
            headers={"Retry-After": str(window)},
        )

    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(max(0, limit - request_count))
    response.headers["X-RateLimit-Reset"] = str(int(now + window))
    return response
```

### 7.4 Session Store with Redis

```python
# backend/app/services/session_store.py
import json
from datetime import datetime
from app.redis_client import get_redis


class SessionStore:
    PREFIX = "session:"
    TTL = 1800  # 30 minutes

    @staticmethod
    def create_session(user_id: str, token_jti: str, metadata: dict) -> None:
        redis = get_redis()
        key = f"{SessionStore.PREFIX}{user_id}:{token_jti}"
        redis.setex(key, SessionStore.TTL, json.dumps({
            "user_id": user_id,
            "jti": token_jti,
            "created_at": datetime.utcnow().isoformat(),
            "ip_address": metadata.get("ip"),
            "user_agent": metadata.get("user_agent"),
        }))

    @staticmethod
    def revoke_session(user_id: str, token_jti: str) -> None:
        redis = get_redis()
        redis.delete(f"{SessionStore.PREFIX}{user_id}:{token_jti}")

    @staticmethod
    def revoke_all_sessions(user_id: str) -> int:
        redis = get_redis()
        keys = redis.keys(f"{SessionStore.PREFIX}{user_id}:*")
        if keys:
            return redis.delete(*keys)
        return 0

    @staticmethod
    def is_valid_session(user_id: str, token_jti: str) -> bool:
        redis = get_redis()
        return redis.exists(f"{SessionStore.PREFIX}{user_id}:{token_jti}") > 0

    @staticmethod
    def get_active_sessions(user_id: str) -> list[dict]:
        redis = get_redis()
        keys = redis.keys(f"{SessionStore.PREFIX}{user_id}:*")
        sessions = []
        for key in keys:
            data = redis.get(key)
            if data:
                sessions.append(json.loads(data))
        return sessions

    @staticmethod
    def enforce_max_sessions(user_id: str, max_sessions: int = 3) -> None:
        """Remove oldest sessions if user exceeds max concurrent sessions."""
        sessions = SessionStore.get_active_sessions(user_id)
        if len(sessions) >= max_sessions:
            sessions.sort(key=lambda s: s.get("created_at", ""))
            for session in sessions[:len(sessions) - max_sessions + 1]:
                SessionStore.revoke_session(user_id, session["jti"])
```

---

## 8. WAF (Web Application Firewall)

### 8.1 Azure WAF Configuration

Azure WAF is deployed via Application Gateway WAF_v2 SKU. The WAF policy is managed via Terraform (see `infrastructure/terraform/modules/waf/main.tf`).

```bash
# Create WAF policy with OWASP 3.2 managed rules
az network application-gateway waf-policy create \
  --resource-group finsurge-enrims-prod-rg \
  --name enrims-waf-policy \
  --location centralindia

# Enable OWASP managed rule set
az network application-gateway waf-policy managed-rule rule-set add \
  --resource-group finsurge-enrims-prod-rg \
  --policy-name enrims-waf-policy \
  --type OWASP \
  --version 3.2

# Enable Bot Manager rule set
az network application-gateway waf-policy managed-rule rule-set add \
  --resource-group finsurge-enrims-prod-rg \
  --policy-name enrims-waf-policy \
  --type Microsoft_BotManagerRuleSet \
  --version 1.0

# Add custom rate-limit rule for login endpoint
az network application-gateway waf-policy custom-rule create \
  --resource-group finsurge-enrims-prod-rg \
  --policy-name enrims-waf-policy \
  --name RateLimitLogin \
  --priority 2 \
  --rule-type RateLimitRule \
  --action Block \
  --rate-limit-threshold 10 \
  --rate-limit-duration FiveMins

# Set WAF to Prevention mode
az network application-gateway waf-policy update \
  --resource-group finsurge-enrims-prod-rg \
  --name enrims-waf-policy \
  --state Enabled \
  --mode Prevention
```

### 8.2 Cloudflare WAF Rules (Alternative)

If using Cloudflare as CDN/WAF in front of the application:

```bash
# Using Cloudflare API to create WAF rules

# Rule 1: Block SQL injection patterns
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/firewall/rules" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '[
    {
      "filter": {
        "expression": "(http.request.uri.query contains \"SELECT\" and http.request.uri.query contains \"FROM\") or http.request.uri.query contains \"UNION SELECT\" or http.request.uri.query contains \"DROP TABLE\"",
        "paused": false
      },
      "action": "block",
      "description": "Block SQL injection attempts"
    }
  ]'

# Rule 2: Block XSS patterns
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/firewall/rules" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '[
    {
      "filter": {
        "expression": "http.request.uri.query contains \"<script\" or http.request.body.raw contains \"<script\" or http.request.uri.query contains \"javascript:\"",
        "paused": false
      },
      "action": "block",
      "description": "Block XSS attempts"
    }
  ]'

# Rule 3: Rate limit login endpoint
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/rate_limits" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "match": {
      "request": {
        "url_pattern": "*api.enrims.finsurge.in/api/v1/auth/login*",
        "methods": ["POST"]
      }
    },
    "threshold": 5,
    "period": 60,
    "action": {
      "mode": "ban",
      "timeout": 300
    },
    "description": "Rate limit login: 5 attempts per minute, ban for 5 min"
  }'

# Rule 4: Geo-block traffic from outside India (RBI data localization)
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/firewall/rules" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '[
    {
      "filter": {
        "expression": "not ip.geoip.country in {\"IN\"}",
        "paused": false
      },
      "action": "block",
      "description": "Block non-India traffic (RBI data localization)"
    }
  ]'

# Enable Cloudflare managed OWASP ruleset
curl -X PUT "https://api.cloudflare.com/client/v4/zones/{zone_id}/firewall/waf/packages/{owasp_package_id}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"sensitivity": "high", "action_mode": "block"}'
```

---

## 9. HashiCorp Vault

### 9.1 Vault Server Setup

```bash
# Install Vault via Helm in Kubernetes
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update

helm install vault hashicorp/vault \
  --namespace vault \
  --create-namespace \
  --set server.ha.enabled=true \
  --set server.ha.replicas=3 \
  --set server.ha.raft.enabled=true \
  --set server.dataStorage.size=10Gi \
  --set server.dataStorage.storageClass=gp3 \
  --set server.auditStorage.enabled=true \
  --set server.auditStorage.size=10Gi \
  --set ui.enabled=true

# Initialize Vault
kubectl exec -n vault vault-0 -- vault operator init \
  -key-shares=5 \
  -key-threshold=3

# Unseal (with 3 of 5 keys)
kubectl exec -n vault vault-0 -- vault operator unseal <key1>
kubectl exec -n vault vault-0 -- vault operator unseal <key2>
kubectl exec -n vault vault-0 -- vault operator unseal <key3>
```

### 9.2 Store Application Secrets

```bash
# Login to Vault
export VAULT_ADDR=https://vault.enrims.internal:8200
vault login <root_token>

# Enable KV secrets engine
vault secrets enable -path=secret kv-v2

# Store all ENRIMS secrets
vault kv put secret/enrims/prod \
  db_password="<strong-generated-password>" \
  secret_key="$(openssl rand -hex 32)" \
  pii_encryption_key="$(openssl rand -hex 32)" \
  redis_auth="$(openssl rand -hex 16)" \
  grafana_password="$(openssl rand -base64 24)"

# Store database connection string
vault kv put secret/enrims/prod/database \
  url="postgresql://enrims_admin:<password>@finsurge-enrims-prod.xxxx.rds.amazonaws.com:5432/enrims_prod?sslmode=require"

# Store Redis connection
vault kv put secret/enrims/prod/redis \
  url="rediss://default:<password>@finsurge-enrims-prod-redis.redis.cache.windows.net:6379/0"

# Verify
vault kv get secret/enrims/prod
```

### 9.3 Vault Policy for ENRIMS

```hcl
# vault-policy-enrims.hcl
path "secret/data/enrims/prod" {
  capabilities = ["read"]
}

path "secret/data/enrims/prod/*" {
  capabilities = ["read"]
}

# Deny access to other environments
path "secret/data/enrims/staging" {
  capabilities = ["deny"]
}
```

```bash
# Create the policy
vault policy write enrims-prod vault-policy-enrims.hcl

# Enable Kubernetes auth
vault auth enable kubernetes

# Configure Kubernetes auth to talk to the cluster
vault write auth/kubernetes/config \
  kubernetes_host="https://kubernetes.default.svc:443"

# Bind the ENRIMS service account to the policy
vault write auth/kubernetes/role/enrims-backend \
  bound_service_account_names=enrims-backend \
  bound_service_account_namespaces=enrims-prod \
  policies=enrims-prod \
  ttl=1h
```

### 9.4 Vault Agent Sidecar for Kubernetes

```yaml
# k8s/backend-deployment.yaml -- add Vault annotations for agent injection
apiVersion: apps/v1
kind: Deployment
metadata:
  name: enrims-backend
  namespace: enrims-prod
spec:
  template:
    metadata:
      annotations:
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/role: "enrims-backend"
        vault.hashicorp.com/agent-inject-secret-config: "secret/data/enrims/prod"
        vault.hashicorp.com/agent-inject-template-config: |
          {{- with secret "secret/data/enrims/prod" -}}
          export DATABASE_URL="{{ .Data.data.db_url }}"
          export SECRET_KEY="{{ .Data.data.secret_key }}"
          export PII_ENCRYPTION_KEY="{{ .Data.data.pii_encryption_key }}"
          export REDIS_URL="{{ .Data.data.redis_url }}"
          {{- end }}
    spec:
      serviceAccountName: enrims-backend
      containers:
        - name: backend
          image: finsurgeenrimsacr.azurecr.io/enrims-backend:latest
          command: ["/bin/sh", "-c"]
          args:
            - "source /vault/secrets/config && python main.py"
          ports:
            - containerPort: 8000
```

Alternatively, use the Vault CSI Provider to mount secrets as files:

```yaml
# k8s/vault-secret-provider.yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: enrims-vault-secrets
  namespace: enrims-prod
spec:
  provider: vault
  parameters:
    roleName: "enrims-backend"
    vaultAddress: "https://vault.enrims.internal:8200"
    objects: |
      - objectName: "db-password"
        secretPath: "secret/data/enrims/prod"
        secretKey: "db_password"
      - objectName: "secret-key"
        secretPath: "secret/data/enrims/prod"
        secretKey: "secret_key"
      - objectName: "pii-key"
        secretPath: "secret/data/enrims/prod"
        secretKey: "pii_encryption_key"
```

### 9.5 Secret Rotation

```bash
# Rotate the JWT secret key (quarterly)
NEW_KEY=$(openssl rand -hex 32)
vault kv put secret/enrims/prod secret_key="$NEW_KEY" \
  db_password="$(vault kv get -field=db_password secret/enrims/prod)" \
  pii_encryption_key="$(vault kv get -field=pii_encryption_key secret/enrims/prod)" \
  redis_auth="$(vault kv get -field=redis_auth secret/enrims/prod)"

# Rolling restart of backend pods to pick up new secret
kubectl rollout restart deployment/enrims-backend -n enrims-prod

# Verify new pods are running
kubectl rollout status deployment/enrims-backend -n enrims-prod

# Rotate database password (coordinate with Azure PostgreSQL)
NEW_DB_PASS=$(openssl rand -base64 32)
az postgres flexible-server update \
  --resource-group finsurge-enrims-prod-rg \
  --name finsurge-enrims-prod \
  --admin-password "$NEW_DB_PASS"

vault kv put secret/enrims/prod \
  db_password="$NEW_DB_PASS" \
  secret_key="$(vault kv get -field=secret_key secret/enrims/prod)" \
  pii_encryption_key="$(vault kv get -field=pii_encryption_key secret/enrims/prod)" \
  redis_auth="$(vault kv get -field=redis_auth secret/enrims/prod)"

# Restart to pick up new DB password
kubectl rollout restart deployment/enrims-backend -n enrims-prod
```

---

## Quick Reference: Environment Variables

All environment variables the application needs, sourced from Vault in production:

| Variable | Source | Description |
|----------|--------|-------------|
| `DATABASE_URL` | Vault `secret/enrims/prod` | PostgreSQL connection string with sslmode=require |
| `SECRET_KEY` | Vault `secret/enrims/prod` | JWT signing key (256-bit hex) |
| `PII_ENCRYPTION_KEY` | Vault `secret/enrims/prod` | AES-256 key for PAN/Aadhaar encryption |
| `REDIS_URL` | Vault `secret/enrims/prod` | Redis connection string |
| `DEBUG` | Hardcoded `false` | Never true in production |
| `CORS_ORIGINS` | ConfigMap | `https://enrims.finsurge.in` |
| `SEED_ON_STARTUP` | Hardcoded `false` | Never seed in production |
| `TOKEN_EXPIRE_MINUTES` | ConfigMap | `30` |
| `REFRESH_TOKEN_EXPIRE_MINUTES` | ConfigMap | `1440` |

---

## Deployment Checklist

Before going live, verify each item:

- [ ] PostgreSQL Flexible Server running in Azure Central India with encryption at rest
- [ ] PgBouncer connection pooling configured and tested
- [ ] Daily backup CRON active, backup restore tested
- [ ] TLS certificates issued and Nginx SSL config active
- [ ] HSTS header present in all responses
- [ ] MFA/TOTP enrollment working for admin and compliance roles
- [ ] Kubernetes deployments running with 3+ backend replicas
- [ ] HPA configured and scaling tested under load
- [ ] Prometheus scraping metrics from backend pods
- [ ] Grafana dashboard imported and showing live data
- [ ] PagerDuty/OpsGenie alerting tested (fire test alert)
- [ ] Azure Cache for Redis running with TLS and access key auth
- [ ] Rate limiting active on login (5/min) and API (100/min)
- [ ] WAF rules active: SQLi, XSS, rate limit, geo-block
- [ ] Vault secrets stored and agent sidecar injecting into pods
- [ ] No hardcoded secrets in code or environment
- [ ] DEBUG=false, SEED_ON_STARTUP=false in production
- [ ] Swagger/OpenAPI docs blocked in production Nginx config
- [ ] CORS whitelist set to production domain only
- [ ] Data localization: all Azure infrastructure in Central India region confirmed

---

*This document is classified as Confidential. It contains infrastructure credentials references and security configurations. Distribution is limited to the DevOps/SRE team, CISO, and authorized infrastructure personnel.*
