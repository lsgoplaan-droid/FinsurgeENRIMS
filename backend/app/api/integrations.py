"""
Integration management endpoints.
Shows connected data sources, real-time triggers, and batch import status.
In production these would reflect actual CBS/switch connections.
For the demo, they return realistic simulated statuses.
"""
import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/integrations", tags=["Integrations"])

NOW = datetime.utcnow()


@router.get("/sources")
def get_data_sources(current_user: User = Depends(get_current_user)):
    """Returns all configured data source integrations."""
    return [
        {
            "id": "cbs-finacle",
            "name": "Core Banking System (Finacle)",
            "type": "real_time",
            "protocol": "REST API",
            "status": "connected",
            "host": "cbs-primary.bank.internal:8443",
            "description": "Primary CBS integration for account and customer data sync",
            "data_types": ["customers", "accounts", "balances"],
            "last_heartbeat": (NOW - timedelta(seconds=random.randint(5, 30))).isoformat(),
            "uptime_percent": 99.97,
            "records_today": random.randint(12000, 18000),
            "avg_latency_ms": random.randint(12, 45),
            "enabled": True,
        },
        {
            "id": "txn-switch",
            "name": "Transaction Switch",
            "type": "real_time",
            "protocol": "Kafka",
            "status": "connected",
            "host": "kafka-cluster.bank.internal:9092",
            "description": "Real-time transaction feed from all banking channels",
            "data_types": ["transactions"],
            "last_heartbeat": (NOW - timedelta(seconds=random.randint(1, 10))).isoformat(),
            "uptime_percent": 99.99,
            "records_today": random.randint(45000, 85000),
            "avg_latency_ms": random.randint(3, 15),
            "enabled": True,
        },
        {
            "id": "card-mgmt",
            "name": "Card Management System",
            "type": "real_time",
            "protocol": "ISO 8583 / REST",
            "status": "connected",
            "host": "cards.bank.internal:7080",
            "description": "Credit/debit card transaction authorization and alerts",
            "data_types": ["card_transactions", "card_alerts"],
            "last_heartbeat": (NOW - timedelta(seconds=random.randint(2, 20))).isoformat(),
            "uptime_percent": 99.95,
            "records_today": random.randint(22000, 40000),
            "avg_latency_ms": random.randint(8, 25),
            "enabled": True,
        },
        {
            "id": "swift-gw",
            "name": "SWIFT Gateway",
            "type": "real_time",
            "protocol": "MQ / FIN",
            "status": "connected",
            "host": "swift-gw.bank.internal:1414",
            "description": "International wire transfers via SWIFT network",
            "data_types": ["swift_messages", "wire_transfers"],
            "last_heartbeat": (NOW - timedelta(seconds=random.randint(10, 60))).isoformat(),
            "uptime_percent": 99.92,
            "records_today": random.randint(800, 2500),
            "avg_latency_ms": random.randint(50, 150),
            "enabled": True,
        },
        {
            "id": "rtgs-neft",
            "name": "RTGS / NEFT / IMPS Gateway",
            "type": "real_time",
            "protocol": "SFMS API",
            "status": "connected",
            "host": "payments.bank.internal:9443",
            "description": "Domestic payment systems — RBI regulated channels",
            "data_types": ["rtgs_transfers", "neft_transfers", "imps_transfers"],
            "last_heartbeat": (NOW - timedelta(seconds=random.randint(3, 15))).isoformat(),
            "uptime_percent": 99.98,
            "records_today": random.randint(15000, 35000),
            "avg_latency_ms": random.randint(10, 30),
            "enabled": True,
        },
        {
            "id": "internet-banking",
            "name": "Internet Banking Platform",
            "type": "real_time",
            "protocol": "REST API / WebSocket",
            "status": "connected",
            "host": "ibanking.bank.internal:443",
            "description": "Online banking sessions, logins, and transaction events",
            "data_types": ["login_events", "session_data", "transactions"],
            "last_heartbeat": (NOW - timedelta(seconds=random.randint(1, 8))).isoformat(),
            "uptime_percent": 99.96,
            "records_today": random.randint(30000, 55000),
            "avg_latency_ms": random.randint(5, 20),
            "enabled": True,
        },
        {
            "id": "mobile-banking",
            "name": "Mobile Banking App",
            "type": "real_time",
            "protocol": "REST API",
            "status": "connected",
            "host": "mbanking-api.bank.internal:443",
            "description": "UPI, mobile transactions, device fingerprints",
            "data_types": ["upi_transactions", "device_data", "login_events"],
            "last_heartbeat": (NOW - timedelta(seconds=random.randint(1, 5))).isoformat(),
            "uptime_percent": 99.94,
            "records_today": random.randint(60000, 120000),
            "avg_latency_ms": random.randint(8, 22),
            "enabled": True,
        },
        {
            "id": "atm-switch",
            "name": "ATM Network Switch",
            "type": "real_time",
            "protocol": "NDC/DDC / REST",
            "status": "connected",
            "host": "atm-switch.bank.internal:6100",
            "description": "ATM withdrawals, deposits, and balance inquiries",
            "data_types": ["atm_transactions", "atm_alerts"],
            "last_heartbeat": (NOW - timedelta(seconds=random.randint(5, 25))).isoformat(),
            "uptime_percent": 99.91,
            "records_today": random.randint(18000, 30000),
            "avg_latency_ms": random.randint(15, 40),
            "enabled": True,
        },
        {
            "id": "ofac-sdn",
            "name": "OFAC SDN List",
            "type": "batch",
            "protocol": "HTTPS Download",
            "status": "synced",
            "host": "https://sanctionslist.ofac.treas.gov",
            "description": "US Treasury OFAC Specially Designated Nationals list",
            "data_types": ["watchlist_entries"],
            "last_sync": (NOW - timedelta(hours=random.randint(2, 18))).isoformat(),
            "next_sync": (NOW + timedelta(hours=random.randint(6, 12))).isoformat(),
            "records_synced": 12847,
            "sync_frequency": "Every 6 hours",
            "enabled": True,
        },
        {
            "id": "un-sanctions",
            "name": "UN Consolidated Sanctions List",
            "type": "batch",
            "protocol": "HTTPS / XML",
            "status": "synced",
            "host": "https://scsanctions.un.org",
            "description": "United Nations Security Council consolidated sanctions list",
            "data_types": ["watchlist_entries"],
            "last_sync": (NOW - timedelta(hours=random.randint(3, 20))).isoformat(),
            "next_sync": (NOW + timedelta(hours=random.randint(4, 10))).isoformat(),
            "records_synced": 8234,
            "sync_frequency": "Every 12 hours",
            "enabled": True,
        },
        {
            "id": "pep-worldcheck",
            "name": "PEP Database (World-Check)",
            "type": "batch",
            "protocol": "SFTP",
            "status": "synced",
            "host": "sftp.worldcheck.refinitiv.com",
            "description": "Politically Exposed Persons screening database",
            "data_types": ["pep_entries", "adverse_media"],
            "last_sync": (NOW - timedelta(hours=random.randint(1, 10))).isoformat(),
            "next_sync": (NOW + timedelta(hours=random.randint(12, 22))).isoformat(),
            "records_synced": 2145678,
            "sync_frequency": "Daily at 02:00 IST",
            "enabled": True,
        },
        {
            "id": "india-mha",
            "name": "India MHA Watchlist",
            "type": "batch",
            "protocol": "Secure API",
            "status": "synced",
            "host": "api.mha.gov.in (restricted)",
            "description": "Ministry of Home Affairs designated entities list",
            "data_types": ["watchlist_entries"],
            "last_sync": (NOW - timedelta(hours=random.randint(5, 24))).isoformat(),
            "next_sync": (NOW + timedelta(hours=random.randint(20, 40))).isoformat(),
            "records_synced": 4521,
            "sync_frequency": "Daily at 01:00 IST",
            "enabled": True,
        },
        {
            "id": "ckyc-registry",
            "name": "CKYC Registry (CERSAI)",
            "type": "batch",
            "protocol": "REST API",
            "status": "synced",
            "host": "https://ckyc.cersai.org.in",
            "description": "Central KYC Registry for customer identity verification",
            "data_types": ["kyc_records", "identity_data"],
            "last_sync": (NOW - timedelta(hours=random.randint(4, 16))).isoformat(),
            "next_sync": (NOW + timedelta(hours=random.randint(6, 14))).isoformat(),
            "records_synced": 892345,
            "sync_frequency": "Every 8 hours",
            "enabled": True,
        },
        {
            "id": "fiu-ind",
            "name": "FIU-IND Reporting Gateway",
            "type": "outbound",
            "protocol": "Secure XML / SFTP",
            "status": "connected",
            "host": "https://fiuindia.gov.in/secure",
            "description": "Financial Intelligence Unit — CTR/STR filing submission",
            "data_types": ["ctr_reports", "str_reports"],
            "last_submission": (NOW - timedelta(days=random.randint(1, 5))).isoformat(),
            "reports_filed_mtd": random.randint(15, 45),
            "sync_frequency": "On-demand + Daily batch",
            "enabled": True,
        },
    ]


