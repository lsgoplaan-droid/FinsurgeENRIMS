# FinsurgeENRIMS — Detailed Gap Analysis by Severity & Phase
**Generated**: 2026-04-10 | **Status**: NOT PRODUCTION READY | **Total Gaps**: 47

---

## 🔴 P0 BLOCKERS — 11 Critical Issues (Must Fix Before ANY Production Deployment)

### SECURITY (5 P0 gaps)

#### S1: Hardcoded Secret Key
- **Current State**: `SECRET_KEY = "finsurge-enrims-..."` in `config.py`
- **Risk**: Compromise affects all authentication & encryption
- **Requirement**: 
  - Use environment variables (e.g., `os.getenv('SECRET_KEY')`)
  - Minimum 256-bit entropy
  - Quarterly rotation
  - Never commit to git
- **Implementation**:
  - Read from `.env` file (development) or system env (production)
  - Use `secrets.token_hex(32)` for generation
  - Update CI/CD to pass secrets securely
- **Effort**: 1 hour
- **Phase**: 1
- **Status**: ❌ NOT FIXED

#### S2: CORS Wildcard `*`
- **Current State**: `allow_origins=["*"]` in `main.py`
- **Risk**: Any domain can access APIs; enables CSRF attacks
- **Requirement**:
  - Whitelist only bank's domain(s)
  - Support multiple environments (dev, staging, prod)
  - Include bank IP ranges if available
- **Implementation**:
  - Change to: `allow_origins=["https://bank.example.com", "https://admin.bank.example.com"]`
  - Use environment variables for environment-specific URLs
  - Add credential support if needed
- **Example**:
  ```python
  CORS_ORIGINS = os.getenv('CORS_ORIGINS', '').split(',')
  CORSMiddleware(app, allow_origins=CORS_ORIGINS)
  ```
- **Effort**: 30 minutes
- **Phase**: 1
- **Status**: ❌ NOT FIXED

#### S3: No Rate Limiting
- **Current State**: Login & API endpoints unlimited
- **Risk**: Brute force attacks, DoS attacks
- **Requirement**:
  - 5 login attempts per minute (per IP)
  - 100 requests per minute (per authenticated user)
  - 50 requests per minute (per unauthenticated IP)
- **Implementation**:
  - Use `slowapi` package: `pip install slowapi`
  - Add rate limit decorator to endpoints
  - Store limits in Redis (production) or in-memory (development)
- **Example**:
  ```python
  from slowapi import Limiter
  from slowapi.util import get_remote_address
  
  limiter = Limiter(key_func=get_remote_address)
  app.state.limiter = limiter
  
  @router.post("/login")
  @limiter.limit("5/minute")
  def login(credentials: LoginRequest):
      ...
  ```
- **Effort**: 2 hours
- **Phase**: 1
- **Status**: ❌ NOT FIXED

#### S5: No HTTPS Enforcement
- **Current State**: HTTP on port 8000 (no encryption)
- **Risk**: Man-in-the-middle attacks, credential interception
- **Requirement**:
  - TLS 1.2 or higher
  - HSTS headers (`Strict-Transport-Security: max-age=31536000`)
  - Valid SSL/TLS certificate
  - Redirect HTTP → HTTPS
- **Implementation**:
  - Generate SSL certificate (self-signed for dev, CA-signed for prod)
  - Configure uvicorn: `uvicorn main:app --ssl-keyfile=key.pem --ssl-certfile=cert.pem`
  - Add middleware to force HTTPS in production:
  ```python
  from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
  app.add_middleware(HTTPSRedirectMiddleware)
  ```
  - Add HSTS headers:
  ```python
  @app.middleware("http")
  async def add_hsts_header(request, call_next):
      response = await call_next(request)
      response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
      return response
  ```
- **Effort**: 3 hours
- **Phase**: 1
- **Status**: ❌ NOT FIXED

#### S11: Debug Mode Enabled
- **Current State**: `DEBUG: bool = True` in `config.py`
- **Risk**: Exposes stack traces, sensitive data in error responses
- **Requirement**:
  - `DEBUG = False` in production
  - Generic error responses (no stack traces)
  - Log detailed errors server-side only
- **Implementation**:
  - Move `DEBUG` to environment variable
  - Create generic error handler that logs details but returns safe response
  ```python
  @app.exception_handler(Exception)
  async def generic_exception_handler(request, exc):
      logger.error(f"Unhandled exception: {exc}", exc_info=True)
      return JSONResponse(
          status_code=500,
          content={"detail": "Internal server error"}
      )
  ```
- **Effort**: 30 minutes
- **Phase**: 1
- **Status**: ❌ NOT FIXED

---

### DATA PROTECTION & PRIVACY (2 P0 gaps)

#### D1: No Encryption at Rest
- **Current State**: SQLite file unencrypted on disk
- **Risk**: Data breach if server/backups compromised
- **Requirement**:
  - Use PostgreSQL with Transparent Data Encryption (TDE) OR
  - Volume-level encryption (AES-256) OR
  - Field-level encryption for sensitive data
- **Implementation**: Migrate to PostgreSQL with encryption
  - Install PostgreSQL 15+
  - Enable pgcrypto extension
  - Use encrypted filesystem (LUKS, BitLocker, etc.)
  - Option: pgTDE (PostgreSQL Transparent Data Encryption plugin)
- **Steps**:
  1. Set up PostgreSQL instance with encryption
  2. Create migration scripts (SQLAlchemy Alembic)
  3. Test data integrity during migration
  4. Update connection string and ORM mappings
- **Effort**: 4 hours (includes testing)
- **Phase**: 1
- **Status**: ❌ NOT FIXED

#### D2: PII Stored in Plaintext
- **Current State**: PAN, Aadhaar, phone, email stored unencrypted
- **Risk**: GDPR/DPDP Act violations, identity theft
- **Requirement**:
  - Encrypt PAN and Aadhaar with field-level encryption
  - Hash Aadhaar with salt (for lookups)
  - Encrypt phone/email, or keep masked in DB
  - Manage encryption keys separately (Key Management Service)
- **Implementation**:
  - Use `cryptography` package: `pip install cryptography`
  - Create `FieldEncryption` SQLAlchemy decorator
  - Use AWS KMS or HashiCorp Vault for key management
- **Example**:
  ```python
  from cryptography.fernet import Fernet
  
  encryption_key = os.getenv('ENCRYPTION_KEY')
  cipher_suite = Fernet(encryption_key)
  
  class Customer(Base):
      pan_number = Column(String, nullable=True)
      
      @property
      def pan_decrypted(self):
          if self.pan_number:
              return cipher_suite.decrypt(self.pan_number).decode()
          return None
      
      @pan_decrypted.setter
      def pan_decrypted(self, value):
          if value:
              self.pan_number = cipher_suite.encrypt(value.encode())
  ```
- **Effort**: 3 hours
- **Phase**: 1
- **Status**: ❌ NOT FIXED

---

### DATABASE & INFRASTRUCTURE (3 P0 gaps)

#### I1: SQLite in Production
- **Current State**: Single-file SQLite database
- **Risk**: No concurrent write support, no backups, no HA/failover
- **Requirement**:
  - Migrate to PostgreSQL 15+
  - Connection pooling with PgBouncer
  - Replication setup (Primary-Replica)
  - Automated backups with point-in-time recovery
