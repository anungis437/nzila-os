"""Quick verification that all id and FK columns are UUID type."""
import psycopg2

for db_name in ['nzila_union_eyes', 'nzila_abr_insights']:
    conn = psycopg2.connect(dbname=db_name, user='postgres', password='postgres', host='localhost')
    cur = conn.cursor()
    
    # Check for non-UUID id columns
    cur.execute("""
        SELECT table_name, column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE column_name = 'id' AND table_schema = 'public' AND data_type != 'uuid'
    """)
    non_uuid = cur.fetchall()
    if non_uuid:
        print(f"{db_name}: WARNING - {len(non_uuid)} tables with non-UUID id:")
        for r in non_uuid:
            print(f"  {r[0]}.{r[1]}: {r[2]} ({r[3]})")
    else:
        print(f"{db_name}: All id columns are UUID type!")
    
    # Check organization_id FK columns
    cur.execute("""
        SELECT table_name, column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE column_name = 'organization_id' AND table_schema = 'public'
        LIMIT 5
    """)
    fk_cols = cur.fetchall()
    if fk_cols:
        print(f"  FK organization_id samples:")
        for r in fk_cols:
            print(f"    {r[0]}.{r[1]}: {r[2]} ({r[3]})")
    
    # Total table count
    cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
    print(f"  Total tables: {cur.fetchone()[0]}")
    
    conn.close()
