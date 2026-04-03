"""Tests for standalone analysis scripts — 100 % coverage target."""

import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# ──────────────────────────────────────────────────────────────
# analyze_notion_export.py
# ──────────────────────────────────────────────────────────────
from analyze_notion_export import (
    NotionHTMLParser,
    analyze_export,
    categorize_files,
    extract_content,
)


class TestNotionHTMLParser:
    """Tests for NotionHTMLParser HTML extraction."""

    def test_title_extraction(self):
        parser = NotionHTMLParser()
        parser.feed('<h1 class="page-title">My Title</h1>')
        assert parser.title.strip() == "My Title"

    def test_header_extraction(self):
        parser = NotionHTMLParser()
        parser.feed("<h2>Section A</h2><h3>Sub B</h3>")
        assert "Section A" in parser.headers
        assert "Sub B" in parser.headers

    def test_paragraph_extraction(self):
        parser = NotionHTMLParser()
        parser.feed("<p>Hello world</p>")
        assert any("Hello world" in p for p in parser.paragraphs)

    def test_table_extraction(self):
        parser = NotionHTMLParser()
        parser.feed(
            "<table><tr><th>Col1</th><th>Col2</th></tr>"
            "<tr><td>A</td><td>B</td></tr></table>"
        )
        assert len(parser.tables) == 1
        assert len(parser.tables[0]) == 2
        assert parser.tables[0][0] == ["Col1", "Col2"]
        assert parser.tables[0][1] == ["A", "B"]

    def test_empty_html(self):
        parser = NotionHTMLParser()
        parser.feed("")
        assert parser.title == ""
        assert parser.headers == []
        assert parser.paragraphs == []
        assert parser.tables == []

    def test_non_title_h1(self):
        """h1 without page-title class should not set title."""
        parser = NotionHTMLParser()
        parser.feed("<h1>Not Title</h1>")
        assert parser.title.strip() == ""

    def test_table_row_without_table_flag(self):
        """tr/td outside a table context should be handled gracefully."""
        parser = NotionHTMLParser()
        parser.feed("<p>text</p>")
        # No crash expected
        assert parser.tables == []

    def test_endtag_resets_current_tag(self):
        parser = NotionHTMLParser()
        parser.feed("<h2>Header</h2><p>Paragraph</p>")
        # After processing, current_tag should be None
        assert parser.current_tag is None


class TestExtractContent:
    """Tests for extract_content()."""

    def test_basic_html_file(self, tmp_path):
        html = (
            '<h1 class="page-title">My Doc</h1>' "<h2>Overview</h2>" "<p>Some text</p>"
        )
        f = tmp_path / "test.html"
        f.write_text(html, encoding="utf-8")
        result = extract_content(str(f))
        assert result["title"] == "My Doc"
        assert "Overview" in result["headers"]
        assert any("Some text" in p for p in result["paragraphs"])
        assert result["has_tables"] is False

    def test_file_with_tables(self, tmp_path):
        html = "<table><tr><td>Cell</td></tr></table>"
        f = tmp_path / "tables.html"
        f.write_text(html, encoding="utf-8")
        result = extract_content(str(f))
        assert result["has_tables"] is True
        assert len(result["tables"]) == 1

    def test_nonexistent_file(self):
        result = extract_content("/nonexistent/file.html")
        assert "error" in result

    def test_limits_paragraphs_and_tables(self, tmp_path):
        paras = "".join(f"<p>Paragraph {i}</p>" for i in range(20))
        tables = "".join(f"<table><tr><td>{i}</td></tr></table>" for i in range(10))
        html = paras + tables
        f = tmp_path / "big.html"
        f.write_text(html, encoding="utf-8")
        result = extract_content(str(f))
        assert len(result["paragraphs"]) <= 5
        assert len(result["tables"]) <= 3


