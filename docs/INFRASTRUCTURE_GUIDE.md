# FinsurgeENRIMS -- Production Infrastructure Guide

**Prepared by**: DevOps / SRE Team
**Date**: 08-Apr-2026
**Version**: 1.0
**Classification**: Confidential -- Operations

---

## Purpose

This guide covers the production infrastructure components that require real cloud services, certificates, and external tooling -- things that cannot be simulated in the application code alone. Follow these instructions to deploy FinsurgeENRIMS in a production banking environment.

**Deployment target**: AWS Mumbai (ap-south-1) or Azure Central India (per RBI data localization mandate)

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

**AWS RDS (recommended for ap-south-1)**

```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier finsurge-enrims-prod \
  --db-instance-class db.r6g.xlarge \
  --engine postgres \
  --engine-version 15.4 \
  --master-username enrims_admin \
  --master-user-password "$(vault kv get -field=db_password secret/enrims/prod)" \
  --allocated-storage 100 \
  --storage-type gp3 \
  --storage-encrypted \
  --kms-key-id alias/enrims-rds-key \
  --vpc-security-group-ids sg-0abc123def456 \
  --db-subnet-group-name enrims-private-subnets \
  --multi-az \
  --backup-retention-period 35 \
  --preferred-backup-window "02:00-03:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00" \
  --deletion-protection \
  --region ap-south-1 \
  --tags Key=Project,Value=FinsurgeENRIMS Key=Environment,Value=production
```

**Azure Database for PostgreSQL (alternative)**

```bash
# Create Azure PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group rg-enrims-prod \
  --name finsurge-enrims-prod \
  --location centralindia \
  --admin-user enrims_admin \
  --admin-password "$(vault kv get -field=db_password secret/enrims/prod)" \
  --sku-name Standard_D4ds_v4 \
  --tier GeneralPurpose \
  --storage-size 128 \
  --version 15 \
  --high-availability ZoneRedundant \
  --backup-retention 35 \
  --geo-redundant-backup Enabled \
  --tags Project=FinsurgeENRIMS Environment=production
```

### 1.2 Connection String Configuration

Set the `DATABASE_URL` environment variable (never hardcode):

```bash
# Format
DATABASE_URL=postgresql+asyncpg://enrims_admin:<password>@finsurge-enrims-prod.xxxxx.ap-south-1.rds.amazonaws.com:5432/enrims_prod?sslmode=require

# For synchronous SQLAlchemy (current codebase)
DATABASE_URL=postgresql://enrims_admin:<password>@finsurge-enrims-prod.xxxxx.ap-south-1.rds.amazonaws.com:5432/enrims_prod?sslmode=require
```

Update `backend/app/database.py` for PostgreSQL:

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# PostgreSQL connection with pool settings
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True,
    connect_args={"sslmode": "require"} if "postgresql" in settings.DATABASE_URL else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### 1.3 PgBouncer Connection Pooling

PgBouncer sits between the application and PostgreSQL to manage connection pooling efficiently:

```ini
# /etc/pgbouncer/pgbouncer.ini

[databases]
enrims_prod = host=finsurge-enrims-prod.xxxxx.ap-south-1.rds.amazonaws.com port=5432 dbname=enrims_prod

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Pool settings
pool_mode = transaction
default_pool_size = 25
max_client_conn = 200
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3

# Timeouts
server_idle_timeout = 300
client_idle_timeout = 600
query_timeout = 30
query_wait_timeout = 60

# Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
stats_period = 60

# TLS
server_tls_sslmode = require
server_tls_ca_file = /etc/ssl/certs/rds-combined-ca-bundle.pem
```

```txt
# /etc/pgbouncer/userlist.txt
"enrims_admin" "md5<hash>"
"enrims_app" "md5<hash>"
```

Update `DATABASE_URL` to point to PgBouncer:

```bash
DATABASE_URL=postgresql://enrims_app:<password>@pgbouncer-service:6432/enrims_prod
```

### 1.4 Backup Schedule

```bash
# Automated daily backup via AWS RDS (already configured above with --backup-retention-period 35)
# Additional manual snapshot before major releases:
aws rds create-db-snapshot \
  --db-instance-identifier finsurge-enrims-prod \
  --db-snapshot-identifier enrims-pre-release-$(date +%Y%m%d) \
  --region ap-south-1

# Point-in-time recovery (if needed)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier finsurge-enrims-prod \
  --target-db-instance-identifier finsurge-enrims-recovery \
  --restore-time "2026-04-08T12:00:00Z" \
  --region ap-south-1

# Verify backup with monthly restore test
# Schedule via cron or AWS EventBridge:
# 0 6 1 * * /opt/scripts/backup-restore-test.sh
```

### 1.5 Database Users and Permissions

