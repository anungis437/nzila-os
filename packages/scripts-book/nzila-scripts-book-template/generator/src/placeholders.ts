/**
 * placeholders.ts — Placeholder resolution and replacement for template rendering.
 */

export interface PlaceholderValues {
  PRODUCT_NAME: string;
  REPO_NAME: string;
  OWNER_GITHUB: string;
  PRIMARY_APP_PATH: string;
  APP_PORT: string;
  TENANT_KEY: string;
  IMAGE_REPO: string;
  AUTH_PROVIDER: string;
  DB_PROVIDER: string;
  DEPLOY_PROVIDER: string;
  STAGING_URL: string;
  PRODUCTION_URL: string;
}

export interface Manifest {
  template_version: string;
  product_name: string;
  repo_name: string;
  owner_github: string;
  primary_app_path: string;
  app_port: number;
  tenant_key: string;
  image_repo: string;
  auth_provider: string;
  db_provider: string;
  deploy_provider: string;
  environments: {
    staging_url: string;
    production_url: string;
  };
  profile: string;
  modules: string[];
  options: {
    enable_ci: boolean;
    enable_deploy_workflows: boolean;
    enable_ai_ops: boolean;
    strict_parity: boolean;
  };
}

/** Build a placeholder map from a parsed manifest. */
export function buildPlaceholders(manifest: Manifest): PlaceholderValues {
  return {
    PRODUCT_NAME: manifest.product_name,
    REPO_NAME: manifest.repo_name,
    OWNER_GITHUB: manifest.owner_github,
    PRIMARY_APP_PATH: manifest.primary_app_path,
    APP_PORT: String(manifest.app_port),
    TENANT_KEY: manifest.tenant_key,
    IMAGE_REPO: manifest.image_repo,
    AUTH_PROVIDER: manifest.auth_provider,
    DB_PROVIDER: manifest.db_provider,
    DEPLOY_PROVIDER: manifest.deploy_provider,
    STAGING_URL: manifest.environments.staging_url,
    PRODUCTION_URL: manifest.environments.production_url,
  };
}

/** Replace all `{{KEY}}` tokens in `content` using the provided values. */
export function replacePlaceholders(
  content: string,
  values: PlaceholderValues,
): string {
  let result = content;
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(pattern, value);
  }
  return result;
}
