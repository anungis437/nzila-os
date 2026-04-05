# {{ product_name }} — Vertical App Template

This template creates a new vertical application repo with:
- **Frontend:** Next.js 15 (App Router) with OIDC auth
- **Backend:** Django 5.1 app connecting to Backbone API
- **Infra:** Azure Bicep modules
- **CI/CD:** GitHub Actions workflows

## Usage

```bash
python scaffold.py \
  --product-name="My Product" \
  --repo-name="nzila-my-product" \
  --vertical="healthtech"
```
