"""
Create CloudFront key group for Zonga signed URLs and attach it to the distribution.

Steps:
1. Create key group containing key pair KZHBCJCOBU6QG
2. Get current distribution config (ETag)
3. Patch default cache behavior to use the new key group (TrustedKeyGroups)
4. Update the distribution
"""

import json
import boto3
import botocore.exceptions

CF_DISTRIBUTION_ID = "E3ASNK7MK51C7Y"
CF_KEY_PAIR_ID = "KZHBCJCOBU6QG"
KEY_GROUP_NAME = "zonga-key-group"


def run():
    cf = boto3.client("cloudfront", region_name="us-east-1")

    # ── Step 1: Create key group (idempotent check) ─────────────────────────
    existing_kg_id = None
    resp_list = cf.list_key_groups()
    for item in resp_list.get("KeyGroupList", {}).get("Items", []):
        if item["KeyGroup"]["KeyGroupConfig"]["Name"] == KEY_GROUP_NAME:
            existing_kg_id = item["KeyGroup"]["Id"]
            print(f"Key group already exists: {existing_kg_id}")
            break

    if not existing_kg_id:
        print(f"Creating key group '{KEY_GROUP_NAME}'...")
        resp = cf.create_key_group(
            KeyGroupConfig={
                "Name": KEY_GROUP_NAME,
                "Items": [CF_KEY_PAIR_ID],
                "Comment": "Zonga signed URL key group",
            }
        )
        existing_kg_id = resp["KeyGroup"]["Id"]
        print(f"Created key group: {existing_kg_id}")

    # ── Step 2: Get distribution config ────────────────────────────────────
    print(f"\nFetching distribution config for {CF_DISTRIBUTION_ID}...")
    resp = cf.get_distribution_config(Id=CF_DISTRIBUTION_ID)
    etag = resp["ETag"]
    config = resp["DistributionConfig"]

    dcb = config["DefaultCacheBehavior"]

    # Check if key group already attached
    existing_kgs = dcb.get("TrustedKeyGroups", {})
    if existing_kgs.get("Enabled") and existing_kg_id in existing_kgs.get("Items", []):
        print("Key group already attached to default cache behavior. Nothing to do.")
        return

    # ── Step 3: Attach key group ────────────────────────────────────────────
    # Must disable TrustedSigners if using TrustedKeyGroups
    if "TrustedSigners" in dcb:
        dcb["TrustedSigners"] = {"Enabled": False, "Quantity": 0, "Items": []}

    dcb["TrustedKeyGroups"] = {
        "Enabled": True,
        "Quantity": 1,
        "Items": [existing_kg_id],
    }

    # ViewerProtocolPolicy must be https-only or redirect-to-https for signed URLs
    if dcb.get("ViewerProtocolPolicy") == "allow-all":
        dcb["ViewerProtocolPolicy"] = "redirect-to-https"
        print("  Updated ViewerProtocolPolicy to redirect-to-https")

    print(f"Attaching key group {existing_kg_id} to default cache behavior...")

    # ── Step 4: Update distribution ─────────────────────────────────────────
    cf.update_distribution(
        Id=CF_DISTRIBUTION_ID,
        IfMatch=etag,
        DistributionConfig=config,
    )
    print("Distribution updated. CloudFront will propagate changes (~5 minutes).")
    print(f"\nKey group ID: {existing_kg_id}")
    print(f"Key pair ID : {CF_KEY_PAIR_ID}")


if __name__ == "__main__":
    run()