- **Implementation**: Major migration
  1. Install PostgreSQL 15+
  2. Create migration scripts using SQLAlchemy Alembic
  3. Update connection string: `postgresql://user:pass@host:5432/dbname`
  4. Test all ORM mappings
  5. Migrate data (test before production)
  6. Set up PgBouncer for connection pooling
  7. Configure WAL (Write-Ahead Logging) for durability
- **Config Changes**:
  ```python
  # config.py
  DATABASE_URL = os.getenv('DATABASE_URL', 
      'postgresql://user:password@localhost:5432/enrims')
  
  # Alembic init
  # alembic init alembic
  # Create migration: alembic revision --autogenerate
  ```
- **Effort**: 6 hours (includes testing & validation)
- **Phase**: 1
- **Status**: ❌ NOT FIXED
- **Blocker**: Blocks I2 (migrations), I3 (backups), I4 (HA)

#### I3: No Backup/Restore
- **Current State**: No automated backups
- **Risk**: Data loss in case of disaster, no recovery point
- **Requirement**:
  - Automated daily backups
  - Point-in-time recovery (PITR) capability
  - Tested restore procedure
  - 30-day retention minimum
  - Off-site storage (AWS S3, Azure Blob, etc.)
- **Implementation**:
  ```bash
  # Daily backup script (cron job)
  #!/bin/bash
  BACKUP_FILE="/backups/enrims_$(date +%Y%m%d_%H%M%S).sql"
  pg_dump -h localhost -U postgres -d enrims | gzip > $BACKUP_FILE
  aws s3 cp $BACKUP_FILE s3://backups-bucket/enrims/
  
  # Retention policy (keep last 30 days)
  find /backups -name "enrims_*.sql.gz" -mtime +30 -delete
  ```
- **Test Procedure**:
  1. Take backup
  2. Restore to test database
  3. Verify data integrity
  4. Document RTO (Recovery Time Objective) and RPO (Recovery Point Objective)
- **Effort**: 5 hours (includes testing)
- **Phase**: 3 (but needed for Phase 1)
- **Status**: ❌ NOT FIXED

#### I6: Auto-Seed in Production
- **Current State**: `seed_all()` runs automatically if DB is empty
- **Risk**: Database corruption, duplicate seed data on restarts
- **Requirement**:
  - Remove auto-seed from startup code
  - Use Alembic migrations for reference data
  - Seed data only via manual script or admin API
- **Implementation**:
  ```python
  # main.py - REMOVE THIS
  # if not db_has_data():
  #     seed_all()
  
  # INSTEAD: Create Alembic migration
  # alembic revision -m "seed_initial_data"
  
  # In migration file:
  def upgrade():
      op.execute("""
          INSERT INTO users VALUES (...)
          INSERT INTO customers VALUES (...)
      """)
  ```
- **Alternative**: Add admin endpoint for seeding (development only)
  ```python
  @router.post("/admin/seed")
  async def seed_database(current_user: User = Depends(get_current_user)):
      if not current_user.is_admin:
          raise HTTPException(403)
      if not settings.DEBUG:
          raise HTTPException(403)
      seed_all()
      return {"status": "seeded"}
  ```
- **Effort**: 1 hour
- **Phase**: 1
- **Status**: ❌ NOT FIXED

---

### TESTING (1 P0 gap)

#### T1: Zero Test Coverage
- **Current State**: 57/57 backend tests exist (from prior feedback fixes)
- **Requirement**: 80%+ code coverage (unit + integration + API tests)
- **Current Coverage**: ~60% (57 tests, but gaps in rules engine, compliance)
- **Missing Tests**:
  - Rules engine: 26 rules × 2 tests (positive + negative) = 52 tests
  - Compliance workflows: CTR/SAR generation = 8 tests
  - Fraud metrics calculations = 6 tests
  - API response masking = 4 tests
  - **Total new tests needed**: ~70 tests
- **Implementation**:
  ```bash
  pytest tests/ --cov=app --cov-report=html
  # Current: 60% coverage
  # Target: 80%+ coverage
  ```
- **Effort**: 16 hours (design + implementation)
- **Phase**: 2
- **Status**: ⚠️ PARTIAL (57/57 tests pass, but ~70 more needed)

---

## 🟠 P1 CRITICAL — 19 Items (Must Fix Before Bank UAT)

### SECURITY (4 P1 gaps)

#### S6: Password Policy Weak
- **Current State**: No complexity enforcement
- **Requirement**: Min 12 chars, uppercase + lowercase + digit + special, 90-day rotation
- **Implementation**:
  ```python
  import re
  from datetime import datetime, timedelta
  
  def validate_password(password: str):
      if len(password) < 12:
          raise ValueError("Min 12 characters")
      if not re.search(r'[A-Z]', password):
          raise ValueError("Requires uppercase")
      if not re.search(r'[a-z]', password):
          raise ValueError("Requires lowercase")
      if not re.search(r'\d', password):
          raise ValueError("Requires digit")
      if not re.search(r'[!@#$%^&*]', password):
          raise ValueError("Requires special char")
  
  class User(Base):
      password_changed_at = Column(DateTime, default=datetime.utcnow)
      
      def is_password_expired(self):
          if not self.password_changed_at:
              return True
          days_since = (datetime.utcnow() - self.password_changed_at).days
          return days_since > 90
  ```
- **Effort**: 2 hours
- **Phase**: 1
- **Status**: ❌ NOT FIXED

#### S7: Token Expiry Too Long
- **Current State**: 480 minutes (8 hours)
- **Requirement**: 30 minutes with sliding refresh token
- **Implementation**:
  ```python
  ACCESS_TOKEN_EXPIRE_MINUTES = 30  # was 480
  REFRESH_TOKEN_EXPIRE_DAYS = 7
  
  def create_tokens(user_id: str):
      access_token = create_access_token(
          data={"sub": user_id},
          expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
      )
      refresh_token = create_refresh_token(
          data={"sub": user_id},
          expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
      )
      return {
          "access_token": access_token,
          "refresh_token": refresh_token,
          "token_type": "bearer"
      }
  
  @router.post("/refresh")
  def refresh_access_token(refresh_token: str):
      # Validate refresh token
      # Return new access token
      ...
  ```
- **Effort**: 1 hour
- **Phase**: 1
- **Status**: ❌ NOT FIXED

#### S8: No Session Management
- **Current State**: Stateless JWT, no revocation
- **Requirement**: Token blacklist on logout, concurrent session control
- **Implementation**:
  ```python
  from app.models import TokenBlacklist
  from datetime import datetime
  
  class TokenBlacklist(Base):
      __tablename__ = "token_blacklist"
      token = Column(String, primary_key=True)
      blacklisted_at = Column(DateTime, default=datetime.utcnow)
      expires_at = Column(DateTime)
  
  @router.post("/logout")
  async def logout(
      current_user: User = Depends(get_current_user),
      token: str = Header(..., alias="Authorization"),
      db: Session = Depends(get_db)
  ):
      # Extract token from "Bearer <token>"
      jwt_token = token.split(" ")[1]
      
      # Add to blacklist
      payload = jwt.decode(jwt_token, SECRET_KEY, algorithms=[ALGORITHM])
      exp = datetime.fromtimestamp(payload['exp'])
      
      blacklist_entry = TokenBlacklist(
          token=jwt_token,
          expires_at=exp
      )
      db.add(blacklist_entry)
      db.commit()
      
      return {"status": "logged out"}
  
  def verify_token(token: str, db: Session):
      # Check if token is blacklisted
      if db.query(TokenBlacklist).filter_by(token=token).first():
          raise HTTPException(401, "Token revoked")
      # Verify JWT as normal
      ...
  ```
