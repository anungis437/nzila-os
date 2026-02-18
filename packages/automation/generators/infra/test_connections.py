#!/usr/bin/env python3
"""Test source and target DB connections for data migration."""
import sys
try:
    import psycopg2
except ImportError:
    print("Installing psycopg2-binary...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary", "-q"])
    import psycopg2


def test_connection(label, params):
    """Test a single DB connection and report table count."""
    print(f"\n{'='*60}")
    print(f"Testing: {label}")
    print(f"  Host: {params['host']}")
    print(f"  Port: {params.get('port', 5432)}")
    print(f"  DB:   {params['dbname']}")
    print(f"  User: {params['user']}")
    print(f"  SSL:  {params.get('sslmode', 'prefer')}")
    print("-" * 60)
    
    try:
        conn = psycopg2.connect(
            host=params['host'],
            port=params.get('port', 5432),
            dbname=params['dbname'],
            user=params['user'],
            password=params['password'],
            sslmode=params.get('sslmode', 'prefer'),
            connect_timeout=15,
        )
        cur = conn.cursor()
        
        # Get PostgreSQL version
        cur.execute("SELECT version();")
        version = cur.fetchone()[0]
        print(f"  Connected! Version: {version[:60]}...")
        
        # Count tables in public schema
        cur.execute("""
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
        """)
        table_count = cur.fetchone()[0]
        print(f"  Public tables: {table_count}")
        
        # Sample some table names
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name LIMIT 10;
        """)
        tables = [r[0] for r in cur.fetchall()]
        print(f"  Sample tables: {', '.join(tables)}")
        
        # Check total row count for a few tables
        total_rows = 0
        for t in tables[:3]:
            try:
                cur.execute(f'SELECT COUNT(*) FROM "{t}";')
                rows = cur.fetchone()[0]
                total_rows += rows
                print(f"    {t}: {rows:,} rows")
            except Exception as e:
                print(f"    {t}: ERROR - {e}")
                conn.rollback()
        
        cur.close()
        conn.close()
        print(f"  STATUS: SUCCESS")
        return True
        
    except Exception as e:
        print(f"  STATUS: FAILED")
        print(f"  Error: {e}")
        return False


if __name__ == "__main__":
    results = {}
    
    # -----------------------------------------------------------------------
    # 1. ABR Source (Supabase)
    # -----------------------------------------------------------------------
    results["ABR Source (Supabase)"] = test_connection("ABR Source (Supabase)", {
        "host": "aws-1-ca-central-1.pooler.supabase.com",
        "port": 5432,
        "dbname": "postgres",
        "user": "postgres.zdcmugkafbczvxcyofiz",
        "password": "@Cehyjygj001",
        "sslmode": "require",
    })
    
    # -----------------------------------------------------------------------
    # 2. UE Source (Azure PostgreSQL)
    # -----------------------------------------------------------------------
    results["UE Source (Azure)"] = test_connection("UE Source (Azure PostgreSQL)", {
        "host": "unioneyes-staging-db.postgres.database.azure.com",
        "port": 5432,
        "dbname": "unioneyes",
        "user": "unionadmin",
        "password": "Nzila2026!UeStaging#Migr8",
        "sslmode": "require",
    })
    
    # -----------------------------------------------------------------------
    # 3. ABR Target (Local)
    # -----------------------------------------------------------------------
    results["ABR Target (Local)"] = test_connection("ABR Target (Local)", {
        "host": "localhost",
        "port": 5432,
        "dbname": "nzila_abr_insights",
        "user": "postgres",
        "password": "postgres",
    })
    
    # -----------------------------------------------------------------------
    # 4. UE Target (Local)
    # -----------------------------------------------------------------------
    results["UE Target (Local)"] = test_connection("UE Target (Local)", {
        "host": "localhost",
        "port": 5432,
        "dbname": "nzila_union_eyes",
        "user": "postgres",
        "password": "postgres",
    })
    
    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    print(f"\n{'='*60}")
    print("CONNECTION TEST SUMMARY")
    print("=" * 60)
    for label, ok in results.items():
        status = "PASS" if ok else "FAIL"
        icon = "✓" if ok else "✗"
        print(f"  {icon} {label}: {status}")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    print(f"\n  {passed}/{total} connections successful")
    
    if passed < total:
        sys.exit(1)
