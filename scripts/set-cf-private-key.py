"""
Set ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM on nzila-os-zonga Container App via REST API.
Uses minimal PATCH to add the env var alongside existing ones.
"""

import json
import subprocess
import urllib.request

AZ_CMD = r"C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
SUBSCRIPTION_ID = "5d819f33-d16f-429c-a3c0-5b0e94740ba3"
RESOURCE_GROUP = "nzila-canada-staging-rg"
APP_NAME = "nzila-os-zonga"
API_VERSION = "2024-03-01"

ENV_FILE = "apps/zonga/.env.local"


def get_token() -> str:
    result = subprocess.run(
        [AZ_CMD, "account", "get-access-token", "--query", "accessToken", "-o", "tsv"],
        capture_output=True, text=True, check=True,
    )
    return result.stdout.strip()


def get_app() -> dict:
    result = subprocess.run(
        [AZ_CMD, "containerapp", "show",
         "--name", APP_NAME,
         "--resource-group", RESOURCE_GROUP,
         "-o", "json"],
        capture_output=True, text=True, check=True,
    )
    return json.loads(result.stdout)


def read_pem_from_env_file() -> str:
    with open(ENV_FILE, encoding="utf-8") as f:
        for line in f:
            if line.startswith("ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM="):
                return line.split("=", 1)[1].strip()
    raise ValueError("ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM not found in env file")


def set_pem_env_var():
    pem_value = read_pem_from_env_file()
    print(f"PEM value length: {len(pem_value)}")

    print("Fetching current app config...")
    app = get_app()
    container = app["properties"]["template"]["containers"][0]
    existing_env = container.get("env", [])

    # Remove any existing ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM entry
    filtered_env = [e for e in existing_env if e["name"] != "ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM"]
    # Add the new one
    filtered_env.append({"name": "ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM", "value": pem_value})

    patch_body = {
        "properties": {
            "template": {
                "containers": [
                    {
                        "name": container["name"],
                        "image": container["image"],
                        "resources": container["resources"],
                        "env": filtered_env,
                    }
                ]
            }
        }
    }

    url = (
        f"https://management.azure.com/subscriptions/{SUBSCRIPTION_ID}"
        f"/resourceGroups/{RESOURCE_GROUP}/providers/Microsoft.App/containerApps/{APP_NAME}"
        f"?api-version={API_VERSION}"
    )
    body = json.dumps(patch_body).encode()
    token = get_token()

    print("Sending PATCH to set PEM env var...")
    req = urllib.request.Request(
        url,
        data=body,
        method="PATCH",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"HTTP {resp.status}")
            raw = resp.read()
            if not raw:
                print("Accepted (empty body).")
            else:
                out = json.loads(raw)
                state = out.get("properties", {}).get("provisioningState", "unknown")
                print(f"Provisioning state: {state}")
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode()}")
        raise

    print("Done.")


if __name__ == "__main__":
    set_pem_env_var()