```sql
-- Create application user (limited privileges)
CREATE USER enrims_app WITH PASSWORD '<from-vault>';
GRANT CONNECT ON DATABASE enrims_prod TO enrims_app;
GRANT USAGE ON SCHEMA public TO enrims_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO enrims_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO enrims_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO enrims_app;

-- Create read-only user for reporting
CREATE USER enrims_readonly WITH PASSWORD '<from-vault>';
GRANT CONNECT ON DATABASE enrims_prod TO enrims_readonly;
GRANT USAGE ON SCHEMA public TO enrims_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO enrims_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO enrims_readonly;

-- Audit table: revoke UPDATE and DELETE from application user
REVOKE UPDATE, DELETE ON audit_logs FROM enrims_app;
-- Only enrims_admin can manage audit logs
```

---

## 2. TLS / HTTPS

### 2.1 Certificate Acquisition

**Option A: Let's Encrypt (free, automated renewal)**

```bash
# Install certbot
sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx

# Obtain certificate (DNS must point to server)
sudo certbot certonly --nginx \
  -d enrims.yourbank.co.in \
  -d api.enrims.yourbank.co.in \
  --email security@yourbank.co.in \
  --agree-tos \
  --non-interactive

# Certificate files will be at:
# /etc/letsencrypt/live/enrims.yourbank.co.in/fullchain.pem
# /etc/letsencrypt/live/enrims.yourbank.co.in/privkey.pem

# Auto-renewal (certbot installs a systemd timer by default)
# Verify:
sudo systemctl list-timers | grep certbot

# Manual renewal test:
sudo certbot renew --dry-run
```

**Option B: Commercial certificate (DigiCert / Entrust for banking)**

```bash
# Generate CSR
openssl req -new -newkey rsa:2048 -nodes \
  -keyout enrims.yourbank.co.in.key \
  -out enrims.yourbank.co.in.csr \
  -subj "/C=IN/ST=Maharashtra/L=Mumbai/O=Your Bank Ltd/OU=IT/CN=enrims.yourbank.co.in"

# Submit CSR to CA (DigiCert, Entrust, etc.)
# Download certificate chain after validation
# Install certificate files to /etc/ssl/certs/
```

### 2.2 Nginx SSL Configuration

```nginx
# /etc/nginx/sites-available/enrims

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name enrims.yourbank.co.in api.enrims.yourbank.co.in;
    return 301 https://$host$request_uri;
}

# Frontend
server {
    listen 443 ssl http2;
    server_name enrims.yourbank.co.in;

    # TLS certificates
    ssl_certificate     /etc/letsencrypt/live/enrims.yourbank.co.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/enrims.yourbank.co.in/privkey.pem;

    # TLS configuration (A+ rating on SSL Labs)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/enrims.yourbank.co.in/fullchain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.enrims.yourbank.co.in; frame-ancestors 'none';" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # Request limits
    client_max_body_size 1m;

    # Serve frontend static files
    root /var/www/enrims/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}

# Backend API
server {
    listen 443 ssl http2;
    server_name api.enrims.yourbank.co.in;

    ssl_certificate     /etc/letsencrypt/live/enrims.yourbank.co.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/enrims.yourbank.co.in/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    client_max_body_size 1m;

    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

    # Block Swagger docs in production
    location ~ ^/(docs|redoc|openapi.json) {
        deny all;
        return 404;
    }

    # Login endpoint with strict rate limit
    location /api/v1/auth/login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # All other API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 5s;
    }

    # Health check (no rate limit)
    location /api/v1/health {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
    }
}
```

```bash
# Enable and test
sudo ln -s /etc/nginx/sites-available/enrims /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Verify TLS (from another machine)
openssl s_client -connect enrims.yourbank.co.in:443 -servername enrims.yourbank.co.in
curl -I https://enrims.yourbank.co.in
```

---

## 3. MFA / TOTP

### 3.1 PyOTP Integration

Add to `requirements.txt`:

```
pyotp==2.9.0
qrcode[pil]==7.4.2
```

Backend implementation for TOTP setup and verification:

```python
# backend/app/services/mfa_service.py
import pyotp
import qrcode
import io
import base64
import secrets


def generate_totp_secret() -> str:
    """Generate a new TOTP secret for a user."""
    return pyotp.random_base32()


def generate_qr_code(username: str, secret: str, issuer: str = "FinsurgeENRIMS") -> str:
    """Generate a QR code image as base64 string for authenticator app enrollment."""
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=username, issuer_name=issuer)

    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def verify_totp(secret: str, token: str) -> bool:
    """Verify a TOTP token (allows 1 step drift for clock skew)."""
    totp = pyotp.TOTP(secret)
    return totp.verify(token, valid_window=1)


def generate_recovery_codes(count: int = 10) -> list[str]:
    """Generate one-time recovery codes for MFA backup."""
    return [secrets.token_hex(4).upper() for _ in range(count)]
```

### 3.2 QR Code Enrollment Flow