- **Effort**: 3 hours
- **Phase**: 1
- **Status**: ❌ NOT FIXED

#### S9: No Input Sanitization
- **Current State**: Basic Pydantic validation only
- **Requirement**: XSS prevention, request size limits (1MB), header validation
- **Implementation**:
  ```python
  from fastapi import Request
  from starlette.exceptions import HTTPException
  import html
  
  @app.middleware("http")
  async def sanitize_input(request: Request, call_next):
      # Size limit
      if request.headers.get("content-length"):
          size = int(request.headers["content-length"])
          if size > 1_000_000:  # 1MB limit
              return JSONResponse(
                  status_code=413,
                  content={"detail": "Request too large"}
              )
      
      # Validate headers
      dangerous_headers = ["x-forwarded-for", "x-real-ip"]
      for header in dangerous_headers:
          if header in request.headers:
              # Log and reject suspicious requests
              ...
      
      response = await call_next(request)
      return response
  
  # XSS prevention in responses
  def escape_html(data: str) -> str:
      return html.escape(data)
  
  # In serializers
  class AlertResponse(BaseModel):
      title: str  # User input
      
      @field_validator('title')
      @classmethod
      def sanitize_title(cls, v):
          return escape_html(v)
  ```
- **Effort**: 3 hours
- **Phase**: 3
- **Status**: ❌ NOT FIXED

### DATA PROTECTION (3 P1 gaps)

#### D3: No Data Masking in APIs
- **Current State**: Full PAN/phone returned in list endpoints
- **Requirement**: Mask in lists; show full in detail view with audit
- **Implementation**:
  ```python
  def mask_pan(pan: str) -> str:
      if not pan or len(pan) < 4:
          return pan
      return f"XXXXX{pan[-4:]}"
  
  def mask_phone(phone: str) -> str:
      if not phone or len(phone) < 4:
          return phone
      return f"+91XXXXX{phone[-4:]}"
  
  class CustomerListResponse(BaseModel):
      id: str
      name: str
      pan_number: str  # Masked
      phone: str      # Masked
      
      @field_validator('pan_number')
      @classmethod
      def mask_pan_field(cls, v):
          return mask_pan(v)
      
      @field_validator('phone')
      @classmethod
      def mask_phone_field(cls, v):
          return mask_phone(v)
  
  class CustomerDetailResponse(BaseModel):
      id: str
      name: str
      pan_number: str  # Full (with audit log)
      phone: str      # Full (with audit log)
  ```
- **Audit Logging**:
  ```python
  @router.get("/customers/{id}")
  async def get_customer_detail(id: str, db: Session = Depends(get_db)):
      customer = db.query(Customer).filter_by(id=id).first()
      
      # Log access to PII
      audit = AuditLog(
          user_id=current_user.id,
          action="view_pii",
          resource="customer",
          resource_id=id,
          details={"fields": ["pan", "phone"]}
      )
      db.add(audit)
      db.commit()
      
      return customer
  ```
- **Effort**: 2 hours
- **Phase**: 1
- **Status**: ❌ NOT FIXED

#### D4: No Data Retention Policy
- **Current State**: All data kept forever
- **Requirement**: Auto-archive after 7 years, purge after 10 years (RBI mandate)
- **Implementation**:
  ```python
  from datetime import datetime, timedelta
  
  class DataArchivalPolicy:
      ARCHIVE_AFTER_YEARS = 7
      PURGE_AFTER_YEARS = 10
      
      @staticmethod
      def archive_old_data():
          cutoff_date = datetime.utcnow() - timedelta(days=365*7)
          
          # Archive old cases
          old_cases = db.query(Case).filter(Case.created_at < cutoff_date).all()
          for case in old_cases:
              case.is_archived = True
          
          # Archive old transactions
          old_txns = db.query(Transaction).filter(
              Transaction.transaction_date < cutoff_date
          ).all()
          for txn in old_txns:
              txn.is_archived = True
          
          db.commit()
          logger.info(f"Archived {len(old_cases)} cases, {len(old_txns)} transactions")
      
      @staticmethod
      def purge_old_data():
          cutoff_date = datetime.utcnow() - timedelta(days=365*10)
          
          # Purge (soft delete with anonymization)
          old_data = db.query(Customer).filter(
              Customer.created_at < cutoff_date,
              Customer.is_archived == True
          ).all()
          
          for customer in old_data:
              customer.first_name = "PURGED"
              customer.last_name = "PURGED"
              customer.email = None
              customer.phone = None
              customer.pan_number = None
              customer.aadhaar_number = None
              customer.is_deleted = True
          
          db.commit()
          logger.info(f"Purged {len(old_data)} customer records")
  
  # Cron job
  # 0 2 1 * * python -c "from archive import DataArchivalPolicy; DataArchivalPolicy.archive_old_data()"
  # 0 3 1 * * python -c "from archive import DataArchivalPolicy; DataArchivalPolicy.purge_old_data()"
  ```
- **Effort**: 3 hours
- **Phase**: 4
- **Status**: ❌ NOT FIXED

#### D7: No Data Localization
- **Current State**: Can deploy anywhere
- **Requirement**: Data must reside in India (RBI circular 2018)
- **Implementation**:
  - Ensure PostgreSQL server is in AWS/Azure region in Central India
  - Set bucket policies for S3/Blob storage to India-only
  - Configure backups to India-only storage
  - Document in deployment runbook
  ```bash
  # AWS example
  # RDS: ap-south-1 (Mumbai)
  # S3: ap-south-1 with bucket policy preventing cross-region replication
  # DynamoDB: ap-south-1
  ```
- **Verification**:
  ```python
  @router.get("/health/data-location")
  async def verify_data_location():
      db_region = os.getenv('DB_REGION')  # Must be ap-south-1
      backup_region = os.getenv('BACKUP_REGION')  # Must be ap-south-1
      
      if db_region != 'ap-south-1' or backup_region != 'ap-south-1':
          raise HTTPException(500, "Data not localized to India")
      
      return {
          "status": "compliant",
          "db_region": db_region,
          "backup_region": backup_region
      }
  ```
- **Effort**: 4 hours (includes documentation)
- **Phase**: 4
- **Status**: ❌ NOT FIXED

#### D8: Audit Log Incomplete
- **Current State**: Model exists, not wired to API handlers
- **Requirement**: Log every read/write with user, IP, timestamp, resource
- **Implementation**:
  ```python
  class AuditLog(Base):
      __tablename__ = "audit_logs"
      id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
      user_id = Column(String, ForeignKey("users.id"))
      action = Column(String)  # create, read, update, delete
      resource_type = Column(String)  # alert, case, customer, etc
      resource_id = Column(String)
      old_value = Column(JSON, nullable=True)
      new_value = Column(JSON, nullable=True)
      ip_address = Column(String)
      created_at = Column(DateTime, default=datetime.utcnow)
  
  @app.middleware("http")
  async def audit_middleware(request: Request, call_next):
      response = await call_next(request)
      
      # Log request details
      if request.method in ["POST", "PUT", "DELETE"]:
          audit = AuditLog(
              user_id=getattr(request.state, 'user_id', None),
              action=request.method.lower(),
              resource_type=request.url.path.split('/')[3],  # Extract from path
              ip_address=request.client.host,
              created_at=datetime.utcnow()
          )
          # Save to DB
      
      return response
  ```
- **Effort**: 3 hours
- **Phase**: 2
- **Status**: ⚠️ PARTIAL (model exists, not wired)

### DATABASE & INFRASTRUCTURE (3 P1 gaps)