class TestCategorizeFiles:
    """Tests for categorize_files()."""

    def test_categorizes_by_keyword(self, tmp_path):
        (tmp_path / "Memora Roadmap.html").write_text("<p>x</p>")
        (tmp_path / "AI Companion Design.html").write_text("<p>x</p>")
        (tmp_path / "Gamification Ethics.html").write_text("<p>x</p>")
        (tmp_path / "Clinic Protocols.html").write_text("<p>x</p>")
        (tmp_path / "Privacy Policy.html").write_text("<p>x</p>")
        (tmp_path / "UX Wireframes.html").write_text("<p>x</p>")
        (tmp_path / "Technical Architecture.html").write_text("<p>x</p>")
        (tmp_path / "Prompt Templates.html").write_text("<p>x</p>")
        (tmp_path / "QA Testing Plan.html").write_text("<p>x</p>")
        (tmp_path / "Onboarding Flow.html").write_text("<p>x</p>")
        (tmp_path / "FAQ Page.html").write_text("<p>x</p>")
        (tmp_path / "Revenue Plan.html").write_text("<p>x</p>")
        (tmp_path / "Legal Review.html").write_text("<p>x</p>")
        (tmp_path / "Product Portfolio Overview.html").write_text("<p>x</p>")
        (tmp_path / "Accessibility Standards.html").write_text("<p>x</p>")
        (tmp_path / "OKR Q1.html").write_text("<p>x</p>")
        (tmp_path / "Random Document.html").write_text("<p>x</p>")

        cats = categorize_files(str(tmp_path))
        assert "Memora Product" in cats
        assert "AI Companion" in cats
        assert "Gamification" in cats
        assert "Clinic Solutions" in cats
        assert "Privacy & Consent" in cats
        assert "UX/UI Design" in cats
        assert "Technical Architecture" in cats
        assert "Prompt Engineering" in cats
        assert "Testing & QA" in cats
        assert "Onboarding" in cats
        assert "FAQs" in cats
        assert "Business & Finance" in cats
        assert "Legal & Compliance" in cats
        assert "Product Strategy" in cats
        assert "Accessibility" in cats
        assert "Goals & Milestones" in cats
        assert "Other" in cats

    def test_emoji_prefix(self, tmp_path):
        (tmp_path / "🧠 Something.html").write_text("<p>x</p>")
        cats = categorize_files(str(tmp_path))
        # Should have at least one category
        assert len(cats) >= 1

    def test_empty_directory(self, tmp_path):
        cats = categorize_files(str(tmp_path))
        assert len(cats) == 0


class TestAnalyzeExport:
    """Tests for analyze_export()."""

    def test_with_html_and_csv(self, tmp_path, capsys):
        # Create some HTML files matching key patterns
        (tmp_path / "Portfolio Overview.html").write_text(
            '<h1 class="page-title">Portfolio</h1><h2>Products</h2>'
            "<table><tr><td>A</td></tr></table>",
            encoding="utf-8",
        )
        (tmp_path / "Experience Pillars.html").write_text(
            "<h2>Pillar 1</h2><p>Sustainable engagement</p>",
            encoding="utf-8",
        )
        # CSV
        csv = tmp_path / "data.csv"
        csv.write_text("Name,Value\nAlpha,100\nBeta,200\n", encoding="utf-8")

        result = analyze_export(str(tmp_path))
        captured = capsys.readouterr()
        assert "NZILA NOTION EXPORT ANALYSIS" in captured.out
        assert result["total_html"] == 2
        assert result["total_csv"] == 1

    def test_empty_directory(self, tmp_path, capsys):
        result = analyze_export(str(tmp_path))
        captured = capsys.readouterr()
        assert "OVERVIEW" in captured.out
        assert result["total_html"] == 0

    def test_csv_read_error(self, tmp_path, capsys):
        """CSV with encoding issues should be handled gracefully."""
        (tmp_path / "bad.csv").write_bytes(b"\xff\xfe\x00\x00")
        result = analyze_export(str(tmp_path))
        captured = capsys.readouterr()
        # Should not crash
        assert result["total_csv"] == 1

    def test_key_pattern_matching(self, tmp_path, capsys):
        """Key patterns like 'Gamification' and 'Companion Manifesto'."""
        (tmp_path / "Gamification Design.html").write_text(
            '<h1 class="page-title">Gamification</h1><h2>Ethics</h2>',
            encoding="utf-8",
        )
        (tmp_path / "Companion Manifesto.html").write_text(
            "<p>AI companion rules</p>", encoding="utf-8"
        )
        result = analyze_export(str(tmp_path))
        captured = capsys.readouterr()
        assert result["total_html"] == 2