```python
# backend/app/api/auth.py (additional endpoints)

@router.post("/mfa/setup")
def setup_mfa(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Initialize MFA for the current user. Returns QR code and recovery codes."""
    from app.services.mfa_service import generate_totp_secret, generate_qr_code, generate_recovery_codes

    secret = generate_totp_secret()
    qr_base64 = generate_qr_code(current_user.username, secret)
    recovery_codes = generate_recovery_codes()

    # Store secret (encrypted) and hashed recovery codes
    current_user.totp_secret = encrypt(secret)  # using PII_ENCRYPTION_KEY
    current_user.recovery_codes = hash_recovery_codes(recovery_codes)
    current_user.mfa_enabled = False  # Not active until verified
    db.commit()

    return {
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "secret": secret,  # For manual entry in authenticator app
        "recovery_codes": recovery_codes,  # Show ONCE, user must save
        "message": "Scan QR code with your authenticator app, then verify with a code.",
    }


@router.post("/mfa/verify-setup")
def verify_mfa_setup(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify TOTP token to complete MFA setup."""
    from app.services.mfa_service import verify_totp

    secret = decrypt(current_user.totp_secret)
    if not verify_totp(secret, token):
        raise HTTPException(status_code=400, detail="Invalid TOTP token")

    current_user.mfa_enabled = True
    db.commit()
    return {"message": "MFA enabled successfully."}


@router.post("/mfa/validate")
def validate_mfa(username: str, token: str, db: Session = Depends(get_db)):
    """Validate TOTP during login (called after password verification)."""
    from app.services.mfa_service import verify_totp

    user = db.query(User).filter(User.username == username).first()
    if not user or not user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA not enabled")

    secret = decrypt(user.totp_secret)
    if not verify_totp(secret, token):
        raise HTTPException(status_code=401, detail="Invalid MFA token")

    return {"valid": True}
```

### 3.3 User Model Changes

```python
# Add to backend/app/models/user.py
class User(Base):
    # ... existing fields ...
    totp_secret = Column(String, nullable=True)    # Encrypted TOTP secret
    mfa_enabled = Column(Boolean, default=False)
    recovery_codes = Column(Text, nullable=True)    # Hashed recovery codes (JSON array)
```

### 3.4 Login Flow with MFA

```
1. POST /api/v1/auth/login  {username, password}
   -> If MFA enabled: return {"mfa_required": true, "mfa_session": "<temp-token>"}
   -> If MFA not enabled: return JWT access_token (existing flow)

2. POST /api/v1/auth/mfa/validate  {mfa_session, token}
   -> Verify TOTP token
   -> Return JWT access_token

3. Recovery: POST /api/v1/auth/mfa/recover  {username, recovery_code}
   -> Verify one-time recovery code
   -> Return JWT access_token
   -> Mark recovery code as used
```

---

## 4. Kubernetes Deployment

### 4.1 Namespace and Secrets

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: enrims
  labels:
    app: finsurge-enrims
    environment: production
```

```yaml
# k8s/secrets.yaml (use with Vault CSI driver in production -- see Section 9)
apiVersion: v1
kind: Secret
metadata:
  name: enrims-secrets
  namespace: enrims
type: Opaque
stringData:
  DATABASE_URL: "postgresql://enrims_app:<password>@pgbouncer-service:6432/enrims_prod?sslmode=require"
  SECRET_KEY: "<256-bit-hex-key>"
  PII_ENCRYPTION_KEY: "<256-bit-hex-key>"
  REDIS_URL: "redis://redis-service:6379/0"
```

### 4.2 Backend Deployment

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: enrims-backend
  namespace: enrims
  labels:
    app: enrims-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: enrims-backend
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: enrims-backend
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8000"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: enrims-backend
      containers:
        - name: backend
          image: your-registry.azurecr.io/enrims-backend:1.0.0
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
              value: "https://enrims.yourbank.co.in"
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
          livenessProbe:
            httpGet:
              path: /api/v1/health
              port: 8000
            initialDelaySeconds: 15
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/v1/health
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - enrims-backend
                topologyKey: kubernetes.io/hostname
```

### 4.3 Service

```yaml
# k8s/backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: enrims-backend
  namespace: enrims
  labels:
    app: enrims-backend
spec:
  type: ClusterIP
  ports:
    - port: 8000
      targetPort: 8000
      protocol: TCP
      name: http
  selector:
    app: enrims-backend
```

### 4.4 Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: enrims-ingress
  namespace: enrims
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "1m"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header X-Frame-Options "SAMEORIGIN" always;
spec:
  tls:
    - hosts:
        - enrims.yourbank.co.in
        - api.enrims.yourbank.co.in
      secretName: enrims-tls
  rules:
    - host: enrims.yourbank.co.in
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: enrims-frontend
                port:
                  number: 80
    - host: api.enrims.yourbank.co.in
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: enrims-backend
                port:
                  number: 8000
```

### 4.5 Horizontal Pod Autoscaler

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: enrims-backend-hpa
  namespace: enrims
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

### 4.6 Deploy Commands

```bash
# Apply all manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml

# Verify
kubectl get pods -n enrims
kubectl get svc -n enrims
kubectl get ingress -n enrims
kubectl get hpa -n enrims

# Check logs
kubectl logs -f deployment/enrims-backend -n enrims

# Rolling update
kubectl set image deployment/enrims-backend \
  backend=your-registry.azurecr.io/enrims-backend:1.1.0 \
  -n enrims

# Rollback if needed
kubectl rollout undo deployment/enrims-backend -n enrims
```

---

## 5. Prometheus + Grafana

### 5.1 Install via Helm

```bash
# Add Helm repos
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Prometheus stack (includes Prometheus, Alertmanager, Grafana)
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
  --set grafana.adminPassword="$(vault kv get -field=grafana_password secret/enrims/monitoring)" \
  --set grafana.persistence.enabled=true \
  --set grafana.persistence.size=10Gi \
  --values monitoring/prometheus-values.yaml
```

### 5.2 Scrape Configuration for FinsurgeENRIMS

```yaml
# monitoring/prometheus-values.yaml
prometheus:
  prometheusSpec:
    additionalScrapeConfigs:
      - job_name: "enrims-backend"
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - enrims
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
            action: replace
            target_label: __metrics_path__
            regex: (.+)
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_port]
            action: replace
            target_label: __address__
            regex: (.+)
            replacement: "$1"
        metrics_path: /metrics
        scrape_interval: 15s
```

### 5.3 FastAPI Prometheus Metrics

Add to `requirements.txt`:

```
prometheus-fastapi-instrumentator==6.1.0
```

```python
# backend/main.py (add after app creation)
from prometheus_fastapi_instrumentator import Instrumentator

# Auto-instrument all endpoints
Instrumentator().instrument(app).expose(app, endpoint="/metrics")
```

This auto-generates:
- `http_requests_total` (counter by method, endpoint, status)
- `http_request_duration_seconds` (histogram by method, endpoint)
- `http_requests_in_progress` (gauge)
- `http_request_size_bytes` (histogram)
- `http_response_size_bytes` (histogram)

### 5.4 Custom Business Metrics

```python
# backend/app/utils/metrics.py
from prometheus_client import Counter, Histogram, Gauge

# Business metrics
alerts_created_total = Counter(
    "enrims_alerts_created_total",
    "Total alerts created by the rules engine",
    ["alert_type", "priority"]
)

rules_evaluated_total = Counter(
    "enrims_rules_evaluated_total",
    "Total rule evaluations",
    ["rule_name", "result"]  # result: matched / not_matched
)

transaction_processing_duration = Histogram(
    "enrims_transaction_processing_seconds",
    "Time to process a transaction through the rules engine",
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
)

open_alerts_gauge = Gauge(
    "enrims_open_alerts",
    "Current number of open alerts",
    ["priority"]
)

open_cases_gauge = Gauge(
    "enrims_open_cases",
    "Current number of open investigation cases",
)