#### I2: No Database Migrations
- **Current State**: `create_all()` on startup
- **Requirement**: Alembic migration framework with versioned migrations
- **Implementation**:
  ```bash
  # Initialize Alembic
  alembic init alembic
  
  # Create migration
  alembic revision --autogenerate -m "initial_schema"
  
  # Apply migration
  alembic upgrade head
  ```
- **Migration File Example**:
  ```python
  # alembic/versions/001_initial_schema.py
  from alembic import op
  import sqlalchemy as sa
  
  def upgrade():
      op.create_table(
          'users',
          sa.Column('id', sa.String(), nullable=False),
          sa.Column('email', sa.String(), nullable=False),
          sa.Column('password_hash', sa.String(), nullable=False),
          sa.PrimaryKeyConstraint('id'),
          sa.UniqueConstraint('email')
      )
  
  def downgrade():
      op.drop_table('users')
  ```
- **Effort**: 5 hours
- **Phase**: 2
- **Status**: ❌ NOT FIXED

#### I4: No HA/Failover
- **Current State**: Single instance
- **Requirement**: Primary-replica setup, automatic failover
- **Implementation**:
  - PostgreSQL Primary-Replica replication
  - Use PgBouncer for connection pooling
  - Patroni for automatic failover
  - Application connection string points to floating IP
  ```bash
  # Patroni setup
  # Primary: postgresql://primary:5432/enrims
  # Replica: postgresql://replica:5432/enrims (read-only)
  # Floating IP: postgresql://patroni-vip:5432/enrims (auto-routes to primary)
  ```
- **Effort**: 8 hours
- **Phase**: 3
- **Status**: ❌ NOT FIXED

#### I7: No Reverse Proxy
- **Current State**: Direct uvicorn exposure
- **Requirement**: Nginx/HAProxy with WAF, DDoS protection, request buffering
- **Implementation**:
  ```nginx
  # /etc/nginx/sites-available/enrims
  upstream uvicorn {
      server 127.0.0.1:8000;
      server 127.0.0.1:8001;  # Backup
      keepalive 32;
  }
  
  server {
      listen 443 ssl http2;
      server_name api.bank.example.com;
      
      # SSL
      ssl_certificate /etc/ssl/certs/enrims.crt;
      ssl_certificate_key /etc/ssl/private/enrims.key;
      ssl_protocols TLSv1.2 TLSv1.3;
      
      # Rate limiting
      limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
      limit_req zone=api_limit burst=20 nodelay;
      
      # Request size limit
      client_max_body_size 1M;
      
      # Proxy to uvicorn
      location / {
          proxy_pass http://uvicorn;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
      
      # WAF (ModSecurity)
      modsecurity on;
      modsecurity_rules_file /etc/nginx/modsecurity/modsecurity.conf;
  }
  ```
- **Effort**: 3 hours
- **Phase**: 3
- **Status**: ❌ NOT FIXED

### MONITORING (2 P1 gaps)

#### M2: No Application Metrics
- **Current State**: No metrics
- **Requirement**: Prometheus metrics (request rate, error rate, latency percentiles)
- **Implementation**:
  ```python
  from prometheus_client import Counter, Histogram, Gauge
  
  # Metrics
  request_count = Counter(
      'http_requests_total',
      'Total HTTP requests',
      ['method', 'endpoint', 'status']
  )
  request_duration = Histogram(
      'http_request_duration_seconds',
      'HTTP request duration',
      ['method', 'endpoint'],
      buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0)
  )
  db_query_duration = Histogram(
      'db_query_duration_seconds',
      'Database query duration',
      ['query_type']
  )
  
  @app.middleware("http")
  async def add_metrics(request: Request, call_next):
      start = time.time()
      response = await call_next(request)
      duration = time.time() - start
      
      request_count.labels(
          method=request.method,
          endpoint=request.url.path,
          status=response.status_code
      ).inc()
      
      request_duration.labels(
          method=request.method,
          endpoint=request.url.path
      ).observe(duration)
      
      return response
  
  @app.get("/metrics")
  async def metrics():
      return Response(content=generate_latest())
  ```
- **Effort**: 3 hours
- **Phase**: 3
- **Status**: ❌ NOT FIXED

#### M3: No Alerting
- **Current State**: No alerts
- **Requirement**: PagerDuty/OpsGenie (error spike, DB down, high latency)
- **Implementation**:
  ```python
  import requests
  
  def alert_to_pagerduty(severity: str, title: str, details: dict):
      payload = {
          "routing_key": os.getenv('PAGERDUTY_ROUTING_KEY'),
          "event_action": "trigger",
          "dedup_key": f"{title}:{datetime.utcnow().timestamp()}",
          "payload": {
              "summary": title,
              "severity": severity,  # critical, error, warning, info
              "source": "enrims-monitoring",
              "custom_details": details
          }
      }
      requests.post(
          "https://events.pagerduty.com/v2/enqueue",
          json=payload
      )
  
  # Alert rules
  class AlertRules:
      ERROR_RATE_THRESHOLD = 0.05  # 5%
      LATENCY_P95_THRESHOLD = 200  # 200ms
      DB_CONNECTION_POOL_THRESHOLD = 0.8  # 80%
      
      @staticmethod
      def check_error_rate():
          error_rate = request_error_count / request_total
          if error_rate > AlertRules.ERROR_RATE_THRESHOLD:
              alert_to_pagerduty(
                  severity="critical",
                  title="High error rate detected",
                  details={"error_rate": f"{error_rate*100}%"}
              )
      
      @staticmethod
      def check_db_down():
          try:
              db.session.execute("SELECT 1")
          except Exception as e:
              alert_to_pagerduty(
                  severity="critical",
                  title="Database connection failed",
                  details={"error": str(e)}
              )
  
  # Run checks periodically (Celery or APScheduler)
  @scheduler.scheduled_job('interval', minutes=1)
  def monitoring_job():
      AlertRules.check_error_rate()
      AlertRules.check_db_down()
  ```
- **Effort**: 2 hours
- **Phase**: 3
- **Status**: ❌ NOT FIXED

### TESTING (3 P1 gaps)

#### T2: No Test Infrastructure
- **Current State**: pytest + pytest-asyncio already in place
- **Requirement**: Fully configured pytest with httpx for API testing
- **Status**: ✅ EXISTS (already have infrastructure)
- **Details**:
  - `conftest.py`: Test fixtures and setup
  - `pytest.ini`: Configuration
  - Test database: Separate SQLite in-memory for tests
- **Effort**: 0 (already done)
- **Phase**: 2
- **Status**: ✅ EXISTS

#### T4: No Security Testing
- **Current State**: No SAST/DAST
- **Requirement**: OWASP ZAP, Bandit (Python SAST), dependency scan
- **Implementation**:
  ```bash
  # Bandit (Python static security analyzer)
  pip install bandit
  bandit -r app/ -f json -o bandit-report.json
  
  # OWASP ZAP (dynamic security testing)
  docker run -t owasp/zap2docker-stable zap-baseline.py \
    -t http://localhost:8000/api/v1 \
    -r zap-report.html
  
  # Dependency check
  pip install safety
  safety check --json > safety-report.json
  ```
- **CI/CD Integration**:
  ```yaml
  # .github/workflows/security.yml
  - name: Bandit SAST
    run: bandit -r app/ --fail-level high
  
  - name: Dependency Check
    run: safety check
  ```
- **Effort**: 4 hours
- **Phase**: 2
- **Status**: ❌ NOT FIXED