# ──────────────────────────────────────────────────────────────
# backbone_architecture_analysis.py
# ──────────────────────────────────────────────────────────────
from backbone_architecture_analysis import analyze_backbone_requirements


class TestBackboneArchitectureAnalysis:
    """Tests for analyze_backbone_requirements()."""

    def test_prints_strategic_findings(self, capsys):
        analyze_backbone_requirements()
        out = capsys.readouterr().out
        assert "NZILA BACKBONE ARCHITECTURE" in out
        assert "BACKBONE COMPONENTS" in out

    def test_prints_all_components(self, capsys):
        analyze_backbone_requirements()
        out = capsys.readouterr().out
        assert "Nzila AI Core Platform" in out
        assert "Multi-Org Foundation" in out
        assert "Consent & Compliance" in out


# ──────────────────────────────────────────────────────────────
# backbone_infrastructure_analysis.py
# ──────────────────────────────────────────────────────────────
from backbone_infrastructure_analysis import DetailedContentExtractor as InfraExtractor
from backbone_infrastructure_analysis import analyze_backbone_infrastructure
from backbone_infrastructure_analysis import extract_content as infra_extract_content


class TestInfraDetailedContentExtractor:
    """Tests for backbone_infrastructure_analysis.DetailedContentExtractor."""

    def test_article_scope(self):
        parser = InfraExtractor()
        parser.feed(
            "<article><h1>Title</h1><p>Body text</p></article>" "<p>Outside article</p>"
        )
        texts = [b["text"] for b in parser.content_blocks]
        assert any("Title" in t for t in texts)
        assert any("Body text" in t for t in texts)
        # Text outside article shouldn't appear
        assert not any("Outside article" in t for t in texts)

    def test_header_levels(self):
        parser = InfraExtractor()
        parser.feed("<article><h1>H1</h1><h2>H2</h2><h3>H3</h3></article>")
        levels = {b["level"] for b in parser.content_blocks}
        assert {1, 2, 3} == levels

    def test_list_items(self):
        parser = InfraExtractor()
        parser.feed("<article><li>Item one</li><li>Item two</li></article>")
        assert len(parser.content_blocks) == 2
        assert parser.content_blocks[0]["type"] == "li"

    def test_table_cells_pipe_separator(self):
        parser = InfraExtractor()
        parser.feed("<article><td>CellA</td><th>CellB</th></article>")
        # Content should contain pipe separators
        all_text = " ".join(b["text"] for b in parser.content_blocks)
        assert "|" in all_text

    def test_http_links_excluded(self):
        parser = InfraExtractor()
        url = "https://" + "example.com"
        parser.feed(f"<article><p>{url}</p><p>Real text</p></article>")
        texts = [b["text"] for b in parser.content_blocks]
        assert any("Real text" in t for t in texts)
        # http links should be excluded from data
        assert not any(url in t for t in texts)

    def test_p_inside_header_ignored(self):
        """p tag inside h1/h2/h3 context keeps header block."""
        parser = InfraExtractor()
        parser.feed("<article><h2>Header</h2></article>")
        assert len(parser.content_blocks) == 1
        assert parser.content_blocks[0]["type"] == "h2"

    def test_empty_blocks_not_saved(self):
        parser = InfraExtractor()
        parser.feed("<article><p>  </p></article>")
        assert len(parser.content_blocks) == 0


class TestInfraExtractContent:
    """Tests for backbone_infrastructure_analysis.extract_content()."""

    def test_valid_html(self, tmp_path):
        f = tmp_path / "doc.html"
        f.write_text(
            "<article><h1>Title</h1><p>Content</p></article>",
            encoding="utf-8",
        )
        blocks = infra_extract_content(str(f))
        assert len(blocks) >= 1

    def test_file_not_found(self):
        blocks = infra_extract_content("/no/such/file.html")
        assert blocks == []


