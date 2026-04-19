"""
Update the ACA job to run curl with the correct command and bearer token.
Uses the Azure REST API directly to avoid PowerShell escaping issues.
"""
import subprocess
import json
import sys

AZ_CMD = r"C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"

SUBSCRIPTION_ID = "5d819f33-d16f-429c-a3c0-5b0e94740ba3"
RESOURCE_GROUP = "nzila-canada-staging-rg"
JOB_NAME = "zonga-media-worker"
API_VERSION = "2024-03-01"
WORKER_URL = "https://nzila-os-zonga.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/internal/workers/media-transcode"

def run_az(*args):
    result = subprocess.run(
        [AZ_CMD] + list(args),
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"az error: {result.stderr[:500]}", file=sys.stderr)
        sys.exit(1)
    return result.stdout.strip()

def get_token():
    return run_az("account", "get-access-token", "--query", "accessToken", "-o", "tsv")

def get_job():
    out = run_az("containerapp", "job", "show",
                 "--name", JOB_NAME, "--resource-group", RESOURCE_GROUP, "-o", "json")
    return json.loads(out)

def update_job_command(job: dict):
    import urllib.request
    # Build minimal PATCH body — only update the container command
    curl_cmd = (
        'curl -fsS -X POST '
        '-H "Authorization: Bearer ${INTERNAL_WORKER_BEARER_TOKEN}" '
        '-H "Content-Type: application/json" '
        '-d \'{"batchSize":10}\' '
        '"${WORKER_URL}"'
    )
    patch_body = {
        "properties": {
            "template": {
                "containers": [
                    {
                        "name": job["properties"]["template"]["containers"][0]["name"],
                        "image": job["properties"]["template"]["containers"][0]["image"],
                        "command": ["sh", "-c", curl_cmd],
                        "args": [],
                        "resources": job["properties"]["template"]["containers"][0]["resources"],
                        "env": job["properties"]["template"]["containers"][0].get("env", []),
                    }
                ]
            }
        }
    }

    url = (
        f"https://management.azure.com/subscriptions/{SUBSCRIPTION_ID}"
        f"/resourceGroups/{RESOURCE_GROUP}/providers/Microsoft.App/jobs/{JOB_NAME}"
        f"?api-version={API_VERSION}"
    )
    body = json.dumps(patch_body).encode()
    token = get_token()

    req = urllib.request.Request(
        url,
        data=body,
        method="PATCH",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
    )
    with urllib.request.urlopen(req) as resp:
        raw = resp.read()
        print(f"HTTP {resp.status}")
        if not raw:
            print("Job update accepted (empty body response).")
            return
        out = json.loads(raw)

    print("Job updated. Command:")
    for c in out["properties"]["template"]["containers"]:
        print(f"  image: {c.get('image')}")
        print(f"  command: {c.get('command')}")

if __name__ == "__main__":
    print("Fetching current job config...")
    job = get_job()
    print("Updating job command to curl worker route...")
    update_job_command(job)
    print("Done.")