#### T6: No UAT Test Scripts
- **Current State**: No documented test scenarios
- **Requirement**: Step-by-step test scripts for each module
- **Implementation**: Create test scripts document
  ```markdown
  # UAT Test Scripts for AlertsPage
  
  ## Test Case: ALT-001 — Create Alert
  1. Navigate to /alerts
  2. Click "New Alert" button
  3. Fill in: Customer "Rajesh Mehta", Title "Test Alert"
  4. Set Priority: "High", Type: "fraud"
  5. Click Save
  6. Expected: Alert appears in list, notified via email
  
  ## Test Case: ALT-002 — Assign Alert
  1. Open alert ALT-20260410-0001
  2. Click "Assign" button
  3. Select assignee "Deepa Venkatesh"
  4. Click Confirm
  5. Expected: Alert status changes to "assigned", email sent to assignee
  ```
- **Effort**: 6 hours
- **Phase**: 2
- **Status**: ❌ NOT FIXED

### REGULATORY COMPLIANCE (3 P1 gaps)

#### R1: No RBI Compliance Mapping
- **Current State**: No documentation
- **Requirement**: Map each feature to RBI Master Direction
- **Implementation**: Create compliance matrix document
  ```markdown
  # RBI Compliance Mapping
  
  ## Feature: Customer Identification (KYC)
  - RBI Reference: Master Direction DBOD.KYC.TDS.BC
  - Implementation: Customer360 page collects PAN, Aadhaar, address
  - Verification: Aadhaar verification via UIDAI
  - Evidence: /customers/{id}/kyc endpoint returns verified status
  - Compliance Proof: Audit trail logs all KYC updates
  
  ## Feature: Transaction Monitoring (AML)
  - RBI Reference: Master Direction DBOD.AML.BC
  - Implementation: Rules engine flagges suspicious patterns
  - Thresholds: CTR >10L INR, velocity >5 txns/hour
  - Escalation: Analyst reviews flagged txns within 24 hours
  - Reporting: STR filed to FIU-IND within 7 days
  ```
- **Effort**: 4 hours
- **Phase**: 2
- **Status**: ❌ NOT FIXED

#### R2: CTR Auto-Filing Incomplete
- **Current State**: CTR model exists, no actual filing
- **Requirement**: Integration with FIU-IND portal for automated filing
- **Implementation**:
  ```python
  from fiuind_sdk import FIUClient
  
  class CTRFilingService:
      def __init__(self):
          self.fiu_client = FIUClient(
              api_key=os.getenv('FIU_API_KEY'),
              endpoint='https://fiu.gov.in/api/v1'
          )
      
      def file_ctr(self, transaction_id: str, amount: float, customer_id: str):
          txn = db.query(Transaction).filter_by(id=transaction_id).first()
          customer = db.query(Customer).filter_by(id=customer_id).first()
          
          ctr_payload = {
              "reporting_bank": "ENRIMS-BANK",
              "ctr_number": self._generate_ctr_number(),
              "transaction_date": txn.transaction_date,
              "amount_inr": amount,
              "customer_name": customer.full_name,
              "customer_pan": customer.pan_number,
              "transaction_details": {
                  "channel": txn.channel,
                  "counterparty": txn.counterparty_name,
                  "purpose": "cash_deposit"
              }
          }
          
          response = self.fiu_client.file_ctr(ctr_payload)
          
          # Log filing
          ctr_record = CTRFiling(
              transaction_id=transaction_id,
              ctr_number=response['ctr_number'],
              fiu_reference=response['reference_id'],
              status='filed',
              filed_at=datetime.utcnow()
          )
          db.add(ctr_record)
          db.commit()
          
          return response
      
      def _generate_ctr_number(self):
          today = datetime.utcnow().strftime("%Y%m%d")
          count = db.query(CTRFiling).filter(
              CTRFiling.ctr_number.like(f"CTR-{today}-%")
          ).count() + 1
          return f"CTR-{today}-{count:04d}"
  ```
- **Effort**: 6 hours
- **Phase**: 4
- **Status**: ❌ NOT FIXED

#### R3: No Suspicious Transaction Workflow
- **Current State**: Basic alert→case flow
- **Requirement**: Full PMLA Section 12 workflow (detection→principal→FIU)
- **Implementation**:
  ```python
  class STRWorkflow:
      def detect_suspicious_activity(self, alert_id: str):
          # Step 1: Detection
          alert = db.query(Alert).filter_by(id=alert_id).first()
          
          if alert.risk_score > 70:
              # Step 2: Report to Principal Officer
              str_report = STRReport(
                  alert_id=alert_id,
                  status='pending_approval',
                  reported_at=datetime.utcnow()
              )
              db.add(str_report)
              
              # Notify Compliance Head (Principal Officer)
              notify_principal_officer(
                  title="STR Pending Approval",
                  details=f"Alert {alert.alert_number}: Risk {alert.risk_score}%"
              )
      
      def approve_str(self, str_report_id: str, principal_officer_id: str):
          # Step 3: Principal Officer approves STR
          str_report = db.query(STRReport).filter_by(id=str_report_id).first()
          str_report.approved_by = principal_officer_id
          str_report.approved_at = datetime.utcnow()
          str_report.status = 'approved'
          db.commit()
          
          # Step 4: File with FIU
          self.file_str_with_fiu(str_report_id)
      
      def file_str_with_fiu(self, str_report_id: str):
          # File STR with FIU-IND
          fiu_client = FIUClient()
          response = fiu_client.file_str({
              "str_details": "...",
              "bank_reference": str_report_id
          })
          
          str_report = db.query(STRReport).filter_by(id=str_report_id).first()
          str_report.fiu_reference = response['reference_id']
          str_report.status = 'filed'
          str_report.filed_at = datetime.utcnow()
          db.commit()
  ```
- **Effort**: 4 hours
- **Phase**: 4
- **Status**: ❌ NOT FIXED

#### R4: No Regulatory Audit Trail
- **Current State**: Audit model unused
- **Requirement**: Immutable audit log, tamper-proof, 5-year retention
- **Implementation**:
  ```python
  from app.models import AuditLog
  
  class Regulatory AuditLog(Base):
      __tablename__ = "regulatory_audit_log"
      id = Column(String, primary_key=True)
      event_type = Column(String)  # ctr_filed, str_filed, rule_change, etc
      user_id = Column(String, ForeignKey("users.id"))
      resource_type = Column(String)
      resource_id = Column(String)
      old_value = Column(JSON)
      new_value = Column(JSON)
      hash_value = Column(String)  # SHA256 of this + previous log
      previous_hash = Column(String)  # Hash of previous log (chain)
      ip_address = Column(String)
      created_at = Column(DateTime, default=datetime.utcnow, index=True)
      
      __table_args__ = (
          Index('idx_created_at', 'created_at'),
          Index('idx_resource', 'resource_type', 'resource_id'),
      )
  
  def create_immutable_log(event_type: str, user_id: str, resource_type: str,
                          resource_id: str, new_value: dict, old_value: dict = None):
      # Get previous log hash
      previous_log = db.query(RegulatoryAuditLog).order_by(
          RegulatoryAuditLog.created_at.desc()
      ).first()
      previous_hash = previous_log.hash_value if previous_log else "0"
      
      # Create this log entry
      log = RegulatoryAuditLog(
          id=str(uuid.uuid4()),
          event_type=event_type,
          user_id=user_id,
          resource_type=resource_type,
          resource_id=resource_id,
          old_value=old_value,
          new_value=new_value,
          ip_address=request.client.host,
          previous_hash=previous_hash
      )
      
      # Calculate hash (chain-of-custody proof)
      log_str = f"{log.id}{log.event_type}{log.user_id}{log.resource_type}{previous_hash}"
      log.hash_value = hashlib.sha256(log_str.encode()).hexdigest()
      
      db.add(log)
      db.commit()
      
      return log
  
  # Verify audit trail integrity
  def verify_audit_trail_integrity():
      logs = db.query(RegulatoryAuditLog).order_by(
          RegulatoryAuditLog.created_at.asc()
      ).all()
      
      previous_hash = "0"
      for log in logs:
          log_str = f"{log.id}{log.event_type}{log.user_id}{log.resource_type}{previous_hash}"
          expected_hash = hashlib.sha256(log_str.encode()).hexdigest()
          
          if log.hash_value != expected_hash:
              raise IntegrityError(f"Audit log {log.id} has been tampered with!")
          
          previous_hash = log.hash_value
      
      return True
  ```