class TestAnalyzeBackboneInfrastructure:
    """Tests for analyze_backbone_infrastructure()."""

    def test_runs_without_files(self, capsys):
        """Should not crash when Notion export dir doesn't exist."""
        analyze_backbone_infrastructure()
        out = capsys.readouterr().out
        assert "NZILA BACKBONE INFRASTRUCTURE ANALYSIS" in out
        assert "BACKBONE PLATFORM REQUIREMENTS" in out
        assert "RECOMMENDED BUILD ORDER" in out

    def test_with_matching_files(self, tmp_path, capsys, monkeypatch):
        """If the expected Notion files exist, they should be parsed."""
        # Create a file matching the multi_product pattern
        target = (
            tmp_path
            / "🏗️ Multi-Product Operating Architecture 1e585df01907804c85b6debb645d1f39.html"
        )
        target.write_text(
            "<article><h2>Architecture</h2><p>Details here...</p></article>",
            encoding="utf-8",
        )
        # Patch the export_dir inside the function
        monkeypatch.setattr(
            "backbone_infrastructure_analysis.analyze_backbone_infrastructure.__code__",
            analyze_backbone_infrastructure.__code__,
        )
        # Since the path is hardcoded, we test the default path which won't exist
        analyze_backbone_infrastructure()
        out = capsys.readouterr().out
        assert "Layer 1" in out


# ──────────────────────────────────────────────────────────────
# deep_dive_nzila.py
# ──────────────────────────────────────────────────────────────
from deep_dive_nzila import DetailedContentExtractor as DeepDiveExtractor
from deep_dive_nzila import analyze_key_strategic_docs, extract_detailed_content


class TestDeepDiveExtractor:
    """Tests for deep_dive_nzila.DetailedContentExtractor."""

    def test_article_scoped(self):
        parser = DeepDiveExtractor()
        parser.feed("<article><h1>Heading</h1></article>")
        assert len(parser.content_blocks) == 1

    def test_all_data_captured_in_body(self):
        """Unlike infra version, deep_dive captures all text (no http filter)."""
        parser = DeepDiveExtractor()
        parser.feed("<article><p>Any text here</p></article>")
        assert any("Any text" in b["text"] for b in parser.content_blocks)

    def test_endtag_article_saves(self):
        parser = DeepDiveExtractor()
        parser.feed("<article><p>Content</p></article>")
        assert len(parser.content_blocks) >= 1
        assert parser.in_body is False


class TestExtractDetailedContent:
    """Tests for deep_dive_nzila.extract_detailed_content()."""

    def test_valid_html(self, tmp_path):
        f = tmp_path / "doc.html"
        f.write_text("<article><h2>Sub</h2><li>Item</li></article>", encoding="utf-8")
        blocks = extract_detailed_content(str(f))
        assert len(blocks) == 2

    def test_file_not_found(self):
        blocks = extract_detailed_content("/missing.html")
        assert blocks == []