sla_overdue_alerts = Gauge(
    "enrims_sla_overdue_alerts",
    "Number of alerts past SLA deadline",
)
```

### 5.5 Pre-Built Grafana Dashboard

```json
{
  "dashboard": {
    "title": "FinsurgeENRIMS - Operations Dashboard",
    "uid": "enrims-ops",
    "tags": ["enrims", "production"],
    "timezone": "Asia/Kolkata",
    "panels": [
      {
        "title": "API Request Rate",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{namespace=\"enrims\"}[5m])) by (method)",
            "legendFormat": "{{method}}"
          }
        ]
      },
      {
        "title": "API Latency (p95)",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace=\"enrims\"}[5m])) by (le, handler))",
            "legendFormat": "{{handler}}"
          }
        ]
      },
      {
        "title": "HTTP Error Rate (5xx)",
        "type": "stat",
        "gridPos": {"h": 4, "w": 6, "x": 0, "y": 8},
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{namespace=\"enrims\",status=~\"5..\"}[5m])) / sum(rate(http_requests_total{namespace=\"enrims\"}[5m])) * 100",
            "legendFormat": "Error %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "steps": [
                {"color": "green", "value": 0},
                {"color": "yellow", "value": 1},
                {"color": "red", "value": 5}
              ]
            },
            "unit": "percent"
          }
        }
      },
      {
        "title": "Open Alerts by Priority",
        "type": "bargauge",
        "gridPos": {"h": 4, "w": 6, "x": 6, "y": 8},
        "targets": [
          {
            "expr": "enrims_open_alerts",
            "legendFormat": "{{priority}}"
          }
        ]
      },
      {
        "title": "SLA Overdue Alerts",
        "type": "stat",
        "gridPos": {"h": 4, "w": 6, "x": 12, "y": 8},
        "targets": [
          {
            "expr": "enrims_sla_overdue_alerts",
            "legendFormat": "Overdue"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "steps": [
                {"color": "green", "value": 0},
                {"color": "orange", "value": 5},
                {"color": "red", "value": 20}
              ]
            }
          }
        }
      },
      {
        "title": "Alerts Created (24h)",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 12},
        "targets": [
          {
            "expr": "sum(increase(enrims_alerts_created_total[1h])) by (alert_type)",
            "legendFormat": "{{alert_type}}"
          }
        ]
      },
      {
        "title": "Transaction Processing Time",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 12},
        "targets": [
          {
            "expr": "histogram_quantile(0.50, sum(rate(enrims_transaction_processing_seconds_bucket[5m])) by (le))",
            "legendFormat": "p50"
          },
          {
            "expr": "histogram_quantile(0.95, sum(rate(enrims_transaction_processing_seconds_bucket[5m])) by (le))",
            "legendFormat": "p95"
          },
          {
            "expr": "histogram_quantile(0.99, sum(rate(enrims_transaction_processing_seconds_bucket[5m])) by (le))",
            "legendFormat": "p99"
          }
        ]
      },
      {
        "title": "Pod CPU Usage",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 20},
        "targets": [
          {
            "expr": "sum(rate(container_cpu_usage_seconds_total{namespace=\"enrims\",container=\"backend\"}[5m])) by (pod)",
            "legendFormat": "{{pod}}"
          }
        ]
      },
      {
        "title": "Pod Memory Usage",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 20},
        "targets": [
          {
            "expr": "sum(container_memory_working_set_bytes{namespace=\"enrims\",container=\"backend\"}) by (pod) / 1024 / 1024",
            "legendFormat": "{{pod}} (MB)"
          }
        ]
      }
    ]
  }
}
```

Import this JSON into Grafana: Dashboards > Import > Upload JSON file.

---

## 6. PagerDuty / OpsGenie Alerting

### 6.1 Alertmanager Configuration

```yaml
# monitoring/alertmanager-config.yaml
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-config
  namespace: monitoring
stringData:
  alertmanager.yaml: |
    global:
      resolve_timeout: 5m

    route:
      receiver: "default"
      group_by: ["alertname", "namespace"]
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 4h
      routes:
        - match:
            severity: critical
          receiver: "pagerduty-critical"
          group_wait: 10s
          repeat_interval: 1h
        - match:
            severity: warning
          receiver: "opsgenie-warning"
          repeat_interval: 4h

    receivers:
      - name: "default"
        webhook_configs:
          - url: "https://hooks.slack.com/services/T.../B.../xxx"

      - name: "pagerduty-critical"
        pagerduty_configs:
          - routing_key: "<pagerduty-integration-key>"
            severity: critical
            description: "{{ .CommonAnnotations.summary }}"
            details:
              alert: "{{ .CommonLabels.alertname }}"
              namespace: "{{ .CommonLabels.namespace }}"
              runbook: "{{ .CommonAnnotations.runbook_url }}"

      - name: "opsgenie-warning"
        opsgenie_configs:
          - api_key: "<opsgenie-api-key>"
            message: "{{ .CommonAnnotations.summary }}"
            priority: "P2"
            tags: "enrims,production"
```

### 6.2 Alert Rules

```yaml
# monitoring/enrims-alerts.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: enrims-alerts
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
    - name: enrims.rules
      rules:
        # API error rate spike
        - alert: HighErrorRate
          expr: sum(rate(http_requests_total{namespace="enrims",status=~"5.."}[5m])) / sum(rate(http_requests_total{namespace="enrims"}[5m])) > 0.05
          for: 2m
          labels:
            severity: critical
          annotations:
            summary: "ENRIMS API error rate above 5%"
            description: "Error rate is {{ $value | humanizePercentage }} over the last 5 minutes."
            runbook_url: "https://wiki.yourbank.co.in/enrims/runbooks/high-error-rate"

        # API latency degradation
        - alert: HighLatency
          expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace="enrims"}[5m])) by (le)) > 1.0
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "ENRIMS API p95 latency above 1 second"
            description: "p95 latency is {{ $value | humanizeDuration }}."

        # Pod restarts
        - alert: PodRestarting
          expr: increase(kube_pod_container_status_restarts_total{namespace="enrims"}[1h]) > 3
          labels:
            severity: warning
          annotations:
            summary: "ENRIMS pod {{ $labels.pod }} restarting frequently"

        # Database connection issues
        - alert: DatabaseDown
          expr: up{job="enrims-backend"} == 0
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "ENRIMS backend is down"
            description: "Backend pod is not responding to health checks."

        # SLA overdue alerts
        - alert: SLAOverdueAlerts
          expr: enrims_sla_overdue_alerts > 10
          for: 15m
          labels:
            severity: warning
          annotations:
            summary: "More than 10 ENRIMS alerts are past SLA deadline"
            description: "{{ $value }} alerts are overdue. Review assignment and workload."

        # Disk usage
        - alert: HighDiskUsage
          expr: (kubelet_volume_stats_used_bytes{namespace="enrims"} / kubelet_volume_stats_capacity_bytes{namespace="enrims"}) > 0.85
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "ENRIMS volume usage above 85%"
```

### 6.3 Escalation Policy (PagerDuty)

Configure in PagerDuty UI or via API:

```bash
# Create escalation policy via PagerDuty API
curl -X POST 'https://api.pagerduty.com/escalation_policies' \
  -H 'Authorization: Token token=<pagerduty-api-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "escalation_policy": {
      "name": "ENRIMS Production",
      "escalation_rules": [
        {
          "escalation_delay_in_minutes": 5,
          "targets": [
            {"type": "user_reference", "id": "<on-call-sre-user-id>"}
          ]
        },
        {
          "escalation_delay_in_minutes": 15,
          "targets": [
            {"type": "user_reference", "id": "<sre-lead-user-id>"}
          ]
        },
        {
          "escalation_delay_in_minutes": 30,
          "targets": [
            {"type": "user_reference", "id": "<engineering-manager-user-id>"}
          ]
        }
      ],
      "repeat_enabled": true,
      "num_loops": 3
    }
  }'