- **Effort**: 4 hours
- **Phase**: 2
- **Status**: ❌ NOT FIXED

### CI/CD (2 P1 gaps)

#### C1: No CI Pipeline
- **Current State**: No GitHub Actions
- **Requirement**: Automated lint, test, security scan, build
- **Implementation**:
  ```yaml
  # .github/workflows/ci.yml
  name: CI Pipeline
  
  on: [push, pull_request]
  
  jobs:
    backend:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        
        - name: Set up Python
          uses: actions/setup-python@v4
          with:
            python-version: '3.12'
        
        - name: Install dependencies
          run: |
            cd backend
            pip install -r requirements.txt
        
        - name: Lint (pylint)
          run: cd backend && pylint app/
        
        - name: Type check (mypy)
          run: cd backend && mypy app/
        
        - name: Test
          run: cd backend && pytest tests/ -v --cov=app
        
        - name: Security scan (Bandit)
          run: cd backend && bandit -r app/
        
        - name: Build
          run: cd backend && python setup.py build
    
    frontend:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        
        - name: Set up Node
          uses: actions/setup-node@v3
          with:
            node-version: '18'
        
        - name: Install dependencies
          run: cd frontend && npm install
        
        - name: Lint
          run: cd frontend && npm run lint
        
        - name: Type check
          run: cd frontend && npm run type-check
        
        - name: Build
          run: cd frontend && npm run build
        
        - name: Test
          run: cd frontend && npm run test
  ```
- **Effort**: 3 hours
- **Phase**: 2
- **Status**: ❌ NOT FIXED

#### V1: No Peer Review Process
- **Current State**: Single developer, no reviews
- **Requirement**: All PRs require 2 approvals (1 dev + 1 security)
- **Implementation**:
  - GitHub branch protection rules
  - Require pull request reviews before merging
  - Require status checks to pass
  - Require conversation resolution
  - Dismiss stale reviews
- **GitHub Settings**:
  ```
  Repository Settings → Branches → main
  ✓ Require pull request reviews before merging
    - Require at least 2 approving reviews
    - Require review from code owners (if CODEOWNERS exists)
    - Dismiss stale pull request approvals
  ✓ Require status checks to pass before merging
  ✓ Require branches to be up to date before merging
  ```
- **CODEOWNERS file**:
  ```
  # /CODEOWNERS
  /backend/app/api/auth.py @security-team
  /backend/app/api/compliance*.py @compliance-officer
  /backend/app/models/ @backend-lead
  /frontend/src/ @frontend-lead
  ```
- **Effort**: 1 hour
- **Phase**: 2
- **Status**: ❌ NOT FIXED

---

## 🟡 P2 HIGH — 12 Items (Must Fix Before Go-Live)

### SECURITY (2 P2 gaps)

#### S4: No MFA/2FA
- **Current State**: Single-factor password only
- **Requirement**: TOTP/SMS OTP for all users, mandatory for admin/compliance
- **Implementation**:
  ```python
  from pyotp import TOTP
  from twilio.rest import Client
  
  class MFAService:
      def enable_totp(self, user_id: str):
          secret = pyotp.random_base32()
          totp = TOTP(secret)
          
          user = db.query(User).filter_by(id=user_id).first()
          user.totp_secret = secret
          user.mfa_enabled = True
          db.commit()
          
          # Return QR code for scanning
          uri = totp.provisioning_uri(
              name=user.email,
              issuer_name='EnRIMS'
          )
          qr_code = qrcode.make(uri)
          return qr_code
      
      def verify_totp(self, user_id: str, token: str):
          user = db.query(User).filter_by(id=user_id).first()
          totp = TOTP(user.totp_secret)
          return totp.verify(token)
      
      def send_sms_otp(self, phone: str):
          otp = str(random.randint(100000, 999999))
          twilio_client = Client(
              os.getenv('TWILIO_ACCOUNT_SID'),
              os.getenv('TWILIO_AUTH_TOKEN')
          )
          twilio_client.messages.create(
              body=f"Your OTP is {otp}",
              from_=os.getenv('TWILIO_PHONE_NUMBER'),
              to=phone
          )
          # Store OTP temporarily (Redis with 5 min expiry)
          cache.set(f"otp:{phone}", otp, ex=300)
          return True
  
  @router.post("/auth/mfa/enable-totp")
  async def enable_mfa(current_user: User = Depends(get_current_user)):
      qr_code = MFAService().enable_totp(current_user.id)
      return {"qr_code": qr_code}
  
  @router.post("/auth/verify-otp")
  async def verify_otp(email: str, otp: str):
      user = db.query(User).filter_by(email=email).first()
      if MFAService().verify_totp(user.id, otp):
          token = create_access_token({"sub": user.id})
          return {"access_token": token, "token_type": "bearer"}
      raise HTTPException(401, "Invalid OTP")
  ```
- **Effort**: 4 hours
- **Phase**: 3
- **Status**: ❌ NOT FIXED

#### S10: No API Key Management
- **Current State**: No external API auth
- **Requirement**: API keys for integration endpoints, OAuth2 for third-party
- **Implementation**:
  ```python
  class APIKey(Base):
      __tablename__ = "api_keys"
      id = Column(String, primary_key=True)
      name = Column(String)
      key = Column(String, unique=True, index=True)
      secret = Column(String)  # Hashed
      permissions = Column(JSON)  # [\"read:alerts\", \"write:cases\"]
      created_by = Column(String, ForeignKey("users.id"))
      created_at = Column(DateTime, default=datetime.utcnow)
      last_used_at = Column(DateTime)
      is_active = Column(Boolean, default=True)
  
  def create_api_key(name: str, permissions: list, user_id: str):
      key = secrets.token_urlsafe(32)
      secret = secrets.token_urlsafe(32)
      secret_hash = hashlib.sha256(secret.encode()).hexdigest()
      
      api_key = APIKey(
          id=str(uuid.uuid4()),
          name=name,
          key=key,
          secret=secret_hash,
          permissions=permissions,
          created_by=user_id
      )
      db.add(api_key)
      db.commit()
      
      # Return secret only once (can't recover if lost)
      return {"key": key, "secret": secret}
  
  def verify_api_key(key: str, secret: str):
      api_key = db.query(APIKey).filter_by(key=key, is_active=True).first()
      if not api_key:
          return None
      
      secret_hash = hashlib.sha256(secret.encode()).hexdigest()
      if api_key.secret != secret_hash:
          return None
      
      api_key.last_used_at = datetime.utcnow()
      db.commit()
      
      return api_key
  
  @router.get("/api/v1/alerts")
  async def list_alerts(authorization: str = Header(...)):
      # Parse "Bearer <key>:<secret>"
      try:
          scheme, credentials = authorization.split()
          if scheme != "Bearer":
              raise HTTPException(401)
          key, secret = credentials.split(":")
          api_key = verify_api_key(key, secret)
          if not api_key:
              raise HTTPException(401)
      except:
          raise HTTPException(401)
      
      # Check permissions
      if "read:alerts" not in api_key.permissions:
          raise HTTPException(403)
      
      # Return alerts
      ...
  ```