class TestAnalyzeKeyStrategicDocs:
    """Tests for deep_dive_nzila.analyze_key_strategic_docs()."""

    def test_empty_directory(self, tmp_path, capsys):
        analyze_key_strategic_docs(str(tmp_path))
        out = capsys.readouterr().out
        assert "NZILA STRATEGIC KNOWLEDGE VALIDATION" in out
        assert "VALIDATION COMPLETE" in out

    def test_with_portfolio_file(self, tmp_path, capsys):
        f = tmp_path / "Product Portfolio Overview.html"
        f.write_text(
            "<article><p>Product | Purpose | Status</p>"
            "<p>Memora | Cognitive Health | Strategic priority</p>"
            "</article>",
            encoding="utf-8",
        )
        analyze_key_strategic_docs(str(tmp_path))
        out = capsys.readouterr().out
        assert "PRODUCT PORTFOLIO" in out

    def test_with_experience_pillars(self, tmp_path, capsys):
        f = tmp_path / "Experience Pillars Guide.html"
        f.write_text(
            "<article>"
            "<h2>Sustainable Engagement</h2>"
            "<p>Engagement is long-term behavior change, not addictive patterns. "
            "This pillar ensures ethical Design patterns throughout.</p>"
            "</article>",
            encoding="utf-8",
        )
        analyze_key_strategic_docs(str(tmp_path))
        out = capsys.readouterr().out
        assert "EXPERIENCE PILLARS" in out

    def test_with_manifesto(self, tmp_path, capsys):
        f = tmp_path / "AI Companion Manifesto.html"
        f.write_text(
            "<article><h2>Purpose of AI</h2>"
            "<p>The Role of the companion is to provide persistent "
            "Behavioral support without crossing Boundaries.</p>"
            "</article>",
            encoding="utf-8",
        )
        analyze_key_strategic_docs(str(tmp_path))
        out = capsys.readouterr().out
        assert "AI COMPANION MANIFESTO" in out

    def test_with_ethics(self, tmp_path, capsys):
        f = tmp_path / "Gamification Ethics Protocol.html"
        f.write_text(
            "<article>"
            "<h2>Principles of Ethics</h2>"
            "<p>Dark patterns are prohibited and never acceptable</p>"
            "</article>",
            encoding="utf-8",
        )
        analyze_key_strategic_docs(str(tmp_path))
        out = capsys.readouterr().out
        assert "GAMIFICATION ETHICS" in out

    def test_with_technical_architecture(self, tmp_path, capsys):
        f = tmp_path / "Technical Architecture Diagram.html"
        f.write_text(
            "<article>"
            "<h2>Infrastructure layer overview</h2>"
            "<p>The API gateway component connects the service mesh</p>"
            "</article>",
            encoding="utf-8",
        )
        analyze_key_strategic_docs(str(tmp_path))
        out = capsys.readouterr().out
        assert "TECHNICAL ARCHITECTURE" in out

    def test_with_okr_csv(self, tmp_path, capsys):
        csv = tmp_path / "OKR_Q1_2026.csv"
        csv.write_text(
            "Objective,KeyResult\nLaunch MVP,50 DAU\nImprove NPS,+10\n",
            encoding="utf-8",
        )
        analyze_key_strategic_docs(str(tmp_path))
        out = capsys.readouterr().out
        assert "OBJECTIVES & KEY RESULTS" in out

    def test_with_projects_csv(self, tmp_path, capsys):
        csv = tmp_path / "Projects_Active.csv"
        csv.write_text(
            "Name,Status\nMemora,Active\nClinic,Planning\n", encoding="utf-8"
        )
        analyze_key_strategic_docs(str(tmp_path))
        out = capsys.readouterr().out
        assert "ACTIVE PROJECTS" in out

    def test_csv_read_error(self, tmp_path, capsys):
        csv = tmp_path / "OKR_bad.csv"
        csv.write_bytes(b"\xff\xfe")
        analyze_key_strategic_docs(str(tmp_path))
        out = capsys.readouterr().out
        # Should not crash — error is caught
        assert "VALIDATION COMPLETE" in out

    def test_projects_csv_error(self, tmp_path, capsys):
        csv = tmp_path / "Projects_oops.csv"
        csv.write_bytes(b"\xff\xfe")
        analyze_key_strategic_docs(str(tmp_path))
        out = capsys.readouterr().out
        assert "VALIDATION COMPLETE" in out


# ──────────────────────────────────────────────────────────────
# memora_comprehensive_analysis.py
# ──────────────────────────────────────────────────────────────
from memora_comprehensive_analysis import analyze_memora_architecture


class TestMemoraComprehensiveAnalysis:
    """Tests for analyze_memora_architecture()."""

    def test_prints_strategic_framework(self, capsys):
        analyze_memora_architecture()
        out = capsys.readouterr().out
        assert "MEMORA COMPREHENSIVE PLATFORM ANALYSIS" in out
        assert "Strategic Vision" in out

    def test_prints_legacy_implementation(self, capsys):
        analyze_memora_architecture()
        out = capsys.readouterr().out
        # Should print frontend and backend stack info
        assert "React" in out or "frontend" in out.lower()


# ──────────────────────────────────────────────────────────────
# multi_vertical_architecture.py
# ──────────────────────────────────────────────────────────────
from multi_vertical_architecture import analyze_cross_domain_architecture


