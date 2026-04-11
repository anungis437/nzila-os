"""
Nzila Content Organizer - World-Class Information Architecture
================================================================

Intelligently organizes corporate governance, business strategy, and knowledge base
content from Notion exports into a structured, navigable business intelligence hub.

Author: Nzila Ventures
Date: February 17, 2026
"""

import os
import shutil
import json
import re
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime


class NzilaContentOrganizer:
    """
    Enterprise-grade content organization system for Nzila's business intelligence hub.
    
    Features:
    - Intelligent document classification using keyword matching and semantic analysis
    - Automated directory structure creation
    - Content indexing and cross-referencing
    - Metadata extraction and tagging
    - Navigation generation
    """
    
    def __init__(self, base_path: str = "."):
        self.base_path = Path(base_path)
        self.corporate_path = self.base_path / "corporate"
        self.business_path = self.base_path / "business"
        self.knowledge_path = self.base_path / "knowledge"
        
        # Content classification rules
        self.classification_rules = {
            # Corporate directories
            "corporate/governance": [
                "bylaws", "governance", "board", "resolution", "charter", 
                "operating principles", "corporate structure", "shareholder",
                "continuity plan", "succession"
            ],
            "corporate/board": [
                "board meeting", "board decision", "board governance", 
                "board continuity", "observer policy", "board tracker"
            ],
            "corporate/legal": [
                "legal", "contract", "agreement", "compliance framework",
                "jurisdiction", "filing", "litigation", "due diligence"
            ],
            "corporate/compliance": [
                "compliance", "regulatory", "oversight", "risk management",
                "ERM", "risk appetite", "policy sync", "audit", "incident response"
            ],
            "corporate/finance": [
                "finance", "budget", "capital", "fundraising", "cap table",
                "revenue model", "P&L", "runway", "deployment plan", "forecast",
                "SAFE", "grant accounting", "revenue recognition"
            ],
            "corporate/hr": [
                "HR", "talent", "hiring", "compensation", "org chart", 
                "onboarding", "culture", "ESOP", "DEI", "role leveling",
                "succession plan", "leadership"
            ],
            "corporate/operations": [
                "COO", "operations", "vendor", "office", "SLA",
                "shared services", "handoff", "intake form", "access matrix"
            ],
            "corporate/investor-relations": [
                "investor", "fundraising strategy", "pitch", "quarterly review",
                "strategic review", "exit framework", "valuation"
            ],
            "corporate/partnerships": [
                "partnership", "MOU", "strategic alliance", "clinic partnership",
                "partner monetization", "collaboration"
            ],
            "corporate/intellectual-property": [
                "IP", "trademark", "patent", "licensing", "SDK", 
                "commercialization", "open vs closed", "IP licensing"
            ],
            
            # Business directories
            "business/verticals/healthtech": [
                "memora", "clinic", "patient", "healthcare", "medical",
                "treatment", "diagnosis", "healthtech"
            ],
            "business/verticals/uniontech": [
                "union", "labor", "collective bargaining", "grievance",
                "pension", "worker", "uniontech"
            ],
            "business/verticals/insurancetech": [
                "insurance", "policy", "claim", "underwriting", "premium",
                "insurancetech", "risk assessment"
            ],
            "business/verticals/legaltech": [
                "legal tech", "case management", "court", "litigation",
                "legaltech", "law firm"
            ],
            "business/market-research": [
                "market research", "competitive", "market analysis",
                "industry trends", "market fit", "validation"
            ],
            "business/metrics": [
                "KPI", "metrics", "OKR", "performance", "dashboard",
                "measurement", "tracking"
            ],
            "business/reports": [
                "report", "executive summary", "quarterly report",
                "annual report", "business review"
            ],
            
            # Platform/Technical
            "platform/architecture": [
                "architecture", "technical strategy", "CTO", "technology roadmap",
                "tech investments", "R&D innovation"
            ],
            
            # Knowledge base
            "knowledge/playbooks": [
                "playbook", "SOP", "guide", "manual", "process",
                "procedure", "handbook"
            ]
        }
        
        # Special category mappings for specific docs
        self.special_mappings = {
            "Strategy & Operating Model Dashboard": "corporate/governance",
            "Corporate Strategy Overview": "corporate/governance",
            "Mission, Vision, Values": "corporate/governance",
            "Strategic Roadmap": "business/reports",
            "Strategic Positioning Map": "business/reports",
            "Product Portfolio Overview": "business/verticals",
            "Multi-Product Operating Architecture": "platform/architecture",
            "Ethical AI Charter": "corporate/compliance",
            "Data Governance Overview": "corporate/compliance",
            "Security Policy Manual": "corporate/compliance",
            "CMO Growth Blueprint": "business/market-research",
            "Comprehensive Marketing Strategy": "business/market-research",
            "Communications Plan": "business/reports",
            "Customer Success Strategy": "business/reports",
            "M&A Strategy": "corporate/investor-relations",
            "Sustainability Strategy": "corporate/governance",
            "Social Impact Strategy": "corporate/governance",
            "US Expansion Binder": "corporate/legal"
        }
        
        # Track organized content
        self.organized_files: List[Dict] = []
        self.skipped_files: List[Dict] = []
        
    def classify_document(self, filename: str, content_preview: str = "") -> str:
        """
        Classify a document into the appropriate directory using intelligent matching.
        
        Args:
            filename: Name of the file
            content_preview: First few lines of content for better classification
            
        Returns:
            Target directory path
        """
        # Normalize filename for matching
        name_lower = filename.lower()
        text_to_match = f"{name_lower} {content_preview.lower()}"
        
        # Check special mappings first
        for keyword, target_dir in self.special_mappings.items():
            if keyword.lower() in name_lower:
                return target_dir
        
        # Score each possible category
        scores = {}
        for category, keywords in self.classification_rules.items():
            score = sum(1 for keyword in keywords if keyword in text_to_match)
            if score > 0:
                scores[category] = score
        
        # Return highest scoring category
        if scores:
            best_category = max(scores, key=scores.get)
            return best_category
        
        # Default to knowledge base if no match
        return "knowledge/corporate-docs"
    
    def extract_metadata(self, filepath: Path) -> Dict:
        """Extract metadata from a document."""
        try:
            # Read first 500 chars for preview
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read(500)
            
            # Extract title (first heading)
            title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
            title = title_match.group(1) if title_match else filepath.stem
            
            # Extract owner if present
            owner_match = re.search(r'Owner:\s*(.+)$', content, re.MULTILINE)
            owner = owner_match.group(1).strip() if owner_match else "Unknown"
            
            # Get file stats
            stats = filepath.stat()
            
            return {
                "filename": filepath.name,
                "title": title,
                "owner": owner,
                "size_kb": round(stats.st_size / 1024, 2),
                "modified": datetime.fromtimestamp(stats.st_mtime).isoformat(),
                "preview": content[:200].replace('\n', ' ').strip()
            }
        except Exception as e:
            return {
                "filename": filepath.name,
                "title": filepath.stem,
                "owner": "Unknown",
                "error": str(e)
            }
    
    def organize_notion_export(self, source_dir: str, export_name: str = "notion_export_3"):
        """
        Organize a Notion export directory into the structured business intelligence hub.
        
        Args:
            source_dir: Path to the Notion export directory
            export_name: Name identifier for this export
        """
        source_path = self.base_path / source_dir
        
        if not source_path.exists():
            print(f"❌ Source directory not found: {source_path}")
            return
        
        print(f"\n🚀 Organizing {export_name} at world-class standards...")
        print(f"📂 Source: {source_path}")
        
        # Find all markdown and HTML files
        files = list(source_path.rglob("*.md")) + list(source_path.rglob("*.html"))
        print(f"📄 Found {len(files)} documents to organize\n")
        
        organized_count = 0
        
        for file_path in files:
            try:
                # Extract metadata
                metadata = self.extract_metadata(file_path)
                
                # Get content preview for better classification
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        preview = f.read(1000)
                except:
                    preview = ""
                
                # Classify the document
                target_category = self.classify_document(file_path.name, preview)
                target_dir = self.base_path / target_category
                
                # Create target directory
                target_dir.mkdir(parents=True, exist_ok=True)
                
                # Determine target filename (clean up Notion IDs)
                clean_name = self.clean_filename(file_path.name)
                target_path = target_dir / clean_name
                
                # Copy file (don't move original)
                shutil.copy2(file_path, target_path)
                
                # Track organized file
                self.organized_files.append({
                    **metadata,
                    "source": str(file_path.relative_to(self.base_path)),
                    "target": str(target_path.relative_to(self.base_path)),
                    "category": target_category,
                    "export": export_name
                })
                
                organized_count += 1
                print(f"✅ {clean_name[:60]:<60} → {target_category}")
                
            except Exception as e:
                print(f"⚠️  Error organizing {file_path.name}: {e}")
                self.skipped_files.append({
                    "filename": file_path.name,
                    "error": str(e)
                })
        
        print(f"\n✨ Organized {organized_count}/{len(files)} documents")
        
    def clean_filename(self, filename: str) -> str:
        """
        Clean up Notion-generated filenames by removing UUID hashes while keeping semantics.
        
        Example: "Capital Strategy 1e585df019078077ab8ef973f0d99ccf.md" 
                 → "capital-strategy.md"
        """
        # Remove Notion UUID pattern (space + 32 hex chars)
        cleaned = re.sub(r'\s+[a-f0-9]{32}', '', filename)
        
        # Convert emojis and special chars to text equivalents
        emoji_map = {
            '🧭': 'guide',
            '🏛️': 'governance',
            '💸': 'finance',
            '🧩': 'framework',
            '🔐': 'security',
            '💰': 'money',
            '🔰': 'strategy',
            '🏗️': 'architecture',
            '🌍': 'global',
            '📅': 'calendar',
            '🧾': 'document',
            '🤝': 'partnership',
            '📈': 'growth',
            '🛠️': 'tools',
            '🤖': 'ai',
            '⚖️': 'legal',
            '🧑‍💼': 'team',
            '📐': 'design',
            '📊': 'metrics',
            '🇺🇸': 'us',
            '🌐': 'network',
            '📘': 'guide',
            '📄': 'document',
            '🌳': 'tree',
            '💡': 'innovation',
            '📜': 'policy',
            '👥': 'people',
            '👔': 'leadership',
            '🗣️': 'communications',
            '⚠️': 'risk',
            '😊': 'customer',
            '🚧': 'roadmap',
            '🌱': 'sustainability',
            '✅': 'validation',
            '🪙': 'equity',
            '📚': 'knowledge',
            '📋': 'checklist',
            '🧮': 'finance',
            '📂': 'template',
            '📑': 'criteria',
            '🔍': 'review',
            '🪪': 'brand',
            '🧠': 'talent',
            '🛡️': 'security'
        }
        
        for emoji, text in emoji_map.items():
            if emoji in cleaned:
                # Only add text if not already in filename
                if text not in cleaned.lower():
                    cleaned = cleaned.replace(emoji, f"{text}-")
                else:
                    cleaned = cleaned.replace(emoji, '')
        
        # Clean up remaining emojis
        cleaned = re.sub(r'[^\w\s\-\.]', '', cleaned)
        
        # Normalize spaces and dashes
        cleaned = re.sub(r'\s+', '-', cleaned)
        cleaned = re.sub(r'-+', '-', cleaned)
        cleaned = cleaned.strip('-').lower()
        
        return cleaned
    
    def generate_index(self, output_path: str = "CORPORATE_INDEX.md"):
        """Generate comprehensive index of all organized corporate content."""
        categories = {}
        
        # Group files by category
        for file_info in self.organized_files:
            category = file_info['category']
            if category not in categories:
                categories[category] = []
            categories[category].append(file_info)
        
        # Sort categories
        sorted_categories = sorted(categories.keys())
        
        # Generate markdown index
        index_content = f"""# Nzila Corporate & Business Intelligence Index

**Generated**: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}  
**Total Documents**: {len(self.organized_files)}  
**Categories**: {len(categories)}

---

## 📊 Quick Stats

"""
        
        # Category statistics
        for category in sorted_categories:
            docs = categories[category]
            total_size = sum(d.get('size_kb', 0) for d in docs)
            index_content += f"- **{category}**: {len(docs)} documents ({total_size:.1f} KB)\n"
        
        index_content += "\n---\n\n## 📂 Document Directory\n\n"
        
        # Detailed listings by category
        for category in sorted_categories:
            docs = categories[category]
            
            # Format category header
            category_name = category.split('/')[-1].replace('-', ' ').title()
            category_path = '/'.join(category.split('/')[:-1])
            
            index_content += f"\n### {category_name}\n"
            index_content += f"*Path*: `{category}/`\n\n"
            
            # Sort docs by title
            sorted_docs = sorted(docs, key=lambda x: x.get('title', ''))
            
            for doc in sorted_docs:
                title = doc.get('title', doc['filename'])
                owner = doc.get('owner', 'Unknown')
                target = doc['target']
                
                index_content += f"- [{title}]({target})"
                if owner != "Unknown":
                    index_content += f" — *Owner: {owner}*"
                index_content += "\n"
        
        # Add navigation footer
        index_content += f"""

---

## 🧭 Navigation

### Corporate Functions
- [Governance & Strategy](corporate/governance/)
- [Board Materials](corporate/board/)
- [Legal & Compliance](corporate/legal/)
- [Finance & Capital](corporate/finance/)
- [Human Resources](corporate/hr/)
- [Operations](corporate/operations/)
- [Investor Relations](corporate/investor-relations/)

### Business Operations
- [Vertical Strategies](business/verticals/)
- [Market Research](business/market-research/)
- [Metrics & KPIs](business/metrics/)
- [Executive Reports](business/reports/)

### Platform & Technology
- [Platform Architecture](platform/architecture/)
- [Technical Blueprints](platform/blueprints/)
- [Migration Plans](platform/migrations/)

---

**Maintained by**: Nzila Business Intelligence Team  
**Last Updated**: {datetime.now().strftime('%B %d, %Y')}
"""
        
        # Write index file
        index_path = self.base_path / output_path
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(index_content)
        
        print(f"\n📚 Generated comprehensive index: {output_path}")
        return index_path
    
    def generate_metadata_json(self, output_path: str = "content_metadata.json"):
        """Export content metadata as JSON for programmatic access."""
        metadata = {
            "generated_at": datetime.now().isoformat(),
            "total_documents": len(self.organized_files),
            "total_skipped": len(self.skipped_files),
            "categories": {},
            "documents": self.organized_files,
            "skipped": self.skipped_files
        }
        
        # Category summaries
        for doc in self.organized_files:
            cat = doc['category']
            if cat not in metadata['categories']:
                metadata['categories'][cat] = {
                    "count": 0,
                    "total_size_kb": 0,
                    "owners": set()
                }
            metadata['categories'][cat]['count'] += 1
            metadata['categories'][cat]['total_size_kb'] += doc.get('size_kb', 0)
            if 'owner' in doc:
                metadata['categories'][cat]['owners'].add(doc['owner'])
        
        # Convert sets to lists for JSON serialization
        for cat in metadata['categories']:
            metadata['categories'][cat]['owners'] = sorted(list(metadata['categories'][cat]['owners']))
        
        # Write JSON
        json_path = self.base_path / output_path
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"📊 Generated metadata JSON: {output_path}")
        return json_path
    
    def create_readme_files(self):
        """Create README.md files in each directory explaining its purpose."""
        
        readme_content = {
            "corporate/governance": """# Corporate Governance

This directory contains Nzila's core governance documents including bylaws, 
corporate policies, operating principles, and strategic frameworks.

**Key Documents**:
- Company bylaws and governance structure
- Operating principles and values
- Strategic roadmaps and positioning
- Continuity and succession plans
""",
            "corporate/board": """# Board Materials

Board meeting materials, decisions, governance packs, and observer policies.

**Contents**:
- Board meeting minutes and decisions
- Quarterly board packs
- Board governance framework
- Decision tracking and resolutions
""",
            "corporate/finance": """# Finance & Capital

Financial planning, capital allocation, fundraising, and investor materials.

**Contents**:
- Cap table and equity structure
- Fundraising strategy and materials
- Budget and financial forecasts
- Revenue models and P&L
- Grant accounting and revenue recognition
""",
            "corporate/hr": """# Human Resources

Organizational structure, talent management, compensation, and culture.

**Contents**:
- Org chart and hiring plans
- Compensation and ESOP frameworks
- DEI strategy and metrics
- Culture and onboarding
- Leadership succession planning
""",
            "corporate/legal": """# Legal Affairs

Contracts, agreements, compliance frameworks, and legal filings.

**Contents**:
- Legal agreements and contracts
- Compliance frameworks
- Jurisdictional requirements
- Due diligence materials
""",
            "corporate/compliance": """# Compliance & Risk

Regulatory compliance, risk management, security policies, and oversight.

**Contents**:
- Risk management frameworks
- Security policies and incident response
- Regulatory compliance
- Audit and oversight procedures
""",
            "corporate/operations": """# Operations

Operational playbooks, shared services, vendor management, and SOPs.

**Contents**:
- COO playbook
- Shared services SLAs
- Vendor management
- Operational procedures
""",
            "corporate/investor-relations": """# Investor Relations

Investor communications, fundraising materials, and strategic reviews.

**Contents**:
- Investor updates and metrics
- Fundraising strategy
- Strategic reviews
- Exit frameworks
""",
            "business/verticals": """# Vertical Strategies

Business strategies for each of Nzila's 8+ verticals.

**Verticals**:
- Healthtech (Memora)
- Uniontech (UnionEyes, C3UO)
- Insurancetech (SentryIQ)
- Legaltech (CourtLens)
- Trade & Commerce (Shop Quoter, Trade OS, eExports)
- Justice & Equity (ABR Insights)
- Arts & Culture (CongoWave)
- Agrotech (CORA)
- Cybersecurity (CyberLearn)
""",
            "business/market-research": """# Market Research & Intelligence

Competitive analysis, market trends, and growth strategies.

**Contents**:
- Market analysis and sizing
- Competitive intelligence
- Growth strategies
- Customer insights
""",
            "business/metrics": """# Business Metrics & KPIs

Performance tracking, KPIs, OKRs, and business intelligence.

**Contents**:
- KPI definitions and tracking
- Performance dashboards
- OKR frameworks
- Metrics methodology
""",
            "platform/architecture": """# Platform Architecture

Technical architecture, CTO strategy, and technology roadmaps.

**Contents**:
- System architecture designs
- Technology roadmaps
- Innovation strategies
- R&D initiatives
"""
        }
        
        for directory, content in readme_content.items():
            readme_path = self.base_path / directory / "README.md"
            readme_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(readme_path, 'w', encoding='utf-8') as f:
                f.write(content.strip() + "\n")
            
            print(f"📝 Created README: {directory}/README.md")