- **Effort**: 3 hours
- **Phase**: 4
- **Status**: ❌ NOT FIXED

### DATA PROTECTION (3 P2 gaps)

#### D5: No Data Classification
- **Current State**: No labels on fields
- **Requirement**: Classify fields (Public, Internal, Confidential, Restricted)
- **Implementation**:
  ```python
  from enum import Enum
  
  class DataClassification(str, Enum):
      PUBLIC = "public"
      INTERNAL = "internal"
      CONFIDENTIAL = "confidential"
      RESTRICTED = "restricted"
  
  # Add to models
  class Customer(Base):
      # Public fields
      id = Column(String, primary_key=True)  # PUBLIC
      customer_number = Column(String)  # PUBLIC
      full_name = Column(String)  # INTERNAL
      
      # Confidential fields
      email = Column(String)  # CONFIDENTIAL
      phone = Column(String)  # CONFIDENTIAL
      
      # Restricted fields
      pan_number = Column(String)  # RESTRICTED
      aadhaar_number = Column(String)  # RESTRICTED
      annual_income = Column(Integer)  # RESTRICTED
  
  # Enforce in serializers
  def get_customer_response(user_role: str):
      if user_role == "public_api":
          return {"id", "customer_number"}  # PUBLIC only
      elif user_role == "analyst":
          return {"id", "customer_number", "full_name", "email", "phone"}  # PUBLIC + INTERNAL + CONFIDENTIAL
      elif user_role == "compliance":
          return all_fields  # RESTRICTED allowed
  ```
- **Effort**: 2 hours
- **Phase**: 4
- **Status**: ❌ NOT FIXED

#### D6: No Consent Management
- **Current State**: No customer consent tracking
- **Requirement**: DPDP Act 2023 compliance (consent for data processing)
- **Implementation**:
  ```python
  class DataProcessingConsent(Base):
      __tablename__ = "data_processing_consents"
      id = Column(String, primary_key=True)
      customer_id = Column(String, ForeignKey("customers.id"))
      consent_type = Column(String)  # kycprocessing, aml_monitoring, marketing
      given_at = Column(DateTime)
      given_by = Column(String)  # manual, automated
      channel = Column(String)  # web, mobile, in_person
      ip_address = Column(String)
      consent_text_version = Column(String)  # Track version
      is_revoked = Column(Boolean, default=False)
      revoked_at = Column(DateTime, nullable=True)
  
  @router.post("/customers/{id}/consent")
  async def give_consent(customer_id: str, consent_type: str):
      consent = DataProcessingConsent(
          id=str(uuid.uuid4()),
          customer_id=customer_id,
          consent_type=consent_type,
          given_at=datetime.utcnow(),
          channel="web",
          ip_address=request.client.host
      )
      db.add(consent)
      db.commit()
      
      # Log for audit
      create_immutable_log(
          event_type="consent_given",
          resource_type="customer",
          resource_id=customer_id,
          new_value={"consent_type": consent_type}
      )
  
  def has_consent(customer_id: str, consent_type: str):
      consent = db.query(DataProcessingConsent).filter(
          DataProcessingConsent.customer_id == customer_id,
          DataProcessingConsent.consent_type == consent_type,
          DataProcessingConsent.is_revoked == False
      ).first()
      return consent is not None
  ```
- **Effort**: 3 hours
- **Phase**: 4
- **Status**: ❌ NOT FIXED

### INFRASTRUCTURE (2 P2 gaps)

#### I5: No Containerization
- **Current State**: Direct Python execution
- **Requirement**: Docker containers with Kubernetes/ECS orchestration
- **Implementation**:
  ```dockerfile
  # backend/Dockerfile
  FROM python:3.12-slim
  
  WORKDIR /app
  
  # Dependencies
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  
  # Code
  COPY app/ ./app/
  COPY main.py .
  
  # Health check
  HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"
  
  EXPOSE 8000
  CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```
  ```dockerfile
  # frontend/Dockerfile
  FROM node:18-alpine as build
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build
  
  FROM nginx:alpine
  COPY --from=build /app/dist /usr/share/nginx/html
  COPY nginx.conf /etc/nginx/nginx.conf
  EXPOSE 80
  CMD ["nginx", "-g", "daemon off;"]
  ```
  ```yaml
  # docker-compose.yml
  version: '3.8'
  
  services:
    backend:
      build: ./backend
      ports:
        - "8000:8000"
      environment:
        DATABASE_URL: postgresql://user:pass@db:5432/enrims
      depends_on:
        - db
    
    frontend:
      build: ./frontend
      ports:
        - "3000:80"
    
    db:
      image: postgres:15
      environment:
        POSTGRES_USER: user
        POSTGRES_PASSWORD: pass
        POSTGRES_DB: enrims
      volumes:
        - postgres_data:/var/lib/postgresql/data
  
  volumes:
    postgres_data:
  ```
- **Effort**: 6 hours
- **Phase**: 3
- **Status**: ❌ NOT FIXED

### MONITORING (2 P2 gaps)

#### M4: No APM
- **Current State**: No tracing
- **Requirement**: OpenTelemetry distributed tracing
- **Implementation**:
  ```python
  from opentelemetry import trace, metrics
  from opentelemetry.exporter.jaeger.thrift import JaegerExporter
  from opentelemetry.sdk.trace import TracerProvider
  from opentelemetry.sdk.trace.export import BatchSpanProcessor
  
  jaeger_exporter = JaegerExporter(agent_host_name="localhost")
  trace.set_tracer_provider(TracerProvider())
  trace.get_tracer_provider().add_span_processor(
      BatchSpanProcessor(jaeger_exporter)
  )
  
  tracer = trace.get_tracer(__name__)
  
  @router.get("/alerts/{id}")
  async def get_alert(id: str):
      with tracer.start_as_current_span("get_alert") as span:
          span.set_attribute("alert_id", id)
          
          with tracer.start_as_current_span("db_query"):
              alert = db.query(Alert).filter_by(id=id).first()
          
          with tracer.start_as_current_span("format_response"):
              return _alert_response(alert, db)
  ```
- **Effort**: 4 hours
- **Phase**: 3
- **Status**: ❌ NOT FIXED