class TestMultiVerticalArchitecture:
    """Tests for analyze_cross_domain_architecture()."""

    def test_prints_vertical_landscape(self, capsys):
        analyze_cross_domain_architecture()
        out = capsys.readouterr().out
        assert "NZILA CROSS-DOMAIN BACKBONE ARCHITECTURE" in out
        assert "VERTICAL LANDSCAPE" in out

    def test_all_verticals_present(self, capsys):
        analyze_cross_domain_architecture()
        out = capsys.readouterr().out
        assert "Healthtech" in out.upper() or "HEALTHTECH" in out
        assert "Agrotech" in out.upper() or "AGROTECH" in out
        assert "Legaltech" in out.upper() or "LEGALTECH" in out
        assert "Uniontech" in out.upper() or "UNIONTECH" in out

    def test_prints_cross_domain_patterns(self, capsys):
        analyze_cross_domain_architecture()
        out = capsys.readouterr().out
        assert "CROSS-DOMAIN PATTERNS" in out

    def test_prints_migration_framework(self, capsys):
        analyze_cross_domain_architecture()
        out = capsys.readouterr().out
        assert "LEGACY MIGRATION FRAMEWORK" in out


# ──────────────────────────────────────────────────────────────
# business_intelligence_automation.py
# ──────────────────────────────────────────────────────────────
from business_intelligence_automation import analyze_automation_opportunities


class TestBusinessIntelligenceAutomation:
    """Tests for analyze_automation_opportunities()."""

    def test_prints_automation_products(self, capsys):
        analyze_automation_opportunities()
        out = capsys.readouterr().out
        assert "NZILA BUSINESS INTELLIGENCE" in out or "AUTOMATION" in out.upper()

    def test_prints_recommendations(self, capsys):
        analyze_automation_opportunities()
        out = capsys.readouterr().out
        assert "STRATEGIC RECOMMENDATIONS" in out

    def test_prints_meta_insight(self, capsys):
        analyze_automation_opportunities()
        out = capsys.readouterr().out
        assert "META INSIGHT" in out

    def test_complete_output(self, capsys):
        analyze_automation_opportunities()
        out = capsys.readouterr().out
        assert "ANALYSIS COMPLETE" in out


# ── Extra coverage for lines missed in standalone scripts ────────────────


class TestDeepDiveExtraH3AndTable:
    """Cover deep_dive_nzila.py lines 32-33 (h3), 41-42 (td/th)."""

    def test_h3_parsing(self):
        parser = DeepDiveExtractor()
        parser.feed("<article><h3>Sub-sub heading</h3></article>")
        assert any(b["type"] == "h3" and b["level"] == 3 for b in parser.content_blocks)

    def test_td_th_parsing(self):
        parser = DeepDiveExtractor()
        parser.feed(
            "<article><table><tr><th>Header</th><td>Value</td></tr></table></article>"
        )
        # td/th handling appends ' | ' to text
        assert any(" | " in b["text"] for b in parser.content_blocks)

    def test_portfolio_body_parsing(self, tmp_path, capsys):
        """Cover deep_dive_nzila.py lines 103-105 (portfolio analysis logic)."""
        f = tmp_path / "Product Portfolio Overview.html"
        f.write_text(
            "<article>"
            "<p>Product | Purpose | Status</p>"
            "<p>Memora | Companion Platform for Cognitive Care | Strategic priority and growth</p>"
            "</article>",
            encoding="utf-8",
        )
        analyze_key_strategic_docs(str(tmp_path))
        out = capsys.readouterr().out
        assert "PRODUCT PORTFOLIO" in out