```

---

## 7. Redis

### 7.1 Setup for Rate Limiting and Session Management

**AWS ElastiCache:**

```bash
aws elasticache create-replication-group \
  --replication-group-id enrims-redis \
  --replication-group-description "ENRIMS Redis cluster" \
  --engine redis \
  --engine-version 7.0 \
  --cache-node-type cache.r6g.large \
  --num-cache-clusters 2 \
  --automatic-failover-enabled \
  --multi-az-enabled \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --auth-token "$(vault kv get -field=redis_password secret/enrims/prod)" \
  --cache-subnet-group-name enrims-private-subnets \
  --security-group-ids sg-0abc123def456 \
  --snapshot-retention-limit 7 \
  --region ap-south-1
```

### 7.2 Rate Limiting with Redis

Add to `requirements.txt`:

```
redis==5.0.1
slowapi==0.1.9
```

```python
# backend/app/middleware/rate_limit.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import redis

# Redis-backed rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="redis://redis-service:6379/1",
    strategy="fixed-window-elastic-expiry",
)


def setup_rate_limiting(app):
    """Configure rate limiting middleware on the FastAPI app."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
```

```python
# Usage in API routes
from app.middleware.rate_limit import limiter

@router.post("/login")
@limiter.limit("5/minute")
def login(request: Request, ...):
    ...

@router.post("/transactions")
@limiter.limit("10/minute")
def create_transaction(request: Request, ...):
    ...
```

### 7.3 Session Management with Redis

```python
# backend/app/services/session_service.py
import redis
import json
from datetime import datetime
from app.config import settings

r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

SESSION_PREFIX = "session:"
TOKEN_BLACKLIST_PREFIX = "blacklist:"


def create_session(user_id: str, token_jti: str, ip_address: str, user_agent: str):
    """Track active session in Redis."""
    session_key = f"{SESSION_PREFIX}{user_id}"
    session_data = {
        "jti": token_jti,
        "ip": ip_address,
        "user_agent": user_agent,
        "created_at": datetime.utcnow().isoformat(),
    }

    # Check concurrent session limit
    existing = r.lrange(session_key, 0, -1)
    if len(existing) >= settings.MAX_CONCURRENT_SESSIONS:
        # Remove oldest session and blacklist its token
        oldest = json.loads(r.lpop(session_key))
        blacklist_token(oldest["jti"], ttl=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)

    r.rpush(session_key, json.dumps(session_data))
    r.expire(session_key, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)


def blacklist_token(jti: str, ttl: int = 1800):
    """Add a token to the blacklist (for logout or forced session termination)."""
    r.setex(f"{TOKEN_BLACKLIST_PREFIX}{jti}", ttl, "1")


def is_token_blacklisted(jti: str) -> bool:
    """Check if a token has been blacklisted."""
    return r.exists(f"{TOKEN_BLACKLIST_PREFIX}{jti}") > 0


def destroy_all_sessions(user_id: str):
    """Destroy all sessions for a user (e.g., on password change)."""
    session_key = f"{SESSION_PREFIX}{user_id}"
    sessions = r.lrange(session_key, 0, -1)
    for s in sessions:
        data = json.loads(s)
        blacklist_token(data["jti"])
    r.delete(session_key)
```

---

## 8. WAF (Web Application Firewall)

### 8.1 AWS WAF Configuration

```bash
# Create WAF Web ACL with OWASP Top 10 rules
aws wafv2 create-web-acl \
  --name enrims-waf \
  --scope REGIONAL \
  --default-action Allow={} \
  --region ap-south-1 \
  --rules '[
    {
      "Name": "AWSManagedRulesCommonRuleSet",
      "Priority": 1,
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesCommonRuleSet"
        }
      },
      "OverrideAction": {"None": {}},
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "CommonRuleSet"
      }
    },
    {
      "Name": "AWSManagedRulesSQLiRuleSet",
      "Priority": 2,
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesSQLiRuleSet"
        }
      },
      "OverrideAction": {"None": {}},
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "SQLiRuleSet"
      }
    },
    {
      "Name": "AWSManagedRulesKnownBadInputsRuleSet",
      "Priority": 3,
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesKnownBadInputsRuleSet"
        }
      },
      "OverrideAction": {"None": {}},
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "KnownBadInputs"
      }
    },
    {
      "Name": "RateLimitRule",
      "Priority": 4,
      "Statement": {
        "RateBasedStatement": {
          "Limit": 2000,
          "AggregateKeyType": "IP"
        }
      },
      "Action": {"Block": {}},
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "RateLimit"
      }
    },
    {
      "Name": "GeoRestriction",
      "Priority": 5,
      "Statement": {
        "NotStatement": {
          "Statement": {
            "GeoMatchStatement": {
              "CountryCodes": ["IN"]
            }
          }
        }
      },
      "Action": {"Block": {}},
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "GeoBlock"
      }
    }
  ]' \
  --visibility-config SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=enrims-waf

# Associate with ALB
aws wafv2 associate-web-acl \
  --web-acl-arn arn:aws:wafv2:ap-south-1:123456789:regional/webacl/enrims-waf/xxx \
  --resource-arn arn:aws:elasticloadbalancing:ap-south-1:123456789:loadbalancer/app/enrims-alb/xxx \
  --region ap-south-1
```

### 8.2 Cloudflare WAF (Alternative)

```bash
# Using Cloudflare API to configure WAF rules
# Enable OWASP ModSecurity Core Rule Set
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/<zone-id>/firewall/waf/packages/<owasp-package-id>" \
  -H "Authorization: Bearer <api-token>" \
  -H "Content-Type: application/json" \
  -d '{"sensitivity": "high", "action_mode": "challenge"}'

# Custom rule: Block non-India IPs
curl -X POST "https://api.cloudflare.com/client/v4/zones/<zone-id>/firewall/rules" \
  -H "Authorization: Bearer <api-token>" \
  -H "Content-Type: application/json" \
  -d '[{
    "filter": {
      "expression": "not ip.geoip.country eq \"IN\"",
      "description": "Block non-India traffic (RBI data localization)"
    },
    "action": "block",
    "description": "Geo-restrict to India only"
  }]'

# Rate limiting rule
curl -X POST "https://api.cloudflare.com/client/v4/zones/<zone-id>/rate_limits" \
  -H "Authorization: Bearer <api-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "threshold": 100,
    "period": 60,
    "match": {
      "request": {"url_pattern": "api.enrims.yourbank.co.in/api/*"}
    },
    "action": {"mode": "ban", "timeout": 300},
    "description": "API rate limit"
  }'
```

---

## 9. HashiCorp Vault

### 9.1 Vault Server Setup

```bash
# Install Vault via Helm on Kubernetes
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault \
  --namespace vault \
  --create-namespace \
  --set server.ha.enabled=true \
  --set server.ha.replicas=3 \
  --set server.ha.raft.enabled=true \
  --set server.dataStorage.size=10Gi \
  --set ui.enabled=true

# Initialize Vault
kubectl exec -n vault vault-0 -- vault operator init \
  -key-shares=5 \
  -key-threshold=3 \
  -format=json > vault-init.json

# CRITICAL: Store vault-init.json securely offline (bank vault, HSM)
# It contains unseal keys and root token

# Unseal (must be done on each pod, with 3 of 5 keys)
kubectl exec -n vault vault-0 -- vault operator unseal <key1>
kubectl exec -n vault vault-0 -- vault operator unseal <key2>
kubectl exec -n vault vault-0 -- vault operator unseal <key3>
```

### 9.2 Store ENRIMS Secrets

```bash
# Login with root token (or admin policy token)
export VAULT_ADDR=https://vault.yourbank.co.in
vault login <root-token>

# Enable KV secrets engine
vault secrets enable -path=secret kv-v2

# Store ENRIMS production secrets
vault kv put secret/enrims/prod \
  db_password="<strong-generated-password>" \
  secret_key="$(openssl rand -hex 32)" \
  pii_encryption_key="$(openssl rand -hex 32)" \
  redis_password="<strong-generated-password>" \
  grafana_password="<strong-generated-password>"

# Store MFA encryption key separately (higher access control)
vault kv put secret/enrims/mfa \
  totp_encryption_key="$(openssl rand -hex 32)"

# Verify
vault kv get secret/enrims/prod
```

### 9.3 Vault Policy for ENRIMS

```hcl
# vault/enrims-policy.hcl

# Application read-only access to its secrets
path "secret/data/enrims/prod" {
  capabilities = ["read"]
}

path "secret/data/enrims/mfa" {
  capabilities = ["read"]
}

# Deny list and delete
path "secret/metadata/enrims/*" {
  capabilities = ["deny"]
}
```

```bash
# Create policy
vault policy write enrims-app vault/enrims-policy.hcl

# Create Kubernetes auth for pod identity
vault auth enable kubernetes

vault write auth/kubernetes/config \
  kubernetes_host="https://$KUBERNETES_PORT_443_TCP_ADDR:443"

vault write auth/kubernetes/role/enrims-backend \
  bound_service_account_names=enrims-backend \
  bound_service_account_namespaces=enrims \
  policies=enrims-app \
  ttl=1h
```

### 9.4 Vault CSI Provider (inject secrets into pods)

```yaml
# k8s/vault-secret-provider.yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: enrims-vault-secrets
  namespace: enrims
spec:
  provider: vault
  parameters:
    vaultAddress: "https://vault.yourbank.co.in"
    roleName: "enrims-backend"
    objects: |
      - objectName: "db_password"
        secretPath: "secret/data/enrims/prod"
        secretKey: "db_password"
      - objectName: "secret_key"
        secretPath: "secret/data/enrims/prod"
        secretKey: "secret_key"
      - objectName: "pii_encryption_key"
        secretPath: "secret/data/enrims/prod"
        secretKey: "pii_encryption_key"
      - objectName: "redis_password"
        secretPath: "secret/data/enrims/prod"
        secretKey: "redis_password"
  secretObjects:
    - secretName: enrims-secrets
      type: Opaque
      data:
        - objectName: db_password
          key: DATABASE_PASSWORD
        - objectName: secret_key
          key: SECRET_KEY
        - objectName: pii_encryption_key
          key: PII_ENCRYPTION_KEY
        - objectName: redis_password
          key: REDIS_PASSWORD
```

Update the backend deployment to mount Vault secrets:

```yaml
# Add to k8s/backend-deployment.yaml (under spec.template.spec)
volumes:
  - name: secrets-store
    csi:
      driver: secrets-store.csi.k8s.io
      readOnly: true
      volumeAttributes:
        secretProviderClass: enrims-vault-secrets

# Add to containers[0].volumeMounts
volumeMounts:
  - name: secrets-store
    mountPath: "/mnt/secrets"
    readOnly: true
```

### 9.5 Secret Rotation

```bash
# Rotate database password
NEW_PASS=$(openssl rand -base64 24)

# 1. Update in Vault
vault kv put secret/enrims/prod \
  db_password="$NEW_PASS" \
  secret_key="$(vault kv get -field=secret_key secret/enrims/prod)" \
  pii_encryption_key="$(vault kv get -field=pii_encryption_key secret/enrims/prod)" \
  redis_password="$(vault kv get -field=redis_password secret/enrims/prod)"

# 2. Update in PostgreSQL
psql -h finsurge-enrims-prod.xxxxx.rds.amazonaws.com -U enrims_admin -c \
  "ALTER USER enrims_app PASSWORD '$NEW_PASS';"

# 3. Rolling restart of backend pods (picks up new secret)
kubectl rollout restart deployment/enrims-backend -n enrims

# Rotation schedule:
# - Database passwords: Every 90 days
# - SECRET_KEY: Every 90 days (invalidates all JWTs -- schedule during maintenance window)
# - PII_ENCRYPTION_KEY: NEVER rotate without data re-encryption migration
# - Redis password: Every 90 days
```

---

## Deployment Checklist

Before going live, verify each infrastructure component:

| # | Component | Check | Command |
|---|-----------|-------|---------|
| 1 | PostgreSQL | Connection, TLS, backup | `psql "sslmode=require" -c "SELECT version();"` |
| 2 | TLS | Certificate valid, A+ rating | `curl -I https://enrims.yourbank.co.in` |
| 3 | MFA | TOTP setup/verify works | Test with Google Authenticator |
| 4 | Kubernetes | Pods running, HPA active | `kubectl get pods,hpa -n enrims` |
| 5 | Prometheus | Metrics scraping | `curl http://backend:8000/metrics` |
| 6 | Grafana | Dashboard loads | Open Grafana UI, verify panels |
| 7 | Alerting | Test alert fires | Trigger a test alert, verify PagerDuty |
| 8 | Redis | Connection, persistence | `redis-cli -h redis-service ping` |
| 9 | WAF | Rules active, geo-block works | Test from non-India IP (should be blocked) |
| 10 | Vault | Secrets accessible | `vault kv get secret/enrims/prod` |
| 11 | Backups | Restore test passes | Restore to a test instance, verify data |
| 12 | DNS | Points to correct endpoints | `dig enrims.yourbank.co.in` |

---

*This guide should be executed by the DevOps/SRE team with approval from the CISO for security-related configurations.*
*All passwords, tokens, and API keys must be generated fresh for production -- never reuse values from this document.*