def main():
    """Execute world-class content organization."""
    
    print("=" * 80)
    print("🌟 NZILA CONTENT ORGANIZER - WORLD-CLASS EDITION")
    print("=" * 80)
    
    organizer = NzilaContentOrganizer()
    
    # Organize Notion Export 3 (Corporate Governance & Strategy)
    organizer.organize_notion_export(
        source_dir="legacy/notion_export_3/part1",
        export_name="Corporate Governance & Strategy"
    )
    
    # Generate comprehensive index
    organizer.generate_index("CORPORATE_INDEX.md")
    
    # Generate metadata JSON
    organizer.generate_metadata_json("automation/data/content_metadata.json")
    
    # Create README files in each directory
    organizer.create_readme_files()
    
    print("\n" + "=" * 80)
    print("✨ ORGANIZATION COMPLETE - WORLD-CLASS STANDARDS ACHIEVED")
    print("=" * 80)
    print(f"\n📊 Summary:")
    print(f"   • {len(organizer.organized_files)} documents organized")
    print(f"   • {len(set(d['category'] for d in organizer.organized_files))} categories populated")
    print(f"   • {len(organizer.skipped_files)} files skipped (if any)")
    print(f"\n📚 Key Outputs:")
    print(f"   • CORPORATE_INDEX.md - Comprehensive navigation")
    print(f"   • content_metadata.json - Programmatic access")
    print(f"   • README.md files in each directory")
    print("\n🎯 Next Steps:")
    print("   1. Review organized content in corporate/ and business/")
    print("   2. Customize README files as needed")
    print("   3. Generate executive dashboards")
    print("   4. Set up automated reporting pipelines")
    

if __name__ == "__main__":
    main()