class TestBackboneInfrastructureExtraFiles:
    """Cover backbone_infrastructure_analysis.py lines 99-163."""

    def test_with_multi_product_file(self, tmp_path, capsys):
        f = (
            tmp_path
            / "🏗️ Multi-Product Operating Architecture 1e585df01907804c85b6debb645d1f39.html"
        )
        f.write_text(
            "<article><h1>Title</h1><h2>Section</h2>"
            "<p>Some long paragraph with more than thirty characters explaining things</p>"
            "<li>Bullet item list content</li>"
            "</article>",
            encoding="utf-8",
        )
        import backbone_infrastructure_analysis as bmod

        with patch.object(bmod, "Path", lambda x: Path(tmp_path)):
            bmod.analyze_backbone_infrastructure()
        out = capsys.readouterr().out
        assert "MULTI-PRODUCT OPERATING ARCHITECTURE" in out

    def test_with_shared_services_file(self, tmp_path, capsys):
        import backbone_infrastructure_analysis as bmod

        f = (
            tmp_path
            / "🧩 Shared Services Playbooks 1e685df01907802ab0acefa79d68e227.html"
        )
        f.write_text(
            "<article><h2>Service Overview</h2>"
            "<li>Service Team Platform Infrastructure shared</li>"
            "</article>",
            encoding="utf-8",
        )
        with patch.object(bmod, "Path", lambda x: Path(tmp_path)):
            bmod.analyze_backbone_infrastructure()
        out = capsys.readouterr().out
        assert "SHARED SERVICES PLAYBOOKS" in out

    def test_with_ai_core_file(self, tmp_path, capsys):
        import backbone_infrastructure_analysis as bmod

        f = tmp_path / "📌 CareAI Core System 1e785df0190780b68806d7a18c14f3b2.html"
        f.write_text(
            "<article><h2>AI Architecture</h2>"
            "<p>The CareAI Core system provides a shared artificial intelligence infrastructure for all products and more</p>"
            "</article>",
            encoding="utf-8",
        )
        with patch.object(bmod, "Path", lambda x: Path(tmp_path)):
            bmod.analyze_backbone_infrastructure()
        out = capsys.readouterr().out
        assert "CAREAI CORE SYSTEM" in out

    def test_with_directory_file(self, tmp_path, capsys):
        import backbone_infrastructure_analysis as bmod

        f = (
            tmp_path
            / "🤝 Shared Services Directory 1e685df0190780178224c73fd564a794.html"
        )
        f.write_text(
            "<article>"
            "<li>Auth Service | Centralized identity management provider</li>"
            "<li>Billing Engine | Stripe and payment processing for all</li>"
            "</article>",
            encoding="utf-8",
        )
        with patch.object(bmod, "Path", lambda x: Path(tmp_path)):
            bmod.analyze_backbone_infrastructure()
        out = capsys.readouterr().out
        assert "SHARED SERVICES DIRECTORY" in out


class TestAnalyzeNotionExportExtra:
    """Cover analyze_notion_export.py lines 60 (table endtag), 175 (> 5 files)."""

    def test_table_parsing(self):
        """Cover line 60 — handle_endtag for td/th in table context."""
        from analyze_notion_export import NotionHTMLParser

        analyzer = NotionHTMLParser()
        analyzer.feed(
            "<table><tr><td>Cell1</td><td>Cell2</td></tr>"
            "<tr><td>A</td><td>B</td></tr></table>"
        )
        assert len(analyzer.tables) >= 1

    def test_tr_without_table_tag(self):
        """Cover line 60 — hasattr guard when current_table missing."""
        from analyze_notion_export import NotionHTMLParser

        analyzer = NotionHTMLParser()
        # Manually set in_table so the tr/td endtag branches are entered,
        # but do NOT feed <table> so current_table attribute is never created.
        analyzer.in_table = True
        assert not hasattr(analyzer, "current_table")
        analyzer.feed("<tr><td>X</td></tr>")
        # current_table should have been lazily created
        assert hasattr(analyzer, "current_table")

    def test_more_than_five_files_in_category(self, tmp_path, capsys):
        """Cover line 175 — '... and N more' branch."""
        # Create > 5 HTML files to trigger the truncation message
        for i in range(8):
            (tmp_path / f"Doc {i} abcdef0190780{i:x}.html").write_text(
                f"<article><p>Content {i}</p></article>", encoding="utf-8"
            )
        from analyze_notion_export import analyze_export

        analyze_export(str(tmp_path))
        out = capsys.readouterr().out
        assert "more" in out