@router.get("/batches")
def get_batch_jobs(current_user: User = Depends(get_current_user)):
    """Returns recent batch import job history."""
    jobs = []
    job_types = [
        ("OFAC SDN List Sync", "ofac-sdn", "watchlist"),
        ("UN Sanctions List Sync", "un-sanctions", "watchlist"),
        ("PEP Database Update", "pep-worldcheck", "watchlist"),
        ("India MHA Watchlist Sync", "india-mha", "watchlist"),
        ("CKYC Registry Sync", "ckyc-registry", "kyc"),
        ("Daily Transaction Reconciliation", "cbs-finacle", "reconciliation"),
        ("End-of-Day Account Balance Sync", "cbs-finacle", "accounts"),
        ("FIU-IND CTR Batch Filing", "fiu-ind", "reporting"),
        ("Dormant Account Scan", "cbs-finacle", "compliance"),
        ("KYC Expiry Review Trigger", "ckyc-registry", "kyc"),
    ]

    for i in range(25):
        jtype = job_types[i % len(job_types)]
        hours_ago = i * random.randint(3, 8)
        started = NOW - timedelta(hours=hours_ago)
        duration = random.randint(15, 600)
        status = "completed" if random.random() < 0.88 else ("failed" if random.random() < 0.5 else "running" if i == 0 else "completed")
        records = random.randint(500, 250000) if status == "completed" else (0 if status == "failed" else random.randint(100, 50000))

        jobs.append({
            "id": f"JOB-{(started).strftime('%Y%m%d')}-{1000+i:04d}",
            "name": jtype[0],
            "source_id": jtype[1],
            "category": jtype[2],
            "status": status,
            "started_at": started.isoformat(),
            "completed_at": (started + timedelta(seconds=duration)).isoformat() if status != "running" else None,
            "duration_seconds": duration if status != "running" else None,
            "records_processed": records,
            "records_failed": random.randint(0, 5) if status == "completed" else (records if status == "failed" else 0),
            "error_message": "Connection timeout: SFTP server unreachable" if status == "failed" else None,
        })

    return jobs


@router.get("/stats")
def get_integration_stats(current_user: User = Depends(get_current_user)):
    """Aggregated integration health metrics."""
    return {
        "total_sources": 14,
        "real_time_connected": 8,
        "batch_synced": 5,
        "outbound_connected": 1,
        "total_records_today": random.randint(200000, 400000),
        "avg_latency_ms": random.randint(15, 35),
        "overall_uptime": 99.96,
        "failed_jobs_24h": random.randint(0, 2),
        "pending_jobs": random.randint(0, 1),
    }