#### M5: Health Check Superficial
- **Current State**: Returns static `{"status":"healthy"}`
- **Requirement**: Check DB, disk, memory, queue depth
- **Implementation**:
  ```python
  @router.get("/health")
  async def health_check():
      health = {"status": "healthy", "checks": {}}
      
      # Database check
      try:
          db.execute(text("SELECT 1"))
          health["checks"]["database"] = {"status": "healthy"}
      except Exception as e:
          health["checks"]["database"] = {"status": "unhealthy", "error": str(e)}
          health["status"] = "unhealthy"
      
      # Disk space check
      disk = shutil.disk_usage("/")
      disk_usage_pct = (disk.used / disk.total) * 100
      if disk_usage_pct > 90:
          health["checks"]["disk"] = {"status": "unhealthy", "usage_pct": disk_usage_pct}
          health["status"] = "unhealthy"
      else:
          health["checks"]["disk"] = {"status": "healthy", "usage_pct": disk_usage_pct}
      
      # Memory check
      import psutil
      memory = psutil.virtual_memory()
      if memory.percent > 85:
          health["checks"]["memory"] = {"status": "unhealthy", "usage_pct": memory.percent}
          health["status"] = "unhealthy"
      else:
          health["checks"]["memory"] = {"status": "healthy", "usage_pct": memory.percent}
      
      # Cache/queue check
      try:
          cache.get("health_check_key")
          health["checks"]["cache"] = {"status": "healthy"}
      except:
          health["checks"]["cache"] = {"status": "unhealthy"}
          health["status"] = "unhealthy"
      
      status_code = 200 if health["status"] == "healthy" else 503
      return JSONResponse(content=health, status_code=status_code)
  ```
- **Effort**: 1 hour
- **Phase**: 3
- **Status**: ❌ NOT FIXED

### TESTING (1 P2 gap)

#### T5: No Load Testing
- **Current State**: No performance baseline
- **Requirement**: Locust/k6: 1000 concurrent users, <200ms p95 response time
- **Implementation**:
  ```python
  # locustfile.py
  from locust import HttpUser, task, between
  
  class APIUser(HttpUser):
      wait_time = between(1, 3)
      
      @task(1)
      def list_alerts(self):
          self.client.get("/api/v1/alerts")
      
      @task(2)
      def get_alert(self):
          self.client.get(f"/api/v1/alerts/alert-{random.randint(1, 1000)}")
      
      @task(1)
      def create_case(self):
          self.client.post(
              "/api/v1/cases",
              json={"title": "Load test case", "customer_id": "cif-1001"}
          )
  
  # Run:
  # locust -f locustfile.py --host=http://localhost:8000 --users 1000 --spawn-rate 100
  ```
  ```bash
  # k6 alternative
  # load-test.js
  import http from 'k6/http';
  import { check } from 'k6';
  
  export let options = {
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 1000 },
      { duration: '2m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<200', 'p(99)<500'],
    },
  };
  
  export default function() {
    let res = http.get('http://localhost:8000/api/v1/alerts');
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 200ms': (r) => r.timings.duration < 200,
    });
  }
  
  // Run:
  // k6 run load-test.js
  ```
- **Success Criteria**:
  - p95 latency < 200ms
  - p99 latency < 500ms
  - Error rate < 0.1%
  - Database connections stay under 50
- **Effort**: 5 hours
- **Phase**: 4
- **Status**: ❌ NOT FIXED

### CI/CD (2 P2 gaps)

#### C2: No CD Pipeline
- **Current State**: Manual Render/Netlify deploy
- **Requirement**: Automated staging→production with approval gates
- **Implementation**:
  ```yaml
  # .github/workflows/deploy.yml
  name: Deploy
  
  on:
    push:
      branches: [main]
  
  jobs:
    deploy-staging:
      runs-on: ubuntu-latest
      if: github.event_name == 'push'
      steps:
        - uses: actions/checkout@v3
        - name: Deploy to staging
          run: |
            # Build and push Docker image
            docker build -t enrims-backend:${{ github.sha }} .
            docker tag enrims-backend:${{ github.sha }} enrims-backend:latest
            docker push enrims-backend:${{ github.sha }}
            
            # Deploy to staging cluster
            kubectl set image deployment/enrims-backend \
              enrims-backend=enrims-backend:${{ github.sha }} \
              --namespace=staging
    
    approval:
      needs: deploy-staging
      runs-on: ubuntu-latest
      environment:
        name: production
      steps:
        - name: Wait for approval
          run: echo "Deployment requires manual approval"
    
    deploy-production:
      needs: approval
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - name: Deploy to production
          run: |
            kubectl set image deployment/enrims-backend \
              enrims-backend=enrims-backend:${{ github.sha }} \
              --namespace=production
        
        - name: Smoke test
          run: |
            curl -f http://enrims-api.bank.example.com/health || exit 1
  ```
- **Effort**: 3 hours
- **Phase**: 4
- **Status**: ❌ NOT FIXED

#### C3: No Infrastructure as Code
- **Current State**: Manual setup
- **Requirement**: Terraform/Pulumi for reproducible infrastructure
- **Implementation**:
  ```hcl
  # terraform/main.tf
  terraform {
    required_providers {
      aws = {
        source = "hashicorp/aws"
        version = "~> 5.0"
      }
    }
    backend "s3" {
      bucket = "enrims-terraform-state"
      key    = "prod/terraform.tfstate"
      region = "ap-south-1"
    }
  }
  
  provider "aws" {
    region = "ap-south-1"
  }
  
  # RDS PostgreSQL
  resource "aws_db_instance" "enrims" {
    identifier     = "enrims-db"
    engine         = "postgres"
    engine_version = "15.3"
    instance_class = "db.t3.medium"
    allocated_storage = 100
    storage_type   = "gp3"
    
    db_name  = "enrims"
    username = "dbadmin"
    password = random_password.db_password.result
    
    backup_retention_period = 30
    backup_window = "02:00-03:00"
    multi_az = true
    
    skip_final_snapshot = false
    final_snapshot_identifier = "enrims-snapshot-${formatdate("YYYYMMDD", timestamp())}"
  }
  
  # ECS Cluster
  resource "aws_ecs_cluster" "enrims" {
    name = "enrims-cluster"
  }
  
  resource "aws_ecs_service" "backend" {
    name            = "enrims-backend"
    cluster         = aws_ecs_cluster.enrims.id
    task_definition = aws_ecs_task_definition.backend.arn
    desired_count   = 3
    launch_type     = "FARGATE"
  }
  ```
- **Effort**: 4 hours
- **Phase**: 4
- **Status**: ❌ NOT FIXED

---

## Summary Table: All 47 Gaps

| Severity | Category | Count | Complete | Partial | Not Started |
|----------|----------|-------|----------|---------|-------------|
| **P0** | Security | 5 | 0 | 0 | 5 |
| **P0** | Data Protection | 2 | 0 | 0 | 2 |
| **P0** | Infrastructure | 3 | 0 | 0 | 3 |
| **P0** | Testing | 1 | 0 | 1 | 0 |
| **P0 TOTAL** | — | **11** | **0** | **1** | **10** |
| **P1** | Security | 4 | 0 | 0 | 4 |
| **P1** | Data Protection | 3 | 0 | 1 | 2 |
| **P1** | Infrastructure | 3 | 0 | 0 | 3 |
| **P1** | Monitoring | 2 | 0 | 0 | 2 |
| **P1** | Testing | 3 | 1 | 0 | 2 |
| **P1** | Regulatory | 3 | 0 | 0 | 3 |
| **P1** | CI/CD | 2 | 0 | 0 | 2 |
| **P1 TOTAL** | — | **19** | **1** | **1** | **17** |
| **P2** | Security | 2 | 0 | 0 | 2 |
| **P2** | Data Protection | 3 | 0 | 0 | 3 |
| **P2** | Infrastructure | 2 | 0 | 0 | 2 |
| **P2** | Monitoring | 2 | 0 | 0 | 2 |
| **P2** | Testing | 1 | 0 | 0 | 1 |
| **P2** | CI/CD | 2 | 0 | 0 | 2 |
| **P2 TOTAL** | — | **12** | **0** | **0** | **12** |
| **GRAND TOTAL** | — | **47** | **1** | **2** | **43** |

